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

export const PERKS_DEFS = [
  { id: "FORZA", name: "FORZA", description: "Aumenta efficacia in guerra (+5% war score per livello)", baseEffect: 0.05, baseCost: 500, baseGoldCost: 10, timeBaseSeconds: 60 },
  { id: "EDUCAZIONE", name: "EDUCAZIONE", description: "Aumenta guadagni da lavoro (+10% money per livello)", baseEffect: 0.1, baseCost: 500, baseGoldCost: 10, timeBaseSeconds: 60 },
  { id: "INDUSTRIA", name: "INDUSTRIA", description: "Riduce costo energia delle azioni (-5% energy cost)", baseEffect: 0.05, baseCost: 500, baseGoldCost: 10, timeBaseSeconds: 60 },
  { id: "LOGISTICA", name: "LOGISTICA", description: "Aumenta rigenerazione energia (+5 energia/ora per livello)", baseEffect: 5, baseCost: 500, baseGoldCost: 10, timeBaseSeconds: 60 },
];
