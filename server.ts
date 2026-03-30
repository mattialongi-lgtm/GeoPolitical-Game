import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import cookieParser from "cookie-parser";
import { randomBytes } from "crypto";
import { GAME_CONFIG, PERKS_DEFS, BOOSTER_CONFIG, RESOURCE_TYPES, AUTONOMY_CONFIG, BUILDING_LABELS, FACTORY_CONFIG, EXTRACTION_CONFIG, factoryYieldMultiplier, factoryStorageLimit, estimateFactoryValue } from "./src/types";
import type { ResourceType, DeepCostPreview, BuildingType, FactoryType, ExtractionBreakdown } from "./src/types";
import { TROOP_BASE_DAMAGE, TROOP_ENERGY_COST, TROOP_MONEY_COST, WAR_TYPE_ALLOWED_TROOPS } from "./src/types";
import type { WarType, TroopType, WarSide, DamageBreakdown, WarFull } from "./src/types";
import { calculateDamage, calculateInitialAttackDamage, calculateInitialDefensePoints, calculateDamageCap } from "./src/services/damageCalculator";
import { validateTroopDeployment, getMaxDeployableTroops, getAvailableTroops } from "./src/services/troopManager";
import { validateWarCreation, getWarDuration, calculateDistancePenalty, shouldTransitionNavalPhase } from "./src/services/warService";
import { getResolutionEffects, resolveWar as resolveWarLogic } from "./src/services/battleResolver";
import { shouldAutoAttackFire, getWarsToResolve, getNavalWarsForPhaseTransition } from "./src/services/warScheduler";
import { selectDailyMissions, MISSION_TEMPLATES, MISSION_ACTION_MAP } from "./src/services/dailyMissionsService";
import { DAILY_GAMEPLAY_CONFIG } from "./src/types";
import { registerWarRoutes } from "./backend/routes/war.routes";
import { createWarDomainDeps } from "./backend/services/war-domain.helpers";
import { DailyRewardRepository } from "./backend/repositories/daily-reward.repository";
import { DailyRewardService } from "./backend/services/daily-reward.service";
import { FactoryEconomyRepository } from "./backend/repositories/factory-economy.repository";
import { FactoryEconomyService } from "./backend/services/factory-economy.service";
import { FactoryUpgradeRepository } from "./backend/repositories/factory-upgrade.repository";
import { FactoryUpgradeService } from "./backend/services/factory-upgrade.service";
import { FactoryCreateRepository } from "./backend/repositories/factory-create.repository";
import { FactoryCreateService } from "./backend/services/factory-create.service";
import { PartyAssetsRepository } from "./backend/repositories/party-assets.repository";
import { PartyAssetsService } from "./backend/services/party-assets.service";
import { ProductionRepository } from "./backend/repositories/production.repository";
import { ProductionService } from "./backend/services/production.service";
import { isDailyBonusClaimSuccess, isDailyMissionClaimSuccess } from "./backend/observability/contract-guards";
import { mapServiceResultToHttp } from "./backend/services/http-result.mapper";

console.log("Starting server.ts...");

const app = express();
const PORT = 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ENABLE_DEV_ENDPOINTS = process.env.ENABLE_DEV_ENDPOINTS === 'true';

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

app.use(express.json());

// --- Government & Salary Configuration ---
const GOVERNMENT_SALARY_CONFIG: Record<string, { headOfState: number; minister: number }> = {
  'PARLIAMENTARY_REPUBLIC': { headOfState: 40, minister: 25 },
  'PRESIDENTIAL_REPUBLIC': { headOfState: 40, minister: 25 },
  'DOMINANT_PARTY': { headOfState: 30, minister: 20 },
  'DICTATORSHIP': { headOfState: 50, minister: 15 },
  'ONE_PARTY_SYSTEM': { headOfState: 35, minister: 20 },
  'EXECUTIVE_MONARCHY': { headOfState: 60, minister: 10 },
  // Localized fallbacks matching common database strings
  'REPUBBLICA': { headOfState: 40, minister: 25 },
  'REPUBBLICA PARLAMENTARE': { headOfState: 40, minister: 25 },
};

/**
 * Calculates current salaries based on government form and region count.
 */
function calculateStateSalaries(governmentForm: string | null, regionCount: number) {
  const normalized = (governmentForm || '').toUpperCase();
  const config = GOVERNMENT_SALARY_CONFIG[normalized] || GOVERNMENT_SALARY_CONFIG['PARLIAMENTARY_REPUBLIC'];
  
  return {
    headOfStateGold: config.headOfState * regionCount,
    ministerGold: config.minister * regionCount,
  };
}
app.use(cookieParser());

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
    .select('governmentForm, education, health, economyLevel, ownerUserId')
    .eq('id', stateId)
    .single();

  if (!region) return 0;

  // 1. Base from Development Index (Avg of Edu, Health, Economy)
  const devIndex = (region.education + region.health + region.economyLevel) / 3;

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

    // Fetch user data from 'users' table
    // We use the service role client (global 'supabase') to bypass RLS and see all columns/users
    let { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (userError || !user) {
      if (userError && userError.code !== 'PGRST116') {
         console.error("Error fetching user from table:", userError);
      }

      // Just-in-time provisioning: create user if they exist in Auth but not in public.users
      console.log(`[JIT] Provisioning new user: ${authUser.email} (${authUser.id})`);
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
          regionId: 'IT-RM', // Default region (Ensure this exists in your regions table)
          residenceId: 'IT-RM',
          lastEnergyUpdate: Date.now(),
          lastLogin: Date.now()
        })
        .select()
        .single();
      
      if (createError) {
        if (createError.code === '23505') {
          // Race condition: another request created the user concurrently.
          // Re-fetch the newly created user record.
          let { data: retryUser, error: retryError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single();
          
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

    // Fetch party membership
    const { data: membership } = await supabase
      .from('party_members')
      .select('partyId, parties(name, logo)')
      .eq('userId', user.id)
      .maybeSingle() as any;

    if (membership) {
      req.user.partyId = membership.partyId;
      req.user.partyName = membership.parties?.name;
      req.user.partyLogo = membership.parties?.logo;
    }

    // Update lastLogin timestamp for activity tracking
    const nowLogin = Date.now();
    if (!user.lastLogin || nowLogin - (typeof user.lastLogin === 'number' ? user.lastLogin : new Date(user.lastLogin).getTime()) > 60000) {
      await supabase.from('users').update({ lastLogin: nowLogin }).eq('id', user.id);
      req.user.lastLogin = nowLogin;
    }

    // Load perk levels from perks table
    req.user.perks = await getUserPerks(user.id);

    // Parse perkUpgrades and boosters from JSON columns
    try {
      req.user.perkUpgrades = JSON.parse(user.perkUpgradesJson || '{}');
    } catch { req.user.perkUpgrades = {}; }
    try {
      req.user.boosters = JSON.parse(user.boostersJson || '{}');
    } catch { req.user.boosters = {}; }

    // Auto-finalize completed perk upgrades
    const nowTs = Date.now();
    let upgradesChanged = false;
    for (const [perkId, upg] of Object.entries(req.user.perkUpgrades as Record<string, any>)) {
      if (upg.willCompleteAt && upg.willCompleteAt <= nowTs) {
        // Upgrade completed → increment perk level
        const newLevel = (req.user.perks[perkId] || 0) + 1;
        const { error: upsertErr } = await supabase.from('perks').upsert(
          { userId: user.id, perkId, level: newLevel },
          { onConflict: 'userId,perkId' }
        );
        if (!upsertErr) {
          req.user.perks[perkId] = newLevel;
          delete req.user.perkUpgrades[perkId];
          upgradesChanged = true;
        } else {
          console.error("Error finalizing perk upgrade:", upsertErr);
        }
      }
    }
    if (upgradesChanged) {
      const { error: updateErr } = await supabase.from('users').update({
        perkUpgradesJson: JSON.stringify(req.user.perkUpgrades)
      }).eq('id', user.id);
      if (updateErr) {
        console.error("Error updating perkUpgradesJson:", updateErr);
      }
    }

    // Auto-complete travel if travelingUntil has passed
    if (user.travelingUntil && user.travelingTo && Date.now() >= user.travelingUntil) {
      const { error: travelErr } = await supabase.from('users').update({
        regionId: user.travelingTo,
        travelingUntil: null,
        travelingTo: null
      }).eq('id', user.id);
      if (!travelErr) {
        req.user.regionId = user.travelingTo;
        req.user.travelingUntil = null;
        req.user.travelingTo = null;
      }
    }

    // Fetch user inventory from user_inventory table and attach as inventory object
    try {
      const { data: invItems } = await supabase.from('user_inventory')
        .select('itemId, quantity')
        .eq('userId', user.id);
      const inventoryObj: Record<string, number> = {};
      let totalVolume = 0;
      (invItems || []).forEach((item: any) => {
        if (item.quantity > 0) {
          inventoryObj[item.itemId] = item.quantity;
          totalVolume += item.quantity;
          // Standardize resource access - flatten common resources for frontend compatibility
          if (['oil', 'minerals', 'uranium', 'diamonds', 'energyDrinks', 'liquidOxygen', 'helium3'].includes(item.itemId)) {
             req.user[item.itemId] = item.quantity;
          }
        }
      });
      req.user.inventory = inventoryObj;
      req.user.inventoryVolume = totalVolume;
    } catch (invErr) {
      // Non-critical: continue without inventory
      req.user.inventory = {};
      req.user.inventoryVolume = 0;
    }

    next();
  } catch (err) {
    console.error("Auth Middleware Critical Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


// Auth Routes are now handled on the Client with Supabase Auth
// The server only needs to verify the session and provide profile synchronization if needed.

// Game Routes
app.get("/api/me", authenticate, (req: any, res) => {
  res.json(req.user);
});

app.get("/api/world-stats", authenticate, async (_req, res) => {
  try {
    const onlineThreshold = Date.now() - 5 * 60 * 1000; // 5 minutes

    const [usersRes, onlineRes, regionsRes, nationsRes, blocsRes, partiesRes, factoriesRes] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true })
        .not('username', 'ilike', 'app_%')
        .not('username', 'ilike', 'mgr_%')
        .not('username', 'ilike', 'out_%')
        .not('username', 'ilike', 'res_%'),
      supabase.from('users').select('id', { count: 'exact', head: true }).gte('lastLogin', onlineThreshold)
        .not('username', 'ilike', 'app_%')
        .not('username', 'ilike', 'mgr_%')
        .not('username', 'ilike', 'out_%')
        .not('username', 'ilike', 'res_%'),
      supabase.from('regions').select('id', { count: 'exact', head: true }),
      supabase.from('nations').select('id', { count: 'exact', head: true }),
      supabase.from('blocs').select('id', { count: 'exact', head: true }),
      supabase.from('parties').select('id', { count: 'exact', head: true }),
      supabase.from('factories').select('id', { count: 'exact', head: true }),
    ]);

    // Count regions with no nation_id (independent)
    const independentRes = await supabase
      .from('regions')
      .select('id', { count: 'exact', head: true })
      .is('nation_id', null);

    res.json({
      totalPlayers: usersRes.count || 0,
      onlinePlayers: onlineRes.count || 0,
      totalRegions: regionsRes.count || 0,
      totalStates: nationsRes.count || 0,
      totalBlocs: blocsRes.count || 0,
      independentRegions: independentRes.count || 0,
      totalParties: partiesRes.count || 0,
      totalFactories: factoriesRes.count || 0,
    });
  } catch (error) {
    res.status(500).json({ error: "Errore nel caricamento statistiche mondiali" });
  }
});

app.get("/api/dashboard-stats", authenticate, async (req: any, res) => {
  const user = req.user;
  const isoId = user.regionId;
  const nationId = user.originalNation || user.regionId?.split('-')[0];
  const onlineThreshold = Date.now() - 5 * 60 * 1000;

  try {
    const [regionParties, regionFactories, regionOnline, stateRegions, stateParties, stateFactories, stateOnline] = await Promise.all([
      supabase.from('parties').select('id', { count: 'exact', head: true }).eq('regionId', isoId),
      supabase.from('factories').select('id', { count: 'exact', head: true }).eq('regionId', isoId),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('regionId', isoId).gte('lastLogin', onlineThreshold)
        .not('username', 'ilike', 'app_%')
        .not('username', 'ilike', 'mgr_%')
        .not('username', 'ilike', 'out_%')
        .not('username', 'ilike', 'res_%'),
      supabase.from('regions').select('id', { count: 'exact', head: true }).eq('nation_id', nationId),
      supabase.from('parties').select('id', { count: 'exact', head: true }).ilike('regionId', `${nationId}%`),
      supabase.from('factories').select('id', { count: 'exact', head: true }).ilike('regionId', `${nationId}%`),
      supabase.from('users').select('id', { count: 'exact', head: true }).ilike('regionId', `${nationId}%`).gte('lastLogin', onlineThreshold)
        .not('username', 'ilike', 'app_%')
        .not('username', 'ilike', 'mgr_%')
        .not('username', 'ilike', 'out_%')
        .not('username', 'ilike', 'res_%'),
    ]);

    res.json({
      region: {
        parties: regionParties.count || 0,
        factories: regionFactories.count || 0,
        online: regionOnline.count || 0,
      },
      state: {
        regions: stateRegions.count || 0,
        parties: stateParties.count || 0,
        factories: stateFactories.count || 0,
        online: stateOnline.count || 0,
      }
    });
  } catch (error) {
    console.error("[DashboardStats] Error:", error);
    res.status(500).json({ error: "Errore nel caricamento statistiche dashboard" });
  }
});

// List of nations / states with basic info and region counts
app.get("/api/nations", authenticate, async (_req, res) => {
  try {
    const { data: nations, error } = await supabase
      .from('nations')
      .select('id, name, logo, leaderUserId, updatedAt');
    if (error) throw error;

    const { data: regions } = await supabase
      .from('regions')
      .select('id, nation_id, population');

    const regionCounts: Record<string, { count: number; population: number }> = {};
    (regions || []).forEach((r: any) => {
      if (!r.nation_id) return;
      if (!regionCounts[r.nation_id]) regionCounts[r.nation_id] = { count: 0, population: 0 };
      regionCounts[r.nation_id].count += 1;
      regionCounts[r.nation_id].population += r.population || 0;
    });

    // Count players per nation
    const { data: userStats } = await supabase
      .from('users')
      .select('originalNation');
    const playerCounts: Record<string, number> = {};
    (userStats || []).forEach((u: any) => {
      const nid = u.originalNation;
      if (nid) playerCounts[nid] = (playerCounts[nid] || 0) + 1;
    });

    const leaderIds = [...new Set((nations || []).map((n: any) => n.leaderUserId).filter(Boolean))];
    const leaderMap: Record<string, string> = {};
    if (leaderIds.length > 0) {
      const { data: leaders } = await supabase.from('users').select('id, username').in('id', leaderIds);
      (leaders || []).forEach((l: any) => { leaderMap[l.id] = l.username; });
    }

    const enriched = (nations || []).map((n: any) => ({
      ...n,
      leaderName: n.leaderUserId ? (leaderMap[n.leaderUserId] || null) : null,
      regionCount: regionCounts[n.id]?.count || 0,
      population: regionCounts[n.id]?.population || 0,
      playerCount: playerCounts[n.id] || 0,
    }));

    res.json(enriched);
  } catch (err: any) {
    console.error("Error fetching nations:", err);
    res.status(500).json({ error: "Errore nel caricamento degli stati: " + err.message });
  }
});

// Players list (optionally only online)
app.get("/api/players", authenticate, async (req: any, res) => {
  try {
    const onlyOnline = String(req.query.online || '').toLowerCase() === 'true';
    const onlineThreshold = Date.now() - 5 * 60 * 1000;

    let query = supabase
      .from('users')
      .select('id, username, regionId, originalNation, level, lastLogin, avatarData', { count: 'exact' })
      .not('username', 'ilike', 'app_%')
      .not('username', 'ilike', 'mgr_%')
      .not('username', 'ilike', 'out_%')
      .not('username', 'ilike', 'res_%')
      .order('level', { ascending: false })
      .limit(200);

    if (onlyOnline) query = query.gte('lastLogin', onlineThreshold);

    const { data, count, error } = await query;
    if (error) throw error;

    res.json({
      players: data || [],
      total: count || 0,
      onlineOnly: onlyOnline,
      onlineThreshold,
    });
  } catch (err: any) {
    console.error("Error fetching players:", err);
    res.status(500).json({ error: "Errore nel caricamento dei giocatori: " + err.message });
  }
});

app.get("/api/players/:id", authenticate, async (req: any, res) => {
  console.log(`[ProfileRequest] Fetching player ${req.params.id}`);
  try {
    const { data: player, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error || !player) {
      console.log(`[ProfileRequest] Player ${req.params.id} NOT FOUND in users table. Supabase error:`, error?.message);
      return res.status(404).json({ error: "Giocatore non trovato" });
    }
    console.log(`[ProfileRequest] Player FOUND: ${player.username}, sending data...`);
    // Remove sensitive data
    delete player.email;
    delete player.password;
    
    res.json(player);
  } catch (err: any) {
    res.status(500).json({ error: "Errore nel caricamento del profilo" });
  }
});

// New endpoint for the State page
app.get("/api/state/:id", authenticate, async (req, res) => {
  try {
    let nationId = (req.params.id || '').toUpperCase();
    if (nationId.includes('-')) nationId = nationId.split('-')[0];
    
    // 1. Fetch main nation data
    const { data: nation, error: nationError } = await supabase
      .from('nations')
      .select(`
        *,
        leader:users!leaderUserId(id, username, avatarData)
      `)
      .eq('id', nationId)
      .single();

    if (nationError || !nation) {
      // Fallback: if nation record doesn't exist, we might want to return 404
      // or a basic "independent" state view.
      return res.status(404).json({ error: "Stato non trovato" });
    }

    // 2. Fetch Ministers
    const { data: ministers } = await supabase
      .from('ministers')
      .select('*, user:users(id, username, avatarData)')
      .eq('stateId', nationId)
      .eq('status', 'ACTIVE');

    const economyMinister = ministers?.find(m => m.role === 'economics' || m.role === 'ECONOMICS');
    const foreignMinister = ministers?.find(m => m.role === 'foreign' || m.role === 'FOREIGN');

    // 3. Fetch Regions count and IDs
    const { data: regions, error: regionsError } = await supabase
      .from('regions')
      .select('id, name, population, developmentIndex, governor:users!governorPlayerId(username)')
      .eq('nation_id', nationId);

    if (regionsError) {
      console.error(`[StatePage] Error fetching regions for ${nationId}:`, regionsError.message);
    }

    const regionIds = (regions || []).map(r => r.id);
    console.log(`[StatePage] Nation ${nationId} has ${regions?.length || 0} regions:`, regionIds);

    // 5. Counts: Citizens, Residents, Parties, Factories
    const [citizenCount, residentCount, partyCount, factoryCount, userRegionBreakdown] = await Promise.all([
      // Citizens: users whose originalNation matches
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('originalNation', nationId),
      // Residents: users currently in these regions
      regionIds.length > 0
        ? supabase.from('users').select('id', { count: 'exact', head: true }).in('regionId', regionIds)
        : { count: 0 },
      // Parties: in these regions
      regionIds.length > 0
        ? supabase.from('parties').select('id', { count: 'exact', head: true }).in('regionId', regionIds)
        : { count: 0 },
      // Factories: in these regions
      regionIds.length > 0
        ? supabase.from('factories').select('id', { count: 'exact', head: true }).in('regionId', regionIds)
        : { count: 0 },
      // Player Breakdown: breakdown of users by region
      regionIds.length > 0
        ? supabase.from('users').select('regionId').in('regionId', regionIds)
        : { data: [] },
    ]);

    // Build the count map for individual regions
    const resCountPerRegion: Record<string, number> = {};
    if (userRegionBreakdown && (userRegionBreakdown as any).data) {
      (userRegionBreakdown as any).data.forEach((u: any) => {
        if (u.regionId) resCountPerRegion[u.regionId] = (resCountPerRegion[u.regionId] || 0) + 1;
      });
    }

    const totalPopulation = (residentCount as any).count || 0;

    // 5. Military Agreements
    const { data: militaryAgreements } = await supabase
      .from('military_agreements')
      .select(`
        *,
        partner:nations!partner_nation_id(id, name, logo)
      `)
      .eq('nation_id', nationId)
      .eq('status', 'ACTIVE');

    const sanctionsQuery = regionIds.length > 0
        ? supabase.from('sanctions')
            .select(`
                *,
                sourceNation:regions!fromStateId(id, nation:nations(id, name, logo)),
                targetNation:regions!targetStateId(id, nation:nations(id, name, logo))
            `)
            .or(`fromStateId.in.(${regionIds.join(',')}),targetStateId.in.(${regionIds.join(',')})`)
            .eq('status', 'ACTIVE')
        : { data: [] };
    
    const { data: sanctions } = await (sanctionsQuery as any);

    // Format output to match StatePage expectations
    const responseBody = {
      id: nation.id,
      name: nation.name,
      flag: nation.logo || '', // Emoji fallback handled by frontend if needed
      flagUrl: nation.logo?.startsWith('http') ? nation.logo : `https://flagcdn.com/${nation.id.toLowerCase()}.svg`,
      representativeImage: nation.representative_image || undefined,
      regionCount: regions?.length || 0,
      population: totalPopulation,
      governmentForm: nation.government_form || 'Repubblica Parlamentare',
      headOfState: nation.leader ? {
        name: nation.leader.username,
        role: 'Capo di Stato e Comandante',
        avatar: nation.leader.avatarData,
        salaryGold: calculateStateSalaries(nation.government_form, regions?.length || 0).headOfStateGold
      } : undefined,
      economyMinister: economyMinister ? {
        name: economyMinister.user?.username || 'Incaricato',
        role: "Ministro dell'Economia",
        avatar: economyMinister.user?.avatarData,
        salaryGold: calculateStateSalaries(nation.government_form, regions?.length || 0).ministerGold
      } : undefined,
      foreignMinister: foreignMinister ? {
        name: foreignMinister.user?.username || 'Incaricato',
        role: 'Ministro degli Esteri',
        avatar: foreignMinister.user?.avatarData,
        salaryGold: calculateStateSalaries(nation.government_form, regions?.length || 0).ministerGold
      } : undefined,
      geopoliticalBloc: nation.geopolitical_bloc || undefined,
      stats: {
        citizens: citizenCount.count || 0,
        residents: residentCount.count || 0,
        parties: partyCount.count || 0,
        factories: factoryCount.count || 0,
      },
      treasury: {
        balance: nation.treasury_balance || 0,
        dailyIncome: nation.treasury_daily_income || 0,
        dailyExpenses: nation.treasury_daily_expenses || 0,
        netBalance: (nation.treasury_daily_income || 0) - (nation.treasury_daily_expenses || 0),
        goldReserve: nation.gold_reserve || 0,
        specialFunds: nation.special_funds || 0,
      },
      details: {
        workPermits: nation.work_permits || 0,
        mandateStart: nation.mandate_start ? new Date(nation.mandate_start).toLocaleString('it-IT') : '-',
        nextElections: nation.next_elections ? new Date(nation.next_elections).toLocaleString('it-IT') : '-',
        autonomies: nation.autonomies || 0,
        entryTax: nation.entry_tax || 0,
        borders: nation.borders_status || 'open',
        residenceToWork: nation.residence_to_work || 'Non necessaria',
        residence: nation.residence_policy || 'Aperta',
        energyProduction: nation.energy_production || 0,
        energyConsumption: nation.energy_consumption || 0,
        foundationDate: nation.foundation_date ? new Date(nation.foundation_date).toLocaleString('it-IT') : '-',
        ongoingWars: 0, // TODO: Link to wars table
      },
      bestDepartment: nation.best_department_name ? {
        name: nation.best_department_name,
        value: nation.best_department_value
      } : undefined,
      regions: (regions || []).map(r => ({
        id: r.id,
        name: r.name,
        population: resCountPerRegion[r.id] || 0,
        mainResource: (r as any).mainResource || (r as any).primary_resource || 'Risorse Varie',
        developmentLevel: r.developmentIndex || 0,
        governor: (r as any).governor ? (Array.isArray((r as any).governor) ? (r as any).governor[0]?.username : (r as any).governor?.username) : undefined
      })),
      militaryAgreements: (militaryAgreements || []).map(a => ({
        type: a.agreement_type,
        partnerName: a.partner?.name || 'Sconosciuto',
        partnerFlag: a.partner?.logo,
        status: a.status,
        expiresAt: a.expires_at ? new Date(a.expires_at).toLocaleDateString('it-IT') : undefined
      })),
      migrationAgreements: [], // TBD if separate table exists
      sanctions: (sanctions || []).map(s => ({
        type: regionIds.includes(s.targetStateId) ? 'sanction_received' : 'sanction_imposed',
        partnerName: regionIds.includes(s.targetStateId) ? s.sourceNation?.nation?.name : s.targetNation?.nation?.name,
        partnerFlag: regionIds.includes(s.targetStateId) ? s.sourceNation?.nation?.logo : s.targetNation?.nation?.logo,
        status: s.status,
        expiresAt: s.revokedAt ? new Date(s.revokedAt).toLocaleDateString('it-IT') : undefined
      })),
    };

    res.json(responseBody);
  } catch (err: any) {
    console.error("Error fetching state data:", err);
    res.status(500).json({ error: "Errore nel caricamento dei dati dello stato: " + err.message });
  }
});

app.get("/api/regions", authenticate, async (req, res) => {
  try {
    const { data: regions, error } = await supabase
      .from('regions')
      .select(`
        *,
        owner:users!ownerUserId(username),
        leader:users!leaderUserId(username, level)
      `);

    if (error) throw error;

    // Count players currently in each region
    const { data: userStats, error: userError } = await supabase
      .from('users')
      .select('regionId');
    
    const playerRegionCounts: Record<string, number> = {};
    if (!userError && userStats) {
      userStats.forEach((u: any) => {
        const rid = u.regionId;
        if (rid) playerRegionCounts[rid] = (playerRegionCounts[rid] || 0) + 1;
      });
    }

    const formatted = (regions || []).map(r => ({
      ...r,
      ownerName: r.owner?.username,
      leaderName: r.leader?.username,
      leaderLevel: r.leader?.level,
      playerCount: playerRegionCounts[r.id] || 0
    }));

    res.json(formatted);
  } catch (err: any) {
    console.error("Error fetching regions:", err);
    res.status(500).json({ error: "Errore nel caricamento delle regioni: " + err.message });
  }
});

app.get("/api/regions/:id", authenticate, async (req, res) => {
  try {
    const regionId = (req.params.id || '').toUpperCase().replace('NATION_', '');

    const { data: region, error } = await supabase
      .from('regions')
      .select(`
        *,
        owner:users!ownerUserId(username),
        leader:users!leaderUserId(username, level),
        governor:users!governorPlayerId(username),
        economicAdviser:users!economicAdviserId(username),
        nation:nations(*),
        factories:factories(count)
      `)
      .eq('id', regionId)
      .single();

    if (error || !region) return res.status(404).json({ error: "Regione non trovata" });

    // Get sibling regions
    const { data: memberRegions } = await supabase
      .from('regions')
      .select('id, name, population, isCapital, isAutonomous')
      .eq('nation_id', region.nation_id);

    // Count players in sibling regions
    const regionIds = (memberRegions || []).map(mr => mr.id);
    const { data: memberUserStats } = await supabase
      .from('users')
      .select('regionId')
      .in('regionId', regionIds);
    
    const memberPlayerCounts: Record<string, number> = {};
    (memberUserStats || []).forEach((u: any) => {
      memberPlayerCounts[u.regionId] = (memberPlayerCounts[u.regionId] || 0) + 1;
    });

    res.json({
      ...region,
      ownerName: region.owner?.username,
      leaderName: region.leader?.username,
      leaderLevel: region.leader?.level,
      governorName: region.governor?.username || null,
      economicAdviserName: region.economicAdviser?.username || null,
      citizenCount: memberPlayerCounts[regionId] || 0,
      memberRegions: (memberRegions || []).map(mr => ({
        ...mr,
        playerCount: memberPlayerCounts[mr.id] || 0
      }))
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/countries/:iso2", authenticate, async (req: any, res) => {
  const { iso2 } = req.params;
  if (!iso2 || iso2 === "-99") return res.status(400).json({ error: "Regione non disponibile" });

  try {
    const isoId = iso2.toUpperCase();

    // 1. Get region data from Supabase
    let { data: region, error } = await supabase
      .from('regions')
      .select(`
        *,
        owner:users!ownerUserId(username),
        leader:users!leaderUserId(username, level),
        governor:users!governorPlayerId(username),
        nation:nations(*)
      `)
      .eq('id', isoId)
      .single();

    if (error || !region) {
      // Auto-create in Supabase if missing (equivalent to SQLite Insert OR Ignore)
      const { data: newRegion, error: createError } = await supabase
        .from('regions')
        .insert({
          id: isoId,
          name: isoId,
          population: 1000000,
          health: 1,
          education: 1,
          military: 1,
          stability: 5
        })
        .select()
        .single();

      if (!createError) region = newRegion;
    }

    if (!region) return res.status(404).json({ error: "Regione non trovata" });

    // 2. Generate stats (simplified, should eventually be in a trigger)
    const gameStats = generateGameStatsForCountry(isoId);

    // 3. Get sibling regions
    const { data: memberRegions } = await supabase
      .from('regions')
      .select('id, name, population, isCapital, isAutonomous')
      .eq('nation_id', region.nation_id);


    // 2b. Count player citizens (users with regionId matching this region)
    const { count: citizenCount } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('regionId', isoId);
    // Count players in sibling regions
    const regionIds = (memberRegions || []).map(mr => mr.id);
    const { data: memberUserStats } = await supabase
      .from('users')
      .select('regionId')
      .in('regionId', regionIds);
    
    const memberPlayerCounts: Record<string, number> = {};
    (memberUserStats || []).forEach((u: any) => {
      memberPlayerCounts[u.regionId] = (memberPlayerCounts[u.regionId] || 0) + 1;
    });


    // 4. Construct response
    const response = {
      ...gameStats,
      ...region,
      ownerName: region.owner?.username,
      leaderName: region.leader?.username,
      leaderLevel: region.leader?.level,
      governorName: region.governor?.username || null,
      citizenCount: citizenCount || 0,
      memberRegions: (memberRegions || []).map(mr => ({
        ...mr,
        playerCount: memberPlayerCounts[mr.id] || 0
      })) || [region],
      indicators: {
        ...(gameStats?.indicators || {}),
        health: region.health || 1,
        education: region.education || 1,
        military: region.military || 1,
        stability: region.stability || 1
      }
    };

    res.json(response);
  } catch (err) {
    console.error("Error fetching country detail:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/countries/:iso2/agreements", authenticate, async (req: any, res) => {
  const { iso2 } = req.params;
  try {
    const stateId = iso2.toUpperCase();
    if (!isValidIso2(stateId)) return res.status(400).json({ error: "Codice paese non valido." });

    const { data: agreements, error } = await supabase
      .from('migration_agreements')
      .select('*, rf:regions!fromStateId(name), rt:regions!toStateId(name)')
      .or(`fromStateId.eq.${stateId},toStateId.eq.${stateId}`)
      .eq('status', 'ACTIVE')
      .order('activatedAt', { ascending: false });

    if (error) throw error;

    // Determine bilateral status locally: an agreement is bilateral if an inverse
    // (fromStateId ↔ toStateId swapped) active agreement also exists in the result set.
    const inverseSet = new Set(
      (agreements || []).map((ag: any) => `${ag.fromStateId}|${ag.toStateId}`)
    );

    const enriched = (agreements || []).map((ag: any) => {
      const partnerId = ag.fromStateId === stateId ? ag.toStateId : ag.fromStateId;
      const partnerName = ag.fromStateId === stateId ? ag.rt?.name : ag.rf?.name;
      const hasBilateral = inverseSet.has(`${ag.toStateId}|${ag.fromStateId}`);

      return {
        ...ag,
        partnerId,
        partnerName,
        direction: ag.fromStateId === stateId ? 'OUTGOING' : 'INCOMING',
        agreementType: hasBilateral ? 'BILATERAL' : 'UNILATERAL'
      };
    });

    res.json({
      outgoing: enriched.filter(a => a.direction === 'OUTGOING'),
      incoming: enriched.filter(a => a.direction === 'INCOMING')
    });
  } catch (err) {
    console.error("Error fetching agreements:", err);
    res.status(500).json({ error: "Errore caricamento accordi." });
  }
});

/// Market API (Supabase)
app.get("/api/market/listings", authenticate, async (req: any, res) => {
  const { data: listings, error } = await supabase
    .from('market_offers')
    .select('*')
    .order('createdAt', { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ error: error.message });
  res.json(listings || []);
});

app.post("/api/market/listings", authenticate, async (req: any, res) => {
  const { itemName, quantity, price } = req.body;
  const user = req.user;

  if (!itemName || !quantity || !price || quantity <= 0 || price <= 0) {
    return res.status(400).json({ error: "Dati non validi." });
  }

  try {
    const offerId = generateSecureId(9);
    await supabase.from('market_offers').insert({
      id: offerId,
      sellerId: user.id,
      sellerName: user.username,
      itemId: itemName,
      quantity,
      price,
      regionId: user.regionId,
      originStateId: user.originalNation || user.regionId,
      createdAt: new Date().toISOString()
    });

    res.json({ success: true, offerId });
  } catch (err) {
    res.status(500).json({ error: "Errore durante la creazione dell'offerta." });
  }
});

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
  // We use an RPC 'add_budget_transaction' defined in schema.sql to ensure atomicity
  const { data, error } = await supabase.rpc('add_budget_transaction', {
    p_owner_type: ownerType,
    p_owner_id: ownerId,
    p_type: type,
    p_subtype: subtype,
    p_money_delta: moneyDelta,
    p_resources_delta: resourcesDelta,
    p_created_by: createdByUserId,
    p_metadata: metadata
  });

  if (error) throw error;
  return data;
}

app.post("/api/actions/work", authenticate, async (req: any, res) => {
  const user = req.user;
  const userRegion = user.region_id || 'IT';

  const { factoryId } = req.body;

  // 1. Get Factory Data
  const { data: factory, error: fError } = await supabase
    .from('factories')
    .select('*')
    .eq('id', factoryId)
    .single();

  if (fError || !factory) return res.status(404).json({ error: "Nessuna fabbrica trovata" });
  const factoryMinLevel = factory.minLevel ?? 1;
  if (user.level < factoryMinLevel) return res.status(400).json({ error: `Richiede livello ${factoryMinLevel}` });
  if (factory.isActive === false) return res.status(400).json({ error: "Fabbrica non attiva." });

  // 2. Check Immigration/Work Restrictions
  const { data: regionRel, error: rError } = await supabase
    .from('regions')
    .select('*')
    .eq('id', userRegion)
    .single();

  const restrictionsActive = regionRel?.workRestrictions === 1;
  const isResident = user.residence_id === userRegion;
  const hasWorkPermit = user.work_permit_id === userRegion;

  if (restrictionsActive && !isResident && !hasWorkPermit) {
    return res.status(403).json({ error: "Questa nazione richiede un Permesso di Lavoro per operare fabbriche statali." });
  }

  // 3. Cooldown Check (Using RPC or simple query)
  const { data: cooldownData } = await supabase
    .from('user_factory_cooldowns')
    .select('lastUsed')
    .eq('userId', user.id)
    .eq('factoryId', factoryId)
    .single();

  if (cooldownData && Date.now() - new Date(cooldownData.lastUsed).getTime() < factory.cooldownSec * 1000) {
    return res.status(400).json({ error: "Factory on cooldown" });
  }

  // 4. Energy and Perks Logic
  const perks = user.perks || {};
  const resistenza = perks['RESISTENZA'] || 0;
  const energyReduction = Math.min(0.5, resistenza / 100);
  // Regional Health Index reduces energy cost (capped at 10%)
  const healthLevel = (regionRel?.healthIndex || 0) as number;
  const healthRegionReduction = Math.min(0.10, healthLevel * AUTONOMY_CONFIG.INDEX_EFFECTS.health.energyCostReductionPerLevel);
  const energyCost = Math.ceil((factory.energyCost ?? 10) * (1 - energyReduction - healthRegionReduction));

  if (user.energy < energyCost) return res.status(400).json({ error: "Not enough energy" });

  const forzaBoost = (perks['FORZA'] || 0) * 0.03;
  const taxRate = regionRel?.marketTaxRate !== undefined ? regionRel.marketTaxRate : FACTORY_CONFIG.DEFAULT_INDUSTRY_TAX_RATE;

  // 5. Determine factory category and calculate outputs
  const factoryType = factory.type || '';
  const typeDef = FACTORY_CONFIG.TYPES[factoryType];
  const isGoldMine = typeDef?.category === 'gold';
  const level = factory.level || 1;
  const yieldMult = factoryYieldMultiplier(level);

  let netEarningsMoney = 0;
  let netEarningsGold = 0;
  let playerResourceOutput = 0;
  let stateResourceOutput = 0;
  let ownerCut = 0;
  let grossValue = 0;

  if (isGoldMine) {
    // Gold mine: dual payout (money + gold)
    const baseMoney = Math.floor(FACTORY_CONFIG.GOLD_MINE_MONEY_PER_WORK * yieldMult * (1 + forzaBoost));
    const baseGold = Math.round(FACTORY_CONFIG.GOLD_MINE_GOLD_PER_WORK * yieldMult * 100) / 100;
    const moneyTax = Math.floor(baseMoney * (taxRate / 100));
    const goldTax = Math.round(baseGold * (taxRate / 100) * 100) / 100;
    netEarningsMoney = baseMoney - moneyTax;
    netEarningsGold = Math.round((baseGold - goldTax) * 100) / 100;
    ownerCut = Math.floor(baseMoney * FACTORY_CONFIG.OWNER_PROFIT_RATE);
    grossValue = baseMoney;
  } else if (factory.payMode === 'salary') {
    // Salary mode: pay fixed wage from budget
    const earnings = Math.floor((factory.payoutMoney ?? factory.wage ?? 50) * (1 + forzaBoost));
    const taxes = Math.floor(earnings * (taxRate / 100));
    netEarningsMoney = earnings - taxes;
    grossValue = earnings;
    ownerCut = 0; // salary mode: no owner cut, paid from budget
  } else {
    // Resource mode: mine resources
    const resourceTypes = Object.keys(FACTORY_CONFIG.TYPES).filter(k => FACTORY_CONFIG.TYPES[k].category === 'resource');
    if (resourceTypes.includes(factoryType)) {
      let bonusMult = 1.0;
      if (factoryType === 'oil') bonusMult = regionRel?.oilBonus || 1.0;
      else if (factoryType === 'minerals') bonusMult = regionRel?.mineralsBonus || 1.0;
      else if (factoryType === 'uranium') bonusMult = regionRel?.uraniumBonus || 1.0;
      else if (factoryType === 'diamonds') bonusMult = regionRel?.diamondsBonus || 1.0;

      const resourceOutput = Math.max(1, Math.floor(level * FACTORY_CONFIG.BASE_RESOURCE_OUTPUT * bonusMult * (1 + forzaBoost)));
      stateResourceOutput = Math.floor(resourceOutput * (taxRate / 100));
      ownerCut = Math.floor(resourceOutput * FACTORY_CONFIG.OWNER_PROFIT_RATE);
      playerResourceOutput = resourceOutput - stateResourceOutput - ownerCut;
      if (playerResourceOutput < 0) playerResourceOutput = 0;
      grossValue = resourceOutput * (FACTORY_CONFIG.RESOURCE_VALUES[typeDef?.resource || ''] || 1);

      // Check storage capacity
      const storageLimit = factoryStorageLimit(factoryType, level);
      const currentStorage = factory.currentStorage || 0;
      if (storageLimit > 0 && currentStorage + ownerCut > storageLimit) {
        return res.status(400).json({ error: `Magazzino pieno! Capacità: ${storageLimit.toLocaleString()}, Attuale: ${currentStorage.toLocaleString()}` });
      }
    }
  }

  try {
    if (isGoldMine) {
      // Gold mine: deduct energy, add money and gold to worker
      const { error: energyErr } = await supabase.rpc('safe_deduct_currency', {
        p_user_id: user.id,
        p_money_cost: -netEarningsMoney,  // negative cost = add money
        p_gold_cost: netEarningsGold >= 1 ? -Math.floor(netEarningsGold) : 0,
        p_energy_cost: energyCost,
      });
      if (energyErr) throw energyErr;

      // Owner profit: atomically increment owner's money
      if (ownerCut > 0 && factory.ownerUserId !== user.id) {
        await supabase.rpc('safe_deduct_currency', {
          p_user_id: factory.ownerUserId,
          p_money_cost: -ownerCut,  // negative cost = add money
          p_gold_cost: 0,
          p_energy_cost: 0,
        });
      }
      // Tax to region
      const moneyTax = Math.floor(FACTORY_CONFIG.GOLD_MINE_MONEY_PER_WORK * yieldMult * (1 + forzaBoost) * (taxRate / 100));
      if (moneyTax > 0) {
        await supabase.rpc('add_budget_transaction', {
          p_owner_type: 'REGION',
          p_owner_id: userRegion,
          p_type: 'INCOME',
          p_subtype: 'INDUSTRY_TAX',
          p_money_delta: moneyTax,
          p_metadata: { factoryType: 'gold', factoryId }
        });
      }
    } else {
      // Perform updates via a custom RPC to ensure atomicity
      const { error: workError } = await supabase.rpc('process_work_action', {
        p_user_id: user.id,
        p_factory_id: factoryId,
        p_energy_cost: energyCost,
        p_net_earnings: netEarningsMoney,
        p_taxes: Math.floor(grossValue * (taxRate / 100)),
        p_region_id: userRegion
      });

      if (workError) throw workError;

      // Resource distribution: player gets resources minus state tax and owner cut
      if (playerResourceOutput > 0) {
        const { data: existingInv } = await supabase.from('user_inventory')
          .select('quantity').eq('userId', user.id).eq('itemId', factoryType).maybeSingle();
        if (existingInv) {
          await supabase.from('user_inventory')
            .update({ quantity: existingInv.quantity + playerResourceOutput })
            .eq('userId', user.id).eq('itemId', factoryType);
        } else {
          await supabase.from('user_inventory')
            .insert({ userId: user.id, itemId: factoryType, quantity: playerResourceOutput });
        }
      }

      // Owner gets resource cut into factory storage (handled atomically below)

      // State gets resource tax via budget transaction
      if (stateResourceOutput > 0) {
        await supabase.rpc('add_budget_transaction', {
          p_owner_type: 'REGION',
          p_owner_id: userRegion,
          p_type: 'INCOME',
          p_subtype: 'RESOURCE_TAX',
          p_money_delta: 0,
          p_resources_delta: { [factoryType]: stateResourceOutput },
          p_metadata: { resource: factoryType, quantity: stateResourceOutput, factoryId }
        });
      }
    }

    // Atomically update factory economy counters and storage (prevents race conditions)
    const productionCount = isGoldMine ? grossValue : (playerResourceOutput + stateResourceOutput + ownerCut);
    const storageDelta = (!isGoldMine && ownerCut > 0) ? ownerCut : 0;
    await supabase.rpc('increment_factory_counters', {
      p_factory_id: factoryId,
      p_worker_count: 1,
      p_production: productionCount,
      p_owner_profit: ownerCut,
      p_taxes_paid: Math.floor(grossValue * (taxRate / 100)),
      p_storage_delta: storageDelta,
    });

    // Log economy daily aggregate
    try {
      await supabase.rpc('upsert_factory_economy_log', {
        p_factory_id: factoryId,
        p_gross_income: grossValue,
        p_taxes_paid: Math.floor(grossValue * (taxRate / 100)),
        p_owner_profit: ownerCut,
        p_production: productionCount,
      });
    } catch { /* non-critical */ }

    // Log worker action
    try {
      await supabase.from('factory_worker_logs').insert({
        factoryId: factoryId,
        workerId: user.id,
        earningsMoney: netEarningsMoney,
        earningsGold: netEarningsGold,
        resourceType: isGoldMine ? null : (playerResourceOutput > 0 ? factoryType : null),
        resourceAmount: isGoldMine ? 0 : playerResourceOutput,
        ownerCut: ownerCut,
      });
    } catch { /* non-critical */ }

    // Update cooldown
    await supabase.from('user_factory_cooldowns').upsert({
      userId: user.id,
      factoryId: factoryId,
      lastUsed: new Date().toISOString(),
    }, { onConflict: 'userId,factoryId' });

    // XP Gain — boosted by regional Education Index
    const educationLevel = (regionRel?.educationIndex || 0) as number;
    const educationBonus = educationLevel * AUTONOMY_CONFIG.INDEX_EFFECTS.education.xpBonusPerLevel;
    const xpGain = Math.round((GAME_CONFIG.XP_PER_WORK + (perks['ISTRUZIONE'] || 0) * 2) * (1 + educationBonus));
    await addXP(user.id, xpGain);

    // Work Experience Gain — increment per-resource work experience
    let workExpGain = 0;
    const WORK_EXP_PER_ISTRUZIONE_LEVEL = 0.5;
    if (!isGoldMine && factoryType) {
      workExpGain = 1 + Math.floor((perks['ISTRUZIONE'] || 0) * WORK_EXP_PER_ISTRUZIONE_LEVEL);
      try {
        await incrementPlayerWorkExperience(user.id, factoryType, workExpGain);
      } catch (expErr) {
        console.error("Work experience increment failed (non-critical):", expErr);
      }
    }

    res.json({ 
      success: true, 
      earnings: netEarningsMoney,
      goldEarnings: netEarningsGold,
      taxes: Math.floor(grossValue * (taxRate / 100)), 
      energyCost, 
      xpGain,
      workExpGain,
      ownerCut,
      isGoldMine,
      payMode: factory.payMode,
      resourceOutput: playerResourceOutput > 0 ? { type: factoryType, player: playerResourceOutput, state: stateResourceOutput, ownerCut } : null
    });

    // ── Daily Missions: update work-related progress (non-blocking) ──
    try {
      await updateMissionProgress(user.id, 'WORK', {
        work_times: 1,
        earn_money: netEarningsMoney,
        earn_gold: netEarningsGold,
        produce_resources: playerResourceOutput > 0 ? playerResourceOutput : 0,
        start_production: 1,
        spend_energy: energyCost,
      });
      await updateMissionProgress(user.id, 'EARN_XP', { earn_xp: xpGain });
    } catch { /* non-critical */ }
  } catch (err: any) {
    console.error("Work execution failed:", err);
    res.status(500).json({ error: "Errore durante il lavoro: " + err.message });
  }
});


app.get("/api/factories", authenticate, async (req: any, res) => {
  const regionId = (req.query.regionId as string) || req.user.regionId || 'IT';
  
  // Try exact match first, then also match sub-regions (e.g., "IT" matches "IT" and "IT-RM")
  let { data: factories, error } = await supabase.from('factories').select('*').eq('regionId', regionId);
  
  if (!error && (!factories || factories.length === 0) && regionId.length <= 3) {
    // No exact match found and regionId looks like a country code - try prefix match for sub-regions
    const { data: subFactories, error: subErr } = await supabase.from('factories').select('*').like('regionId', `${regionId}-%`);
    if (!subErr && subFactories && subFactories.length > 0) {
      factories = subFactories;
    }
  }

  if (error) {
    console.error("Error fetching factories:", error);
    return res.status(500).json({ error: "Errore nel caricamento delle fabbriche." });
  }

  const { data: cooldowns } = await supabase.from('user_factory_cooldowns').select('factoryId, lastUsed').eq('userId', req.user.id);

  // Batch fetch all owner usernames in a single query
  const ownerIds = [...new Set((factories || []).map(f => f.ownerUserId).filter(Boolean))];
  const ownerMap = new Map<string, string>();
  if (ownerIds.length > 0) {
    const { data: owners } = await supabase.from('users').select('id, username').in('id', ownerIds);
    (owners || []).forEach((o: any) => ownerMap.set(o.id, o.username));
  }

  const cooldownMap = new Map((cooldowns || []).map(c => [c.factoryId, c]));
  const factoriesWithCooldown = (factories || []).map(f => {
    const cd = cooldownMap.get(f.id);
    const lastUsed = cd ? new Date(cd.lastUsed).getTime() : 0;
    const remaining = cd ? Math.max(0, (f.cooldownSec * 1000) - (Date.now() - lastUsed)) : 0;
    const ownerName = ownerMap.get(f.ownerUserId) || 'Sconosciuto';
    return { ...f, ownerName, remainingCooldown: remaining };
  });

  res.json(factoriesWithCooldown);
});

// Create a new player-owned factory
app.post("/api/factories/create", authenticate, async (req: any, res) => {
  const user = req.user;

  try {
    const result = await factoryCreateService.createFactory(user.id, req.body || {});

    const http = mapServiceResultToHttp(result);
    return res.status(http.statusCode).json(http.body);
  } catch (err: any) {
    res.status(500).json({ error: "Errore nella creazione: " + err.message });
  }
});

// Deposit money into a factory's budget
app.post("/api/factories/deposit", authenticate, async (req: any, res) => {
  const user = req.user;
  const { factoryId, amount } = req.body;

  const numAmount = Number(amount);
  if (!factoryId || !Number.isFinite(numAmount) || numAmount <= 0 || Math.floor(numAmount) !== numAmount) {
    return res.status(400).json({ error: "Parametri non validi." });
  }

  if (user.money < numAmount) return res.status(400).json({ error: "Fondi insufficienti." });

  try {
    const result = await factoryEconomyService.depositFactoryBudget(user.id, factoryId, numAmount);

    if (result.type === 'success') {
      return res.json({ success: true, newBudget: result.payload.newBudget });
    }

    const http = mapServiceResultToHttp(result);
    return res.status(http.statusCode).json(http.body);
  } catch (err: any) {
    res.status(500).json({ error: "Errore nel deposito: " + err.message });
  }
});

// Toggle factory pay mode (salary vs resource)
app.post("/api/factories/paymode", authenticate, async (req: any, res) => {
  const user = req.user;
  const { factoryId, payMode } = req.body;

  if (!factoryId || !['salary', 'resource'].includes(payMode)) {
    return res.status(400).json({ error: "Parametri non validi." });
  }

  const { data: factory } = await supabase.from('factories').select('*').eq('id', factoryId).single();
  if (!factory) return res.status(404).json({ error: "Fabbrica non trovata." });
  if (factory.ownerUserId !== user.id) return res.status(403).json({ error: "Non sei il proprietario." });

  try {
    await supabase.from('factories').update({ payMode }).eq('id', factoryId);
    res.json({ success: true, payMode });
  } catch (err: any) {
    res.status(500).json({ error: "Errore nel cambio modalità: " + err.message });
  }
});

// Get factory upgrade cost preview
app.get("/api/factories/upgrade-cost", authenticate, async (req: any, res) => {
  const currentLevel = parseInt(req.query.currentLevel as string) || 1;
  const targetLevel = parseInt(req.query.targetLevel as string);

  if (!targetLevel || targetLevel <= currentLevel || targetLevel > 800) {
    return res.status(400).json({ error: "Livello target non valido." });
  }

  try {
    const { data: currentRow } = await supabase
      .from('factory_upgrade_costs')
      .select('aggregate_cost')
      .eq('level_to', currentLevel)
      .maybeSingle();

    const { data: targetRow } = await supabase
      .from('factory_upgrade_costs')
      .select('aggregate_cost')
      .eq('level_to', targetLevel)
      .maybeSingle();

    if (!targetRow) return res.status(400).json({ error: "Livello target non trovato nella tabella costi." });

    const currentAgg = currentRow?.aggregate_cost || 0;
    const goldCost = targetRow.aggregate_cost - currentAgg;

    res.json({ currentLevel, targetLevel, goldCost, currency: 'GOLD' });
  } catch (err: any) {
    res.status(500).json({ error: "Errore nel calcolo costo: " + err.message });
  }
});

// Upgrade factory level using Gold (transactional RPC)
app.post("/api/factories/upgrade", authenticate, async (req: any, res) => {
  const user = req.user;
  const { factoryId, targetLevel } = req.body;

  try {
    const result = await factoryUpgradeService.upgradeFactory(user.id, factoryId, targetLevel);

    const http = mapServiceResultToHttp(result);
    if (result.type === 'success') {
      res.status(http.statusCode).json(http.body);

      // ── Daily Missions: factory upgrade progress (non-blocking) ──
      try { await updateMissionProgress(user.id, 'FACTORY_UPGRADE', { upgrade_factory: 1 }); } catch { /* non-critical */ }
      return;
    }

    return res.status(http.statusCode).json(http.body);
  } catch (err: any) {
    res.status(500).json({ error: "Errore nell'upgrade: " + err.message });
  }
});



// ── All factories (world view) ──────────────
app.get("/api/factories/all", authenticate, async (req: any, res) => {
  try {
    const { data: factories, error } = await supabase.from('factories')
      .select('*')
      .order('level', { ascending: false })
      .limit(100);
    
    if (error) throw error;

    const ownerIds = [...new Set((factories || []).map((f: any) => f.ownerUserId).filter(Boolean))];
    const ownerMap: Record<string, string> = {};
    if (ownerIds.length > 0) {
      const { data: owners } = await supabase.from('users').select('id, username').in('id', ownerIds);
      (owners || []).forEach((o: any) => { ownerMap[o.id] = o.username; });
    }

    const enriched = (factories || []).map((f: any) => {
      const typeDef = FACTORY_CONFIG.TYPES[f.type] || {};
      return {
        ...f,
        ownerName: ownerMap[f.ownerUserId] || 'Sconosciuto',
        typeDef,
        yieldMultiplier: Math.round(factoryYieldMultiplier(f.level || 1) * 100) / 100,
        storageCapacity: factoryStorageLimit(f.type, f.level || 1),
        estimatedValue: estimateFactoryValue(f.type, f.level || 1),
      };
    });

    res.json(enriched);
  } catch (error: any) {
    console.error("[/api/factories/all] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ── Factory Detail Endpoint ──────────────────────────────

app.get("/api/factories/:id", authenticate, async (req: any, res) => {
  const { id } = req.params;
  try {
    const { data: factory, error } = await supabase.from('factories').select('*').eq('id', id).single();
    if (error || !factory) return res.status(404).json({ error: "Fabbrica non trovata." });

    // Get owner name
    const { data: owner } = await supabase.from('users').select('username').eq('id', factory.ownerUserId).single();

    // Get economy logs (last 7 days)
    const { data: econLogs } = await supabase.from('factory_economy_logs')
      .select('*')
      .eq('factoryId', id)
      .order('logDate', { ascending: false })
      .limit(7);

    // Get recent worker logs (last 20)
    const { data: workerLogs } = await supabase.from('factory_worker_logs')
      .select('*')
      .eq('factoryId', id)
      .order('workedAt', { ascending: false })
      .limit(20);

    // Get worker names
    const workerIds = [...new Set((workerLogs || []).map((w: any) => w.workerId))];
    const workerNameMap: Record<string, string> = {};
    if (workerIds.length > 0) {
      const { data: workers } = await supabase.from('users').select('id, username').in('id', workerIds);
      (workers || []).forEach((w: any) => { workerNameMap[w.id] = w.username; });
    }

    const typeDef = FACTORY_CONFIG.TYPES[factory.type] || {};
    const level = factory.level || 1;
    const yieldMult = factoryYieldMultiplier(level);
    const storageCap = factoryStorageLimit(factory.type, level);
    const storagePerLevel = FACTORY_CONFIG.STORAGE_PER_LEVEL[factory.type] || 0;

    // Calculate average daily profit for valuation
    const recentProfit = (econLogs || []).length > 0
      ? (econLogs || []).reduce((sum: number, l: any) => sum + (l.ownerProfit || 0), 0) / (econLogs || []).length
      : 0;
    const estimatedValue = estimateFactoryValue(factory.type, level, recentProfit);

    // Market listing status
    const { data: listing } = await supabase.from('factory_market_listings')
      .select('*')
      .eq('factoryId', id)
      .eq('status', 'active')
      .maybeSingle();

    res.json({
      ...factory,
      ownerName: owner?.username || 'Sconosciuto',
      typeDef,
      yieldMultiplier: Math.round(yieldMult * 100) / 100,
      storageCapacity: storageCap,
      storagePerLevel,
      storagePercent: storageCap > 0 ? Math.round(((factory.currentStorage || 0) / storageCap) * 100) : 0,
      estimatedValue,
      economyLogs: (econLogs || []),
      recentWorkers: (workerLogs || []).map((w: any) => ({ ...w, workerName: workerNameMap[w.workerId] || 'Sconosciuto' })),
      activeListing: listing || null,
      nextLevelYield: Math.round(factoryYieldMultiplier(level + 1) * 100) / 100,
      nextLevelStorage: factoryStorageLimit(factory.type, level + 1),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Errore nel caricamento dettaglio: " + err.message });
  }
});

// ── Factory Market: List factories for sale ──────────────
app.get("/api/factory-market", authenticate, async (req: any, res) => {
  try {
    const { data: listings, error } = await supabase.from('factory_market_listings')
      .select('*')
      .eq('status', 'active')
      .order('listedAt', { ascending: false });

    if (error) throw error;

    // Get all factory details
    const factoryIds = (listings || []).map((l: any) => l.factoryId);
    let factoryMap: Record<string, any> = {};
    if (factoryIds.length > 0) {
      const { data: factories } = await supabase.from('factories').select('*').in('id', factoryIds);
      (factories || []).forEach((f: any) => { factoryMap[f.id] = f; });
    }

    // Get seller names
    const sellerIds = [...new Set((listings || []).map((l: any) => l.sellerId))];
    const sellerMap: Record<string, string> = {};
    if (sellerIds.length > 0) {
      const { data: sellers } = await supabase.from('users').select('id, username').in('id', sellerIds);
      (sellers || []).forEach((s: any) => { sellerMap[s.id] = s.username; });
    }

    const enriched = (listings || []).map((l: any) => {
      const factory = factoryMap[l.factoryId] || {};
      const typeDef = FACTORY_CONFIG.TYPES[factory.type] || {};
      return {
        ...l,
        sellerName: sellerMap[l.sellerId] || 'Sconosciuto',
        factory: {
          ...factory,
          typeDef,
          yieldMultiplier: Math.round(factoryYieldMultiplier(factory.level || 1) * 100) / 100,
          storageCapacity: factoryStorageLimit(factory.type, factory.level || 1),
          estimatedValue: estimateFactoryValue(factory.type, factory.level || 1),
        },
      };
    });

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: "Errore nel caricamento mercato: " + err.message });
  }
});

// ── Factory Market: List a factory for sale ──────────────
app.post("/api/factory-market/list", authenticate, async (req: any, res) => {
  const user = req.user;
  const { factoryId, askingPrice } = req.body;

  if (!factoryId || !askingPrice || askingPrice <= 0) {
    return res.status(400).json({ error: "Parametri non validi." });
  }

  const { data: factory } = await supabase.from('factories').select('*').eq('id', factoryId).single();
  if (!factory) return res.status(404).json({ error: "Fabbrica non trovata." });
  if (factory.ownerUserId !== user.id) return res.status(403).json({ error: "Non sei il proprietario." });
  if (factory.listedForSale) return res.status(400).json({ error: "Fabbrica già in vendita." });

  try {
    // Create listing
    const { data: listing, error: listErr } = await supabase.from('factory_market_listings').insert({
      factoryId,
      sellerId: user.id,
      askingPrice: Math.floor(askingPrice),
      status: 'active',
    }).select().single();
    if (listErr) throw listErr;

    // Mark factory as listed
    await supabase.from('factories').update({ listedForSale: true, salePrice: Math.floor(askingPrice) }).eq('id', factoryId);

    res.json({ success: true, listing });
  } catch (err: any) {
    res.status(500).json({ error: "Errore nella creazione annuncio: " + err.message });
  }
});

// ── Factory Market: Buy a listed factory ──────────────
app.post("/api/factory-market/buy", authenticate, async (req: any, res) => {
  const user = req.user;
  const { listingId } = req.body;

  if (!listingId) return res.status(400).json({ error: "ID annuncio mancante." });

  try {
    const { data: listing } = await supabase.from('factory_market_listings')
      .select('*').eq('id', listingId).eq('status', 'active').single();

    if (!listing) return res.status(404).json({ error: "Annuncio non trovato o non più attivo." });
    if (listing.sellerId === user.id) return res.status(400).json({ error: "Non puoi comprare la tua stessa fabbrica." });

    const { data: result, error } = await supabase.rpc('transfer_factory_ownership', {
      p_factory_id: listing.factoryId,
      p_seller_id: listing.sellerId,
      p_buyer_id: user.id,
      p_price: listing.askingPrice,
      p_listing_id: listingId,
    });

    if (error) throw error;
    const parsed = typeof result === 'string' ? JSON.parse(result) : result;
    if (parsed?.error) return res.status(400).json({ error: parsed.error });

    res.json({ success: true, ...parsed });
  } catch (err: any) {
    res.status(500).json({ error: "Errore nell'acquisto: " + err.message });
  }
});

// ── Factory Market: Cancel listing ──────────────
app.post("/api/factory-market/cancel", authenticate, async (req: any, res) => {
  const user = req.user;
  const { listingId } = req.body;

  if (!listingId) return res.status(400).json({ error: "ID annuncio mancante." });

  try {
    const { data: listing } = await supabase.from('factory_market_listings')
      .select('*').eq('id', listingId).eq('status', 'active').single();

    if (!listing) return res.status(404).json({ error: "Annuncio non trovato." });
    if (listing.sellerId !== user.id) return res.status(403).json({ error: "Non sei il venditore." });

    await supabase.from('factory_market_listings').update({ status: 'cancelled' }).eq('id', listingId);
    await supabase.from('factories').update({ listedForSale: false, salePrice: 0 }).eq('id', listing.factoryId);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Errore nell'annullamento: " + err.message });
  }
});


app.post("/api/actions/propaganda", authenticate, async (req: any, res) => {
  const user = req.user;
  const { regionId } = req.body;
  const perks = user.perks || {};

  if (!regionId) return res.status(400).json({ error: "Region ID required" });

  const energyEfficiency = (perks['RESISTENZA'] || 0) * 0.005;
  const energyCost = Math.ceil(GAME_CONFIG.PROPAGANDA_ENERGY_COST * (1 - energyEfficiency));

  if (user.energy < energyCost) return res.status(400).json({ error: "Not enough energy" });

  // Cooldown check via Supabase
  const { data: lastProp } = await supabase
    .from('cooldowns')
    .select('last_used')
    .eq('user_id', user.id)
    .eq('action_type', 'propaganda')
    .single();

  if (lastProp && Date.now() - new Date(lastProp.last_used).getTime() < GAME_CONFIG.PROPAGANDA_COOLDOWN) {
    return res.status(400).json({ error: "Action on cooldown" });
  }

  const influenceGain = 5 + Math.floor(Math.random() * 5);

  try {
    // Perform updates
    await supabase.from('users').update({
      energy: user.energy - energyCost
    }).eq('id', user.id);

    await supabase.rpc('update_region_stability', { p_region_id: regionId, p_delta: 10 });

    await supabase.from('cooldowns').upsert({
      user_id: user.id,
      action_type: 'propaganda',
      last_used: new Date().toISOString()
    });

    await addXP(user.id, GAME_CONFIG.XP_PER_PROPAGANDA);

    res.json({ success: true, influenceGain });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/actions/invest", authenticate, async (req: any, res) => {
  const user = req.user;
  const { regionId } = req.body;
  const perks = user.perks || {};

  const moneyCost = GAME_CONFIG.INVEST_MONEY_COST;
  const energyEfficiency = (perks['RESISTENZA'] || 0) * 0.005;
  const energyCost = Math.ceil(GAME_CONFIG.INVEST_ENERGY_COST * (1 - energyEfficiency));

  if (user.money < moneyCost) return res.status(400).json({ error: "Not enough money" });
  if (user.energy < energyCost) return res.status(400).json({ error: "Not enough energy" });

  try {
    // Atomic currency + energy deduction
    const { data: deductResult, error: deductError } = await supabase.rpc('safe_deduct_currency', {
      p_user_id: user.id,
      p_money_cost: moneyCost,
      p_gold_cost: 0,
      p_energy_cost: energyCost,
    });
    if (deductError) throw deductError;
    const deductData = typeof deductResult === 'string' ? JSON.parse(deductResult) : deductResult;
    if (deductData?.error) return res.status(400).json({ error: deductData.error });

    // Update region stats (stability, population, economy)
    await supabase.rpc('process_invest_action', {
      p_region_id: regionId,
      p_stability_delta: 5,
      p_pop_delta: 1000,
      p_economy_delta: 3
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/actions/craft-drink", authenticate, async (req: any, res) => {
  const user = req.user;
  const cost = GAME_CONFIG.ENERGY_DRINK_COST_GOLD;
  if (user.gold < cost) return res.status(400).json({ error: `Oro insufficiente. Ti servono 🪙 ${cost}.` });

  try {
    // Atomic gold deduction to prevent race conditions
    const { data: deductResult, error: deductError } = await supabase.rpc('safe_deduct_currency', {
      p_user_id: user.id,
      p_money_cost: 0,
      p_gold_cost: cost,
      p_energy_cost: 0,
    });
    if (deductError) throw deductError;
    const deductData = typeof deductResult === 'string' ? JSON.parse(deductResult) : deductResult;
    if (deductData?.error) return res.status(400).json({ error: deductData.error });

    // Now add the drink
    const { data, error } = await supabase
      .from('users')
      .update({
        energyDrinks: (user.energyDrinks || 0) + 1
      })
      .eq('id', user.id)
      .select('energyDrinks')
      .single();

    if (error) throw error;
    res.json({ success: true, energyDrinks: data.energyDrinks });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/actions/use-drink", authenticate, async (req: any, res) => {
  const user = req.user;
  const now = Date.now();

  try {
    const { data: freshUser, error: readError } = await supabase
      .from('users')
      .select('energyDrinks, lastEnergyDrink')
      .eq('id', user.id)
      .single();
    if (readError) throw readError;

    if ((freshUser.energyDrinks || 0) <= 0) {
      return res.status(400).json({ error: "Non hai Energy Drinks disponibili nell'inventario." });
    }

    const elapsed = now - (freshUser.lastEnergyDrink || 0);
    if (elapsed < GAME_CONFIG.ENERGY_DRINK_COOLDOWN) {
      const remainingMin = Math.ceil((GAME_CONFIG.ENERGY_DRINK_COOLDOWN - elapsed) / 60000);
      return res.status(400).json({ error: `Drink in cooldown. Attendi altri ${remainingMin} minuti.` });
    }

    let updateQuery = supabase
      .from('users')
      .update({
        energyDrinks: freshUser.energyDrinks - 1,
        energy: GAME_CONFIG.ENERGY_MAX,
        lastEnergyDrink: now
      })
      .eq('id', user.id)
      .eq('energyDrinks', freshUser.energyDrinks);

    if (freshUser.lastEnergyDrink == null) {
      updateQuery = updateQuery.is('lastEnergyDrink', null);
    } else {
      updateQuery = updateQuery.eq('lastEnergyDrink', freshUser.lastEnergyDrink);
    }

    const { data: updatedUsers, error: updateError } = await updateQuery.select('id');
    if (updateError) throw updateError;
    if (!updatedUsers || updatedUsers.length === 0) {
      return res.status(409).json({ error: "Conflitto durante l'utilizzo del drink. Riprova." });
    }

    res.json({ success: true, newEnergy: GAME_CONFIG.ENERGY_MAX });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Residence and Permits API ---

app.post("/api/actions/travel", authenticate, async (req: any, res) => {
  const user = req.user;
  const { regionId } = req.body;
  if (!regionId) return res.status(400).json({ error: "Nessuna destinazione specificata." });
  const normalizedRegionId = String(regionId).trim().toUpperCase();
  if (!isValidIso2(normalizedRegionId)) return res.status(400).json({ error: "Regione non valida." });
  if (user.regionId === normalizedRegionId) return res.status(400).json({ error: "Sei già in questa regione." });

  // Block travel if already traveling
  if (user.travelingUntil && Date.now() < user.travelingUntil) {
    const remainingMin = Math.ceil((user.travelingUntil - Date.now()) / 60000);
    return res.status(400).json({ error: `Sei già in viaggio verso ${user.travelingTo}. Arrivo tra ${remainingMin} minuti.` });
  }

  // 1. Fetch target region info (use * to avoid errors if optional columns are missing)
  const { data: targetRegion, error: regionError } = await supabase
    .from('regions')
    .select('*')
    .eq('id', normalizedRegionId)
    .single();

  if (regionError || !targetRegion) return res.status(404).json({ error: "Regione non trovata." });

  let isRestricted = targetRegion.workRestrictions === 1;
  let travelFee = targetRegion.travelFee || 0;
  const sourceStateId = user.residenceId || user.regionId;

  // 2. Bloc check
  const [{ data: userBloc }, { data: targetBloc }] = await Promise.all([
    supabase.from('bloc_memberships').select('blocId').eq('stateId', sourceStateId).eq('status', 'active').maybeSingle(),
    supabase.from('bloc_memberships').select('blocId').eq('stateId', normalizedRegionId).eq('status', 'active').maybeSingle()
  ]);

  if (userBloc && targetBloc && userBloc.blocId === targetBloc.blocId) {
    const { data: blocReg } = await supabase.from('bloc_regulations').select('openBorders, migrationOpen').eq('blocId', userBloc.blocId).maybeSingle();
    if (blocReg && (blocReg.openBorders || blocReg.migrationOpen)) {
      isRestricted = false;
      travelFee = 0;
    }
  }

  // 3. Migration Agreement check
  if (isRestricted || travelFee > 0) {
    const { data: agreement } = await supabase
      .from('migration_agreements')
      .select('id')
      .eq('fromStateId', normalizedRegionId)
      .eq('toStateId', sourceStateId)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (agreement) {
      isRestricted = false;
      travelFee = 0;
    }
  }

  // 4. Budget check
  if (isRestricted && travelFee > 0 && user.money < travelFee) {
    return res.status(400).json({ error: `Fondi insufficienti per pagare la tassa di frontiera ($${travelFee}).` });
  }

  try {
    // 5. Calculate travel time
    const travelTimeMs = calculateTravelTimeMs(user.regionId, normalizedRegionId);
    const travelingUntil = Date.now() + travelTimeMs;
    const travelMinutes = Math.round(travelTimeMs / 60000);

    // 6. Start travel (set travelingTo and travelingUntil instead of instant move)
    const updateData: any = { travelingTo: normalizedRegionId, travelingUntil };
    if (isRestricted && travelFee > 0) {
      updateData.money = user.money - travelFee;
    }

    await supabase.from('users').update(updateData).eq('id', user.id);

    // Budget transaction for travel fee
    if (isRestricted && travelFee > 0) {
      await supabase.rpc('add_budget_transaction', {
        p_owner_type: 'REGION',
        p_owner_id: normalizedRegionId,
        p_type: 'INCOME',
        p_subtype: 'TRAVEL_FEE',
        p_money_delta: travelFee,
        p_resources_delta: {},
        p_created_by: user.id,
        p_metadata: { fromRegion: user.regionId }
      });
    }

    res.json({ success: true, regionId: normalizedRegionId, travelMinutes, travelingUntil });
  } catch (err: any) {
    console.error("Travel error:", err);
    res.status(500).json({ error: "Errore durante il viaggio" });
  }
});

app.post("/api/budget/donate", authenticate, async (req: any, res) => {
  const user = req.user;
  const { entityId, amount, currency } = req.body;

  if (user.level < 60) return res.status(403).json({ error: "Devi essere al Livello 60 per effettuare donazioni di Stato." });
  if (!entityId || !amount) return res.status(400).json({ error: "Dati donazione non validi." });
  if (currency !== 'EUR' && currency !== 'GOLD') return res.status(400).json({ error: "Valuta non supportata." });

  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0 || Math.floor(amountNum) !== amountNum) {
    return res.status(400).json({ error: "Importo non valido. Deve essere un numero intero positivo." });
  }
  if (currency === 'EUR' && user.money < amountNum) return res.status(400).json({ error: "Fondi in € insufficienti." });
  if (currency === 'GOLD' && user.gold < amountNum) return res.status(400).json({ error: "Fondi in Gold insufficienti." });

  const conversionRate = 500000;
  const moneyDelta = currency === 'GOLD' ? amountNum * conversionRate : amountNum;

  try {
    // Atomic currency deduction to prevent race conditions
    const { data: deductResult, error: deductError } = await supabase.rpc('safe_deduct_currency', {
      p_user_id: user.id,
      p_money_cost: currency === 'EUR' ? amountNum : 0,
      p_gold_cost: currency === 'GOLD' ? amountNum : 0,
      p_energy_cost: 0,
    });
    if (deductError) throw deductError;
    const deductData = typeof deductResult === 'string' ? JSON.parse(deductResult) : deductResult;
    if (deductData?.error) return res.status(400).json({ error: deductData.error });

    await supabase.rpc('add_budget_transaction', {
      p_owner_type: 'REGION',
      p_owner_id: entityId,
      p_type: 'INCOME',
      p_subtype: 'DONATION',
      p_money_delta: moneyDelta,
      p_resources_delta: {},
      p_created_by: user.id,
      p_metadata: { originalCurrency: currency, originalAmount: amountNum }
    });

    res.json({ success: true, donated: moneyDelta });
  } catch (err: any) {
    console.error("Donation error:", err);
    res.status(500).json({ error: "La donazione è fallita." });
  }
});

app.post("/api/budget/clean-radiation", authenticate, async (req: any, res) => {
  const user = req.user;
  const { regionId } = req.body;
  if (!regionId) return res.status(400).json({ error: "Nessuna regione specificata." });

  // Only Governor/Leader can do this
  const { data: region, error: regionError } = await supabase
    .from('regions')
    .select('ownerUserId, radiation')
    .eq('id', regionId)
    .single();

  if (regionError || !region || region.ownerUserId !== user.id) {
    return res.status(403).json({ error: "Azione riservata al Leader." });
  }
  if (region.radiation <= 0) return res.status(400).json({ error: "Nessuna radiazione da pulire." });

  const cost = 10000;

  try {
    await supabase.rpc('add_budget_transaction', {
      p_owner_type: 'REGION',
      p_owner_id: regionId,
      p_type: 'EXPENSE',
      p_subtype: 'RADIATION_CLEAN',
      p_money_delta: -cost,
      p_resources_delta: {},
      p_created_by: user.id
    });

    await supabase
      .from('regions')
      .update({ radiation: Math.max(0, (region.radiation || 0) - 10) })
      .eq('id', regionId);

    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Fondi insufficienti." });
  }
});

app.post("/api/budget/explore", authenticate, async (req: any, res) => {
  const user = req.user;
  const { regionId, type } = req.body;
  if (!regionId || (type !== 'normal' && type !== 'deep')) return res.status(400).json({ error: "Parametri esplorazione non validi." });

  const { data: region, error: regionError } = await supabase.from('regions').select('ownerUserId').eq('id', regionId).single();
  if (regionError || !region || region.ownerUserId !== user.id) return res.status(403).json({ error: "Azione riservata al Leader." });

  const isDeep = type === 'deep';
  const cost = isDeep ? 50000 : 15000;

  try {
    const foundOil = isDeep ? Math.floor(Math.random() * 500) + 100 : Math.floor(Math.random() * 100) + 20;
    const foundItems: Record<string, number> = { oil: foundOil };

    await supabase.rpc('add_budget_transaction', {
      p_owner_type: 'REGION',
      p_owner_id: regionId,
      p_type: 'EXPENSE',
      p_subtype: isDeep ? 'EXPLORE_DEEP' : 'EXPLORE_NORMAL',
      p_money_delta: -cost,
      p_resources_delta: foundItems,
      p_created_by: user.id
    });

    res.json({ success: true, message: `Esplorazione completata!` });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Fondi insufficienti." });
  }
});

app.get("/api/budget/:ownerType/:ownerId", authenticate, async (req: any, res) => {
  const { ownerType, ownerId } = req.params;
  const normalizedOwnerType = (ownerType || '').toUpperCase();

  if (normalizedOwnerType !== 'REGION') {
    return res.status(403).json({ error: "Tipo di budget non autorizzato." });
  }

  const { data: region, error: regionError } = await supabase
    .from('regions')
    .select('ownerUserId')
    .eq('id', ownerId)
    .single();

  if (regionError || !region || region.ownerUserId !== req.user.id) {
    return res.status(403).json({ error: "Azione riservata al Leader." });
  }

  const { data: budget, error: budgetError } = await supabase
    .from('budgets')
    .select('*')
    .eq('ownerType', normalizedOwnerType)
    .eq('ownerId', ownerId)
    .single();

  if (budgetError || !budget) return res.status(404).json({ error: "Budget non trovato." });

  const { data: transactions, error: txError } = await supabase
    .from('budget_transactions')
    .select('*, users(username)')
    .eq('budgetId', budget.id)
    .order('createdAt', { ascending: false })
    .limit(50);

  if (txError) return res.status(500).json({ error: txError.message || "Errore nel recupero transazioni." });

  // Format to match old structure (t.username instead of t.users.username)
  const formattedTxs = (transactions || []).map((t: any) => ({
    ...t,
    createdBy: t.users?.username
  }));

  res.json({ budget, transactions: formattedTxs });
});

// --- MINISTERS API ---

app.post("/api/ministers/assign", authenticate, async (req: any, res) => {
  const leader = req.user;
  const { userId, role, iso2: rawIso2 } = req.body;
  const iso2 = normalizeRegionLikeId(String(rawIso2 || '').replace('NATION_', ''));

  if (!userId || !role || !iso2) return res.status(400).json({ error: "Dati mancanti." });
  const managedIso2 = await assertCanManageRegion(req, res, iso2, "Solo il Leader può nominare i ministri.");
  if (!managedIso2) return;

  const { data: region, error: regionError } = await supabase
    .from('regions')
    .select('governmentForm')
    .eq('id', managedIso2)
    .single();
  if (regionError || !region) return res.status(404).json({ error: "Regione non trovata." });

  if (role === 'foreign' && (region.governmentForm === 'DICTATORSHIP' || region.governmentForm === 'ONE_PARTY_SYSTEM')) {
    return res.status(403).json({ error: "Questa carica non esiste in questa forma di governo." });
  }

  const { data: existingAsMinister } = await supabase.from('ministers').select('stateId').eq('userId', userId).eq('status', 'ACTIVE').maybeSingle();
  if (existingAsMinister) {
    return res.status(400).json({ error: "L'utente ricopre già una carica ministeriale in un altro Stato." });
  }

  const { data: targetUser } = await supabase.from('users').select('username').eq('id', userId).maybeSingle();
  if (!targetUser) return res.status(404).json({ error: "Utente non trovato." });

  const title = (role === 'economics' && region.governmentForm === 'DICTATORSHIP') ? "Economic Advisor" : (role === 'economics' ? "Minister of Economics" : "Foreign Minister");

  try {
    // 1. Deactivate old minister
    await supabase.from('ministers').update({ status: 'REVOKED' }).eq('stateId', managedIso2).eq('role', role);

    // 2. Insert new minister
    await supabase.from('ministers').insert({
      id: generateSecureId(9),
      stateId: managedIso2,
      userId,
      role,
      title,
      assignedByUserId: leader.id,
      assignedAt: Date.now()
    });

    // 3. Update regions cache
    const updateObj: any = {};
    if (role === 'economics') updateObj.economicAdviserId = userId;
    else updateObj.foreignMinisterId = userId;
    await supabase.from('regions').update(updateObj).eq('id', managedIso2);

    res.json({ success: true, title });
  } catch (err: any) {
    console.error("Minister assignment error:", err);
    res.status(500).json({ error: "Errore durante l'assegnazione." });
  }
});

app.post("/api/ministers/revoke", authenticate, async (req: any, res) => {
  const { role, iso2: rawIso2 } = req.body;
  const iso2 = normalizeRegionLikeId(String(rawIso2 || '').replace('NATION_', ''));
  const managedIso2 = await assertCanManageRegion(req, res, iso2, "Solo il Leader può revocare i ministri.");
  if (!managedIso2) return;

  try {
    await supabase.from('ministers').update({ status: 'REVOKED' }).eq('stateId', managedIso2).eq('role', role);

    const updateObj: any = {};
    if (role === 'economics') updateObj.economicAdviserId = null;
    else updateObj.foreignMinisterId = null;
    await supabase.from('regions').update(updateObj).eq('id', managedIso2);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Errore durante la revoca." });
  }
});

app.get("/api/ministers/:iso2", authenticate, async (req: any, res) => {
  const iso2 = (req.params.iso2 || '').toUpperCase().replace('NATION_', '');
  if (!isValidIso2(iso2)) return res.status(400).json({ error: "Codice paese non valido." });

  const { data: ministers, error } = await supabase
    .from('ministers')
    .select('*, users(username)')
    .or(`stateId.eq.${iso2},stateId.eq.nation_${iso2}`)
    .eq('status', 'ACTIVE');

  if (error) return res.status(500).json({ error: error.message });

  const wageEconomics = await calculateMinisterWage(iso2, 'economics');
  const wageForeign = await calculateMinisterWage(iso2, 'foreign');

  // Format for backward compatibility if needed (users property to username)
  const formattedMinisters = ministers?.map((m: any) => ({
    ...m,
    username: m.users?.username
  }));

  res.json({ ministers: formattedMinisters, wages: { economics: wageEconomics, foreign: wageForeign } });
});

app.post("/api/ministers/sanctions", authenticate, async (req: any, res) => {
  const user = req.user;
  const { iso2: rawIso2, active, scope } = req.body;
  const iso2 = rawIso2?.toUpperCase().replace('NATION_', '');

  // Check if user is Minister of Economics or Leader
  const { data: region, error: rError } = await supabase
    .from('regions')
    .select('ownerUserId, economicAdviserId')
    .eq('id', iso2)
    .single();

  if (rError || !region) return res.status(404).json({ error: "Regione non trovata." });
  if (region.ownerUserId !== user.id && region.economicAdviserId !== user.id) {
    return res.status(403).json({ error: "Azione riservata al Ministro dell'Economia o al Leader." });
  }

  try {
    const { error } = await supabase
      .from('regions')
      .update({
        sanctionsActive: active ? 1 : 0,
        sanctionsScope: scope || {}
      })
      .eq('id', iso2);

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Errore durante l'aggiornamento delle sanzioni: " + err.message });
  }
});

app.delete("/api/ministers/market-offer/:id", authenticate, async (req: any, res) => {
  const user = req.user;
  const { id } = req.params;

  const { data: offer, error: oError } = await supabase
    .from('market_offers')
    .select('regionId')
    .eq('id', id)
    .single();

  if (oError || !offer) return res.status(404).json({ error: "Offerta non trovata." });

  const { data: region, error: rError } = await supabase
    .from('regions')
    .select('ownerUserId, economicAdviserId')
    .eq('id', offer.regionId)
    .single();

  if (rError || !region || (region.ownerUserId !== user.id && region.economicAdviserId !== user.id)) {
    return res.status(403).json({ error: "Azione riservata al Ministro dell'Economia o al Leader di questo Stato." });
  }

  try {
    const { error: dError } = await supabase
      .from('market_offers')
      .delete()
      .eq('id', id);

    if (dError) throw dError;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Errore durante la rimozione dell'offerta: " + err.message });
  }
});

app.post("/api/actions/apply", authenticate, async (req: any, res) => {
  const user = req.user;
  const { regionId, type } = req.body;
  const normalizedRegionId = String(regionId || '').trim().toUpperCase();

  if (!["residence", "work_permit"].includes(type)) return res.status(400).json({ error: "Tipo di richiesta non valido." });
  if (!isValidIso2(normalizedRegionId)) return res.status(400).json({ error: "Regione non valida." });
  const { data: rpcResult, error: rpcError } = await supabase.rpc('create_application_atomic', {
    p_user_id: user.id,
    p_username: user.username,
    p_region_id: normalizedRegionId,
    p_type: type,
  });

  if (rpcError) {
    console.error("[apply] RPC failure:", rpcError);
    return res.status(500).json({ error: "Errore interno durante la creazione della richiesta." });
  }

  const codeToStatus: Record<string, number> = {
    invalid_input: 400,
    invalid_region: 400,
    invalid_type: 400,
    already_assigned: 400,
    user_not_found: 404,
    region_not_found: 404,
    duplicate_pending: 409,
  };

  const result = rpcResult || {};
  if (!result.success) {
    return res.status(codeToStatus[result.code] || 400).json({ error: result.message || "Operazione non riuscita." });
  }

  res.json({
    success: true,
    autoAccepted: !!result.autoAccepted,
    status: result.status,
    applicationId: result.applicationId,
  });
});

app.get("/api/applications/:regionId", authenticate, async (req: any, res) => {
  const { regionId } = req.params;
  const normalizedRegionId = String(regionId || '').trim().toUpperCase();
  if (!isValidIso2(normalizedRegionId)) return res.status(400).json({ error: "Regione non valida." });

  const authorized = await canManageRegion(normalizedRegionId, req.user.id);
  if (!authorized) return res.status(403).json({ error: "Non autorizzato a visualizzare le richieste di questa regione." });

  const { data: apps, error } = await supabase
    .from('applications')
    .select('*')
    .eq('regionId', normalizedRegionId)
    .eq('status', 'pending')
    .order('createdAt', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(apps);
});

app.get("/api/leader/orders/:regionId", authenticate, async (req: any, res) => {
  try {
    const normalizedRegionId = String(req.params.regionId || '').trim().toUpperCase();
    if (!isValidIso2(normalizedRegionId)) return res.status(400).json({ error: "Regione non valida." });

    const authorized = await canManageRegion(normalizedRegionId, req.user.id);
    if (!authorized) return res.status(403).json({ error: "Non autorizzato a visualizzare gli ordini di questa regione." });

    const { data: orders } = await supabase.from('leader_orders')
      .select('*')
      .eq('regionId', normalizedRegionId)
      .order('createdAt', { ascending: false })
      .limit(20);
    res.json(orders || []);
  } catch (err) {
    res.json([]);
  }
});

app.post("/api/actions/resolve-application", authenticate, async (req: any, res) => {
  const user = req.user;
  const { applicationId, action } = req.body; // action = 'accept' | 'reject'
  if (typeof applicationId !== 'string' || !applicationId.trim()) {
    return res.status(400).json({ error: "applicationId non valido." });
  }
  if (action !== 'accept' && action !== 'reject') {
    return res.status(400).json({ error: "Azione non valida. Usa 'accept' o 'reject'." });
  }

  const { data: rpcResult, error: rpcError } = await supabase.rpc('resolve_application_atomic', {
    p_application_id: applicationId.trim(),
    p_action: action,
    p_actor_user_id: user.id,
  });

  if (rpcError) {
    console.error("[resolve-application] RPC failure:", rpcError);
    return res.status(500).json({ error: "Errore interno durante la risoluzione della richiesta." });
  }

  const codeToStatus: Record<string, number> = {
    invalid_input: 400,
    invalid_action: 400,
    not_found: 404,
    region_not_found: 404,
    forbidden: 403,
    already_resolved: 409,
    invalid_application_type: 409,
    user_not_found: 409,
    race_condition: 409,
  };

  const result = rpcResult || {};
  if (!result.success) {
    return res.status(codeToStatus[result.code] || 400).json({ error: result.message || "Operazione non riuscita." });
  }

  res.json({
    success: true,
    action,
    status: result.status,
    idempotent: !!result.idempotent,
  });
});

app.post("/api/actions/toggle-borders", authenticate, async (req: any, res) => {
  const { regionId, state } = req.body;
  const managedRegionId = await assertCanManageRegion(req, res, regionId, "Non sei il Governatore di questa regione.");
  if (!managedRegionId) return;

  await supabase.from('regions').update({ workRestrictions: state ? 1 : 0 }).eq('id', managedRegionId);
  res.json({ success: true });
});

// --- Government & Ministers API ---
app.post("/api/government/assign-minister", authenticate, async (req: any, res) => {
  const user = req.user;
  const { regionId, role, ministerId } = req.body;

  if (!regionId || !role) return res.status(400).json({ error: "Missing parameters." });
  if (role !== "economicAdviserId" && role !== "foreignMinisterId") return res.status(400).json({ error: "Invalid role." });

  const { data: region } = await supabase.from('regions').select('leaderUserId, governmentForm').eq('id', regionId).single();
  if (!region) return res.status(404).json({ error: "Region not found." });
  if (region.leaderUserId !== user.id) return res.status(403).json({ error: "Solo il Leader può assegnare i ministri." });

  const autocracies = ["DICTATORSHIP", "ONE_PARTY_SYSTEM", "EXECUTIVE_MONARCHY"];
  if (role === "foreignMinisterId" && autocracies.includes(region.governmentForm)) {
    return res.status(400).json({ error: "Questa forma di governo non prevede un Ministro degli Esteri." });
  }

  if (ministerId) {
    const { data: targetUser } = await supabase.from('users').select('id').eq('id', ministerId).maybeSingle();
    if (!targetUser) return res.status(404).json({ error: "Utente non trovato." });
  }

  const updateData: any = {};
  updateData[role] = ministerId || null;
  await supabase.from('regions').update(updateData).eq('id', regionId);

  res.json({ success: true, role, ministerId });
});

app.post("/api/government/transition", authenticate, async (req: any, res) => {
  const user = req.user;
  const { regionId, targetForm } = req.body;

  if (!regionId || !targetForm) return res.status(400).json({ error: "Missing parameters." });

  const { data: region } = await supabase.from('regions').select('leaderUserId, governmentForm').eq('id', regionId).single();
  if (!region) return res.status(404).json({ error: "Region not found." });
  if (region.leaderUserId !== user.id) {
    return res.status(403).json({ error: "Azione riservata al Leader dello Stato." });
  }

  const currentForm = region.governmentForm;
  const allowedTransitions = [
    { from: "DICTATORSHIP", to: "ONE_PARTY_SYSTEM" },
    { from: "DICTATORSHIP", to: "EXECUTIVE_MONARCHY" },
    { from: "ONE_PARTY_SYSTEM", to: "DICTATORSHIP" },
    { from: "EXECUTIVE_MONARCHY", to: "DICTATORSHIP" },
    { from: "DICTATORSHIP", to: "PRESIDENTIAL_REPUBLIC" },
  ];

  const isValid = allowedTransitions.some(t => t.from === currentForm && t.to === targetForm);
  if (!isValid) {
    return res.status(400).json({ error: `Transizione diretta da ${currentForm} a ${targetForm} non consentita.` });
  }

  const updateData: any = { governmentForm: targetForm };
  if (targetForm === 'PARLIAMENTARY_REPUBLIC') {
    updateData.leaderUserId = null;
    updateData.leaderTitle = 'None';
    updateData.nextLeaderElectionAt = null;
  } else if (['DICTATORSHIP', 'ONE_PARTY_SYSTEM', 'EXECUTIVE_MONARCHY'].includes(targetForm)) {
    updateData.leaderUserId = user.id;
    updateData.leaderTitle = targetForm === 'EXECUTIVE_MONARCHY' ? 'Sovrano' : 'Dittatore';
    updateData.nextLeaderElectionAt = null;
  } else if (['PRESIDENTIAL_REPUBLIC', 'DOMINANT_PARTY'].includes(targetForm)) {
    updateData.leaderTitle = 'Leader';
    updateData.nextLeaderElectionAt = new Date(Date.now() + (5 * 24 * 60 * 60 * 1000)).toISOString();
  }

  await supabase.from('regions').update(updateData).eq('id', regionId);
  return res.json({ success: true, newForm: targetForm });
});

// --- Leader System Specific API ---

app.post("/api/leader/candidate", authenticate, async (req: any, res) => {
  const user = req.user;
  const { regionId } = req.body;

  const { data: region } = await supabase.from('regions').select('governmentForm').eq('id', regionId).single();
  if (!region) return res.status(404).json({ error: "Regione non trovata." });
  if (!['PRESIDENTIAL_REPUBLIC', 'DOMINANT_PARTY'].includes(region.governmentForm)) {
    return res.status(400).json({ error: "Questa forma di governo non prevede elezioni del Leader." });
  }

  if (user.residenceId !== regionId) {
    return res.status(403).json({ error: "Devi essere cittadino per candidarti." });
  }

  const { error } = await supabase.from('leader_candidates').insert({ regionId, userId: user.id, votes: 0 });
  if (error) return res.status(400).json({ error: "Sei già candidato." });
  res.json({ success: true });
});

app.post("/api/leader/vote", authenticate, async (req: any, res) => {
  const user = req.user;
  const { regionId, candidateId } = req.body;

  if (user.residenceId !== regionId) return res.status(403).json({ error: "Devi essere cittadino per votare." });

  // Use a transaction or just two inserts? Supabase doesn't easily do transactions via JS without RPC.
  // But we can use an RPC for atomic voting if needed.
  // For now, simpler:
  const { error } = await supabase.from('leader_votes').insert({ regionId, voterId: user.id, candidateId });
  if (error) return res.status(400).json({ error: "Hai già votato o regione non valida." });

  await supabase.rpc('increment_candidate_votes', { p_region_id: regionId, p_candidate_id: candidateId });
  res.json({ success: true });
});

app.post("/api/leader/update-state-ui", authenticate, async (req: any, res) => {
  const user = req.user;
  const { regionId, stateColor, stateHymn } = req.body;

  const { data: region } = await supabase.from('regions').select('leaderUserId').eq('id', regionId).single();
  if (!region || region.leaderUserId !== user.id) return res.status(403).json({ error: "Solo il Leader può modificare queste impostazioni." });

  await supabase.from('regions').update({
    stateColor: stateColor || '#334155',
    stateHymn: stateHymn || ''
  }).eq('id', regionId);

  res.json({ success: true });
});

// (Orphaned broken orders block removed, replaced by /api/ministers/orders above)
// Leader Orders API
app.get("/api/ministers/orders", authenticate, async (req: any, res) => {
  const { data: regions } = await supabase.from('regions').select('id').eq('leaderUserId', req.user.id);
  if (!regions || regions.length === 0) return res.status(403).json({ error: "Non sei un leader." });

  const regionIds = regions.map(r => r.id);
  const { data: orders } = await supabase.from('leader_orders')
    .select('*')
    .in('regionId', regionIds)
    .order('createdAt', { ascending: false })
    .limit(20);

  res.json(orders || []);
});

app.post("/api/ministers/orders", authenticate, async (req: any, res) => {
  const { regionId, title, content } = req.body;
  if (!regionId || !title || !content) return res.status(400).json({ error: "Dati mancanti." });

  const { data: region } = await supabase.from('regions').select('leaderUserId').eq('id', regionId).single();
  if (!region || region.leaderUserId !== req.user.id) return res.status(403).json({ error: "Non sei il leader di questa regione." });

  await supabase.from('leader_orders').insert({
    regionId,
    leaderId: req.user.id,
    title,
    content,
    createdAt: new Date().toISOString()
  });

  res.json({ success: true });
});

// --- Nation Management API ---

app.post("/api/actions/change-displayed-nation", authenticate, async (req: any, res) => {
  const user = req.user;
  const { nationId } = req.body;
  if (!nationId) return res.status(400).json({ error: "Nessuna nazione specificata." });

  await supabase.from('users').update({ displayedNation: nationId }).eq('id', user.id);
  res.json({ success: true, displayedNation: nationId });
});

app.post("/api/actions/change-original-nation", authenticate, async (req: any, res) => {
  const user = req.user;
  const { nationId } = req.body;
  if (!nationId) return res.status(400).json({ error: "Nessuna nazione specificata." });
  const normalizedNationId = String(nationId).trim().toUpperCase();

  const { data: nationExists, error: nationError } = await supabase
    .from('nations')
    .select('id')
    .eq('id', normalizedNationId)
    .maybeSingle();

  if (nationError) return res.status(500).json({ error: "Errore nel controllo della nazione." });
  if (!nationExists) return res.status(400).json({ error: "Nazione non valida." });

  const now = Date.now();
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  if (now - (user.lastOriginalNationChange || 0) < THIRTY_DAYS && user.lastOriginalNationChange !== 0) {
    const nextAvail = new Date(user.lastOriginalNationChange + THIRTY_DAYS).toLocaleDateString();
    return res.status(400).json({ error: `Puoi cambiare di nuovo la Nazione Originale il ${nextAvail}.` });
  }

  await supabase.from('users').update({
    originalNation: normalizedNationId,
    lastOriginalNationChange: now
  }).eq('id', user.id);

  res.json({ success: true, originalNation: normalizedNationId, lastOriginalNationChange: now });
});

app.post("/api/actions/attack", authenticate, async (req: any, res) => {
  const user = req.user;
  const { regionId } = req.body;

  const perks = await getUserPerks(user.id);

  // RESISTENZA reduces energy in war too (same formula as work, capped at lv50)
  const resistenza = perks['RESISTENZA'] || 0;
  const energyReduction = Math.min(0.5, resistenza / 100);
  const energyCost = Math.ceil(GAME_CONFIG.ATTACK_ENERGY_COST * (1 - energyReduction));

  let finalEnergyCost = energyCost;

  if (user.energy < finalEnergyCost) return res.status(400).json({ error: "Not enough energy" });

  // Cooldown check via Supabase
  const { data: lastAttack } = await supabase
    .from('cooldowns')
    .select('last_used')
    .eq('user_id', user.id)
    .eq('action_type', 'attack')
    .maybeSingle();

  if (lastAttack && Date.now() - new Date(lastAttack.last_used).getTime() < GAME_CONFIG.ATTACK_COOLDOWN) {
    return res.status(400).json({ error: "Action on cooldown" });
  }

  const { data: region } = await supabase.from('regions').select('*').eq('id', regionId).single();
  if (!region) return res.status(404).json({ error: "Region not found" });

  // Bloc restriction
  const [{ data: attackerBloc }, { data: defenderBloc }] = await Promise.all([
    supabase.from('bloc_memberships').select('blocId').eq('stateId', user.regionId).eq('status', 'active').maybeSingle(),
    supabase.from('bloc_memberships').select('blocId').eq('stateId', regionId).eq('status', 'active').maybeSingle()
  ]);

  if (attackerBloc && defenderBloc && attackerBloc.blocId === defenderBloc.blocId) {
    return res.status(403).json({ error: "Non puoi dichiarare guerra a un membro dello stesso Blocco Geopolitico." });
  }

  const forzaBonus = (perks['FORZA'] || 0) * 0.05;
  const istruzBonus = (perks['ISTRUZIONE'] || 0) * 0.02;
  const resistBonus = (perks['RESISTENZA'] || 0) * 0.03;
  const totalDmgBonus = forzaBonus + istruzBonus + resistBonus;

  let alphaBonus = 0;
  if (resistenza >= 50) alphaBonus += 0.10;
  if (resistenza >= 75) alphaBonus += 0.10;
  if (resistenza >= 100) alphaBonus += 0.15;

  const winProbability = Math.min(0.9, 0.3 + totalDmgBonus + alphaBonus);
  const success = Math.random() < winProbability;

  await supabase.from('users').update({ energy: user.energy - finalEnergyCost }).eq('id', user.id);

  if (success) {
    await supabase.from('regions').update({
      ownerUserId: user.id,
      stability: Math.max(0, (region.stability || 100) - 20)
    }).eq('id', regionId);

    const warId = generateSecureId(7);
    await supabase.from('wars').insert({
      id: warId,
      attackerCountryIso2: user.regionId,
      defenderCountryIso2: regionId,
      attackerUserId: user.id,
      defenderUserId: region.ownerUserId,
      status: 'ended',
      startedAt: new Date().toISOString(),
      endsAt: new Date().toISOString(),
      attackerScore: 100,
      defenderScore: 0
    });

    await addXP(user.id, GAME_CONFIG.XP_PER_ATTACK);
  } else {
    await addXP(user.id, Math.floor(GAME_CONFIG.XP_PER_ATTACK / 2));
  }

  await supabase.from('cooldowns').upsert({
    user_id: user.id,
    action_type: 'attack',
    last_used: new Date().toISOString()
  });

  res.json({ success, winProbability: Math.round(winProbability * 100) });
});

// --- War Interactive Deploy API ---
app.post("/api/wars/deploy", authenticate, async (req: any, res) => {
  const user = req.user;
  const { warId, side, weaponId } = req.body;

  if (!warId || !side || !weaponId) return res.status(400).json({ error: "Dati mancanti." });
  if (side !== 'attacker' && side !== 'defender') return res.status(400).json({ error: "Schieramento non valido." });

  const { data: war } = await supabase.from('wars').select('*').eq('id', warId).single();
  if (!war) return res.status(404).json({ error: "Guerra inesistente." });
  if (war.status !== 'active') return res.status(400).json({ error: "Questa guerra è già terminata." });

  // Naval Phase 1 restriction: only battleship allowed in first 24h
  if (war.warType === 'naval' && war.navalPhase === 1 && weaponId !== 'battleship') {
    return res.status(400).json({ error: "Solo corazzate navali permesse nella Fase 1 (prime 24h) della battaglia navale." });
  }

  const weapons: any = {
    infantry: { energy: 10, cash: 50, damage: 100 },
    tank: { energy: 30, cash: 500, damage: 1000 },
    airstrike: { energy: 50, cash: 2000, damage: 5000 },
    battleship: { energy: 40, cash: 10000, damage: 2000 }
  };

  const weapon = weapons[weaponId];
  if (!weapon) return res.status(400).json({ error: "Armamento sconosciuto." });

  if (user.energy < weapon.energy) return res.status(400).json({ error: `Energia insufficiente (richiesti ${weapon.energy}).` });
  if (user.money < weapon.cash) return res.status(400).json({ error: `Fondi insufficienti (richiesti $${weapon.cash}).` });

  // Damage Calculation
  let totalDamage = weapon.damage;
  const isPatriot = (side === 'attacker' && war.attackerCountryIso2 === user.originalNation) ||
    (side === 'defender' && war.defenderCountryIso2 === user.originalNation);

  if (isPatriot) totalDamage = Math.floor(totalDamage * 1.10);

  const perks = await getUserPerks(user.id);
  const forzaBonus = (perks['FORZA'] || 0) * 0.05;
  const resistBonus = (perks['RESISTENZA'] || 0) * 0.03;
  totalDamage = Math.floor(totalDamage * (1 + forzaBonus + resistBonus));

  // Apply Regional Military Index bonus to the attacker's region
  const warRegionId = side === 'attacker' ? war.attackerCountryIso2 : war.defenderCountryIso2;
  if (warRegionId) {
    try {
      const warBuildings = await getRegionBuildings(warRegionId);
      const warIndices   = calculateRegionalIndices(warBuildings);
      const warEffects   = calculateIndexEffects(warIndices);
      const regionalBonus = side === 'attacker' ? warEffects.warAttackBonus : warEffects.warDefenseBonus;
      if (regionalBonus > 0) {
        totalDamage = Math.floor(totalDamage * (1 + regionalBonus));
      }
    } catch (_e) {
      // Non-critical: skip regional bonus if lookup fails
    }
  }

  try {
    // Deduct resources
    await supabase.from('users').update({
      energy: user.energy - weapon.energy,
      money: user.money - weapon.cash
    }).eq('id', user.id);

    // Update scores
    if (side === 'attacker') {
      await supabase.from('wars').update({ attackerScore: (war.attackerScore || 0) + totalDamage }).eq('id', warId);
    } else {
      await supabase.from('wars').update({ defenderScore: (war.defenderScore || 0) + totalDamage }).eq('id', warId);
    }

    // Update war_participants for damage tracking
    const { data: existingParticipant } = await supabase.from('war_participants')
      .select('id, totalDamage, troopsDeployed')
      .eq('warId', warId)
      .eq('userId', user.id)
      .maybeSingle();

    if (existingParticipant) {
      const deployed = existingParticipant.troopsDeployed || {};
      deployed[weaponId] = (deployed[weaponId] || 0) + 1;
      await supabase.from('war_participants').update({
        totalDamage: (existingParticipant.totalDamage || 0) + totalDamage,
        troopsDeployed: deployed,
      }).eq('id', existingParticipant.id);
    } else {
      await supabase.from('war_participants').insert({
        warId,
        userId: user.id,
        side,
        totalDamage: totalDamage,
        troopsDeployed: { [weaponId]: 1 },
      });
    }

    // Log the deployment for stats
    await supabase.from('action_logs').insert({
      userId: user.id,
      action: 'WAR_DEPLOY',
      details: JSON.stringify({
        warId,
        side,
        weaponId,
        damage: totalDamage,
        username: user.username,
        isPatriot
      }),
      timestamp: Date.now()
    });

    res.json({ success: true, damageDealt: totalDamage, side });

    // ── Daily Missions: update military progress (non-blocking) ──
    try {
      await updateMissionProgress(user.id, 'WAR_DEPLOY', {
        deal_damage: totalDamage,
        fight_battles: 1,
        deploy_troops: 1,
        spend_energy: weapons[weaponId]?.energy || 0,
      });
      await updateMissionProgress(user.id, 'EARN_XP', { earn_xp: GAME_CONFIG.XP_PER_ATTACK || 0 });
    } catch { /* non-critical */ }
  } catch (err) {
    res.status(500).json({ error: "Errore durante lo schieramento in battaglia." });
  }
});

// Articles API
// Articles API
app.get("/api/articles", authenticate, async (req: any, res) => {
  const section = req.query.section;
  let query = supabase
    .from('articles')
    .select(`
      *,
      newspapers (
        name,
        logo_url
      )
    `)
    .order('createdAt', { ascending: false })
    .limit(50);
    
  if (section === 'local') {
    query = query.eq('section', req.user.residenceId || req.user.regionId);
  } else {
    query = query.eq('section', 'global');
  }
  
  const { data: articles, error } = await query;
  if (error) {
    console.error("Articles fetch error:", error);
    return res.json([]);
  }
  
  // Format articles to include newspaper info and handle legacy content
  const formatted = (articles || []).map((a: any) => ({
    ...a,
    newspaperId: a.newspaper_id,
    newspaperName: a.newspapers?.name,
    newspaperLogo: a.newspapers?.logo_url,
    // Backward compatibility: if blocks is empty, create a default text block
    blocks: a.blocks && Array.isArray(a.blocks) && a.blocks.length > 0 
      ? a.blocks 
      : [{ id: 'legacy', type: 'text', content: a.content }]
  }));
  
  res.json(formatted);
});

app.get("/api/articles/:id", authenticate, async (req, res) => {
  const { data: article } = await supabase
    .from('articles')
    .select(`
      *,
      newspapers (
        name,
        logo_url
      )
    `)
    .eq('id', req.params.id)
    .single();
    
  if (!article) return res.status(404).json({ error: "Article not found" });
  
  const formatted = {
    ...article,
    newspaperId: article.newspaper_id,
    newspaperName: article.newspapers?.name,
    newspaperLogo: article.newspapers?.logo_url,
    blocks: article.blocks && Array.isArray(article.blocks) && article.blocks.length > 0 
      ? article.blocks 
      : [{ id: 'legacy', type: 'text', content: article.content }]
  };
  
  res.json(formatted);
});

app.post("/api/articles", authenticate, async (req: any, res) => {
  const { title, content, blocks, section, newspaperId } = req.body;
  if (!title || (!content && !blocks)) return res.status(400).json({ error: "Titolo e contenuto richiesti" });

  // If newspaperId is provided, check if user has permission
  if (newspaperId) {
    const { data: member } = await supabase
      .from('newspaper_members')
      .select('role')
      .eq('newspaper_id', newspaperId)
      .eq('user_id', req.user.id)
      .eq('status', 'active')
      .maybeSingle();
      
    if (!member || (member.role !== 'owner' && member.role !== 'editor' && member.role !== 'writer')) {
      return res.status(403).json({ error: "Non hai i permessi per pubblicare tramite questo giornale." });
    }
  }

  const resolvedSection = section === 'local' ? (req.user.residenceId || req.user.regionId || 'global') : 'global';

  // Rate limit: max 5 per hour
  const oneHourAgo = new Date(Date.now() - (60 * 60 * 1000)).toISOString();
  const { count } = await supabase.from('articles')
    .select('id', { count: 'exact', head: true })
    .eq('authorId', req.user.id)
    .gt('createdAt', oneHourAgo);

  if (count && count >= 5) return res.status(429).json({ error: "Limite raggiunto (max 5 articoli all'ora)" });

  const id = generateSecureId(7);
  const now = new Date().toISOString();
  const { error: insertError } = await supabase.from('articles').insert({
    id,
    authorId: req.user.id,
    authorName: req.user.username,
    newspaper_id: newspaperId || null,
    title,
    content: content || (blocks?.[0]?.type === 'text' ? blocks[0].content : "Multimediale"),
    blocks: blocks || [],
    section: resolvedSection,
    createdAt: now,
    updatedAt: now
  });

  if (insertError) {
    console.error("Article insert error:", insertError);
    return res.status(500).json({ error: "Errore nella creazione dell'articolo." });
  }

  res.json({ success: true, id });
});

app.put("/api/articles/:id", authenticate, async (req: any, res) => {
  const { title, content, blocks } = req.body;
  const { data: article } = await supabase.from('articles').select('authorId, content').eq('id', req.params.id).single();
  if (!article) return res.status(404).json({ error: "Article not found" });
  if (article.authorId !== req.user.id) return res.status(403).json({ error: "Non autorizzato" });

  await supabase.from('articles').update({
    title,
    content: content || article.content,
    blocks: blocks || [],
    updatedAt: new Date().toISOString()
  }).eq('id', req.params.id);

  res.json({ success: true });
});

// Newspaper API
app.get("/api/newspapers", authenticate, async (req, res) => {
  const { data: newspapers } = await supabase.from('newspapers').select('*').limit(50);
  const formatted = (newspapers || []).map((n: any) => ({
    ...n,
    logoUrl: n.logo_url,
    ownerId: n.owner_id,
    createdAt: n.created_at
  }));
  res.json(formatted);
});

app.post("/api/newspapers", authenticate, async (req: any, res) => {
  const { name, description, logoUrl } = req.body;
  if (!name) return res.status(400).json({ error: "Nome giornale richiesto" });
  
  // Cost: 50 Gold or 10,000 Money? Let's say 10,000 Money for now.
  const cost = 10000;
  if (req.user.money < cost) return res.status(400).json({ error: `Fondi insufficienti (serve $${cost})` });

  try {
    const id = generateSecureId(8);
    // 1. Create newspaper
    const { error: nsError } = await supabase.from('newspapers').insert({
      id,
      name,
      description: description || "",
      logo_url: logoUrl || "",
      owner_id: req.user.id,
      created_at: new Date().toISOString()
    });
    if (nsError) throw nsError;

    // 2. Add owner as member
    await supabase.from('newspaper_members').insert({
      newspaper_id: id,
      user_id: req.user.id,
      role: 'owner',
      status: 'active',
      joined_at: new Date().toISOString()
    });

    // 3. Deduct money
    await supabase.from('users').update({ money: req.user.money - cost }).eq('id', req.user.id);

    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/newspapers/:id", authenticate, async (req: any, res) => {
  const { name, description, logoUrl } = req.body;
  if (!name) return res.status(400).json({ error: "Nome richiesto" });

  try {
    // Check ownership
    const { data: member } = await supabase
      .from('newspaper_members')
      .select('role')
      .eq('newspaper_id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!member || member.role !== 'owner') {
      return res.status(403).json({ error: "Solo il proprietario può modificare il giornale." });
    }

    const { error } = await supabase.from('newspapers').update({
      name,
      description: description || "",
      logo_url: logoUrl || ""
    }).eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/newspapers/:id", authenticate, async (req: any, res) => {
  try {
    // Check ownership
    const { data: member } = await supabase
      .from('newspaper_members')
      .select('role')
      .eq('newspaper_id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!member || member.role !== 'owner') {
      return res.status(403).json({ error: "Solo il proprietario può cancellare il giornale." });
    }

    // Remove all members first
    await supabase.from('newspaper_members').delete().eq('newspaper_id', req.params.id);
    // Unlink articles (set newspaper_id to null)
    await supabase.from('articles').update({ newspaper_id: null }).eq('newspaper_id', req.params.id);
    // Delete the newspaper
    const { error } = await supabase.from('newspapers').delete().eq('id', req.params.id);
    if (error) throw error;

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/newspapers/:id", authenticate, async (req, res) => {
  const { data: newspaper } = await supabase.from('newspapers').select('*').eq('id', req.params.id).single();
  if (!newspaper) return res.status(404).json({ error: "Giornale non trovato" });

  const { data: members } = await supabase
    .from('newspaper_members')
    .select('*, users(username)')
    .eq('newspaper_id', req.params.id)
    .eq('status', 'active');

  const { data: articles } = await supabase
    .from('articles')
    .select('*')
    .eq('newspaper_id', req.params.id)
    .order('createdAt', { ascending: false });

  res.json({ 
    ...newspaper, 
    logoUrl: newspaper.logo_url,
    ownerId: newspaper.owner_id,
    createdAt: newspaper.created_at,
    members: (members || []).map((m: any) => ({ 
      ...m, 
      newspaperId: m.newspaper_id,
      userId: m.user_id,
      joinedAt: m.joined_at,
      username: m.users?.username 
    })),
    articles: (articles || []).map((a: any) => ({
      ...a,
      newspaperId: a.newspaper_id
    }))
  });
});

app.get("/api/my-newspapers", authenticate, async (req: any, res) => {
  const { data: memberships } = await supabase
    .from('newspaper_members')
    .select(`
      newspaper_id,
      role,
      newspapers (
        id,
        name,
        logo_url
      )
    `)
    .eq('user_id', req.user.id)
    .eq('status', 'active');

  const formatted = (memberships || []).map((m: any) => ({
    id: m.newspapers?.id,
    name: m.newspapers?.name,
    logoUrl: m.newspapers?.logo_url,
    role: m.role,
    newspaperId: m.newspaper_id
  }));

  res.json(formatted);
});

app.post("/api/newspapers/:id/members", authenticate, async (req: any, res) => {
  const { userId, role } = req.body;
  const newspaperId = req.params.id;
  const targetRole = normalizeNewspaperRole(role || 'writer');

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: "Utente non valido." });
  }
  if (!targetRole) {
    return res.status(400).json({ error: "Ruolo non valido." });
  }

  // Check if current user is owner or editor
  const { data: myMember } = await supabase
    .from('newspaper_members')
    .select('role')
    .eq('newspaper_id', newspaperId)
    .eq('user_id', req.user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!myMember || (myMember.role !== 'owner' && myMember.role !== 'editor')) {
    return res.status(403).json({ error: "Non hai i permessi per gestire i membri." });
  }

  if (!canAssignNewspaperRole(myMember.role, targetRole)) {
    return res.status(403).json({ error: "Non hai i permessi per assegnare questo ruolo." });
  }

  try {
    const { data: targetUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (!targetUser) return res.status(404).json({ error: "Utente target non trovato." });

    await supabase.from('newspaper_members').insert({
      newspaper_id: newspaperId,
      user_id: userId,
      role: targetRole,
      status: 'active',
      joined_at: new Date().toISOString()
    });
    res.json({ success: true });
  } catch (err: any) {
    if (err?.code === '23505') {
      return res.status(409).json({ error: "L'utente è già membro di questo giornale." });
    }
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/articles/:id", authenticate, async (req: any, res) => {
  const { data: article } = await supabase.from('articles').select('authorId').eq('id', req.params.id).single();
  if (!article) return res.status(404).json({ error: "Article not found" });
  if (article.authorId !== req.user.id) return res.status(403).json({ error: "Forbidden" });

  await supabase.from('articles').delete().eq('id', req.params.id);
  res.json({ success: true });
});

// Article Comments
app.get("/api/articles/:id/comments", authenticate, async (req: any, res) => {
  const { data: comments, error } = await supabase
    .from('article_comments')
    .select('id, articleId, authorId, authorName, content, createdAt')
    .eq('articleId', req.params.id)
    .order('createdAt', { ascending: true });
  if (error) {
    console.error("Article comments fetch error:", error);
    return res.json([]);
  }
  res.json(comments || []);
});

app.post("/api/articles/:id/comments", authenticate, async (req: any, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: "Content required" });
  const { data, error } = await supabase.from('article_comments').insert({
    articleId: req.params.id,
    authorId: req.user.id,
    authorName: req.user.username,
    content: content.trim(),
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Article Voting (up/down, 1 vote per user, togglable)
app.get("/api/articles/:id/vote", authenticate, async (req: any, res) => {
  const articleId = req.params.id;
  // Get user's vote
  const { data: userVote } = await supabase
    .from('article_votes')
    .select('vote')
    .eq('articleId', articleId)
    .eq('userId', req.user.id)
    .single();
  // Get total score
  const { count: upCount } = await supabase
    .from('article_votes')
    .select('*', { count: 'exact', head: true })
    .eq('articleId', articleId)
    .eq('vote', 'up');
  const { count: downCount } = await supabase
    .from('article_votes')
    .select('*', { count: 'exact', head: true })
    .eq('articleId', articleId)
    .eq('vote', 'down');
  const score = (upCount || 0) - (downCount || 0);
  res.json({ vote: userVote?.vote || null, score });
});

app.post("/api/articles/:id/vote", authenticate, async (req: any, res) => {
  const articleId = req.params.id;
  const { vote } = req.body; // 'up', 'down', or null to remove
  const userId = req.user.id;

  if (vote === null || vote === undefined) {
    // Remove vote
    await supabase.from('article_votes').delete().eq('articleId', articleId).eq('userId', userId);
  } else if (vote === 'up' || vote === 'down') {
    // Upsert vote
    const { data: existing } = await supabase
      .from('article_votes')
      .select('id')
      .eq('articleId', articleId)
      .eq('userId', userId)
      .single();
    if (existing) {
      await supabase.from('article_votes').update({ vote }).eq('id', existing.id);
    } else {
      await supabase.from('article_votes').insert({ articleId, userId, vote });
    }
  }

  // Return updated score
  const { count: upCount } = await supabase
    .from('article_votes')
    .select('*', { count: 'exact', head: true })
    .eq('articleId', articleId)
    .eq('vote', 'up');
  const { count: downCount } = await supabase
    .from('article_votes')
    .select('*', { count: 'exact', head: true })
    .eq('articleId', articleId)
    .eq('vote', 'down');
  const score = (upCount || 0) - (downCount || 0);
  // Update article likeCount
  await supabase.from('articles').update({ likeCount: score }).eq('id', articleId);
  res.json({ vote: vote || null, score });
});

// Military Training
app.post("/api/actions/train", authenticate, async (req: any, res) => {
  const user = req.user;
  const TRAIN_ENERGY_COST = 10;

  try {
    // Try RPC first, fallback to manual deduction
    let deducted = false;
    try {
      const { data: deductResult, error: deductError } = await supabase.rpc('safe_deduct_currency', {
        p_user_id: user.id,
        p_money_cost: 0,
        p_gold_cost: 0,
        p_energy_cost: TRAIN_ENERGY_COST,
      });
      if (deductError) {
        const msg = (deductError.message || '').toLowerCase();
        if (msg.includes('energia') || msg.includes('energy') || msg.includes('insufficient')) {
          return res.status(400).json({ error: "Energia insufficiente (serve 10⚡)" });
        }
        throw deductError;
      }
      const deductData = typeof deductResult === 'string' ? JSON.parse(deductResult) : deductResult;
      if (deductData?.error) {
        return res.status(400).json({ error: "Energia insufficiente (serve 10⚡)" });
      }
      deducted = true;
    } catch (rpcErr: any) {
      // RPC not available - fallback to manual deduction
      console.log("[train] safe_deduct_currency fallback:", rpcErr.message);
      const { data: freshUser } = await supabase.from('users').select('energy').eq('id', user.id).single();
      if (!freshUser || (freshUser.energy || 0) < TRAIN_ENERGY_COST) {
        return res.status(400).json({ error: "Energia insufficiente (serve 10⚡)" });
      }
      const { data: updated, error: updErr } = await supabase.from('users')
        .update({ energy: (freshUser.energy || 0) - TRAIN_ENERGY_COST })
        .eq('id', user.id)
        .gte('energy', TRAIN_ENERGY_COST)
        .select('id')
        .maybeSingle();
      if (updErr || !updated) {
        return res.status(400).json({ error: "Energia insufficiente (serve 10⚡)" });
      }
      deducted = true;
    }

    const { data: currentUser, error: currentError } = await supabase
      .from('users')
      .select('energy, militaryExp')
      .eq('id', user.id)
      .single();
    if (currentError) throw currentError;

    const militaryExp = (currentUser.militaryExp || 0) + 5;
    const { error: expError } = await supabase.from('users').update({
      militaryExp,
      lastEnergyUpdate: Date.now(),
    }).eq('id', user.id);
    if (expError) throw expError;

    // Grant XP
    await addXP(user.id, 5);

    res.json({ success: true, militaryExp, energy: currentUser.energy });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Chat API
app.get("/api/chat", authenticate, async (req: any, res) => {
  const channel = (req.query.channel as string) || 'global';
  const user = req.user;

  let query = supabase.from('chat_messages')
    .select('id, userId, username, regionId, channel, message, createdAt')
    .order('createdAt', { ascending: false })
    .limit(50);

  if (channel === 'local') {
    // Local chat: messages stored with nation code as channel (e.g., 'IT', 'US')
    const nation = user.originalNation || 'IT';
    query = query.eq('channel', nation);
  } else {
    query = query.eq('channel', 'global');
  }

  const { data: messages, error } = await query;

  if (error) {
    console.error("Chat fetch error:", error);
    return res.json([]);
  }

  res.json(messages ? messages.reverse() : []); // oldest first for display
});

app.post("/api/chat", authenticate, async (req: any, res) => {
  const { message, channel: reqChannel } = req.body;
  const user = req.user;
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({ error: "Messaggio vuoto" });
  }
  if (message.trim().length > 280) {
    return res.status(400).json({ error: "Messaggio troppo lungo (max 280 caratteri)" });
  }

  // Determine channel: 'global' or the user's nation code for local chat
  const channel = reqChannel === 'local' ? (user.originalNation || 'IT') : 'global';

  // Rate limit: 1 message per 5 seconds
  const { data: lastMsg } = await supabase.from('chat_messages')
    .select('createdAt')
    .eq('userId', user.id)
    .order('createdAt', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastMsg && Date.now() - new Date(lastMsg.createdAt).getTime() < 5000) {
    return res.status(429).json({ error: "Aspetta qualche secondo prima di inviare un altro messaggio" });
  }

  const { error: insertError } = await supabase.from('chat_messages').insert({
    userId: user.id,
    username: user.username,
    regionId: user.regionId || "?",
    channel,
    message: message.trim(),
    createdAt: new Date().toISOString()
  });

  if (insertError) {
    console.error("Chat insert error:", insertError);
    return res.status(500).json({ error: "Errore nell'invio del messaggio." });
  }

  res.json({ success: true });
});

// ==========================================
// PRIVATE MESSAGES API
// ==========================================

// Get inbox/sent messages
app.get("/api/messages", authenticate, async (req: any, res) => {
  const userId = req.user.id;
  const folder = req.query.folder || 'inbox'; // 'inbox' or 'sent'

  let query = supabase.from('messages').select('*');
  if (folder === 'sent') {
    query = query.eq('senderId', userId);
  } else {
    query = query.eq('receiverId', userId);
  }
  query = query.order('createdAt', { ascending: false }).limit(50);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// Get unread count
app.get("/api/messages/unread-count", authenticate, async (req: any, res) => {
  const { count, error } = await supabase.from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('receiverId', req.user.id)
    .eq('read', false);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ count: count || 0 });
});

// Send a message
app.post("/api/messages", authenticate, async (req: any, res) => {
  const { receiverUsername, subject, body } = req.body;
  if (!receiverUsername || !body) return res.status(400).json({ error: "Destinatario e messaggio obbligatori." });
  if (body.length > 2000) return res.status(400).json({ error: "Messaggio troppo lungo (max 2000 caratteri)." });
  if (subject && subject.length > 100) return res.status(400).json({ error: "Oggetto troppo lungo (max 100 caratteri)." });

  // Find receiver
  const { data: receiver } = await supabase.from('users').select('id, username').eq('username', receiverUsername).maybeSingle();
  if (!receiver) return res.status(404).json({ error: "Giocatore non trovato." });
  if (receiver.id === req.user.id) return res.status(400).json({ error: "Non puoi inviare messaggi a te stesso." });

  // Rate limit: max 1 message per 30 seconds
  const MESSAGE_RATE_LIMIT_MS = 30 * 1000;
  const { data: lastMsg } = await supabase.from('messages')
    .select('createdAt')
    .eq('senderId', req.user.id)
    .order('createdAt', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastMsg && Date.now() - new Date(lastMsg.createdAt).getTime() < MESSAGE_RATE_LIMIT_MS) {
    return res.status(429).json({ error: "Attendi 30 secondi tra un messaggio e l'altro." });
  }

  const { error } = await supabase.from('messages').insert({
    senderId: req.user.id,
    senderName: req.user.username,
    receiverId: receiver.id,
    receiverName: receiver.username,
    subject: subject || '',
    body,
    read: false,
    createdAt: new Date().toISOString()
  });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Mark message as read
app.put("/api/messages/:id/read", authenticate, async (req: any, res) => {
  const { id } = req.params;
  const { error } = await supabase.from('messages')
    .update({ read: true })
    .eq('id', id)
    .eq('receiverId', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Delete a message
app.delete("/api/messages/:id", authenticate, async (req: any, res) => {
  const { id } = req.params;
  const { data: message, error: messageError } = await supabase.from('messages')
    .select('senderId, receiverId')
    .eq('id', id)
    .maybeSingle();

  if (messageError) return res.status(500).json({ error: messageError.message });
  if (!message) return res.status(404).json({ error: "Messaggio non trovato." });
  if (message.senderId !== req.user.id && message.receiverId !== req.user.id) {
    return res.status(403).json({ error: "Non autorizzato a eliminare questo messaggio." });
  }

  const { error } = await supabase.from('messages')
    .delete()
    .eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});
app.post("/api/profile/avatar", authenticate, async (req: any, res) => {
  const { avatarData } = req.body;
  if (!avatarData || typeof avatarData !== "string") {
    return res.status(400).json({ error: "Dati immagine mancanti" });
  }
  // Must be a valid base64 data URL (png/jpeg/webp only)
  if (!isAllowedAvatarDataUrl(avatarData)) {
    return res.status(400).json({ error: "Formato immagine non valido" });
  }
  // Limit: ~512KB base64
  if (avatarData.length > 700000) {
    return res.status(400).json({ error: "Immagine troppo grande (max ~512KB)" });
  }
  await supabase.from('users').update({ avatarData }).eq('id', req.user.id);
  res.json({ success: true });
});

// Dev: Add currency (use for testing)
app.post("/api/dev/add-currency", authenticate, async (req: any, res) => {
  if (IS_PRODUCTION || !ENABLE_DEV_ENDPOINTS) {
    return res.status(404).json({ error: "Endpoint non disponibile." });
  }

  const { cash = 10000, gold = 10000 } = req.body;
  const cashNum = Number(cash);
  const goldNum = Number(gold);
  if (!Number.isFinite(cashNum) || !Number.isFinite(goldNum) || cashNum < 0 || goldNum < 0) {
    return res.status(400).json({ error: "Valori non validi." });
  }

  const { data: user } = await supabase.from('users').select('money, gold').eq('id', req.user.id).single();
  if (user) {
    await supabase.from('users').update({
      money: (user.money || 0) + cashNum,
      gold: (user.gold || 0) + goldNum
    }).eq('id', req.user.id);
  }
  res.json({ success: true, cash: cashNum, gold: goldNum });
});

// ==========================================
// PLAYER-DRIVEN FACTORIES API
// ==========================================

// (Orphaned legacy code removed)


// Change username
app.put("/api/profile/username", authenticate, async (req: any, res) => {
  const { username } = req.body;
  if (!username || typeof username !== "string") return res.status(400).json({ error: "Username mancante" });
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 20) return res.status(400).json({ error: "Username deve essere tra 3 e 20 caratteri" });
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) return res.status(400).json({ error: "Solo lettere, numeri e underscore" });

  try {
    const { error: uError } = await supabase.from('users').update({ username: trimmed }).eq('id', req.user.id);
    if (uError) throw uError;

    // Also update authorName in articles (if articles table exists in Supabase)
    await supabase.from('articles').update({ authorName: trimmed }).eq('authorId', req.user.id);

    res.json({ success: true, username: trimmed });
  } catch (e: any) {
    if (e.message?.includes("duplicate")) return res.status(409).json({ error: "Username già in uso" });
    res.status(500).json({ error: "Errore interno: " + e.message });
  }
});

app.post("/api/work", authenticate, async (req: any, res) => {
  const user = req.user;
  const userRegion = user.regionId || 'IT';
  const { factoryId } = req.body;

  const { data: factory } = await supabase.from('factories').select('*').eq('id', factoryId).single();
  if (!factory) return res.status(404).json({ error: "Fabbrica non trovata." });

  // Require player to be in the same region physically
  if (factory.regionId !== userRegion) return res.status(400).json({ error: "Devi viaggiare in questa regione per lavorare qui." });

  // Controllo immigrazione
  const { data: currentRegion } = await supabase.from('regions').select('*').eq('id', factory.regionId).single();
  const restrictionsActive = currentRegion?.workRestrictions === 1;
  const isResident = user.residenceId === factory.regionId;
  const { data: hasWorkPermit } = await supabase.from('work_permits')
    .select('id')
    .eq('userId', user.id)
    .eq('regionId', factory.regionId)
    .maybeSingle();

  if (restrictionsActive && !isResident && !hasWorkPermit && user.id !== factory.ownerUserId) {
    return res.status(403).json({ error: "Questa regione richiede un Permesso di Lavoro." });
  }

  // Cooldown
  const { data: lastWork } = await supabase.from('user_factory_cooldowns')
    .select('lastUsed')
    .eq('userId', user.id)
    .eq('factoryId', factoryId)
    .maybeSingle();

  // Base cooldown: 10 minutes (600s)
  if (lastWork && Date.now() - new Date(lastWork.lastUsed).getTime() < 600 * 1000) {
    return res.status(400).json({ error: "Fabbrica in cooldown (10 min)." });
  }

  // Energy
  const perks = await getUserPerks(user.id);
  const energyEfficiency = (perks['RESISTENZA'] || 0) * 0.005;
  const energyCost = Math.ceil(10 * (1 - energyEfficiency)); // Base 10 energy
  if (user.energy < energyCost) return res.status(400).json({ error: "Energia insufficiente." });

  const payMode = factory.payMode || 'salary';

  // Check Owner Storage Space
  const { data: owner } = await supabase.from('users').select('id').eq('id', factory.ownerUserId).single();
  if (!owner) return res.status(404).json({ error: "Proprietario inesistente." });

  const { data: ownerInv } = await supabase.from('user_inventory').select('quantity').eq('userId', owner.id);
  const ownerVol = (ownerInv || []).reduce((sum: number, item: any) => sum + item.quantity, 0);

  const ownerPerks = await getUserPerks(owner.id);
  const ownerResistenza = ownerPerks['RESISTENZA'] || 0;

  const maxStorage = Math.floor(GAME_CONFIG.STORAGE_BASE_CAPACITY * (1 + (ownerResistenza * 0.01)));

  // Calculate Output Amount
  let outputBase = factory.level * 2;
  let bonusMult = 1.0;
  if (factory.type === 'oil') bonusMult = currentRegion?.oilBonus || 1.0;
  else if (factory.type === 'minerals') bonusMult = currentRegion?.mineralsBonus || 1.0;
  else if (factory.type === 'uranium') bonusMult = currentRegion?.uraniumBonus || 1.0;
  else if (factory.type === 'diamonds') bonusMult = currentRegion?.diamondsBonus || 1.0;

  const finalOutput = Math.max(1, Math.floor(outputBase * bonusMult));

  if (payMode === 'resource') {
    // Resource-based work: player mines resources, split between player/owner/state
    const RESOURCE_MODE_OWNER_SHARE_PCT = 0.3; // 30% of net output goes to factory owner
    const taxRate = currentRegion?.marketTaxRate !== undefined ? currentRegion.marketTaxRate : 10;
    const stateShare = Math.floor(finalOutput * (taxRate / 100));
    const ownerShare = Math.floor((finalOutput - stateShare) * RESOURCE_MODE_OWNER_SHARE_PCT);
    // Guarantee player always gets at least 1 resource — prevents "Output troppo basso" error for low-level factories
    const playerShare = Math.max(1, finalOutput - stateShare - ownerShare);

    // EXECUTE RESOURCE WORK
    try {
      // Deduct energy and set cooldown
      await supabase.from('users').update({ energy: user.energy - energyCost }).eq('id', user.id);
      await supabase.from('user_factory_cooldowns').upsert({
        userId: user.id, factoryId, lastUsed: new Date().toISOString()
      });

      // Give player their share of resources
      const { data: playerInv } = await supabase.from('user_inventory')
        .select('quantity').eq('userId', user.id).eq('itemId', factory.type).maybeSingle();
      if (playerInv) {
        await supabase.from('user_inventory').update({ quantity: playerInv.quantity + playerShare })
          .eq('userId', user.id).eq('itemId', factory.type);
      } else {
        await supabase.from('user_inventory').insert({ userId: user.id, itemId: factory.type, quantity: playerShare });
      }

      // Give owner their share of resources - now goes to factory storage
      try {
        await supabase.rpc('increment_factory_storage', {
          p_factory_id: factoryId,
          p_amount: ownerShare
        });
      } catch (_e) {
        // RPC not available - fallback to manual update
        try {
          const { data: fac } = await supabase.from('factories').select('currentStorage').eq('id', factoryId).single();
          await supabase.from('factories').update({ currentStorage: (fac?.currentStorage || 0) + ownerShare }).eq('id', factoryId);
        } catch { /* non-critical */ }
      }

      // State gets its share via budget transaction
      if (stateShare > 0) {
        try {
          await supabase.rpc('add_budget_transaction', {
            p_owner_type: 'REGION',
            p_owner_id: factory.regionId,
            p_type: 'INCOME',
            p_subtype: 'RESOURCE_TAX',
            p_money_delta: 0,
            p_metadata: { resource: factory.type, quantity: stateShare, factoryId }
          });
        } catch (e) { console.error("[resource-work] Budget transaction error:", e); }
      }

      // XP Gain
      const xpGain = GAME_CONFIG.XP_PER_WORK + (perks['ISTRUZIONE'] || 0) * 2;
      await addXP(user.id, xpGain);

      // Work experience gain
      try {
        await incrementPlayerWorkExperience(user.id, factory.type, EXTRACTION_CONFIG.WORK_EXPERIENCE_GAIN);
      } catch (_e) { /* non-critical */ }

      res.json({ success: true, earnings: 0, output: playerShare, ownerShare, stateShare, xpGain, payMode: 'resource' });
    } catch (err: any) {
      res.status(500).json({ error: "Errore durante il lavoro: " + err.message });
    }
  } else {
    // Salary-based work (original logic)
    // Check budget
    if (factory.budget < factory.wage) {
      return res.status(400).json({ error: "L'azienda non ha abbastanza fondi per pagarti il salario." });
    }

  // PRESIDENTIAL_REPUBLIC: Double wage bonus for Leader and economic/foreign ministers
  let govBonus = 1;
  if (currentRegion && currentRegion.governmentForm === 'PRESIDENTIAL_REPUBLIC') {
    if (user.id === currentRegion.ownerUserId || user.id === currentRegion.economicAdviserId || user.id === currentRegion.foreignMinisterId) {
      govBonus = 2;
    }
  }

  const finalWage = Math.floor(factory.wage * govBonus);

  if (factory.budget < finalWage) {
    return res.status(400).json({ error: "L'azienda non ha abbastanza fondi per pagarti il salario." });
  }

  if (ownerVol + finalOutput > maxStorage) {
    return res.status(400).json({ error: "Il magazzino dell'azienda è pieno." });
  }

  // EXECUTE WORK
  try {
    try {
      await supabase.rpc('execute_factory_work', {
        p_user_id: user.id,
        p_factory_id: factoryId,
        p_wage: finalWage,
        p_output_item: factory.type,
        p_output_qty: finalOutput,
        p_energy_cost: energyCost,
        p_owner_id: owner.id
      });
    } catch (rpcErr: any) {
      // RPC not available - fallback to manual execution
      console.log("[work] execute_factory_work fallback:", rpcErr.message);
      // Fetch fresh user state to avoid stale values
      const { data: freshUsr } = await supabase.from('users').select('energy, money').eq('id', user.id).single();
      if (!freshUsr || (freshUsr.energy || 0) < energyCost) {
        return res.status(400).json({ error: "Energia insufficiente." });
      }
      // Deduct energy from user, add wage
      await supabase.from('users').update({ energy: (freshUsr.energy || 0) - energyCost, money: (freshUsr.money || 0) + finalWage }).eq('id', user.id);
      // Deduct wage from factory budget
      await supabase.from('factories').update({ budget: (factory.budget || 0) - finalWage }).eq('id', factoryId);
      // Add output to owner's inventory
      const { data: ownerInvItem } = await supabase.from('user_inventory')
        .select('quantity').eq('userId', owner.id).eq('itemId', factory.type).maybeSingle();
      if (ownerInvItem) {
        await supabase.from('user_inventory').update({ quantity: ownerInvItem.quantity + finalOutput })
          .eq('userId', owner.id).eq('itemId', factory.type);
      } else {
        await supabase.from('user_inventory').insert({ userId: owner.id, itemId: factory.type, quantity: finalOutput });
      }
    }

    await supabase.from('user_factory_cooldowns').upsert({
      userId: user.id,
      factoryId,
      lastUsed: new Date().toISOString()
    }, {
      onConflict: 'userId,factoryId'
    });

    // XP Gain
    const xpGain = GAME_CONFIG.XP_PER_WORK + (perks['ISTRUZIONE'] || 0) * 2;
    await addXP(user.id, xpGain);

    // Work experience gain
    try {
      await incrementPlayerWorkExperience(user.id, factory.type, EXTRACTION_CONFIG.WORK_EXPERIENCE_GAIN);
    } catch (_e) { /* non-critical */ }

    res.json({ success: true, earnings: finalWage, output: finalOutput, xpGain });
  } catch (err: any) {
    res.status(500).json({ error: "Errore durante il lavoro: " + err.message });
  }
  } // end salary mode
});

// Withdrawal API: Move resources from factory storage to personal inventory
app.post("/api/factories/:id/withdraw", authenticate, async (req: any, res) => {
  const { id: factoryId } = req.params;
  const user = req.user;

  try {
    const { data: factory, error: fError } = await supabase
      .from('factories')
      .select('*')
      .eq('id', factoryId)
      .single();

    if (fError || !factory) return res.status(404).json({ error: "Fabbrica non trovata." });
    if (factory.ownerUserId !== user.id) return res.status(403).json({ error: "Non sei il proprietario di questa fabbrica." });

    const amount = factory.currentStorage || 0;
    if (amount <= 0) return res.status(400).json({ error: "Il magazzino è vuoto." });

    // Check personal inventory capacity
    const { data: userInv } = await supabase.from('user_inventory').select('quantity').eq('userId', user.id);
    const currentVol = (userInv || []).reduce((sum: number, item: any) => sum + item.quantity, 0);
    const perks = await getUserPerks(user.id);
    const r = perks['RESISTENZA'] || 0;
    const maxStorage = Math.floor(GAME_CONFIG.STORAGE_BASE_CAPACITY * (1 + (r * 0.01)));

    if (currentVol + amount > maxStorage) {
      return res.status(400).json({ error: "Non hai abbastanza spazio nel tuo magazzino personale." });
    }

    // Move resources
    // 1. Update user inventory
    const { data: invItem } = await supabase.from('user_inventory')
      .select('quantity').eq('userId', user.id).eq('itemId', factory.type).maybeSingle();
    
    if (invItem) {
      await supabase.from('user_inventory').update({ quantity: invItem.quantity + amount })
        .eq('userId', user.id).eq('itemId', factory.type);
    } else {
      await supabase.from('user_inventory').insert({ userId: user.id, itemId: factory.type, quantity: amount });
    }

    // 2. Reset factory storage
    await supabase.from('factories').update({ currentStorage: 0 }).eq('id', factoryId);

    // 3. Log action
    await supabase.from('action_logs').insert({
      userId: user.id,
      action: 'FACTORY_WITHDRAW',
      details: JSON.stringify({ factoryId, amount, item: factory.type }),
      timestamp: Date.now()
    });

    res.json({ success: true, amount, item: factory.type });
  } catch (err: any) {
    console.error("Withdrawal error:", err);
    res.status(500).json({ error: "Errore durante il ritiro: " + err.message });
  }
});

// Wars API (extracted routes: list + stats)
registerWarRoutes({
  app,
  authenticate,
  supabase,
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

// ══════════════════════════════════════════════════════════════════
// WAR SYSTEM — Complete Routes
// ══════════════════════════════════════════════════════════════════

// Join an existing war as participant
app.post("/api/wars/:warId/join", authenticate, async (req: any, res) => {
  try {
    const user = req.user;
    const { warId } = req.params;
    const { side } = req.body;

    if (!side || (side !== 'attacker' && side !== 'defender')) {
      return res.status(400).json({ error: "Schieramento non valido." });
    }

    const { data: war } = await supabase.from('wars').select('*').eq('id', warId).single();
    if (!war) return res.status(404).json({ error: "Guerra inesistente." });
    if (war.status !== 'active') return res.status(400).json({ error: "Guerra già terminata." });

    // Check not already participating
    const { data: existing } = await supabase.from('war_participants')
      .select('id')
      .eq('warId', warId)
      .eq('userId', user.id)
      .maybeSingle();

    if (existing) return res.status(400).json({ error: "Sei già partecipante a questa guerra." });

    // Check military agreement for external wars
    const nationId = side === 'attacker' ? war.attackerCountryIso2 : war.defenderCountryIso2;
    if (user.regionId) {
      const { data: userRegion } = await supabase.from('regions').select('nation_id').eq('id', user.regionId).maybeSingle();
      if (userRegion?.nation_id !== nationId) {
        // External player — check military agreement
        const { data: agreement } = await supabase.from('war_military_agreements')
          .select('id')
          .eq('status', 'active')
          .or(`"stateA".eq.${userRegion?.nation_id},"stateB".eq.${userRegion?.nation_id}`)
          .or(`"stateA".eq.${nationId},"stateB".eq.${nationId}`)
          .maybeSingle();

        if (!agreement) {
          return res.status(403).json({ error: "Serve un accordo militare per combattere guerre esterne." });
        }
      }
    }

    await supabase.from('war_participants').insert({
      warId,
      userId: user.id,
      side,
      totalDamage: 0,
      troopsDeployed: {},
    });

    res.json({ success: true, message: "Ti sei unito alla guerra." });
  } catch (err: any) {
    res.status(500).json({ error: "Errore nell'unirsi alla guerra." });
  }
});

// Get war participants
app.get("/api/wars/:warId/participants", authenticate, async (req: any, res) => {
  const { warId } = req.params;
  const { data: participants } = await supabase.from('war_participants')
    .select('*')
    .eq('warId', warId)
    .order('totalDamage', { ascending: false });

  res.json({ participants: participants || [] });
});

// Get war deployments (history)
app.get("/api/wars/:warId/deployments", authenticate, async (req: any, res) => {
  const { warId } = req.params;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const { data: deployments } = await supabase.from('war_deployments')
    .select('*')
    .eq('warId', warId)
    .order('deployedAt', { ascending: false })
    .limit(limit);

  res.json({ deployments: deployments || [] });
});

// Get war history events
app.get("/api/wars/:warId/history", authenticate, async (req: any, res) => {
  const { warId } = req.params;
  const { data: history } = await supabase.from('war_history')
    .select('*')
    .eq('warId', warId)
    .order('createdAt', { ascending: false });

  res.json({ history: history || [] });
});

// Get available troops for a war
app.get("/api/wars/:warId/available-troops", authenticate, async (req: any, res) => {
  const { warId } = req.params;
  const { data: war } = await supabase.from('wars').select('warType, navalPhase').eq('id', warId).single();
  if (!war) return res.status(404).json({ error: "Guerra inesistente." });

  const troops = getAvailableTroops((war.warType || 'land') as WarType, war.navalPhase || 0);
  const troopDetails = troops.map((t: TroopType) => ({
    type: t,
    baseDamage: TROOP_BASE_DAMAGE[t],
    energyCost: TROOP_ENERGY_COST[t],
    moneyCost: TROOP_MONEY_COST[t],
  }));

  res.json({ troops: troopDetails });
});

// === AUTO-ATTACK ===

// Set auto-attack for a war
app.post("/api/wars/:warId/auto-attack", authenticate, async (req: any, res) => {
  try {
    const user = req.user;
    const { warId } = req.params;
    const { side, troopType, autoType, enabled } = req.body;

    const { data: war } = await supabase.from('wars').select('status').eq('id', warId).single();
    if (!war || war.status !== 'active') return res.status(400).json({ error: "Guerra non attiva." });

    if (enabled === false) {
      // Disable auto-attack
      await supabase.from('war_auto_attacks')
        .update({ isActive: false })
        .eq('warId', warId)
        .eq('userId', user.id);
      return res.json({ success: true, message: "Auto-attacco disattivato." });
    }

    if (!side || !troopType || !autoType) {
      return res.status(400).json({ error: "Dati mancanti per auto-attacco." });
    }

    const expiresAt = new Date(Date.now() + GAME_CONFIG.WAR_AUTO_EXPIRE_MS).toISOString();

    // Upsert auto-attack
    await supabase.from('war_auto_attacks').upsert({
      warId,
      userId: user.id,
      side,
      troopType,
      autoType: autoType || 'hourly',
      isActive: true,
      activatedAt: new Date().toISOString(),
      expiresAt,
    }, { onConflict: 'warId,userId' });

    res.json({ success: true, message: `Auto-attacco ${autoType} attivato.`, expiresAt });
  } catch (err: any) {
    res.status(500).json({ error: "Errore nell'impostazione dell'auto-attacco." });
  }
});

// Get user's auto-attack status
app.get("/api/wars/:warId/auto-attack", authenticate, async (req: any, res) => {
  const user = req.user;
  const { warId } = req.params;
  const { data: autoAttack } = await supabase.from('war_auto_attacks')
    .select('*')
    .eq('warId', warId)
    .eq('userId', user.id)
    .eq('isActive', true)
    .maybeSingle();

  res.json({ autoAttack: autoAttack || null });
});

// === REVOLUTION ===

// Create or join a revolution lobby
app.post("/api/wars/revolution", authenticate, async (req: any, res) => {
  try {
    const user = req.user;
    const { regionId } = req.body;

    if (!regionId) {
      return res.status(400).json({ error: "Dati mancanti: regionId richiesto." });
    }

    const goldCost = GAME_CONFIG.WAR_REVOLUTION_GOLD_COST;
    const minPlayers = GAME_CONFIG.WAR_REVOLUTION_MIN_PLAYERS;

    // Check user has enough gold
    const { data: freshUser } = await supabase.from('users').select('gold').eq('id', user.id).single();
    if (!freshUser || (freshUser.gold || 0) < goldCost) {
      return res.status(400).json({ error: `Gold insufficiente. Servono ${goldCost} Gold.` });
    }

    // Check cooldown
    const { data: lastRevolution } = await supabase.from('revolutions')
      .select('cooldownUntil')
      .eq('regionId', regionId)
      .order('createdAt', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastRevolution?.cooldownUntil && new Date(lastRevolution.cooldownUntil).getTime() > Date.now()) {
      return res.status(400).json({ error: "Rivoluzione in cooldown per questa regione." });
    }

    // Check no active war
    const { data: activeWar } = await supabase.from('wars')
      .select('id').eq('status', 'active')
      .or(`"attackerRegionId".eq.${regionId},"defenderRegionId".eq.${regionId}`)
      .maybeSingle();
    if (activeWar) return res.status(400).json({ error: "Regione già in guerra." });

    const { data: activeRev } = await supabase.from('revolutions')
      .select('id').eq('regionId', regionId).eq('status', 'active').maybeSingle();
    if (activeRev) return res.status(400).json({ error: "Rivoluzione già in corso." });

    // Check for existing pending lobby
    const { data: existingLobby } = await supabase.from('revolution_lobbies')
      .select('*')
      .eq('regionId', regionId)
      .eq('lobbyType', 'revolution')
      .eq('status', 'pending')
      .maybeSingle();

    if (existingLobby) {
      // Join existing lobby
      if ((existingLobby.participantIds || []).includes(user.id)) {
        return res.status(400).json({ error: "Sei già in questa lobby." });
      }

      const newParticipants = [...(existingLobby.participantIds || []), user.id];

      // Deduct gold from joining player
      await supabase.from('users').update({ gold: (freshUser.gold || 0) - goldCost }).eq('id', user.id);

      if (newParticipants.length >= minPlayers) {
        // Lobby is full - start the revolution!
        await supabase.from('revolution_lobbies').update({
          participantIds: newParticipants,
          status: 'started',
          updatedAt: new Date().toISOString(),
        }).eq('id', existingLobby.id);

        // Create war
        const warId = generateSecureId(9);
        const now = new Date();
        const { data: region } = await supabase.from('regions').select('*').eq('id', regionId).single();

        await supabase.from('wars').insert({
          id: warId,
          attackerCountryIso2: 'REV',
          defenderCountryIso2: region?.nation_id || regionId,
          attackerUserId: existingLobby.creatorId,
          defenderUserId: region?.leaderUserId || region?.ownerUserId || null,
          status: 'active',
          startedAt: now.toISOString(),
          endsAt: new Date(now.getTime() + GAME_CONFIG.WAR_DURATION_MS).toISOString(),
          attackerScore: 0, defenderScore: 0,
          warType: 'revolution',
          attackerRegionId: regionId, defenderRegionId: regionId,
          createdAt: now.toISOString(), updatedAt: now.toISOString(),
        });

        const cooldownUntil = new Date(now.getTime() + GAME_CONFIG.WAR_REVOLUTION_COOLDOWN_MS).toISOString();

        await supabase.from('revolutions').insert({
          regionId,
          initiatorIds: newParticipants,
          goldCost: goldCost * newParticipants.length,
          status: 'active',
          warId,
          cooldownUntil,
        });

        for (const uid of newParticipants) {
          await supabase.from('war_participants').insert({
            warId, userId: uid, side: 'attacker', totalDamage: 0, troopsDeployed: {},
          });
        }

        await supabase.from('war_history').insert({
          warId,
          eventType: 'war_started',
          eventData: { warType: 'revolution', regionId, initiatorIds: newParticipants, goldCost: goldCost * newParticipants.length },
        });

        res.json({ success: true, warId, message: "Rivoluzione iniziata!", started: true, participants: newParticipants.length, required: minPlayers });
      } else {
        // Update lobby with new participant
        await supabase.from('revolution_lobbies').update({
          participantIds: newParticipants,
          updatedAt: new Date().toISOString(),
        }).eq('id', existingLobby.id);

        res.json({ success: true, message: `Ti sei unito alla lobby! ${newParticipants.length}/${minPlayers} giocatori.`, started: false, participants: newParticipants.length, required: minPlayers, lobbyId: existingLobby.id });

        // ── Daily Missions: revolution progress (non-blocking) ──
        try { await updateMissionProgress(user.id, 'REVOLUTION_JOIN', { join_revolution: 1, check_revolution: 1, political_action: 1 }); } catch { /* non-critical */ }
      }
    } else {
      // Create new lobby
      // Deduct gold from creator
      await supabase.from('users').update({ gold: (freshUser.gold || 0) - goldCost }).eq('id', user.id);

      const { data: lobby, error: lobbyError } = await supabase.from('revolution_lobbies').insert({
        regionId,
        lobbyType: 'revolution',
        creatorId: user.id,
        participantIds: [user.id],
        requiredPlayers: minPlayers,
        status: 'pending',
        goldCostPerPlayer: goldCost,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }).select().single();

      if (lobbyError) throw lobbyError;

      res.json({ success: true, message: `Lobby rivoluzione creata! ${1}/${minPlayers} giocatori. In attesa di altri...`, started: false, participants: 1, required: minPlayers, lobbyId: lobby.id });

      // ── Daily Missions: revolution progress (non-blocking) ──
      try { await updateMissionProgress(user.id, 'REVOLUTION_JOIN', { join_revolution: 1, check_revolution: 1, political_action: 1 }); } catch { /* non-critical */ }
    }
  } catch (err: any) {
    console.error("Revolution error:", err);
    res.status(500).json({ error: "Errore nell'avvio della rivoluzione." });
  }
});

// === COUP D'ÉTAT ===

app.post("/api/wars/coup", authenticate, async (req: any, res) => {
  try {
    const user = req.user;
    const { regionId } = req.body;

    if (!regionId) {
      return res.status(400).json({ error: "Dati mancanti: regionId richiesto." });
    }

    const minPlayers = GAME_CONFIG.WAR_COUP_MIN_PLAYERS;

    // Check development level must be 1
    const { data: region } = await supabase.from('regions').select('*').eq('id', regionId).single();
    if (!region) return res.status(404).json({ error: "Regione non trovata." });

    const buildings = await getRegionBuildings(regionId);
    const indices = calculateRegionalIndices(buildings);
    if (indices.developmentIndex > GAME_CONFIG.WAR_COUP_MAX_DEVELOPMENT) {
      return res.status(400).json({ error: "Colpo di stato possibile solo con sviluppo = 1." });
    }

    // Check no active war/coup
    const { data: activeWar } = await supabase.from('wars')
      .select('id').eq('status', 'active')
      .or(`"attackerRegionId".eq.${regionId},"defenderRegionId".eq.${regionId}`)
      .maybeSingle();
    if (activeWar) return res.status(400).json({ error: "Regione già in guerra." });

    const { data: activeCoup } = await supabase.from('coups')
      .select('id').eq('regionId', regionId).eq('status', 'active').maybeSingle();
    if (activeCoup) return res.status(400).json({ error: "Colpo di stato già in corso." });

    // Check for existing pending lobby
    const { data: existingLobby } = await supabase.from('revolution_lobbies')
      .select('*')
      .eq('regionId', regionId)
      .eq('lobbyType', 'coup')
      .eq('status', 'pending')
      .maybeSingle();

    if (existingLobby) {
      // Join existing lobby
      if ((existingLobby.participantIds || []).includes(user.id)) {
        return res.status(400).json({ error: "Sei già in questa lobby." });
      }

      const newParticipants = [...(existingLobby.participantIds || []), user.id];

      if (newParticipants.length >= minPlayers) {
        // Lobby is full - start the coup!
        await supabase.from('revolution_lobbies').update({
          participantIds: newParticipants,
          status: 'started',
          updatedAt: new Date().toISOString(),
        }).eq('id', existingLobby.id);

        const warId = generateSecureId(9);
        const now = new Date();

        await supabase.from('wars').insert({
          id: warId,
          attackerCountryIso2: 'COUP',
          defenderCountryIso2: region.nation_id || regionId,
          attackerUserId: existingLobby.creatorId,
          defenderUserId: region.leaderUserId || region.ownerUserId || null,
          status: 'active',
          startedAt: now.toISOString(),
          endsAt: new Date(now.getTime() + GAME_CONFIG.WAR_DURATION_MS).toISOString(),
          attackerScore: 0, defenderScore: 0,
          warType: 'coup',
          attackerRegionId: regionId, defenderRegionId: regionId,
          createdAt: now.toISOString(), updatedAt: now.toISOString(),
        });

        await supabase.from('coups').insert({
          regionId,
          initiatorIds: newParticipants,
          status: 'active',
          warId,
        });

        for (const uid of newParticipants) {
          await supabase.from('war_participants').insert({
            warId, userId: uid, side: 'attacker', totalDamage: 0, troopsDeployed: {},
          });
        }

        await supabase.from('war_history').insert({
          warId,
          eventType: 'war_started',
          eventData: { warType: 'coup', regionId, initiatorIds: newParticipants },
        });

        res.json({ success: true, warId, message: "Colpo di stato iniziato!", started: true, participants: newParticipants.length, required: minPlayers });
      } else {
        await supabase.from('revolution_lobbies').update({
          participantIds: newParticipants,
          updatedAt: new Date().toISOString(),
        }).eq('id', existingLobby.id);

        res.json({ success: true, message: `Ti sei unito alla lobby! ${newParticipants.length}/${minPlayers} giocatori.`, started: false, participants: newParticipants.length, required: minPlayers, lobbyId: existingLobby.id });

        // ── Daily Missions: coup progress (non-blocking) ──
        try { await updateMissionProgress(user.id, 'COUP_JOIN', { join_revolution: 1, check_revolution: 1, political_action: 1 }); } catch { /* non-critical */ }
      }
    } else {
      // Create new lobby
      const { data: lobby, error: lobbyError } = await supabase.from('revolution_lobbies').insert({
        regionId,
        lobbyType: 'coup',
        creatorId: user.id,
        participantIds: [user.id],
        requiredPlayers: minPlayers,
        status: 'pending',
        goldCostPerPlayer: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }).select().single();

      if (lobbyError) throw lobbyError;

      res.json({ success: true, message: `Lobby colpo di stato creata! ${1}/${minPlayers} giocatori. In attesa di altri...`, started: false, participants: 1, required: minPlayers, lobbyId: lobby.id });

      // ── Daily Missions: coup progress (non-blocking) ──
      try { await updateMissionProgress(user.id, 'COUP_JOIN', { join_revolution: 1, check_revolution: 1, political_action: 1 }); } catch { /* non-critical */ }
    }
  } catch (err: any) {
    console.error("Coup error:", err);
    res.status(500).json({ error: "Errore nell'avvio del colpo di stato." });
  }
});

// Get lobby status for a region
app.get("/api/lobbies/:regionId", authenticate, async (req: any, res) => {
  try {
    const normalizedRegionId = normalizeRegionLikeId(req.params.regionId);
    if (!normalizedRegionId) {
      return res.status(400).json({ error: "Regione non valida." });
    }

    const canRead = await canReadRegionScopedData(req.user, normalizedRegionId);
    if (!canRead) {
      return res.status(403).json({ error: "Non autorizzato a visualizzare le lobby di questa regione." });
    }

    const { data: lobbies } = await supabase.from('revolution_lobbies')
      .select('*')
      .eq('regionId', normalizedRegionId)
      .eq('status', 'pending')
      .order('createdAt', { ascending: false });

    // GET must be side-effect free: only filter active/pending lobbies in-memory.
    const now = Date.now();
    const active = (lobbies || []).filter((l: any) => {
      if (!l.expiresAt) return true;
      return new Date(l.expiresAt).getTime() >= now;
    });

    // Get usernames for participants
    const allParticipantIds = active.flatMap((l: any) => l.participantIds || []);
    const { data: users } = allParticipantIds.length > 0
      ? await supabase.from('users').select('id, username').in('id', allParticipantIds)
      : { data: [] };

    const usernameMap: Record<string, string> = {};
    (users || []).forEach((u: any) => { usernameMap[u.id] = u.username; });

    const result = active.map((l: any) => ({
      id: l.id,
      lobbyType: l.lobbyType,
      regionId: l.regionId,
      participants: (l.participantIds || []).map((uid: string) => ({ id: uid, username: usernameMap[uid] || uid })),
      required: l.requiredPlayers,
      current: (l.participantIds || []).length,
      goldCostPerPlayer: l.goldCostPerPlayer,
      createdAt: l.createdAt,
      expiresAt: l.expiresAt,
      isJoined: (l.participantIds || []).includes(req.user.id),
    }));

    res.json({ lobbies: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Expire a lobby and refund participants (atomic RPC, no side effects on GET)
app.post("/api/lobbies/:id/expire", authenticate, async (req: any, res) => {
  const lobbyId = String(req.params.id || '').trim();
  if (!isValidUuid(lobbyId)) {
    return res.status(400).json({ error: "Lobby ID non valido." });
  }

  const { data: lobby, error: lobbyError } = await supabase
    .from('revolution_lobbies')
    .select('regionId')
    .eq('id', lobbyId)
    .maybeSingle();

  if (lobbyError) return res.status(500).json({ error: "Errore nel recupero lobby." });
  if (!lobby) return res.status(404).json({ error: "Lobby non trovata." });

  const managedRegionId = await assertCanManageRegion(req, res, lobby.regionId, "Non autorizzato a scadere questa lobby.");
  if (!managedRegionId) return;

  const { data: rpcResult, error: rpcError } = await supabase.rpc('expire_revolution_lobby_atomic', {
    p_lobby_id: lobbyId,
    p_actor_user_id: req.user.id,
  });

  if (rpcError) {
    console.error("[lobbies.expire] RPC failure:", rpcError);
    return res.status(500).json({ error: "Errore interno durante la scadenza della lobby." });
  }

  const codeToStatus: Record<string, number> = {
    invalid_input: 400,
    not_found: 404,
    region_not_found: 404,
    forbidden: 403,
    invalid_state: 409,
    not_expired: 409,
    race_condition: 409,
  };

  const result = rpcResult || {};
  if (!result.success) {
    return res.status(codeToStatus[result.code] || 400).json({ error: result.message || "Operazione non riuscita." });
  }

  return res.json({
    success: true,
    status: result.status,
    idempotent: !!result.idempotent,
    refundedParticipants: Number(result.refundedParticipants || 0),
  });
});

// === MILITARY AGREEMENTS ===

app.post("/api/military-agreements", authenticate, async (req: any, res) => {
  try {
    const user = req.user;
    const { targetStateId, agreementType } = req.body;

    if (!targetStateId || !agreementType) {
      return res.status(400).json({ error: "Dati mancanti." });
    }

    // User must be leader of their nation
    const { data: userRegion } = await supabase.from('regions').select('nation_id, leaderUserId').eq('id', user.regionId).maybeSingle();
    if (!userRegion || userRegion.leaderUserId !== user.id) {
      return res.status(403).json({ error: "Solo il leader nazionale può proporre accordi militari." });
    }

    const initiatorState = userRegion.nation_id;
    if (!initiatorState) return res.status(400).json({ error: "Nazione non trovata." });

    // Normalize state pair (alphabetical order for uniqueness)
    const [stateA, stateB] = [initiatorState, targetStateId].sort();

    // Check existing
    const { data: existing } = await supabase.from('war_military_agreements')
      .select('id, status')
      .eq('stateA', stateA)
      .eq('stateB', stateB)
      .maybeSingle();

    if (existing && existing.status === 'active') {
      return res.status(400).json({ error: "Accordo militare già attivo." });
    }

    if (existing && existing.status === 'pending') {
      // If other side proposed, accept it
      if (agreementType === 'bilateral') {
        await supabase.from('war_military_agreements').update({
          status: 'active',
          updatedAt: new Date().toISOString(),
        }).eq('id', existing.id);
        return res.json({ success: true, message: "Accordo militare accettato!" });
      }
    }

    // Create new agreement
    await supabase.from('war_military_agreements').upsert({
      stateA,
      stateB,
      agreementType,
      initiatorState,
      status: agreementType === 'unilateral' ? 'active' : 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { onConflict: 'stateA,stateB' });

    res.json({ success: true, message: agreementType === 'unilateral' ? 'Accordo unilaterale attivato.' : 'Proposta di accordo inviata.' });
  } catch (err: any) {
    res.status(500).json({ error: "Errore nella creazione dell'accordo militare." });
  }
});

// List military agreements for a state
app.get("/api/military-agreements/:stateId", authenticate, async (req: any, res) => {
  const stateId = normalizeRegionLikeId(req.params.stateId);
  if (!stateId) return res.status(400).json({ error: "Stato non valido." });

  const canRead = await canReadRegionScopedData(req.user, stateId);
  if (!canRead) {
    return res.status(403).json({ error: "Non autorizzato a visualizzare gli accordi militari di questo Stato." });
  }

  const { data: agreements } = await supabase.from('war_military_agreements')
    .select('*')
    .or(`"stateA".eq.${stateId},"stateB".eq.${stateId}`)
    .eq('status', 'active');

  res.json({ agreements: agreements || [] });
});

// === WAR DEPARTMENTS ===

app.get("/api/war-departments/:stateId", authenticate, async (req: any, res) => {
  const stateId = normalizeRegionLikeId(req.params.stateId);
  if (!stateId) return res.status(400).json({ error: "Stato non valido." });

  const canRead = await canReadRegionScopedData(req.user, stateId);
  if (!canRead) {
    return res.status(403).json({ error: "Non autorizzato a visualizzare i dipartimenti di guerra di questo Stato." });
  }

  const { data: departments } = await supabase.from('war_departments')
    .select('*')
    .eq('stateId', stateId);

  res.json({ departments: departments || [] });
});

// Get active revolutions for a region
app.get("/api/revolutions/:regionId", authenticate, async (req: any, res) => {
  const regionId = normalizeRegionLikeId(req.params.regionId);
  if (!regionId) return res.status(400).json({ error: "Regione non valida." });

  const canRead = await canReadRegionScopedData(req.user, regionId);
  if (!canRead) {
    return res.status(403).json({ error: "Non autorizzato a visualizzare le rivoluzioni di questa regione." });
  }

  const { data: revolutions } = await supabase.from('revolutions')
    .select('*')
    .eq('regionId', regionId)
    .order('createdAt', { ascending: false })
    .limit(10);

  res.json({ revolutions: revolutions || [] });
});

// Get active coups for a region
app.get("/api/coups/:regionId", authenticate, async (req: any, res) => {
  const regionId = normalizeRegionLikeId(req.params.regionId);
  if (!regionId) return res.status(400).json({ error: "Regione non valida." });

  const canRead = await canReadRegionScopedData(req.user, regionId);
  if (!canRead) {
    return res.status(403).json({ error: "Non autorizzato a visualizzare i colpi di stato di questa regione." });
  }

  const { data: coups } = await supabase.from('coups')
    .select('*')
    .eq('regionId', regionId)
    .order('createdAt', { ascending: false })
    .limit(10);

  res.json({ coups: coups || [] });
});

app.post("/api/perks/upgrade", authenticate, async (req: any, res) => {
  const user = req.user;
  const { perkId, useGold } = req.body;

  const perkDef = PERKS_DEFS.find(p => p.id === perkId);
  if (!perkDef) return res.status(404).json({ error: "Perk non trovato" });

  const currentLevel = user.perks[perkId] || 0;

  const targetLevel = currentLevel + 1;
  const baseCashCost = (perkDef as any).baseCashCost || 2000;
  const baseGoldCost = (perkDef as any).baseGoldCost || 20;
  const baseTimeCashSec = (perkDef as any).baseTimeCashSec || 3600;
  const baseTimeGoldSec = (perkDef as any).baseTimeGoldSec || 1200;

  const cashCost = Math.round(baseCashCost * Math.pow(1.5, currentLevel));
  const goldCost = Math.ceil(baseGoldCost * Math.pow(1.4, currentLevel));
  const cashTimeSec = Math.round(baseTimeCashSec * Math.pow(1.3, currentLevel));
  const goldTimeSec = Math.round(baseTimeGoldSec * Math.pow(1.3, currentLevel));

  // --- Enforce ONE upgrade at a time (globally across all perks) ---
  const { data: userData } = await supabase.from('users').select('perkUpgradesJson').eq('id', user.id).single();
  let existingUpgrades = JSON.parse(userData?.perkUpgradesJson || '{}');

  const nowTs = Date.now();
  const anyActive = Object.entries(existingUpgrades).some(([id, upg]: [string, any]) =>
    upg.willCompleteAt > nowTs
  );
  if (anyActive) {
    return res.status(400).json({ error: "Hai già un potenziamento in corso. Puoi imparare solo una abilità alla volta." });
  }

  // Check if this specific perk already queued
  if (existingUpgrades[perkId]?.willCompleteAt > nowTs) {
    return res.status(400).json({ error: "Questo perk è già in fase di potenziamento." });
  }

  // Cash is always required as a base cost
  if (user.money < cashCost) {
    return res.status(400).json({ error: `Cash insufficiente. Costo: $${cashCost.toLocaleString()}` });
  }

  if (useGold && user.gold < goldCost) {
    return res.status(400).json({ error: `Gold insufficiente. Servono 🪙 ${goldCost}` });
  }

  const timeSec = useGold ? goldTimeSec : cashTimeSec;
  const willCompleteAt = nowTs + (timeSec * 1000);

  // Store the new upgrade in existingUpgrades before saving
  existingUpgrades[perkId] = {
    startedAt: nowTs,
    willCompleteAt,
    targetLevel: targetLevel
  };

  const updateData: any = { perkUpgradesJson: JSON.stringify(existingUpgrades) };
  
  // Atomic currency deduction for perk upgrades
  const perkMoneyCost = cashCost;
  const perkGoldCost = useGold ? goldCost : 0;
  
  const { data: deductResult, error: deductError } = await supabase.rpc('safe_deduct_currency', {
    p_user_id: user.id,
    p_money_cost: perkMoneyCost,
    p_gold_cost: perkGoldCost,
    p_energy_cost: 0,
  });
  if (deductError) {
    return res.status(500).json({ error: "Errore nella deduzione: " + deductError.message });
  }
  const deductData = typeof deductResult === 'string' ? JSON.parse(deductResult) : deductResult;
  if (deductData?.error) return res.status(400).json({ error: deductData.error });

  await supabase.from('users').update(updateData).eq('id', user.id);

  // ── Daily Missions: perk upgrade progress (non-blocking) ──
  try {
    await updateMissionProgress(user.id, 'PERK_UPGRADE', { upgrade_perk: 1 });
  } catch { /* non-critical */ }

  return res.json({ success: true, queued: true, willCompleteAt, timeSec });
});

app.post("/api/perks/booster", authenticate, async (req: any, res) => {
  const user = req.user;
  const { perkId, useGold } = req.body;

  const perkDef = PERKS_DEFS.find(p => p.id === perkId);
  if (!perkDef) return res.status(404).json({ error: "Perk non trovato" });

  const currentLevel = user.perks[perkId] || 0;

  // Check cooldown (only if there was a previous activation)
  let activeBoosters: Record<string, any> = {};
  try {
    activeBoosters = JSON.parse(user.boostersJson || '{}');
  } catch { activeBoosters = {}; }

  const nowTs = Date.now();
  const booster = activeBoosters[perkId];

  if (booster && nowTs < booster.lastActivatedAt + BOOSTER_CONFIG.COOLDOWN_MS) {
    const remainingCooldown = booster.lastActivatedAt + BOOSTER_CONFIG.COOLDOWN_MS - nowTs;
    const days = Math.floor(remainingCooldown / (24 * 60 * 60 * 1000));
    const hours = Math.floor((remainingCooldown % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    return res.status(400).json({ error: `Booster in ricarica. Riprova fra ${days}g ${hours}h.` });
  }

  const price = useGold ? BOOSTER_CONFIG.GOLD_PRICE : BOOSTER_CONFIG.CASH_PRICE;
  if (useGold) {
    if (user.gold < price) return res.status(400).json({ error: `Oro insufficiente. Servono 🪙 ${price} Gold.` });
  } else {
    if (user.money < price) return res.status(400).json({ error: `Cash insufficiente. Costo: $${price.toLocaleString()}` });
  }

  // Duration decay formula: base / (1 + perkLevel * decay)
  const baseDuration = useGold ? BOOSTER_CONFIG.BASE_DURATION_GOLD_MS : BOOSTER_CONFIG.BASE_DURATION_CASH_MS;
  const duration = Math.round(baseDuration / (1 + currentLevel * BOOSTER_CONFIG.DURATION_DECAY));
  const expiresAt = nowTs + duration;

  activeBoosters[perkId] = {
    expiresAt,
    lastActivatedAt: nowTs,
    isGold: !!useGold
  };

  const updateData: any = { boostersJson: JSON.stringify(activeBoosters) };
  
  // Atomic currency deduction for booster
  const { data: deductResult, error: deductError } = await supabase.rpc('safe_deduct_currency', {
    p_user_id: user.id,
    p_money_cost: useGold ? 0 : price,
    p_gold_cost: useGold ? price : 0,
    p_energy_cost: 0,
  });
  if (deductError) {
    return res.status(500).json({ error: "Errore nella deduzione: " + deductError.message });
  }
  const boosterDeductData = typeof deductResult === 'string' ? JSON.parse(deductResult) : deductResult;
  if (boosterDeductData?.error) return res.status(400).json({ error: boosterDeductData.error });

  await supabase.from('users').update(updateData).eq('id', user.id);

  return res.json({
    success: true,
    expiresAt,
    duration,
    perkId
  });
});

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

app.get("/api/countries/:iso2/sanctions", authenticate, async (req: any, res) => {
  const stateId = (req.params.iso2 || '').toUpperCase();
  const normalizedId = stateId.replace('NATION_', '').replace('nation_', '');

  const { data: sanctions } = await supabase
    .from('sanctions')
    .select('*, regions!targetStateId(name)')
    .eq('fromStateId', normalizedId)
    .eq('status', 'ACTIVE');

  res.json(sanctions || []);
});

app.post("/api/sanctions/apply", authenticate, async (req: any, res) => {
  const user = req.user;
  const { targetStateId: rawTarget, fromStateId: rawFrom } = req.body;
  const targetStateId = rawTarget?.toUpperCase().replace('NATION_', '').replace('nation_', '');
  const finalFromStateId = (rawFrom || user.regionId)?.toUpperCase().replace('NATION_', '').replace('nation_', '');

  const { data: region } = await supabase.from('regions').select('ownerUserId, economicAdviserId').eq('id', finalFromStateId).single();
  if (!region) return res.status(404).json({ error: "Regione non trovata." });

  const isLeader = region.ownerUserId === user.id;
  const { data: minister } = await supabase.from('ministers')
    .select('id')
    .eq('stateId', finalFromStateId)
    .eq('userId', user.id)
    .eq('role', 'economics')
    .eq('status', 'ACTIVE')
    .single();

  if (!isLeader && !minister) return res.status(403).json({ error: "Autorizzazione insufficiente." });

  await supabase.from('sanctions').insert({
    id: generateSecureId(9),
    fromStateId: finalFromStateId,
    targetStateId,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    createdByUserId: user.id
  });

  res.json({ success: true });
});

app.post("/api/sanctions/revoke", authenticate, async (req: any, res) => {
  const user = req.user;
  const { sanctionId } = req.body;

  const { data: sanction } = await supabase.from('sanctions').select('*').eq('id', sanctionId).single();
  if (!sanction) return res.status(404).json({ error: "Sanzione non trovata." });

  await supabase.from('sanctions').update({
    status: 'REVOKED',
    revokedAt: new Date().toISOString(),
    revokedByUserId: user.id
  }).eq('id', sanctionId);

  res.json({ success: true });
});

// ==============================================================
// MARKET API (Player-Driven)
// ==============================================================

// Get state inventory (budget resources) for the leader's state
app.get("/api/market/state-inventory", authenticate, async (req: any, res) => {
  const user = req.user;
  try {
    // 1. Find if user is leader of a nation (STATE Level)
    const { data: nation } = await supabase
      .from('nations')
      .select('id')
      .eq('leaderUserId', user.id)
      .maybeSingle();

    // 2. Find if user owns any regions (REGION Level)
    const { data: region } = await supabase
      .from('regions')
      .select('id')
      .eq('ownerUserId', user.id)
      .maybeSingle();

    if (!nation && !region) return res.json([]);

    let budget = null;

    // 1. Try to fetch National budget first (if user is leader)
    if (nation) {
      const { data } = await supabase
        .from('budgets')
        .select('moneyEUR, resources')
        .eq('ownerType', 'STATE')
        .eq('ownerId', nation.id)
        .maybeSingle();
      if (data) budget = data;
    }

    // 2. Fallback to fetch Region budget (if user is owner)
    if (!budget && region) {
      const { data } = await supabase
        .from('budgets')
        .select('moneyEUR, resources')
        .eq('ownerType', 'REGION')
        .eq('ownerId', region.id)
        .maybeSingle();
      if (data) budget = data;
    }

    if (!budget) return res.json([]);

    const resources = typeof budget.resources === 'string' ? JSON.parse(budget.resources) : (budget.resources || {});
    const resourcesArray = Object.entries(resources)
      .filter(([_, qty]) => (qty as number) > 0)
      .map(([itemId, quantity]) => ({ itemId, quantity }));

    res.json(resourcesArray);
  } catch (err) {
    console.error("[StateInventory] Fatal Error:", err);
    res.status(500).json({ error: "Errore interno nel caricamento dell'inventario statale." });
  }
});

app.get("/api/market/offers", authenticate, async (req: any, res) => {
  try {
    const { data: offers, error } = await supabase
      .from('market_offers')
      .select('*')
      .order('createdAt', { ascending: false })
      .limit(100);

    if (error) throw error;
    res.json(offers || []);
  } catch (err: any) {
    console.error("Market offers error:", err);
    res.status(500).json({ error: "Errore nel caricamento del mercato." });
  }
});

app.post("/api/market/offer", authenticate, async (req: any, res) => {
  const user = req.user;
  const { itemId, quantity, price } = req.body;

  if (!itemId || !quantity || !price || quantity <= 0 || price <= 0) {
    return res.status(400).json({ error: "Parametri non validi." });
  }

  try {
    // Check Cooldown
    const { data: lastOffer } = await supabase
      .from('market_offers')
      .select('createdAt')
      .eq('sellerId', user.id)
      .eq('itemId', itemId)
      .order('createdAt', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastOffer && Date.now() - new Date(lastOffer.createdAt).getTime() < GAME_CONFIG.MARKET_OFFER_COOLDOWN_MS) {
      return res.status(400).json({ error: "Devi attendere 5 minuti prima di pubblicare un'altra offerta per questo oggetto." });
    }

    // Check Inventory
    const { data: userInv } = await supabase
      .from('user_inventory')
      .select('quantity')
      .eq('userId', user.id)
      .eq('itemId', itemId)
      .single();

    if (!userInv || userInv.quantity < quantity) {
      return res.status(400).json({ error: "Non hai abbastanza risorse nell'inventario per creare questa offerta." });
    }

    // Get Tax Rate & Sanctions
    const { data: region } = await supabase.from('regions').select('*').eq('id', user.regionId).single();
    const taxRate = region?.marketTaxRate !== undefined ? region.marketTaxRate : 10;

    // Sanctions Check
    const { data: sanctions } = await supabase.from('sanctions')
      .select('id')
      .eq('fromStateId', user.regionId)
      .eq('targetStateId', user.originalNation)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (sanctions) {
      return res.status(403).json({ error: "Sanzioni commerciali attive: non puoi vendere prodotti della tua nazione in questo Stato." });
    }

    // Transaction via RPC
    const { error: rpcError } = await supabase.rpc('create_market_offer', {
      p_user_id: user.id,
      p_item_id: itemId,
      p_quantity: quantity,
      p_price: price,
      p_region_id: user.regionId,
      p_tax_rate: taxRate,
      p_origin_state_id: user.originalNation || user.regionId
    });

    if (rpcError) {
      console.error("Market offer RPC error:", rpcError);
      return res.status(500).json({ error: `Errore database: ${rpcError.message}` });
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("Market offer error:", err);
    res.status(500).json({ error: "Errore durante la creazione dell'offerta." });
  }
});

app.post("/api/market/buy", authenticate, async (req: any, res) => {
  const user = req.user;
  const { offerId, quantity, isStateBuy } = req.body;

  if (!offerId || !quantity || quantity <= 0) {
    return res.status(400).json({ error: "Parametri non validi." });
  }

  try {
    const { error: buyError } = await supabase.rpc('purchase_market_offer', {
      p_buyer_id: user.id,
      p_offer_id: offerId,
      p_quantity: quantity,
      p_is_state_buy: isStateBuy ? true : false,
      p_buyer_state_id: user.residenceId || 'IT'
    });

    if (buyError) throw buyError;

    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==============================================================
// WEAPON PRODUCTION API (SQLite)
// ==============================================================
app.post("/api/produce", authenticate, async (req: any, res) => {
  const user = req.user;

  const perks = await getUserPerks(user.id);
  const resistanceLv = perks['RESISTENZA'] || 0;
  const maxStorage = Math.floor(GAME_CONFIG.STORAGE_BASE_CAPACITY * (1 + (resistanceLv * 0.01)));

  try {
    const result = await productionService.produce({
      userId: user.id,
      weaponType: req.body?.weaponType,
      qty: req.body?.qty,
      maxStorage,
      generateId: () => generateSecureId(9),
      nowMs: () => Date.now(),
    });

    const http = mapServiceResultToHttp(result);
    return res.status(http.statusCode).json(http.body);
  } catch (err: any) {
    console.error('Produce error:', err);
    return res.status(500).json({ error: 'Errore nella produzione: ' + err.message });
  }
});

app.get("/api/produce/list", authenticate, async (req: any, res) => {
  const { data: queue, error } = await supabase.from('production_queue')
    .select('*')
    .eq('userId', req.user.id)
    .order('createdAt', { ascending: false })
    .limit(20);

  if (error) {
    console.error("Produce list error:", error);
    return res.status(500).json({ error: "Errore nel caricamento" });
  }

  const now = Date.now();
  const items = (queue || []).map(d => {
    const isReady = new Date(d.willCompleteAt).getTime() <= now && d.status !== "claimed";
    return {
      ...d,
      status: isReady ? "ready" : d.status,
    };
  });
  res.json(items);
});

app.post("/api/produce/claim", authenticate, async (req: any, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "ID richiesto" });

  const nowIso = new Date().toISOString();
  const { data: claimedRows, error: claimError } = await supabase
    .from('production_queue')
    .update({ status: 'claimed' })
    .eq('id', id)
    .eq('userId', req.user.id)
    .neq('status', 'claimed')
    .lte('willCompleteAt', nowIso)
    .select('*');

  if (claimError) return res.status(500).json({ error: "Errore durante il ritiro." });
  if (!claimedRows || claimedRows.length === 0) {
    const { data: existingItem } = await supabase
      .from('production_queue')
      .select('id, status, willCompleteAt')
      .eq('id', id)
      .eq('userId', req.user.id)
      .maybeSingle();

    if (!existingItem) return res.status(404).json({ error: "Item non trovato" });
    if (existingItem.status === 'claimed') return res.status(400).json({ error: "Già ritirato" });
    if (new Date(existingItem.willCompleteAt).getTime() > Date.now()) return res.status(400).json({ error: "Produzione in corso" });
    return res.status(409).json({ error: "Conflitto di stato produzione. Riprova." });
  }

  const d = claimedRows[0];

  const { data: inv } = await supabase.from('user_inventory').select('quantity').eq('userId', req.user.id).eq('itemId', d.weaponType).single();
  if (inv) {
    await supabase.from('user_inventory').update({ quantity: (inv.quantity || 0) + (d.qty || 1) }).eq('userId', req.user.id).eq('itemId', d.weaponType);
  } else {
    await supabase.from('user_inventory').insert({ userId: req.user.id, itemId: d.weaponType, quantity: d.qty || 1 });
  }

  res.json({ success: true });
});

// --- Nation Management API ---
app.get("/api/nations/:id", authenticate, async (req: any, res) => {
  const { data: nation } = await supabase
    .from('nations')
    .select('*, users!leaderUserId(username)')
    .eq('id', req.params.id)
    .single();

  if (!nation) return res.status(404).json({ error: "Nazione non trovata." });

  const { data: regions } = await supabase.from('regions').select('id, name, population, economyLevel').eq('nation_id', nation.id);
  res.json({ ...nation, leaderName: (nation as any).users?.username, regions: regions || [] });
});

app.post("/api/leader/nation/branding", authenticate, async (req: any, res) => {
  const { name, logo, nationId } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Nome nazione obbligatorio." });
  if (name.trim().length > 40) return res.status(400).json({ error: "Nome troppo lungo (max 40 caratteri)." });

  const { data: nation } = await supabase.from('nations').select('*').eq('id', nationId).single();
  if (!nation) return res.status(404).json({ error: "Nazione non trovata." });
  if (nation.leaderUserId !== req.user.id) return res.status(403).json({ error: "Solo il Leader può farlo." });

  const { error: updateError } = await supabase.from('nations').update({ name: name.trim(), logo: logo || '🏛️', updatedAt: Date.now() }).eq('id', nationId);
  if (updateError) return res.status(500).json({ error: "Errore nel salvataggio: " + updateError.message });
  res.json({ success: true });
});

// ==========================================
// POLITICAL PARTIES API (Phase 7)
// ==========================================

app.post("/api/parties/create", authenticate, async (req: any, res) => {
  const user = req.user;
  const { name, ideology, tag, description, logo } = req.body;
  const regionId = user.residenceId || "IT";

  if (!name || name.trim().length === 0) return res.status(400).json({ error: "Nome obbligatorio." });
  if (user.gold < 100) return res.status(400).json({ error: "Fondi in Gold insufficienti (costa 100 Gold)." });

  const { data: existingMember } = await supabase.from('party_members').select('partyId').eq('userId', user.id).maybeSingle();
  if (existingMember) return res.status(400).json({ error: "Sei già membro di un partito." });

  const partyId = generateSecureId(9);
  const now = Date.now();

  try {
    // 1. Create party
    await supabase.from('parties').insert({
      id: partyId,
      name: name.trim(),
      ideology: ideology || "",
      tag: tag || "",
      description: description || "",
      logo: logo || "",
      regionId,
      leaderUserId: user.id,
      createdAt: now
    });

    // 2. Add founder as leader
    await supabase.from('party_members').insert({
      userId: user.id,
      partyId,
      role: 'leader',
      joinedAt: now
    });

    // 3. Deduct gold atomically
    const { data: deductResult, error: deductError } = await supabase.rpc('safe_deduct_currency', {
      p_user_id: user.id,
      p_money_cost: 0,
      p_gold_cost: 100,
      p_energy_cost: 0,
    });
    if (deductError) throw deductError;
    const deductData = typeof deductResult === 'string' ? JSON.parse(deductResult) : deductResult;
    if (deductData?.error) return res.status(400).json({ error: deductData.error });

    // 4. Log creation
    await supabase.from('party_logs').insert({
      id: generateSecureId(9),
      partyId,
      action: 'created',
      details: `Partito creato da ${user.username} in ${regionId}`,
      timestamp: now
    });

    res.json({ success: true, partyId });
  } catch (err: any) {
    res.status(500).json({ error: "Errore nella creazione del partito: " + err.message });
  }
});

app.put("/api/parties/edit", authenticate, async (req: any, res) => {
  const user = req.user;
  const { partyId, name, ideology, tag, description, logo } = req.body;

  const { data: party } = await supabase.from('parties').select('leaderUserId').eq('id', partyId).single();
  if (!party) return res.status(404).json({ error: "Partito inesistente." });
  if (party.leaderUserId !== user.id) return res.status(403).json({ error: "Solo il leader può modificare le info del partito." });

  if (!name || name.trim().length === 0) return res.status(400).json({ error: "Nome obbligatorio." });

  await supabase.from('parties').update({
    name: name.trim(),
    ideology: ideology || "",
    tag: tag || "",
    description: description || "",
    logo: logo || ""
  }).eq('id', partyId);

  res.json({ success: true });
});

app.get("/api/parties", authenticate, async (req: any, res) => {
  const { data: parties, error } = await supabase
    .from('parties')
    .select('*')
    .order('createdAt', { ascending: false });

  if (error) {
    console.error("Error fetching parties:", error);
    return res.status(500).json({ error: "Errore nel caricamento dei partiti." });
  }

  // Batch fetch all leader usernames in a single query
  const leaderIds = [...new Set((parties || []).map(p => p.leaderUserId).filter(Boolean))];
  const leaderMap = new Map<string, string>();
  if (leaderIds.length > 0) {
    const { data: leaders } = await supabase.from('users').select('id, username').in('id', leaderIds);
    (leaders || []).forEach((l: any) => leaderMap.set(l.id, l.username));
  }

  // Batch fetch all member counts in a single query instead of one per party
  const partyIds = (parties || []).map((p: any) => p.id);
  const countMap = new Map<string, number>();
  if (partyIds.length > 0) {
    const { data: allMembers } = await supabase.from('party_members').select('partyId').in('partyId', partyIds);
    for (const m of (allMembers || [])) {
      countMap.set(m.partyId, (countMap.get(m.partyId) || 0) + 1);
    }
  }

  const partiesWithCounts = (parties || []).map((p: any) => ({
    ...p,
    leaderName: leaderMap.get(p.leaderUserId) || 'Sconosciuto',
    memberCount: countMap.get(p.id) || 0
  }));

  res.json(partiesWithCounts.sort((a, b) => b.memberCount - a.memberCount));
});

app.get("/api/parties/my", authenticate, async (req: any, res) => {
  const { data: membership } = await supabase.from('party_members').select('partyId').eq('userId', req.user.id).maybeSingle();
  if (!membership) return res.status(404).json({ error: "Non sei in nessun partito." });

  // Fetch full party data (same logic as /api/parties/:id)
  const { data: party, error: partyError } = await supabase
    .from('parties')
    .select('*')
    .eq('id', membership.partyId)
    .single();

  if (partyError || !party) return res.status(404).json({ error: "Partito non trovato" });

  let leaderName = 'Sconosciuto';
  if (party.leaderUserId) {
    const { data: leader } = await supabase.from('users').select('username').eq('id', party.leaderUserId).single();
    if (leader) leaderName = leader.username;
  }

  const { data: members } = await supabase
    .from('party_members')
    .select('*')
    .eq('partyId', membership.partyId)
    .order('joinedAt', { ascending: true });

  // Batch fetch member usernames
  const memberUserIds = [...new Set((members || []).map((m: any) => m.userId).filter(Boolean))];
  const userMap = new Map<string, any>();
  if (memberUserIds.length > 0) {
    const { data: usersData } = await supabase.from('users').select('id, username, level, lastLogin').in('id', memberUserIds);
    (usersData || []).forEach((u: any) => userMap.set(u.id, u));
  }

  const mappedMembers = (members || []).map((m: any) => {
    const userData = userMap.get(m.userId);
    return {
      ...m,
      username: userData?.username || 'Sconosciuto',
      level: userData?.level || 0,
      lastLogin: userData?.lastLogin || 0
    };
  });

  const now = Date.now();
  const activeMembersCount = mappedMembers.filter((m: any) => {
    const lastLoginTs = typeof m.lastLogin === 'string' ? new Date(m.lastLogin).getTime() : (m.lastLogin || 0);
    return now - lastLoginTs <= 48 * 60 * 60 * 1000;
  }).length;

  res.json({
    party: { ...party, leaderName },
    members: mappedMembers,
    activeMembersCount
  });
});

app.get("/api/parties/:id", authenticate, async (req: any, res) => {
  const { id } = req.params;
  const { data: party, error: partyError } = await supabase
    .from('parties')
    .select('*')
    .eq('id', id)
    .single();

  if (partyError || !party) return res.status(404).json({ error: "Partito non trovato" });

  let leaderName = 'Sconosciuto';
  if (party.leaderUserId) {
    const { data: leader } = await supabase.from('users').select('username').eq('id', party.leaderUserId).single();
    if (leader) leaderName = leader.username;
  }

  const { data: members } = await supabase
    .from('party_members')
    .select('*, users!userId(username, level, lastLogin)')
    .eq('partyId', id)
    .order('joinedAt', { ascending: true });

  const mappedMembers = (members || []).map((m: any) => ({
    ...m,
    username: m.users?.username,
    level: m.users?.level,
    lastLogin: m.users?.lastLogin
  }));

  const now = Date.now();
  const activeMembersCount = mappedMembers.filter((m: any) => {
    const lastLoginTs = typeof m.lastLogin === 'string' ? new Date(m.lastLogin).getTime() : (m.lastLogin || 0);
    return now - lastLoginTs <= 48 * 60 * 60 * 1000;
  }).length;

  // Primaries vote counts for current cycle
  const currentCycleStart = getPrimariesCycleStart();

  const { data: primariesVotes } = await supabase
    .from('party_primaries')
    .select('candidateId')
    .eq('partyId', id)
    .gte('createdAt', currentCycleStart);

  const voteCounts: Record<string, number> = {};
  (primariesVotes || []).forEach((v: any) => {
    voteCounts[v.candidateId] = (voteCounts[v.candidateId] || 0) + 1;
  });

  // Check if current user has already voted in this cycle
  const { data: myVote } = await supabase
    .from('party_primaries')
    .select('id')
    .eq('voterId', req.user.id)
    .eq('partyId', id)
    .gte('createdAt', currentCycleStart)
    .maybeSingle();

  res.json({
    party: { ...party, leaderName },
    members: mappedMembers,
    activeMembersCount,
    primariesVoteCounts: voteCounts,
    hasVotedPrimaries: !!myVote
  });
});

app.post("/api/parties/roles", authenticate, async (req: any, res) => {
  const user = req.user;
  const { partyId, targetUserId, newRole } = req.body;

  if (!['secretary', 'member'].includes(newRole)) return res.status(400).json({ error: "Ruolo non valido." });

  const { data: party } = await supabase.from('parties').select('leaderUserId').eq('id', partyId).single();
  if (!party || party.leaderUserId !== user.id) return res.status(403).json({ error: "Solo il leader può assegnare i ruoli." });

  if (targetUserId === user.id) return res.status(400).json({ error: "Non puoi modificare il tuo stesso ruolo." });

  const { data: targetMember } = await supabase.from('party_members').select('role').eq('userId', targetUserId).eq('partyId', partyId).single();
  if (!targetMember) return res.status(404).json({ error: "Il giocatore non è in questo partito." });

  await supabase.from('party_members').update({ role: newRole }).eq('userId', targetUserId).eq('partyId', partyId);
  res.json({ success: true, newRole });
});

app.post("/api/parties/kick", authenticate, async (req: any, res) => {
  const user = req.user;
  const { partyId, targetUserId } = req.body;

  const { data: myMembership } = await supabase.from('party_members').select('role').eq('userId', user.id).eq('partyId', partyId).single();
  if (!myMembership || (myMembership.role !== 'leader' && myMembership.role !== 'secretary')) {
    return res.status(403).json({ error: "Non hai i permessi per espellere." });
  }

  const { data: targetMember } = await supabase.from('party_members').select('role').eq('userId', targetUserId).eq('partyId', partyId).single();
  if (!targetMember) return res.status(404).json({ error: "Il giocatore non è in questo partito." });

  if (targetMember.role === 'leader') return res.status(403).json({ error: "Non puoi espellere il leader." });
  if (myMembership.role === 'secretary' && targetMember.role === 'secretary') return res.status(403).json({ error: "Un segretario non può espellere un altro segretario." });

  await supabase.from('party_members').delete().eq('userId', targetUserId).eq('partyId', partyId);

  const logId = generateSecureId(9);
  await supabase.from('party_logs').insert({
    id: logId,
    partyId,
    action: 'kick',
    details: `Utente rimosso dal partito. Esecutore: ${user.username}`,
    timestamp: Date.now()
  });

  res.json({ success: true });
});

const getItemType = (itemId: string): string => {
  const resources = ['oil', 'minerals', 'uranium', 'diamonds'];
  const weapons = ['infantry', 'tank', 'airstrike'];
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

app.post("/api/parties/set-wage", authenticate, async (req: any, res) => {
  const user = req.user;
  const { partyId, targetUserId, salaryCash, salaryGold } = req.body;

  const { data: party } = await supabase.from('parties').select('leaderUserId').eq('id', partyId).single();
  if (!party || party.leaderUserId !== user.id) return res.status(403).json({ error: "Solo il leader può impostare i salari." });

  const { data: targetMember } = await supabase.from('party_members').select('role').eq('userId', targetUserId).eq('partyId', partyId).single();
  if (!targetMember) return res.status(404).json({ error: "Il giocatore non è in questo partito." });

  const cash = Math.max(0, parseInt(salaryCash) || 0);
  const gold = Math.max(0, parseInt(salaryGold) || 0);

  const caps = await calculatePartyCaps(partyId);
  if (gold > caps.maxGoldPerUser) {
    return res.status(400).json({ error: `Il limite di Gold per utente è ${caps.maxGoldPerUser} (basato su ${caps.activeCount} membri attivi).` });
  }

  await supabase.from('party_members').update({ salaryCash: cash, salaryGold: gold }).eq('userId', targetUserId).eq('partyId', partyId);

  res.json({ success: true, salaryCash: cash, salaryGold: gold });
});

app.post("/api/parties/pay-wages", authenticate, async (req: any, res) => {
  const user = req.user;
  const { partyId } = req.body;

  const { data: party } = await supabase.from('parties').select('leaderUserId').eq('id', partyId).single();
  if (!party || party.leaderUserId !== user.id) return res.status(403).json({ error: "Solo il leader può pagare i salari." });

  const { data: lastPayment } = await supabase.from('party_logs').select('timestamp').eq('partyId', partyId).eq('action', 'pay_wages').order('timestamp', { ascending: false }).limit(1).maybeSingle();
  if (lastPayment && Date.now() - new Date(lastPayment.timestamp).getTime() < 24 * 60 * 60 * 1000) {
    const hoursLeft = Math.ceil((24 * 60 * 60 * 1000 - (Date.now() - new Date(lastPayment.timestamp).getTime())) / (60 * 60 * 1000));
    return res.status(400).json({ error: `I salari sono già stati pagati. Riprova tra ${hoursLeft} ore.` });
  }

  const caps = await calculatePartyCaps(partyId);
  const activeIds = new Set(caps.activeMembers.map((m: any) => m.userId));

  const { data: toPay } = await supabase.from('party_members').select('userId, salaryCash, salaryGold').eq('partyId', partyId).or('salaryCash.gt.0,salaryGold.gt.0');
  const validToPay = (toPay || []).filter(m => activeIds.has(m.userId));

  let totalCash = 0;
  let totalGold = 0;
  validToPay.forEach(m => {
    totalCash += m.salaryCash || 0;
    totalGold += m.salaryGold || 0;
  });

  if (totalGold > caps.maxGoldTotal) return res.status(400).json({ error: `Il totale di Gold (${totalGold}) supera il limite massimo distribuibile di ${caps.maxGoldTotal}.` });
  if (user.money < totalCash || user.gold < totalGold) return res.status(400).json({ error: `Fondi insufficienti sul tuo conto personale.` });

  if (validToPay.length === 0) return res.status(400).json({ error: "Nessun membro attivo riceve stipendi." });

  // Update Leader
  await supabase.from('users').update({ money: user.money - totalCash, gold: user.gold - totalGold }).eq('id', user.id);

  // Update members using SQL arithmetic (gold = gold + X) to avoid read-then-write race conditions
  const updates = validToPay.map(async (m) => {
    const cashAdd = m.salaryCash || 0;
    const goldAdd = m.salaryGold || 0;
    // Use raw RPC or direct SQL update with relative increments
    // Supabase JS doesn't support increment natively, so we refetch and update
    // but we use maybeSingle to handle missing users gracefully
    const { data: memberUser } = await supabase.from('users').select('money, gold').eq('id', m.userId).maybeSingle();
    if (memberUser) {
      return supabase.from('users').update({
        money: (memberUser.money || 0) + cashAdd,
        gold: (memberUser.gold || 0) + goldAdd
      }).eq('id', m.userId);
    }
  });
  await Promise.all(updates);

  await supabase.from('party_logs').insert({
    id: generateSecureId(9),
    partyId,
    action: 'pay_wages',
    details: `Pagati totali $${totalCash} e ${totalGold} Gold a ${validToPay.length} membri.`,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, paidMembers: validToPay.length, totalCash, totalGold });
});

app.post("/api/parties/contribute", authenticate, async (req: any, res) => {
  const user = req.user;

  try {
    const result = await partyAssetsService.transferPartyAsset({
      senderUser: { id: user.id, username: user.username },
      targetUserId: req.body?.targetUserId,
      itemType: req.body?.itemType,
      amount: req.body?.amount,
      logIdFactory: () => generateSecureId(9),
      nowIsoFactory: () => new Date().toISOString(),
    });

    const http = mapServiceResultToHttp(result);
    return res.status(http.statusCode).json(http.body);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/parties/invite", authenticate, async (req: any, res) => {
  const user = req.user;
  const { targetUserId } = req.body;

  const { data: myMembership } = await supabase.from('party_members').select('partyId, role').eq('userId', user.id).single();
  if (!myMembership || (myMembership.role !== 'leader' && myMembership.role !== 'secretary')) {
    return res.status(403).json({ error: "Solo Leader e Segretari possono invitare." });
  }

  const { data: targetMembership } = await supabase.from('party_members').select('partyId').eq('userId', targetUserId).single();
  if (targetMembership) return res.status(400).json({ error: "L'utente fa già parte di un partito." });

  const { data: existingInvite } = await supabase.from('party_invites').select('id').eq('partyId', myMembership.partyId).eq('userId', targetUserId).eq('status', 'pending').single();
  if (existingInvite) return res.status(400).json({ error: "L'utente ha già un invito pendente." });

  await supabase.from('party_invites').insert({
    id: generateSecureId(9),
    partyId: myMembership.partyId,
    userId: targetUserId,
    invitedBy: user.id,
    status: 'pending',
    createdAt: new Date().toISOString()
  });

  res.json({ success: true });
});

app.get("/api/parties/my-invites", authenticate, async (req: any, res) => {
  const { data: invites } = await supabase
    .from('party_invites')
    .select('*, parties(name), users!invitedBy(username)')
    .eq('userId', req.user.id)
    .eq('status', 'pending');

  const mapped = (invites || []).map((i: any) => ({
    ...i,
    partyName: i.parties?.name,
    inviterName: i.users?.username
  }));

  res.json(mapped);
});

app.post("/api/parties/join", authenticate, async (req: any, res) => {
  const user = req.user;
  const { inviteId } = req.body;

  const { data: invite } = await supabase.from('party_invites').select('partyId, status').eq('id', inviteId).eq('userId', user.id).single();
  if (!invite) return res.status(404).json({ error: "Invito non trovato." });
  if (invite.status !== 'pending') return res.status(400).json({ error: "L'invito non è più valido." });

  const { data: existingMember } = await supabase.from('party_members').select('partyId').eq('userId', user.id).single();
  if (existingMember) return res.status(400).json({ error: "Fai già parte di un partito." });

  await supabase.from('party_invites').update({ status: 'accepted' }).eq('id', inviteId);
  await supabase.from('party_members').insert({ userId: user.id, partyId: invite.partyId, role: 'member', joinedAt: new Date().toISOString() });
  await supabase.from('party_invites').update({ status: 'rejected' }).eq('userId', user.id).eq('status', 'pending');

  res.json({ success: true, partyId: invite.partyId });
});

app.post("/api/parties/primaries-vote", authenticate, async (req: any, res) => {
  const user = req.user;
  const { candidateId } = req.body;

  const { data: myMembership } = await supabase.from('party_members').select('partyId').eq('userId', user.id).single();
  if (!myMembership) return res.status(403).json({ error: "Non fai parte di alcun partito." });

  const { data: targetMembership } = await supabase.from('party_members').select('partyId').eq('userId', candidateId).single();
  if (!targetMembership || targetMembership.partyId !== myMembership.partyId) return res.status(400).json({ error: "Candidato non valido." });

  const currentCycleStart = getPrimariesCycleStart();

  const { data: existingVote } = await supabase.from('party_primaries').select('id').eq('voterId', user.id).gte('createdAt', currentCycleStart).single();
  if (existingVote) return res.status(400).json({ error: "Hai già votato in questo ciclo." });

  await supabase.from('party_primaries').insert({
    id: generateSecureId(9),
    partyId: myMembership.partyId,
    candidateId,
    voterId: user.id,
    createdAt: new Date().toISOString()
  });

  res.json({ success: true });
});
// ==========================================
// PARLIAMENT & ELECTIONS API
// ==========================================

app.get("/api/elections", authenticate, async (req: any, res) => {
  const user = req.user;
  const { data: election } = await supabase.from('elections').select('*').eq('regionId', user.residenceId).eq('status', 'active').order('createdAt', { ascending: false }).limit(1).single();

  const { data: parties } = await supabase.from('parties').select('id, name, tag, logo, ideology').eq('regionId', user.residenceId);

  if (!election) return res.json({ election: null, parties: parties || [], myVote: null });

  const { data: votes } = await supabase.from('election_votes').select('partyId').eq('electionId', election.id);

  const voteCounts: Record<string, number> = {};
  (votes || []).forEach(v => voteCounts[v.partyId] = (voteCounts[v.partyId] || 0) + 1);

  const partiesWithVotes = (parties || []).map((p: any) => ({
    ...p,
    votes: voteCounts[p.id] || 0
  }));

  const { data: myVote } = await supabase.from('election_votes').select('partyId').eq('electionId', election.id).eq('voterId', user.id).single();

  res.json({ election, parties: partiesWithVotes, myVote: myVote?.partyId });
});

app.post("/api/elections/vote", authenticate, async (req: any, res) => {
  const user = req.user;
  const { electionId, partyId } = req.body;

  const { data: election } = await supabase.from('elections').select('regionId, status').eq('id', electionId).single();
  if (!election || election.status !== 'active') return res.status(400).json({ error: "Elezione non attiva." });
  if (election.regionId !== user.residenceId) return res.status(403).json({ error: "Vota nella tua residenza." });

  const { data: party } = await supabase.from('parties').select('id').eq('id', partyId).eq('regionId', user.residenceId).single();
  if (!party) return res.status(400).json({ error: "Partito non valido." });

  const { data: existingVote } = await supabase.from('election_votes').select('id').eq('electionId', electionId).eq('voterId', user.id).single();
  if (existingVote) return res.status(400).json({ error: "Hai già votato." });

  await supabase.from('election_votes').insert({
    id: generateSecureId(9),
    electionId,
    voterId: user.id,
    partyId,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true });
});

app.get("/api/parliament", authenticate, async (req: any, res) => {
  const user = req.user;
  const { data: members } = await supabase
    .from('parliament_members')
    .select('userId, partyId, electedAt')
    .eq('regionId', user.residenceId);

  if (!members || members.length === 0) return res.json([]);

  const userIds = [...new Set(members.map((m: any) => m.userId))];
  const partyIds = [...new Set(members.map((m: any) => m.partyId).filter(Boolean))];

  const { data: users } = await supabase.from('users').select('id, username, level').in('id', userIds);
  const parties = partyIds.length > 0
    ? (await supabase.from('parties').select('id, name, tag').in('id', partyIds)).data
    : [];

  const userMap: Record<string, any> = {};
  (users || []).forEach((u: any) => { userMap[u.id] = u; });
  const partyMap: Record<string, any> = {};
  (parties || []).forEach((p: any) => { partyMap[p.id] = p; });

  const mapped = members.map((m: any) => ({
    userId: m.userId,
    username: userMap[m.userId]?.username,
    level: userMap[m.userId]?.level,
    partyName: partyMap[m.partyId]?.name,
    partyTag: partyMap[m.partyId]?.tag,
    electedAt: m.electedAt
  }));

  res.json(mapped);
});


// ==========================================
// STATE LAWS REGISTRY
// ==========================================

// ==========================================
// BLOCS API
// ==========================================

app.get("/api/blocs", authenticate, async (req: any, res) => {
  const { data: blocs } = await supabase.from('blocs').select('*, users!ownerUserId(username)');

  // Batch-load all active memberships with region owner info in a single query
  const blocIds = (blocs || []).map((b: any) => b.id);
  const memberCountMap = new Map<string, number>();
  const userMemberSet = new Set<string>();

  if (blocIds.length > 0) {
    const { data: allMemberships } = await supabase
      .from('bloc_memberships')
      .select('blocId, stateId, regions!stateId(ownerUserId)')
      .in('blocId', blocIds)
      .eq('status', 'active');

    for (const m of (allMemberships || [])) {
      memberCountMap.set(m.blocId, (memberCountMap.get(m.blocId) || 0) + 1);
      if ((m as any).regions?.ownerUserId === req.user.id) {
        userMemberSet.add(m.blocId);
      }
    }
  }

  const mapped = (blocs || []).map((b: any) => ({
    ...b,
    ownerName: b.users?.username,
    memberCount: memberCountMap.get(b.id) || 0,
    isMyBloc: userMemberSet.has(b.id) ? 1 : 0
  }));

  const filtered = mapped.filter(b => b.memberCount >= 2 || b.isMyBloc > 0);
  res.json(filtered);
});

app.get("/api/blocs-map", authenticate, async (req, res) => {
  const { data } = await supabase.from('bloc_memberships').select('stateId, blocId, blocs(name, logo)').eq('status', 'active');
  const mapped = (data || []).map((m: any) => ({
    stateId: m.stateId,
    blocId: m.blocId,
    blocName: m.blocs?.name,
    logo: m.blocs?.logo
  }));
  res.json(mapped);
});

app.get("/api/blocs/:id", authenticate, async (req: any, res) => {
  const user = req.user;
  const blocId = req.params.id;

  const { data: bloc } = await supabase.from('blocs').select('*, users!ownerUserId(username), regions!ownerStateId(name)').eq('id', blocId).single();
  if (!bloc) return res.status(404).json({ error: "Blocco non trovato." });

  const { data: members } = await supabase.from('bloc_memberships').select('*, regions!stateId(name, ownerUserId, nation_id, users!ownerUserId(username), nations!nation_id(name, logo))').eq('blocId', blocId).eq('status', 'active');
  const mMapped = (members || []).map((m: any) => ({
    ...m,
    stateName: m.regions?.name,
    nationName: m.regions?.nations?.name || null,
    nationLogo: m.regions?.nations?.logo || null,
    leaderName: m.regions?.users?.username,
    ownerUserId: m.regions?.ownerUserId
  }));

  const { data: reg } = await supabase.from('bloc_regulations').select('*').eq('blocId', blocId).single();
  const regulations = reg || { openBorders: 0, defaultMilitaryAgreement: 0 };

  const isMemberLeader = mMapped.some(m => m.ownerUserId === user.id);

  let applications = [];
  let proposals = [];

  if (isMemberLeader) {
    const [{ data: apps }, { data: props }] = await Promise.all([
      supabase.from('bloc_applications').select('*, regions!stateId(name, ownerUserId, users!ownerUserId(username))').eq('blocId', blocId).eq('status', 'pending'),
      supabase.from('bloc_regulation_proposals').select('*').eq('blocId', blocId).eq('status', 'pending')
    ]);

    // Batch-load all votes for applications and proposals in a single query
    const allTargetIds = [...(apps || []).map((a: any) => a.id), ...(props || []).map((p: any) => p.id)];
    let voteMap = new Map<string, any[]>();
    if (allTargetIds.length > 0) {
      const { data: allVotes } = await supabase.from('bloc_votes').select('*').in('targetId', allTargetIds);
      for (const v of (allVotes || [])) {
        if (!voteMap.has(v.targetId)) voteMap.set(v.targetId, []);
        voteMap.get(v.targetId)!.push(v);
      }
    }

    for (const a of (apps || [])) {
      applications.push({ ...a, stateName: a.regions?.name, leaderName: a.regions?.users?.username, votes: voteMap.get(a.id) || [] });
    }
    for (const p of (props || [])) {
      proposals.push({ ...p, votes: voteMap.get(p.id) || [] });
    }
  }

  res.json({ bloc: { ...bloc, ownerName: (bloc as any).users?.username, ownerStateName: (bloc as any).regions?.name }, members: mMapped, regulations, applications, proposals, isMemberLeader });
});

app.post("/api/blocs/:id/update", authenticate, async (req: any, res) => {
  const user = req.user;
  const blocId = req.params.id;
  const { name, description, logo } = req.body;

  if (!name || name.trim().length === 0) return res.status(400).json({ error: "Nome obbligatorio." });
  const { data: bloc } = await supabase.from('blocs').select('ownerUserId').eq('id', blocId).single();
  if (!bloc) return res.status(404).json({ error: "Blocco non trovato." });
  if (bloc.ownerUserId !== user.id) return res.status(403).json({ error: "Solo il fondatore può farlo." });

  await supabase.from('blocs').update({ name: name.trim(), description: description || '', logo: logo || '' }).eq('id', blocId);
  res.json({ success: true });
});

app.post("/api/blocs/create", authenticate, async (req: any, res) => {
  const user = req.user;
  const { name, stateId, description, logo } = req.body;

  if (!name || name.trim().length === 0) return res.status(400).json({ error: "Nome obbligatorio." });
  if (!stateId) return res.status(400).json({ error: "Devi selezionare uno Stato da te guidato." });

  const { data: region } = await supabase.from('regions').select('ownerUserId').eq('id', stateId).single();
  if (!region || region.ownerUserId !== user.id) return res.status(403).json({ error: "Solo il Leader dello Stato può creare un blocco a suo nome." });

  const { data: existingMembership } = await supabase.from('bloc_memberships').select('blocId').eq('stateId', stateId).eq('status', 'active').maybeSingle();
  if (existingMembership) return res.status(400).json({ error: "Questo Stato fa già parte di un blocco." });

  const { data: existingBloc } = await supabase.from('blocs').select('id').eq('name', name.trim()).maybeSingle();
  if (existingBloc) return res.status(409).json({ error: "Esiste già un blocco con questo nome." });

  const id = generateSecureId(9);
  const now = new Date().toISOString();

  await supabase.from('blocs').insert({ id, name: name.trim(), logo: logo || '', description: description || '', ownerStateId: stateId, ownerUserId: user.id, createdAt: now });
  await supabase.from('bloc_memberships').insert({ blocId: id, stateId, status: 'active', joinedAt: now });
  await supabase.from('bloc_regulations').insert({ blocId: id, openBorders: 0, defaultMilitaryAgreement: 0 });

  res.json({ success: true, blocId: id });
});

app.post("/api/blocs/:id/apply", authenticate, async (req: any, res) => {
  const user = req.user;
  const blocId = req.params.id;
  const { stateId } = req.body;

  if (!stateId) return res.status(400).json({ error: "Stato non specificato." });

  const { data: region } = await supabase.from('regions').select('ownerUserId').eq('id', stateId).single();
  if (!region || region.ownerUserId !== user.id) return res.status(403).json({ error: "Solo il leader può candidarsi." });

  const { data: existingMember } = await supabase.from('bloc_memberships').select('blocId').eq('stateId', stateId).eq('status', 'active').maybeSingle();
  if (existingMember) return res.status(400).json({ error: "Questo Stato è già in un blocco." });

  const { data: existingApp } = await supabase.from('bloc_applications').select('id').eq('blocId', blocId).eq('stateId', stateId).eq('status', 'pending').maybeSingle();
  if (existingApp) return res.status(400).json({ error: "Candidatura già pendente." });

  await supabase.from('bloc_applications').insert({
    id: generateSecureId(9),
    blocId,
    stateId,
    createdAt: new Date().toISOString(),
    status: 'pending'
  });

  res.json({ success: true });
});

app.post("/api/blocs/applications/:id/vote", authenticate, async (req: any, res) => {
  const user = req.user;
  const appId = req.params.id;
  const { voterStateId, choice } = req.body;
  const voteChoice = choice ? 1 : 0;

  const { data: application } = await supabase.from('bloc_applications').select('*').eq('id', appId).single();
  if (!application || application.status !== 'pending') return res.status(400).json({ error: "Candidatura non valida." });

  const blocId = application.blocId;
  const { data: membership } = await supabase.from('bloc_memberships').select('status').eq('blocId', blocId).eq('stateId', voterStateId).eq('status', 'active').single();
  if (!membership) return res.status(403).json({ error: "Stato non autorizzato a votare." });

  const { data: voterRegion } = await supabase.from('regions').select('ownerUserId').eq('id', voterStateId).single();
  if (!voterRegion || voterRegion.ownerUserId !== user.id) return res.status(403).json({ error: "Solo il leader può votare." });

  const { data: existingVote } = await supabase.from('bloc_votes').select('*').eq('targetId', appId).eq('voterStateId', voterStateId).maybeSingle();
  if (existingVote) return res.status(400).json({ error: "Voto già inviato." });

  await supabase.from('bloc_votes').insert({ targetId: appId, voterStateId, choice: voteChoice, createdAt: new Date().toISOString() });

  const { data: activeMembers } = await supabase.from('bloc_memberships').select('stateId').eq('blocId', blocId).eq('status', 'active');
  const activeCount = activeMembers?.length || 0;

  const { data: allVotes } = await supabase.from('bloc_votes').select('choice').eq('targetId', appId);
  const yesVotes = allVotes?.filter(v => v.choice === 1).length || 0;
  const noVotes = allVotes?.filter(v => v.choice === 0).length || 0;

  const requiredToPass = Math.floor(activeCount / 2) + 1;
  const requiredToReject = activeCount - requiredToPass + 1;

  if (yesVotes >= requiredToPass) {
    await supabase.from('bloc_applications').update({ status: 'approved' }).eq('id', appId);
    await supabase.from('bloc_memberships').insert({ blocId, stateId: application.stateId, status: 'active', joinedAt: new Date().toISOString() });
  } else if (noVotes >= requiredToReject || (yesVotes + noVotes) >= activeCount) {
    await supabase.from('bloc_applications').update({ status: 'rejected' }).eq('id', appId);
  }

  res.json({ success: true });
});

app.post("/api/blocs/:id/regulations/propose", authenticate, async (req: any, res) => {
  const user = req.user;
  const blocId = req.params.id;
  const { proposerStateId, type, proposedValue } = req.body;
  const value = proposedValue ? 1 : 0;

  if (!['openBorders', 'migrationOpen', 'defaultMilitaryAgreement'].includes(type)) return res.status(400).json({ error: "Tipo non valido." });

  const { data: membership } = await supabase.from('bloc_memberships').select('status').eq('blocId', blocId).eq('stateId', proposerStateId).eq('status', 'active').single();
  if (!membership) return res.status(403).json({ error: "Non sei un membro attivo." });

  const { data: region } = await supabase.from('regions').select('ownerUserId').eq('id', proposerStateId).single();
  if (!region || region.ownerUserId !== user.id) return res.status(403).json({ error: "Solo il leader può proporre." });

  const { data: existingProp } = await supabase.from('bloc_regulation_proposals').select('id').eq('blocId', blocId).eq('type', type).eq('status', 'pending').maybeSingle();
  if (existingProp) return res.status(400).json({ error: "Proposta già pendente." });

  const id = generateSecureId(9);
  const now = new Date().toISOString();
  await supabase.from('bloc_regulation_proposals').insert({ id, blocId, type, proposedValue: value, createdAt: now, status: 'pending' });
  await supabase.from('bloc_votes').insert({ targetId: id, voterStateId: proposerStateId, choice: 1, createdAt: now });

  res.json({ success: true });
});

app.post("/api/blocs/regulations/proposals/:id/vote", authenticate, async (req: any, res) => {
  const user = req.user;
  const propId = req.params.id;
  const { voterStateId, choice } = req.body;
  const voteChoice = choice ? 1 : 0;

  const { data: proposal } = await supabase.from('bloc_regulation_proposals').select('*').eq('id', propId).single();
  if (!proposal || proposal.status !== 'pending') return res.status(400).json({ error: "Proposta non valida." });

  const blocId = proposal.blocId;
  const { data: membership } = await supabase.from('bloc_memberships').select('status').eq('blocId', blocId).eq('stateId', voterStateId).eq('status', 'active').single();
  if (!membership) return res.status(403).json({ error: "Non sei membro del blocco." });

  const { data: voterRegion } = await supabase.from('regions').select('ownerUserId').eq('id', voterStateId).single();
  if (!voterRegion || voterRegion.ownerUserId !== user.id) return res.status(403).json({ error: "Solo il leader può votare." });

  const { data: existingVote } = await supabase.from('bloc_votes').select('*').eq('targetId', propId).eq('voterStateId', voterStateId).maybeSingle();
  if (existingVote) return res.status(400).json({ error: "Voto già inviato." });

  await supabase.from('bloc_votes').insert({ targetId: propId, voterStateId, choice: voteChoice, createdAt: new Date().toISOString() });

  const { data: activeMembers } = await supabase.from('bloc_memberships').select('stateId').eq('blocId', blocId).eq('status', 'active');
  const activeCount = activeMembers?.length || 0;

  const { data: allVotes } = await supabase.from('bloc_votes').select('choice').eq('targetId', propId);
  const yesVotes = allVotes?.filter(v => v.choice === 1).length || 0;
  const noVotes = allVotes?.filter(v => v.choice === 0).length || 0;

  const requiredToPass = Math.floor(activeCount / 2) + 1;
  const requiredToReject = activeCount - requiredToPass + 1;

  if (yesVotes >= requiredToPass) {
    await supabase.from('bloc_regulation_proposals').update({ status: 'approved' }).eq('id', propId);
    const updateObj: any = {};
    updateObj[proposal.type] = proposal.proposedValue;
    await supabase.from('bloc_regulations').update(updateObj).eq('blocId', blocId);
  } else if (noVotes >= requiredToReject || (yesVotes + noVotes) >= activeCount) {
    await supabase.from('bloc_regulation_proposals').update({ status: 'rejected' }).eq('id', propId);
  }

  res.json({ success: true });
});

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
 * Convert a raw building-score into a discrete level 0–10 using the
 * configured threshold array.  Levels above 10 are capped at 10.
 */
function calculateIndexLevel(rawScore: number, thresholds: number[]): number {
  let level = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (rawScore >= thresholds[i]) level = i + 1;
    else break;
  }
  return Math.min(level, thresholds.length);
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
  build_hospital: {
    category: "Costruzioni Statali",
    icon: "Heart",
    title: "Costruzione Ospedale",
    description: "Aumenta la Salute (Health) della nazione di 1 punto. Costo: $25.000",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region, params, proposer) => {
      if (region.health >= 11) return "Livello Salute già al massimo (11).";
      const { data: budget } = await supabase.from('budgets').select('moneyEUR').eq('ownerType', 'REGION').eq('ownerId', region.id).single();
      if (!budget || budget.moneyEUR < 25000) return "Fondi statali in bilancio insufficienti ($25.000 richiesti).";
      return null;
    },
    execute: async (region) => {
      const { data: currentRegion } = await supabase.from('regions').select('health').eq('id', region.id).single();
      if (currentRegion && currentRegion.health < 11) {
        await supabase.rpc('add_budget_transaction', {
          p_owner_type: 'REGION',
          p_owner_id: region.id,
          p_type: 'EXPENSE',
          p_subtype: 'BUILDING',
          p_money_delta: -25000,
          p_metadata: { building: 'hospital' }
        });
        await supabase.from('regions').update({ health: currentRegion.health + 1 }).eq('id', region.id);
      }
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
  build_military_base: {
    category: "Costruzioni Statali",
    icon: "ShieldAlert",
    title: "Base Militare",
    description: "Aumenta la potenza Militare della nazione di 1 punto. Costo: $50.000",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region, params, proposer) => {
      if (region.military >= 11) return "Livello Militare già al massimo (11).";
      const { data: budget } = await supabase.from('budgets').select('moneyEUR').eq('ownerType', 'REGION').eq('ownerId', region.id).single();
      if (!budget || budget.moneyEUR < 50000) return "Fondi statali in bilancio insufficienti ($50.000 richiesti).";
      return null;
    },
    execute: async (region) => {
      const { data: currentRegion } = await supabase.from('regions').select('military').eq('id', region.id).single();
      if (currentRegion && currentRegion.military < 11) {
        await supabase.rpc('add_budget_transaction', {
          p_owner_type: 'REGION',
          p_owner_id: region.id,
          p_type: 'EXPENSE',
          p_subtype: 'BUILDING',
          p_money_delta: -50000,
          p_metadata: { building: 'military_base' }
        });
        await supabase.from('regions').update({ military: currentRegion.military + 1 }).eq('id', region.id);
      }
    }
  },
  build_school: {
    category: "Costruzioni Statali",
    icon: "GraduationCap",
    title: "Costruzione Scuola",
    description: "Aumenta l'Istruzione (Education) della nazione di 1 punto. Costo: $20.000",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region, params, proposer) => {
      if (region.education >= 11) return "Livello Istruzione già al massimo (11).";
      const { data: budget } = await supabase.from('budgets').select('moneyEUR').eq('ownerType', 'REGION').eq('ownerId', region.id).single();
      if (!budget || budget.moneyEUR < 20000) return "Fondi statali in bilancio insufficienti ($20.000 richiesti).";
      return null;
    },
    execute: async (region) => {
      const { data: currentRegion } = await supabase.from('regions').select('education').eq('id', region.id).single();
      if (currentRegion && currentRegion.education < 11) {
        await supabase.rpc('add_budget_transaction', {
          p_owner_type: 'REGION',
          p_owner_id: region.id,
          p_type: 'EXPENSE',
          p_subtype: 'BUILDING',
          p_money_delta: -20000,
          p_metadata: { building: 'school' }
        });
        await supabase.from('regions').update({ education: currentRegion.education + 1 }).eq('id', region.id);
      }
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

app.get("/api/parliament/laws", authenticate, async (req: any, res) => {
  const regionId = req.query.regionId || req.user.residenceId;
  if (!regionId) return res.status(400).json({ error: "Region ID required" });

  try {
    const { data: laws, error } = await supabase
      .from('laws')
      .select('*, proposerName:users!proposerId(username)')
      .eq('regionId', regionId)
      .order('createdAt', { ascending: false });

    if (error) throw error;

    const lawsWithVotes = await Promise.all((laws || []).map(async (l: any) => {
      const { data: votes } = await supabase
        .from('law_votes')
        .select('vote, voterId')
        .eq('lawId', l.id);

      const proCount = (votes || []).filter(v => v.vote === 'yes' || v.vote === 'pro').length;
      const contraCount = (votes || []).filter(v => v.vote === 'no' || v.vote === 'contra').length;
      const myVote = (votes || []).find(v => v.voterId === req.user.id)?.vote || null;

      return {
        ...l,
        proposerName: l.proposerName?.username || 'Sconosciuto',
        yesVotes: proCount,
        noVotes: contraCount,
        myVote
      };
    }));

    const registryForFrontend = Object.entries(LawRegistry).reduce((acc: any, [key, law]: any) => {
      acc[key] = {
        category: law.category,
        icon: law.icon,
        title: law.title,
        description: law.description,
        threshold: law.threshold,
        delayDays: law.delayDays
      };
      return acc;
    }, {});

    res.json({ laws: lawsWithVotes, registry: registryForFrontend });
  } catch (err: any) {
    console.error("Error fetching laws:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/parliament/laws/propose", authenticate, async (req: any, res) => {
  const user = req.user;
  const { type, params } = req.body;

  try {
    const lawDef = LawRegistry[type];
    if (!lawDef) return res.status(400).json({ error: "Tipo di legge sconosciuto." });

    const { data: region, error: regionError } = await supabase.from('regions').select('*').eq('id', user.residenceId).single();
    if (regionError || !region) return res.status(404).json({ error: "Regione non trovata." });

    const { data: isMp } = await supabase.from('parliament_members').select('userId').eq('userId', user.id).eq('regionId', user.residenceId).maybeSingle();
    const isLeader = region.ownerUserId === user.id;
    const isForeignMinister = region.foreignMinisterId === user.id;
    const isMigrationLaw = type === 'migration_agreement' || type === 'revoke_migration_agreement';

    if (!isMp && !isLeader && !(isForeignMinister && isMigrationLaw)) {
      return res.status(403).json({ error: "Non hai i permessi per proporre leggi in questa regione." });
    }

    // specific dict check
    if (type === "proclaim_dictatorship") {
      const dictatorshipAttempts = (region.dictatorshipAttempts || 0) + 1;
      if (dictatorshipAttempts > 2) {
        return res.status(400).json({ error: "Hai già raggiunto il limite di 2 tentativi di dittatura in questo mandato parlamentare." });
      }
      await supabase.from('regions').update({ dictatorshipAttempts }).eq('id', region.id);
    }

    const validationError = await lawDef.validate(region, params, user);
    if (validationError) return res.status(400).json({ error: validationError });

    const { data: activeLaw } = await supabase.from('laws').select('id')
      .eq('regionId', region.id)
      .eq('type', type)
      .in('status', ['pending', 'pending_assent'])
      .maybeSingle();

    if (activeLaw) return res.status(400).json({ error: "Una proposta simile è già in votazione o in attesa di sanzione." });

    const lawId = `law_${Date.now()}_${generateSecureId(6)}`;
    const nowIso = new Date().toISOString();

    // Check Dictatorship / Autocracies
    const autocracies = ["DICTATORSHIP", "ONE_PARTY_SYSTEM"];
    if (region.dictatorship || autocracies.includes(region.governmentForm)) {
      if (!isLeader) return res.status(403).json({ error: "In questo regime solo il Leader può legiferare." });

      await supabase.from('laws').insert({
        id: lawId, regionId: region.id, proposerId: user.id, type, params, status: 'passed', createdAt: nowIso, expiresAt: nowIso
      });

      await lawDef.execute(region, params, lawId);
      return res.json({ success: true, lawId, immediate: true });
    }

    // Normal Democracy / Executive Monarchy
    const isEconomicsMinister = region.economicAdviserId === user.id;
    const lawCat = lawDef.category;
    const canFastPass = (isEconomicsMinister && (lawCat === "Economia e Tasse" || lawCat === "Costruzioni Statali")) ||
      (isForeignMinister && (type === 'open_borders' || type === 'close_borders'));

    if (canFastPass) {
      await supabase.from('laws').insert({
        id: lawId, regionId: region.id, proposerId: user.id, type, params, status: 'passed', createdAt: nowIso, expiresAt: nowIso
      });
      await lawDef.execute(region, params, lawId);
      return res.json({ success: true, lawId, immediate: true, message: "Legge approvata immediatamente grazie ai tuoi poteri ministeriali." });
    }

    const expiresAt = new Date(Date.now() + (lawDef.delayDays * 24 * 60 * 60 * 1000)).toISOString();
    await supabase.from('laws').insert({
      id: lawId, regionId: region.id, proposerId: user.id, type, params, status: 'pending', createdAt: nowIso, expiresAt
    });

    // Auto-vote PRO
    await supabase.from('law_votes').insert({ lawId, voterId: user.id, vote: 'yes', createdAt: nowIso });

    res.json({ success: true, lawId, immediate: false });
  } catch (err: any) {
    console.error("Error proposing law:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/parliament/laws/vote", authenticate, async (req: any, res) => {
  const user = req.user;
  const { lawId, vote } = req.body; // vote: 'yes' or 'no'

  if (!['yes', 'no'].includes(vote)) return res.status(400).json({ error: "Voto non valido." });

  try {
    const { data: law, error: lawError } = await supabase.from('laws').select('*').eq('id', lawId).single();
    if (lawError || !law) return res.status(404).json({ error: "Legge non trovata." });

    const { data: region, error: regionError } = await supabase.from('regions').select('*').eq('id', law.regionId).single();
    if (regionError || !region) return res.status(404).json({ error: "Regione non trovata." });

    // Handle Assent Phase (Executive Monarchy)
    if (law.status === 'pending_assent') {
      if (region.governmentForm !== "EXECUTIVE_MONARCHY") {
        return res.status(400).json({ error: "L'Assenso del Sovrano si applica solo in Monarchia Esecutiva." });
      }

      const isEconomyLaw = LawRegistry[law.type]?.category === "Economia e Tasse";
      const canAssent = (isEconomyLaw && (user.id === region.economicAdviserId || user.id === region.ownerUserId)) ||
        (!isEconomyLaw && user.id === region.ownerUserId);

      if (!canAssent) {
        return res.status(403).json({ error: "Non hai l'autorità per sanzionare o porre veto a questa legge." });
      }

      const nowIso = new Date().toISOString();
      if (vote === 'yes' || vote === 'assent') {
        await supabase.from('laws').update({ status: 'passed' }).eq('id', lawId);
        try {
          await LawRegistry[law.type]?.execute(region, law.params, law.id);
        } catch (e) {
          console.error(`Error executing law ${law.type} after assent:`, e);
        }
        return res.json({ success: true, result: 'passed' });
      } else {
        await supabase.from('laws').update({ status: 'rejected' }).eq('id', lawId);
        return res.json({ success: true, result: 'vetoed' });
      }
    }

    // Normal Voting Phase
    if (law.status !== 'pending') return res.status(400).json({ error: "Votazione chiusa." });

    const { data: isMp } = await supabase.from('parliament_members').select('userId').eq('userId', user.id).eq('regionId', law.regionId).maybeSingle();
    const isLeader = region.ownerUserId === user.id;

    if (!isMp && !isLeader) {
      return res.status(403).json({ error: "Solo i Parlamentari o il Leader possono votare le leggi." });
    }

    const { error: upsertError } = await supabase.from('law_votes').upsert({
      lawId,
      voterId: user.id,
      vote,
      createdAt: new Date().toISOString()
    });

    if (upsertError) throw upsertError;

    res.json({ success: true });
  } catch (err: any) {
    console.error("Error voting on law:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/parliament/laws/withdraw", authenticate, async (req: any, res) => {
  const user = req.user;
  const { lawId } = req.body;

  const { data: law, error: lError } = await supabase
    .from('laws')
    .select('*')
    .eq('id', lawId)
    .single();

  if (lError || !law) return res.status(404).json({ error: "Legge non trovata." });
  if (law.status !== 'pending' && law.status !== 'pending_assent') return res.status(400).json({ error: "Puoi ritirare solo leggi attualmente in votazione." });
  if (law.proposerId !== user.id) return res.status(403).json({ error: "Solo il creatore della proposta può ritirarla." });

  const { error: uError } = await supabase
    .from('laws')
    .update({ status: 'withdrawn' })
    .eq('id', lawId);

  if (uError) return res.status(500).json({ error: uError.message });
  res.json({ success: true });
});

// Minister Fast-Pass: approve a pending law immediately
app.post("/api/parliament/laws/pass", authenticate, async (req: any, res) => {
  const user = req.user;
  const { lawId } = req.body;

  try {
    const { data: law, error: lawError } = await supabase.from('laws').select('*').eq('id', lawId).single();
    if (lawError || !law) return res.status(404).json({ error: "Legge non trovata." });
    if (law.status !== 'pending') return res.status(400).json({ error: "Solo leggi in votazione possono essere approvate via Fast-Pass." });

    const { data: region, error: regionError } = await supabase.from('regions').select('*').eq('id', law.regionId).single();
    if (regionError || !region) return res.status(404).json({ error: "Regione non trovata." });

    const lawDef = LawRegistry[law.type];
    if (!lawDef) return res.status(400).json({ error: "Tipo di legge sconosciuto." });

    // Check if user has fast-pass authority
    const isEconomicsMinister = region.economicAdviserId === user.id;
    const isForeignMinister = region.foreignMinisterId === user.id;
    const lawCat = lawDef.category;

    const canFastPass = (isEconomicsMinister && (lawCat === "Economia e Tasse" || lawCat === "Costruzioni Statali")) ||
      (isForeignMinister && (law.type === 'open_borders' || law.type === 'close_borders' || lawCat === 'Diplomacy' || lawCat === 'Residency'));

    if (!canFastPass) {
      return res.status(403).json({ error: "Non hai i poteri ministeriali per approvare questa legge via Fast-Pass." });
    }

    await supabase.from('laws').update({ status: 'passed', expiresAt: new Date().toISOString() }).eq('id', lawId);

    try {
      await lawDef.execute(region, law.params, law.id);
    } catch (e) {
      console.error(`Error executing fast-passed law ${law.type}:`, e);
    }

    res.json({ success: true, message: "Legge approvata via Fast-Pass ministeriale." });
  } catch (err: any) {
    console.error("Error in fast-pass:", err);
    res.status(500).json({ error: err.message });
  }
});

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
}): ExtractionBreakdown {
  const cfg = EXTRACTION_CONFIG;

  // Ensure minimum values to avoid 0^exp issues
  const pLvl = Math.max(1, params.playerLevel);
  const fLvl = Math.max(1, params.factoryLevel);
  const wExp = Math.max(cfg.MIN_WORK_EXPERIENCE, params.workExperience);
  const rCoeff = Math.max(0.01, params.resourceCoefficient);

  // 1. Base productivity
  const baseProductivity =
    cfg.BASE_COEFFICIENT
    * Math.pow(pLvl, cfg.PLAYER_LEVEL_EXPONENT)
    * Math.pow(rCoeff / cfg.RESOURCE_COEFF_DIVISOR, cfg.RESOURCE_COEFF_EXPONENT)
    * Math.pow(fLvl, cfg.FACTORY_LEVEL_EXPONENT)
    * Math.pow(wExp / cfg.WORK_EXPERIENCE_DIVISOR, cfg.WORK_EXPERIENCE_EXPONENT);

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
  const finalProductivity = baseProductivity * nationBonus * departmentBonus * balancingMultiplier;

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

  // 9. Gold special: money generated
  let moneyGenerated = 0;
  if (params.resourceType === 'gold_ore') {
    moneyGenerated = playerAmount * cfg.GOLD_TO_MONEY_COEFFICIENT;
  }

  return {
    playerLevel: pLvl,
    factoryLevel: fLvl,
    workExperience: wExp,
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
async function getPlayerWorkExperience(playerId: string, resourceType: string): Promise<number> {
  const { data } = await supabase
    .from('player_resource_work_experience')
    .select('experience')
    .eq('playerId', playerId)
    .eq('resourceType', resourceType)
    .maybeSingle();
  return data?.experience || EXTRACTION_CONFIG.MIN_WORK_EXPERIENCE;
}

async function incrementPlayerWorkExperience(playerId: string, resourceType: string, gain: number): Promise<void> {
  const { data: existing } = await supabase
    .from('player_resource_work_experience')
    .select('experience, totalExtractions')
    .eq('playerId', playerId)
    .eq('resourceType', resourceType)
    .maybeSingle();

  if (existing) {
    await supabase.from('player_resource_work_experience').update({
      experience: existing.experience + gain,
      totalExtractions: existing.totalExtractions + 1,
      lastWorkedAt: new Date().toISOString(),
    }).eq('playerId', playerId).eq('resourceType', resourceType);
  } else {
    await supabase.from('player_resource_work_experience').insert({
      playerId,
      resourceType,
      experience: EXTRACTION_CONFIG.MIN_WORK_EXPERIENCE + gain,
      totalExtractions: 1,
      lastWorkedAt: new Date().toISOString(),
    });
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

// ── GET /api/regions/:id/resources ──────────────────────────────
// Returns resource data for a region (with effective caps)
app.get("/api/regions/:id/resources", authenticate, async (req: any, res) => {
  const regionId = req.params.id;
  try {
    const { data: resources, error } = await supabase
      .from('region_resources')
      .select('*')
      .eq('regionId', regionId);

    if (error) throw error;
    if (!resources || resources.length === 0) {
      return res.json({ resources: [], deepActive: null });
    }

    const nationId = await getNationForRegion(regionId);
    const capMaxGlobal = parseInt(await getSetting('cap_max_global')) || 2000;

    // Check deep for each resource
    const enriched = await Promise.all(resources.map(async (r: any) => {
      const deep = nationId ? await getActiveDeep(nationId, r.resourceType) : null;
      const effectiveCap = computeEffectiveCap(r.baseCapPerRecharge, deep, capMaxGlobal);
      return {
        ...r,
        effectiveCapPerRecharge: effectiveCap,
        deepActive: !!deep,
        deepTargetCap: deep?.targetCap || null,
        deepEndsAt: deep?.endsAt || null,
        remainingDaily: Math.max(0, r.dailyAvailable - r.dailyExtracted),
      };
    }));

    res.json({ resources: enriched });
  } catch (err: any) {
    console.error("Error fetching region resources:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/resources/player-state ─────────────────────────────
// Returns player extraction state for a specific region
app.get("/api/resources/player-state", authenticate, async (req: any, res) => {
  const user = req.user;
  const regionId = (req.query.regionId as string) || user.regionId;
  try {
    const { data: states, error } = await supabase
      .from('player_extraction_state')
      .select('*')
      .eq('playerId', user.id)
      .eq('regionId', regionId);

    if (error) throw error;
    res.json({ states: states || [] });
  } catch (err: any) {
    console.error("Error fetching player extraction state:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/resources/work-extract ────────────────────────────
// Player works to extract a resource from a region
app.post("/api/resources/work-extract", authenticate, async (req: any, res) => {
  const user = req.user;
  const { regionId, resourceType } = req.body;

  if (!regionId || !resourceType) {
    return res.status(400).json({ error: "regionId e resourceType sono obbligatori." });
  }
  if (!RESOURCE_TYPES.includes(resourceType)) {
    return res.status(400).json({ error: "Tipo di risorsa non valido." });
  }

  try {
    const extractionCooldownMs = parseInt(await getSetting('work_extract_cooldown_ms')) || 2000;
    const canExtract = await checkCooldown(user.id, 'resource_extract_work', extractionCooldownMs);
    if (!canExtract) {
      return res.status(429).json({ error: "Troppi tentativi ravvicinati. Riprova tra pochi secondi." });
    }

    // 1. Energy check
    const energyCost = parseInt(await getSetting('work_energy_cost_extract')) || 10;
    const perks = user.perks || {};
    const resistenza = perks['RESISTENZA'] || 0;
    // Max 50% energy reduction at RESISTENZA level 50+ (same formula as factory work)
    const energyReduction = Math.min(0.5, resistenza / 100);
    const actualEnergyCost = Math.ceil(energyCost * (1 - energyReduction));

    if (user.energy < actualEnergyCost) {
      return res.status(400).json({ error: "Energia insufficiente.", reason: "no_energy" });
    }

    // 2. Get region resource
    const { data: regionRes, error: rrError } = await supabase
      .from('region_resources')
      .select('*')
      .eq('regionId', regionId)
      .eq('resourceType', resourceType)
      .single();

    if (rrError || !regionRes) {
      return res.status(404).json({ error: "Risorsa non disponibile in questa regione." });
    }

    // 3. Get effective cap
    const nationId = await getNationForRegion(regionId);
    const capMaxGlobal = parseInt(await getSetting('cap_max_global')) || 2000;
    const deep = nationId ? await getActiveDeep(nationId, resourceType) : null;
    const effectiveCap = computeEffectiveCap(regionRes.baseCapPerRecharge, deep, capMaxGlobal);

    // 4. Get player extraction state
    const { data: playerState } = await supabase
      .from('player_extraction_state')
      .select('*')
      .eq('playerId', user.id)
      .eq('regionId', regionId)
      .eq('resourceType', resourceType)
      .maybeSingle();

    const extractedSoFar = playerState?.extractedSinceLastRecharge || 0;
    const remainingCycle = Math.max(0, effectiveCap - extractedSoFar);
    const remainingDaily = Math.max(0, regionRes.dailyAvailable - regionRes.dailyExtracted);

    // 5. Calculate extraction amount
    const K = parseFloat(await getSetting('extraction_k')) || 0.02;
    const baseAmount = Math.max(1, Math.round(effectiveCap * K));
    const finalAmount = Math.min(baseAmount, remainingCycle, remainingDaily);

    if (finalAmount <= 0) {
      let reason = "unknown";
      if (remainingCycle <= 0) reason = "cycle_cap_reached";
      else if (remainingDaily <= 0) reason = "daily_exhausted";
      return res.status(400).json({
        error: reason === "cycle_cap_reached"
          ? "Cap del ciclo raggiunto. Serve una ricarica amministrativa."
          : "Risorsa giornaliera esaurita per questa regione.",
        reason,
      });
    }

    // 6. Deduct energy
    const { error: energyErr } = await supabase
      .from('users')
      .update({ energy: user.energy - actualEnergyCost })
      .eq('id', user.id);
    if (energyErr) throw energyErr;

    // 7. Update daily extracted (region)
    const { error: dailyErr } = await supabase
      .from('region_resources')
      .update({
        dailyExtracted: regionRes.dailyExtracted + finalAmount,
        updatedAt: new Date().toISOString(),
      })
      .eq('regionId', regionId)
      .eq('resourceType', resourceType);
    if (dailyErr) throw dailyErr;

    // 8. Upsert player extraction state
    if (playerState) {
      const { error: psErr } = await supabase
        .from('player_extraction_state')
        .update({
          extractedSinceLastRecharge: extractedSoFar + finalAmount,
          updatedAt: new Date().toISOString(),
        })
        .eq('playerId', user.id)
        .eq('regionId', regionId)
        .eq('resourceType', resourceType);
      if (psErr) throw psErr;
    } else {
      const { error: psErr } = await supabase
        .from('player_extraction_state')
        .insert({
          playerId: user.id,
          regionId,
          resourceType,
          extractedSinceLastRecharge: finalAmount,
          updatedAt: new Date().toISOString(),
        });
      if (psErr) throw psErr;
    }

    // 9. Add to player inventory
    const { data: existingInv } = await supabase.from('user_inventory')
      .select('quantity').eq('userId', user.id).eq('itemId', resourceType).maybeSingle();
    if (existingInv) {
      await supabase.from('user_inventory')
        .update({ quantity: existingInv.quantity + finalAmount })
        .eq('userId', user.id).eq('itemId', resourceType);
    } else {
      await supabase.from('user_inventory')
        .insert({ userId: user.id, itemId: resourceType, quantity: finalAmount });
    }

    // 10. Log extraction
    await supabase.from('resource_extraction_logs').insert({
      playerId: user.id,
      regionId,
      resourceType,
      amount: finalAmount,
    });

    // 11. XP
    const xpGain = GAME_CONFIG.XP_PER_WORK + (perks['ISTRUZIONE'] || 0) * 2;
    await addXP(user.id, xpGain);
    await updateCooldown(user.id, 'resource_extract_work');

    res.json({
      success: true,
      amount: finalAmount,
      resourceType,
      remainingCycle: remainingCycle - finalAmount,
      remainingDaily: remainingDaily - finalAmount,
      xpGain,
      energyCost: actualEnergyCost,
    });
  } catch (err: any) {
    console.error("Error in work-extract:", err);
    res.status(500).json({ error: "Errore durante l'estrazione: " + err.message });
  }
});

// ── POST /api/resources/recharge ────────────────────────────────
// Admin (dictator/economy minister) recharges a resource for a region
app.post("/api/resources/recharge", authenticate, async (req: any, res) => {
  const user = req.user;
  const { regionId, resourceType } = req.body;

  if (!regionId || !resourceType) {
    return res.status(400).json({ error: "regionId e resourceType sono obbligatori." });
  }

  try {
    // 1. Get region
    const { data: region, error: regErr } = await supabase
      .from('regions')
      .select('*')
      .eq('id', regionId)
      .single();
    if (regErr || !region) return res.status(404).json({ error: "Regione non trovata." });

    // 2. Check role: must be dictator/leader or economy minister
    const isLeader = region.ownerUserId === user.id;
    const isEconomyMinister = region.economicAdviserId === user.id;

    if (!isLeader && !isEconomyMinister) {
      return res.status(403).json({ error: "Solo il Dittatore/Leader o il Ministro dell'Economia possono ricaricare." });
    }

    // 3. Cooldown check
    const cooldownSec = parseInt(await getSetting('recharge_cooldown_seconds')) || 7200;
    const { data: rechargeData } = await supabase
      .from('resource_recharges')
      .select('*')
      .eq('regionId', regionId)
      .eq('resourceType', resourceType)
      .maybeSingle();

    if (rechargeData?.lastRechargeAt) {
      const elapsed = (Date.now() - new Date(rechargeData.lastRechargeAt).getTime()) / 1000;
      if (elapsed < cooldownSec) {
        const remaining = Math.ceil(cooldownSec - elapsed);
        return res.status(400).json({
          error: `Cooldown attivo. Riprova tra ${Math.ceil(remaining / 60)} minuti.`,
          cooldownRemaining: remaining,
        });
      }
    }

    // 4. Deduct cost from country treasury (budget)
    const costEur = parseInt(await getSetting('recharge_cost_eur')) || 50000;
    const costGold = parseInt(await getSetting('recharge_cost_gold')) || 0;
    const costDiamonds = parseInt(await getSetting('recharge_cost_diamonds')) || 0;

    // Use budget transaction for EUR
    if (costEur > 0) {
      try {
        await supabase.rpc('add_budget_transaction', {
          p_owner_type: 'REGION',
          p_owner_id: regionId,
          p_type: 'EXPENSE',
          p_subtype: 'RESOURCE_RECHARGE',
          p_money_delta: -costEur,
          p_created_by: user.id,
          p_metadata: { resourceType, costEur, costGold, costDiamonds },
        });
      } catch (budgetErr: any) {
        return res.status(400).json({ error: "Fondi del tesoro insufficienti per la ricarica. Servono €" + costEur.toLocaleString() });
      }
    }

    // 5. Reset ALL player extraction states for this region+resource (GLOBAL recharge)
    const { error: resetErr } = await supabase
      .from('player_extraction_state')
      .update({ extractedSinceLastRecharge: 0, updatedAt: new Date().toISOString() })
      .eq('regionId', regionId)
      .eq('resourceType', resourceType);
    if (resetErr) throw resetErr;

    // 6. Update/upsert recharge tracker
    const nowIso = new Date().toISOString();
    if (rechargeData) {
      await supabase
        .from('resource_recharges')
        .update({ lastRechargeAt: nowIso, rechargedByUserId: user.id })
        .eq('regionId', regionId)
        .eq('resourceType', resourceType);
    } else {
      await supabase
        .from('resource_recharges')
        .insert({ regionId, resourceType, lastRechargeAt: nowIso, rechargedByUserId: user.id });
    }

    res.json({
      success: true,
      message: `Ricarica completata per ${resourceType} nella regione ${regionId}.`,
      costEur,
      cooldownSeconds: cooldownSec,
    });
  } catch (err: any) {
    console.error("Error in resource recharge:", err);
    res.status(500).json({ error: "Errore durante la ricarica: " + err.message });
  }
});

// ── GET /api/resources/recharge-info ────────────────────────────
// Get recharge status for a region+resource (cooldown, cost, role check)
app.get("/api/resources/recharge-info", authenticate, async (req: any, res) => {
  const regionId = req.query.regionId as string;
  const resourceType = req.query.resourceType as string;
  if (!regionId || !resourceType) return res.status(400).json({ error: "regionId e resourceType obbligatori" });

  try {
    const cooldownSec = parseInt(await getSetting('recharge_cooldown_seconds')) || 7200;
    const costEur = parseInt(await getSetting('recharge_cost_eur')) || 50000;

    const { data: rechargeData } = await supabase
      .from('resource_recharges')
      .select('*')
      .eq('regionId', regionId)
      .eq('resourceType', resourceType)
      .maybeSingle();

    let cooldownRemaining = 0;
    if (rechargeData?.lastRechargeAt) {
      const elapsed = (Date.now() - new Date(rechargeData.lastRechargeAt).getTime()) / 1000;
      cooldownRemaining = Math.max(0, cooldownSec - elapsed);
    }

    // Check budget
    const { data: budget } = await supabase.from('budgets').select('moneyEUR').eq('ownerType', 'REGION').eq('ownerId', regionId).maybeSingle();

    res.json({
      cooldownRemaining: Math.ceil(cooldownRemaining),
      cooldownTotal: cooldownSec,
      costEur,
      lastRechargeAt: rechargeData?.lastRechargeAt || null,
      treasuryEur: budget?.moneyEUR || 0,
      canAfford: (budget?.moneyEUR || 0) >= costEur,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/resources/deep-exploration/cost ───────────────────
// Preview cost for Deep Exploration (called by frontend before activation)
app.post("/api/resources/deep-exploration/cost", authenticate, async (req: any, res) => {
  const { nationId, resourceType, level } = req.body;
  if (!nationId || !resourceType || !level) {
    return res.status(400).json({ error: "nationId, resourceType e level sono obbligatori." });
  }

  try {
    const preview = await computeDeepCost(nationId, resourceType, parseInt(level));
    res.json(preview);
  } catch (err: any) {
    console.error("Error computing deep cost:", err);
    res.status(500).json({ error: err.message });
  }
});

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

// ── POST /api/resources/deep-exploration/activate ───────────────
// Activate Deep Exploration law (leader/dictator or parliamentary flow)
app.post("/api/resources/deep-exploration/activate", authenticate, async (req: any, res) => {
  const user = req.user;
  const { nationId, resourceType, level } = req.body;

  if (!nationId || !resourceType || !level) {
    return res.status(400).json({ error: "nationId, resourceType e level sono obbligatori." });
  }

  try {
    // 1. Check user is authorized on the nation's capital region
    const { data: nationRegions } = await supabase
      .from('regions')
      .select('id, ownerUserId, economicAdviserId, nation_id, isCapital')
      .eq('nation_id', nationId);

    if (!nationRegions || nationRegions.length === 0) {
      return res.status(404).json({ error: "Nazione non trovata." });
    }

    const capitalRegion = nationRegions.find((r: any) => r.isCapital);
    if (!capitalRegion) {
      return res.status(400).json({ error: "Capitale nazionale non configurata." });
    }

    const isLeaderOfNation = capitalRegion.ownerUserId === user.id;
    const isEconomyMinisterOfNation = capitalRegion.economicAdviserId === user.id;

    if (!isLeaderOfNation && !isEconomyMinisterOfNation) {
      return res.status(403).json({ error: "Solo il Leader/Dittatore o il Ministro dell'Economia può attivare Deep Exploration." });
    }

    // 2. Check no active Deep for this nation (only 1 at a time)
    const nowStr = new Date().toISOString();
    const { data: existingDeep } = await supabase
      .from('deep_explorations')
      .select('id, resourceType, endsAt')
      .eq('nationId', nationId)
      .eq('isActive', true)
      .gte('endsAt', nowStr)
      .limit(1);

    if (existingDeep && existingDeep.length > 0) {
      return res.status(400).json({
        error: `Deep Exploration già attiva per ${existingDeep[0].resourceType}. Scade il ${new Date(existingDeep[0].endsAt).toLocaleString('it-IT')}.`,
      });
    }

    // 3. Compute cost server-side
    const preview = await computeDeepCost(nationId, resourceType, parseInt(level));

    // 4. Check & deduct treasury (EUR from budget of first region in nation)
    // Use the first region's budget as the national treasury
    const primaryRegionId = capitalRegion.id;

    // Helper: rollback already-deducted costs on failure
    const rollbackCosts = async (refundEur: boolean, refundDiamonds: boolean, reason: string) => {
      if (refundEur && preview.costEur > 0) {
        await supabase.rpc('add_budget_transaction', {
          p_owner_type: 'REGION',
          p_owner_id: primaryRegionId,
          p_type: 'INCOME',
          p_subtype: 'DEEP_EXPLORATION_REFUND',
          p_money_delta: preview.costEur,
          p_created_by: user.id,
          p_metadata: { reason },
        });
      }
      if (refundDiamonds && preview.costDiamonds > 0) {
        const { data: dInv } = await supabase.from('user_inventory')
          .select('quantity').eq('userId', user.id).eq('itemId', 'diamonds').maybeSingle();
        await supabase.from('user_inventory')
          .update({ quantity: (dInv?.quantity || 0) + preview.costDiamonds })
          .eq('userId', user.id).eq('itemId', 'diamonds');
      }
    };

    if (preview.costEur > 0) {
      try {
        await supabase.rpc('add_budget_transaction', {
          p_owner_type: 'REGION',
          p_owner_id: primaryRegionId,
          p_type: 'EXPENSE',
          p_subtype: 'DEEP_EXPLORATION',
          p_money_delta: -preview.costEur,
          p_created_by: user.id,
          p_metadata: {
            resourceType,
            level,
            targetCap: preview.targetCap,
            costDiamonds: preview.costDiamonds,
            costGold: preview.costGold,
          },
        });
      } catch (budgetErr: any) {
        return res.status(400).json({ error: "Fondi EUR insufficienti nel tesoro nazionale. Servono €" + preview.costEur.toLocaleString() });
      }
    }

    // Deduct diamonds from user inventory (premium currency)
    if (preview.costDiamonds > 0) {
      const { data: diamondInv } = await supabase.from('user_inventory')
        .select('quantity').eq('userId', user.id).eq('itemId', 'diamonds').maybeSingle();
      const currentDiamonds = diamondInv?.quantity || 0;

      if (currentDiamonds < preview.costDiamonds) {
        await rollbackCosts(true, false, 'diamond_insufficient');
        return res.status(400).json({ error: `Diamanti insufficienti. Servono ${preview.costDiamonds}, hai ${currentDiamonds}.` });
      }

      await supabase.from('user_inventory')
        .update({ quantity: currentDiamonds - preview.costDiamonds })
        .eq('userId', user.id).eq('itemId', 'diamonds');
    }

    // Deduct gold from user if needed
    if (preview.costGold > 0) {
      if (user.gold < preview.costGold) {
        await rollbackCosts(true, true, 'gold_insufficient');
        return res.status(400).json({ error: `Gold insufficiente. Servono ${preview.costGold}, hai ${user.gold}.` });
      }
      await supabase.from('users').update({ gold: user.gold - preview.costGold }).eq('id', user.id);
    }

    // 5. Create Deep Exploration record
    const durationDays = parseInt(await getSetting('deep_duration_days')) || 7;
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
    const deepId = 'deep_' + generateSecureId(9);

    await supabase.from('deep_explorations').insert({
      id: deepId,
      nationId,
      resourceType,
      level: parseInt(level),
      targetCap: preview.targetCap,
      activatedByUserId: user.id,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      isActive: true,
      costDiamonds: preview.costDiamonds,
      costEur: preview.costEur,
      costGold: preview.costGold,
    });

    res.json({
      success: true,
      deepId,
      targetCap: preview.targetCap,
      endsAt: endsAt.toISOString(),
      costs: {
        diamonds: preview.costDiamonds,
        eur: preview.costEur,
        gold: preview.costGold,
      },
      message: `Deep Exploration Livello ${level} attivata per ${resourceType}! Durata: ${durationDays} giorni.`,
    });
  } catch (err: any) {
    console.error("Error activating deep exploration:", err);
    res.status(500).json({ error: "Errore nell'attivazione: " + err.message });
  }
});

// ── GET /api/resources/deep-exploration/status ──────────────────
// Get active Deep Exploration for a nation
app.get("/api/resources/deep-exploration/status", authenticate, async (req: any, res) => {
  const nationId = req.query.nationId as string;
  if (!nationId) return res.status(400).json({ error: "nationId obbligatorio" });

  try {
    const nowStr = new Date().toISOString();
    // Run active exploration query and cached levels lookup in parallel
    const [{ data: active }, levels] = await Promise.all([
      supabase
        .from('deep_explorations')
        .select('*')
        .eq('nationId', nationId)
        .eq('isActive', true)
        .gte('endsAt', nowStr)
        .order('startsAt', { ascending: false })
        .limit(1),
      getCachedDeepLevels()
    ]);

    res.json({
      active: active && active.length > 0 ? active[0] : null,
      levels: levels || [],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// ██ ADVANCED EXTRACTION SYSTEM ENDPOINTS
// ══════════════════════════════════════════════════════════════════

// ── POST /api/extraction/work ───────────────────────────────────
// Main extraction endpoint: player works in a factory to extract resources.
// Uses the full productivity formula with breakdown.
app.post("/api/extraction/work", authenticate, async (req: any, res) => {
  const user = req.user;
  const { factoryId } = req.body;

  if (!factoryId) {
    return res.status(400).json({ error: "factoryId è obbligatorio." });
  }

  try {
    // 1. Get factory
    const { data: factory, error: fErr } = await supabase
      .from('factories')
      .select('*')
      .eq('id', factoryId)
      .single();

    if (fErr || !factory) return res.status(404).json({ error: "Fabbrica non trovata." });
    if (factory.isActive === false) return res.status(400).json({ error: "Fabbrica non attiva." });
    const factoryMinLevel = factory.minLevel ?? 1;
    if (user.level < factoryMinLevel) return res.status(400).json({ error: `Richiede livello ${factoryMinLevel}.` });

    const factoryType = factory.type || '';
    const typeDef = FACTORY_CONFIG.TYPES[factoryType];
    if (!typeDef) return res.status(400).json({ error: "Tipo fabbrica non valido." });

    const resourceType = typeDef.resource;
    if (!resourceType) return res.status(400).json({ error: "Questa fabbrica non produce risorse estraibili." });

    const regionId = factory.regionId;

    // 2. Check work restrictions
    const { data: regionRel } = await supabase.from('regions').select('*').eq('id', regionId).single();
    if (!regionRel) return res.status(404).json({ error: "Regione non trovata." });

    const restrictionsActive = regionRel.workRestrictions === 1;
    const isResident = user.residence_id === regionId;
    const hasWorkPermit = user.work_permit_id === regionId;
    if (restrictionsActive && !isResident && !hasWorkPermit) {
      return res.status(403).json({ error: "Questa nazione richiede un Permesso di Lavoro." });
    }

    // 3. Energy check
    const perks = user.perks || {};
    const resistenza = perks['RESISTENZA'] || 0;
    const energyReduction = Math.min(0.5, resistenza / 100);
    const actualEnergyCost = Math.ceil(EXTRACTION_CONFIG.WORK_ACTION_ENERGY_COST * (1 - energyReduction));
    if (user.energy < actualEnergyCost) {
      return res.status(400).json({ error: "Energia insufficiente.", reason: "no_energy" });
    }

    // 4. Check region resource availability
    const { data: regionRes } = await supabase
      .from('region_resources')
      .select('*')
      .eq('regionId', regionId)
      .eq('resourceType', resourceType)
      .maybeSingle();

    // For energy-based resources, they may not have a region_resources row
    const dailyAvailable = regionRes?.dailyAvailable ?? 999999;
    const dailyExtracted = regionRes?.dailyExtracted ?? 0;
    const remainingDaily = Math.max(0, dailyAvailable - dailyExtracted);

    if (remainingDaily <= 0 && regionRes) {
      return res.status(400).json({ error: "Risorsa giornaliera esaurita per questa regione.", reason: "daily_exhausted" });
    }

    // 5. Gather all formula inputs
    const nationId = await getNationForRegion(regionId);
    const capMaxGlobal = parseInt(await getSetting('cap_max_global')) || 2000;
    const deep = nationId ? await getActiveDeep(nationId, resourceType) : null;
    const baseCap = regionRes?.baseCapPerRecharge ?? 200;
    const effectiveCap = computeEffectiveCap(baseCap, deep, capMaxGlobal);
    const deepBonus = deep ? Math.max(0, (deep.targetCap || 0) - baseCap) : 0;

    const [workExp, numPowerPlants, departmentBonus] = await Promise.all([
      getPlayerWorkExperience(user.id, resourceType),
      getRegionPowerPlants(regionId),
      getDepartmentBonus(regionId, resourceType),
    ]);

    const resourceCoefficient = getResourceCoefficient(resourceType, effectiveCap, numPowerPlants);

    const taxRate = regionRel.marketTaxRate ?? regionRel.industryTaxPercent ?? FACTORY_CONFIG.DEFAULT_INDUSTRY_TAX_RATE;
    const ownerProfitRate = FACTORY_CONFIG.OWNER_PROFIT_RATE;
    const autonomySharePercent = regionRel.regionalProfitSharePercent ?? 0;

    // 6. Calculate extraction
    const breakdown = calculateExtraction({
      playerLevel: user.level || 1,
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
      regionResidualToday: remainingDaily,
    });

    // 7. Cap the actual extraction by daily remaining and player cycle cap
    const { data: playerState } = await supabase
      .from('player_extraction_state')
      .select('*')
      .eq('playerId', user.id)
      .eq('regionId', regionId)
      .eq('resourceType', resourceType)
      .maybeSingle();

    const extractedSoFar = playerState?.extractedSinceLastRecharge || 0;
    const remainingCycle = Math.max(0, effectiveCap - extractedSoFar);

    // The actual amount the player receives (capped)
    let actualPlayerAmount = Math.min(breakdown.playerAmount, remainingCycle, remainingDaily);
    if (actualPlayerAmount < EXTRACTION_CONFIG.MIN_EXTRACTION_THRESHOLD) {
      const reason = remainingCycle <= 0 ? "cycle_cap_reached" : "daily_exhausted";
      return res.status(400).json({
        error: reason === "cycle_cap_reached"
          ? "Cap del ciclo raggiunto. Serve una ricarica amministrativa."
          : "Risorsa giornaliera esaurita.",
        reason,
      });
    }

    // Scale all amounts proportionally if capped
    const scaleFactor = actualPlayerAmount / Math.max(EXTRACTION_CONFIG.MIN_EXTRACTION_THRESHOLD, breakdown.playerAmount);
    const actualGross = breakdown.grossAmount * scaleFactor;
    const actualOwner = breakdown.ownerAmount * scaleFactor;
    const actualTax = breakdown.taxAmount * scaleFactor;
    const actualState = breakdown.stateAmount * scaleFactor;
    const actualAutonomy = breakdown.autonomyAmount * scaleFactor;
    const actualWithdrawn = breakdown.withdrawnPoints * scaleFactor;
    const actualMoney = breakdown.moneyGenerated * scaleFactor;

    // 8. Deduct energy
    const { error: energyErr } = await supabase
      .from('users')
      .update({ energy: user.energy - actualEnergyCost })
      .eq('id', user.id);
    if (energyErr) throw energyErr;

    // 9. Update region daily extracted (track actual resource units, not withdrawn points)
    const roundedPlayer = Math.round(actualPlayerAmount);
    if (roundedPlayer <= 0) {
      return res.status(400).json({ error: "Produttività insufficiente per estrarre.", reason: "insufficient_productivity" });
    }

    if (regionRes) {
      const newDailyExtracted = Math.min(
        dailyAvailable,
        dailyExtracted + roundedPlayer
      );
      await supabase.from('region_resources').update({
        dailyExtracted: newDailyExtracted,
        updatedAt: new Date().toISOString(),
      }).eq('regionId', regionId).eq('resourceType', resourceType);
    }

    // 10. Update player cycle extraction state
    const newExtracted = extractedSoFar + roundedPlayer;
    if (playerState) {
      await supabase.from('player_extraction_state').update({
        extractedSinceLastRecharge: newExtracted,
        updatedAt: new Date().toISOString(),
      }).eq('playerId', user.id).eq('regionId', regionId).eq('resourceType', resourceType);
    } else {
      await supabase.from('player_extraction_state').insert({
        playerId: user.id, regionId, resourceType,
        extractedSinceLastRecharge: roundedPlayer,
        updatedAt: new Date().toISOString(),
      });
    }

    // 11. Add resources to player inventory
    const { data: existingInv } = await supabase.from('user_inventory')
      .select('quantity').eq('userId', user.id).eq('itemId', resourceType).maybeSingle();
    if (existingInv) {
      await supabase.from('user_inventory')
        .update({ quantity: existingInv.quantity + roundedPlayer })
        .eq('userId', user.id).eq('itemId', resourceType);
    } else {
      await supabase.from('user_inventory')
        .insert({ userId: user.id, itemId: resourceType, quantity: roundedPlayer });
    }

    // 12. Gold special: add money to player
    if (resourceType === 'gold_ore' && actualMoney > 0) {
      await supabase.rpc('safe_deduct_currency', {
        p_user_id: user.id,
        p_money_cost: -Math.round(actualMoney),
        p_gold_cost: 0,
        p_energy_cost: 0,
      });
    }

    // 13. Owner profit (stored in factory Magazzino)
    if (Math.round(actualOwner) > 0) {
      await supabase.rpc('increment_factory_storage', {
        p_factory_id: factoryId,
        p_amount: Math.round(actualOwner)
      });
    }

    // 14. Taxes to budget
    if (Math.round(actualTax) > 0) {
      const taxMoney = Math.round(actualTax * (FACTORY_CONFIG.RESOURCE_VALUES[resourceType] || 1));
      if (taxMoney > 0) {
        await supabase.rpc('add_budget_transaction', {
          p_owner_type: 'REGION',
          p_owner_id: regionId,
          p_type: 'INCOME',
          p_subtype: 'EXTRACTION_TAX',
          p_money_delta: taxMoney,
          p_created_by: user.id,
          p_metadata: { resourceType, factoryId, grossAmount: actualGross, taxAmount: actualTax },
        });
      }
    }

    // 15. Work experience
    await incrementPlayerWorkExperience(user.id, resourceType, EXTRACTION_CONFIG.WORK_EXPERIENCE_GAIN);

    // 16. XP gain
    const xpGain = GAME_CONFIG.XP_PER_WORK + (perks['ISTRUZIONE'] || 0) * 2;
    await addXP(user.id, xpGain);

    // 17. Detailed extraction log
    await supabase.from('extraction_detailed_logs').insert({
      playerId: user.id,
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
      playerLevel: user.level || 1,
      factoryLevel: factory.level || 1,
      workExperience: workExp,
      resourceCoefficient: resourceCoefficient,
      finalProductivity: breakdown.finalProductivity,
    });

    // Also log in old extraction logs for compatibility
    await supabase.from('resource_extraction_logs').insert({
      playerId: user.id, regionId, resourceType, amount: roundedPlayer,
    });

    // 18. Update factory stats
    await supabase.from('factories').update({
      totalWorkerCount: (factory.totalWorkerCount || 0) + 1,
      totalProduction: (factory.totalProduction || 0) + roundedPlayer,
      totalOwnerProfit: (factory.totalOwnerProfit || 0) + Math.round(actualOwner),
      totalTaxesPaid: (factory.totalTaxesPaid || 0) + Math.round(actualTax),
    }).eq('id', factory.id);

    res.json({
      success: true,
      amount: roundedPlayer,
      resourceType,
      moneyGenerated: Math.round(actualMoney),
      remainingCycle: Math.max(0, remainingCycle - roundedPlayer),
      remainingDaily: Math.max(0, remainingDaily - Math.round(actualWithdrawn)),
      xpGain,
      energyCost: actualEnergyCost,
      workExperience: workExp + EXTRACTION_CONFIG.WORK_EXPERIENCE_GAIN,
      breakdown: {
        baseProductivity: Math.round(breakdown.baseProductivity * 100) / 100,
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
      },
    });
  } catch (err: any) {
    console.error("Error in extraction/work:", err);
    res.status(500).json({ error: "Errore durante l'estrazione: " + err.message });
  }
});

// ── GET /api/extraction/breakdown ───────────────────────────────
// Preview the extraction breakdown for a player+factory combo without performing work.
app.get("/api/extraction/breakdown", authenticate, async (req: any, res) => {
  const user = req.user;
  const factoryId = req.query.factoryId as string;
  if (!factoryId) return res.status(400).json({ error: "factoryId è obbligatorio." });

  try {
    const { data: factory } = await supabase.from('factories').select('*').eq('id', factoryId).single();
    if (!factory) return res.status(404).json({ error: "Fabbrica non trovata." });

    const factoryType = factory.type || '';
    const typeDef = FACTORY_CONFIG.TYPES[factoryType];
    if (!typeDef) return res.status(400).json({ error: "Tipo fabbrica non valido." });

    const resourceType = typeDef.resource;
    const regionId = factory.regionId;

    const { data: regionRel } = await supabase.from('regions').select('*').eq('id', regionId).single();
    if (!regionRel) return res.status(404).json({ error: "Regione non trovata." });

    const { data: regionRes } = await supabase
      .from('region_resources')
      .select('*')
      .eq('regionId', regionId)
      .eq('resourceType', resourceType)
      .maybeSingle();

    const nationId = await getNationForRegion(regionId);
    const capMaxGlobal = parseInt(await getSetting('cap_max_global')) || 2000;
    const deep = nationId ? await getActiveDeep(nationId, resourceType) : null;
    const baseCap = regionRes?.baseCapPerRecharge ?? 200;
    const effectiveCap = computeEffectiveCap(baseCap, deep, capMaxGlobal);
    const deepBonus = deep ? Math.max(0, (deep.targetCap || 0) - baseCap) : 0;
    const dailyAvailable = regionRes?.dailyAvailable ?? 999999;
    const dailyExtracted = regionRes?.dailyExtracted ?? 0;
    const remainingDaily = Math.max(0, dailyAvailable - dailyExtracted);

    const [workExp, numPowerPlants, departmentBonusLevel] = await Promise.all([
      getPlayerWorkExperience(user.id, resourceType),
      getRegionPowerPlants(regionId),
      getDepartmentBonus(regionId, resourceType),
    ]);

    const resourceCoefficient = getResourceCoefficient(resourceType, effectiveCap, numPowerPlants);

    const taxRate = regionRel.marketTaxRate ?? regionRel.industryTaxPercent ?? FACTORY_CONFIG.DEFAULT_INDUSTRY_TAX_RATE;
    const autonomySharePercent = regionRel.regionalProfitSharePercent ?? 0;

    const breakdown = calculateExtraction({
      playerLevel: user.level || 1,
      factoryLevel: factory.level || 1,
      workExperience: workExp,
      resourceType,
      resourceCoefficient,
      departmentBonusLevel,
      nationBonusEnabled: true,
      taxRate,
      ownerProfitRate: FACTORY_CONFIG.OWNER_PROFIT_RATE,
      autonomySharePercent,
      regionCapMax: baseCap,
      regionDeepBonus: deepBonus,
      regionCapTotal: effectiveCap,
      regionResidualToday: remainingDaily,
    });

    // Energy cost preview
    const perks = user.perks || {};
    const resistenza = perks['RESISTENZA'] || 0;
    const energyReduction = Math.min(0.5, resistenza / 100);
    const actualEnergyCost = Math.ceil(EXTRACTION_CONFIG.WORK_ACTION_ENERGY_COST * (1 - energyReduction));

    res.json({
      breakdown,
      energyCost: actualEnergyCost,
      factoryType,
      factoryLevel: factory.level,
      resourceLabel: (FACTORY_CONFIG.TYPES[factoryType] as any)?.label || factoryType,
      workExperience: workExp,
      canWork: remainingDaily > 0 && user.energy >= actualEnergyCost,
    });
  } catch (err: any) {
    console.error("Error in extraction/breakdown:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/extraction/player-experience ───────────────────────
// Returns all work experience entries for the current player.
app.get("/api/extraction/player-experience", authenticate, async (req: any, res) => {
  try {
    const { data, error } = await supabase
      .from('player_resource_work_experience')
      .select('*')
      .eq('playerId', req.user.id);

    if (error) throw error;
    res.json({ experience: data || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/extraction/region-dashboard/:id ────────────────────
// Returns a comprehensive resource dashboard for a region.
app.get("/api/extraction/region-dashboard/:id", authenticate, async (req: any, res) => {
  const regionId = req.params.id;
  try {
    // Region data
    const { data: region } = await supabase.from('regions').select('*').eq('id', regionId).single();
    if (!region) return res.status(404).json({ error: "Regione non trovata." });

    // All resources for this region
    const { data: resources } = await supabase
      .from('region_resources')
      .select('*')
      .eq('regionId', regionId);

    const nationId = await getNationForRegion(regionId);
    const capMaxGlobal = parseInt(await getSetting('cap_max_global')) || 2000;

    // Enrich with deep exploration + effective caps
    const enriched = await Promise.all((resources || []).map(async (r: any) => {
      const deep = nationId ? await getActiveDeep(nationId, r.resourceType) : null;
      const effectiveCap = computeEffectiveCap(r.baseCapPerRecharge, deep, capMaxGlobal);
      const deepBonus = deep ? Math.max(0, (deep.targetCap || 0) - r.baseCapPerRecharge) : 0;
      const remainingDaily = Math.max(0, r.dailyAvailable - r.dailyExtracted);
      return {
        resourceType: r.resourceType,
        baseCap: r.baseCapPerRecharge,
        deepBonus,
        effectiveCap,
        dailyAvailable: r.dailyAvailable,
        dailyExtracted: r.dailyExtracted,
        remainingDaily,
        deepActive: !!deep,
        deepEndsAt: deep?.endsAt || null,
      };
    }));

    // Last 24h extraction analytics
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentLogs } = await supabase
      .from('extraction_detailed_logs')
      .select('resourceType, grossAmount, playerAmount, taxAmount, stateAmount, autonomyAmount, moneyGenerated, withdrawnPoints')
      .eq('regionId', regionId)
      .gte('createdAt', since24h);

    // Aggregate by resource type
    const analytics: Record<string, any> = {};
    for (const log of (recentLogs || [])) {
      const rt = log.resourceType;
      if (!analytics[rt]) {
        analytics[rt] = {
          totalExtracted: 0, totalPlayerAmount: 0, totalTaxAmount: 0,
          totalStateAmount: 0, totalAutonomyAmount: 0, totalMoneyGenerated: 0,
          totalWithdrawnPoints: 0, extractionCount: 0,
        };
      }
      analytics[rt].totalExtracted += Number(log.grossAmount || 0);
      analytics[rt].totalPlayerAmount += Number(log.playerAmount || 0);
      analytics[rt].totalTaxAmount += Number(log.taxAmount || 0);
      analytics[rt].totalStateAmount += Number(log.stateAmount || 0);
      analytics[rt].totalAutonomyAmount += Number(log.autonomyAmount || 0);
      analytics[rt].totalMoneyGenerated += Number(log.moneyGenerated || 0);
      analytics[rt].totalWithdrawnPoints += Number(log.withdrawnPoints || 0);
      analytics[rt].extractionCount += 1;
    }

    // Department bonuses
    const { data: deptBonuses } = await supabase
      .from('resource_department_bonuses')
      .select('*')
      .eq('regionId', regionId);

    res.json({
      regionId,
      regionName: region.name,
      isAutonomous: region.isAutonomous || false,
      taxRate: region.marketTaxRate ?? region.industryTaxPercent ?? FACTORY_CONFIG.DEFAULT_INDUSTRY_TAX_RATE,
      autonomySharePercent: region.regionalProfitSharePercent ?? 0,
      resources: enriched,
      analytics24h: analytics,
      departmentBonuses: deptBonuses || [],
    });
  } catch (err: any) {
    console.error("Error in region dashboard:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/extraction/leaderboard ─────────────────────────────
// Top extractors in the last 24h.
app.get("/api/extraction/leaderboard", authenticate, async (req: any, res) => {
  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const regionId = req.query.regionId as string;

    let query = supabase
      .from('extraction_detailed_logs')
      .select('playerId, playerAmount, resourceType')
      .gte('createdAt', since24h);

    if (regionId) query = query.eq('regionId', regionId);

    const { data: logs } = await query;

    // Aggregate by player
    const playerTotals: Record<string, number> = {};
    for (const log of (logs || [])) {
      playerTotals[log.playerId] = (playerTotals[log.playerId] || 0) + Number(log.playerAmount || 0);
    }

    // Sort and limit
    const sorted = Object.entries(playerTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    // Fetch usernames (skip query if no players)
    const playerIds = sorted.map(([id]) => id);
    let usernameMap: Record<string, any> = {};
    if (playerIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, username, level')
        .in('id', playerIds);
      for (const u of (users || [])) usernameMap[u.id] = u;
    }

    const leaderboard = sorted.map(([id, total]) => ({
      playerId: id,
      username: usernameMap[id]?.username || 'Unknown',
      level: usernameMap[id]?.level || 1,
      totalExtracted: Math.round(total),
    }));

    res.json({ leaderboard });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── State Salaries Payout Logic ──────────────────────
async function payoutStateSalaries() {
  try {
    console.log("[Salaries] Starting daily state salaries payout...");
    
    // 1. Fetch all nations
    const { data: nations, error: nationsError } = await supabase
      .from('nations')
      .select('id, government_form, leaderUserId, gold_reserve');
    
    if (nationsError || !nations) {
      console.error("[Salaries] Error fetching nations:", nationsError);
      return;
    }

    // 2. Count regions per nation
    const { data: regionalCounts } = await supabase
      .from('regions')
      .select('nation_id')
      .not('nation_id', 'is', null);
    
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
           const { data: user } = await supabase.from('users').select('gold').eq('id', nation.leaderUserId).single();
           if (user) {
             await supabase.from('users').update({ gold: (user.gold || 0) + salaries.headOfStateGold }).eq('id', nation.leaderUserId);
             currentReserve -= salaries.headOfStateGold;
             console.log(`[Salaries] Paid ${salaries.headOfStateGold} gold to HOS of ${nation.id}`);
           }
        } else {
           console.warn(`[Salaries] Nation ${nation.id} insufficient gold for HOS salary`);
        }
      }

      // Pay Ministers
      const { data: ministers } = await supabase
        .from('ministers')
        .select(`
          userId,
          user:users(id, gold)
        `)
        .eq('stateId', nation.id)
        .eq('status', 'ACTIVE');

      if (ministers && ministers.length > 0 && salaries.ministerGold > 0) {
        for (const m of ministers) {
          if (currentReserve >= salaries.ministerGold && (m as any).user) {
            const userGold = (m as any).user.gold || 0;
            await supabase.from('users').update({ gold: userGold + salaries.ministerGold }).eq('id', m.userId);
            currentReserve -= salaries.ministerGold;
            console.log(`[Salaries] Paid ${salaries.ministerGold} gold to Minister ${m.userId} of ${nation.id}`);
          }
        }
      }

      // Update remaining nation reserve
      if (currentReserve !== nation.gold_reserve) {
        await supabase.from('nations').update({ gold_reserve: currentReserve }).eq('id', nation.id);
      }
    }
    console.log("[Salaries] Daily payout complete.");
  } catch (err) {
    console.error("[Salaries] Error in payoutStateSalaries:", err);
  }
}

// ── Daily Reset Cron (resource extraction) ──────────────────────
async function dailyResourceReset() {
  try {
    console.log("[ResourceReset] Running daily resource extraction reset...");
    // Reset daily_extracted to 0 for all region_resources
    const { error } = await supabase
      .from('region_resources')
      .update({ dailyExtracted: 0, updatedAt: new Date().toISOString() })
      .gte('dailyExtracted', 0); // matches all rows

    if (error) console.error("[ResourceReset] Error resetting daily extracted:", error);
    else console.log("[ResourceReset] Daily extracted reset complete.");

    // Expire old deep explorations
    const nowStr = new Date().toISOString();
    await supabase
      .from('deep_explorations')
      .update({ isActive: false })
      .eq('isActive', true)
      .lt('endsAt', nowStr);

    // Reset regional autonomy daily extraction counters for all regions
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { error: resetErr } = await supabase.from('regions').update({
      dailyExtractedGold: 0,
      dailyExtractedOil: 0,
      dailyExtractedMinerals: 0,
      dailyExtractedUranium: 0,
      dailyExtractedDiamonds: 0,
      nextExtractionResetAt: tomorrow,
    }).neq('id', ''); // matches all rows with non-empty id (i.e., all regions)
    if (resetErr) console.error("[ResourceReset] Error resetting regional extraction:", resetErr);
    else console.log("[ResourceReset] Regional extraction counters reset.");

    // Pay salaries at daily reset
    await payoutStateSalaries();

  } catch (err) {
    console.error("[ResourceReset] Error in daily reset:", err);
  }
}

// ══════════════════════════════════════════════════════════════════

app.get("/api/leaderboard", authenticate, async (req, res) => {
  const { data: leaders, error } = await supabase
    .from('users')
    .select('username, level, money')
    .order('level', { ascending: false })
    .limit(10);

  if (error) return res.status(500).json({ error: error.message });
  res.json(leaders);
});

// ══════════════════════════════════════════════════════════════════
// REGIONAL AUTONOMY – API Endpoints
// ══════════════════════════════════════════════════════════════════

// GET region autonomy details (buildings, indices, energy, economy, military)
app.get("/api/regions/:id/autonomy", authenticate, async (req: any, res) => {
  try {
    const regionId = (req.params.id || '').toUpperCase();
    const { data: region, error } = await supabase
      .from('regions')
      .select('*, governor:users!governorPlayerId(username)')
      .eq('id', regionId)
      .single();
    if (error || !region) return res.status(404).json({ error: "Regione non trovata" });

    const buildings = await getRegionBuildings(regionId);
    const indices = calculateRegionalIndices(buildings);
    const energy = calculateEnergyStatus(buildings);
    const militaryStats = calculateMilitaryStats(buildings);

    // State energy compensation
    const stateCompensation = energy.isDeficit
      ? await getStateEnergyCompensation(regionId, region.nation_id)
      : 0;
    const netEfficiency = energy.efficiency + Math.min(stateCompensation, Math.abs(energy.efficiency));

    // Budget transactions
    const { data: transactions } = await supabase
      .from('regional_budget_transactions')
      .select('*')
      .eq('regionId', regionId)
      .order('createdAt', { ascending: false })
      .limit(50);

    // Autonomy history
    const { data: history } = await supabase
      .from('autonomy_history')
      .select('*')
      .eq('regionId', regionId)
      .order('createdAt', { ascending: false })
      .limit(20);

    // Governor name
    const governorName = region.governor?.username || null;

    // Pollution malus
    const pollutionMalus = (region.pollution || 0) * AUTONOMY_CONFIG.POLLUTION_MALUS_PER_POINT;
    const effectiveHealthIndex = Math.max(0, indices.healthIndex * (1 - pollutionMalus / 100));

    // Energy deficit malus
    const energyDeficitMalus = netEfficiency < 0 ? AUTONOMY_CONFIG.ENERGY_DEFICIT_MALUS * Math.abs(netEfficiency) : 0;

    res.json({
      region: {
        id: region.id,
        name: region.name,
        isCapital: region.isCapital || false,
        isAutonomous: region.isAutonomous || false,
        isBorderRegion: region.isBorderRegion || false,
        governorPlayerId: region.governorPlayerId,
        governorName,
        regionalParliamentEnabled: region.regionalParliamentEnabled || false,
        regionalBudget: region.regionalBudget || 0,
        nationalProfitSharePercent: region.nationalProfitSharePercent ?? 100,
        regionalProfitSharePercent: region.regionalProfitSharePercent ?? 0,
        workerTaxPercent: region.workerTaxPercent ?? 10,
        marketTaxRate: region.marketTaxRate ?? 10,
        industryTaxPercent: region.industryTaxPercent ?? 10,
        pollution: region.pollution || 0,
        autonomyGrantedAt: region.autonomyGrantedAt,
        autonomyRevokedAt: region.autonomyRevokedAt,
      },
      buildings,
      indices: {
        ...indices,
        effectiveHealthIndex,
      },
      effects: calculateIndexEffects(indices),
      energy: {
        ...energy,
        stateCompensation,
        netEfficiency,
      },
      militaryStats,
      pollutionMalus,
      energyDeficitMalus,
      extraction: {
        gold: { limit: region.dailyExtractionLimitGold ?? 2500, extracted: region.dailyExtractedGold ?? 0, remaining: Math.max(0, (region.dailyExtractionLimitGold ?? 2500) - (region.dailyExtractedGold ?? 0)) },
        oil: { limit: region.dailyExtractionLimitOil ?? 600, extracted: region.dailyExtractedOil ?? 0, remaining: Math.max(0, (region.dailyExtractionLimitOil ?? 600) - (region.dailyExtractedOil ?? 0)) },
        minerals: { limit: region.dailyExtractionLimitMinerals ?? 500, extracted: region.dailyExtractedMinerals ?? 0, remaining: Math.max(0, (region.dailyExtractionLimitMinerals ?? 500) - (region.dailyExtractedMinerals ?? 0)) },
        uranium: { limit: region.dailyExtractionLimitUranium ?? 60, extracted: region.dailyExtractedUranium ?? 0, remaining: Math.max(0, (region.dailyExtractionLimitUranium ?? 60) - (region.dailyExtractedUranium ?? 0)) },
        diamonds: { limit: region.dailyExtractionLimitDiamonds ?? 75, extracted: region.dailyExtractedDiamonds ?? 0, remaining: Math.max(0, (region.dailyExtractionLimitDiamonds ?? 75) - (region.dailyExtractedDiamonds ?? 0)) },
        nextResetAt: region.nextExtractionResetAt,
      },
      transactions: transactions || [],
      history: history || [],
    });
  } catch (err: any) {
    console.error("Error fetching region autonomy:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET regional buildings
app.get("/api/regions/:id/buildings", authenticate, async (req: any, res) => {
  try {
    const regionId = (req.params.id || '').toUpperCase();
    const buildings = await getRegionBuildings(regionId);
    const buildingDetails = ALL_BUILDING_TYPES.map(bt => ({
      type: bt,
      label: BUILDING_LABELS[bt] || bt,
      quantity: buildings[bt] || 0,
      cost: AUTONOMY_CONFIG.BUILDING_COSTS[bt] || 0,
      energyConsumption: AUTONOMY_CONFIG.ENERGY_CONSUMPTION[bt] || 0,
    }));
    res.json({ buildings: buildingDetails });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET regional energy dashboard
app.get("/api/regions/:id/energy", authenticate, async (req: any, res) => {
  try {
    const regionId = (req.params.id || '').toUpperCase();
    const { data: region } = await supabase.from('regions').select('nation_id, energyGeneration, energyConsumption, energyEfficiency').eq('id', regionId).single();
    if (!region) return res.status(404).json({ error: "Regione non trovata" });

    const buildings = await getRegionBuildings(regionId);
    const energy = calculateEnergyStatus(buildings);
    const stateCompensation = energy.isDeficit
      ? await getStateEnergyCompensation(regionId, region.nation_id)
      : 0;
    const netEfficiency = energy.efficiency + Math.min(stateCompensation, Math.abs(energy.efficiency));

    // Per-building energy breakdown
    const breakdown = ALL_BUILDING_TYPES.map(bt => ({
      type: bt,
      label: BUILDING_LABELS[bt] || bt,
      quantity: buildings[bt] || 0,
      consumption: (AUTONOMY_CONFIG.ENERGY_CONSUMPTION[bt] || 0) * (buildings[bt] || 0),
      production: bt === 'power_plant' ? (buildings[bt] || 0) * AUTONOMY_CONFIG.ENERGY_PRODUCTION_PER_PLANT : 0,
    }));

    res.json({
      ...energy,
      stateCompensation,
      netEfficiency,
      breakdown,
      config: {
        productionPerPlant: AUTONOMY_CONFIG.ENERGY_PRODUCTION_PER_PLANT,
        buildingsPerPlant: AUTONOMY_CONFIG.BUILDINGS_PER_PLANT,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET regional economy dashboard
app.get("/api/regions/:id/economy", authenticate, async (req: any, res) => {
  try {
    const regionId = (req.params.id || '').toUpperCase();
    const { data: region } = await supabase.from('regions').select('*').eq('id', regionId).single();
    if (!region) return res.status(404).json({ error: "Regione non trovata" });

    const { data: transactions } = await supabase
      .from('regional_budget_transactions')
      .select('*')
      .eq('regionId', regionId)
      .order('createdAt', { ascending: false })
      .limit(100);

    // Aggregate income/expenses
    let totalIncome = 0, totalExpense = 0;
    for (const tx of transactions || []) {
      if ((tx.moneyDelta || 0) > 0) totalIncome += tx.moneyDelta;
      else totalExpense += Math.abs(tx.moneyDelta || 0);
    }

    res.json({
      regionalBudget: region.regionalBudget || 0,
      workerTaxPercent: region.workerTaxPercent ?? 10,
      marketTaxRate: region.marketTaxRate ?? 10,
      industryTaxPercent: region.industryTaxPercent ?? 10,
      nationalProfitSharePercent: region.nationalProfitSharePercent ?? 100,
      regionalProfitSharePercent: region.regionalProfitSharePercent ?? 0,
      isAutonomous: region.isAutonomous || false,
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
      transactions: transactions || [],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/regions/:id/indexes ─────────────────────────────────
// Returns the full Regional Indexes panel data: levels, progress,
// primary building counts, gameplay effects, and classification.
// This is the primary endpoint for the Regional Indexes UI.
app.get("/api/regions/:id/indexes", authenticate, async (req: any, res) => {
  try {
    const regionId = (req.params.id || '').toUpperCase();
    const { data: region, error } = await supabase
      .from('regions')
      .select('id, name, pollution, pollutionModifier, warModifier, crisisModifier')
      .eq('id', regionId)
      .single();
    if (error || !region) return res.status(404).json({ error: "Regione non trovata" });

    const buildings = await getRegionBuildings(regionId);
    const indices   = calculateRegionalIndices(buildings);
    const effects   = calculateIndexEffects(indices);

    // Pollution malus applied to effective health index
    const pollutionMalus       = (region.pollution || 0) * AUTONOMY_CONFIG.POLLUTION_MALUS_PER_POINT;
    const externalModifiers    = {
      pollution: region.pollution || 0,
      pollutionMalus,
      pollutionModifier: region.pollutionModifier || 0,
      warModifier:       region.warModifier       || 0,
      crisisModifier:    region.crisisModifier     || 0,
    };
    const effectiveHealthIndex = Math.max(0, indices.healthIndex * (1 - pollutionMalus / 100));

    // Build the per-index metadata used by the UI
    const indexMeta = [
      {
        key: 'health',
        label: 'Salute',
        icon: '❤️',
        color: '#ef4444',
        source: 'Ospedali',
        buildingType: 'hospital',
        effect: 'Riduce il costo energetico delle azioni (+1% riduzione per livello)',
        level:          indices.healthIndex,
        effectiveLevel: effectiveHealthIndex,
        progress:       indices.healthProgress,
        currentScore:   indices.primaryCounts.health,
        nextThreshold:  indices.nextThresholds.health,
        thresholds:     AUTONOMY_CONFIG.INDEX_THRESHOLDS.health,
      },
      {
        key: 'military',
        label: 'Militare',
        icon: '🛡️',
        color: '#f97316',
        source: 'Basi Militari (+ Accademie, Missili, Aeroporti, Porti)',
        buildingType: 'military_base',
        effect: 'Aumenta il danno in guerra e la resistenza in difesa (+3% attacco, +2% difesa per livello)',
        level:         indices.militaryIndex,
        progress:      indices.militaryProgress,
        currentScore:  indices.primaryCounts.military,
        weightedScore: indices.rawScores.military,
        nextThreshold: indices.nextThresholds.military,
        thresholds:    AUTONOMY_CONFIG.INDEX_THRESHOLDS.military,
      },
      {
        key: 'education',
        label: 'Istruzione',
        icon: '📚',
        color: '#6366f1',
        source: 'Scuole',
        buildingType: 'school',
        effect: "Aumenta l'XP guadagnata da ogni azione (+2% per livello)",
        level:         indices.educationIndex,
        progress:      indices.educationProgress,
        currentScore:  indices.primaryCounts.education,
        nextThreshold: indices.nextThresholds.education,
        thresholds:    AUTONOMY_CONFIG.INDEX_THRESHOLDS.education,
      },
      {
        key: 'development',
        label: 'Sviluppo',
        icon: '🏘️',
        color: '#10b981',
        source: 'Fondi Immobiliari',
        buildingType: 'real_estate_fund',
        effect: 'Stabilità politica, riduce rischio di crisi. Aumenta gli stipendi istituzionali (+5% per livello)',
        level:         indices.developmentIndex,
        progress:      indices.developmentProgress,
        currentScore:  indices.primaryCounts.development,
        nextThreshold: indices.nextThresholds.development,
        thresholds:    AUTONOMY_CONFIG.INDEX_THRESHOLDS.development,
      },
    ];

    res.json({
      regionId:  region.id,
      regionName: region.name,
      indices,
      effects,
      indexMeta,
      externalModifiers,
      classification: {
        value: indices.regionalClassification,
        label: indices.regionalClassification === 'developed'
          ? '🟢 Regione Sviluppata'
          : indices.regionalClassification === 'developing'
            ? '🟡 Regione in Via di Sviluppo'
            : '🔴 Regione Arretrata',
        isAtRisk: effects.isAtRisk,
      },
      thresholds: AUTONOMY_CONFIG.INDEX_THRESHOLDS,
    });
  } catch (err: any) {
    console.error("Error fetching region indexes:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST assign governor (direct action for leaders in dictatorships)
app.post("/api/regions/:id/governor", authenticate, async (req: any, res) => {
  try {
    const regionId = (req.params.id || '').toUpperCase();
    const { governorUserId } = req.body;
    if (!governorUserId) return res.status(400).json({ error: "ID governatore obbligatorio." });

    const { data: region } = await supabase.from('regions').select('*').eq('id', regionId).single();
    if (!region) return res.status(404).json({ error: "Regione non trovata" });
    if (!region.isAutonomous) return res.status(400).json({ error: "La regione non è autonoma." });

    // Check permission: must be leader of the parent state or dictator
    const { data: parentRegion } = await supabase.from('regions')
      .select('leaderUserId, governmentForm')
      .eq('nation_id', region.nation_id)
      .eq('isCapital', true)
      .single();

    const isLeader = parentRegion?.leaderUserId === req.user.id;
    const isDictator = isLeader && ['DICTATORSHIP', 'ONE_PARTY_SYSTEM', 'EXECUTIVE_MONARCHY'].includes(parentRegion?.governmentForm);

    if (!isDictator) return res.status(403).json({ error: "Solo il leader di un regime autocratico può assegnare direttamente un governatore." });

    const { data: user } = await supabase.from('users').select('id, username').eq('id', governorUserId).single();
    if (!user) return res.status(404).json({ error: "Utente non trovato." });

    await supabase.from('regions').update({ governorPlayerId: governorUserId }).eq('id', regionId);
    res.json({ success: true, governorName: user.username });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST remove governor
app.delete("/api/regions/:id/governor", authenticate, async (req: any, res) => {
  try {
    const regionId = (req.params.id || '').toUpperCase();
    const { data: region } = await supabase.from('regions').select('*, parentNation:regions!nation_id(leaderUserId, governmentForm)').eq('id', regionId).single();
    if (!region) return res.status(404).json({ error: "Regione non trovata" });
    if (!region.isAutonomous) return res.status(400).json({ error: "La regione non è autonoma." });

    // Must be national leader
    const { data: capitalRegion } = await supabase.from('regions')
      .select('leaderUserId')
      .eq('nation_id', region.nation_id)
      .eq('isCapital', true)
      .single();
    if (capitalRegion?.leaderUserId !== req.user.id) {
      return res.status(403).json({ error: "Solo il leader nazionale può rimuovere un governatore." });
    }

    await supabase.from('regions').update({ governorPlayerId: null }).eq('id', regionId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET regional parliament
app.get("/api/regions/:id/parliament", authenticate, async (req: any, res) => {
  try {
    const regionId = (req.params.id || '').toUpperCase();
    const { data: region } = await supabase.from('regions').select('regionalParliamentEnabled, isAutonomous').eq('id', regionId).single();
    if (!region) return res.status(404).json({ error: "Regione non trovata" });
    if (!region.isAutonomous || !region.regionalParliamentEnabled) {
      return res.json({ enabled: false, members: [] });
    }

    const { data: members } = await supabase
      .from('regional_parliament_members')
      .select('*, user:users!userId(username, level)')
      .eq('regionId', regionId);

    res.json({
      enabled: true,
      members: (members || []).map((m: any) => ({
        userId: m.userId,
        username: m.user?.username || 'Sconosciuto',
        level: m.user?.level || 1,
        electedAt: m.electedAt,
        termEndsAt: m.termEndsAt,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET regional laws
app.get("/api/regions/:id/laws", authenticate, async (req: any, res) => {
  try {
    const regionId = (req.params.id || '').toUpperCase();
    const { data: laws } = await supabase
      .from('regional_laws')
      .select('*, proposer:users!proposerId(username)')
      .eq('regionId', regionId)
      .order('createdAt', { ascending: false })
      .limit(50);

    const lawsWithVotes = await Promise.all((laws || []).map(async (l: any) => {
      const { data: votes } = await supabase.from('regional_law_votes').select('vote, voterId').eq('lawId', l.id);
      const yesVotes = (votes || []).filter((v: any) => v.vote === 'yes').length;
      const noVotes = (votes || []).filter((v: any) => v.vote === 'no').length;
      const myVote = (votes || []).find((v: any) => v.voterId === req.user.id)?.vote || null;
      return { ...l, proposerName: l.proposer?.username || 'Sconosciuto', yesVotes, noVotes, myVote };
    }));

    res.json({ laws: lawsWithVotes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET state-wide energy overview (all regions of a nation)
app.get("/api/nations/:nationId/energy", authenticate, async (req: any, res) => {
  try {
    const nationId = (req.params.nationId || '').toUpperCase();
    const { data: regions } = await supabase
      .from('regions')
      .select('id, name, isCapital, isAutonomous, energyGeneration, energyConsumption, energyEfficiency')
      .eq('nation_id', nationId);

    if (!regions || regions.length === 0) return res.status(404).json({ error: "Nazione non trovata" });

    let totalGeneration = 0, totalConsumption = 0;
    const regionDetails = regions.map((r: any) => {
      const gen = r.energyGeneration || 0;
      const cons = r.energyConsumption || 0;
      totalGeneration += gen;
      totalConsumption += cons;
      return { id: r.id, name: r.name, isCapital: r.isCapital, isAutonomous: r.isAutonomous, generation: gen, consumption: cons, efficiency: gen - cons };
    });

    res.json({
      totalGeneration,
      totalConsumption,
      totalEfficiency: totalGeneration - totalConsumption,
      regions: regionDetails,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
async function checkAndResolveElections() {
  const { data: regions } = await supabase.from('regions').select('id');
  if (!regions) return;

  const now = Date.now();
  const nowIso = new Date().toISOString();
  const electionDuration = 3 * 24 * 60 * 60 * 1000; // 3 days

  const { data: activeElections } = await supabase.from('elections').select('*').eq('status', 'active');
  const activeElectionByRegion = new Map(activeElections?.map((e: any) => [e.regionId, e]) || []);

  for (const r of regions) {
    const activeElection = activeElectionByRegion.get(r.id);

    if (!activeElection) {
      await supabase.from('elections').insert({
        id: generateSecureId(9),
        regionId: r.id,
        status: 'active',
        createdAt: nowIso,
        closesAt: new Date(now + electionDuration).toISOString()
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
    // 1. Resolve expired wars
    const { data: expiredWars } = await supabase
      .from('wars')
      .select('*')
      .eq('status', 'active')
      .lt('endsAt', new Date().toISOString());

    if (expiredWars && expiredWars.length > 0) {
      for (const war of expiredWars) {
        try {
          const attackerTotal = (war.attackerScore || 0) + (war.phase1AttackerScore || 0);
          const defenderTotal = (war.defenderScore || 0) + (war.phase1DefenderScore || 0);
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

          // Territory transfer
          if (effects.territoryTransfer && winner === 'attacker' && war.defenderRegionId && war.attackerRegionId) {
            const { data: attackerRegion } = await supabase.from('regions')
              .select('ownerUserId, leaderUserId, nation_id, stateColor, governmentForm, leaderTitle, dictatorship')
              .eq('id', war.attackerRegionId)
              .single();

            if (attackerRegion) {
              const conquestLeader = attackerRegion.leaderUserId || attackerRegion.ownerUserId;
              await supabase.from('regions').update({
                ownerUserId: conquestLeader,
                leaderUserId: conquestLeader,
                nation_id: attackerRegion.nation_id || war.attackerCountryIso2,
                stateColor: attackerRegion.stateColor,
                governmentForm: attackerRegion.governmentForm,
                leaderTitle: attackerRegion.leaderTitle,
                dictatorship: attackerRegion.dictatorship,
                stability: 30,
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

    // 2. Handle naval phase transitions
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
            // Phase 2: land war with bonus
            const bonusDamage = (war.phase1AttackerScore || 0) - (war.phase1DefenderScore || 0);
            const newEndsAt = new Date(now + GAME_CONFIG.WAR_DURATION_MS).toISOString();

            await supabase.from('wars').update({
              navalPhase: 2,
              attackerScore: bonusDamage,
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
                bonusDamage,
              },
            });

            console.log(`[WAR] Naval war ${war.id} → Phase 2 (attacker won phase 1, bonus: ${bonusDamage})`);
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

    // 3. Process auto-attacks
    const { data: activeAutoAttacks } = await supabase
      .from('war_auto_attacks')
      .select('*')
      .eq('isActive', true);

    if (activeAutoAttacks && activeAutoAttacks.length > 0) {
      for (const aa of activeAutoAttacks) {
        if (shouldAutoAttackFire(aa.autoType, aa.lastFiredAt, aa.activatedAt)) {
          // Check war is still active
          const { data: war } = await supabase.from('wars').select('status').eq('id', aa.warId).single();
          if (!war || war.status !== 'active') {
            await supabase.from('war_auto_attacks').update({ isActive: false }).eq('id', aa.id);
            continue;
          }

          // Fire auto-attack via internal deploy logic
          try {
            const { data: autoUser } = await supabase.from('users').select('*').eq('id', aa.userId).single();
            if (!autoUser) continue;

            const baseDmg = TROOP_BASE_DAMAGE[aa.troopType as TroopType] || 10;
            const energyCost = TROOP_ENERGY_COST[aa.troopType as TroopType] || 10;

            if (aa.autoType === 'hourly') {
              // Hourly: free (no energy cost)
            } else {
              // Maximum: costs energy — skip if insufficient
              if (autoUser.energy < energyCost) continue;
              await supabase.from('users').update({
                energy: autoUser.energy - energyCost,
              }).eq('id', aa.userId);
            }

            const scoreField = aa.side === 'attacker' ? 'attackerScore' : 'defenderScore';
            const { data: currentWar } = await supabase.from('wars').select(scoreField).eq('id', aa.warId).single();

            await supabase.from('wars').update({
              [scoreField]: (currentWar?.[scoreField] || 0) + baseDmg,
              updatedAt: new Date().toISOString(),
            }).eq('id', aa.warId);

            await supabase.from('war_auto_attacks').update({
              lastFiredAt: new Date().toISOString(),
            }).eq('id', aa.id);
          } catch (_e) { /* skip failed auto-attacks */ }

          // Check expiration
          if (aa.expiresAt && new Date(aa.expiresAt).getTime() <= Date.now()) {
            await supabase.from('war_auto_attacks').update({ isActive: false }).eq('id', aa.id);
          }
        }
      }
    }
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

// GET /api/daily/missions – Fetch today's missions for the authenticated player
app.get("/api/daily/missions", authenticate, async (req: any, res) => {
  try {
    const user = req.user;
    const today = new Date().toISOString().slice(0, 10);

    const missions = await ensureDailyMissions(user.id, user.level || 1);

    // Check bonus claim status
    const { data: bonusClaim } = await supabase
      .from('daily_mission_bonus_claims')
      .select('id')
      .eq('user_id', user.id)
      .eq('claim_date', today)
      .maybeSingle();

    return res.json({
      missions,
      resetDate: today,
      bonusClaimed: !!bonusClaim,
      bonusReward: DAILY_GAMEPLAY_CONFIG.DAILY_MISSIONS_BONUS,
    });
  } catch (err: any) {
    console.error('[DailyMissions] GET error:', err);
    return res.status(500).json({ error: 'Errore nel recupero missioni giornaliere' });
  }
});

// POST /api/daily/missions/claim/:id – Claim reward for a completed mission
app.post("/api/daily/missions/claim/:id", authenticate, async (req: any, res) => {
  try {
    const user = req.user;
    const missionId = req.params.id;

    const claimResult = await dailyRewardService.claimMissionReward(user.id, missionId);

    if (claimResult.type !== 'success') {
      if (claimResult.type === 'validation_error') {
        console.warn('[DailyMissions][claim][validation_error]', { userId: user.id, missionId, message: claimResult.message });
      } else {
        console.error('[DailyMissions][claim][system_error]', { userId: user.id, missionId, message: claimResult.message });
      }
      const http = mapServiceResultToHttp(claimResult);
      return res.status(http.statusCode).json(http.body);
    }

    if (!isDailyMissionClaimSuccess(claimResult.payload)) {
      console.error('[ContractViolation] POST /api/daily/missions/claim/:id unexpected payload shape', {
        userId: user.id,
        missionId,
      });
    }

    const http = mapServiceResultToHttp(claimResult);
    return res.status(http.statusCode).json(http.body);
  } catch (err: any) {
    console.error('[DailyMissions] Claim error:', err);
    return res.status(500).json({ error: 'Errore nel riscatto della missione' });
  }
});

// POST /api/daily/missions/claim-bonus – Claim the all-complete bonus
app.post("/api/daily/missions/claim-bonus", authenticate, async (req: any, res) => {
  try {
    const user = req.user;
    const bonusResult = await dailyRewardService.claimDailyBonus(user.id);

    if (bonusResult.type !== 'success') {
      if (bonusResult.type === 'validation_error') {
        console.warn('[DailyMissions][claim-bonus][validation_error]', { userId: user.id, message: bonusResult.message });
      } else {
        console.error('[DailyMissions][claim-bonus][system_error]', { userId: user.id, message: bonusResult.message });
      }
      const http = mapServiceResultToHttp(bonusResult);
      return res.status(http.statusCode).json(http.body);
    }

    if (!isDailyBonusClaimSuccess(bonusResult.payload)) {
      console.error('[ContractViolation] POST /api/daily/missions/claim-bonus unexpected payload shape', {
        userId: user.id,
      });
    }

    const http = mapServiceResultToHttp(bonusResult);
    return res.status(http.statusCode).json(http.body);
  } catch (err: any) {
    console.error('[DailyMissions] Bonus claim error:', err);
    return res.status(500).json({ error: 'Errore nel riscatto del bonus' });
  }
});

// Vite middleware for development
async function startServer() {
  checkAndResolveElections();
  checkAndResolveLeaderElections();
  checkAndResolveLaws();
  checkAndResolveWars();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  }).on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`FATAL ERROR: Port ${PORT} is already in use.`);
    } else {
      console.error("FATAL ERROR: Server failed to start:", err);
    }
    process.exit(1);
  });

  // Global Budget Tick (every 60 seconds)
  setInterval(() => {
    try {
      budgetMaintenanceTick();
    } catch (e) {
      console.error("Budget tick error:", e);
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
    checkAndResolveLaws();
    checkAndResolveWars();
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
