import "dotenv/config";
// Global fix for BigInt serialization in JSON responses
(BigInt.prototype as any).toJSON = function() { return this.toString(); };

import express from "express";
import compression from "compression";
import { createClient } from "@supabase/supabase-js";
import cookieParser from "cookie-parser";
import { randomBytes } from "crypto";
import {
  GAME_CONFIG,
  PERKS_DEFS,
  BOOSTER_CONFIG,
  RESOURCE_TYPES,
  AUTONOMY_CONFIG,
  BUILDING_LABELS,
  FACTORY_CONFIG,
  EXTRACTION_CONFIG,
  REGION_RESOURCE_CAPS_BY_TYPE,
  factoryYieldMultiplier,
  factoryStorageLimit,
  estimateFactoryValue,
  DAILY_GAMEPLAY_CONFIG,
} from "../src/types";
import type {
  ResourceType,
  DeepCostPreview,
  BuildingType,
  FactoryType,
  ExtractionBreakdown,
  WarType,
  TroopType,
  WarSide,
  DamageBreakdown,
  WarFull,
} from "../src/types";
import {
  TROOP_BASE_DAMAGE,
  TROOP_ENERGY_COST,
  TROOP_MONEY_COST,
  WAR_TYPE_ALLOWED_TROOPS,
} from "../src/types";
import {
  calculateDamage,
  calculateInitialAttackDamage,
  calculateInitialDefensePoints,
  calculateDamageCap,
} from "../src/services/damageCalculator";
import {
  validateTroopDeployment,
  getMaxDeployableTroops,
  getAvailableTroops,
} from "../src/services/troopManager";
import {
  validateWarCreation,
  getWarDuration,
  calculateDistancePenalty,
  shouldTransitionNavalPhase,
} from "../src/services/warService";
import { getResolutionEffects, resolveWar as resolveWarLogic } from "../src/services/battleResolver";
import { shouldAutoAttackFire, getWarsToResolve, getNavalWarsForPhaseTransition } from "../src/services/warScheduler";
import { selectDailyMissions, MISSION_TEMPLATES, MISSION_ACTION_MAP } from "../src/services/dailyMissionsService";
import { setupRoutes } from "./routes";
import { createWarDomainDeps } from "./services/war-domain.helpers";
import { DailyRewardRepository } from "./repositories/daily-reward.repository";
import { DailyRewardService } from "./services/daily-reward.service";
import { FactoryEconomyRepository } from "./repositories/factory-economy.repository";
import { FactoryEconomyService } from "./services/factory-economy.service";
import { FactoryUpgradeRepository } from "./repositories/factory-upgrade.repository";
import { FactoryUpgradeService } from "./services/factory-upgrade.service";
import { FactoryCreateRepository } from "./repositories/factory-create.repository";
import { FactoryCreateService } from "./services/factory-create.service";
import { PartyAssetsRepository } from "./repositories/party-assets.repository";
import { PartyAssetsService } from "./services/party-assets.service";
import { ProductionRepository } from "./repositories/production.repository";
import { ProductionService } from "./services/production.service";
import { isDailyBonusClaimSuccess, isDailyMissionClaimSuccess } from "./observability/contract-guards";
import { mapServiceResultToHttp } from "./services/http-result.mapper";
import { errorHandler } from "./middleware/errorHandler.middleware";
import { globalLimiter } from "./middleware/rateLimiter.middleware";
import {
  hasEnergyDrinkCooldownExpired,
  resolveExtractionEnergyCost,
} from "./utils/automation-energy";
import { logger } from "./utils/logger";

logger.info("Starting backend/app.ts");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ENABLE_DEV_ENDPOINTS = process.env.ENABLE_DEV_ENDPOINTS === 'true';

// Validate JWT_SECRET — must not be default in production
if (IS_PRODUCTION && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me-in-production')) {
  console.error('FATAL ERROR: JWT_SECRET must be set to a strong value in production');
  process.exit(1);
}

const generateSecureId = (length: number = 9): string =>
  randomBytes(Math.ceil(length / 2)).toString("hex").slice(0, length);

// Seeded Random Helper
const seededRandom = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return () => {
    hash = (hash * 16807) % 2147483647;
    return (hash - 1) / 2147483646;
  };
};

const generateGameStatsForCountry = (iso2: string) => {
  const rng = seededRandom(iso2);
  const resourceTypes = ["Oil", "Steel", "Food", "Tech", "Uranium"];
  const numResources = 1 + Math.floor(rng() * 3);
  const selectedResources = [];
  const shuffled = [...resourceTypes].sort(() => rng() - 0.5);

  const getIndicator = () => 1 + Math.floor(rng() * 10); // 1-10

  for (let i = 0; i < numResources; i++) {
    selectedResources.push({
      type: shuffled[i],
      base: 10 + Math.floor(rng() * 90)
    });
  }

  return {
    indicators: {
      health: getIndicator(),
      education: getIndicator(),
      industry: getIndicator(),
      security: getIndicator(),
      infrastructure: getIndicator(),
      morale: getIndicator(),
      economy: getIndicator(),
      tech: getIndicator(),
      resourcesQuality: getIndicator(),
      stability: getIndicator()
    },
    resources: selectedResources,
  };
};

// Initialize Supabase Client (Service Role for admin bypass)
const supabaseUrl = (process.env.VITE_SUPABASE_URL || "").trim();
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase URL or SUPABASE_SERVICE_ROLE_KEY missing in Environment Variables.");
}

const supabase = createClient(supabaseUrl, supabaseKey);
const factoryEconomyService = new FactoryEconomyService(new FactoryEconomyRepository(supabase));
const factoryUpgradeService = new FactoryUpgradeService(new FactoryUpgradeRepository(supabase));
const factoryCreateService = new FactoryCreateService(new FactoryCreateRepository(supabase));
const partyAssetsService = new PartyAssetsService(new PartyAssetsRepository(supabase));
const productionService = new ProductionService(new ProductionRepository(supabase));

// Compressione gzip/deflate: riduce egress JSON del 60-75% su tutte le risposte
app.use(compression());
app.use(express.json());

function isTransientSupabaseNetworkError(error: any) {
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  return (
    message.includes('fetch failed') ||
    message.includes('network') ||
    details.includes('fetch failed') ||
    details.includes('enotfound') ||
    details.includes('eai_again') ||
    details.includes('etimedout') ||
    details.includes('ecconnreset')
  );
}

async function retrySupabaseOperation<T>(
  label: string,
  operation: () => Promise<T>,
  options?: { attempts?: number; delayMs?: number }
): Promise<T> {
  const attempts = options?.attempts ?? 3;
  const delayMs = options?.delayMs ?? 1500;
  let lastError: any;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      if (!isTransientSupabaseNetworkError(error) || attempt === attempts) {
        break;
      }
      console.warn(`[SupabaseRetry] ${label} failed (attempt ${attempt}/${attempts}), retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

// --- Government & Salary Configuration ---
const GOVERNMENT_SALARY_CONFIG: Record<string, { headOfState: number; minister: number }> = {
  // Base daily gold per region
  'PARLIAMENTARY_REPUBLIC': { headOfState: 40, minister: 25 },
  'PRESIDENTIAL_REPUBLIC': { headOfState: 40, minister: 25 },
  'DOMINANT_PARTY': { headOfState: 30, minister: 20 },
  'DICTATORSHIP': { headOfState: 60, minister: 15 },
  'ONE_PARTY_SYSTEM': { headOfState: 35, minister: 20 },
  'EXECUTIVE_MONARCHY': { headOfState: 80, minister: 10 },
  // Localized fallbacks
  'REPUBBLICA': { headOfState: 40, minister: 25 },
  'REPUBBLICA PARLAMENTARE': { headOfState: 40, minister: 25 },
};

/**
 * Calculates current salaries based on government form and region count.
 * For Republics: 40 gold/day per region for Head of State, 25 for Ministers.
 */
function calculateStateSalaries(governmentForm: string | null, regionCount: number) {
  const normalized = (governmentForm || '').toUpperCase();
  const config = GOVERNMENT_SALARY_CONFIG[normalized] || GOVERNMENT_SALARY_CONFIG['PARLIAMENTARY_REPUBLIC'];
  
  // Salary scales with the number of regions (minimum 1 to avoid 0 for independent regions)
  const actualCount = Math.max(1, regionCount);
  
  return {
    headOfStateGold: config.headOfState * actualCount,
    ministerGold: config.minister * actualCount,
  };
}
app.use(cookieParser());
app.use('/api', globalLimiter);

// Helper to get user perks, including active boosters
const getUserPerks = async (userId: string, boosterInfo?: Record<string, any>) => {
  const { data: perks } = await supabase.from('perks').select('perkId, level').eq('userId', userId);
  const perkMap: Record<string, number> = {};
  if (perks) {
    perks.forEach((p: any) => perkMap[p.perkId] = p.level);
  }

  // Energy & XP Booster calculation
  if (boosterInfo) {
    // Current logic uses boosters stored in user's Perks upgrades JSON
    // but the system is transitioning to a dedicated table/column.
    // Keeping it simple for now based on incoming boosterInfo.
    if (boosterInfo.type === 'ENERGY_BOOSTER') perkMap['RESISTENZA'] = (perkMap['RESISTENZA'] || 0) + (boosterInfo.strength || 0);
    if (boosterInfo.type === 'XP_BOOSTER') perkMap['ISTRUZIONE'] = (perkMap['ISTRUZIONE'] || 0) + (boosterInfo.strength || 0);
  }

  return perkMap;
};

// Helper to validate ISO2 country codes (prevents injection in .or() queries)
const isValidIso2 = (code: string): boolean => /^[A-Z]{2,4}$/.test(code);
const isValidUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const isAllowedAvatarDataUrl = (value: string): boolean =>
  /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=\r\n]+$/i.test(value);

const canManageRegion = async (regionId: string, userId: string): Promise<boolean> => {
  const normalizedRegionId = String(regionId || '').trim().toUpperCase();
  if (!isValidIso2(normalizedRegionId) || !userId) return false;

  const { data: region, error } = await supabase
    .from('regions')
    .select('ownerUserId, leaderUserId')
    .eq('id', normalizedRegionId)
    .maybeSingle();

  if (error || !region) return false;
  return region.ownerUserId === userId || region.leaderUserId === userId;
};

const normalizeRegionLikeId = (value: any): string | null => {
  const normalized = String(value || '').trim().toUpperCase();
  return isValidIso2(normalized) ? normalized : null;
};

const canReadRegionScopedData = async (user: any, regionId: string): Promise<boolean> => {
  if (!user?.id || !regionId) return false;
  const canManage = await canManageRegion(regionId, user.id);
  if (canManage) return true;
  return user.residenceId === regionId || user.workPermitId === regionId;
};

const normalizeNewspaperRole = (value: any): 'owner' | 'editor' | 'writer' | null => {
  const role = String(value || '').trim().toLowerCase();
  if (role === 'owner' || role === 'editor' || role === 'writer') return role;
  return null;
};

const canAssignNewspaperRole = (actorRole: string, targetRole: 'owner' | 'editor' | 'writer'): boolean => {
  if (actorRole === 'editor') return targetRole === 'writer';
  if (actorRole === 'owner') return targetRole === 'editor' || targetRole === 'writer';
  return false;
};

const assertCanManageRegion = async (
  req: any,
  res: any,
  rawRegionId: any,
  forbiddenMessage: string
): Promise<string | null> => {
  const regionId = normalizeRegionLikeId(rawRegionId);
  if (!regionId) {
    res.status(400).json({ error: "Regione non valida." });
    return null;
  }

  const allowed = await canManageRegion(regionId, req.user?.id);
  if (!allowed) {
    res.status(403).json({ error: forbiddenMessage });
    return null;
  }

  return regionId;
};

// Helper to calculate XP and Level Up
const addXP = async (userId: string, amount: number) => {
  try {
    const { error } = await supabase.rpc('add_user_xp', { p_user_id: userId, p_amount: amount });
    if (error) throw error;
  } catch (rpcError) {
    console.error("RPC add_user_xp failed, using fallback:", rpcError);
    // Fallback: direct SQL update with level-up logic
    try {
      const { data: u } = await supabase.from('users').select('xp, level').eq('id', userId).single();
      if (!u) return;
      let xp = (u.xp || 0) + amount;
      let level = u.level || 1;
      let nextXp = Math.floor(100 * Math.pow(1.5, level - 1));
      while (xp >= nextXp) {
        xp -= nextXp;
        level++;
        nextXp = Math.floor(100 * Math.pow(1.5, level - 1));
      }
      await supabase.from('users').update({ xp, level }).eq('id', userId);
    } catch (fallbackErr) {
      console.error("Fallback XP update also failed:", fallbackErr);
    }
  }
};

// Helper to get the start of the current primaries cycle (5-day cycle)
const PRIMARIES_CYCLE_MS = 5 * 24 * 60 * 60 * 1000;
const getPrimariesCycleStart = () => new Date(Math.floor(Date.now() / PRIMARIES_CYCLE_MS) * PRIMARIES_CYCLE_MS).toISOString();

// In-memory cache for deep_levels configuration (rarely changes, queried frequently).
// Suitable for single-instance deployments; for multi-instance, consider a shared cache.
let deepLevelsCache: any[] | null = null;
let deepLevelsCacheTs = 0;
const DEEP_LEVELS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
async function getCachedDeepLevels() {
  const now = Date.now();
  if (!deepLevelsCache || now - deepLevelsCacheTs > DEEP_LEVELS_CACHE_TTL) {
    const { data } = await supabase
      .from('deep_levels')
      .select('*')
      .eq('enabled', true)
      .order('level', { ascending: true });
    deepLevelsCache = data || [];
    deepLevelsCacheTs = now;
  }
  return deepLevelsCache;
}

const calculateMinisterWage = async (stateId: string, role: string) => {
  const { data: region } = await supabase
    .from('regions')
    .select('governmentForm, economyLevel, ownerUserId, healthIndex, educationIndex, developmentIndex')
    .eq('id', stateId)
    .single();

  if (!region) return 0;

  // 1. Base from regional indices (no legacy Health/Education/Military params)
  const devIndex =
    ((region.developmentIndex ?? 1) +
      (region.educationIndex ?? 1) +
      (region.healthIndex ?? 1) +
      (region.economyLevel ?? 1)) /
    4;

  // 2. Multiplier from Government Form
  let govMult = 1.0;
  if (region.governmentForm === 'PRESIDENTIAL_REPUBLIC') govMult = 1.5;
  if (region.governmentForm === 'DICTATORSHIP') govMult = 2.0;
  if (region.governmentForm === 'ONE_PARTY_SYSTEM') govMult = 1.8;

  // 3. Multiplier from Region Count (representing state size/complexity)
  const { count } = await supabase
    .from('regions')
    .select('*', { count: 'exact', head: true })
    .eq('ownerUserId', region.ownerUserId);

  const sizeMult = 1 + ((count || 1) * 0.1);

  const baseWage = 10; // 10 Gold base
  return Math.floor(baseWage * devIndex * govMult * sizeMult);
};

// --- Travel Time System: Country coordinates and distance calculation ---
const COUNTRY_COORDS: Record<string, [number, number]> = {
  // Europe
  IT: [41.87, 12.57], FR: [46.60, 2.35], DE: [51.17, 10.45], ES: [40.46, -3.75],
  GB: [55.38, -3.44], PT: [39.40, -8.22], NL: [52.13, 4.89], BE: [50.50, 4.47],
  CH: [46.82, 8.23], AT: [47.52, 14.55], PL: [51.92, 19.15], CZ: [49.82, 15.47],
  SK: [48.67, 19.70], HU: [47.16, 19.50], RO: [45.94, 24.97], BG: [42.73, 25.49],
  GR: [39.07, 21.82], HR: [45.10, 15.20], RS: [44.02, 21.01], BA: [43.92, 17.68],
  SI: [46.15, 14.99], ME: [42.71, 19.37], MK: [41.51, 21.75], AL: [41.15, 20.17],
  XK: [42.60, 20.90], SE: [60.13, 18.64], NO: [60.47, 8.47], FI: [61.92, 25.75],
  DK: [56.26, 9.50], IS: [64.96, -19.02], IE: [53.41, -8.24], LT: [55.17, 23.88],
  LV: [56.88, 24.60], EE: [58.60, 25.01], LU: [49.82, 6.13], MT: [35.94, 14.38],
  CY: [35.13, 33.43], MD: [47.41, 28.37], BY: [53.71, 27.95], UA: [48.38, 31.17],
  // Asia
  RU: [61.52, 105.32], TR: [38.96, 35.24], CN: [35.86, 104.20], JP: [36.20, 138.25],
  KR: [35.91, 127.77], KP: [40.34, 127.51], IN: [20.59, 78.96], PK: [30.38, 69.35],
  BD: [23.68, 90.36], ID: [0.79, 113.92], MY: [4.21, 101.98], TH: [15.87, 100.99],
  VN: [14.06, 108.28], PH: [12.88, 121.77], MM: [21.92, 95.96], KH: [12.57, 104.99],
  LA: [19.86, 102.50], SG: [1.35, 103.82], TW: [23.70, 120.96], MN: [46.86, 103.85],
  KZ: [48.02, 66.92], UZ: [41.38, 64.59], TM: [38.97, 59.56], KG: [41.20, 74.77],
  TJ: [38.86, 71.28], AF: [33.94, 67.71], IQ: [33.22, 43.68], IR: [32.43, 53.69],
  SA: [23.89, 45.08], AE: [23.42, 53.85], QA: [25.35, 51.18], KW: [29.31, 47.48],
  OM: [21.51, 55.92], YE: [15.55, 48.52], JO: [30.59, 36.24], LB: [33.85, 35.86],
  SY: [34.80, 38.99], IL: [31.05, 34.85], PS: [31.95, 35.23], GE: [42.32, 43.36],
  AM: [40.07, 45.04], AZ: [40.14, 47.58], NP: [28.39, 84.12], LK: [7.87, 80.77],
  BT: [27.51, 90.43], MV: [3.20, 73.22], BN: [4.54, 114.73], TL: [8.87, 125.73],
  // Africa
  EG: [26.82, 30.80], MA: [31.79, -7.09], DZ: [28.03, 1.66], TN: [33.89, 9.54],
  LY: [26.34, 17.23], SD: [12.86, 30.22], SS: [6.88, 31.31], ET: [9.15, 40.49],
  KE: [0.02, 37.91], TZ: [-6.37, 34.89], UG: [1.37, 32.29], RW: [-1.94, 29.87],
  BI: [-3.37, 29.92], CD: [-4.04, 21.76], CG: [-0.23, 15.83], GA: [-0.80, 11.61],
  CM: [7.37, 12.35], NG: [9.08, 8.68], GH: [7.95, -1.02], CI: [7.54, -5.55],
  SN: [14.50, -14.45], ML: [17.57, -4.00], NE: [17.61, 8.08], BF: [12.24, -1.56],
  TG: [8.62, 1.21], BJ: [9.31, 2.32], GM: [13.44, -15.31], GW: [11.80, -15.18],
  GN: [9.95, -9.70], SL: [8.46, -11.78], LR: [6.43, -9.43], MR: [21.01, -10.94],
  ZA: [-30.56, 22.94], NA: [-22.96, 18.49], BW: [-22.33, 24.68], ZW: [-19.02, 29.15],
  MZ: [-18.67, 35.53], MG: [-18.77, 46.87], MW: [-13.25, 34.30], ZM: [-13.13, 27.85],
  AO: [-11.20, 17.87], SO: [5.15, 46.20], DJ: [11.83, 42.59], ER: [15.18, 39.78],
  ST: [0.19, 6.61], SC: [-4.68, 55.49], MU: [-20.35, 57.55], KM: [-11.88, 43.87],
  // Americas
  US: [37.09, -95.71], CA: [56.13, -106.35], MX: [23.63, -102.55], BR: [-14.24, -51.93],
  AR: [-38.42, -63.62], CL: [-35.68, -71.54], CO: [4.57, -74.30], VE: [6.42, -66.59],
  PE: [-9.19, -75.02], EC: [-1.83, -78.18], BO: [-16.29, -63.59], PY: [-23.44, -58.44],
  UY: [-32.52, -55.77], GY: [4.86, -58.93], SR: [3.92, -56.03], CU: [21.52, -77.78],
  HT: [18.97, -72.29], DO: [18.74, -70.16], JM: [18.11, -77.30], TT: [10.69, -61.22],
  PR: [18.22, -66.59], GT: [15.78, -90.23], HN: [15.20, -86.24], SV: [13.79, -88.90],
  NI: [12.87, -85.21], CR: [9.75, -83.75], PA: [8.54, -80.78], BZ: [17.19, -88.50],
  // Oceania
  AU: [-25.27, 133.78], NZ: [-40.90, 174.89], PG: [-6.31, 143.96], FJ: [-17.71, 178.07],
  WS: [-13.76, -172.10], TO: [-21.18, -175.20], VU: [-15.38, 166.96],
};

// Haversine formula: calculates distance in km between two lat/lng points
const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Travel time configuration
const TRAVEL_MIN_MINUTES = 1;
const TRAVEL_MAX_MINUTES = 60;
const TRAVEL_KM_PER_MINUTE = 100;
const TRAVEL_DEFAULT_MS = 2 * 60 * 1000; // 2 minutes fallback if coords unknown

// Calculate travel time in milliseconds based on distance between two ISO2 regions
const calculateTravelTimeMs = (fromIso2: string, toIso2: string): number => {
  const from = COUNTRY_COORDS[fromIso2.toUpperCase()];
  const to = COUNTRY_COORDS[toIso2.toUpperCase()];
  if (!from || !to) return TRAVEL_DEFAULT_MS;
  const distKm = haversineDistance(from[0], from[1], to[0], to[1]);
  const minutes = Math.max(TRAVEL_MIN_MINUTES, Math.min(TRAVEL_MAX_MINUTES, Math.round(distKm / TRAVEL_KM_PER_MINUTE)));
  return minutes * 60 * 1000;
};

// ── Auth cache ───────────────────────────────────────────────
// Evita 5-9 query Supabase per ogni richiesta: il risultato
// dell'hydration utente viene tenuto 45 secondi per token.
const AUTH_CACHE_TTL_MS = 45_000;
const authCache = new Map<string, { user: any; expiresAt: number }>();

// ▼ MINIMAL select per /api/me polling (ogni 20s) — ~20 campi essenziali
// Evita: email, influence, militaryExp, createdAt, lastLogin, perkPoints
const AUTH_USER_SELECT_MINIMAL = [
  'id',
  'username',
  'money',
  'gold',
  'energy',
  'regionId',
  'residenceId',
  'workPermitId',
  'originalNation',
  'displayedNation',
  'lastOriginalNationChange',
  'lastEnergyUpdate',
  'xp',
  'level',
  'energyDrinks',
  'lastEnergyDrink',
  'warMedals',
  'lastMedalClaim',
  'travelingTo',
  'travelingUntil',
  'travelingFrom',
  'travelDurationMs',
  'perkUpgradesJson',
  'boostersJson',
].join(', ');

// ▼ FULL select per initial load / detailed operations
const AUTH_USER_SELECT = [
  'id',
  'username',
  'email',
  'money',
  'gold',
  'energy',
  'influence',
  'regionId',
  'residenceId',
  'workPermitId',
  'originalNation',
  'displayedNation',
  'lastOriginalNationChange',
  'lastEnergyUpdate',
  'xp',
  'level',
  'perkPoints',
  'energyDrinks',
  'lastEnergyDrink',
  'warMedals',
  'lastMedalClaim',
  'lastLogin',
  'perkUpgradesJson',
  'boostersJson',
  'travelingTo',
  'travelingUntil',
  'travelingFrom',
  'travelDurationMs',
  'militaryExp',
  'createdAt',
].join(', ');

function getCachedAuthUser(token: string): any | null {
  const entry = authCache.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    authCache.delete(token);
    return null;
  }
  return entry.user;
}

function setCachedAuthUser(token: string, user: any): void {
  // Pulizia periodica per evitare memory leak su server long-running
  if (authCache.size > 2000) {
    const now = Date.now();
    for (const [k, v] of authCache) {
      if (now > v.expiresAt) authCache.delete(k);
    }
  }
  authCache.set(token, { user: { ...user }, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
}

/** Invalida la cache per un utente (chiamare dopo mutazioni critiche su users) */
function invalidateUserAuthCache(userId: string): void {
  for (const [token, entry] of authCache) {
    if (entry.user?.id === userId) authCache.delete(token);
  }
}
// ─────────────────────────────────────────────────────────────

// Middleware to verify Supabase JWT and update user state
const authenticate = async (req: any, res: any, next: any) => {
  let token = null;

  // 1. Try Authorization header first (Bearer <token>)
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7);
  } else {
    token = req.cookies?.['sb-access-token'] || req.cookies?.['token'];
  }

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: Access token missing." });
  }

  // ▼ Cache hit: skip all Supabase queries for this request
  const cachedUser = getCachedAuthUser(token);
  if (cachedUser) {
    req.user = cachedUser;
    return next();
  }

  try {
    // Verify token with Supabase
    // We use the default client (anon/user) to verify the token
    console.log("[Auth] Verifying bearer token.");
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authUser) {
      console.error("[Auth] Token verification failed:", {
        message: authError?.message,
        status: authError?.status,
        code: authError?.code,
        fullError: authError
      });
      if (authError?.message?.includes("token is expired")) {
        // Routine expiration, no need to log as error
      }
      return res.status(401).json({ error: "Unauthorized: Invalid session." });
    }

    // Fetch user data from 'users' table — using MINIMAL select to reduce query size
    // We use the service role client (global 'supabase') to bypass RLS and see all columns/users
    const { data: initialUser, error: userError } = await supabase
      .from('users')
      .select(AUTH_USER_SELECT_MINIMAL)
      .eq('id', authUser.id)
      .single();
    let user: any = initialUser;

    if (userError || !user) {
      if (userError && userError.code !== 'PGRST116') {
         console.error("Error fetching user from table:", userError);
      }

      const pickDefaultRegionId = async (): Promise<string | null> => {
        const preferredRegionIds = ['IT-RM', 'IT'];
        for (const regionId of preferredRegionIds) {
          const { data: preferred, error: preferredErr } = await supabase
            .from('regions')
            .select('id')
            .eq('id', regionId)
            .maybeSingle();
          if (preferredErr && preferredErr.code !== 'PGRST116') {
            console.error(`[JIT] Error checking preferred region ${regionId}:`, preferredErr);
          }
          if (preferred?.id) return preferred.id;
        }

        const { data: anyRegion, error: anyRegionErr } = await supabase
          .from('regions')
          .select('id')
          .limit(1);

        if (anyRegionErr) {
          console.error("[JIT] Error selecting fallback region:", anyRegionErr);
          return null;
        }

        return anyRegion?.[0]?.id ?? null;
      };

      // Just-in-time provisioning: create user if they exist in Auth but not in public.users
      console.log(`[JIT] Provisioning new user: ${authUser.email} (${authUser.id})`);
      const defaultRegionId = await pickDefaultRegionId();
      if (!defaultRegionId) {
        return res.status(500).json({ error: "Failed to create user profile: no region available in database." });
      }

      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          id: authUser.id,
          username: authUser.user_metadata?.username || authUser.email?.split('@')[0] || `User_${authUser.id.substring(0, 5)}`,
          money: 5000,
          gold: 50,
          energy: 100,
          xp: 0,
          level: 1,
          regionId: defaultRegionId,
          residenceId: defaultRegionId,
          lastEnergyUpdate: Date.now(),
          lastLogin: Date.now()
        })
        .select(AUTH_USER_SELECT_MINIMAL)
        .single() as any;
      
      if (createError) {
        if (createError.code === '23505') {
          // Race condition: another request created the user concurrently.
          // Re-fetch the newly created user record.
          let { data: retryUser, error: retryError } = await supabase
            .from('users')
            .select(AUTH_USER_SELECT_MINIMAL)
            .eq('id', authUser.id)
            .single() as any;
          
          if (retryError || !retryUser) {
            console.error("[JIT] Error re-fetching user after race condition:", retryError);
            return res.status(500).json({ error: "Failed to retrieve user profile after concurrent creation." });
          }
          user = retryUser;
        } else {
          console.error("[JIT] Error provisioning user:", createError);
          return res.status(500).json({ error: "Failed to create user profile. Please check if 'regions' table is populated." });
        }
      } else {
        if (newUser) {
          console.log(`[JIT] Successfully provisioned user: ${newUser.username}`);
          user = newUser;

          // Grant starter resources to new player
          const starterResources = [
            { userId: newUser.id, itemId: 'oil', quantity: 20 },
            { userId: newUser.id, itemId: 'minerals', quantity: 20 },
            { userId: newUser.id, itemId: 'uranium', quantity: 5 },
            { userId: newUser.id, itemId: 'diamonds', quantity: 5 },
          ];
          try {
            await supabase.from('user_inventory').insert(starterResources);
            console.log(`[JIT] Granted starter resources to ${newUser.username}`);
          } catch (invErr) {
            console.error("[JIT] Error granting starter resources:", invErr);
          }
        }
      }
    }

    // Attach user to request
    req.user = user;
    req.user.maxEnergy = GAME_CONFIG.ENERGY_MAX;

    // ▼ OPTIMIZATION: Heavy operations moved to /api/sync-state (called separately, not on every auth)
    // Previously loaded here:
    // - party membership (join query)
    // - perk levels (separate query to perks table)
    // - inventory (separate query to user_inventory table)
    // - work experience (separate query to player_resource_work_experience table)
    // - perk upgrade finalization (upsert + update)
    // - travel auto-completion (update)
    // - energy regeneration (update)
    // - lastLogin update

    // Load minimal parsed data from JSON columns
    try {
      req.user.perkUpgrades = JSON.parse(user.perkUpgradesJson || '{}');
    } catch { req.user.perkUpgrades = {}; }
    try {
      req.user.boosters = JSON.parse(user.boostersJson || '{}');
    } catch { req.user.boosters = {}; }

    // Provide placeholder values to prevent frontend errors
    // These will be filled by /api/sync-state when called
    req.user.perks = {};
    req.user.partyId = undefined;
    req.user.partyName = undefined;
    req.user.partyLogo = undefined;
    req.user.inventory = {};
    req.user.inventoryVolume = 0;
    req.user.oilExp = 0;
    req.user.mineralsExp = 0;
    req.user.uraniumExp = 0;
    req.user.diamondsExp = 0;
    req.user.goldOreExp = 0;

    // ▼ Salva in cache per evitare re-hydration nei prossimi 45s
    setCachedAuthUser(token, req.user);

    next();
  } catch (err) {
    console.error("Auth Middleware Critical Error:", err);
    if (isTransientSupabaseNetworkError(err)) {
      return res.status(503).json({ error: "Service temporarily unavailable. Please retry in a few seconds." });
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// ── Dipartimenti di Stato ──────────────────────────────────
// Lista centralizzata dei dipartimenti validi (risorse + militari)
// Il controllo avviene SOLO server-side — il client non è mai trusted
const DEPT_RESOURCE: readonly string[] = Object.freeze([
  'oil','minerals','uranium','diamonds','gold_ore','liquid_oxygen','helium3','energy','food','steel','gas'
]);
const DEPT_MILITARY: readonly string[] = Object.freeze([
  'tank','aircraft','battleship'
]);
const ALL_VALID_DEPARTMENTS = new Set<string>([...DEPT_RESOURCE, ...DEPT_MILITARY]);
const DEPARTMENT_DAILY_POINTS = 10;
const DEPARTMENT_EDUCATION_REQUIREMENT = 100; // livello perk ISTRUZIONE richiesto

// Labels e icone per la UI dei dipartimenti
const DEPT_META: Record<string, { label: string; icon: string; category: 'resource' | 'military' }> = {
  oil:           { label: 'Petrolio',          icon: '🛢️', category: 'resource' },
  minerals:      { label: 'Minerali',          icon: '🪨', category: 'resource' },
  uranium:       { label: 'Uranio',            icon: '☢️', category: 'resource' },
  diamonds:      { label: 'Diamanti',          icon: '💎', category: 'resource' },
  gold_ore:      { label: 'Oro',               icon: '🪙', category: 'resource' },
  liquid_oxygen: { label: 'Ossigeno Liquido',  icon: '🧊', category: 'resource' },
  helium3:       { label: 'Elio-3',            icon: '⚗️', category: 'resource' },
  energy:        { label: 'Energia',           icon: '⚡', category: 'resource' },
  food:          { label: 'Cibo',              icon: '🍞', category: 'resource' },
  steel:         { label: 'Acciaio',           icon: '⛓️', category: 'resource' },
  gas:           { label: 'Gas Naturale',      icon: '🔥', category: 'resource' },
  tank:          { label: 'Carri Armati',      icon: '🛡️', category: 'military' },
  aircraft:      { label: 'Aerei',             icon: '✈️', category: 'military' },
  battleship:    { label: 'Corazzate Navali',  icon: '⚓', category: 'military' },
};

/**
 * Calcola il bonus percentuale basato sul rank globale.
 * Struttura preparata per la fase 2 — NON ancora applicata al gameplay.
 * rank 1 → +10%, 2 → +8%, 3 → +6%, 4-5 → +4%, resto → 0%
 */
function getDeptBonusMultiplier(rank: number): number {
  if (rank === 1) return 0.10;
  if (rank === 2) return 0.08;
  if (rank === 3) return 0.06;
  if (rank <= 5)  return 0.04;
  return 0;
}

// Actions
const checkCooldown = async (userId: string, actionType: string, cooldownTime: number) => {
  const { data } = await supabase
    .from('cooldowns')
    .select('last_used')
    .eq('user_id', userId)
    .eq('action_type', actionType)
    .maybeSingle();

  if (!data) return true;
  return (Date.now() - new Date(data.last_used).getTime()) >= cooldownTime;
};

const updateCooldown = async (userId: string, actionType: string) => {
  await supabase.from('cooldowns').upsert({
    user_id: userId,
    action_type: actionType,
    last_used: new Date().toISOString()
  });
};

// --- Budget Core Helper ---
// --- Budget Core Helper (Supabase RPC based) ---
async function addBudgetTransaction(
  ownerType: string,
  ownerId: string,
  type: string,
  subtype: string,
  moneyDelta: number,
  resourcesDelta: Record<string, number> = {},
  createdByUserId: string | null = null,
  metadata: any = {}
) {
  const normalizeResourcesDelta = (raw: Record<string, number> = {}) => {
    const normalized: Record<string, number> = {};
    for (const [key, value] of Object.entries(raw || {})) {
      const parsed = Math.trunc(Number(value) || 0);
      if (parsed !== 0) normalized[key] = parsed;
    }
    return normalized;
  };

  const addBudgetTransactionFallback = async () => {
    const normalizedMoneyDelta = Math.trunc(Number(moneyDelta) || 0);
    const normalizedResourcesDelta = normalizeResourcesDelta(resourcesDelta);

    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: budget, error: budgetErr } = await supabase
        .from('budgets')
        .select('id, moneyEUR, resources')
        .eq('ownerType', ownerType)
        .eq('ownerId', ownerId)
        .maybeSingle();
      if (budgetErr) throw budgetErr;
      if (!budget?.id) {
        await ensureBudgetExists();
        continue;
      }

      const currentMoney = Math.trunc(Number(budget.moneyEUR) || 0);
      const newMoney = currentMoney + normalizedMoneyDelta;
      if (newMoney < 0) throw new Error('Fondi insufficienti');

      const rawResources = typeof budget.resources === 'string'
        ? JSON.parse(budget.resources || '{}')
        : (budget.resources || {});
      const newResources: Record<string, number> = {};
      for (const [key, value] of Object.entries(rawResources || {})) {
        newResources[key] = Math.trunc(Number(value) || 0);
      }

      for (const [key, delta] of Object.entries(normalizedResourcesDelta)) {
        const nextValue = (newResources[key] || 0) + delta;
        if (nextValue < 0) throw new Error(`Risorse insufficienti: ${key}`);
        newResources[key] = nextValue;
      }

      const now = Date.now();
      const { data: updatedBudget, error: updateErr } = await supabase
        .from('budgets')
        .update({
          moneyEUR: newMoney,
          resources: newResources,
          updatedAt: now,
        })
        .eq('id', budget.id)
        .eq('moneyEUR', currentMoney)
        .select('id')
        .maybeSingle();
      if (updateErr) throw updateErr;
      if (!updatedBudget?.id) continue;

      const txId = generateSecureId(12);
      const txPayload: any = {
        id: txId,
        budgetId: budget.id,
        type,
        subtype,
        moneyDelta: normalizedMoneyDelta,
        resourcesDelta: normalizedResourcesDelta,
        createdAt: now,
        metadata: metadata || {},
      };
      if (createdByUserId) txPayload.createdByUserId = createdByUserId;

      let { error: txErr } = await supabase.from('budget_transactions').insert(txPayload);
      if (txErr && txPayload.createdByUserId) {
        const txMsg = String((txErr as any)?.message || '').toLowerCase();
        if (txMsg.includes('uuid') || txMsg.includes('invalid input syntax')) {
          delete txPayload.createdByUserId;
          ({ error: txErr } = await supabase.from('budget_transactions').insert(txPayload));
        }
      }
      if (txErr) throw txErr;

      return txId;
    }

    throw new Error('Conflitto durante aggiornamento budget. Riprova.');
  };

  // Older DBs may not have pre-created budgets for all owners.
  // Keep backend automation resilient by auto-creating missing budgets.
  const ensureBudgetExists = async () => {
    const { data: existing, error: readErr } = await supabase
      .from('budgets')
      .select('id')
      .eq('ownerType', ownerType)
      .eq('ownerId', ownerId)
      .maybeSingle();
    if (readErr) throw readErr;
    if (existing?.id) return;

    const { error: insertErr } = await supabase.from('budgets').insert({
      ownerType,
      ownerId,
      moneyEUR: 0,
      resources: {},
      updatedAt: Date.now(),
    });
    if (insertErr) {
      // Race-safe retry read
      const { data: retry, error: retryErr } = await supabase
        .from('budgets')
        .select('id')
        .eq('ownerType', ownerType)
        .eq('ownerId', ownerId)
        .maybeSingle();
      if (retryErr) throw retryErr;
      if (!retry?.id) throw insertErr;
    }
  };

  await ensureBudgetExists();

  // We use an RPC 'add_budget_transaction' defined in schema.sql to ensure atomicity
  const payload = {
    p_owner_type: ownerType,
    p_owner_id: ownerId,
    p_type: type,
    p_subtype: subtype,
    p_money_delta: moneyDelta,
    p_resources_delta: resourcesDelta,
    p_created_by: createdByUserId,
    p_metadata: metadata
  };

  let { data, error } = await supabase.rpc('add_budget_transaction', payload);

  if (error) {
    const msg = String((error as any)?.message || '').toLowerCase();
    if (msg.includes('budget') || msg.includes('non trovato')) {
      await ensureBudgetExists();
      ({ data, error } = await supabase.rpc('add_budget_transaction', payload));
    }
    if (error) {
      const retryMsg = String((error as any)?.message || '').toLowerCase();
      const isAmbiguousOverload =
        retryMsg.includes('could not choose the best candidate function') &&
        retryMsg.includes('add_budget_transaction');
      if (isAmbiguousOverload) {
        return await addBudgetTransactionFallback();
      }
    }
  }

  if (error) throw error;
  return data;
}

async function buyEnergyDrinksForUser(userId: string, quantityInput: unknown) {
  const quantity = Math.floor(Number(quantityInput) || 0);
  if (quantity <= 0) {
    return { ok: false as const, status: 400, error: "Quantita non valida. Deve essere un intero > 0." };
  }

  const unitCost = GAME_CONFIG.ENERGY_DRINK_COST_GOLD;
  const totalCost = quantity * unitCost;

  try {
    const { data, error } = await supabase.rpc('buy_energy_drinks', {
      p_user_id: userId,
      p_quantity: quantity,
    });

    if (error) {
      const message = String(error.message || "Errore durante l'acquisto dei drink.");

      // Fallback for environments where the migration has not been applied yet.
      // Keep business rule server-side: totalCost = quantity * 30 gold.
      if (/buy_energy_drinks|function .* does not exist/i.test(message)) {
        const { data: deductResult, error: deductError } = await supabase.rpc('safe_deduct_currency', {
          p_user_id: userId,
          p_money_cost: 0,
          p_gold_cost: totalCost,
          p_energy_cost: 0,
        });
        if (deductError) {
          return { ok: false as const, status: 500, error: String(deductError.message || "Errore durante la deduzione gold.") };
        }
        const deductData = typeof deductResult === 'string' ? JSON.parse(deductResult) : deductResult;
        if (deductData?.error) {
          return { ok: false as const, status: 400, error: String(deductData.error) };
        }

        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .select('gold, energyDrinks')
          .eq('id', userId)
          .single();
        if (updateError || !updatedUser) {
          return { ok: false as const, status: 500, error: "Impossibile leggere lo stato utente dopo la deduzione gold." };
        }

        const drinksBefore = Math.max(0, Number(updatedUser.energyDrinks) || 0);
        const { data: drinkRows, error: drinksError } = await supabase
          .from('users')
          .update({ energyDrinks: drinksBefore + quantity })
          .eq('id', userId)
          .eq('energyDrinks', updatedUser.energyDrinks)
          .select('gold, energyDrinks')
          .single();
        if (drinksError || !drinkRows) {
          return { ok: false as const, status: 500, error: "Acquisto parziale: gold scalato ma drink non aggiornati. Contatta un admin." };
        }

        return {
          ok: true as const,
          payload: {
            success: true,
            playerId: userId,
            quantity,
            unitCost,
            totalCost,
            goldAfter: Number(drinkRows.gold || 0),
            energyDrinksBefore: drinksBefore,
            energyDrinksAfter: Number(drinkRows.energyDrinks || 0)
          }
        };
      }

      const status = /insufficiente|quantit|non trovato/i.test(message) ? 400 : 500;
      return { ok: false as const, status, error: message };
    }

    const payload = (typeof data === 'string' ? JSON.parse(data) : data) || {};
    return { ok: true as const, payload };
  } catch (err: any) {
    return { ok: false as const, status: 500, error: String(err?.message || "Errore durante l'acquisto dei drink.") };
  }
}

const createAutomationError = (statusCode: number, message: string) => {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const AUTOMATION_STANDARD_INTERVAL_MS = 10 * 60 * 1000;
const AUTOMATION_HOURLY_INTERVAL_MS = 60 * 60 * 1000;
const AUTOMATION_EXPIRE_MS = 24 * 60 * 60 * 1000;

const WAR_WEAPON_CONFIG: Record<string, { energy: number; cash: number; damage: number }> = {
  tank: { energy: 30, cash: 0, damage: TROOP_BASE_DAMAGE.tank },
  aircraft: { energy: 50, cash: 0, damage: TROOP_BASE_DAMAGE.aircraft },
  battleship: { energy: 40, cash: 0, damage: TROOP_BASE_DAMAGE.battleship },
};

const LEGACY_WAR_WEAPON_ALIASES: Record<string, string> = {
  infantry: 'tank',
  airstrike: 'aircraft',
};

const normalizeWarWeaponId = (weaponId: string): string => {
  const normalized = (weaponId || '').trim().toLowerCase();
  return LEGACY_WAR_WEAPON_ALIASES[normalized] || normalized;
};

const getAllowedWeaponsForWar = (warType: string, navalPhase: number): string[] => {
  if (warType === 'naval' && navalPhase === 1) return ['battleship'];
  return ['tank', 'aircraft'];
};

const isAutomationExpired = (activatedAt?: string | null, expiresAt?: string | null, now = Date.now()) => {
  if (expiresAt) return new Date(expiresAt).getTime() <= now;
  if (!activatedAt) return false;
  return (now - new Date(activatedAt).getTime()) >= AUTOMATION_EXPIRE_MS;
};

const shouldRecurringAutomationFire = (
  mode: 'standard' | 'hourly' | 'maximum',
  lastFiredAt: string | null,
  activatedAt: string,
  now = Date.now()
) => {
  const interval = mode === 'hourly' ? AUTOMATION_HOURLY_INTERVAL_MS : AUTOMATION_STANDARD_INTERVAL_MS;
  if (isAutomationExpired(activatedAt, null, now)) return false;
  if (!lastFiredAt) return true;
  return (now - new Date(lastFiredAt).getTime()) >= interval;
};

const normalizeWarAutoType = (value: any): 'hourly' | 'maximum' => {
  return value === 'hourly' ? 'hourly' : 'maximum';
};

const isAutoAttackCompatibleWithAutoWork = (autoType: any): boolean => autoType === 'hourly';

const autoWorkIncompatibleMessage = "Auto-Work è compatibile solo con il Danno Orario, non con l'Auto-War standard.";

let missingAutomationTablesWarned = {
  work: false,
  training: false,
} as { work: boolean; training: boolean };

let automationTickRunning = false;

const parseAutomationTimestamp = (value: string | number | null | undefined, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) return numericValue;
    const parsed = new Date(value).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const shouldTreatAutoWorkAsNeverFired = (lastFiredAt: string | null, activatedAt: string | null): boolean => {
  if (!lastFiredAt || !activatedAt) return false;
  const lastFiredMs = new Date(lastFiredAt).getTime();
  const activatedMs = new Date(activatedAt).getTime();
  if (!Number.isFinite(lastFiredMs) || !Number.isFinite(activatedMs)) return false;
  return Math.abs(lastFiredMs - activatedMs) <= 1000;
};

async function processAutomationTick() {
  if (automationTickRunning) return;
  automationTickRunning = true;
  try {
    // 1. Process auto-work
    const { data: activeAutoWork, error: autoWorkErr } = await supabase
      .from('work_auto_actions')
      .select('id, userId, factoryId, activatedAt, expiresAt, lastFiredAt, isActive')
      .eq('isActive', true);

    if (autoWorkErr) {
      if (autoWorkErr.code === 'PGRST205') {
        if (!missingAutomationTablesWarned.work) {
          missingAutomationTablesWarned.work = true;
          console.error('[AUTOMATION] work_auto_actions missing. Apply supabase/migration_automation_modes.sql to your DB.');
        }
      } else {
        console.error('[AUTOMATION] work_auto_actions read error:', autoWorkErr);
      }
    } else if (activeAutoWork && activeAutoWork.length > 0) {
      for (const aw of activeAutoWork) {
        if (isAutomationExpired(aw.activatedAt, aw.expiresAt)) {
          await supabase.from('work_auto_actions').update({ isActive: false }).eq('id', aw.id);
          continue;
        }

        const mode: 'standard' = 'standard';
        const effectiveLastFiredAt = shouldTreatAutoWorkAsNeverFired(aw.lastFiredAt, aw.activatedAt)
          ? null
          : aw.lastFiredAt;
        if (!shouldRecurringAutomationFire(mode, effectiveLastFiredAt, aw.activatedAt)) continue;

        // Apply server-side energy regeneration before attempting work
        try {
          const { data: userForRegen } = await supabase.from('users')
            .select('energy, lastEnergyUpdate')
            .eq('id', aw.userId)
            .single();
          if (userForRegen && (userForRegen.energy || 0) < GAME_CONFIG.ENERGY_MAX) {
            const nowMs = Date.now();
            const lastUpdate = parseAutomationTimestamp(userForRegen.lastEnergyUpdate, nowMs);
            const elapsedHours = (nowMs - lastUpdate) / (60 * 60 * 1000);
            const regenAmount = Math.floor(elapsedHours * GAME_CONFIG.ENERGY_REGEN_RATE);
            if (regenAmount > 0) {
              const newEnergy = Math.min(GAME_CONFIG.ENERGY_MAX, (userForRegen.energy || 0) + regenAmount);
              await supabase.from('users')
                .update({ energy: newEnergy, lastEnergyUpdate: nowMs })
                .eq('id', aw.userId);
            }
          }
        } catch { /* non-critical */ }

        try {
          const { data: autoWorkUser, error: autoWorkUserError } = await supabase
            .from('users')
            .select('*')
            .eq('id', aw.userId)
            .single();
          if (autoWorkUserError || !autoWorkUser) {
            await supabase.from('work_auto_actions').update({ isActive: false }).eq('id', aw.id);
            continue;
          }

          (autoWorkUser as any).perks = await getUserPerks(aw.userId);
          await executeExtractionWork(autoWorkUser, aw.factoryId, {
            allowAutoDrink: true,
            energyCostOverride: GAME_CONFIG.ENERGY_MAX,
          });
          await supabase.from('work_auto_actions').update({ lastFiredAt: new Date().toISOString() }).eq('id', aw.id);
        } catch (err: any) {
          const message = (err?.message || '').toLowerCase();

          // Fatal / invalid config → disable automation
          if (
            err?.statusCode === 404 ||
            message.includes('fabbrica non trovata') ||
            message.includes('devi viaggiare') ||
            message.includes('modalita risorse')
          ) {
            await supabase.from('work_auto_actions').update({ isActive: false }).eq('id', aw.id);
            continue;
          }

          // Energy exhausted: check if user has drinks (possibly on cooldown) or truly has nothing left
          if (message.includes('energia insufficiente')) {
            try {
              const { data: drinkCheck } = await supabase.from('users')
                .select('energyDrinks')
                .eq('id', aw.userId)
                .single();
              if ((drinkCheck?.energyDrinks || 0) > 0) {
                // Has drinks but cooldown not yet expired → backoff, will retry next cycle
                await supabase.from('work_auto_actions').update({ lastFiredAt: new Date().toISOString() }).eq('id', aw.id);
              } else {
                // No drinks and no energy → stop correctly
                await supabase.from('work_auto_actions').update({ isActive: false }).eq('id', aw.id);
              }
            } catch {
              await supabase.from('work_auto_actions').update({ isActive: false }).eq('id', aw.id);
            }
            continue;
          }

          // Other non-fatal expected errors (cooldown/budget/storage/permits): backoff
          await supabase.from('work_auto_actions').update({ lastFiredAt: new Date().toISOString() }).eq('id', aw.id);
        }
      }
    }

    // 2. Process hourly training damage
    const { data: activeAutoTraining, error: autoTrainingErr } = await supabase
      .from('training_auto_actions')
      .select('id, userId, activatedAt, expiresAt, lastFiredAt, isActive')
      .eq('isActive', true);

    if (autoTrainingErr) {
      if (autoTrainingErr.code === 'PGRST205') {
        if (!missingAutomationTablesWarned.training) {
          missingAutomationTablesWarned.training = true;
          console.error('[AUTOMATION] training_auto_actions missing. Apply supabase/migration_automation_modes.sql to your DB.');
        }
      } else {
        console.error('[AUTOMATION] training_auto_actions read error:', autoTrainingErr);
      }
    } else if (activeAutoTraining && activeAutoTraining.length > 0) {
      for (const at of activeAutoTraining) {
        if (isAutomationExpired(at.activatedAt, at.expiresAt)) {
          await supabase.from('training_auto_actions').update({ isActive: false }).eq('id', at.id);
          continue;
        }
        if (!shouldRecurringAutomationFire('hourly', at.lastFiredAt, at.activatedAt)) continue;

        try {
          await performTrainingAction(at.userId, { freeHourly: true });
          await supabase.from('training_auto_actions').update({ lastFiredAt: new Date().toISOString() }).eq('id', at.id);
        } catch {
          // Keep active until expiration.
        }
      }
    }

    // 3. Process auto-attacks
    const { data: activeAutoAttacks, error: autoAttacksErr } = await supabase
      .from('war_auto_attacks')
      .select('id, userId, warId, activatedAt, expiresAt, lastFiredAt, isActive, autoType, side, troopType')
      .eq('isActive', true);

    if (autoAttacksErr) {
      console.error('[AUTOMATION] war_auto_attacks read error:', autoAttacksErr);
    } else if (activeAutoAttacks && activeAutoAttacks.length > 0) {
      for (const aa of activeAutoAttacks) {
        if (isAutomationExpired(aa.activatedAt, aa.expiresAt)) {
          await supabase.from('war_auto_attacks').update({ isActive: false }).eq('id', aa.id);
          continue;
        }

        if (!shouldRecurringAutomationFire(aa.autoType, aa.lastFiredAt, aa.activatedAt)) continue;

        // Check war is still active
        const { data: war } = await supabase.from('wars').select('status').eq('id', aa.warId).single();
        if (!war || war.status !== 'active') {
          await supabase.from('war_auto_attacks').update({ isActive: false }).eq('id', aa.id);
          continue;
        }

        try {
          await performWarDeployAction({
            userId: aa.userId,
            warId: aa.warId,
            side: aa.side,
            weaponId: aa.troopType,
            ignoreEnergyCost: aa.autoType === 'hourly',
            allowAutoDrink: aa.autoType !== 'hourly',
          });
          await supabase.from('war_auto_attacks').update({ lastFiredAt: new Date().toISOString() }).eq('id', aa.id);
        } catch (err: any) {
          const message = (err?.message || '').toLowerCase();
          if (err?.statusCode === 404 || message.includes('guerra inesistente') || message.includes('armamento sconosciuto')) {
            await supabase.from('war_auto_attacks').update({ isActive: false }).eq('id', aa.id);
          }
          if (err?.statusCode === 400 && message.includes('corazzate') && message.includes('fase')) {
            await supabase.from('war_auto_attacks').update({ isActive: false }).eq('id', aa.id);
          }
        }
      }
    }
  } catch (error) {
    console.error('[AUTOMATION] processAutomationTick error:', error);
  } finally {
    automationTickRunning = false;
  }
}

async function tryUseEnergyDrinkForUser(userId: string): Promise<boolean> {
  const now = Date.now();
  const { data: freshUser, error: readError } = await supabase
    .from('users')
    .select('energyDrinks, lastEnergyDrink')
    .eq('id', userId)
    .single();

  if (readError || !freshUser) return false;
  if ((freshUser.energyDrinks || 0) <= 0) return false;
  if (!hasEnergyDrinkCooldownExpired(freshUser.lastEnergyDrink, now, GAME_CONFIG.ENERGY_DRINK_COOLDOWN)) return false;

  let updateQuery = supabase
    .from('users')
    .update({
      energyDrinks: freshUser.energyDrinks - 1,
      energy: GAME_CONFIG.ENERGY_MAX,
      lastEnergyDrink: now
    })
    .eq('id', userId)
    .eq('energyDrinks', freshUser.energyDrinks);

  if (freshUser.lastEnergyDrink == null) {
    updateQuery = updateQuery.is('lastEnergyDrink', null);
  } else {
    updateQuery = updateQuery.eq('lastEnergyDrink', freshUser.lastEnergyDrink);
  }

  const { data: updatedUsers, error: updateError } = await updateQuery.select('id');
  return !updateError && !!updatedUsers && updatedUsers.length > 0;
}

async function performTrainingAction(userId: string, options?: { freeHourly?: boolean }) {
  const freeHourly = options?.freeHourly === true;
  const TRAIN_ENERGY_COST = 10;

  if (!freeHourly) {
    try {
      const { data: deductResult, error: deductError } = await supabase.rpc('safe_deduct_currency', {
        p_user_id: userId,
        p_money_cost: 0,
        p_gold_cost: 0,
        p_energy_cost: TRAIN_ENERGY_COST,
      });
      if (deductError) {
        const msg = (deductError.message || '').toLowerCase();
        if (msg.includes('energia') || msg.includes('energy') || msg.includes('insufficient')) {
          throw createAutomationError(400, "Energia insufficiente (serve 10)");
        }
        throw deductError;
      }
      const deductData = typeof deductResult === 'string' ? JSON.parse(deductResult) : deductResult;
      if (deductData?.error) {
        throw createAutomationError(400, "Energia insufficiente (serve 10)");
      }
    } catch (rpcErr: any) {
      const { data: freshUser } = await supabase.from('users').select('energy').eq('id', userId).single();
      if (!freshUser || (freshUser.energy || 0) < TRAIN_ENERGY_COST) {
        throw createAutomationError(400, "Energia insufficiente (serve 10)");
      }
      const { data: updated, error: updErr } = await supabase.from('users')
        .update({ energy: (freshUser.energy || 0) - TRAIN_ENERGY_COST })
        .eq('id', userId)
        .gte('energy', TRAIN_ENERGY_COST)
        .select('id')
        .maybeSingle();
      if (updErr || !updated) {
        throw createAutomationError(400, "Energia insufficiente (serve 10)");
      }
    }
  }

  const { data: currentUser, error: currentError } = await supabase
    .from('users')
    .select('energy, militaryExp')
    .eq('id', userId)
    .single();
  if (currentError || !currentUser) throw (currentError || createAutomationError(404, 'Utente non trovato.'));

  const militaryExp = (currentUser.militaryExp || 0) + 5;
  const { error: expError } = await supabase.from('users').update({
    militaryExp,
    lastEnergyUpdate: Date.now(),
  }).eq('id', userId);
  if (expError) throw expError;

  await addXP(userId, 5);
  return { success: true, militaryExp, energy: currentUser.energy };
}

async function performWorkAction(userId: string, factoryId: string, options?: { allowAutoDrink?: boolean }) {
  return await performWorkActionV3(userId, factoryId, options);
}

async function performWorkActionV2(params: {
  user: any;
  factory: any;
  region: any;
  perks: Record<string, number>;
  energyCost: number;
}) {
  const { user, factory, region, perks, energyCost } = params;

  const { data: owner } = await supabase.from('users').select('id').eq('id', factory.ownerUserId).single();
  if (!owner) throw createAutomationError(404, "Proprietario inesistente.");

  const level = factory.level || 1;
  const payMode = factory.payMode || 'resource';
  const typeDef = FACTORY_CONFIG.TYPES[factory.type] || null;
  const isGoldMine = typeDef?.category === 'gold';

  const taxRate = region?.marketTaxRate ?? region?.industryTaxPercent ?? FACTORY_CONFIG.DEFAULT_INDUSTRY_TAX_RATE;
  const autonomySharePercent = region?.regionalProfitSharePercent ?? 0;
  const stateId = region?.nation_id || factory.regionId;

  const forzaBoost = (perks['FORZA'] || 0) * 0.03;
  const maxWorkExperience = getMaxWorkXpPerResource(perks['ISTRUZIONE'] || 0);
  const workExp = await getPlayerWorkExperience(user.id, factory.type, maxWorkExperience);
  const workExpMult = getWorkExperienceMultiplier(workExp);

  const parseRpcResultOrThrow = (result: any) => {
    const parsed = typeof result === 'string' ? JSON.parse(result) : result;
    if (parsed?.error) throw createAutomationError(400, parsed.error);
    return parsed;
  };

  const addTaxToBudgets = async (
    subtype: string,
    moneyDelta: number,
    resourcesDelta: Record<string, number>,
    metadata: any
  ) => {
    const hasResources = resourcesDelta && Object.values(resourcesDelta).some(v => (v || 0) > 0);
    if ((moneyDelta || 0) <= 0 && !hasResources) return;

    // Autonomy split: if the region is autonomous, split tax between State (nation_id) and Autonomy (regionId).
    const shouldSplit = !!region?.isAutonomous && autonomySharePercent > 0 && stateId !== factory.regionId;
    const autonomyFraction = shouldSplit ? (autonomySharePercent / 100) : 0;

    const autonomyMoney = Math.floor((moneyDelta || 0) * autonomyFraction);
    const stateMoney = (moneyDelta || 0) - autonomyMoney;

    const autonomyResources: Record<string, number> = {};
    const stateResources: Record<string, number> = {};
    for (const [key, value] of Object.entries(resourcesDelta || {})) {
      const units = Math.max(0, Math.floor(Number(value) || 0));
      if (units <= 0) continue;
      const autoUnits = Math.floor(units * autonomyFraction);
      const stateUnits = units - autoUnits;
      if (stateUnits > 0) stateResources[key] = stateUnits;
      if (autoUnits > 0) autonomyResources[key] = autoUnits;
    }

    const hasStateResources = Object.keys(stateResources).length > 0;
    const hasAutonomyResources = Object.keys(autonomyResources).length > 0;

    if (stateMoney > 0 || hasStateResources) {
      await supabase.rpc('add_budget_transaction', {
        p_owner_type: 'REGION',
        p_owner_id: stateId,
        p_type: 'INCOME',
        p_subtype: subtype,
        p_money_delta: stateMoney,
        p_resources_delta: stateResources,
        p_created_by: user.id,
        p_metadata: { ...metadata, scope: 'STATE', autonomySharePercent },
      });
    }

    if (autonomyMoney > 0 || hasAutonomyResources) {
      await supabase.rpc('add_budget_transaction', {
        p_owner_type: 'REGION',
        p_owner_id: factory.regionId,
        p_type: 'INCOME',
        p_subtype: subtype,
        p_money_delta: autonomyMoney,
        p_resources_delta: autonomyResources,
        p_created_by: user.id,
        p_metadata: { ...metadata, scope: 'AUTONOMY', autonomySharePercent },
      });
    }
  };

  let netMoney = 0;
  let netGold = 0;
  let taxesMoney = 0;
  let grossValue = 0;
  let playerResourceOutput = 0;
  let stateResourceUnits = 0;
  let ownerCutUnits = 0;

  if (isGoldMine) {
    const yieldMult = factoryYieldMultiplier(level);
    const baseMoney = Math.floor(FACTORY_CONFIG.GOLD_MINE_MONEY_PER_WORK * yieldMult * (1 + forzaBoost) * workExpMult);
    const baseGold = Math.round(FACTORY_CONFIG.GOLD_MINE_GOLD_PER_WORK * yieldMult * (1 + forzaBoost) * workExpMult * 100) / 100;

    const moneyTax = Math.floor(baseMoney * (taxRate / 100));
    const goldTax = Math.round(baseGold * (taxRate / 100) * 100) / 100;

    netMoney = baseMoney - moneyTax;
    netGold = Math.round((baseGold - goldTax) * 100) / 100;
    taxesMoney = moneyTax;
    grossValue = baseMoney;

    const ownerCutMoney = Math.floor(baseMoney * FACTORY_CONFIG.OWNER_PROFIT_RATE);

    const { data: deductResult, error: deductError } = await supabase.rpc('safe_deduct_currency', {
      p_user_id: user.id,
      p_money_cost: -netMoney,
      p_gold_cost: -netGold,
      p_energy_cost: energyCost,
    });
    if (deductError) throw deductError;
    parseRpcResultOrThrow(deductResult);

    if (ownerCutMoney > 0 && owner.id !== user.id) {
      const { data: ownerResult, error: ownerErr } = await supabase.rpc('safe_deduct_currency', {
        p_user_id: owner.id,
        p_money_cost: -ownerCutMoney,
        p_gold_cost: 0,
        p_energy_cost: 0,
      });
      if (ownerErr) throw ownerErr;
      parseRpcResultOrThrow(ownerResult);
    }

    await addTaxToBudgets('INDUSTRY_TAX', taxesMoney, {}, { factoryId: factory.id, factoryType: 'gold', taxRate, grossMoney: baseMoney });
  } else if (payMode === 'salary') {
    const grossEarnings = Math.floor((factory.payoutMoney ?? factory.wage ?? 50) * (1 + forzaBoost) * workExpMult);
    const taxes = Math.floor(grossEarnings * (taxRate / 100));
    netMoney = grossEarnings - taxes;
    taxesMoney = taxes;
    grossValue = grossEarnings;

    const { data: freshFactory } = await supabase.from('factories').select('budget, currentStorage').eq('id', factory.id).single();
    if (!freshFactory) throw createAutomationError(404, "Fabbrica non trovata.");
    if ((freshFactory.budget || 0) < grossEarnings) throw createAutomationError(400, "L'azienda non ha abbastanza fondi per pagarti il salario.");

    let bonusMult = 1.0;
    if (factory.type === 'oil') bonusMult = region?.oilBonus || 1.0;
    else if (factory.type === 'minerals') bonusMult = region?.mineralsBonus || 1.0;
    else if (factory.type === 'uranium') bonusMult = region?.uraniumBonus || 1.0;
    else if (factory.type === 'diamonds') bonusMult = region?.diamondsBonus || 1.0;

    const outputQty = Math.max(1, Math.floor(level * FACTORY_CONFIG.BASE_RESOURCE_OUTPUT * bonusMult * (1 + forzaBoost) * workExpMult));
    const storageCap = factoryStorageLimit(factory.type, level);
    if (storageCap > 0 && (freshFactory.currentStorage || 0) + outputQty > storageCap) {
      throw createAutomationError(400, "Il magazzino della fabbrica è pieno.");
    }

    const { data: deductResult, error: deductError } = await supabase.rpc('safe_deduct_currency', {
      p_user_id: user.id,
      p_money_cost: -netMoney,
      p_gold_cost: 0,
      p_energy_cost: energyCost,
    });
    if (deductError) throw deductError;
    parseRpcResultOrThrow(deductResult);

    const { error: factoryUpdateErr } = await supabase.from('factories').update({
      budget: (freshFactory.budget || 0) - grossEarnings,
      currentStorage: (freshFactory.currentStorage || 0) + outputQty,
    }).eq('id', factory.id);
    if (factoryUpdateErr) throw factoryUpdateErr;

    await addTaxToBudgets('WORK_TAX', taxesMoney, {}, { factoryId: factory.id, factoryType: factory.type, taxRate, grossMoney: grossEarnings, payMode: 'salary' });
  } else {
    let bonusMult = 1.0;
    if (factory.type === 'oil') bonusMult = region?.oilBonus || 1.0;
    else if (factory.type === 'minerals') bonusMult = region?.mineralsBonus || 1.0;
    else if (factory.type === 'uranium') bonusMult = region?.uraniumBonus || 1.0;
    else if (factory.type === 'diamonds') bonusMult = region?.diamondsBonus || 1.0;

    const resourceOutput = Math.max(1, Math.floor(level * FACTORY_CONFIG.BASE_RESOURCE_OUTPUT * bonusMult * (1 + forzaBoost) * workExpMult));
    stateResourceUnits = Math.floor(resourceOutput * (taxRate / 100));
    ownerCutUnits = Math.floor(resourceOutput * FACTORY_CONFIG.OWNER_PROFIT_RATE);
    playerResourceOutput = Math.max(0, resourceOutput - stateResourceUnits - ownerCutUnits);

    const storageCap = factoryStorageLimit(factory.type, level);
    if (storageCap > 0 && (factory.currentStorage || 0) + ownerCutUnits > storageCap) {
      throw createAutomationError(400, "Il magazzino della fabbrica è pieno.");
    }

    const { data: deductResult, error: deductError } = await supabase.rpc('safe_deduct_currency', {
      p_user_id: user.id,
      p_money_cost: 0,
      p_gold_cost: 0,
      p_energy_cost: energyCost,
    });
    if (deductError) throw deductError;
    parseRpcResultOrThrow(deductResult);

    if (playerResourceOutput > 0) {
      const { data: playerInv } = await supabase.from('user_inventory')
        .select('quantity').eq('userId', user.id).eq('itemId', factory.type).maybeSingle();
      if (playerInv) {
        await supabase.from('user_inventory').update({ quantity: playerInv.quantity + playerResourceOutput })
          .eq('userId', user.id).eq('itemId', factory.type);
      } else {
        await supabase.from('user_inventory').insert({ userId: user.id, itemId: factory.type, quantity: playerResourceOutput });
      }
    }

    if (ownerCutUnits > 0) {
      await supabase.rpc('increment_factory_storage', { p_factory_id: factory.id, p_amount: ownerCutUnits });
    }

    const resourceKey = (typeDef?.resource || factory.type) as string;
    const resourceValue = FACTORY_CONFIG.RESOURCE_VALUES[resourceKey] || 1;
    taxesMoney = Math.floor(stateResourceUnits * resourceValue);
    grossValue = Math.floor(resourceOutput * resourceValue);

    await addTaxToBudgets('RESOURCE_TAX', 0, { [factory.type]: stateResourceUnits }, {
      factoryId: factory.id,
      factoryType: factory.type,
      taxRate,
      resourceUnits: stateResourceUnits,
      resourceValue,
      grossUnits: resourceOutput,
    });
  }

  await supabase.from('user_factory_cooldowns').upsert({
    userId: user.id,
    factoryId: factory.id,
    lastUsed: new Date().toISOString(),
  }, { onConflict: 'userId,factoryId' });

  try {
    await supabase.from('factory_worker_logs').insert({
      factoryId: factory.id,
      workerId: user.id,
      earningsMoney: netMoney,
      earningsGold: netGold,
      resourceType: (!isGoldMine && playerResourceOutput > 0) ? factory.type : null,
      resourceAmount: (!isGoldMine && playerResourceOutput > 0) ? playerResourceOutput : 0,
      ownerCut: isGoldMine ? Math.floor(grossValue * FACTORY_CONFIG.OWNER_PROFIT_RATE) : ownerCutUnits,
    });
  } catch { /* non-critical */ }

  const xpGain = GAME_CONFIG.XP_PER_WORK + (perks['ISTRUZIONE'] || 0) * 2;
  await addXP(user.id, xpGain);
  try {
    const requestedWorkExpGain = EXTRACTION_CONFIG.WORK_EXPERIENCE_GAIN;
    const cappedRequestedGain = workExp >= maxWorkExperience ? 0 : requestedWorkExpGain;
    await incrementPlayerWorkExperience(user.id, factory.type, cappedRequestedGain, perks['ISTRUZIONE'] || 0);
  } catch { /* non-critical */ }

  if (isGoldMine) {
    return { success: true, payMode: 'gold', earnings: netMoney, goldEarnings: netGold, taxes: taxesMoney, energyCost, xpGain };
  }
  if (payMode === 'salary') {
    return { success: true, payMode: 'salary', earnings: netMoney, taxes: taxesMoney, energyCost, xpGain };
  }
  return { success: true, payMode: 'resource', earnings: 0, output: playerResourceOutput, ownerShare: ownerCutUnits, stateShare: stateResourceUnits, taxes: taxesMoney, energyCost, xpGain };
}

async function performWorkActionV3(
  userId: string,
  factoryId: string,
  options?: { allowAutoDrink?: boolean }
) {
  let { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
  if (!user) throw createAutomationError(404, "Utente non trovato.");

  const { data: factory } = await supabase.from('factories').select('*').eq('id', factoryId).single();
  if (!factory) throw createAutomationError(404, "Fabbrica non trovata.");
  if (factory.isActive === false) throw createAutomationError(400, "Fabbrica non attiva.");

  const factoryMinLevel = factory.minLevel ?? 1;
  if ((user.level || 1) < factoryMinLevel) throw createAutomationError(400, `Richiede livello ${factoryMinLevel}.`);

  if ((user.regionId || 'IT') !== factory.regionId) throw createAutomationError(400, "Devi viaggiare in questa regione per lavorare qui.");

  const { data: region } = await supabase.from('regions').select('*').eq('id', factory.regionId).single();
  const restrictionsActive = region?.workRestrictions === 1;
  const isResident = user.residenceId === factory.regionId;

  let hasWorkPermit = user.workPermitId === factory.regionId;
  if (!hasWorkPermit) {
    try {
      const { data: permitRow } = await supabase.from('work_permits')
        .select('id')
        .eq('userId', user.id)
        .eq('regionId', factory.regionId)
        .maybeSingle();
      hasWorkPermit = !!permitRow;
    } catch { /* optional table */ }
  }

  if (restrictionsActive && !isResident && !hasWorkPermit && user.id !== factory.ownerUserId) {
    throw createAutomationError(403, "Questa regione richiede un Permesso di Lavoro.");
  }

  const cooldownMs = Math.max(1, Number(factory.cooldownSec || 600)) * 1000;
  const { data: lastWork } = await supabase.from('user_factory_cooldowns')
    .select('lastUsed')
    .eq('userId', user.id)
    .eq('factoryId', factoryId)
    .maybeSingle();
  if (lastWork && Date.now() - new Date(lastWork.lastUsed).getTime() < cooldownMs) {
    throw createAutomationError(400, "Fabbrica in cooldown.");
  }

  const perks = await getUserPerks(user.id);
  const energyCost = GAME_CONFIG.ENERGY_MAX; // 300

  if ((user.energy || 0) < energyCost && options?.allowAutoDrink) {
    const drank = await tryUseEnergyDrinkForUser(user.id);
    if (drank) {
      const { data: refreshedUser } = await supabase.from('users').select('*').eq('id', user.id).single();
      if (refreshedUser) user = refreshedUser;
    }
  }
  if ((user.energy || 0) < energyCost) throw createAutomationError(400, "Energia insufficiente (richiesti 300).");

  const typeDef = FACTORY_CONFIG.TYPES[factory.type] || null;
  if (!typeDef) throw createAutomationError(400, "Tipo fabbrica non valido.");
  const isGoldMine = typeDef.category === 'gold';
  const payMode = factory.payMode || 'resource';

  const taxRate = region?.marketTaxRate ?? region?.industryTaxPercent ?? FACTORY_CONFIG.DEFAULT_INDUSTRY_TAX_RATE;
  const autonomySharePercent = Math.max(0, Math.min(100, region?.regionalProfitSharePercent ?? 0));
  const nationId = region?.nation_id || null;

  const forceBoost = (perks['FORZA'] || 0) * 0.03;

  const expResourceType = typeDef.resource || factory.type;
  const maxWorkExperience = getMaxWorkXpPerResource(perks['ISTRUZIONE'] || 0);
  const workExp = await getPlayerWorkExperience(user.id, expResourceType, maxWorkExperience);
  const workExpMult = getWorkExperienceMultiplier(workExp);

  const addTaxSplit = async (
    subtype: string,
    moneyDelta: number,
    resourcesDelta: Record<string, number>,
    metadata: any
  ) => {
    const hasResources = resourcesDelta && Object.values(resourcesDelta).some(v => (Number(v) || 0) > 0);
    if ((moneyDelta || 0) <= 0 && !hasResources) return;

    const shouldSplit = !!region?.isAutonomous && !!nationId && autonomySharePercent > 0;
    const autonomyFraction = shouldSplit ? (autonomySharePercent / 100) : 0;

    const autonomyMoney = Math.floor((moneyDelta || 0) * autonomyFraction);
    const stateMoney = (moneyDelta || 0) - autonomyMoney;

    const autonomyResources: Record<string, number> = {};
    const stateResources: Record<string, number> = {};
    for (const [key, raw] of Object.entries(resourcesDelta || {})) {
      const units = Math.max(0, Math.floor(Number(raw) || 0));
      if (units <= 0) continue;
      const autoUnits = Math.floor(units * autonomyFraction);
      const stUnits = units - autoUnits;
      if (stUnits > 0) stateResources[key] = stUnits;
      if (autoUnits > 0) autonomyResources[key] = autoUnits;
    }

    if (!shouldSplit) {
      const ownerType = nationId ? 'STATE' : 'REGION';
      const ownerId = nationId || factory.regionId;
      await addBudgetTransaction(ownerType, ownerId, 'INCOME', subtype, moneyDelta, resourcesDelta, user.id, metadata);
      return;
    }

    if (stateMoney > 0 || Object.keys(stateResources).length > 0) {
      await addBudgetTransaction('STATE', nationId!, 'INCOME', subtype, stateMoney, stateResources, user.id, {
        ...metadata,
        scope: 'STATE',
        autonomySharePercent,
      });
    }
    if (autonomyMoney > 0 || Object.keys(autonomyResources).length > 0) {
      await addBudgetTransaction('AUTONOMY', factory.regionId, 'INCOME', subtype, autonomyMoney, autonomyResources, user.id, {
        ...metadata,
        scope: 'AUTONOMY',
        autonomySharePercent,
      });
    }
  };

  const parseRpcResultOrThrow = (result: any) => {
    const parsed = typeof result === 'string' ? JSON.parse(result) : result;
    if (parsed?.error) throw createAutomationError(400, parsed.error);
    return parsed;
  };

  const safeDeduct = async (moneyDelta: number, goldDelta: number, energyDelta: number) => {
    const { data, error } = await supabase.rpc('safe_deduct_currency', {
      p_user_id: user.id,
      // RPC semantics: positive = cost (deduct), negative = grant (add)
      p_money_cost: moneyDelta,
      p_gold_cost: goldDelta,
      p_energy_cost: energyDelta,
    });
    if (error) throw error;
    parseRpcResultOrThrow(data);
  };

  const level = factory.level || 1;
  const yieldMult = factoryYieldMultiplier(level);
  const goldRewardByHealth = getGoldDigRewardByHealth(region?.healthIndex);

  let earningsMoney = 0;
  let earningsGold = 0;
  let taxesMoney = 0;
  let grossValueMoney = 0;
  let playerResourceOutput = 0;
  let stateResourceUnits = 0;
  let ownerCutUnits = 0;
  let ownerCutMoney = 0;

  const ownerId = factory.ownerUserId;

  if (isGoldMine) {
    const baseMoney = Math.floor(FACTORY_CONFIG.GOLD_MINE_MONEY_PER_WORK * yieldMult * (1 + forceBoost) * workExpMult);
    const goldAward = goldRewardByHealth.goldReward;

    taxesMoney = Math.floor(baseMoney * (taxRate / 100));
    const netMoney = baseMoney - taxesMoney;

    earningsMoney = netMoney;
    earningsGold = goldAward;
    grossValueMoney = baseMoney;

    await safeDeduct(-earningsMoney, -earningsGold, energyCost);

    // Owner profit (money)
    ownerCutMoney = Math.floor(baseMoney * FACTORY_CONFIG.OWNER_PROFIT_RATE);
    if (ownerCutMoney > 0 && ownerId && ownerId !== user.id) {
      const { data, error } = await supabase.rpc('safe_deduct_currency', {
        p_user_id: ownerId,
        p_money_cost: -ownerCutMoney,
        p_gold_cost: 0,
        p_energy_cost: 0,
      });
      if (error) throw error;
      parseRpcResultOrThrow(data);
    }

    await addTaxSplit('INDUSTRY_TAX', taxesMoney, {}, { factoryId: factory.id, factoryType: factory.type, taxRate });
  } else if (payMode === 'salary') {
    const grossEarnings = Math.floor((factory.payoutMoney ?? factory.wage ?? 50) * (1 + forceBoost) * workExpMult);
    taxesMoney = Math.floor(grossEarnings * (taxRate / 100));
    earningsMoney = grossEarnings - taxesMoney;
    grossValueMoney = grossEarnings;

    const { data: updated, error: budgetErr } = await supabase
      .from('factories')
      .update({ budget: (factory.budget || 0) - grossEarnings })
      .eq('id', factory.id)
      .gte('budget', grossEarnings)
      .select('id')
      .maybeSingle();
    if (budgetErr) throw budgetErr;
    if (!updated) throw createAutomationError(400, "L'azienda non ha abbastanza fondi per pagarti il salario.");

    await safeDeduct(-earningsMoney, 0, energyCost);
    await addTaxSplit('WORK_TAX', taxesMoney, {}, { factoryId: factory.id, factoryType: factory.type, taxRate, payMode: 'salary' });
  } else {
    let bonusMult = 1.0;
    if (factory.type === 'oil') bonusMult = region?.oilBonus || 1.0;
    else if (factory.type === 'minerals') bonusMult = region?.mineralsBonus || 1.0;
    else if (factory.type === 'uranium') bonusMult = region?.uraniumBonus || 1.0;
    else if (factory.type === 'diamonds') bonusMult = region?.diamondsBonus || 1.0;

    const resourceOutput = Math.max(1, Math.floor(level * FACTORY_CONFIG.BASE_RESOURCE_OUTPUT * bonusMult * (1 + forceBoost) * workExpMult));
    stateResourceUnits = Math.floor(resourceOutput * (taxRate / 100));
    ownerCutUnits = Math.floor(resourceOutput * FACTORY_CONFIG.OWNER_PROFIT_RATE);
    playerResourceOutput = Math.max(0, resourceOutput - stateResourceUnits - ownerCutUnits);

    const storageCap = factoryStorageLimit(factory.type, level);
    if (storageCap > 0 && (factory.currentStorage || 0) + ownerCutUnits > storageCap) {
      throw createAutomationError(400, "Il magazzino della fabbrica è pieno.");
    }

    await safeDeduct(0, 0, energyCost);

    if (playerResourceOutput > 0) {
      const { data: inv } = await supabase.from('user_inventory')
        .select('quantity')
        .eq('userId', user.id)
        .eq('itemId', factory.type)
        .maybeSingle();
      if (inv) {
        await supabase.from('user_inventory')
          .update({ quantity: inv.quantity + playerResourceOutput })
          .eq('userId', user.id)
          .eq('itemId', factory.type);
      } else {
        await supabase.from('user_inventory')
          .insert({ userId: user.id, itemId: factory.type, quantity: playerResourceOutput });
      }
    }

    if (ownerCutUnits > 0) {
      await supabase.rpc('increment_factory_storage', { p_factory_id: factory.id, p_amount: ownerCutUnits });
    }

    const resourceKey = (typeDef.resource || factory.type) as string;
    const resourceValue = FACTORY_CONFIG.RESOURCE_VALUES[resourceKey] || 1;
    grossValueMoney = Math.floor(resourceOutput * resourceValue);

    // Resource taxes collected as resources only (avoid double taxation).
    await addTaxSplit('RESOURCE_TAX', 0, { [factory.type]: stateResourceUnits }, {
      factoryId: factory.id,
      factoryType: factory.type,
      taxRate,
      resourceUnits: stateResourceUnits,
    });
  }

  await supabase.from('user_factory_cooldowns').upsert({
    userId: user.id,
    factoryId: factory.id,
    lastUsed: new Date().toISOString(),
  }, { onConflict: 'userId,factoryId' });

  try {
    const productionCount = isGoldMine ? grossValueMoney : (playerResourceOutput + stateResourceUnits + ownerCutUnits);
    const taxesPaidMoney = isGoldMine || payMode === 'salary' ? taxesMoney : 0;
    const storageDelta = (!isGoldMine && ownerCutUnits > 0) ? ownerCutUnits : 0;

    await supabase.rpc('increment_factory_counters', {
      p_factory_id: factory.id,
      p_worker_count: 1,
      p_production: productionCount,
      p_owner_profit: isGoldMine ? ownerCutMoney : ownerCutUnits,
      p_taxes_paid: taxesPaidMoney,
      p_storage_delta: storageDelta,
    });

    await supabase.rpc('upsert_factory_economy_log', {
      p_factory_id: factory.id,
      p_gross_income: grossValueMoney,
      p_taxes_paid: taxesPaidMoney,
      p_owner_profit: isGoldMine ? ownerCutMoney : ownerCutUnits,
      p_production: productionCount,
    });
  } catch { /* non-critical */ }

  try {
    await supabase.from('factory_worker_logs').insert({
      factoryId: factory.id,
      workerId: user.id,
      earningsMoney,
      earningsGold,
      resourceType: (!isGoldMine && payMode !== 'salary' && playerResourceOutput > 0) ? factory.type : null,
      resourceAmount: (!isGoldMine && payMode !== 'salary' && playerResourceOutput > 0) ? playerResourceOutput : 0,
      ownerCut: isGoldMine ? ownerCutMoney : ownerCutUnits,
    });
  } catch { /* non-critical */ }

  const educationLevel = Math.max(1, (region?.educationIndex || 1)) as number;
  const educationBonus = educationLevel * AUTONOMY_CONFIG.INDEX_EFFECTS.education.xpBonusPerLevel;
  const xpGain = Math.round((GAME_CONFIG.XP_PER_WORK + (perks['ISTRUZIONE'] || 0) * 2) * (1 + educationBonus));
  await addXP(user.id, xpGain);

  const requestedWorkExpGain = getWorkExperienceGainForEnergyCost(energyCost);
  let appliedWorkExpGain = 0;
  try {
    const cappedRequestedGain = workExp >= maxWorkExperience ? 0 : requestedWorkExpGain;
    const workExpUpdate = await incrementPlayerWorkExperience(user.id, expResourceType, cappedRequestedGain, perks['ISTRUZIONE'] || 0);
    appliedWorkExpGain = workExpUpdate.appliedGain;
  } catch { /* non-critical */ }

  try {
    await updateMissionProgress(user.id, 'WORK', {
      work_times: 1,
      earn_money: earningsMoney,
      earn_gold: earningsGold,
      produce_resources: playerResourceOutput > 0 ? playerResourceOutput : 0,
      start_production: 1,
      spend_energy: energyCost,
    });
    await updateMissionProgress(user.id, 'EARN_XP', { earn_xp: xpGain });
  } catch { /* non-critical */ }

  if (isGoldMine) {
    return {
      success: true,
      payMode: 'gold',
      isGoldMine: true,
      earnings: earningsMoney,
      goldEarnings: earningsGold,
      taxes: taxesMoney,
      energyCost,
      xpGain,
      workExpGain: appliedWorkExpGain,
      workExperience: workExp,
      workExperienceAfter: Math.min(maxWorkExperience, workExp + appliedWorkExpGain),
      maxWorkExperience,
      experienceMultiplier: workExpMult,
      ownerCut: ownerCutMoney,
      goldBaseReward: goldRewardByHealth.baseGoldReward,
      goldHealthMultiplier: Math.round(goldRewardByHealth.healthMultiplier * 1000) / 1000,
      regionHealthIndex: goldRewardByHealth.healthIndex,
    };
  }

  if (payMode === 'salary') {
    return {
      success: true,
      payMode: 'salary',
      isGoldMine: false,
      earnings: earningsMoney,
      taxes: taxesMoney,
      energyCost,
      xpGain,
      workExpGain: appliedWorkExpGain,
      workExperience: workExp,
      workExperienceAfter: Math.min(maxWorkExperience, workExp + appliedWorkExpGain),
      maxWorkExperience,
      experienceMultiplier: workExpMult,
    };
  }

  return {
    success: true,
    payMode: 'resource',
    isGoldMine: false,
    earnings: 0,
    output: playerResourceOutput,
    ownerShare: ownerCutUnits,
    stateShare: stateResourceUnits,
    taxes: 0,
    energyCost,
    xpGain,
    workExpGain: appliedWorkExpGain,
    workExperience: workExp,
    workExperienceAfter: Math.min(maxWorkExperience, workExp + appliedWorkExpGain),
    maxWorkExperience,
    experienceMultiplier: workExpMult,
    resourceOutput: {
      type: factory.type,
      player: playerResourceOutput,
      state: stateResourceUnits,
      ownerCut: ownerCutUnits,
    },
  };
}

async function performWarDeployAction(params: {
  userId: string;
  warId: string;
  side: 'attacker' | 'defender';
  weaponId: string;
  ignoreEnergyCost?: boolean;
  allowAutoDrink?: boolean;
}) {
  let { data: user } = await supabase.from('users').select('*').eq('id', params.userId).single();
  if (!user) throw createAutomationError(404, "Utente non trovato.");

  const { data: war } = await supabase.from('wars').select('*').eq('id', params.warId).single();
  if (!war) throw createAutomationError(404, "Guerra inesistente.");
  if (war.status !== 'active') throw createAutomationError(400, "Questa guerra è già terminata.");
  const normalizedWeaponId = normalizeWarWeaponId(params.weaponId);
  const allowedWeapons = getAllowedWeaponsForWar(war.warType || 'land', war.navalPhase || 0);
  if (!allowedWeapons.includes(normalizedWeaponId)) {
    const label = war.warType === 'naval' && war.navalPhase === 1
      ? 'In fase navale 1 puoi usare solo Corazzate navali.'
      : 'In questa guerra puoi usare solo Carri armati e Aerei.';
    throw createAutomationError(400, label);
  }

  const weapon = WAR_WEAPON_CONFIG[normalizedWeaponId];
  if (!weapon) throw createAutomationError(400, "Armamento sconosciuto.");

  const energyCost = 300;
  if (!params.ignoreEnergyCost && user.energy < energyCost && params.allowAutoDrink) {
    const drank = await tryUseEnergyDrinkForUser(user.id);
    if (drank) {
      const { data: refreshedUser } = await supabase.from('users').select('*').eq('id', user.id).single();
      if (refreshedUser) user = refreshedUser;
    }
  }
  if (!params.ignoreEnergyCost && user.energy < energyCost) throw createAutomationError(400, "Energia insufficiente.");

  let totalDamage = weapon.damage;
  const isPatriot = (params.side === 'attacker' && war.attackerCountryIso2 === user.originalNation) ||
    (params.side === 'defender' && war.defenderCountryIso2 === user.originalNation);
  if (isPatriot) totalDamage = Math.floor(totalDamage * 1.10);

  const perks = await getUserPerks(user.id);
  const forzaBonus = (perks['FORZA'] || 0) * 0.05;
  const resistBonus = (perks['RESISTENZA'] || 0) * 0.03;
  totalDamage = Math.floor(totalDamage * (1 + forzaBonus + resistBonus));

  const warRegionId = params.side === 'attacker' ? war.attackerCountryIso2 : war.defenderCountryIso2;
  if (warRegionId) {
    try {
      const warBuildings = await getRegionBuildings(warRegionId);
      const warIndices = calculateRegionalIndices(warBuildings);
      const warEffects = calculateIndexEffects(warIndices);
      const regionalBonus = params.side === 'attacker' ? warEffects.warAttackBonus : warEffects.warDefenseBonus;
      if (regionalBonus > 0) totalDamage = Math.floor(totalDamage * (1 + regionalBonus));
    } catch { /* non-critical */ }
  }

  // RPC-first: single atomic DB call for energy, money, score, participants, logs
  const rpcEnergyCost = params.ignoreEnergyCost ? 0 : energyCost;
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('rpc_war_deploy', {
      p_user_id: user.id,
      p_war_id: params.warId,
      p_side: params.side,
      p_weapon_id: normalizedWeaponId,
      p_energy_cost: rpcEnergyCost,
      p_money_cost: 0,
      p_damage: totalDamage,
    });

    if (!rpcError && rpcData) {
      const result = typeof rpcData === 'string' ? JSON.parse(rpcData) : rpcData;
      if (result?.error) throw createAutomationError(400, result.error);
      // RPC succeeded — skip legacy path
    } else if (rpcError) {
      throw rpcError;
    }
  } catch (rpcErr: any) {
    // RPC_FALLBACK — remove after confirming rpc_war_deploy is deployed on all envs
    if (rpcErr?.statusCode) throw rpcErr; // re-throw domain errors from the RPC result

    console.warn('[war-deploy] rpc_war_deploy failed, using legacy fallback', {
      warId: params.warId, userId: user.id, error: rpcErr?.message,
    });

    if (!params.ignoreEnergyCost) {
      const { error: deductError } = await supabase.rpc('safe_deduct_currency', {
        p_user_id: user.id,
        p_money_cost: 0,
        p_gold_cost: 0,
        p_energy_cost: energyCost,
      });
      if (deductError) throw createAutomationError(400, deductError.message || 'Energia insufficiente.');
    }

    const scoreField = params.side === 'attacker' ? 'attackerScore' : 'defenderScore';
    await supabase.from('wars').update({
      [scoreField]: (war[scoreField] || 0) + totalDamage,
      updatedAt: new Date().toISOString(),
    }).eq('id', params.warId);

    const { data: existingParticipant } = await supabase.from('war_participants')
      .select('id, totalDamage, troopsDeployed')
      .eq('warId', params.warId)
      .eq('userId', user.id)
      .maybeSingle();

    if (existingParticipant) {
      const deployed = existingParticipant.troopsDeployed || {};
      deployed[normalizedWeaponId] = (deployed[normalizedWeaponId] || 0) + 1;
      await supabase.from('war_participants').update({
        totalDamage: (existingParticipant.totalDamage || 0) + totalDamage,
        troopsDeployed: deployed,
      }).eq('id', existingParticipant.id);
    } else {
      await supabase.from('war_participants').insert({
        warId: params.warId,
        userId: user.id,
        side: params.side,
        totalDamage,
        troopsDeployed: { [normalizedWeaponId]: 1 },
      });
    }

    await supabase.from('action_logs').insert({
      userId: user.id,
      action: 'WAR_DEPLOY',
      details: JSON.stringify({
        warId: params.warId,
        side: params.side,
        weaponId: normalizedWeaponId,
        damage: totalDamage,
        username: user.username,
        isPatriot
      }),
      timestamp: Date.now()
    });
  }

  try {
    await updateMissionProgress(user.id, 'WAR_DEPLOY', {
      deal_damage: totalDamage,
      fight_battles: 1,
      deploy_troops: 1,
      spend_energy: params.ignoreEnergyCost ? 0 : (weapon.energy || 0),
    });
    await updateMissionProgress(user.id, 'EARN_XP', { earn_xp: GAME_CONFIG.XP_PER_ATTACK || 0 });
  } catch { /* non-critical */ }

  return { success: true, damageDealt: totalDamage, side: params.side };
}

// ==============================================================
// SANCTIONS SYSTEM
// ==============================================================

// Sanctions Helper
const canSellInState = async (targetStateId: string, originStateId: string): Promise<boolean> => {
  const { data } = await supabase
    .from('sanctions')
    .select('id')
    .eq('fromStateId', targetStateId)
    .eq('targetStateId', originStateId)
    .eq('status', 'ACTIVE')
    .limit(1);
  return !data || data.length === 0;
};

const getItemType = (itemId: string): string => {
  const resources = ['oil', 'minerals', 'uranium', 'diamonds'];
  const weapons = ['tank', 'aircraft', 'battleship'];
  if (resources.includes(itemId)) return 'resources';
  if (weapons.includes(itemId)) return 'weapons';
  return 'items';
};

const calculatePartyCaps = async (partyId: string) => {
  const { data: members } = await supabase
    .from('party_members')
    .select('userId, users(level, lastLogin), joinedAt')
    .eq('partyId', partyId);

  const now = Date.now();
  const activeMembers = (members || []).map((m: any) => ({
    userId: m.userId,
    level: m.users?.level || 0,
    lastLogin: m.users?.lastLogin || 0,
    joinedAt: m.joinedAt
  })).filter(m =>
    m.level >= 60 &&
    now - (m.lastLogin || 0) <= 24 * 60 * 60 * 1000 &&
    now - m.joinedAt >= 72 * 60 * 60 * 1000
  );

  const activeCount = activeMembers.length;
  // Dynamic CAPS based on active members
  const maxGoldPerUser = Math.min(200, 50 + (activeCount * 5));
  const maxGoldTotal = Math.min(5000, activeCount * 100);

  return { activeCount, activeMembers, maxGoldPerUser, maxGoldTotal };
};

// ══════════════════════════════════════════════════════════════════
// REGIONAL AUTONOMY – Calculation Services
// ══════════════════════════════════════════════════════════════════

const ALL_BUILDING_TYPES: BuildingType[] = [
  'hospital', 'military_base', 'school', 'military_academy',
  'missile_system', 'airport', 'naval_port', 'space_port',
  'real_estate_fund', 'power_plant'
];

async function getRegionBuildings(regionId: string): Promise<Record<string, number>> {
  const { data } = await supabase
    .from('regional_buildings')
    .select('buildingType, quantity')
    .eq('regionId', regionId);
  const map: Record<string, number> = {};
  for (const bt of ALL_BUILDING_TYPES) map[bt] = 0;
  for (const row of data || []) map[row.buildingType] = row.quantity || 0;
  return map;
}

// ── Index helpers ────────────────────────────────────────────────

/** Compute the raw weighted building score for one index category. */
function calcRawScore(key: string, buildings: Record<string, number>): number {
  const weights = AUTONOMY_CONFIG.INDEX_WEIGHTS[key] || {};
  let total = 0;
  for (const [bt, w] of Object.entries(weights)) total += (buildings[bt] || 0) * (w as number);
  return Math.round(total * 100) / 100;
}

/**
 * Convert a raw building-score into a discrete level 1–10 using the
 * configured threshold array.  Minimum is always 1; levels above 10 are capped at 10.
 */
function calculateIndexLevel(rawScore: number, thresholds: number[]): number {
  let level = 1; // minimum allowed level is 1, never 0
  for (let i = 0; i < thresholds.length; i++) {
    if (rawScore >= thresholds[i]) level = i + 1;
    else break;
  }
  return Math.min(Math.max(1, level), thresholds.length);
}

/**
 * Return progress information toward the next index level.
 *  - progressPercent: 0–100 (how far from previous threshold to the next)
 *  - currentScore:    raw weighted building score
 *  - nextThreshold:   raw score needed for next level (null = already maxed)
 */
function calculateIndexProgress(
  rawScore: number,
  thresholds: number[],
  level: number
): { progressPercent: number; currentScore: number; nextThreshold: number | null } {
  if (level >= thresholds.length) {
    // Maximum level reached
    return { progressPercent: 100, currentScore: Math.round(rawScore), nextThreshold: null };
  }
  const prevThreshold = level > 0 ? thresholds[level - 1] : 0;
  const nextThreshold = thresholds[level];
  const progressInLevel = rawScore - prevThreshold;
  const levelRange = nextThreshold - prevThreshold;
  const progressPercent = Math.min(100, Math.max(0, (progressInLevel / levelRange) * 100));
  return { progressPercent: Math.round(progressPercent * 100) / 100, currentScore: Math.round(rawScore), nextThreshold };
}

/** Map a developmentIndex level to a human-readable classification string. */
function getRegionalClassification(developmentLevel: number): 'developed' | 'developing' | 'underdeveloped' {
  const thresholds = AUTONOMY_CONFIG.CLASSIFICATION_THRESHOLDS;
  if (developmentLevel >= thresholds.developed) return 'developed';
  if (developmentLevel >= thresholds.developing) return 'developing';
  return 'underdeveloped';
}

/**
 * Compute all four regional indices (as 1–10 levels), their progress
 * toward the next level, primary building counts, and classification.
 * This is the central function for the Regional Indexes system.
 */
function calculateRegionalIndices(buildings: Record<string, number>) {
  const thresholds = AUTONOMY_CONFIG.INDEX_THRESHOLDS;

  const rawHealth      = calcRawScore('health',      buildings);
  const rawMilitary    = calcRawScore('military',    buildings);
  const rawEducation   = calcRawScore('education',   buildings);
  const rawDevelopment = calcRawScore('development', buildings);

  const healthIndex      = calculateIndexLevel(rawHealth,      thresholds.health);
  const militaryIndex    = calculateIndexLevel(rawMilitary,    thresholds.military);
  const educationIndex   = calculateIndexLevel(rawEducation,   thresholds.education);
  const developmentIndex = calculateIndexLevel(rawDevelopment, thresholds.development);

  const healthProg      = calculateIndexProgress(rawHealth,      thresholds.health,      healthIndex);
  const militaryProg    = calculateIndexProgress(rawMilitary,    thresholds.military,    militaryIndex);
  const educationProg   = calculateIndexProgress(rawEducation,   thresholds.education,   educationIndex);
  const developmentProg = calculateIndexProgress(rawDevelopment, thresholds.development, developmentIndex);

  const classification = getRegionalClassification(developmentIndex);

  return {
    healthIndex,
    militaryIndex,
    educationIndex,
    developmentIndex,
    healthProgress:      healthProg.progressPercent,
    militaryProgress:    militaryProg.progressPercent,
    educationProgress:   educationProg.progressPercent,
    developmentProgress: developmentProg.progressPercent,
    regionalClassification: classification,
    // Raw scores and next thresholds for UI display
    raw: { health: rawHealth, military: rawMilitary, education: rawEducation, development: rawDevelopment },
    nextThresholds: {
      health:      healthProg.nextThreshold,
      military:    militaryProg.nextThreshold,
      education:   educationProg.nextThreshold,
      development: developmentProg.nextThreshold,
    },
    // Primary building counts (for "X/Y building" display in UI)
    // For military we show the weighted score (sum across all contributing buildings)
    // because multiple building types contribute, alongside the raw military_base count.
    primaryCounts: {
      health:      buildings['hospital']          || 0,
      military:    buildings['military_base']     || 0,
      education:   buildings['school']            || 0,
      development: buildings['real_estate_fund']  || 0,
    },
    // Weighted scores for informational display (military has multiple contributors)
    rawScores: {
      health:      rawHealth,
      military:    Math.round(rawMilitary * 10) / 10,
      education:   rawEducation,
      development: rawDevelopment,
    },
  };
}

/**
 * Calculate the gameplay effects that the regional indices provide.
 * Returns multipliers that other game systems can apply.
 */
function calculateIndexEffects(indices: ReturnType<typeof calculateRegionalIndices>) {
  const fx = AUTONOMY_CONFIG.INDEX_EFFECTS;
  return {
    // HEALTH → reduces energy cost for actions performed in this region
    energyCostReduction: indices.healthIndex * fx.health.energyCostReductionPerLevel,
    // MILITARY → bonus to attack damage and defence reduction when deploying in wars
    warAttackBonus:   indices.militaryIndex * fx.military.attackBonusPerLevel,
    warDefenseBonus:  indices.militaryIndex * fx.military.defenseBonusPerLevel,
    // EDUCATION → bonus XP from any action performed in this region
    xpBonus: indices.educationIndex * fx.education.xpBonusPerLevel,
    // DEVELOPMENT → salary multiplier and coup risk reduction
    salaryMultiplier:      1 + indices.developmentIndex * fx.development.salaryMultiplierPerLevel,
    coupRiskReduction:     indices.developmentIndex * fx.development.coupRiskReductionPerLevel,
    // Summary for quick consumption
    classification: indices.regionalClassification,
    isAtRisk: indices.developmentIndex <= 1, // Region arretrata — instability risk active
  };
}

function calculateEnergyStatus(buildings: Record<string, number>): {
  generation: number; consumption: number; efficiency: number;
  surplusPowerPlants: number; supportableBuildings: number; excessBuildings: number; isDeficit: boolean;
} {
  const cons = AUTONOMY_CONFIG.ENERGY_CONSUMPTION;
  let consumption = 0;
  for (const [bt, qty] of Object.entries(buildings)) {
    consumption += (cons[bt] || 0) * qty;
  }
  const generation = (buildings['power_plant'] || 0) * AUTONOMY_CONFIG.ENERGY_PRODUCTION_PER_PLANT;
  const efficiency = generation - consumption;
  const isDeficit = efficiency < 0;
  const surplusPowerPlants = efficiency > 0
    ? Math.floor(efficiency / AUTONOMY_CONFIG.ENERGY_PRODUCTION_PER_PLANT)
    : -Math.ceil(Math.abs(efficiency) / AUTONOMY_CONFIG.ENERGY_PRODUCTION_PER_PLANT);
  // Average energy cost per consuming building (using the most common cost from ENERGY_CONSUMPTION config)
  const avgConsumptionPerBuilding = 2; // mW – matches the standard rate in AUTONOMY_CONFIG.ENERGY_CONSUMPTION
  const supportableBuildings = efficiency > 0
    ? Math.floor(efficiency / avgConsumptionPerBuilding)
    : 0;
  const excessBuildings = efficiency < 0
    ? Math.ceil(Math.abs(efficiency) / avgConsumptionPerBuilding)
    : 0;
  return { generation, consumption, efficiency, surplusPowerPlants, supportableBuildings, excessBuildings, isDeficit };
}

function calculateMilitaryStats(buildings: Record<string, number>) {
  const coefAtk = AUTONOMY_CONFIG.ATTACK_BASE_COEFFICIENT;
  const coefDef = AUTONOMY_CONFIG.DEFENSE_STRUCTURAL_COEFFICIENT;
  const academies = buildings['military_academy'] || 0;
  const bases = buildings['military_base'] || 0;
  const hospitals = buildings['hospital'] || 0;
  const schools = buildings['school'] || 0;
  const missileSystems = buildings['missile_system'] || 0;
  const airports = buildings['airport'] || 0;
  const navalPorts = buildings['naval_port'] || 0;
  const spacePorts = buildings['space_port'] || 0;
  const powerPlants = buildings['power_plant'] || 0;

  const initialAttackDamage = academies * coefAtk;
  const R1 = academies * coefAtk;
  const R2 = bases * 2;
  const R3 = hospitals + schools + missileSystems + airports + navalPorts + spacePorts + powerPlants;
  const initialDefensePoints = R1 + ((R2 + R3) * coefDef);

  return {
    initialAttackDamage, initialDefensePoints,
    academies, bases, hospitals, schools, missileSystems, airports, navalPorts, spacePorts, powerPlants,
  };
}

async function recalculateRegionStats(regionId: string) {
  const buildings = await getRegionBuildings(regionId);
  const indices = calculateRegionalIndices(buildings);
  const energy = calculateEnergyStatus(buildings);
  await supabase.from('regions').update({
    healthIndex:            indices.healthIndex,
    militaryIndex:          indices.militaryIndex,
    educationIndex:         indices.educationIndex,
    developmentIndex:       indices.developmentIndex,
    healthProgress:         indices.healthProgress,
    militaryProgress:       indices.militaryProgress,
    educationProgress:      indices.educationProgress,
    developmentProgress:    indices.developmentProgress,
    regionalClassification: indices.regionalClassification,
    energyGeneration:       energy.generation,
    energyConsumption:      energy.consumption,
    energyEfficiency:       energy.efficiency,
  }).eq('id', regionId);
  return { buildings, indices, energy };
}

async function getStateEnergyCompensation(regionId: string, nationId: string | null) {
  if (!nationId) return 0;
  const { data: siblings } = await supabase
    .from('regions')
    .select('id, energyEfficiency')
    .eq('nation_id', nationId)
    .neq('id', regionId);
  let totalSurplus = 0;
  for (const s of siblings || []) {
    if ((s.energyEfficiency || 0) > 0) totalSurplus += s.energyEfficiency;
  }
  return totalSurplus;
}

async function addRegionalBudgetTransaction(regionId: string, type: string, subtype: string | null, moneyDelta: number, description: string, userId?: string) {
  await supabase.from('regional_budget_transactions').insert({
    regionId, type, subtype, moneyDelta, description,
    createdByUserId: userId || null,
  });
  if (moneyDelta !== 0) {
    const { data: region } = await supabase.from('regions').select('regionalBudget').eq('id', regionId).single();
    const currentBudget = region?.regionalBudget || 0;
    await supabase.from('regions').update({
      regionalBudget: Math.max(0, currentBudget + moneyDelta),
    }).eq('id', regionId);
  }
}

export const LawRegistry: Record<string, {
  category: string;
  icon: string;
  title: string;
  description: string;
  threshold: number; // e.g. 0.5 for >50%, 0.8 for >=80%
  delayDays: number; // how long it stays in pending (e.g. 1)
  validate: (region: any, params: any, proposer: any) => Promise<string | null>; // returns error string or null
  execute: (region: any, params: any, sourceLawId?: string) => Promise<void>;
}> = {
  change_market_tax: {
    category: "Economia e Tasse",
    icon: "BadgeDollarSign",
    title: "Modifica tassa di mercato",
    description: "Imposta la tassa sulle transazioni di mercato nella regione.",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region, params) => {
      const tax = parseInt(params.tax);
      if (isNaN(tax) || tax < 0 || tax > 100) return "Tassa non valida (deve essere tra 0 e 100)";
      return null;
    },
    execute: async (region, params) => {
      await supabase.from('regions').update({ marketTaxRate: parseInt(params.tax) }).eq('id', region.id);
    }
  },
  change_salary_tax: {
    category: "Economia e Tasse",
    icon: "Briefcase",
    title: "Modifica tassa sui salari",
    description: "Imposta la percentuale di tassazione sugli stipendi guadagnati nelle fabbriche.",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region, params) => {
      const tax = parseInt(params.tax);
      if (isNaN(tax) || tax < 0 || tax > 100) return "Tassa non valida (deve essere tra 0 e 100)";
      return null;
    },
    execute: async (region, params) => {
      await supabase.from('regions').update({ taxes: parseInt(params.tax) }).eq('id', region.id);
    }
  },
  transfer_budget: {
    category: "Economia e Tasse",
    icon: "ArrowRightLeft",
    title: "Trasferimento Budget",
    description: "Trasferisce denaro dal budget statale a un'altra nazione.",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region, params) => {
      const amount = parseInt(params.amount);
      if (isNaN(amount) || amount <= 0) return "Importo non valido.";

      const { data: budget } = await supabase.from('budgets').select('moneyEUR').eq('ownerType', 'REGION').eq('ownerId', region.id).single();
      if (!budget || budget.moneyEUR < amount) return "Spesa superiore ai fondi in bilancio attuali.";

      const { data: target } = await supabase.from('regions').select('id').eq('id', params.targetRegionId).single();
      if (!target) return "Nazione destinataria inesistente.";
      if (params.targetRegionId === region.id) return "Non puoi trasferire budget a te stesso.";

      return null;
    },
    execute: async (region, params) => {
      const amount = parseInt(params.amount);

      await supabase.rpc('add_budget_transaction', {
        p_owner_type: 'REGION',
        p_owner_id: region.id,
        p_type: 'EXPENSE',
        p_subtype: 'BUDGET_TRANSFER',
        p_money_delta: -amount,
        p_metadata: { to: params.targetRegionId }
      });
      await supabase.rpc('add_budget_transaction', {
        p_owner_type: 'REGION',
        p_owner_id: params.targetRegionId,
        p_type: 'INCOME',
        p_subtype: 'BUDGET_TRANSFER',
        p_money_delta: amount,
        p_metadata: { from: region.id }
      });
    }
  },
  proclaim_dictatorship: {
    category: "Politica Interna",
    icon: "Crown",
    title: "Proclamazione Dittatura",
    description: "Il Leader diventa dittatore assoluto. Le leggi passano senza voto.",
    threshold: 0.8,
    delayDays: 1,
    validate: async (region, params, proposer) => {
      const now = Date.now();
      const THIRTY_ONE_DAYS = 31 * 24 * 60 * 60 * 1000;
      if (now - (region.foundationDate || 0) < THIRTY_ONE_DAYS && region.foundationDate !== 0) {
        return "Devono passare almeno 31 giorni dalla fondazione dello Stato.";
      }
      if (region.ownerUserId !== proposer.id) {
        return "Solo il Leader attuale può proclamare la dittatura.";
      }
      return null;
    },
    execute: async (region, params, sourceLawId) => {
      const { data: law } = await supabase.from('laws').select('proposerId').eq('id', sourceLawId).single();
      const proposerId = law ? law.proposerId : region.ownerUserId;

      await supabase.from('regions').update({
        dictatorship: 1,
        governmentForm: 'DICTATORSHIP',
        leaderUserId: proposerId,
        ownerUserId: proposerId,
        leaderTitle: 'Dittatore'
      }).eq('id', region.id);
    }
  },
  revoke_dictatorship: {
    category: "Politica Interna",
    icon: "Scale",
    title: "Ritorno alla Democrazia",
    description: "Revoca lo stato di Dittatura. Il parlamento torna ad avere potere.",
    threshold: 0.8,
    delayDays: 1,
    validate: async (region) => {
      if (!region.dictatorship) return "Lo stato non è in dittatura.";
      return null;
    },
    execute: async (region) => {
      await supabase.from('regions').update({ dictatorship: 0, governmentForm: 'PRESIDENTIAL_REPUBLIC', leaderTitle: 'Presidente' }).eq('id', region.id);
    }
  },
  change_state_name: {
    category: "Politica Interna",
    icon: "Flag",
    title: "Cambio nome dello Stato",
    description: "Modifica il nome ufficiale della nazione.",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region, params) => {
      if (!params.name || params.name.length > 22) return "Nome non valido (max 22 caratteri).";
      const { data: existing } = await supabase.from('regions').select('id').eq('name', params.name).neq('id', region.id).maybeSingle();
      if (existing) return "Nome già in uso da un'altra nazione.";
      return null;
    },
    execute: async (region, params) => {
      await supabase.from('regions').update({ name: params.name }).eq('id', region.id);
    }
  },
  change_parliament_size: {
    category: "Politica Interna",
    icon: "Users",
    title: "Dimensione Parlamento",
    description: "Modifica il numero dei seggi in Parlamento (da 10 a 100).",
    threshold: 0.8,
    delayDays: 1,
    validate: async (region, params) => {
      const size = parseInt(params.size);
      if (isNaN(size) || size < 10 || size > 100) return "Dimensione non valida (min 10, max 100).";
      return null;
    },
    execute: async (region, params) => {
      await supabase.from('regions').update({ parliamentSize: parseInt(params.size) }).eq('id', region.id);
    }
  },
  change_parliament_duration: {
    category: "Politica Interna",
    icon: "Clock",
    title: "Durata Mandato",
    description: "Modifica i giorni di durata del mandato parlamentare (da 3 a 30).",
    threshold: 0.8,
    delayDays: 1,
    validate: async (region, params) => {
      const days = parseInt(params.days);
      if (isNaN(days) || days < 3 || days > 30) return "Durata non valida (min 3, max 30).";
      return null;
    },
    execute: async (region, params) => {
      await supabase.from('regions').update({ parliamentDuration: parseInt(params.days) }).eq('id', region.id);
    }
  },
  open_borders: {
    category: "Politica Interna",
    icon: "Unlock",
    title: "Apri Confini",
    description: "Permette a chiunque di prendere la residenza o il permesso di lavoro.",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region) => {
      if (region.residencePolicy === 'open') return "I confini sono già aperti.";
      return null;
    },
    execute: async (region) => {
      await supabase.from('regions').update({ residencePolicy: 'open' }).eq('id', region.id);
    }
  },
  close_borders: {
    category: "Politica Interna",
    icon: "Lock",
    title: "Chiudi Confini",
    description: "Blocca l'immigrazione. Solo il Leader può approvare visti lavorativi.",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region) => {
      if (region.residencePolicy === 'closed') return "I confini sono già chiusi.";
      return null;
    },
    execute: async (region) => {
      await supabase.from('regions').update({ residencePolicy: 'closed' }).eq('id', region.id);
    }
  },
  migration_agreement: {
    category: "Diplomazia",
    icon: "PlaneTakeoff",
    title: "Accordo di Migrazione",
    description: "Permette ai cittadini di un'altra nazione di viaggiare liberamente nel nostro territorio.",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region, params) => {
      if (!params || !params.targetRegionId) return "ID Nazione bersaglio obbligatorio.";
      if (params.targetRegionId === region.id) return "Non puoi fare un accordo con te stesso.";
      const { data: target } = await supabase.from('regions').select('id').eq('id', params.targetRegionId).single();
      if (!target) return "Nazione bersaglio inesistente.";
      const { data: existing } = await supabase.from('migration_agreements').select('status').eq('fromStateId', region.id).eq('toStateId', params.targetRegionId).maybeSingle();
      if (existing && existing.status === 'ACTIVE') return "Esiste già un accordo attivo con questa nazione.";
      return null;
    },
    execute: async (region, params, sourceLawId) => {
      const id = generateSecureId(9);
      const nowIso = new Date().toISOString();
      await supabase.from('migration_agreements').upsert({
        id,
        fromStateId: region.id,
        toStateId: params.targetRegionId,
        status: 'ACTIVE',
        type: 'UNILATERAL',
        createdAt: nowIso,
        activatedAt: nowIso,
        sourceLawId: sourceLawId || null,
        updatedAt: nowIso
      });

      // Check if it's now BILATERAL
      const { data: inverse } = await supabase.from('migration_agreements').select('status').eq('fromStateId', params.targetRegionId).eq('toStateId', region.id).maybeSingle();
      if (inverse && inverse.status === 'ACTIVE') {
        await supabase.from('migration_agreements').update({ type: 'BILATERAL' }).eq('fromStateId', region.id).eq('toStateId', params.targetRegionId);
        await supabase.from('migration_agreements').update({ type: 'BILATERAL' }).eq('fromStateId', params.targetRegionId).eq('toStateId', region.id);
      }
    }
  },
  revoke_migration_agreement: {
    category: "Diplomazia",
    icon: "PlaneLanding",
    title: "Revoca Accordo Migrazione",
    description: "Annulla l'accordo di migrazione con un'altra nazione.",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region, params) => {
      if (!params || !params.targetRegionId) return "ID Nazione bersaglio obbligatorio.";
      const { data: existing } = await supabase.from('migration_agreements').select('status').eq('fromStateId', region.id).eq('toStateId', params.targetRegionId).maybeSingle();
      if (!existing || existing.status !== 'ACTIVE') return "Non c'è un accordo attivo da revocare.";
      return null;
    },
    execute: async (region, params, sourceLawId) => {
      const nowIso = new Date().toISOString();
      await supabase.from('migration_agreements').update({
        status: 'INACTIVE',
        type: 'UNILATERAL',
        revokedAt: nowIso,
        sourceLawId: sourceLawId || null,
        updatedAt: nowIso
      }).eq('fromStateId', region.id).eq('toStateId', params.targetRegionId);

      // Reset the other side to unilateral if it was bilateral
      await supabase.from('migration_agreements').update({ type: 'UNILATERAL' }).eq('fromStateId', params.targetRegionId).eq('toStateId', region.id);
    }
  },
  declare_war: {
    category: "Guerra e Diplomazia",
    icon: "Swords",
    title: "Dichiarazione di Guerra",
    description: "Avvia una guerra contro la nazione bersaglio.",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region, params) => {
      if (!params || !params.targetRegionId) return "ID Nazione bersaglio obbligatorio.";
      const { data: target } = await supabase.from('regions').select('id').eq('id', params.targetRegionId).single();
      if (!target) return "Nazione bersaglio inesistente.";
      if (params.targetRegionId === region.id) return "Non puoi dichiarare guerra a te stesso.";

      const { data: existingWar } = await supabase.from('wars').select('id')
        .eq('status', 'active')
        .or(`attackerCountryIso2.eq.${region.id},defenderCountryIso2.eq.${region.id}`)
        .or(`attackerCountryIso2.eq.${params.targetRegionId},defenderCountryIso2.eq.${params.targetRegionId}`)
        .maybeSingle();

      if (existingWar) return "Sei già in guerra con questa nazione o una nazione coinvolta.";

      // Bloc restriction
      const { data: attackerBloc } = await supabase.from('bloc_memberships').select('blocId').eq('stateId', region.id).eq('status', 'active').maybeSingle();
      const { data: defenderBloc } = await supabase.from('bloc_memberships').select('blocId').eq('stateId', params.targetRegionId).eq('status', 'active').maybeSingle();
      if (attackerBloc && defenderBloc && attackerBloc.blocId === defenderBloc.blocId) {
        return "Non puoi dichiarare guerra a un membro dello stesso Blocco Geopolitico.";
      }

      const { count: activeWars } = await supabase.from('wars').select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .or(`attackerCountryIso2.eq.${region.id},defenderCountryIso2.eq.${region.id}`);

      const baseCost = 50000;
      const cost = Math.floor(baseCost * (1 + 0.25 * (activeWars || 0)));
      const { data: budget } = await supabase.from('budgets').select('moneyEUR').eq('ownerType', 'REGION').eq('ownerId', region.id).single();
      if (!budget || budget.moneyEUR < cost) return `Fondi in bilancio insufficienti ($${cost} richiesti assecondando le guerre simultanee).`;

      return null;
    },
    execute: async (region, params) => {
      const { count: activeWars } = await supabase.from('wars').select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .or(`attackerCountryIso2.eq.${region.id},defenderCountryIso2.eq.${region.id}`);

      const baseCost = 50000;
      const cost = Math.floor(baseCost * (1 + 0.25 * (activeWars || 0)));
      const nowIso = new Date().toISOString();

      await supabase.rpc('add_budget_transaction', {
        p_owner_type: 'REGION',
        p_owner_id: region.id,
        p_type: 'EXPENSE',
        p_subtype: 'WAR_START',
        p_money_delta: -cost,
        p_metadata: { target: params.targetRegionId }
      });

      await supabase.from('wars').insert({
        id: `war_${Date.now()}_${region.id}_${params.targetRegionId}`,
        attackerCountryIso2: region.id,
        defenderCountryIso2: params.targetRegionId,
        status: 'active',
        startedAt: nowIso,
        endsAt: new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString(),
        attackerScore: 0,
        defenderScore: 0,
        lastEventAt: nowIso
      });
    }
  },
  peace_treaty: {
    category: "Guerra e Diplomazia",
    icon: "Handshake",
    title: "Trattato di Pace",
    description: "Propone o accetta la fine delle ostilità con una nazione in guerra.",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region, params) => {
      if (!params || !params.targetRegionId) return "ID Nazione bersaglio obbligatorio.";
      const { data: target } = await supabase.from('regions').select('id').eq('id', params.targetRegionId).single();
      if (!target) return "Nazione bersaglio inesistente.";
      const { data: existingWar } = await supabase.from('wars').select('id')
        .eq('status', 'active')
        .or(`attackerCountryIso2.eq.${region.id},defenderCountryIso2.eq.${region.id}`)
        .or(`attackerCountryIso2.eq.${params.targetRegionId},defenderCountryIso2.eq.${params.targetRegionId}`)
        .maybeSingle();
      if (!existingWar) return "Non c'è una guerra attiva con questa nazione.";
      return null;
    },
    execute: async (region, params) => {
      const { data: existingWar } = await supabase.from('wars').select('*')
        .eq('status', 'active')
        .or(`attackerCountryIso2.eq.${region.id},defenderCountryIso2.eq.${region.id}`)
        .or(`attackerCountryIso2.eq.${params.targetRegionId},defenderCountryIso2.eq.${params.targetRegionId}`)
        .maybeSingle();

      if (existingWar) {
        // Determine winner based on scores
        let winner = null;
        let loser = null;
        if (existingWar.attackerScore > existingWar.defenderScore) {
          winner = existingWar.attackerCountryIso2;
          loser = existingWar.defenderCountryIso2;
        } else if (existingWar.defenderScore > existingWar.attackerScore) {
          winner = existingWar.defenderCountryIso2;
          loser = existingWar.attackerCountryIso2;
        }

        // Execute War Loot Transfer if there's a clear winner
        if (winner && loser) {
          const { data: loserBudget } = await supabase.from('budgets').select('moneyEUR').eq('ownerType', 'REGION').eq('ownerId', loser).single();
          if (loserBudget && loserBudget.moneyEUR > 0) {
            const stolenMoney = loserBudget.moneyEUR;

            await supabase.rpc('add_budget_transaction', {
              p_owner_type: 'REGION',
              p_owner_id: loser,
              p_type: 'WAR_LOOT',
              p_subtype: 'LOOT_LOST',
              p_money_delta: -stolenMoney,
              p_metadata: { to: winner, warId: existingWar.id }
            });

            await supabase.rpc('add_budget_transaction', {
              p_owner_type: 'REGION',
              p_owner_id: winner,
              p_type: 'WAR_LOOT',
              p_subtype: 'LOOT_WON',
              p_money_delta: stolenMoney,
              p_metadata: { from: loser, warId: existingWar.id }
            });
          }

          // Territory Annexation: If Attacker wins, they take the defender's region
          if (winner === existingWar.attackerCountryIso2) {
            const { data: attackerRegion } = await supabase.from('regions').select('ownerUserId, leaderUserId, nation_id, stateColor, governmentForm, leaderTitle, dictatorship').eq('id', winner).single();
            const conquestLeader = attackerRegion?.leaderUserId || attackerRegion?.ownerUserId;
            const conquestNation = attackerRegion?.nation_id || `nation_${winner}`;

            if (attackerRegion && conquestLeader) {
              await supabase.from('regions').update({
                ownerUserId: conquestLeader,
                leaderUserId: conquestLeader,
                nation_id: conquestNation,
                stateColor: attackerRegion.stateColor,
                governmentForm: attackerRegion.governmentForm,
                leaderTitle: attackerRegion.leaderTitle,
                dictatorship: attackerRegion.dictatorship,
                stability: 30
              }).eq('id', loser);
              console.log(`[PEACE TREATY] ${winner} ANNEXED ${loser} via treaty.`);
            }
          }
        }
        await supabase.from('wars').update({ status: 'ended', endsAt: new Date().toISOString() }).eq('id', existingWar.id);
      }
    }
  },
  apply_sanctions: {
    category: "Diplomazia",
    icon: "ShieldAlert",
    title: "Applica Sanzioni",
    description: "Impedisce il commercio e gli spostamenti da/verso la nazione bersaglio.",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region, params) => {
      if (!params || !params.targetRegionId) return "ID Nazione bersaglio obbligatorio.";
      const { data: target } = await supabase.from('regions').select('id').eq('id', params.targetRegionId).single();
      if (!target) return "Nazione bersaglio inesistente.";
      if (params.targetRegionId === region.id) return "Non puoi sanzionare te stesso.";

      const { data: existing } = await supabase.from('sanctions').select('id').eq('fromStateId', region.id).eq('targetStateId', params.targetRegionId).eq('status', 'ACTIVE').maybeSingle();
      if (existing) return "Esiste già una sanzione attiva contro questa nazione.";
      return null;
    },
    execute: async (region, params, sourceLawId) => {
      const { data: law } = await supabase.from('laws').select('proposerId').eq('id', sourceLawId).single();
      const creatorId = law ? law.proposerId : region.ownerUserId;

      await supabase.from('sanctions').insert({
        id: `sanc_${Date.now()}_${region.id}_${params.targetRegionId}`,
        fromStateId: region.id,
        targetStateId: params.targetRegionId,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        createdByUserId: creatorId
      });
    }
  },
  revoke_sanctions: {
    category: "Diplomazia",
    icon: "Unlock",
    title: "Revoca Sanzioni",
    description: "Annulla le sanzioni attive verso una nazione.",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region, params) => {
      if (!params || !params.targetRegionId) return "ID Nazione bersaglio obbligatorio.";
      const { data: existing } = await supabase.from('sanctions').select('id').eq('fromStateId', region.id).eq('targetStateId', params.targetRegionId).eq('status', 'ACTIVE').maybeSingle();
      if (!existing) return "Non c'è una sanzione attiva da revocare.";
      return null;
    },
    execute: async (region, params, sourceLawId) => {
      const { data: law } = await supabase.from('laws').select('proposerId').eq('id', sourceLawId).single();
      const revokerId = law ? law.proposerId : region.ownerUserId;

      await supabase.from('sanctions').update({ status: 'REVOKED', revokedAt: new Date().toISOString(), revokedByUserId: revokerId })
        .eq('fromStateId', region.id).eq('targetStateId', params.targetRegionId).eq('status', 'ACTIVE');
    }
  },
  deep_exploration: {
    category: "Economia e Tasse",
    icon: "Pickaxe",
    title: "Deep Exploration",
    description: "Attiva l'estrazione in profondità per una risorsa. Aumenta i cap di ricarica in tutte le regioni per 7 giorni. Costa diamanti e fondi dal tesoro.",
    threshold: 0.5,
    delayDays: 0,
    validate: async (region, params) => {
      if (!params?.resourceType) return "Tipo di risorsa obbligatorio.";
      if (!params?.level) return "Livello Deep obbligatorio.";
      const nationId = region.nation_id;
      if (!nationId) return "Nazione non trovata per questa regione.";

      // Check no active Deep
      const nowStr = new Date().toISOString();
      const { data: existing } = await supabase
        .from('deep_explorations')
        .select('id')
        .eq('nationId', nationId)
        .eq('isActive', true)
        .gte('endsAt', nowStr)
        .limit(1);
      if (existing && existing.length > 0) return "Una Deep Exploration è già attiva per questa nazione.";

      return null;
    },
    execute: async (region, params, sourceLawId) => {
      // This law triggers deep exploration activation via the region's nation
      const nationId = region.nation_id;
      if (!nationId) return;

      const { data: law } = await supabase.from('laws').select('proposerId').eq('id', sourceLawId).single();
      const activatorId = law ? law.proposerId : region.ownerUserId;

      try {
        const preview = await computeDeepCost(nationId, params.resourceType, parseInt(params.level));
        const durationDays = parseInt(await getSetting('deep_duration_days')) || 7;
        const startsAt = new Date();
        const endsAt = new Date(startsAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
        const deepId = 'deep_' + generateSecureId(9);

        // Deduct costs from region budget
        if (preview.costEur > 0) {
          await supabase.rpc('add_budget_transaction', {
            p_owner_type: 'REGION',
            p_owner_id: region.id,
            p_type: 'EXPENSE',
            p_subtype: 'DEEP_EXPLORATION',
            p_money_delta: -preview.costEur,
            p_created_by: activatorId,
            p_metadata: { resourceType: params.resourceType, level: params.level },
          });
        }

        await supabase.from('deep_explorations').insert({
          id: deepId,
          nationId,
          resourceType: params.resourceType,
          level: parseInt(params.level),
          targetCap: preview.targetCap,
          activatedByUserId: activatorId,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          isActive: true,
          costDiamonds: preview.costDiamonds,
          costEur: preview.costEur,
          costGold: preview.costGold,
        });
      } catch (e) {
        console.error("Failed to execute deep_exploration law:", e);
      }
    }
  },
  // ── Autonomy Laws ──────────────────────────────────
  grant_autonomy: {
    category: "Autonomie Regionali",
    icon: "MapPin",
    title: "Istituisci Autonomia Regionale",
    description: "Trasforma una regione non-capitale in autonomia con governatore e parlamento regionale.",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region, params) => {
      if (!params || !params.targetRegionId) return "ID regione bersaglio obbligatorio.";
      const { data: target } = await supabase.from('regions').select('*').eq('id', params.targetRegionId).single();
      if (!target) return "Regione bersaglio inesistente.";
      if (target.nation_id !== region.nation_id && target.id !== region.id) return "La regione non appartiene a questo Stato.";
      if (target.isCapital) return "La capitale non può diventare autonomia.";
      if (target.isAutonomous) return "La regione è già autonoma.";
      return null;
    },
    execute: async (region, params) => {
      const share = parseInt(params.profitShare) || 30;
      const clampedShare = Math.max(0, Math.min(100, share));
      const nowIso = new Date().toISOString();
      await supabase.from('regions').update({
        isAutonomous: true,
        regionalParliamentEnabled: true,
        regionalProfitSharePercent: clampedShare,
        nationalProfitSharePercent: 100 - clampedShare,
        regionalBudget: 0,
        autonomyGrantedAt: nowIso,
        autonomyRevokedAt: null,
      }).eq('id', params.targetRegionId);
      await supabase.from('autonomy_history').insert({
        regionId: params.targetRegionId,
        action: 'granted',
        details: { profitShare: clampedShare, grantedBy: region.id },
      });
    }
  },
  revoke_autonomy: {
    category: "Autonomie Regionali",
    icon: "MapPinOff",
    title: "Revoca Autonomia Regionale",
    description: "Rimuove lo status di autonomia da una regione, riportandola sotto gestione centrale.",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region, params) => {
      if (!params || !params.targetRegionId) return "ID regione bersaglio obbligatorio.";
      const { data: target } = await supabase.from('regions').select('*').eq('id', params.targetRegionId).single();
      if (!target) return "Regione bersaglio inesistente.";
      if (!target.isAutonomous) return "La regione non è autonoma.";
      return null;
    },
    execute: async (region, params) => {
      const { data: target } = await supabase.from('regions').select('regionalBudget').eq('id', params.targetRegionId).single();
      const frozenBudget = target?.regionalBudget || 0;
      const nowIso = new Date().toISOString();
      // Transfer remaining regional budget to state
      if (frozenBudget > 0) {
        await supabase.rpc('add_budget_transaction', {
          p_owner_type: 'REGION',
          p_owner_id: region.id,
          p_type: 'INCOME',
          p_subtype: 'AUTONOMY_REVOKE_TRANSFER',
          p_money_delta: frozenBudget,
          p_metadata: { fromRegion: params.targetRegionId },
        });
      }
      await supabase.from('regions').update({
        isAutonomous: false,
        regionalParliamentEnabled: false,
        governorPlayerId: null,
        regionalBudget: 0,
        regionalProfitSharePercent: 0,
        nationalProfitSharePercent: 100,
        autonomyRevokedAt: nowIso,
      }).eq('id', params.targetRegionId);
      // Remove regional parliament members
      await supabase.from('regional_parliament_members').delete().eq('regionId', params.targetRegionId);
      await supabase.from('autonomy_history').insert({
        regionId: params.targetRegionId,
        action: 'revoked',
        details: { revokedBy: region.id, frozenBudget },
      });
    }
  },
  change_profit_share: {
    category: "Autonomie Regionali",
    icon: "PieChart",
    title: "Modifica Quota Utili Autonomia",
    description: "Cambia la percentuale di profitto trattenuta dalla regione autonoma.",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region, params) => {
      if (!params || !params.targetRegionId) return "ID regione bersaglio obbligatorio.";
      const share = parseInt(params.profitShare);
      if (isNaN(share) || share < 0 || share > 100) return "Quota non valida (0-100).";
      const { data: target } = await supabase.from('regions').select('isAutonomous').eq('id', params.targetRegionId).single();
      if (!target || !target.isAutonomous) return "La regione non è autonoma.";
      return null;
    },
    execute: async (region, params) => {
      const share = Math.max(0, Math.min(100, parseInt(params.profitShare)));
      await supabase.from('regions').update({
        regionalProfitSharePercent: share,
        nationalProfitSharePercent: 100 - share,
      }).eq('id', params.targetRegionId);
    }
  },
  change_worker_tax: {
    category: "Autonomie Regionali",
    icon: "Wallet",
    title: "Modifica Tassa Lavoratori",
    description: "Imposta la tassa percentuale sui guadagni da lavoro nella regione.",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region, params) => {
      const tax = parseInt(params.tax);
      if (isNaN(tax) || tax < 0 || tax > 100) return "Tassa non valida (0-100).";
      return null;
    },
    execute: async (region, params) => {
      const regionTarget = params.targetRegionId || region.id;
      await supabase.from('regions').update({ workerTaxPercent: parseInt(params.tax) }).eq('id', regionTarget);
    }
  },
  change_industry_tax: {
    category: "Autonomie Regionali",
    icon: "Factory",
    title: "Modifica Tassa Industriale",
    description: "Imposta la tassa percentuale sui profitti industriali nella regione.",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region, params) => {
      const tax = parseInt(params.tax);
      if (isNaN(tax) || tax < 0 || tax > 100) return "Tassa non valida (0-100).";
      return null;
    },
    execute: async (region, params) => {
      const regionTarget = params.targetRegionId || region.id;
      await supabase.from('regions').update({ industryTaxPercent: parseInt(params.tax) }).eq('id', regionTarget);
    }
  },
  build_regional_building: {
    category: "Costruzioni Regionali",
    icon: "Building2",
    title: "Costruzione Edificio Regionale",
    description: "Costruisci un edificio in una regione specifica.",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region, params) => {
      const bt = params.buildingType;
      if (!bt || !AUTONOMY_CONFIG.BUILDING_COSTS[bt]) return "Tipo edificio non valido.";
      const cost = AUTONOMY_CONFIG.BUILDING_COSTS[bt];
      const targetId = params.targetRegionId || region.id;
      // Check budget source (regional budget for autonomous, state budget otherwise)
      const { data: targetRegion } = await supabase.from('regions').select('isAutonomous, regionalBudget, nation_id').eq('id', targetId).single();
      if (!targetRegion) return "Regione non trovata.";
      if (targetRegion.isAutonomous) {
        if ((targetRegion.regionalBudget || 0) < cost) return `Budget regionale insufficiente (${cost} EUR richiesti).`;
      } else {
        const { data: budget } = await supabase.from('budgets').select('moneyEUR').eq('ownerType', 'REGION').eq('ownerId', region.id).single();
        if (!budget || budget.moneyEUR < cost) return `Fondi statali insufficienti (${cost} EUR richiesti).`;
      }
      return null;
    },
    execute: async (region, params) => {
      const bt = params.buildingType;
      const cost = AUTONOMY_CONFIG.BUILDING_COSTS[bt];
      const targetId = params.targetRegionId || region.id;
      const { data: targetRegion } = await supabase.from('regions').select('isAutonomous, regionalBudget').eq('id', targetId).single();
      // Deduct cost
      if (targetRegion?.isAutonomous) {
        await addRegionalBudgetTransaction(targetId, 'EXPENSE', 'BUILDING', -cost, `Costruzione ${BUILDING_LABELS[bt] || bt}`);
      } else {
        await supabase.rpc('add_budget_transaction', {
          p_owner_type: 'REGION', p_owner_id: region.id,
          p_type: 'EXPENSE', p_subtype: 'BUILDING',
          p_money_delta: -cost, p_metadata: { building: bt, targetRegion: targetId },
        });
      }
      // Upsert building
      const { data: existing } = await supabase.from('regional_buildings')
        .select('quantity').eq('regionId', targetId).eq('buildingType', bt).maybeSingle();
      if (existing) {
        await supabase.from('regional_buildings')
          .update({ quantity: (existing.quantity || 0) + 1, updatedAt: new Date().toISOString() })
          .eq('regionId', targetId).eq('buildingType', bt);
      } else {
        await supabase.from('regional_buildings').insert({
          regionId: targetId, buildingType: bt, quantity: 1, level: 1,
        });
      }
      // Recalculate indices
      await recalculateRegionStats(targetId);
    }
  },
  assign_governor: {
    category: "Autonomie Regionali",
    icon: "UserCheck",
    title: "Nomina Governatore",
    description: "Assegna un governatore a una regione autonoma.",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region, params) => {
      if (!params.targetRegionId) return "ID regione obbligatorio.";
      if (!params.governorUserId) return "ID governatore obbligatorio.";
      const { data: target } = await supabase.from('regions').select('isAutonomous').eq('id', params.targetRegionId).single();
      if (!target?.isAutonomous) return "La regione non è autonoma.";
      const { data: user } = await supabase.from('users').select('id').eq('id', params.governorUserId).single();
      if (!user) return "Utente non trovato.";
      return null;
    },
    execute: async (region, params) => {
      await supabase.from('regions').update({
        governorPlayerId: params.governorUserId,
      }).eq('id', params.targetRegionId);
    }
  }
};

// ══════════════════════════════════════════════════════════════════
// ██ EXTRACTION SYSTEM – SERVICES
// ══════════════════════════════════════════════════════════════════

// ── ResourceCoefficientService ──────────────────────────────────
// Calculates the resource coefficient used in the productivity formula.
// For base regional resources (gold, oil, minerals, uranium, diamonds):
//   coeff = regionMaxCap (incl. deep) * multiplier
// For energy resources (liquid_oxygen, helium3):
//   coeff = pow(numPowerPlants * ENERGY_RESOURCE_MULTIPLIER, ENERGY_RESOURCE_EXPONENT)
function getResourceCoefficient(
  resourceType: string,
  regionMaxCapIncludingDeep: number,
  numPowerPlants: number = 0
): number {
  const cfg = EXTRACTION_CONFIG;
  const mult = cfg.RESOURCE_COEFF_MULTIPLIERS[resourceType];

  if (resourceType === 'liquid_oxygen' || resourceType === 'helium3') {
    const base = Math.max(1, numPowerPlants) * cfg.ENERGY_RESOURCE_MULTIPLIER;
    return Math.pow(base, cfg.ENERGY_RESOURCE_EXPONENT);
  }

  // Fallback 0.5 is a safe default for unconfigured resources (e.g. rivalium)
  // to ensure the coefficient is always positive.
  return Math.max(1, regionMaxCapIncludingDeep * (mult || 0.5));
}

// ── ExtractionProductivityService ───────────────────────────────
// Implements the full productivity pipeline and returns a detailed breakdown.
function normalizeRegionHealthIndex(rawHealthIndex: unknown): number {
  const parsed = Number(rawHealthIndex);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, parsed);
}

function getGoldDigRewardByHealth(rawHealthIndex: unknown): {
  healthIndex: number;
  baseGoldReward: number;
  healthMultiplier: number;
  goldReward: number;
} {
  const healthIndex = normalizeRegionHealthIndex(rawHealthIndex);
  const baseGoldReward = Math.max(1, Math.floor(Number(EXTRACTION_CONFIG.GOLD_BASE_REWARD_PER_DIG) || 30));
  const healthBonusPerLevel = Math.max(0, Number(EXTRACTION_CONFIG.GOLD_HEALTH_BONUS_PER_LEVEL) || 0);
  const healthMultiplier = 1 + Math.max(0, healthIndex - 1) * healthBonusPerLevel;
  const goldReward = Math.max(baseGoldReward, Math.round(baseGoldReward * healthMultiplier));

  return {
    healthIndex,
    baseGoldReward,
    healthMultiplier,
    goldReward,
  };
}

function calculateExtraction(params: {
  playerLevel: number;
  factoryLevel: number;
  workExperience: number;
  resourceType: string;
  resourceCoefficient: number;
  departmentBonusLevel: number;
  nationBonusEnabled: boolean;
  taxRate: number;           // percentage (0-100)
  ownerProfitRate: number;   // fraction (0-1)
  autonomySharePercent: number; // percentage (0-100) of tax going to autonomy
  regionCapMax: number;
  regionDeepBonus: number;
  regionCapTotal: number;
  regionResidualToday: number;
  regionHealthIndex: number;
}): ExtractionBreakdown {
  const cfg = EXTRACTION_CONFIG;

  // Ensure minimum values to avoid degenerate outputs
  const pLvl = Math.max(1, params.playerLevel);
  const fLvl = Math.max(1, params.factoryLevel);
  const wExp = Math.max(cfg.MIN_WORK_EXPERIENCE, params.workExperience);
  const rCoeff = Math.max(0.01, params.resourceCoefficient);
  const experienceMultiplier = getWorkExperienceMultiplier(wExp);

  // 1. Base productivity
  const baseProductivity =
    cfg.BASE_COEFFICIENT
    * Math.pow(pLvl, cfg.PLAYER_LEVEL_EXPONENT)
    * Math.pow(rCoeff / cfg.RESOURCE_COEFF_DIVISOR, cfg.RESOURCE_COEFF_EXPONENT)
    * Math.pow(fLvl, cfg.FACTORY_LEVEL_EXPONENT);

  // 2. Nation bonus
  const nationBonus = (cfg.NATION_BONUS_ENABLED && params.nationBonusEnabled)
    ? cfg.NATION_BONUS_MULTIPLIER : 1.0;

  // 3. Department bonus
  const departmentBonus = cfg.DEPARTMENT_BONUS_ENABLED
    ? (1 + params.departmentBonusLevel / 100)
    : 1.0;

  // 4. Balancing multiplier
  const balancingMultiplier = cfg.BALANCING_MULTIPLIERS[params.resourceType] ?? 1;

  // 5. Final productivity
  const finalProductivity = baseProductivity * experienceMultiplier * nationBonus * departmentBonus * balancingMultiplier;

  // 6. Regional consumption
  const consumptionCfg = cfg.CONSUMPTION_COEFFICIENTS[params.resourceType] || { linearCoeff: 200000, baseOffset: 20000000 };
  const regionalConsumptionCoeff = (consumptionCfg.linearCoeff * fLvl) + consumptionCfg.baseOffset;
  const withdrawnPoints = regionalConsumptionCoeff > 0 ? finalProductivity / regionalConsumptionCoeff : 0;

  // 7. Gross amount is the final productivity value
  const grossAmount = finalProductivity;

  // 8. Tax and distribution
  const taxFraction = params.taxRate / 100;
  const taxAmount = grossAmount * taxFraction;
  const ownerAmount = grossAmount * params.ownerProfitRate;
  const playerAmount = Math.max(0, grossAmount - taxAmount - ownerAmount);
  const autonomyFraction = params.autonomySharePercent / 100;
  const autonomyAmount = taxAmount * autonomyFraction;
  const stateAmount = taxAmount - autonomyAmount;

  // 9. Gold special: money + premium-gold reward
  let moneyGenerated = 0;
  let goldGenerated = 0;
  let goldBaseReward = Math.max(1, Math.floor(Number(cfg.GOLD_BASE_REWARD_PER_DIG) || 30));
  let goldHealthMultiplier = 1;
  const normalizedRegionHealth = normalizeRegionHealthIndex(params.regionHealthIndex);
  if (params.resourceType === 'gold_ore') {
    moneyGenerated = playerAmount * cfg.GOLD_TO_MONEY_COEFFICIENT;
    const goldRewardData = getGoldDigRewardByHealth(normalizedRegionHealth);
    goldGenerated = goldRewardData.goldReward;
    goldBaseReward = goldRewardData.baseGoldReward;
    goldHealthMultiplier = goldRewardData.healthMultiplier;
  }

  return {
    playerLevel: pLvl,
    factoryLevel: fLvl,
    workExperience: wExp,
    experienceMultiplier,
    resourceCoefficient: rCoeff,
    resourceType: params.resourceType as ResourceType,
    baseProductivity,
    nationBonus,
    departmentBonus,
    balancingMultiplier,
    finalProductivity,
    regionalConsumptionCoeff,
    withdrawnPoints,
    grossAmount,
    playerAmount,
    ownerAmount,
    taxAmount,
    stateAmount,
    autonomyAmount,
    moneyGenerated,
    goldGenerated,
    goldBaseReward,
    goldHealthMultiplier,
    regionHealthIndex: normalizedRegionHealth,
    regionCapMax: params.regionCapMax,
    regionDeepBonus: params.regionDeepBonus,
    regionCapTotal: params.regionCapTotal,
    regionResidualToday: params.regionResidualToday,
  };
}

// ── RegionalConsumptionService ──────────────────────────────────
function getRegionalConsumptionCoefficient(resourceType: string, factoryLevel: number): number {
  const cfg = EXTRACTION_CONFIG.CONSUMPTION_COEFFICIENTS[resourceType] || { linearCoeff: 200000, baseOffset: 20000000 };
  return (cfg.linearCoeff * Math.max(1, factoryLevel)) + cfg.baseOffset;
}

// ── WorkExperienceService ───────────────────────────────────────
function getWorkExperienceMultiplier(workXp: number): number {
  const normalizedXp = Math.max(EXTRACTION_CONFIG.MIN_WORK_EXPERIENCE, Math.floor(Number(workXp) || 0));
  return 1 + (normalizedXp / EXTRACTION_CONFIG.WORK_EXPERIENCE_MULTIPLIER_DIVISOR);
}

function getWorkExperienceGainForEnergyCost(energyCost: number): number {
  const fullWorkCycles = Math.floor(Math.max(0, Number(energyCost) || 0) / GAME_CONFIG.ENERGY_MAX);
  return fullWorkCycles * EXTRACTION_CONFIG.WORK_EXPERIENCE_GAIN_PER_FULL_CYCLE;
}

function getMaxWorkXpPerResource(educationLevel: number): number {
  const normalizedEducationLevel = Math.max(0, Math.floor(Number(educationLevel) || 0));
  // Mandatory rule: maxWorkXpPerResource = 2000 + (educationLevel * 1000)
  return 2000 + (normalizedEducationLevel * 1000);
}

async function getPlayerWorkExperience(
  playerId: string,
  resourceType: string,
  maxExperience?: number
): Promise<number> {
  const { data } = await supabase
    .from('player_resource_work_experience')
    .select('experience')
    .eq('playerId', playerId)
    .eq('resourceType', resourceType)
    .maybeSingle();

  const raw = Math.max(EXTRACTION_CONFIG.MIN_WORK_EXPERIENCE, Math.floor(Number(data?.experience) || 0));
  if (typeof maxExperience === 'number' && Number.isFinite(maxExperience)) {
    return Math.min(Math.max(EXTRACTION_CONFIG.MIN_WORK_EXPERIENCE, Math.floor(maxExperience)), raw);
  }
  return raw;
}

async function incrementPlayerWorkExperience(
  playerId: string,
  resourceType: string,
  gain: number,
  educationLevel: number = 0
): Promise<{ appliedGain: number; experience: number; maxExperience: number }> {
  const normalizedGain = Math.max(0, Math.floor(Number(gain) || 0));
  const maxExperience = getMaxWorkXpPerResource(educationLevel);
  if (normalizedGain <= 0) {
    const currentExperience = await getPlayerWorkExperience(playerId, resourceType, maxExperience);
    return {
      appliedGain: 0,
      experience: currentExperience,
      maxExperience,
    };
  }

  const { data: existing } = await supabase
    .from('player_resource_work_experience')
    .select('experience, totalExtractions')
    .eq('playerId', playerId)
    .eq('resourceType', resourceType)
    .maybeSingle();

  if (existing) {
    const currentExperience = Math.max(EXTRACTION_CONFIG.MIN_WORK_EXPERIENCE, Math.floor(Number(existing.experience) || 0));
    const nextExperience = Math.min(maxExperience, currentExperience + normalizedGain);
    const appliedGain = Math.max(0, nextExperience - currentExperience);
    await supabase.from('player_resource_work_experience').update({
      experience: nextExperience,
      totalExtractions: Math.max(0, Math.floor(Number(existing.totalExtractions) || 0)) + 1,
      lastWorkedAt: new Date().toISOString(),
    }).eq('playerId', playerId).eq('resourceType', resourceType);
    return {
      appliedGain,
      experience: nextExperience,
      maxExperience,
    };
  } else {
    const nextExperience = Math.min(maxExperience, normalizedGain);
    await supabase.from('player_resource_work_experience').insert({
      playerId,
      resourceType,
      experience: nextExperience,
      totalExtractions: 1,
      lastWorkedAt: new Date().toISOString(),
    });
    return {
      appliedGain: nextExperience,
      experience: nextExperience,
      maxExperience,
    };
  }
}

// ── Helper: Get power plants count for a region ─────────────────
async function getRegionPowerPlants(regionId: string): Promise<number> {
  const { data } = await supabase
    .from('regional_buildings')
    .select('quantity')
    .eq('regionId', regionId)
    .eq('buildingType', 'power_plant')
    .maybeSingle();
  return data?.quantity || 0;
}

// ── Helper: Get department bonus for a region+resource ──────────
async function getDepartmentBonus(regionId: string, resourceType: string): Promise<number> {
  const { data } = await supabase
    .from('resource_department_bonuses')
    .select('bonusLevel')
    .eq('regionId', regionId)
    .eq('resourceType', resourceType)
    .maybeSingle();
  return data?.bonusLevel || 0;
}

// ══════════════════════════════════════════════════════════════════
// ██ REGIONAL RESOURCES SYSTEM
// ══════════════════════════════════════════════════════════════════

// Helper: read a single game_settings value
async function getSetting(key: string): Promise<any> {
  const { data } = await supabase.from('game_settings').select('value').eq('key', key).single();
  return data?.value;
}

// Helper: get nation_id for a region
async function getNationForRegion(regionId: string): Promise<string | null> {
  const { data } = await supabase.from('regions').select('nation_id').eq('id', regionId).single();
  return data?.nation_id ?? null;
}

// Helper: get active Deep Exploration for nation+resource
async function getActiveDeep(nationId: string, resourceType: string, now?: Date) {
  const nowStr = (now || new Date()).toISOString();
  const { data } = await supabase
    .from('deep_explorations')
    .select('*')
    .eq('nationId', nationId)
    .eq('resourceType', resourceType)
    .eq('isActive', true)
    .lte('startsAt', nowStr)
    .gte('endsAt', nowStr)
    .limit(1)
    .maybeSingle();
  return data;
}

// Helper: compute effective cap
function computeEffectiveCap(baseCap: number, deep: any, capMaxGlobal: number): number {
  if (!deep) return Math.min(baseCap, capMaxGlobal);
  const targetCap = deep.targetCap || baseCap;
  return Math.min(capMaxGlobal, Math.max(baseCap, targetCap));
}

// Helper: compute Deep Exploration cost
async function computeDeepCost(nationId: string, resourceType: string, level: number): Promise<DeepCostPreview> {
  // Get deep level config from cache
  const cachedLevels = await getCachedDeepLevels();
  const deepLevel = cachedLevels.find((l: any) => l.level === level);

  if (!deepLevel) throw new Error("Livello Deep non valido o disabilitato.");

  const targetCap = deepLevel.targetCap;
  const capTargetMaxRecommended = parseInt(await getSetting('cap_target_max_recommended')) || 637;
  const capMaxGlobal = parseInt(await getSetting('cap_max_global')) || 2000;

  if (targetCap > Math.min(capTargetMaxRecommended, capMaxGlobal)) {
    throw new Error("targetCap supera il limite consentito.");
  }

  // Get all regions for this nation
  const { data: regions } = await supabase
    .from('regions')
    .select('id')
    .eq('nation_id', nationId);

  if (!regions || regions.length === 0) throw new Error("Nessuna regione trovata per questa nazione.");

  const regionIds = regions.map((r: any) => r.id);

  // Get region_resources for this resource type in all regions
  const { data: regionResources } = await supabase
    .from('region_resources')
    .select('regionId, baseCapPerRecharge')
    .in('regionId', regionIds)
    .eq('resourceType', resourceType);

  const N = regionResources?.length || 0;
  if (N === 0) throw new Error("Nessuna regione ha questa risorsa configurata.");

  // Compute deltas
  let sumDelta = 0;
  let sumBaseCap = 0;
  for (const rr of regionResources!) {
    const delta = Math.max(0, targetCap - rr.baseCapPerRecharge);
    sumDelta += delta;
    sumBaseCap += rr.baseCapPerRecharge;
  }
  const avgDelta = sumDelta / N;
  const avgBaseCap = sumBaseCap / N;

  // Read cost settings
  const baseCostDiamonds = parseInt(await getSetting('deep_base_cost_diamonds')) || 500;
  const baseCostEur = parseInt(await getSetting('deep_base_cost_eur')) || 100000;
  const baseCostGold = parseInt(await getSetting('deep_base_cost_gold')) || 0;
  const perDeltaDiamonds = parseFloat(await getSetting('deep_cost_per_delta_diamonds')) || 2;
  const perDeltaEur = parseFloat(await getSetting('deep_cost_per_delta_eur')) || 500;
  const perDeltaGold = parseFloat(await getSetting('deep_cost_per_delta_gold')) || 0;
  const perRegionDiamonds = parseInt(await getSetting('deep_cost_per_region_diamonds')) || 50;
  const perRegionEur = parseInt(await getSetting('deep_cost_per_region_eur')) || 10000;
  const perRegionGold = parseInt(await getSetting('deep_cost_per_region_gold')) || 0;
  const discountStrength = parseFloat(await getSetting('deep_cost_cap_discount_strength')) || 0;

  // Calculate raw costs
  let costDiamonds = Math.round(baseCostDiamonds + (sumDelta * perDeltaDiamonds) + (N * perRegionDiamonds));
  let costEur = Math.round(baseCostEur + (sumDelta * perDeltaEur) + (N * perRegionEur));
  let costGold = Math.round(baseCostGold + (sumDelta * perDeltaGold) + (N * perRegionGold));

  // Optional discount based on avg base cap
  if (discountStrength > 0 && targetCap > 0) {
    let discountFactor = 1 - discountStrength * (avgBaseCap / targetCap);
    discountFactor = Math.max(0.6, Math.min(1.0, discountFactor));
    costDiamonds = Math.round(costDiamonds * discountFactor);
    costEur = Math.round(costEur * discountFactor);
    costGold = Math.round(costGold * discountFactor);
  }

  // Clamp minimums
  costDiamonds = Math.max(baseCostDiamonds, costDiamonds);
  costEur = Math.max(baseCostEur, costEur);
  costGold = Math.max(baseCostGold, costGold);

  return {
    targetCap,
    numRegions: N,
    sumDelta,
    avgDelta: Math.round(avgDelta * 100) / 100,
    costDiamonds,
    costEur,
    costGold,
  };
}

// ══════════════════════════════════════════════════════════════════
// ██ ADVANCED EXTRACTION SYSTEM ENDPOINTS
// ══════════════════════════════════════════════════════════════════

async function executeExtractionWork(
  user: any,
  factoryId: string,
  options?: { allowAutoDrink?: boolean; energyCostOverride?: number }
) {
  const fail = (statusCode: number, message: string, reason?: string) => {
    const err: any = createAutomationError(statusCode, message);
    if (reason) err.reason = reason;
    throw err;
  };

  let workingUser = user;
  if (!workingUser?.id) fail(404, "Utente non trovato.");

  const { data: factory, error: fErr } = await supabase
    .from('factories')
    .select('id, type, regionId, level, isActive, payMode, ownerUserId, minLevel, totalWorkerCount, totalProduction, totalOwnerProfit, totalTaxesPaid')
    .eq('id', factoryId)
    .single();

  if (fErr || !factory) fail(404, "Fabbrica non trovata.");
  if (factory.isActive === false) fail(400, "Fabbrica non attiva.");
  const factoryMinLevel = factory.minLevel ?? 1;
  if ((workingUser.level || 0) < factoryMinLevel) fail(400, `Richiede livello ${factoryMinLevel}.`);

  const factoryType = factory.type || '';
  const typeDef = FACTORY_CONFIG.TYPES[factoryType];
  if (!typeDef) fail(400, "Tipo fabbrica non valido.");

  const resourceType = typeDef.resource;
  if (!resourceType) fail(400, "Questa fabbrica non produce risorse estraibili.");
  if (String(factory.payMode || '').toLowerCase() !== 'resource') {
    fail(400, "Questa fabbrica non e in Modalita Risorse.", "resource_mode_required");
  }

  const regionId = factory.regionId;
  if ((workingUser.regionId || '') !== regionId) {
    fail(400, "Devi viaggiare in questa regione per lavorare qui.", "travel_required");
  }

  const { data: regionRel } = await supabase.from('regions')
    .select('id, workRestrictions, marketTaxRate, industryTaxPercent, regionalProfitSharePercent, isAutonomous, nation_id, healthIndex')
    .eq('id', regionId).single();
  if (!regionRel) fail(404, "Regione non trovata.");

  const restrictionsActive = regionRel.workRestrictions === 1;
  const isResident = workingUser.residenceId === regionId;
  let hasWorkPermit = workingUser.workPermitId === regionId;
  if (!hasWorkPermit) {
    try {
      const { data: permitRow } = await supabase.from('work_permits')
        .select('id')
        .eq('userId', workingUser.id)
        .eq('regionId', regionId)
        .maybeSingle();
      hasWorkPermit = !!permitRow;
    } catch { /* optional table */ }
  }
  if (restrictionsActive && !isResident && !hasWorkPermit && workingUser.id !== factory.ownerUserId) {
    fail(403, "Questa nazione richiede un Permesso di Lavoro.");
  }

  const perks = workingUser.perks || await getUserPerks(workingUser.id);
  const actualEnergyCost = resolveExtractionEnergyCost(
    EXTRACTION_CONFIG.WORK_ACTION_ENERGY_COST,
    perks['RESISTENZA'] || 0,
    options?.energyCostOverride
  );
  if ((workingUser.energy || 0) < actualEnergyCost && options?.allowAutoDrink) {
    const drank = await tryUseEnergyDrinkForUser(workingUser.id);
    if (drank) {
      const { data: refreshedUser } = await supabase.from('users')
        .select('id, energy, level, regionId, residenceId, workPermitId')
        .eq('id', workingUser.id).single();
      if (refreshedUser) {
        workingUser = { ...workingUser, ...refreshedUser, perks };
      }
    }
  }
  if ((workingUser.energy || 0) < actualEnergyCost) {
    fail(400, "Energia insufficiente.", "no_energy");
  }

  const { data: regionRes } = await supabase
    .from('region_resources')
    .select('regionId, resourceType, dailyMaxCap, currentAvailableCap, dailyExtracted, baseCapPerRecharge')
    .eq('regionId', regionId)
    .eq('resourceType', resourceType)
    .maybeSingle();

  const dailyMaxCap = regionRes?.dailyMaxCap ?? 999999;
  const currentAvailableCap = regionRes?.currentAvailableCap ?? 999999;
  const dailyExtracted = regionRes?.dailyExtracted ?? 0;
  if (currentAvailableCap <= 0 && regionRes) {
    fail(400, "Cap disponibile esaurito. Attendere la ricarica del Ministro dell'Economia.", "daily_exhausted");
  }

  const nationId = await getNationForRegion(regionId);
  const capMaxGlobal = parseInt(await getSetting('cap_max_global')) || 2000;
  const deep = nationId ? await getActiveDeep(nationId, resourceType) : null;
  const baseCap = regionRes?.baseCapPerRecharge ?? REGION_RESOURCE_CAPS_BY_TYPE[resourceType as ResourceType] ?? 200;
  const effectiveCap = computeEffectiveCap(baseCap, deep, capMaxGlobal);
  const deepBonus = deep ? Math.max(0, (deep.targetCap || 0) - baseCap) : 0;

  const maxWorkExperience = getMaxWorkXpPerResource(perks['ISTRUZIONE'] || 0);
  const [workExp, numPowerPlants, departmentBonus] = await Promise.all([
    getPlayerWorkExperience(workingUser.id, resourceType, maxWorkExperience),
    getRegionPowerPlants(regionId),
    getDepartmentBonus(regionId, resourceType),
  ]);

  const resourceCoefficient = getResourceCoefficient(resourceType, effectiveCap, numPowerPlants);

  const taxRate = regionRel.marketTaxRate ?? regionRel.industryTaxPercent ?? FACTORY_CONFIG.DEFAULT_INDUSTRY_TAX_RATE;
  const ownerProfitRate = FACTORY_CONFIG.OWNER_PROFIT_RATE;
  const autonomySharePercent = regionRel.regionalProfitSharePercent ?? 0;

  const breakdown = calculateExtraction({
    playerLevel: workingUser.level || 1,
    factoryLevel: factory.level || 1,
    workExperience: workExp,
    resourceType,
    resourceCoefficient,
    departmentBonusLevel: departmentBonus,
    nationBonusEnabled: true,
    taxRate,
    ownerProfitRate,
    autonomySharePercent,
    regionCapMax: baseCap,
    regionDeepBonus: deepBonus,
    regionCapTotal: effectiveCap,
    regionResidualToday: currentAvailableCap,
    regionHealthIndex: regionRel.healthIndex || 1,
  });

  const { data: playerState } = await supabase
    .from('player_extraction_state')
    .select('extractedSinceLastRecharge')
    .eq('playerId', workingUser.id)
    .eq('regionId', regionId)
    .eq('resourceType', resourceType)
    .maybeSingle();

  const extractedSoFar = playerState?.extractedSinceLastRecharge || 0;
  const remainingCycle = Math.max(0, effectiveCap - extractedSoFar);

  const actualPlayerAmount = Math.min(breakdown.playerAmount, remainingCycle, currentAvailableCap);
  if (actualPlayerAmount < EXTRACTION_CONFIG.MIN_EXTRACTION_THRESHOLD) {
    const reason = remainingCycle <= 0 ? "cycle_cap_reached" : "daily_exhausted";
    fail(
      400,
      reason === "cycle_cap_reached"
        ? "Cap del ciclo raggiunto. Serve una ricarica amministrativa."
        : "Risorsa giornaliera esaurita.",
      reason
    );
  }

  const scaleFactor = actualPlayerAmount / Math.max(EXTRACTION_CONFIG.MIN_EXTRACTION_THRESHOLD, breakdown.playerAmount);
  const actualGross = breakdown.grossAmount * scaleFactor;
  const actualOwner = breakdown.ownerAmount * scaleFactor;
  const actualTax = breakdown.taxAmount * scaleFactor;
  const actualState = breakdown.stateAmount * scaleFactor;
  const actualAutonomy = breakdown.autonomyAmount * scaleFactor;
  const actualWithdrawn = breakdown.withdrawnPoints * scaleFactor;
  const actualMoney = breakdown.moneyGenerated * scaleFactor;
  const actualGold = resourceType === 'gold_ore' ? Math.max(0, Math.floor(Number(breakdown.goldGenerated) || 0)) : 0;

  // Validate before touching any balances
  const roundedPlayer = Math.round(actualPlayerAmount);
  if (roundedPlayer <= 0) {
    fail(400, "Produttività insufficiente per estrarre.", "insufficient_productivity");
  }

  const { data: deductData, error: deductErr } = await supabase.rpc('safe_deduct_currency', {
    p_user_id: workingUser.id,
    p_money_cost: resourceType === 'gold_ore' ? -Math.round(actualMoney) : 0,
    p_gold_cost: resourceType === 'gold_ore' ? -actualGold : 0,
    p_energy_cost: actualEnergyCost,
  });
  if (deductErr) throw deductErr;
  const parsedDeduct = typeof deductData === 'string' ? JSON.parse(deductData) : deductData;
  if (parsedDeduct?.error) fail(400, parsedDeduct.error);

  if (regionRes) {
    const newDailyExtracted = Math.min(dailyMaxCap, dailyExtracted + roundedPlayer);
    await supabase.from('region_resources').update({
      dailyExtracted: newDailyExtracted,
      currentAvailableCap: Math.max(0, currentAvailableCap - roundedPlayer),
      updatedAt: new Date().toISOString(),
    }).eq('regionId', regionId).eq('resourceType', resourceType);
  }

  const newExtracted = extractedSoFar + roundedPlayer;
  if (playerState) {
    await supabase.from('player_extraction_state').update({
      extractedSinceLastRecharge: newExtracted,
      updatedAt: new Date().toISOString(),
    }).eq('playerId', workingUser.id).eq('regionId', regionId).eq('resourceType', resourceType);
  } else {
    await supabase.from('player_extraction_state').insert({
      playerId: workingUser.id,
      regionId,
      resourceType,
      extractedSinceLastRecharge: roundedPlayer,
      updatedAt: new Date().toISOString(),
    });
  }

  const { data: existingInv } = await supabase.from('user_inventory')
    .select('quantity').eq('userId', workingUser.id).eq('itemId', resourceType).maybeSingle();
  if (existingInv) {
    await supabase.from('user_inventory')
      .update({ quantity: existingInv.quantity + roundedPlayer })
      .eq('userId', workingUser.id).eq('itemId', resourceType);
  } else {
    await supabase.from('user_inventory')
      .insert({ userId: workingUser.id, itemId: resourceType, quantity: roundedPlayer });
  }

  // Gold+cash already handled atomically above together with energy deduction.

  if (Math.round(actualOwner) > 0) {
    await supabase.rpc('increment_factory_storage', {
      p_factory_id: factoryId,
      p_amount: Math.round(actualOwner)
    });
  }

  if (Math.round(actualTax) > 0) {
    const taxMoney = Math.round(actualTax * (FACTORY_CONFIG.RESOURCE_VALUES[resourceType] || 1));
    if (taxMoney > 0) {
      await supabase.rpc('add_budget_transaction', {
        p_owner_type: 'REGION',
        p_owner_id: regionId,
        p_type: 'INCOME',
        p_subtype: 'EXTRACTION_TAX',
        p_money_delta: taxMoney,
        p_created_by: workingUser.id,
        p_metadata: { resourceType, factoryId, grossAmount: actualGross, taxAmount: actualTax },
      });
    }
  }

  const requestedWorkExpGain = getWorkExperienceGainForEnergyCost(actualEnergyCost);
  const cappedRequestedGain = workExp >= maxWorkExperience ? 0 : requestedWorkExpGain;
  const workExpUpdate = await incrementPlayerWorkExperience(workingUser.id, resourceType, cappedRequestedGain, perks['ISTRUZIONE'] || 0);

  const xpGain = GAME_CONFIG.XP_PER_WORK + (perks['ISTRUZIONE'] || 0) * 2;
  await addXP(workingUser.id, xpGain);

  await supabase.from('extraction_detailed_logs').insert({
    playerId: workingUser.id,
    regionId,
    factoryId: factory.id,
    resourceType,
    grossAmount: actualGross,
    playerAmount: roundedPlayer,
    ownerAmount: Math.round(actualOwner),
    taxAmount: Math.round(actualTax),
    stateAmount: Math.round(actualState),
    autonomyAmount: Math.round(actualAutonomy),
    moneyGenerated: Math.round(actualMoney),
    withdrawnPoints: actualWithdrawn,
    playerLevel: workingUser.level || 1,
    factoryLevel: factory.level || 1,
    workExperience: workExp,
    resourceCoefficient: resourceCoefficient,
    finalProductivity: breakdown.finalProductivity,
  });

  const extractionLogPayload = {
    playerId: workingUser.id,
    regionId,
    resourceType,
    amount: roundedPlayer,
    goldGenerated: actualGold,
  };
  const { error: extractionLogError } = await supabase.from('resource_extraction_logs').insert(extractionLogPayload);
  if (extractionLogError) {
    if (/goldGenerated/i.test(String(extractionLogError.message || ''))) {
      const { error: legacyExtractionLogError } = await supabase.from('resource_extraction_logs').insert({
        playerId: workingUser.id,
        regionId,
        resourceType,
        amount: roundedPlayer,
      });
      if (legacyExtractionLogError) {
        throw legacyExtractionLogError;
      }
    } else {
      throw extractionLogError;
    }
  }

  await supabase.from('factories').update({
    totalWorkerCount: (factory.totalWorkerCount || 0) + 1,
    totalProduction: (factory.totalProduction || 0) + roundedPlayer,
    totalOwnerProfit: (factory.totalOwnerProfit || 0) + Math.round(actualOwner),
    totalTaxesPaid: (factory.totalTaxesPaid || 0) + Math.round(actualTax),
  }).eq('id', factory.id);

  return {
    success: true,
    amount: roundedPlayer,
    resourceType,
    moneyGenerated: Math.round(actualMoney),
    goldGenerated: actualGold,
    remainingCycle: Math.max(0, remainingCycle - roundedPlayer),
    remainingDaily: Math.max(0, currentAvailableCap - roundedPlayer),
    xpGain,
    energyCost: actualEnergyCost,
    workExperience: workExp + workExpUpdate.appliedGain,
    workExpGain: workExpUpdate.appliedGain,
    maxWorkExperience,
    experienceMultiplier: breakdown.experienceMultiplier,
    breakdown: {
      baseProductivity: Math.round(breakdown.baseProductivity * 100) / 100,
      experienceMultiplier: Math.round(breakdown.experienceMultiplier * 1000) / 1000,
      nationBonus: breakdown.nationBonus,
      departmentBonus: breakdown.departmentBonus,
      balancingMultiplier: breakdown.balancingMultiplier,
      finalProductivity: Math.round(breakdown.finalProductivity * 100) / 100,
      grossAmount: Math.round(actualGross * 100) / 100,
      playerAmount: roundedPlayer,
      ownerAmount: Math.round(actualOwner),
      taxAmount: Math.round(actualTax),
      stateAmount: Math.round(actualState),
      autonomyAmount: Math.round(actualAutonomy),
      withdrawnPoints: Math.round(actualWithdrawn * 100) / 100,
      resourceCoefficient: Math.round(resourceCoefficient * 100) / 100,
      moneyGenerated: Math.round(actualMoney),
      goldGenerated: actualGold,
      goldBaseReward: breakdown.goldBaseReward,
      goldHealthMultiplier: Math.round(breakdown.goldHealthMultiplier * 1000) / 1000,
      regionHealthIndex: breakdown.regionHealthIndex,
    },
  };
}

// ── State Salaries Payout Logic ──────────────────────
async function payoutStateSalaries() {
  try {
    console.log("[Salaries] Starting daily state salaries payout...");
    
    // 1. Fetch all nations
    const { data: nations, error: nationsError } = await retrySupabaseOperation(
      "fetch nations for salary payout",
      async () => await supabase
        .from('nations')
        .select('id, government_form, leaderUserId, gold_reserve')
    );
    
    if (nationsError || !nations) {
      console.error("[Salaries] Error fetching nations:", nationsError);
      return;
    }

    // 2. Count regions per nation
    const { data: regionalCounts } = await retrySupabaseOperation(
      "fetch regional counts for salary payout",
      async () => await supabase
        .from('regions')
        .select('nation_id')
        .not('nation_id', 'is', null)
    );
    
    const regionCountMap: Record<string, number> = {};
    regionalCounts?.forEach(r => {
      if (r.nation_id) regionCountMap[r.nation_id] = (regionCountMap[r.nation_id] || 0) + 1;
    });

    for (const nation of nations) {
      const count = regionCountMap[nation.id] || 0;
      if (count === 0) continue;

      const salaries = calculateStateSalaries(nation.government_form, count);
      let currentReserve = nation.gold_reserve || 0;

      // Pay Head of State
      if (nation.leaderUserId && salaries.headOfStateGold > 0) {
        if (currentReserve >= salaries.headOfStateGold) {
           // Direct update to user gold balance
           const { data: user } = await retrySupabaseOperation(
             `fetch head of state balance for ${nation.id}`,
             async () => await supabase.from('users').select('gold').eq('id', nation.leaderUserId).single()
           );
           if (user) {
             await retrySupabaseOperation(
               `pay head of state salary for ${nation.id}`,
               async () => await supabase.from('users').update({ gold: (user.gold || 0) + salaries.headOfStateGold }).eq('id', nation.leaderUserId)
             );
             currentReserve -= salaries.headOfStateGold;
             console.log(`[Salaries] Paid ${salaries.headOfStateGold} gold to HOS of ${nation.id}`);
           }
        } else {
           console.warn(`[Salaries] Nation ${nation.id} insufficient gold for HOS salary`);
        }
      }

      // Pay Ministers
      const { data: ministers } = await retrySupabaseOperation(
        `fetch ministers for ${nation.id}`,
        async () => await supabase
          .from('ministers')
          .select(`
            userId,
            user:users(id, gold)
          `)
          .eq('stateId', nation.id)
          .eq('status', 'ACTIVE')
      );

      if (ministers && ministers.length > 0 && salaries.ministerGold > 0) {
        for (const m of ministers) {
          if (currentReserve >= salaries.ministerGold && (m as any).user) {
            const userGold = (m as any).user.gold || 0;
            await retrySupabaseOperation(
              `pay minister salary for ${nation.id}:${m.userId}`,
              async () => await supabase.from('users').update({ gold: userGold + salaries.ministerGold }).eq('id', m.userId)
            );
            currentReserve -= salaries.ministerGold;
            console.log(`[Salaries] Paid ${salaries.ministerGold} gold to Minister ${m.userId} of ${nation.id}`);
          }
        }
      }

      // Update remaining nation reserve
      if (currentReserve !== nation.gold_reserve) {
        await retrySupabaseOperation(
          `update remaining gold reserve for ${nation.id}`,
          async () => await supabase.from('nations').update({ gold_reserve: currentReserve }).eq('id', nation.id)
        );
      }
    }
    console.log("[Salaries] Daily payout complete.");
  } catch (err) {
    console.error("[Salaries] Error in payoutStateSalaries:", {
      message: err instanceof Error ? err.message : String(err),
      details: (err as any)?.details || null,
      hint: (err as any)?.hint || null,
      code: (err as any)?.code || null,
      transientNetwork: isTransientSupabaseNetworkError(err),
    });
  }
}

// ── Daily Reset Cron (resource extraction) ──────────────────────
async function dailyResourceReset() {
  try {
    console.log("[ResourceReset] Running daily resource extraction reset...");
    // Reset dailyExtracted=0, currentAvailableCap=initialAvailableCap, totalUnlockedToday=initialAvailableCap
    const { error } = await retrySupabaseOperation(
      "reset daily resource caps",
      async () => await supabase.rpc('reset_daily_resource_caps')
    );

    if (error) console.error("[ResourceReset] Error resetting daily caps:", error);
    else console.log("[ResourceReset] Daily caps reset complete.");

    // Expire old deep explorations
    const nowStr = new Date().toISOString();
    await retrySupabaseOperation(
      "expire deep explorations during daily reset",
      async () => await supabase
        .from('deep_explorations')
        .update({ isActive: false })
        .eq('isActive', true)
        .lt('endsAt', nowStr)
    );

    // Reset regional autonomy daily extraction counters for regions that need reset
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { error: resetErr } = await retrySupabaseOperation(
      "reset regional extraction counters",
      async () => await supabase.from('regions').update({
        dailyExtractedGold: 0,
        dailyExtractedOil: 0,
        dailyExtractedMinerals: 0,
        dailyExtractedUranium: 0,
        dailyExtractedDiamonds: 0,
        nextExtractionResetAt: tomorrow,
      }).lte('nextExtractionResetAt', nowStr)
    ); // Only update regions whose daily reset is due
    if (resetErr) logger.error("ResourceReset: Error resetting regional extraction", { err: resetErr });
    else logger.info("ResourceReset: Regional extraction counters reset.");

    // Pay salaries at daily reset
    await payoutStateSalaries();

  } catch (err) {
    console.error("[ResourceReset] Error in daily reset:", {
      message: err instanceof Error ? err.message : String(err),
      details: (err as any)?.details || null,
      hint: (err as any)?.hint || null,
      code: (err as any)?.code || null,
      transientNetwork: isTransientSupabaseNetworkError(err),
    });
  }
}

// ══════════════════════════════════════════════════════════════════
async function checkAndResolveElections() {
  const { data: regions } = await supabase.from('regions').select('id, nation_id, territoryStatus, parliamentaryElectionStartedAt');
  if (!regions) return;

  const now = Date.now();
  const nowIso = new Date().toISOString();
  const DEFAULT_ELECTION_DURATION_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
  const INDEPENDENT_PARLIAMENT_DURATION_MS = 24 * 60 * 60 * 1000; // 24h

  const { data: activeElections } = await supabase.from('elections').select('*').eq('status', 'active').lte('closesAt', nowIso);
  const activeElectionByRegion = new Map(activeElections?.map((e: any) => [e.regionId, e]) || []);

  for (const r of regions) {
    const status = (r as any).territoryStatus as string | null | undefined;
    const isIndependentParliament = status === 'PARLIAMENTARY_ELECTION';

    // Guard: evita elezioni automatiche per regioni indipendenti non ancora in fase parlamentare
    const shouldHaveParliamentElections = !!(r as any).nation_id || ['PARLIAMENTARY_ELECTION', 'PRESIDENTIAL_ELECTION', 'STATE_ACTIVE'].includes(status || '');
    if (!shouldHaveParliamentElections) continue;

    const activeElection = activeElectionByRegion.get(r.id);
    const durationMs = isIndependentParliament ? INDEPENDENT_PARLIAMENT_DURATION_MS : DEFAULT_ELECTION_DURATION_MS;

    if (!activeElection) {
      const startBase = isIndependentParliament && (r as any).parliamentaryElectionStartedAt
        ? new Date((r as any).parliamentaryElectionStartedAt).getTime()
        : now;
      const closesAtIso = new Date(startBase + durationMs).toISOString();
      await supabase.from('elections').insert({
        id: generateSecureId(9),
        regionId: r.id,
        status: 'active',
        createdAt: nowIso,
        closesAt: closesAtIso
      });
    } else if (new Date(activeElection.closesAt).getTime() <= now) {
      // Resolve election
      await supabase.from('elections').update({ status: 'closed' }).eq('id', activeElection.id);

      const { data: partyVotes } = await supabase.rpc('get_election_votes_count', { p_election_id: activeElection.id });
      // Note: We need a helper RPC for complex grouping like this if we want it to be efficient.
      // Alternatively, we can fetch all and group in JS (less scalable but okay for small scale).

      // Let's assume we have our RPC or we use a more standard query.
      const totalVotes = partyVotes?.reduce((sum: number, pv: any) => sum + pv.count, 0) || 0;

      await supabase.from('parliament_members').delete().eq('regionId', r.id);

      if (totalVotes > 0) {
        const totalSeats = 20;
        for (const pv of (partyVotes || [])) {
          const wonSeats = Math.round((pv.count / totalVotes) * totalSeats);
          if (wonSeats > 0) {
            // Get top candidates from primaries for this party
            const cyclePeriodMs = 5 * 24 * 60 * 60 * 1000;
            const currentCycleStart = new Date(now - cyclePeriodMs).toISOString();

            const { data: candidates } = await supabase
              .from('party_primaries')
              .select('candidateId, count:candidateId.count()')
              .eq('partyId', pv.partyId)
              .gte('createdAt', currentCycleStart)
              .order('count', { ascending: false })
              .limit(wonSeats);

            let finalCandidates = candidates?.map((c: any) => c.candidateId) || [];

            if (finalCandidates.length < wonSeats) {
              const { data: fallback } = await supabase
                .from('party_members')
                .select('userId, users(level)')
                .eq('partyId', pv.partyId)
                .not('userId', 'in', `(${finalCandidates.join(',') || 'NULL'})`)
                .order('users(level)', { ascending: false })
                .limit(wonSeats - finalCandidates.length);

              if (fallback) {
                finalCandidates = [...finalCandidates, ...fallback.map((f: any) => f.userId)];
              }
            }

            for (const mpId of finalCandidates) {
              await supabase.from('parliament_members').insert({
                userId: mpId, regionId: r.id, partyId: pv.partyId, electedAt: nowIso
              });
            }
          }
        }
      }

      // Automatically scheduled by logic above (activeElection resolved, insertion happens next tick or we can insert now)
    }
  }
}

async function checkAndAdvanceIndependentRegions() {
  // State-machine per regioni indipendenti:
  // INDEPENDENT_REGION (>=24h + base politica) -> PARLIAMENTARY_ELECTION (24h) -> PRESIDENTIAL_ELECTION (24h) -> STATE_ACTIVE
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const MS_24H = 24 * 60 * 60 * 1000;

  try {
    // Filter to regions that need state-machine advancement (independent or in election)
    const { data: regions, error } = await supabase
      .from('regions')
      .select('id, name, nation_id, territoryStatus, independentAt, parliamentaryElectionStartedAt, presidentialElectionStartedAt, presidentialElectionClosesAt')
      .in('territoryStatus', ['INDEPENDENT_REGION', 'PARLIAMENTARY_ELECTION', 'PRESIDENTIAL_ELECTION']);
    if (error || !regions) return;

    const candidatesByRegion: string[] = [];
    for (const r of regions as any[]) {
      const status = (r.territoryStatus as string | null | undefined) || (r.nation_id ? 'STATE_ACTIVE' : 'INDEPENDENT_REGION');
      if (status === 'STATE_ACTIVE') continue;
      if (!r.nation_id || ['INDEPENDENT_REGION', 'PARLIAMENTARY_ELECTION', 'PRESIDENTIAL_ELECTION'].includes(status)) {
        candidatesByRegion.push(r.id);
      }
    }

    for (const regionId of candidatesByRegion) {
      const region = (regions as any[]).find(rr => rr.id === regionId);
      if (!region) continue;

      const status = (region.territoryStatus as string | null | undefined) || (region.nation_id ? 'STATE_ACTIVE' : 'INDEPENDENT_REGION');

      // Helper: parse timestamps resiliently
      const ts = (v: any): number => {
        if (!v) return 0;
        const d = new Date(v);
        const t = d.getTime();
        return isNaN(t) ? 0 : t;
      };

      if (status === 'INDEPENDENT_REGION') {
        const independentAtMs = ts(region.independentAt);
        if (!independentAtMs) {
          await supabase.from('regions').update({
            territoryStatus: 'INDEPENDENT_REGION',
            independentAt: nowIso,
            parliamentaryElectionStartedAt: null,
            presidentialElectionStartedAt: null,
            presidentialElectionClosesAt: null,
            stateActivatedAt: null,
          }).eq('id', regionId);
          continue;
        }

        // Stop elezioni fantasma: una regione indipendente NON deve avere elezioni attive
        await supabase.from('elections').update({ status: 'closed' }).eq('regionId', regionId).eq('status', 'active');

        if (now - independentAtMs < MS_24H) continue;

        const hasPoliticalBase = await hasEligiblePoliticalBaseForIndependentRegion(regionId);
        if (!hasPoliticalBase) continue;

        const startIso = nowIso;
        await supabase.from('regions').update({
          territoryStatus: 'PARLIAMENTARY_ELECTION',
          parliamentaryElectionStartedAt: startIso,
          presidentialElectionStartedAt: null,
          presidentialElectionClosesAt: null,
        }).eq('id', regionId);

        // Crea/aggiorna subito l'elezione parlamentare a 24h
        await ensureParliamentaryElection24h(regionId, startIso);
        continue;
      }

      if (status === 'PARLIAMENTARY_ELECTION') {
        const startedAtMs = ts(region.parliamentaryElectionStartedAt) || ts(region.independentAt);
        if (!startedAtMs) continue;

        const startedAtIso = new Date(startedAtMs).toISOString();
        await ensureParliamentaryElection24h(regionId, startedAtIso);

        if (now - startedAtMs < MS_24H) continue;

        const closesIso = new Date(now + MS_24H).toISOString();

        // Passaggio a presidenziali (abilita candidature/voto leader)
        await supabase.from('regions').update({
          territoryStatus: 'PRESIDENTIAL_ELECTION',
          presidentialElectionStartedAt: nowIso,
          presidentialElectionClosesAt: closesIso,
          governmentForm: 'PRESIDENTIAL_REPUBLIC',
          leaderUserId: null,
          leaderTitle: 'Presidente',
          nextLeaderElectionAt: null,
        }).eq('id', regionId);

        // Chiude eventuali elezioni parlamentari rimaste aperte
        await supabase.from('elections').update({ status: 'closed' }).eq('regionId', regionId).eq('status', 'active');

        // Reset della votazione leader
        await supabase.from('leader_candidates').delete().eq('regionId', regionId);
        await supabase.from('leader_votes').delete().eq('regionId', regionId);
        continue;
      }

      if (status === 'PRESIDENTIAL_ELECTION') {
        const closesAtMs = ts(region.presidentialElectionClosesAt) || (ts(region.presidentialElectionStartedAt) + MS_24H);
        if (!closesAtMs) {
          await supabase.from('regions').update({
            presidentialElectionStartedAt: nowIso,
            presidentialElectionClosesAt: new Date(now + MS_24H).toISOString(),
          }).eq('id', regionId);
          continue;
        }

        if (now < closesAtMs) continue;

        const { data: winner } = await supabase
          .from('leader_candidates')
          .select('userId, votes')
          .eq('regionId', regionId)
          .order('votes', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!winner?.userId) {
          // Niente elezione vuota che crea lo Stato: si prolunga la finestra finché non c'è almeno 1 candidato
          await supabase.from('regions').update({
            presidentialElectionClosesAt: new Date(now + MS_24H).toISOString(),
          }).eq('id', regionId);
          continue;
        }

        await activateStateFromRegion(regionId, region.name, winner.userId);
      }
    }
  } catch (e) {
    console.error('[IndependentRegions] Tick error:', e);
  }
}

async function hasEligiblePoliticalBaseForIndependentRegion(regionId: string): Promise<boolean> {
  const [peopleRes, partiesRes] = await Promise.all([
    supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('residenceId', regionId)
      .not('username', 'ilike', 'app_%')
      .not('username', 'ilike', 'mgr_%')
      .not('username', 'ilike', 'out_%')
      .not('username', 'ilike', 'res_%'),
    supabase.from('parties').select('id').eq('regionId', regionId),
  ]);

  const peopleOk = (peopleRes.count || 0) > 0;
  const partyIds = (partiesRes.data || []).map((p: any) => p.id).filter(Boolean);
  if (!peopleOk || partyIds.length === 0) return false;

  const membersRes = await supabase
    .from('party_members')
    .select('userId', { count: 'exact', head: true })
    .in('partyId', partyIds);

  return (membersRes.count || 0) > 0;
}

async function ensureParliamentaryElection24h(regionId: string, startedAtIso: string): Promise<void> {
  const MS_24H = 24 * 60 * 60 * 1000;
  const startedAtMs = new Date(startedAtIso).getTime();
  const closesAtIso = new Date(startedAtMs + MS_24H).toISOString();

  const active = await supabase
    .from('elections')
    .select('id')
    .eq('regionId', regionId)
    .eq('status', 'active')
    .maybeSingle();

  if (active.data?.id) {
    await supabase.from('elections').update({ closesAt: closesAtIso }).eq('id', active.data.id);
    return;
  }

  await supabase.from('elections').insert({
    id: generateSecureId(9),
    regionId,
    status: 'active',
    createdAt: new Date().toISOString(),
    closesAt: closesAtIso,
  });
}

async function activateStateFromRegion(regionId: string, regionName: string | null | undefined, leaderUserId: string): Promise<void> {
  const nowIso = new Date().toISOString();
  const nationId = regionId;

  const existing = await supabase.from('nations').select('id').eq('id', nationId).maybeSingle();
  if (existing.data?.id) {
    await supabase.from('nations').update({
      isActiveState: true,
      leaderUserId,
      updatedAt: Date.now(),
    }).eq('id', nationId);
  } else {
    await supabase.from('nations').insert({
      id: nationId,
      name: regionName || nationId,
      logo: '🏳️',
      leaderUserId,
      updatedAt: Date.now(),
      isActiveState: true,
    });
  }

  await supabase.from('regions').update({
    nation_id: nationId,
    territoryStatus: 'STATE_ACTIVE',
    stateActivatedAt: nowIso,
    leaderUserId,
    leaderTitle: 'Presidente',
  }).eq('id', regionId);
}

async function checkAndResolveLeaderElections() {
  const now = Date.now();
  const nowIso = new Date().toISOString();
  const { data: regions } = await supabase
    .from('regions')
    .select('id, governmentForm, nextLeaderElectionAt')
    .in('governmentForm', ['PRESIDENTIAL_REPUBLIC', 'DOMINANT_PARTY']);

  if (!regions) return;

  for (const r of regions) {
    if (!r.nextLeaderElectionAt) {
      const firstElection = new Date(now + (5 * 24 * 60 * 60 * 1000)).toISOString();
      await supabase.from('regions').update({ nextLeaderElectionAt: firstElection }).eq('id', r.id);
      continue;
    }

    if (new Date(r.nextLeaderElectionAt).getTime() <= now) {
      const { data: winner } = await supabase
        .from('leader_candidates')
        .select('userId, votes')
        .eq('regionId', r.id)
        .order('votes', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (winner) {
        const title = r.governmentForm === 'PRESIDENTIAL_REPUBLIC' ? 'Presidente' : 'Leader';
        await supabase.from('regions').update({
          leaderUserId: winner.userId,
          leaderTitle: title,
          nextLeaderElectionAt: new Date(now + (5 * 24 * 60 * 60 * 1000)).toISOString()
        }).eq('id', r.id);

        await supabase.from('ministers').update({ status: 'REVOKED' }).eq('stateId', r.id);
        await supabase.from('regions').update({ economicAdviserId: null, foreignMinisterId: null }).eq('id', r.id);
      }

      await supabase.from('leader_candidates').delete().eq('regionId', r.id);
      await supabase.from('leader_votes').delete().eq('regionId', r.id);
    }
  }
}

async function checkAndResolveLaws() {
  const nowIso = new Date().toISOString();

  const { data: pendingLaws } = await supabase
    .from('laws')
    .select('*, regions(governmentForm)')
    .eq('status', 'pending')
    .lte('expiresAt', nowIso);

  if (!pendingLaws) return;

  for (const law of pendingLaws) {
    const { data: votes } = await supabase
      .from('law_votes')
      .select('vote')
      .eq('lawId', law.id);

    const yes = votes?.filter(v => v.vote === 'yes').length || 0;
    const no = votes?.filter(v => v.vote === 'no').length || 0;
    const totalVotes = yes + no;

    const lawDef = LawRegistry[law.type];
    if (!lawDef) {
      await supabase.from('laws').update({ status: 'rejected' }).eq('id', law.id);
      continue;
    }

    const passRatio = totalVotes > 0 ? (yes / totalVotes) : 0;
    let passed = false;

    if (lawDef.threshold === 0.5) {
      passed = yes > no;
    } else {
      passed = totalVotes > 0 && passRatio >= lawDef.threshold;
    }

    if (passed) {
      // Accessing governmentForm from joined regions relation
      const govForm = (law.regions as any)?.governmentForm;
      if (govForm === "EXECUTIVE_MONARCHY") {
        await supabase.from('laws').update({ status: 'pending_assent' }).eq('id', law.id);
        continue;
      }

      await supabase.from('laws').update({ status: 'passed' }).eq('id', law.id);

      try {
        const { data: region } = await supabase.from('regions').select('*').eq('id', law.regionId).single();
        if (region) {
          const params = law.params ? (typeof law.params === 'string' ? JSON.parse(law.params) : law.params) : { newValue: law.newValue };
          await lawDef.execute(region, params, law.id);
        }
      } catch (e) {
        console.error(`Error executing law ${law.type} (${law.id}):`, e);
      }
    } else {
      await supabase.from('laws').update({ status: 'rejected' }).eq('id', law.id);
    }
  }
}

// Budget Cronjob Automation
async function budgetMaintenanceTick() {
  try {
    const { data: regions } = await supabase.from('regions').select('id, workRestrictions, residencePolicy');
    if (!regions) return;

    // Cost definitions
    const borderClosedCost = 100; // $100 per minute
    const residenceRestrictedCost = 50; // $50 per minute

    for (const r of regions) {
      let maintenanceCost = 0;
      let reasons: string[] = [];

      if (r.workRestrictions === 1) {
        maintenanceCost += borderClosedCost;
        reasons.push("Confini chiusi");
      }
      if (r.residencePolicy !== 'open') {
        maintenanceCost += residenceRestrictedCost;
        reasons.push("Residenza controllata");
      }

      if (maintenanceCost > 0) {
        try {
          await supabase.rpc('add_budget_transaction', {
            p_owner_type: 'REGION',
            p_owner_id: r.id,
            p_type: 'EXPENSE',
            p_subtype: 'BORDERS_MAINTENANCE',
            p_money_delta: -maintenanceCost,
            p_metadata: { reasons }
          });
        } catch (e) {
          // Budget insufficient, auto-open borders and free residence
          await supabase.from('regions').update({ workRestrictions: 0, residencePolicy: 'open' }).eq('id', r.id);
          console.log(`Region ${r.id} ran out of budget for maintenance. Borders auto-opened.`);
        }
      }
    }
  } catch (error) {
    console.error("Error in budgetMaintenanceTick:", error);
  }
}

// War Resolution Cronjob
async function checkAndResolveWars() {
  try {
    const nowIso = new Date().toISOString();

    // 1. Naval wars: if Phase 1 expired and attacker won, auto-start Phase 2 (sbarco) for +24h.
    // NOTE: we must do this BEFORE resolving expired wars, otherwise Phase 1 would be closed prematurely.
    const { data: expiredNavalPhase1Wars } = await supabase
      .from('wars')
      .select('*')
      .eq('status', 'active')
      .eq('warType', 'naval')
      .eq('navalPhase', 1)
      .lt('endsAt', nowIso);

    if (expiredNavalPhase1Wars && expiredNavalPhase1Wars.length > 0) {
      for (const war of expiredNavalPhase1Wars) {
        try {
          const phase1AttackerTotal = (war.attackerScore || 0) + (war.phase1AttackerScore || 0);
          const phase1DefenderTotal = (war.defenderScore || 0) + (war.phase1DefenderScore || 0);
          const scoreDifference = phase1AttackerTotal - phase1DefenderTotal;

          // Tie goes to defender (defense advantage)
          const attackerWinsPhase1 = scoreDifference > 0;

          if (!attackerWinsPhase1) continue;

          const newEndsAt = new Date(Date.now() + GAME_CONFIG.WAR_NAVAL_PHASE_DURATION_MS).toISOString();

          await supabase.from('wars').update({
            navalPhase: 2,
            status: 'active',
            endsAt: newEndsAt,
            // Freeze Phase 1 totals for audit/history.
            phase1AttackerScore: phase1AttackerTotal,
            phase1DefenderScore: phase1DefenderTotal,
            // Apply Phase 1 advantage to Phase 2 as initial malus for defender (implemented as attacker head start).
            attackerScore: scoreDifference,
            defenderScore: 0,
            updatedAt: new Date().toISOString(),
          }).eq('id', war.id).eq('status', 'active').eq('navalPhase', 1);

          await supabase.from('war_history').insert({
            warId: war.id,
            eventType: 'phase_change',
            eventData: {
              from: 1, to: 2,
              phase1Winner: 'attacker',
              phase1AttackerTotal,
              phase1DefenderTotal,
              scoreDifference,
              appliedAs: 'defender_malus',
            },
          });

          console.log(`[WAR] Naval war ${war.id} → Phase 2 (attacker won phase 1, difference: ${scoreDifference})`);
        } catch (phaseErr) {
          console.error(`[WAR] Error transitioning naval war ${war.id} to phase 2:`, phaseErr);
        }
      }
    }

    // 2. Resolve expired wars
    const { data: expiredWars } = await supabase
      .from('wars')
      .select('*')
      .eq('status', 'active')
      .lt('endsAt', nowIso);

    if (expiredWars && expiredWars.length > 0) {
      for (const war of expiredWars) {
        try {
          // Naval Phase 2 already starts with Phase 1 advantage applied to attackerScore,
          // so Phase 1 totals must not be added again here (otherwise they would be double-counted).
          const isNavalPhase2 = war.warType === 'naval' && war.navalPhase === 2;
          const attackerTotal = (war.attackerScore || 0) + (isNavalPhase2 ? 0 : (war.phase1AttackerScore || 0));
          const defenderTotal = (war.defenderScore || 0) + (isNavalPhase2 ? 0 : (war.phase1DefenderScore || 0));
          const winner: string = attackerTotal > defenderTotal ? 'attacker' : 'defender';

          const effects = getResolutionEffects(war.warType || 'land', winner as WarSide);

          // Apply building reduction if attacker wins
          if (effects.buildingReduction > 0 && war.defenderRegionId) {
            await supabase.from('regional_buildings')
              .select('regionId, buildingType, level')
              .eq('regionId', war.defenderRegionId)
              .then(async ({ data: buildings }) => {
                if (buildings) {
                  for (const b of buildings) {
                    const newLevel = Math.max(0, Math.floor((b.level || 0) * (1 - effects.buildingReduction)));
                    await supabase.from('regional_buildings')
                      .update({ level: newLevel })
                      .eq('regionId', b.regionId)
                      .eq('buildingType', b.buildingType);
                  }
                }
              });
          }

          // Territory transfer logic
          let canTransferTerritory = effects.territoryTransfer && winner === 'attacker';
          
          // CRITICAL: For naval wars, territory is ONLY transferred if they reach and win Phase 2
          if (war.warType === 'naval' && war.navalPhase !== 2) {
            canTransferTerritory = false;
          }

          if (canTransferTerritory && war.defenderRegionId && war.attackerRegionId) {
            const { data: attackerRegion } = await supabase.from('regions')
              .select('ownerUserId, leaderUserId, nation_id, stateColor, governmentForm, leaderTitle, dictatorship')
              .eq('id', war.attackerRegionId)
              .single();

            if (attackerRegion) {
              const conquestLeader = attackerRegion.leaderUserId || attackerRegion.ownerUserId;
              const conquestNationId = attackerRegion.nation_id || war.attackerCountryIso2 || war.attackerRegionId;
              const nowIso = new Date().toISOString();
              await supabase.from('regions').update({
                ownerUserId: conquestLeader,
                leaderUserId: conquestLeader,
                nation_id: conquestNationId,
                stateColor: attackerRegion.stateColor,
                governmentForm: attackerRegion.governmentForm,
                leaderTitle: attackerRegion.leaderTitle,
                dictatorship: attackerRegion.dictatorship,
                stability: 30,
                territoryStatus: 'STATE_ACTIVE',
                independentAt: null,
                parliamentaryElectionStartedAt: null,
                presidentialElectionStartedAt: null,
                presidentialElectionClosesAt: null,
                stateActivatedAt: null,
                updatedAt: nowIso,
              }).eq('id', war.defenderRegionId);

              console.log(`[WAR] ${war.attackerCountryIso2} CONQUERED ${war.defenderRegionId}`);
            }
          }

          // Independence for revolution/coup
          if (effects.independenceGrant && winner === 'attacker' && war.defenderRegionId) {
            await supabase.from('regions').update({
              nation_id: null,
              ownerUserId: war.attackerUserId,
              leaderUserId: war.attackerUserId,
              stability: 50,
              territoryStatus: 'INDEPENDENT_REGION',
              independentAt: new Date().toISOString(),
              parliamentaryElectionStartedAt: null,
              presidentialElectionStartedAt: null,
              presidentialElectionClosesAt: null,
              stateActivatedAt: null,
            }).eq('id', war.defenderRegionId);

            if (effects.governmentChange) {
              await supabase.from('regions').update({
                governmentForm: 'PARLIAMENTARY_REPUBLIC',
              }).eq('id', war.defenderRegionId);
            }
          }

          // Loot calculation
          let lootValue = 0;
          if (effects.lootPercentage > 0 && war.defenderRegionId) {
            const { data: loserBudget } = await supabase.from('budgets')
              .select('moneyEUR')
              .eq('ownerType', 'REGION')
              .eq('ownerId', war.defenderRegionId)
              .single();

            if (loserBudget && loserBudget.moneyEUR > 0) {
              lootValue = Math.floor(loserBudget.moneyEUR * effects.lootPercentage);

              await supabase.rpc('add_budget_transaction', {
                p_owner_type: 'REGION',
                p_owner_id: war.defenderRegionId,
                p_type: 'EXPENSE',
                p_subtype: 'WAR_LOOT_LOST',
                p_money_delta: -lootValue,
                p_metadata: { warId: war.id },
              });

              if (war.attackerRegionId) {
                await supabase.rpc('add_budget_transaction', {
                  p_owner_type: 'REGION',
                  p_owner_id: war.attackerRegionId,
                  p_type: 'INCOME',
                  p_subtype: 'WAR_LOOT_WON',
                  p_money_delta: lootValue,
                  p_metadata: { warId: war.id },
                });
              }
            }
          }

          // Update war status
          await supabase.from('wars').update({
            status: 'ended',
            winnerId: winner,
            resolvedAt: new Date().toISOString(),
            lootValue,
            updatedAt: new Date().toISOString(),
          }).eq('id', war.id);

          // Update linked revolution/coup
          if (war.warType === 'revolution') {
            await supabase.from('revolutions').update({
              status: winner === 'attacker' ? 'succeeded' : 'failed',
              resolvedAt: new Date().toISOString(),
            }).eq('warId', war.id);
          } else if (war.warType === 'coup') {
            await supabase.from('coups').update({
              status: winner === 'attacker' ? 'succeeded' : 'failed',
              resolvedAt: new Date().toISOString(),
            }).eq('warId', war.id);
          }

          // War history
          await supabase.from('war_history').insert({
            warId: war.id,
            eventType: 'war_ended',
            eventData: {
              winner,
              attackerTotal,
              defenderTotal,
              lootValue,
              effects,
            },
          });

          console.log(`[WAR] Resolved: ${war.id} — Winner: ${winner}, Loot: ${lootValue}`);
        } catch (warErr) {
          console.error(`[WAR] Error resolving war ${war.id}:`, warErr);
        }
      }
    }

    // 2. Handle naval phase transitions (DEPRECATED: handled earlier in this tick)
    /*
    const { data: navalWars } = await supabase
      .from('wars')
      .select('*')
      .eq('status', 'active')
      .eq('warType', 'naval')
      .eq('navalPhase', 1);

    if (navalWars && navalWars.length > 0) {
      const now = Date.now();
      for (const war of navalWars) {
        const phaseEnd = new Date(war.createdAt).getTime() + GAME_CONFIG.WAR_NAVAL_PHASE_DURATION_MS;
        if (now >= phaseEnd) {
          const attackerWinsPhase1 = (war.phase1AttackerScore || 0) > (war.phase1DefenderScore || 0);

          if (attackerWinsPhase1) {
            // Phase 2: land war with bonus (score carry-over)
            const scoreDifference = (war.phase1AttackerScore || 0) - (war.phase1DefenderScore || 0);
            const newEndsAt = new Date(now + GAME_CONFIG.WAR_NAVAL_PHASE_DURATION_MS).toISOString();

            await supabase.from('wars').update({
              navalPhase: 2,
              attackerScore: scoreDifference, // Start phase 2 with the advantage
              defenderScore: 0,
              endsAt: newEndsAt,
              updatedAt: new Date().toISOString(),
            }).eq('id', war.id);

            await supabase.from('war_history').insert({
              warId: war.id,
              eventType: 'phase_change',
              eventData: {
                from: 1, to: 2,
                phase1Winner: 'attacker',
                scoreDifference,
              },
            });

            console.log(`[WAR] Naval war ${war.id} → Phase 2 (attacker won phase 1, difference: ${scoreDifference})`);
          } else {
            // Attacker lost phase 1 — war ends
            await supabase.from('wars').update({
              status: 'ended',
              winnerId: 'defender',
              resolvedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }).eq('id', war.id);

            await supabase.from('war_history').insert({
              warId: war.id,
              eventType: 'war_ended',
              eventData: { winner: 'defender', reason: 'naval_phase1_lost' },
            });

            console.log(`[WAR] Naval war ${war.id} ended — Attacker lost phase 1`);
          }
        }
      }
    }

    */
    // Automations are processed by processAutomationTick()
  } catch (error) {
    console.error("Error in checkAndResolveWars:", error);
  }
}

// ══════════════════════════════════════════════════════════════
// ═══  DAILY MISSIONS SYSTEM  ═════════════════════════════════
// ══════════════════════════════════════════════════════════════

/**
 * Helper: Ensure today's missions exist for a player.
 * Generates them from the template pool if they don't exist yet.
 * Returns the missions array.
 */
async function ensureDailyMissions(userId: string, playerLevel: number): Promise<any[]> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC

  // Check if missions already generated for today
  const { data: existing } = await supabase
    .from('daily_missions')
    .select('*')
    .eq('user_id', userId)
    .eq('reset_date', today)
    .order('created_at', { ascending: true });

  if (existing && existing.length > 0) {
    return existing;
  }

  // Generate new missions for today
  const missions = selectDailyMissions(today, userId, playerLevel);

  // Insert into database
  const rows = missions.map(m => ({
    user_id: userId,
    mission_key: m.mission_key,
    title: m.title,
    description: m.description,
    category: m.category,
    icon: m.icon,
    target: m.target,
    progress: 0,
    status: 'active',
    reward: m.reward,
    route: m.route || null,
    reset_date: today,
  }));

  const { data: inserted, error } = await supabase
    .from('daily_missions')
    .insert(rows)
    .select();

  if (error) {
    console.error('[DailyMissions] Error inserting missions:', error.message);
    // Return generated missions as fallback (without DB ids)
    return missions.map((m, i) => ({ ...rows[i], id: m.id }));
  }

  // Auto-complete daily_login mission
  const loginMission = (inserted || []).find((m: any) => m.mission_key === 'daily_login');
  if (loginMission && loginMission.status === 'active') {
    await supabase
      .from('daily_missions')
      .update({ progress: 1, status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', loginMission.id);
    loginMission.progress = 1;
    loginMission.status = 'completed';
  }

  return inserted || missions.map((m, i) => ({ ...rows[i], id: m.id }));
}

/**
 * Helper: Update mission progress for a player based on an action.
 * Called from within game action endpoints (work, deploy, etc.).
 */
async function updateMissionProgress(
  userId: string,
  actionKey: string,
  amounts: Record<string, number>
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const missionKeys = MISSION_ACTION_MAP[actionKey] || [];

  for (const mKey of missionKeys) {
    const increment = amounts[mKey] || 0;
    if (increment <= 0) continue;

    try {
      const result = await supabase.rpc('update_mission_progress', {
        p_user_id: userId,
        p_mission_key: mKey,
        p_reset_date: today,
        p_increment: increment,
      });

      // If a mission just completed, update 'complete_missions' counter
      const data = result.data;
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      if (parsed && typeof parsed === 'object' && parsed.status === 'completed' && mKey !== 'complete_missions') {
        await supabase.rpc('update_mission_progress', {
          p_user_id: userId,
          p_mission_key: 'complete_missions',
          p_reset_date: today,
          p_increment: 1,
        });
      }
    } catch (err) {
      // Non-critical: log but don't break the main action
      console.error(`[DailyMissions] Error updating ${mKey} for ${userId}:`, err);
    }
  }
}

const dailyRewardService = new DailyRewardService(new DailyRewardRepository(supabase));

// Vite middleware for development
export async function startServer() {
  setupRoutes({
    app,
    authenticate,
    supabase,
    getUserPerks,
    isAllowedAvatarDataUrl,
    IS_PRODUCTION,
    ENABLE_DEV_ENDPOINTS,
    calculateStateSalaries,
    addXP,
    canManageRegion,
    retrySupabaseOperation,
    GAME_CONFIG,
    isValidIso2,
    generateSecureId,
    addBudgetTransaction,
    performTrainingAction,
    tryUseEnergyDrinkForUser,
    performWorkAction,
    updateMissionProgress,
    PERKS_DEFS,
    BOOSTER_CONFIG,
    RESOURCE_TYPES,
    FACTORY_CONFIG,
    EXTRACTION_CONFIG,
    AUTONOMY_CONFIG,
    factoryYieldMultiplier,
    factoryStorageLimit,
    calculateDamage,
    calculateDamageCap,
    incrementPlayerWorkExperience,
    factoryCreateService,
    factoryUpgradeService,
    factoryEconomyService,
    mapServiceResultToHttp,
    estimateFactoryValue,
    productionService,
    checkCooldown,
    updateCooldown,
    buyEnergyDrinksForUser,
    isValidUuid,
    assertCanManageRegion,
    TROOP_BASE_DAMAGE,
    TROOP_ENERGY_COST,
    TROOP_MONEY_COST,
    WAR_TYPE_ALLOWED_TROOPS,
    validateTroopDeployment,
    getMaxDeployableTroops,
    getAvailableTroops,
    shouldAutoAttackFire,
    normalizeRegionLikeId,
    canReadRegionScopedData,
    getRegionBuildings,
    calculateRegionalIndices,
    performWarDeployAction,
    partyAssetsService,
    LawRegistry,
    ensureDailyMissions,
    dailyRewardService,
    isDailyMissionClaimSuccess,
    isDailyBonusClaimSuccess,
    DAILY_GAMEPLAY_CONFIG,
    getNationForRegion,
    getActiveDeep,
    computeEffectiveCap,
    getSetting,
    getStateEnergyCompensation,
    BUILDING_LABELS,
    computeDeepCost,
    getCachedDeepLevels,
    getPlayerWorkExperience,
    getRegionPowerPlants,
    getDepartmentBonus,
    getResourceCoefficient,
    getWorkExperienceMultiplier,
    getWorkExperienceGainForEnergyCost,
    getMaxWorkXpPerResource,
    calculateExtraction,
    createAutomationError,
    executeExtractionWork,
    warDomain: createWarDomainDeps({
      supabase,
      validateWarCreation,
      getRegionBuildings,
      calculateInitialAttackDamage,
      calculateInitialDefensePoints,
      calculateDistancePenalty,
      getWarDuration,
      generateWarId: () => generateSecureId(9),
      validateTroopDeployment,
      getMaxDeployableTroops,
      calculateRegionalIndices,
      calculateDamage,
      addXP,
      updateMissionProgress,
      troopEnergyCostByType: TROOP_ENERGY_COST,
      xpPerAttack: GAME_CONFIG.XP_PER_ATTACK,
    }),
  });
  // Centralized error handler — must be registered after all routes.
  app.use(errorHandler);

  if (process.env.NODE_ENV === "production") {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    logger.info(`Server running on http://localhost:${PORT}`);
    startBackgroundJobs();
  }).on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`FATAL ERROR: Port ${PORT} is already in use.`, { err });
    } else {
      logger.error("FATAL ERROR: Server failed to start.", { err });
    }
    process.exit(1);
  });
}

export function startBackgroundJobs() {
  // Global Budget Tick (every 60 seconds)
  setInterval(() => {
    try {
      budgetMaintenanceTick();
    } catch (e) {
      logger.error("Budget tick error", { err: e });
    }
  }, 60 * 1000);

  // Global Economy Tick (every 10 minutes)
  // DISABLED: Regions are now passive containers.
  /*
  setInterval(async () => {
    console.log("Running economy tick...");
    // Future: Migrate this to a Supabase Cron or Edge Function if needed.
  }, 10 * 60 * 1000);
  */

  // Game Cronjobs (Laws and Elections)
  setInterval(() => {
    checkAndResolveElections();
    checkAndAdvanceIndependentRegions();
    checkAndResolveLaws();
    checkAndResolveWars();
    processAutomationTick();
  }, 60 * 1000); // Check every minute

  // Daily Resource Reset (check every 5 minutes, run once per day at UTC midnight)
  let lastDailyReset = '';
  setInterval(async () => {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    if (today !== lastDailyReset) {
      lastDailyReset = today;
      await dailyResourceReset();
    }
  }, 5 * 60 * 1000);
}

startServer();

