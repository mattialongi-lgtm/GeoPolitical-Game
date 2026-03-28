import type { WarType } from '../../src/types';

export interface WarDomainDeps {
  validateWarCreation: (input: any) => { valid: boolean; error?: string };
  getRegionBuildings: (regionId: string) => Promise<Record<string, number>>;
  calculateInitialAttackDamage: (militaryAcademyLevel: number) => number;
  calculateInitialDefensePoints: (buildings: Record<string, number>) => number;
  calculateDistancePenalty: (distanceKm: number, maxDistanceKm: number) => number;
  getWarDuration: (warType: WarType) => number;
  generateWarId: () => string;
  validateTroopDeployment: (...args: any[]) => { valid: boolean; error?: string; energyCost: number; moneyCost: number };
  getUserPerks: (userId: string) => Promise<Record<string, number>>;
  getMaxDeployableTroops: (...args: any[]) => number;
  calculateRegionalIndices: (buildings: Record<string, number>) => { militaryIndex: number };
  calculateDamage: (input: any) => { baseDamage: number; finalDamage: number; [key: string]: any };
  addXP: (userId: string, amount: number) => Promise<void>;
  updateMissionProgress: (userId: string, action: string, payload: Record<string, number>) => Promise<void>;
  troopEnergyCostByType: Record<string, number>;
  xpPerAttack: number;
}

interface CreateWarDomainDepsInput {
  supabase: any;
  validateWarCreation: WarDomainDeps['validateWarCreation'];
  getRegionBuildings: WarDomainDeps['getRegionBuildings'];
  calculateInitialAttackDamage: WarDomainDeps['calculateInitialAttackDamage'];
  calculateInitialDefensePoints: WarDomainDeps['calculateInitialDefensePoints'];
  calculateDistancePenalty: WarDomainDeps['calculateDistancePenalty'];
  getWarDuration: WarDomainDeps['getWarDuration'];
  generateWarId: WarDomainDeps['generateWarId'];
  validateTroopDeployment: WarDomainDeps['validateTroopDeployment'];
  getMaxDeployableTroops: WarDomainDeps['getMaxDeployableTroops'];
  calculateRegionalIndices: WarDomainDeps['calculateRegionalIndices'];
  calculateDamage: WarDomainDeps['calculateDamage'];
  addXP: WarDomainDeps['addXP'];
  updateMissionProgress: WarDomainDeps['updateMissionProgress'];
  troopEnergyCostByType: WarDomainDeps['troopEnergyCostByType'];
  xpPerAttack: WarDomainDeps['xpPerAttack'];
}

export function createWarDomainDeps(input: CreateWarDomainDepsInput): WarDomainDeps {
  const getUserPerks: WarDomainDeps['getUserPerks'] = async (userId: string) => {
    const { data: perks } = await input.supabase.from('perks').select('perkId, level').eq('userId', userId);
    const perkMap: Record<string, number> = {};
    if (perks) {
      perks.forEach((p: any) => {
        perkMap[p.perkId] = p.level;
      });
    }
    return perkMap;
  };

  return {
    validateWarCreation: input.validateWarCreation,
    getRegionBuildings: input.getRegionBuildings,
    calculateInitialAttackDamage: input.calculateInitialAttackDamage,
    calculateInitialDefensePoints: input.calculateInitialDefensePoints,
    calculateDistancePenalty: input.calculateDistancePenalty,
    getWarDuration: input.getWarDuration,
    generateWarId: input.generateWarId,
    validateTroopDeployment: input.validateTroopDeployment,
    getUserPerks,
    getMaxDeployableTroops: input.getMaxDeployableTroops,
    calculateRegionalIndices: input.calculateRegionalIndices,
    calculateDamage: input.calculateDamage,
    addXP: input.addXP,
    updateMissionProgress: input.updateMissionProgress,
    troopEnergyCostByType: input.troopEnergyCostByType,
    xpPerAttack: input.xpPerAttack,
  };
}
