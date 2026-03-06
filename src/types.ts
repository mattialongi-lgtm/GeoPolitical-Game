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
  reputation: number;
  regionId: number;
  lastEnergyUpdate: number;
}

export interface Region {
  id: number;
  name: string;
  population: number;
  resources: number;
  stability: number;
  taxes: number;
  ownerId: string | null;
  ownerName: string | null;
}

export interface ActionLog {
  id: number;
  userId: string;
  action: string;
  details: string;
  timestamp: number;
}

export interface Cooldown {
  userId: string;
  actionType: string;
  lastUsed: number;
}

export const GAME_CONFIG = {
  ENERGY_MAX: 100,
  ENERGY_REGEN_RATE: 10, // per hour
  WORK_ENERGY_COST: 10,
  WORK_COOLDOWN: 60 * 1000, // 1 minute for demo
  PROPAGANDA_ENERGY_COST: 15,
  PROPAGANDA_COOLDOWN: 120 * 1000,
  INVEST_MONEY_COST: 1000,
  INVEST_ENERGY_COST: 20,
  ATTACK_ENERGY_COST: 50,
  ATTACK_COOLDOWN: 300 * 1000,
};
