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

export interface Article {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  content: string;
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
    // Energy-based resources use a different formula
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
