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
  influence: number;
  regionId: string; // ISO code
  lastEnergyUpdate: number;
  xp: number;
  level: number;
  perkPoints: number;
  perks?: Record<string, number>;
  perkUpgrades?: Record<string, { startedAt: number, willCompleteAt: number, targetLevel: number }>;
  // Active boosters: perkId -> { expiresAt, lastActivatedAt, isGold }
  boosters?: Record<string, { expiresAt: number; lastActivatedAt: number; isGold: boolean }>;
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
  factoriesCount: number;
  // Game Stats (legacy or from Firestore)
  power?: number;
  economy?: number;
  resources?: { type: string, amount: number }[] | any;
  taxRate?: number;
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

export interface Article {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  content: string;
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
  lastEventAt: number;
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

// Perk upgrade times: cash is slow (hours), gold is 3x faster.
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
    baseCashCost: 2000,
    baseGoldCost: 20,
    baseTimeCashSec: 3600,
    baseTimeGoldSec: 1200,
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
    baseCashCost: 2000,
    baseGoldCost: 20,
    baseTimeCashSec: 3600,
    baseTimeGoldSec: 1200,
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
    baseCashCost: 2000,
    baseGoldCost: 20,
    baseTimeCashSec: 3600,
    baseTimeGoldSec: 1200,
  },
];
