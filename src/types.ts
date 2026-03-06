/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  id: string;
  username: string;
  money: number;
  energy: number;
  influence: number;
  regionId: string; // ISO code
  lastEnergyUpdate: number;
  xp: number;
  level: number;
  perkPoints: number;
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
  resources: number;
  stability: number;
  taxes: number;
  ownerId: string | null;
  ownerName: string | null;
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
  { id: "work_boost", name: "Work Boost", description: "Increases money earned from work by 10% per level.", baseEffect: 0.1 },
  { id: "energy_efficiency", name: "Energy Efficiency", description: "Reduces energy cost of actions by 5% per level.", baseEffect: 0.05 },
  { id: "regen_boost", name: "Regen Boost", description: "Increases energy regeneration by 5 per hour per level.", baseEffect: 5 },
  { id: "war_tactics", name: "War Tactics", description: "Increases war score and attack chance by 5% per level.", baseEffect: 0.05 },
];
