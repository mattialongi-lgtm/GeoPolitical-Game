import { GAME_CONFIG, type WarFull, type WarSide, type WarResolution } from '../types';
import { determineWinner } from './warService';

export interface ResolutionEffects {
  buildingReduction: number;     // 0 to 1 (0.5 = 50% reduction)
  territoryTransfer: boolean;
  lootPercentage: number;        // 0 to 1
  independenceGrant: boolean;
  governmentChange: boolean;
}

/**
 * Get resolution effects based on war type and winner
 */
export function getResolutionEffects(warType: string, winner: WarSide): ResolutionEffects {
  if (winner === 'defender') {
    return {
      buildingReduction: 0,
      territoryTransfer: false,
      lootPercentage: 0,
      independenceGrant: false,
      governmentChange: false,
    };
  }

  // Attacker wins
  switch (warType) {
    case 'revolution':
      return {
        buildingReduction: GAME_CONFIG.WAR_REVOLUTION_BUILDING_PENALTY,
        territoryTransfer: false,
        lootPercentage: 0,
        independenceGrant: true,
        governmentChange: true,
      };

    case 'coup':
      return {
        buildingReduction: 0,
        territoryTransfer: false,
        lootPercentage: 0,
        independenceGrant: true,
        governmentChange: false,
      };

    case 'training':
      return {
        buildingReduction: 0,
        territoryTransfer: false,
        lootPercentage: 0,
        independenceGrant: false,
        governmentChange: false,
      };

    default: // land, naval, space, lunar
      return {
        buildingReduction: 0.5,
        territoryTransfer: true,
        lootPercentage: GAME_CONFIG.WAR_LOOT_PERCENTAGE,
        independenceGrant: false,
        governmentChange: false,
      };
  }
}

/**
 * Resolve a completed war — returns the resolution summary
 */
export function resolveWar(war: WarFull): WarResolution {
  const winner = determineWinner(
    war.attackerScore + (war.phase1AttackerScore || 0),
    war.defenderScore + (war.phase1DefenderScore || 0)
  );

  const attackerTotal = war.attackerScore + (war.phase1AttackerScore || 0);
  const defenderTotal = war.defenderScore + (war.phase1DefenderScore || 0);

  const effects = getResolutionEffects(war.warType, winner);

  return {
    warId: war.id,
    winner,
    attackerTotal,
    defenderTotal,
    lootValue: effects.lootPercentage > 0 ? Math.floor(attackerTotal * effects.lootPercentage) : 0,
    status: 'ended',
  };
}

/**
 * Calculate loot value from defender buildings
 */
export function calculateLoot(defenderBuildingValues: number): number {
  return Math.floor(defenderBuildingValues * GAME_CONFIG.WAR_LOOT_PERCENTAGE);
}
