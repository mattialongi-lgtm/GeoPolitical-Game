import type { TroopType, WarSide, WarType } from '../../src/types';
import type { WarRepository } from '../repositories/war.repository';
import type { WarDomainDeps } from './war-domain.helpers';

export interface DeployTroopsInput {
  user: any;
  warId: string;
  side: WarSide;
  troopType: TroopType;
  quantity: number;
}

export async function executeWarDeployUseCase(
  warRepository: WarRepository,
  deps: WarDomainDeps,
  input: DeployTroopsInput,
) {
  const { user, warId, side, troopType, quantity } = input;

  if (!warId || !side || !troopType) {
    return { type: 'validation_error' as const, statusCode: 400, message: 'Dati mancanti.' };
  }

  const qty = Math.max(1, Math.floor(quantity || 1));

  const war = await warRepository.getWarById(warId);
  if (!war) return { type: 'not_found' as const, statusCode: 404, message: 'Guerra inesistente.' };
  if (war.status !== 'active') return { type: 'validation_error' as const, statusCode: 400, message: 'Questa guerra è già terminata.' };

  const troopValidation = deps.validateTroopDeployment(
    troopType,
    qty,
    (war.warType || 'land') as WarType,
    war.navalPhase || 0,
    user.energy,
    user.money,
  );

  if (!troopValidation.valid) {
    return { type: 'validation_error' as const, statusCode: 400, message: troopValidation.error };
  }

  const perks = await deps.getUserPerks(user.id);
  const resistance = perks['RESISTENZA'] || 0;
  const maxTroops = deps.getMaxDeployableTroops(
    troopType,
    user.level || 1,
    resistance,
    !!user.isPremium,
  );

  if (qty > maxTroops) {
    return {
      type: 'validation_error' as const,
      statusCode: 400,
      message: `Massimo ${maxTroops} truppe di tipo ${troopType} dispiegabili.`,
    };
  }

  const warRegionId = side === 'attacker' ? war.attackerRegionId : war.defenderRegionId;
  let militaryIndex = 1;
  let missileSystems = 0;
  let navalPorts = 0;
  let airports = 0;
  let academies = 0;

  if (warRegionId) {
    try {
      const buildings = await deps.getRegionBuildings(warRegionId);
      const indices = deps.calculateRegionalIndices(buildings);
      militaryIndex = indices.militaryIndex;
      missileSystems = buildings['missile_system'] || 0;
      navalPorts = buildings['naval_port'] || 0;
      airports = buildings['airport'] || 0;
      academies = buildings['military_academy'] || 0;
    } catch {
      // use defaults
    }
  }

  let departmentBonus = 0;
  const nationId = side === 'attacker' ? war.attackerCountryIso2 : war.defenderCountryIso2;
  if (nationId) {
    const deptType = ['battleship'].includes(troopType) ? 'naval'
      : ['lunar_tank', 'space_station'].includes(troopType) ? 'space'
      : 'land';
    const dept = await warRepository.getWarDepartmentBonus(nationId, deptType);
    if (dept) departmentBonus = (dept.bonusPercent || 0) / 100;
  }

  let isPatriot = false;
  if (user.regionId) {
    const userRegion = await warRepository.getRegionNationId(user.regionId);
    if (userRegion?.nation_id === nationId) isPatriot = true;
  }

  const damageResult = deps.calculateDamage({
    troopType,
    quantity: qty,
    militaryIndex,
    missileSystems,
    navalPorts,
    airports,
    academies,
    forza: perks['FORZA'] || 0,
    nationBonus: 1,
    education: perks['ISTRUZIONE'] || 0,
    resistance,
    playerLevel: user.level || 1,
    distancePenalty: war.distancePenalty || 0,
    departmentBonus,
    isPatriot,
    side,
  });

  const scoreField: 'attackerScore' | 'defenderScore' = side === 'attacker' ? 'attackerScore' : 'defenderScore';
  const isNavalPhase1 = war.warType === 'naval' && war.navalPhase === 1;
  const updateField: 'attackerScore' | 'defenderScore' | 'phase1AttackerScore' | 'phase1DefenderScore' = isNavalPhase1
    ? (side === 'attacker' ? 'phase1AttackerScore' : 'phase1DefenderScore')
    : scoreField;

  const actionDetails = {
    warId,
    side,
    troopType,
    quantity: qty,
    damage: damageResult.finalDamage,
    username: user.username,
    isPatriot,
  };

  // RPC-first source of truth for atomic deploy.
  // XP / missions remain intentionally outside transaction as non-critical side effects.
  try {
    const { data, error } = await warRepository.runWarDeployRpc({
      warId,
      userId: user.id,
      side,
      troopType,
      quantity: qty,
      energyCost: troopValidation.energyCost,
      moneyCost: troopValidation.moneyCost,
      baseDamage: damageResult.baseDamage,
      finalDamage: damageResult.finalDamage,
      bonuses: damageResult,
      updateField,
      actionDetails,
    });

    if (!error && data) {
      const result = typeof data === 'string' ? JSON.parse(data) : data;
      if (result?.error) {
        return { type: 'validation_error' as const, statusCode: 400, message: result.error };
      }
    } else if (error) {
      throw error;
    }
  } catch (rpcErr: any) {
    console.warn('[war-deploy] rpc_war_deploy failed, using legacy fallback', {
      warId,
      userId: user.id,
      side,
      troopType,
      quantity: qty,
      error: rpcErr?.message,
    });

    // Legacy fallback (temporary): sequential and non-atomic.
    await warRepository.updateUserEnergyAndMoney(
      user.id,
      user.energy - troopValidation.energyCost,
      user.money - troopValidation.moneyCost,
    );

    await warRepository.updateWarScore(warId, {
      [updateField]: (war[updateField] || 0) + damageResult.finalDamage,
      updatedAt: new Date().toISOString(),
    });

    await warRepository.insertWarDeployment({
      warId,
      userId: user.id,
      side,
      troopType,
      quantity: qty,
      baseDamage: damageResult.baseDamage,
      finalDamage: damageResult.finalDamage,
      bonuses: damageResult,
    });

    const existingParticipant = await warRepository.getWarParticipantByWarAndUser(warId, user.id);
    if (existingParticipant) {
      const deployed = existingParticipant.troopsDeployed || {};
      deployed[troopType] = (deployed[troopType] || 0) + qty;
      await warRepository.updateWarParticipantById(existingParticipant.id, {
        totalDamage: (existingParticipant.totalDamage || 0) + damageResult.finalDamage,
        troopsDeployed: deployed,
      });
    } else {
      await warRepository.insertWarParticipant({
        warId,
        userId: user.id,
        side,
        totalDamage: damageResult.finalDamage,
        troopsDeployed: { [troopType]: qty },
      });
    }

    await warRepository.insertActionLog({
      userId: user.id,
      action: 'WAR_DEPLOY',
      details: JSON.stringify(actionDetails),
      timestamp: Date.now(),
    });
  }

  await deps.addXP(user.id, deps.xpPerAttack);

  try {
    await deps.updateMissionProgress(user.id, 'WAR_DEPLOY', {
      deal_damage: damageResult.finalDamage || 0,
      fight_battles: 1,
      deploy_troops: qty,
      spend_energy: (deps.troopEnergyCostByType[troopType] || 0) * qty,
    });
    await deps.updateMissionProgress(user.id, 'EARN_XP', {
      earn_xp: deps.xpPerAttack || 0,
    });
  } catch {
    // non-critical
  }

  return {
    type: 'success' as const,
    statusCode: 200,
    payload: {
      success: true,
      damageDealt: damageResult.finalDamage,
      breakdown: damageResult,
      side,
      troopType,
      quantity: qty,
    },
  };
}
