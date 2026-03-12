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
  // Game Stats (legacy or from Firestore)
  power?: number;
  economy?: number;
  resources?: { type: string, amount: number }[] | any;
  taxRate?: number;
  marketTaxRate?: number;
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
