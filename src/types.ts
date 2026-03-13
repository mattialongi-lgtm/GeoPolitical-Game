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

export type ResourceType = 'oil' | 'minerals' | 'uranium' | 'diamonds' | 'gold_ore';

export const RESOURCE_TYPES: ResourceType[] = ['oil', 'minerals', 'uranium', 'diamonds', 'gold_ore'];

export const RESOURCE_LABELS: Record<ResourceType, string> = {
  oil: 'Petrolio',
  minerals: 'Minerali',
  uranium: 'Uranio',
  diamonds: 'Diamanti',
  gold_ore: 'Oro',
};

export const RESOURCE_ICONS_MAP: Record<ResourceType, string> = {
  oil: '🛢️',
  minerals: '🪨',
  uranium: '☢️',
  diamonds: '💎',
  gold_ore: '🥇',
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
