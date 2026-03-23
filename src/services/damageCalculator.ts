import { GAME_CONFIG, TROOP_BASE_DAMAGE, type TroopType, type WarSide, type DamageBreakdown } from '../types';

const ACADEMY_DIVISOR = 177.7;

export interface DamageContext {
  troopType: TroopType;
  quantity: number;
  // Player stats
  militaryIndex: number;
  missileSystems: number;
  navalPorts: number;
  airports: number;
  academies: number;
  forza: number;         // FORZA perk level
  nationBonus: number;   // nation bonus multiplier
  education: number;     // ISTRUZIONE perk level
  resistance: number;    // RESISTENZA perk level
  playerLevel: number;
  // War context
  distancePenalty: number;
  departmentBonus: number;
  isPatriot: boolean;
  side: WarSide;
}

/**
 * Main damage formula from spec:
 * damage = (1
 *   × militaryIndex / 20
 *   × missileSystems / 400
 *   × navalPorts / 400
 *   × airports / 400
 *   × academies / 177.7
 *   × forza / 100
 *   × nationBonus × 3
 *   × (education + resistance + level) / 200
 * ) × troopBaseDamage
 */
export function calculateDamage(ctx: DamageContext): DamageBreakdown {
  const troopBaseDamage = TROOP_BASE_DAMAGE[ctx.troopType] || 10;

  // Core formula multipliers (floor each to minimum 1 to avoid zero-out)
  const milMul = Math.max(1, ctx.militaryIndex) / 20;
  const misMul = Math.max(1, ctx.missileSystems) / 400;
  const porMul = Math.max(1, ctx.navalPorts) / 400;
  const airMul = Math.max(1, ctx.airports) / 400;
  const acaMul = Math.max(1, ctx.academies) / ACADEMY_DIVISOR;
  const forMul = Math.max(1, ctx.forza) / 100;
  const natMul = Math.max(0.1, ctx.nationBonus) * 3;
  const statMul = (Math.max(1, ctx.education) + Math.max(1, ctx.resistance) + Math.max(1, ctx.playerLevel)) / 200;

  // Combine formula
  let rawDamage = 1 * milMul * misMul * porMul * airMul * acaMul * forMul * natMul * statMul * troopBaseDamage;

  // Apply quantity
  rawDamage *= ctx.quantity;

  // Patriot bonus (+10%)
  const patriotBonus = ctx.isPatriot ? 0.10 : 0;

  // Department bonus (up to +10%)
  const deptBonus = Math.min(ctx.departmentBonus, GAME_CONFIG.WAR_MAX_DEPARTMENT_BONUS);

  // Distance penalty (up to -99.9%)
  const distPenalty = Math.min(ctx.distancePenalty, GAME_CONFIG.WAR_DISTANCE_PENALTY_MAX);

  // Random factor ±12.5%
  const randomFactor = 1 + (Math.random() * 2 - 1) * GAME_CONFIG.WAR_RANDOM_FACTOR;

  // Final multiplier
  const bonusMultiplier = 1 + patriotBonus + deptBonus - distPenalty;
  const finalDamage = Math.max(1, Math.floor(rawDamage * bonusMultiplier * randomFactor));

  return {
    baseDamage: Math.floor(rawDamage),
    quantity: ctx.quantity,
    militaryIndex: ctx.militaryIndex,
    missileSystems: ctx.missileSystems,
    navalPorts: ctx.navalPorts,
    airports: ctx.airports,
    academies: ctx.academies,
    forza: ctx.forza,
    nationBonus: ctx.nationBonus,
    education: ctx.education,
    resistance: ctx.resistance,
    level: ctx.playerLevel,
    distancePenalty: distPenalty,
    randomFactor,
    departmentBonus: deptBonus,
    patriotBonus,
    troopBaseDamage,
    finalDamage,
  };
}

/**
 * Calculate initial attack damage for a region
 * Formula: academies × 450000
 */
export function calculateInitialAttackDamage(academies: number): number {
  return academies * 450000;
}

/**
 * Calculate initial defense points for a region
 * Formula: sum of buildings × 50000 (with specific weights)
 */
export function calculateInitialDefensePoints(buildings: Record<string, number>): number {
  const weights: Record<string, number> = {
    military_academy: 2.0,
    military_base: 1.5,
    missile_system: 1.3,
    airport: 1.2,
    naval_port: 1.2,
    hospital: 0.8,
    school: 0.7,
    space_port: 1.0,
    power_plant: 0.5,
    real_estate_fund: 0.3,
  };
  let total = 0;
  for (const [type, count] of Object.entries(buildings)) {
    const weight = weights[type] || 0.5;
    total += count * weight;
  }
  return Math.floor(total * 50000);
}

/**
 * Calculate the damage cap (Damage-A) based on player stats
 * Depends on level + resistance; premium increases cap
 */
export function calculateDamageCap(level: number, resistance: number, isPremium: boolean): number {
  const baseCap = (level + resistance) * 500;
  return isPremium ? Math.floor(baseCap * 1.5) : baseCap;
}
