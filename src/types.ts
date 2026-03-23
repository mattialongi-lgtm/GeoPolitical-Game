/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  id: string;
  username: string;
  money: number; // Acts as Cash
  gold: number;  // Premium currency
  energy: number;
  regionId: string; // ISO code (Physical location)
  residenceId: string; // ISO code (Legal residence)
  workPermitId: string | null; // ISO code (Work permit for a single foreign region)
  originalNation: string; // ISO code (Functional, +10% dmg bonus)
  displayedNation: string; // ISO code (Cosmetic, free rename)
  lastOriginalNationChange: number; // Timestamp
  lastEnergyUpdate: number;
  xp: number;
  level: number;
  boosters?: Record<string, { expiresAt: number; lastActivatedAt: number; isGold: boolean }>;
  energyDrinks: number;
  lastEnergyDrink: number;
  warMedals: number;
  lastMedalClaim: number;
  travelingTo: string | null; // ISO code of destination while traveling
  travelingUntil: number | null; // Timestamp when travel completes
  partyId?: string;
  partyName?: string;
  partyLogo?: string;
  perks: Record<string, number>;
  maxEnergy: number;
  perkUpgrades?: Record<string, any>;
  avatarData?: string;
  dailyExtracted?: number;
  dailyLimit?: number;
  oilExp?: number;
  mineralsExp?: number;
  uraniumExp?: number;
  diamondsExp?: number;
}

export interface Perk {
  id: string;
  name: string;
  description: string;
  level: number;
  baseEffect: number;
}

export interface Region {
  id: string; // ISO Code
  name: string;
  population: number;
  stability: number; // 1-10
  treasury: number;
  economyLevel: number; // 1-10
  health: number; // 1-10
  education: number; // 1-10
  military: number; // 1-10
  ownerUserId: string | null;
  ownerName: string | null;
  leaderUserId: string | null;
  leaderName: string | null;
  leaderLevel: number | null;
  stateColor: string | null;
  stateHymn: string | null;
  factoriesCount: number;
  workRestrictions: boolean;
  residencePolicy: 'open' | 'closed';
  governmentForm: 'PARLIAMENTARY_REPUBLIC' | 'PRESIDENTIAL_REPUBLIC' | 'DOMINANT_PARTY' | 'DICTATORSHIP' | 'ONE_PARTY_SYSTEM' | 'EXECUTIVE_MONARCHY';
  economicAdviserId: string | null;
  foreignMinisterId: string | null;
  dictatorshipAttempts: number;
  // Autonomy fields
  isCapital?: boolean;
  isAutonomous?: boolean;
  isBorderRegion?: boolean;
  governorPlayerId?: string | null;
  governorName?: string | null;
  regionalParliamentEnabled?: boolean;
  regionalBudget?: number;
  nationalProfitSharePercent?: number;
  regionalProfitSharePercent?: number;
  workerTaxPercent?: number;
  industryTaxPercent?: number;
  healthIndex?: number;
  militaryIndex?: number;
  educationIndex?: number;
  developmentIndex?: number;
  pollution?: number;
  energyGeneration?: number;
  energyConsumption?: number;
  energyEfficiency?: number;
  dailyExtractionLimitGold?: number;
  dailyExtractionLimitOil?: number;
  dailyExtractionLimitMinerals?: number;
  dailyExtractionLimitUranium?: number;
  dailyExtractionLimitDiamonds?: number;
  dailyExtractedGold?: number;
  dailyExtractedOil?: number;
  dailyExtractedMinerals?: number;
  dailyExtractedUranium?: number;
  dailyExtractedDiamonds?: number;
  nextExtractionResetAt?: string;
  autonomyGrantedAt?: string;
  autonomyRevokedAt?: string;
  // Game Stats (legacy or from Firestore)
  power?: number;
  economy?: number;
  resources?: { type: string, amount: number }[] | any;
  taxRate?: number;
  marketTaxRate?: number;
}

// ── Regional Autonomy Types ──────────────────────────────
export type BuildingType =
  | 'hospital'
  | 'military_base'
  | 'school'
  | 'military_academy'
  | 'missile_system'
  | 'airport'
  | 'naval_port'
  | 'space_port'
  | 'real_estate_fund'
  | 'power_plant';

export interface RegionalBuilding {
  id: string;
  regionId: string;
  buildingType: BuildingType;
  quantity: number;
  level: number;
  createdAt: string;
  updatedAt: string;
}

export interface EnergyStatus {
  generation: number;
  consumption: number;
  efficiency: number;
  surplusPowerPlants: number;
  supportableBuildings: number;
  excessBuildings: number;
  isDeficit: boolean;
  stateCompensation: number;
  netEfficiency: number;
}

export interface RegionalEconomy {
  workerTaxIncome: number;
  marketTaxIncome: number;
  industryTaxIncome: number;
  totalIncome: number;
  regionalShare: number;
  nationalShare: number;
  regionalBudget: number;
}

export interface MilitaryStats {
  initialAttackDamage: number;
  initialDefensePoints: number;
  academies: number;
  bases: number;
  hospitals: number;
  schools: number;
  missileSystems: number;
  airports: number;
  navalPorts: number;
  spacePorts: number;
  powerPlants: number;
}

export interface AutonomyProposal {
  id: string;
  regionId: string;
  proposerId: string;
  proposerName: string;
  type: 'grant_autonomy' | 'revoke_autonomy' | 'change_profit_share' | 'change_regional_tax';
  params: Record<string, any>;
  status: 'pending' | 'passed' | 'rejected' | 'withdrawn';
  createdAt: string;
  expiresAt: string;
  yesVotes?: number;
  noVotes?: number;
  myVote?: string | null;
}

export interface Factory {
  id: string;
  name: string;
  type: string;
  payoutMoney: number;
  energyCost: number;
  cooldownSec: number;
  minLevel: number;
  level: number;
  budget: number;
  payMode: 'salary' | 'resource';
  ownerUserId: string;
  regionId: string;
  currentStorage: number;
  isActive: boolean;
  totalWorkerCount: number;
  totalProduction: number;
  totalOwnerProfit: number;
  totalTaxesPaid: number;
  listedForSale: boolean;
  salePrice: number;
  ownerName?: string;
  remainingCooldown?: number;
}

export interface Application {
  id: string;
  userId: string;
  username: string;
  regionId: string;
  type: 'residence' | 'work_permit';
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
}

export type ArticleBlockType = 'text' | 'image' | 'video' | 'link';

export interface ArticleBlock {
  id: string;
  type: ArticleBlockType;
  content: string;
  metadata?: {
    caption?: string;
    anchorText?: string;
    title?: string;
  };
}

export interface Newspaper {
  id: string;
  name: string;
  description: string;
  logoUrl?: string;
  ownerId: string;
  authorName?: string;
  createdAt: string;
}

export type NewspaperRole = 'owner' | 'editor' | 'writer';

export interface NewspaperMember {
  id: string;
  newspaperId: string;
  userId: string;
  role: NewspaperRole;
  joinedAt: string;
}

export interface Article {
  id: string;
  authorId: string;
  authorName: string;
  newspaperId?: string | null;
  newspaperName?: string | null;
  newspaperLogo?: string | null;
  title: string;
  content: string; // Used as summary or for legacy support
  blocks?: ArticleBlock[];
  section: 'global' | 'local';
  createdAt: number;
  updatedAt: number;
  likeCount: number;
}

export interface War {
  id: string;
  attackerCountryIso2: string;
  defenderCountryIso2: string;
  attackerUserId: string;
  defenderUserId: string | null;
  status: 'active' | 'ended';
  startedAt: number;
  endsAt: number;
  attackerScore: number;
  defenderScore: number;
}

// === WAR SYSTEM TYPES ===

export type WarType = 'training' | 'land' | 'naval' | 'space' | 'lunar' | 'revolution' | 'coup';
export type TroopType = 'tank' | 'aircraft' | 'missile' | 'bomber' | 'battleship' | 'lunar_tank' | 'space_station';
export type WarSide = 'attacker' | 'defender';
export type AutoAttackType = 'hourly' | 'maximum';
export type AgreementType = 'bilateral' | 'unilateral';
export type DepartmentType = 'land' | 'naval' | 'space';

export interface WarFull extends War {
  warType: WarType;
  attackerRegionId: string | null;
  defenderRegionId: string | null;
  navalPhase: number;
  phase1AttackerScore: number;
  phase1DefenderScore: number;
  initialAttackDamage: number;
  initialDefenseDamage: number;
  distancePenalty: number;
  resolvedAt: string | null;
  winnerId: WarSide | null;
  lootValue: number;
  chainWarId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WarParticipant {
  id: string;
  warId: string;
  userId: string;
  side: WarSide;
  totalDamage: number;
  troopsDeployed: Record<TroopType, number>;
  joinedAt: string;
}

export interface WarDeployment {
  id: string;
  warId: string;
  userId: string;
  side: WarSide;
  troopType: TroopType;
  quantity: number;
  baseDamage: number;
  finalDamage: number;
  bonuses: DamageBreakdown;
  deployedAt: string;
}

export interface WarAutoAttack {
  id: string;
  warId: string;
  userId: string;
  side: WarSide;
  autoType: AutoAttackType;
  troopType: TroopType;
  isActive: boolean;
  lastFiredAt: string | null;
  activatedAt: string;
  expiresAt: string | null;
}

export interface Revolution {
  id: string;
  regionId: string;
  initiatorIds: string[];
  goldCost: number;
  status: 'active' | 'succeeded' | 'failed' | 'expired';
  warId: string | null;
  cooldownUntil: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface Coup {
  id: string;
  regionId: string;
  initiatorIds: string[];
  status: 'active' | 'succeeded' | 'failed';
  warId: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface WarMilitaryAgreement {
  id: string;
  stateA: string;
  stateB: string;
  agreementType: AgreementType;
  initiatorState: string;
  status: 'pending' | 'active' | 'expired' | 'cancelled';
  createdAt: string;
  expiresAt: string | null;
  updatedAt: string;
}

export interface WarDepartment {
  id: string;
  stateId: string;
  departmentType: DepartmentType;
  level: number;
  bonusPercent: number;
  ranking: number;
  updatedAt: string;
}

export interface WarHistoryEntry {
  id: string;
  warId: string;
  eventType: 'war_started' | 'war_ended' | 'phase_change' | 'deployment' | 'resolution' | 'building_destroyed' | 'territory_transferred' | 'loot';
  eventData: Record<string, unknown>;
  createdAt: string;
}

export interface DamageBreakdown {
  baseDamage: number;
  quantity: number;
  militaryIndex: number;
  missileSystems: number;
  navalPorts: number;
  airports: number;
  academies: number;
  forza: number;
  nationBonus: number;
  education: number;
  resistance: number;
  level: number;
  distancePenalty: number;
  randomFactor: number;
  departmentBonus: number;
  patriotBonus: number;
  troopBaseDamage: number;
  finalDamage: number;
}

export interface WarCreationParams {
  attackerRegionId: string;
  defenderRegionId: string;
  warType: WarType;
  attackerUserId: string;
}

export interface DeployParams {
  warId: string;
  userId: string;
  side: WarSide;
  troopType: TroopType;
  quantity: number;
}

export interface WarResolution {
  warId: string;
  winner: WarSide;
  attackerTotal: number;
  defenderTotal: number;
  lootValue: number;
  status: 'ended';
}

export interface MarketOffer {
  id: string;
  sellerId: string;
  sellerName: string;
  itemId: string;
  quantity: number;
  price: number;
  regionId: string;
  taxRate: number;
  createdAt: number;
}

export interface InventoryItem {
  id?: string;
  ownerId: string; // userId or regionId
  itemId: string;
  quantity: number;
}

export const GAME_CONFIG = {
  ENERGY_MAX: 100,
  ENERGY_REGEN_RATE: 10, // per hour
  WORK_ENERGY_COST: 10,
  WORK_COOLDOWN: 60 * 1000,
  PROPAGANDA_ENERGY_COST: 15,
  PROPAGANDA_COOLDOWN: 120 * 1000,
  INVEST_MONEY_COST: 1000,
  INVEST_ENERGY_COST: 20,
  ATTACK_ENERGY_COST: 50,
  ATTACK_COOLDOWN: 300 * 1000,
  XP_PER_WORK: 10,
  XP_PER_PROPAGANDA: 15,
  XP_PER_ATTACK: 50,
  LEVEL_UP_BASE_XP: 100,
  LEVEL_UP_FACTOR: 1.5,
  ENERGY_DRINK_COST_GOLD: 10,
  ENERGY_DRINK_COOLDOWN: 10 * 60 * 1000, // 10 minutes
  MEDAL_CLAIM_COOLDOWN: 60 * 60 * 1000,  // 1 hour
  STORAGE_BASE_CAPACITY: 10000,
  MARKET_OFFER_COOLDOWN_MS: 5 * 60 * 1000, // 5 minutes
  MARKET_ANTI_ABUSE_PERCENTAGE: 1.10, // 110%
  // War System Config
  WAR_DURATION_MS: 24 * 60 * 60 * 1000,           // 24 hours
  WAR_NAVAL_PHASE_DURATION_MS: 24 * 60 * 60 * 1000, // 24h per phase
  WAR_DEPLOY_COOLDOWN_MS: 60 * 1000,               // 1 minute between deploys
  WAR_AUTO_HOURLY_INTERVAL_MS: 60 * 60 * 1000,     // 1 hour
  WAR_AUTO_MAX_INTERVAL_MS: 10 * 60 * 1000,        // 10 minutes
  WAR_AUTO_EXPIRE_MS: 24 * 60 * 60 * 1000,         // 24h
  WAR_DISTANCE_PENALTY_MAX: 0.999,                  // max 99.9%
  WAR_RANDOM_FACTOR: 0.125,                         // ±12.5%
  WAR_REVOLUTION_GOLD_COST: 50,
  WAR_REVOLUTION_MIN_PLAYERS: 3,
  WAR_REVOLUTION_COOLDOWN_MS: 4 * 24 * 60 * 60 * 1000, // 4 days
  WAR_REVOLUTION_BUILDING_PENALTY: 0.5,             // -50% buildings
  WAR_COUP_MIN_PLAYERS: 3,
  WAR_COUP_MAX_DEVELOPMENT: 1,                      // development must be 1
  WAR_NAVAL_MAX_DISTANCE_KM: 1000,
  WAR_LOOT_PERCENTAGE: 0.5,                         // 50% of building value
  WAR_DEPLOY_ENERGY_BASE: 10,
  WAR_MAX_DEPARTMENT_BONUS: 0.10,                   // +10% max
};

export const TROOP_BASE_DAMAGE: Record<TroopType, number> = {
  tank: 10,
  aircraft: 75,
  missile: 900,
  bomber: 800,
  battleship: 2000,
  lunar_tank: 2000,
  space_station: 5000,
};

export const TROOP_ENERGY_COST: Record<TroopType, number> = {
  tank: 5,
  aircraft: 15,
  missile: 30,
  bomber: 25,
  battleship: 40,
  lunar_tank: 35,
  space_station: 50,
};

export const TROOP_MONEY_COST: Record<TroopType, number> = {
  tank: 200,
  aircraft: 1500,
  missile: 5000,
  bomber: 4000,
  battleship: 10000,
  lunar_tank: 8000,
  space_station: 25000,
};

export const WAR_TYPE_ALLOWED_TROOPS: Record<WarType, TroopType[]> = {
  training: ['tank', 'aircraft', 'missile', 'bomber'],
  land: ['tank', 'aircraft', 'missile', 'bomber'],
  naval: ['battleship', 'tank', 'aircraft', 'missile', 'bomber'],
  space: ['space_station'],
  lunar: ['lunar_tank'],
  revolution: ['tank', 'aircraft', 'missile', 'bomber'],
  coup: ['tank', 'aircraft', 'missile', 'bomber'],
};

// ── Factory System Configuration ──────────────────────────
export type FactoryType = 'gold' | 'oil' | 'minerals' | 'uranium' | 'diamonds' | 'liquid_oxygen' | 'helium3' | 'rivalium';

export const FACTORY_TYPES: FactoryType[] = ['gold', 'oil', 'minerals', 'uranium', 'diamonds', 'liquid_oxygen', 'helium3', 'rivalium'];

/** Factory category: 'gold' produces money+gold, 'resource' produces a single resource */
export type FactoryCategory = 'gold' | 'resource';

export const FACTORY_CONFIG = {
  // ── Factory type definitions ──
  TYPES: {
    gold:           { label: "Miniera d'Oro",            icon: '🪙', category: 'gold'     as FactoryCategory, resource: 'gold_ore',       rarity: 1, basePayout: 100 },
    oil:            { label: 'Giacimento di Petrolio',   icon: '🛢️', category: 'resource' as FactoryCategory, resource: 'oil',            rarity: 2, basePayout: 0 },
    minerals:       { label: 'Cava di Minerali',         icon: '🪨', category: 'resource' as FactoryCategory, resource: 'minerals',       rarity: 2, basePayout: 0 },
    uranium:        { label: 'Cava di Uranio',            icon: '☢️', category: 'resource' as FactoryCategory, resource: 'uranium',        rarity: 4, basePayout: 0 },
    diamonds:       { label: 'Miniera di Diamanti',      icon: '💎', category: 'resource' as FactoryCategory, resource: 'diamonds',       rarity: 5, basePayout: 0 },
    liquid_oxygen:  { label: 'Impianto Ossigeno Liquido', icon: '🧊', category: 'resource' as FactoryCategory, resource: 'liquid_oxygen',  rarity: 6, basePayout: 0 },
    helium3:        { label: 'Laboratorio Elio-3',       icon: '⚗️', category: 'resource' as FactoryCategory, resource: 'helium3',        rarity: 7, basePayout: 0 },
    rivalium:       { label: 'Miniera di Rivalium',      icon: '🔮', category: 'resource' as FactoryCategory, resource: 'rivalium',       rarity: 9, basePayout: 0 },
  } as Record<string, { label: string; icon: string; category: FactoryCategory; resource: string; rarity: number; basePayout: number }>,

  // ── Creation costs (money) ──
  CREATE_COST: {
    gold: 10000,
    oil: 5000,
    minerals: 5000,
    uranium: 15000,
    diamonds: 25000,
    liquid_oxygen: 30000,
    helium3: 50000,
    rivalium: 100000,
  } as Record<string, number>,

  // ── Storage constants per level (units per level) ──
  STORAGE_PER_LEVEL: {
    gold: 0,                // Gold mines produce currency, no physical storage needed
    oil: 40_000_000,
    minerals: 40_000_000,
    uranium: 5_000_000,
    diamonds: 50_000,
    liquid_oxygen: 8_000_000,
    helium3: 50_000,
    rivalium: 10_000,
  } as Record<string, number>,

  // ── Maximum factory level ──
  MAX_LEVEL: 800,

  // ── Yield multiplier formula: yield = 1 + (level - 1) * YIELD_GROWTH_RATE ──
  YIELD_GROWTH_RATE: 0.08,  // 8% growth per level over level 1

  // ── Resource output per work action: base = level * BASE_RESOURCE_OUTPUT * bonusMult ──
  BASE_RESOURCE_OUTPUT: 2,

  // ── Gold mine specific: dual payout ──
  GOLD_MINE_MONEY_PER_WORK: 100,    // base money per work action
  GOLD_MINE_GOLD_PER_WORK: 0.5,     // base gold per work action (fractional, accumulated)

  // ── Owner profit: owner receives this % of gross production value ──
  OWNER_PROFIT_RATE: 0.10,  // 10% of output value goes to owner

  // ── Industrial tax rate (default, can be overridden by region) ──
  DEFAULT_INDUSTRY_TAX_RATE: 10,  // percentage

  // ── Resource base market values (for valuation and economy) ──
  RESOURCE_VALUES: {
    gold_ore: 50,
    oil: 5,
    minerals: 4,
    uranium: 30,
    diamonds: 200,
    liquid_oxygen: 15,
    helium3: 250,
    rivalium: 1000,
  } as Record<string, number>,

  // ── Valuation formula weights ──
  VALUATION: {
    LEVEL_WEIGHT: 500,
    RARITY_WEIGHT: 1000,
    STORAGE_WEIGHT: 0.001,
    PROFIT_WEIGHT: 30,     // multiplied by daily avg profit
  },
};

/** Calculate yield multiplier for a factory level relative to level 1 */
export function factoryYieldMultiplier(level: number): number {
  return 1 + (Math.max(1, level) - 1) * FACTORY_CONFIG.YIELD_GROWTH_RATE;
}

/** Calculate storage limit for a factory type and level */
export function factoryStorageLimit(factoryType: string, level: number): number {
  const perLevel = FACTORY_CONFIG.STORAGE_PER_LEVEL[factoryType] || 0;
  return perLevel * Math.max(1, level);
}

/** Estimate factory value based on type, level, and recent profit */
export function estimateFactoryValue(factoryType: string, level: number, recentDailyProfit: number = 0): number {
  const typeDef = FACTORY_CONFIG.TYPES[factoryType];
  if (!typeDef) return 0;
  const createCost = FACTORY_CONFIG.CREATE_COST[factoryType] || 0;
  const levelValue = level * FACTORY_CONFIG.VALUATION.LEVEL_WEIGHT;
  const rarityValue = typeDef.rarity * FACTORY_CONFIG.VALUATION.RARITY_WEIGHT;
  const storageValue = factoryStorageLimit(factoryType, level) * FACTORY_CONFIG.VALUATION.STORAGE_WEIGHT;
  const profitValue = recentDailyProfit * FACTORY_CONFIG.VALUATION.PROFIT_WEIGHT;
  return Math.floor(createCost + levelValue + rarityValue + storageValue + profitValue);
}

// ── Factory Market Listing ──
export interface FactoryMarketListing {
  id: string;
  factoryId: string;
  sellerId: string;
  sellerName?: string;
  askingPrice: number;
  listedAt: string;
  status: 'active' | 'sold' | 'cancelled';
  factory?: Factory;
}

// ── Factory Economy Log ──
export interface FactoryEconomyLog {
  id: string;
  factoryId: string;
  logDate: string;
  workerCount: number;
  grossIncome: number;
  taxesPaid: number;
  ownerProfit: number;
  production: number;
}

// ── Factory Worker Log ──
export interface FactoryWorkerLog {
  id: string;
  factoryId: string;
  workerId: string;
  workerName?: string;
  workedAt: string;
  earningsMoney: number;
  earningsGold: number;
  resourceType: string | null;
  resourceAmount: number;
  ownerCut: number;
}

// ── Regional Autonomy Configuration ──────────────────────
export const AUTONOMY_CONFIG = {
  // Military formula coefficients
  ATTACK_BASE_COEFFICIENT: 450000,
  DEFENSE_STRUCTURAL_COEFFICIENT: 50000,

  // Energy per building (mW)
  ENERGY_CONSUMPTION: {
    hospital: 2,
    military_base: 2,
    school: 2,
    military_academy: 0,
    missile_system: 2,
    airport: 2,
    naval_port: 2,
    space_port: 2,
    real_estate_fund: 0,
    power_plant: 0,
  } as Record<string, number>,
  ENERGY_PRODUCTION_PER_PLANT: 10, // mW per power plant
  BUILDINGS_PER_PLANT: 5, // how many buildings one power plant can support

  // Building costs (EUR)
  BUILDING_COSTS: {
    hospital: 25000,
    military_base: 50000,
    school: 20000,
    military_academy: 80000,
    missile_system: 100000,
    airport: 75000,
    naval_port: 75000,
    space_port: 150000,
    real_estate_fund: 40000,
    power_plant: 60000,
  } as Record<string, number>,

  // Daily extraction limits (defaults)
  EXTRACTION_DEFAULTS: {
    gold: 2500,
    oil: 600,
    minerals: 500,
    uranium: 60,
    diamonds: 75,
  },

  // Pollution malus per point (percentage reduction to health effectiveness)
  POLLUTION_MALUS_PER_POINT: 0.5,

  // Energy deficit malus (percentage reduction to economic efficiency)
  ENERGY_DEFICIT_MALUS: 0.1,

  // Index weights for buildings
  INDEX_WEIGHTS: {
    health: { hospital: 1.0 },
    military: {
      military_base: 1.0,
      military_academy: 1.5,
      missile_system: 0.8,
      airport: 0.6,
      naval_port: 0.6,
      space_port: 0.4,
    },
    education: { school: 1.0 },
    development: { real_estate_fund: 1.0 },
  } as Record<string, Record<string, number>>,

  // Cumulative building-score thresholds to reach each level 1–10.
  // threshold[i] = minimum weighted score required to reach level (i+1).
  // These are configurable: adjust to balance difficulty of progression.
  INDEX_THRESHOLDS: {
    health:      [1, 3,  6,  10, 15, 21, 28, 36, 45, 55],
    military:    [1, 3,  6,  10, 15, 21, 28, 36, 45, 55],
    education:   [1, 3,  6,  10, 15, 21, 28, 36, 45, 55],
    development: [1, 3,  6,  10, 15, 21, 28, 36, 45, 55],
  } as Record<string, number[]>,

  // Regional classification thresholds based on developmentIndex (level 1-10).
  CLASSIFICATION_THRESHOLDS: {
    developed:    6, // developmentIndex >= 6 → Regione Sviluppata
    developing:   2, // 2 <= developmentIndex < 6 → Regione in Via di Sviluppo
    // developmentIndex < 2 → Regione Arretrata
  },

  // Gameplay effect multipliers applied per index level (1–10).
  // These values are used by server-side game systems (war, energy, XP, stability).
  INDEX_EFFECTS: {
    health: {
      // Each level reduces energy cost by this fraction (e.g. 0.01 = 1% per level)
      energyCostReductionPerLevel: 0.01,
      // Pollution weakens the effective health index (see POLLUTION_MALUS_PER_POINT)
    },
    military: {
      // Each level adds this fraction as a bonus to war damage dealt
      attackBonusPerLevel: 0.03,   // +3% per level → max +30% at level 10
      // Each level adds this fraction as a bonus to damage reduction when defending
      defenseBonusPerLevel: 0.02,  // +2% per level → max +20% at level 10
    },
    education: {
      // Each level adds this fraction as a bonus to XP gained from actions
      xpBonusPerLevel: 0.02,       // +2% per level → max +20% at level 10
    },
    development: {
      // Each level above 0 adds this fraction to institutional salary payouts
      salaryMultiplierPerLevel: 0.05, // +5% per level → max +50% at level 10
      // Coup/instability risk modifier: positive = reduces risk
      coupRiskReductionPerLevel: 0.08, // -8% coup risk per level
    },
  } as Record<string, Record<string, number>>,
};

export const BUILDING_LABELS: Record<string, string> = {
  hospital: 'Ospedali',
  military_base: 'Basi Militari',
  school: 'Scuole',
  military_academy: 'Accademie Militari',
  missile_system: 'Sistemi Missilistici',
  airport: 'Aeroporti',
  naval_port: 'Porti Navali',
  space_port: 'Porti Spaziali',
  real_estate_fund: 'Fondi Immobiliari',
  power_plant: 'Centrali Elettriche',
};

export const BUILDING_ICONS: Record<string, string> = {
  hospital: '🏥',
  military_base: '🏛️',
  school: '🏫',
  military_academy: '🎖️',
  missile_system: '🚀',
  airport: '✈️',
  naval_port: '⚓',
  space_port: '🛸',
  real_estate_fund: '🏘️',
  power_plant: '⚡',
};

// Booster config
export const BOOSTER_CONFIG = {
  BONUS_POINTS: 100,          // Always +100 to perk level
  CASH_PRICE: 5000,           // $5,000 for cash booster
  GOLD_PRICE: 50,             // 50 gold for gold booster
  // Duration (ms): base / (1 + perkLevel * decay). Gold = 10x cash.
  BASE_DURATION_CASH_MS: 2 * 60 * 60 * 1000,   // 2 hours base for cash
  BASE_DURATION_GOLD_MS: 20 * 60 * 60 * 1000,  // 20 hours base for gold (10x)
  DURATION_DECAY: 0.005,      // -0.5% per perk level
  COOLDOWN_MS: 3 * 24 * 60 * 60 * 1000, // 3 days between booster uses
  // Perks NOT affected (storage, XP cap)
  EXCLUDED_EFFECTS: ['storage', 'xpCap'],
};

// Perk upgrade times: cash starts fast and increases progressively, gold is 3x faster.
// Perks are UNLIMITED in level. Only one upgrade active at a time.
export const PERKS_DEFS = [
  {
    id: "FORZA",
    name: "Forza",
    icon: "⚔️",
    description: "Aumenta i danni in guerra. Aumenta la produttività nelle fabbriche PUBBLICHE. Riduce il costo di crafting: bonus = √FORZA + √ISTRUZIONE (cap 50%).",
    effects: [
      "+5% danno in guerra / livello",
      "+3% produttività fabbriche pubbliche / livello",
      "Riduce costo crafting (formula condivisa con Istruzione)",
    ],
    baseEffect: 0.05,
    baseCashCost: 500,
    baseGoldCost: 5,
    baseTimeCashSec: 60,
    baseTimeGoldSec: 20,
  },
  {
    id: "ISTRUZIONE",
    name: "Istruzione",
    icon: "📚",
    description: "Aumenta XP massimo lavorativo. Aumenta i danni in guerra (meno di Forza). Riduce costo crafting. Lv 100 sblocca i Dipartimenti di Stato.",
    effects: [
      "+XP massimo lavorativo / livello",
      "+2% danno in guerra / livello",
      "Riduce costo crafting (formula condivisa con Forza)",
      "Lv 100 → Dipartimenti di Stato",
    ],
    baseEffect: 0.02,
    baseCashCost: 500,
    baseGoldCost: 5,
    baseTimeCashSec: 60,
    baseTimeGoldSec: 20,
  },
  {
    id: "RESISTENZA",
    name: "Resistenza",
    icon: "🛡️",
    description: "Riduce l'energia consumata al lavoro (max riduzione a Lv 50). +1% spazio magazzino/livello. Aumenta il danno alpha in guerra. Bonus alpha a Lv 50, 75 e 100.",
    effects: [
      "Riduce energia al lavoro — massimo a Lv 50",
      "+1% spazio magazzino / livello",
      "+3% danno max in guerra / livello",
      "Alpha-damage bonus a Lv 50, 75, 100",
    ],
    baseEffect: 0.03,
    baseCashCost: 500,
    baseGoldCost: 5,
    baseTimeCashSec: 60,
    baseTimeGoldSec: 20,
  },
];

export interface Bloc {
  id: string;
  name: string;
  logo: string;
  description: string;
  ownerStateId: string;
  createdAt: number;
}

export interface BlocMembership {
  blocId: string;
  stateId: string;
  status: 'active';
  joinedAt: number;
}

export interface BlocApplication {
  id: string;
  blocId: string;
  stateId: string;
  createdAt: number;
  status: 'pending' | 'approved' | 'rejected';
}

export interface BlocRegulationProposal {
  id: string;
  blocId: string;
  type: 'openBorders' | 'migrationOpen' | 'defaultMilitaryAgreement';
  proposedValue: number;
  createdAt: number;
  status: 'pending' | 'approved' | 'rejected';
}

export interface MigrationAgreement {
  id: string;
  fromStateId: string;
  toStateId: string;
  status: 'ACTIVE' | 'INACTIVE';
  type: 'UNILATERAL' | 'BILATERAL';
  createdAt: number;
  activatedAt?: number;
  revokedAt?: number;
  sourceLawId?: string;
  updatedAt: number;
}

// ── Regional Resources System ──────────────────────────────

export type ResourceType = 'oil' | 'minerals' | 'uranium' | 'diamonds' | 'gold_ore' | 'liquid_oxygen' | 'helium3' | 'rivalium';

export const RESOURCE_TYPES: ResourceType[] = ['oil', 'minerals', 'uranium', 'diamonds', 'gold_ore', 'liquid_oxygen', 'helium3', 'rivalium'];

export const RESOURCE_LABELS: Record<ResourceType, string> = {
  oil: 'Petrolio',
  minerals: 'Minerali',
  uranium: 'Uranio',
  diamonds: 'Diamanti',
  gold_ore: 'Oro',
  liquid_oxygen: 'Ossigeno Liquido',
  helium3: 'Elio-3',
  rivalium: 'Rivalium',
};

export const RESOURCE_ICONS_MAP: Record<ResourceType, string> = {
  oil: '🛢️',
  minerals: '🪨',
  uranium: '☢️',
  diamonds: '💎',
  gold_ore: '🥇',
  liquid_oxygen: '🧊',
  helium3: '⚗️',
  rivalium: '🔮',
};

export interface RegionResource {
  regionId: string;
  resourceType: ResourceType;
  dailyAvailable: number;
  dailyExtracted: number;
  baseCapPerRecharge: number;
}

export interface PlayerExtractionState {
  playerId: string;
  regionId: string;
  resourceType: ResourceType;
  extractedSinceLastRecharge: number;
}

export interface ResourceRecharge {
  regionId: string;
  resourceType: ResourceType;
  lastRechargeAt: string | null;
  rechargedByUserId: string | null;
}

export interface DeepExploration {
  id: string;
  nationId: string;
  resourceType: ResourceType;
  level: number;
  targetCap: number;
  activatedByUserId: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  costDiamonds: number;
  costEur: number;
  costGold: number;
}

export interface DeepLevel {
  level: number;
  targetCap: number;
  enabled: boolean;
  description: string;
}

export interface DeepCostPreview {
  targetCap: number;
  numRegions: number;
  sumDelta: number;
  avgDelta: number;
  costDiamonds: number;
  costEur: number;
  costGold: number;
}

export interface WorkExtractResult {
  success: boolean;
  amount: number;
  resourceType: ResourceType;
  remainingCycle: number;
  remainingDaily: number;
  xpGain: number;
  energyCost: number;
  error?: string;
  reason?: string;
}

// ── Extraction System Configuration ──────────────────────────
// All formula constants are centralised here for easy balancing.

export const EXTRACTION_CONFIG = {
  // ── Base formula: Productivity = BASE_COEFF * (playerLevel ^ PLAYER_EXP) * ((coeffRisorsa / 10) ^ RESOURCE_EXP) * (factoryLevel ^ FACTORY_EXP) * ((workExp / 10) ^ WORK_EXP)
  BASE_COEFFICIENT: 0.2,
  PLAYER_LEVEL_EXPONENT: 0.8,
  RESOURCE_COEFF_EXPONENT: 0.8,
  FACTORY_LEVEL_EXPONENT: 0.8,
  WORK_EXPERIENCE_EXPONENT: 0.6,
  RESOURCE_COEFF_DIVISOR: 10,       // CoeffRisorsa / this
  WORK_EXPERIENCE_DIVISOR: 10,      // WorkExp / this

  // ── Resource coefficient multipliers (based on region max cap incl. deep) ──
  RESOURCE_COEFF_MULTIPLIERS: {
    gold_ore: 0.4,
    oil: 0.65,
    minerals: 0.65,
    uranium: 0.75,
    diamonds: 0.75,
    // Energy-based resources (liquid_oxygen, helium3) and rivalium use 0 here
    // because their coefficient is calculated via ENERGY_RESOURCE_MULTIPLIER/EXPONENT
    // based on power plant count, not region cap.
    liquid_oxygen: 0,
    helium3: 0,
    rivalium: 0,
  } as Record<string, number>,

  // ── Energy-based resource coefficient: pow(numPowerPlants * MULT, EXP) ──
  ENERGY_RESOURCE_MULTIPLIER: 2,
  ENERGY_RESOURCE_EXPONENT: 0.4,

  // ── Bonus: Nation / Global production multiplier ──
  NATION_BONUS_ENABLED: true,
  NATION_BONUS_MULTIPLIER: 1.2,   // +20%

  // ── Bonus: Resource Department ──
  DEPARTMENT_BONUS_ENABLED: true,  // applies (1 + departmentLevel / 100)

  // ── Final balancing multipliers per resource ──
  BALANCING_MULTIPLIERS: {
    gold_ore: 4,
    oil: 1,
    minerals: 1,
    uranium: 1,
    diamonds: 0.001,       // /1000
    liquid_oxygen: 0.2,    // /5
    helium3: 0.001,        // /1000
    rivalium: 1,
  } as Record<string, number>,

  // ── Gold special: money generated per unit of gold produced ──
  // Derived from base game economy ratio for gold-to-currency conversion.
  GOLD_TO_MONEY_COEFFICIENT: 3.538975,

  // ── Regional consumption coefficients (separate from player profit) ──
  // Formula: (LINEAR_COEFF * factoryLevel) + BASE_OFFSET
  CONSUMPTION_COEFFICIENTS: {
    gold_ore:       { linearCoeff: 200000, baseOffset: 20000000 },
    oil:            { linearCoeff: 200000, baseOffset: 20000000 },
    minerals:       { linearCoeff: 200000, baseOffset: 20000000 },
    uranium:        { linearCoeff: 200000, baseOffset: 20000000 },
    diamonds:       { linearCoeff: 250,    baseOffset: 25000 },
    liquid_oxygen:  { linearCoeff: 200000, baseOffset: 20000000 },
    helium3:        { linearCoeff: 250,    baseOffset: 25000 },
    rivalium:       { linearCoeff: 200000, baseOffset: 20000000 },
  } as Record<string, { linearCoeff: number; baseOffset: number }>,

  // ── Work experience gain per extraction action ──
  WORK_EXPERIENCE_GAIN: 1,
  MIN_WORK_EXPERIENCE: 1,  // floor for formula (avoid 0^exp)

  // ── Minimum extraction threshold (below this, extraction is considered exhausted) ──
  MIN_EXTRACTION_THRESHOLD: 0.001,

  // ── Work action cost (energy drinks / energy) ──
  WORK_ACTION_ENERGY_COST: 10,
};

// ── Extraction Breakdown (for UI transparency) ──────────────
export interface ExtractionBreakdown {
  // Inputs
  playerLevel: number;
  factoryLevel: number;
  workExperience: number;
  resourceCoefficient: number;
  resourceType: ResourceType;
  // Intermediate
  baseProductivity: number;
  nationBonus: number;
  departmentBonus: number;
  balancingMultiplier: number;
  // Output
  finalProductivity: number;
  // Regional consumption
  regionalConsumptionCoeff: number;
  withdrawnPoints: number;
  // Payout distribution
  grossAmount: number;
  playerAmount: number;
  ownerAmount: number;
  taxAmount: number;
  stateAmount: number;
  autonomyAmount: number;
  // Gold special
  moneyGenerated: number;
  // Region status
  regionCapMax: number;
  regionDeepBonus: number;
  regionCapTotal: number;
  regionResidualToday: number;
}

export interface PlayerWorkExperience {
  playerId: string;
  resourceType: ResourceType;
  experience: number;
  totalExtractions: number;
  lastWorkedAt: string | null;
}

// ── Daily Gameplay System ──────────────────────────────────
// Types, interfaces and configuration for the daily task & farming system.

/** Status of a daily task */
export type DailyTaskStatus = 'completed' | 'available' | 'blocked' | 'cooldown';

/** A single daily task entry */
export interface DailyTask {
  id: string;
  title: string;
  description: string;
  icon: string;
  status: DailyTaskStatus;
  /** Optional route to navigate on tap */
  route?: string;
  /** When the task becomes available again (epoch ms), used for cooldown */
  cooldownEndsAt?: number;
  /** Textual reason why it's blocked */
  blockedReason?: string;
}

/** Auto-work farming configuration for a player */
export interface AutoWorkConfig {
  resourceType: ResourceType | 'gold_ore';
  active: boolean;
  startedAt: number | null;
  /** Duration in ms (configurable, e.g. 8h) */
  durationMs: number;
  /** Estimated yield per cycle */
  estimatedYield: number;
  /** Energy cost per cycle */
  energyCost: number;
}

/** Region health farming bonus */
export interface FarmingBonus {
  regionHealth: number;           // 1-10
  bonusMultiplier: number;        // e.g. 1.0 to 2.0
  suggestion: string;             // contextual tip
}

/** Farming resource entry for the UI */
export interface FarmingResourceEntry {
  resourceType: ResourceType;
  label: string;
  icon: string;
  estimatedYield: number;
  energyCost: number;
  bonusPercent: number;
  recommended: boolean;
}

/** Daily damage / training system */
export interface DailyDamageState {
  available: boolean;
  nextAvailableAt: number;        // epoch ms (countdown 24h)
  currentXp: number;
  currentLevel: number;
  xpToNextLevel: number;
  maxDamagePotential: number;
  /** Active regional events the damage can be sent to */
  activeEvents: DamageTarget[];
  recommendedTarget: string | null;
}

export type DamageTargetType = 'military_training' | 'revolution_defense' | 'coup_defense' | 'active_event';

export interface DamageTarget {
  id: string;
  type: DamageTargetType;
  label: string;
  description: string;
  xpGain: number;
  recommended: boolean;
}

/** Military academy daily state */
export interface AcademyState {
  built: boolean;
  canBuild: boolean;
  isInResidenceRegion: boolean;
  /** Epoch ms: next available build time */
  nextBuildAt: number;
  rewards: AcademyReward[];
  /** Reason for blocked status */
  blockedReason?: string;
}

export interface AcademyReward {
  type: 'energy_bottles' | 'gold' | 'money' | 'xp' | 'resource';
  label: string;
  amount: number;
  icon: string;
}

/** Perk upgrade entry for daily suggestions */
export interface PerkUpgradeEntry {
  perkId: string;
  name: string;
  icon: string;
  currentLevel: number;
  upgradeCost: { money: number; gold: number };
  bonusDescription: string;
  /** Badge tag for recommendation */
  tag?: 'consigliata' | 'economica' | 'strategica' | 'militare' | 'farming';
  canUpgrade: boolean;
}

/** Free reward / bottle source tracking */
export interface FreeRewardEntry {
  id: string;
  source: 'academy' | 'work_medal' | 'periodic' | 'streak' | 'event' | 'other';
  sourceLabel: string;
  type: 'energy_bottles' | 'gold' | 'money' | 'xp';
  amount: number;
  claimedAt: number | null;
  icon: string;
}

/** Work streak tracking */
export interface WorkStreak {
  currentStreak: number;
  longestStreak: number;
  lastWorkDate: string | null;     // ISO date YYYY-MM-DD
  /** Streak milestones with rewards */
  milestones: StreakMilestone[];
}

export interface StreakMilestone {
  days: number;
  reward: AcademyReward;
  claimed: boolean;
}

/** Periodic / cumulative reward progress */
export interface PeriodicRewardProgress {
  id: string;
  label: string;
  totalDaysRequired: number;
  daysCompleted: number;
  reward: AcademyReward;
  claimed: boolean;
}

/** Strategic value explanation for bottles */
export interface BottleValueBreakdown {
  autoWorkHours: number;
  maxDamagePotential: number;
  goldFarmEquivalent: number;
}

// ── Daily Gameplay System Configuration ──────────────────────
export const DAILY_GAMEPLAY_CONFIG = {
  /** Auto-work default duration: 8 hours */
  AUTO_WORK_DURATION_MS: 8 * 60 * 60 * 1000,
  /** Daily damage cooldown: 24 hours */
  DAILY_DAMAGE_COOLDOWN_MS: 24 * 60 * 60 * 1000,
  /** Academy build window: 24 hours */
  ACADEMY_BUILD_WINDOW_MS: 24 * 60 * 60 * 1000,
  /** Energy bottles per academy claim */
  ACADEMY_BOTTLES_REWARD: 5,
  /** Gold per academy claim */
  ACADEMY_GOLD_REWARD: 2,
  /** Farming health bonus: each health point adds this % */
  FARMING_HEALTH_BONUS_PER_POINT: 0.05,
  /** Max health bonus multiplier */
  FARMING_HEALTH_BONUS_MAX: 1.50,
  /** Streak milestones (consecutive days → reward) */
  STREAK_MILESTONES: [3, 5, 7, 14, 30],
  /** Bottles per streak milestone */
  STREAK_BOTTLES_REWARD: [2, 3, 5, 10, 25],
  /** Base XP per training action */
  TRAINING_BASE_XP: 50,
  /** XP multiplier per level for damage potential */
  DAMAGE_PER_LEVEL: 150,
};
