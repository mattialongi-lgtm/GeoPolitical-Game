import type { WarType } from '../../src/types';
import type { WarRepository } from '../repositories/war.repository';
import type { WarDomainDeps } from './war-domain.helpers';
import { haversineDistance } from '../utils/geography';

export interface CreateWarInput {
  userId: string;
  attackerRegionId: string;
  defenderRegionId: string;
  warType: WarType;
}

export async function executeWarCreateUseCase(
  warRepository: WarRepository,
  deps: WarDomainDeps,
  input: CreateWarInput,
) {
  const { userId, attackerRegionId, defenderRegionId, warType } = input;

  if (!attackerRegionId || !defenderRegionId || !warType) {
    return {
      type: 'validation_error' as const,
      statusCode: 400,
      message: 'Dati mancanti: attackerRegionId, defenderRegionId, warType.',
    };
  }

  const [attackerRegion, defenderRegion] = await Promise.all([
    warRepository.getRegionById(attackerRegionId),
    warRepository.getRegionById(defenderRegionId),
  ]);

  if (!attackerRegion) {
    return { type: 'not_found' as const, statusCode: 404, message: 'Regione attaccante non trovata.' };
  }

  if (!defenderRegion) {
    return { type: 'not_found' as const, statusCode: 404, message: 'Regione difensore non trovata.' };
  }

  if (attackerRegion.ownerUserId !== userId && attackerRegion.leaderUserId !== userId) {
    return {
      type: 'forbidden' as const,
      statusCode: 403,
      message: 'Devi essere il leader della regione attaccante.',
    };
  }

  const [existingWar, activeRevolution, activeCoup, attackerBloc, defenderBloc] = await Promise.all([
    warRepository.getActiveWarTouchingRegion(defenderRegionId),
    warRepository.getActiveRevolution(defenderRegionId),
    warRepository.getActiveCoup(defenderRegionId),
    warRepository.getActiveBlocMembership(attackerRegion.nation_id),
    warRepository.getActiveBlocMembership(defenderRegion.nation_id),
  ]);

  const attackerBorders = attackerRegion.borders || [];
  const areAdjacent = attackerBorders.includes(defenderRegionId);
  const attackerHasSeaAccess = attackerRegion.coastline || false;
  const defenderHasSeaAccess = defenderRegion.coastline || false;
  const distanceKm = haversineDistance(
    attackerRegion.lat, attackerRegion.lng,
    defenderRegion.lat, defenderRegion.lng
  );

  const validation = deps.validateWarCreation({
    attackerRegionId,
    defenderRegionId,
    warType,
    attackerNationId: attackerRegion.nation_id,
    defenderNationId: defenderRegion.nation_id,
    attackerBlocId: attackerBloc?.blocId || null,
    defenderBlocId: defenderBloc?.blocId || null,
    defenderUnderAttack: !!existingWar,
    defenderInForcedPeace: false,
    defenderHasRevolution: !!activeRevolution,
    defenderHasCoup: !!activeCoup,
    areAdjacent,
    attackerHasSeaAccess,
    defenderHasSeaAccess,
    distanceKm,
    attackerHasSpaceport: true,
  });


  if (!validation.valid) {
    return {
      type: 'validation_error' as const,
      statusCode: 400,
      message: validation.error,
    };
  }

  const [attackerBuildings, defenderBuildings] = await Promise.all([
    deps.getRegionBuildings(attackerRegionId),
    deps.getRegionBuildings(defenderRegionId),
  ]);

  const initialAttack = deps.calculateInitialAttackDamage(attackerBuildings['military_academy'] || 0);
  const initialDefense = deps.calculateInitialDefensePoints(defenderBuildings);
  const distancePenalty = deps.calculateDistancePenalty(500, 20000);

  const warId = deps.generateWarId();
  const duration = deps.getWarDuration(warType);
  const now = new Date();
  const endsAt = new Date(now.getTime() + duration);

  const warData: any = {
    id: warId,
    attackerCountryIso2: attackerRegion.nation_id || attackerRegionId,
    defenderCountryIso2: defenderRegion.nation_id || defenderRegionId,
    attackerUserId: userId,
    defenderUserId: defenderRegion.leaderUserId || defenderRegion.ownerUserId || null,
    status: 'active',
    startedAt: now.toISOString(),
    endsAt: endsAt.toISOString(),
    attackerScore: initialAttack,
    defenderScore: initialDefense,
    warType,
    attackerRegionId,
    defenderRegionId,
    navalPhase: warType === 'naval' ? 1 : 0,
    initialAttackDamage: initialAttack,
    initialDefenseDamage: initialDefense,
    distancePenalty,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  const { error: insertError } = await warRepository.insertWar(warData);
  if (insertError) {
    return {
      type: 'system_error' as const,
      statusCode: 500,
      message: `Errore nella creazione della guerra: ${insertError.message}`,
    };
  }

  await warRepository.insertWarParticipant({
    warId,
    userId,
    side: 'attacker',
    totalDamage: 0,
    troopsDeployed: {},
  });

  await warRepository.insertWarHistory({
    warId,
    eventType: 'war_started',
    eventData: {
      warType,
      attackerRegionId,
      defenderRegionId,
      attackerNation: attackerRegion.nation_id,
      defenderNation: defenderRegion.nation_id,
      initiatorUserId: userId,
    },
  });

  return {
    type: 'success' as const,
    statusCode: 200,
    payload: { success: true, warId, war: warData },
  };
}
