import { GAME_CONFIG, type WarType, type WarCreationParams, type WarFull, type WarSide, type TroopType } from '../types';
import { calculateInitialAttackDamage, calculateInitialDefensePoints } from './damageCalculator';

export interface WarValidation {
  valid: boolean;
  error?: string;
}

/**
 * Validate that a new war can be opened between two regions
 */
export function validateWarCreation(params: {
  attackerRegionId: string;
  defenderRegionId: string;
  warType: WarType;
  // Region info
  attackerNationId: string | null;
  defenderNationId: string | null;
  // Bloc info
  attackerBlocId: string | null;
  defenderBlocId: string | null;
  // Region status
  defenderUnderAttack: boolean;
  defenderInForcedPeace: boolean;
  defenderHasRevolution: boolean;
  defenderHasCoup: boolean;
  // Adjacency
  areAdjacent: boolean;
  // Naval specific
  attackerHasSeaAccess?: boolean;
  defenderHasSeaAccess?: boolean;
  distanceKm?: number;
  // Space
  attackerHasSpaceport?: boolean;
  defenderIsLunar?: boolean;
  // Military agreement
  hasMilitaryAgreement?: boolean;
}): WarValidation {
  // Cannot attack same nation
  if (params.attackerNationId && params.attackerNationId === params.defenderNationId) {
    return { valid: false, error: 'Non puoi attaccare una regione del tuo stesso stato.' };
  }

  // Cannot attack same bloc
  if (params.attackerBlocId && params.attackerBlocId === params.defenderBlocId) {
    return { valid: false, error: 'Non puoi attaccare un membro dello stesso Blocco Geopolitico.' };
  }

  // Cannot attack region already under attack
  if (params.defenderUnderAttack) {
    return { valid: false, error: 'Questa regione è già sotto attacco.' };
  }

  // Cannot attack during forced peace
  if (params.defenderInForcedPeace) {
    return { valid: false, error: 'Questa regione è in pace forzata.' };
  }

  // Cannot attack during revolution
  if (params.defenderHasRevolution) {
    return { valid: false, error: 'Questa regione ha una rivoluzione in corso.' };
  }

  // Cannot attack during coup
  if (params.defenderHasCoup) {
    return { valid: false, error: 'Questa regione ha un colpo di stato in corso.' };
  }

  // War type specific validations
  switch (params.warType) {
    case 'land':
    case 'training':
      if (!params.areAdjacent) {
        return { valid: false, error: 'Le regioni devono essere confinanti per una guerra terrestre.' };
      }
      break;

    case 'naval':
      if (!params.attackerHasSeaAccess || !params.defenderHasSeaAccess) {
        return { valid: false, error: 'Entrambe le regioni devono avere accesso al mare.' };
      }
      if (params.distanceKm && params.distanceKm > GAME_CONFIG.WAR_NAVAL_MAX_DISTANCE_KM) {
        return { valid: false, error: `Distanza massima per guerra navale: ${GAME_CONFIG.WAR_NAVAL_MAX_DISTANCE_KM} km.` };
      }
      break;

    case 'space':
      if (!params.attackerHasSpaceport) {
        return { valid: false, error: 'La regione attaccante deve avere spazioporti.' };
      }
      break;

    case 'lunar':
      if (!params.areAdjacent) {
        return { valid: false, error: 'Le regioni lunari devono essere confinanti.' };
      }
      break;

    default:
      break;
  }

  return { valid: true };
}

/**
 * Calculate war duration based on type
 */
export function getWarDuration(warType: WarType): number {
  switch (warType) {
    case 'naval':
      return GAME_CONFIG.WAR_NAVAL_PHASE_DURATION_MS; // First phase 24h
    case 'training':
      return GAME_CONFIG.WAR_DURATION_MS; // 24h
    default:
      return GAME_CONFIG.WAR_DURATION_MS; // 24h
  }
}

/**
 * Calculate initial damages for both sides
 */
export function calculateInitialDamages(
  attackerBuildings: Record<string, number>,
  defenderBuildings: Record<string, number>
): { initialAttack: number; initialDefense: number } {
  const academies = attackerBuildings['military_academy'] || 0;
  return {
    initialAttack: calculateInitialAttackDamage(academies),
    initialDefense: calculateInitialDefensePoints(defenderBuildings),
  };
}

/**
 * Calculate distance penalty (0 to 0.999)
 * The further the regions, the greater the penalty (up to 99.9%)
 */
export function calculateDistancePenalty(distanceKm: number, maxDistanceKm: number = 20000): number {
  if (distanceKm <= 0) return 0;
  const penalty = Math.min(distanceKm / maxDistanceKm, GAME_CONFIG.WAR_DISTANCE_PENALTY_MAX);
  return Math.round(penalty * 10000) / 10000;
}

/**
 * Determine war winner based on scores
 */
export function determineWinner(
  attackerScore: number,
  defenderScore: number
): WarSide {
  // Tie goes to defender (defense advantage)
  return attackerScore > defenderScore ? 'attacker' : 'defender';
}

/**
 * Check if a naval war should transition to phase 2
 */
export function shouldTransitionNavalPhase(war: WarFull): { transition: boolean; attackerWinsPhase1: boolean } {
  if (war.warType !== 'naval' || war.navalPhase !== 1) {
    return { transition: false, attackerWinsPhase1: false };
  }

  const now = Date.now();
  const phaseEnd = new Date(war.createdAt).getTime() + GAME_CONFIG.WAR_NAVAL_PHASE_DURATION_MS;

  if (now < phaseEnd) {
    return { transition: false, attackerWinsPhase1: false };
  }

  const attackerWins = war.phase1AttackerScore > war.phase1DefenderScore;
  return { transition: true, attackerWinsPhase1: attackerWins };
}
