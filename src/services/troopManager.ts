import { GAME_CONFIG, TROOP_ENERGY_COST, TROOP_MONEY_COST, WAR_TYPE_ALLOWED_TROOPS, type TroopType, type WarType, type WarSide } from '../types';

export interface TroopValidation {
  valid: boolean;
  error?: string;
  energyCost: number;
  moneyCost: number;
}

/**
 * Validate troop deployment is allowed for the given war type and phase
 */
export function validateTroopDeployment(
  troopType: TroopType,
  quantity: number,
  warType: WarType,
  navalPhase: number,
  userEnergy: number
): TroopValidation {
  // Check war type allows this troop
  const allowedTroops = WAR_TYPE_ALLOWED_TROOPS[warType] || [];

  // Naval phase 1: only battleships
  if (warType === 'naval' && navalPhase === 1) {
    if (troopType !== 'battleship') {
      return { valid: false, error: 'Solo corazzate permesse nella Fase 1 navale.', energyCost: 0, moneyCost: 0 };
    }
  } else if (warType === 'naval' && troopType === 'battleship') {
    return { valid: false, error: 'Corazzate navali permesse solo nella Fase 1 (guerra navale).', energyCost: 0, moneyCost: 0 };
  } else if (!allowedTroops.includes(troopType)) {
    return { valid: false, error: `Truppe ${troopType} non permesse in guerra ${warType}.`, energyCost: 0, moneyCost: 0 };
  }

  if (quantity < 1) {
    return { valid: false, error: 'Quantità minima: 1.', energyCost: 0, moneyCost: 0 };
  }

  const energyCost = (TROOP_ENERGY_COST[troopType] || 10) * quantity;
  const moneyCost = (TROOP_MONEY_COST[troopType] || 0) * quantity;

  if (userEnergy < energyCost) {
    return { valid: false, error: `Energia insufficiente (richiesti ${energyCost}⚡).`, energyCost, moneyCost };
  }

  return { valid: true, energyCost, moneyCost };
}

/**
 * Calculate max deployable troops based on level + resistance + premium status
 */
export function getMaxDeployableTroops(
  troopType: TroopType,
  level: number,
  resistance: number,
  isPremium: boolean
): number {
  const baseCap = Math.floor((level + resistance) / 5) + 1;
  const premiumMultiplier = isPremium ? 2 : 1;
  return baseCap * premiumMultiplier;
}

/**
 * Get all available troop types for a given war type and phase
 */
export function getAvailableTroops(warType: WarType, navalPhase: number): TroopType[] {
  if (warType === 'naval' && navalPhase === 1) {
    return ['battleship'];
  }
  return WAR_TYPE_ALLOWED_TROOPS[warType] || [];
}
