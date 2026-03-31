import type { WarRepository } from '../repositories/war.repository';
import { haversineDistance, WAR_NAVAL_MAX_DISTANCE_KM } from '../utils/geography';

export interface GetValidWarTargetsInput {
  attackerRegionId: string;
}

export async function executeGetValidWarTargetsUseCase(
  warRepository: WarRepository,
  input: GetValidWarTargetsInput,
) {
  const { attackerRegionId } = input;

  if (!attackerRegionId) {
    return {
      type: 'validation_error' as const,
      statusCode: 400,
      message: 'Regione attaccante mancante.',
    };
  }

  const attackerRegion = await warRepository.getRegionById(attackerRegionId);
  if (!attackerRegion) {
    return { type: 'not_found' as const, statusCode: 404, message: 'Attaccante non trovato.' };
  }

  const allRegions = await warRepository.getAllRegionsDetailed();
  
  const validTargets = [];

  for (const targetRegion of allRegions) {
    // Cannot attack oneself or regions of the same nation
    if (targetRegion.id === attackerRegion.id || targetRegion.nation_id === attackerRegion.nation_id) {
      continue;
    }

    const allowedTypes: string[] = [];

    // Land Check
    const attackerBorders = attackerRegion.borders || [];
    if (attackerBorders.includes(targetRegion.id)) {
      allowedTypes.push('land');
    }

    // Naval Check
    if (attackerRegion.coastline && targetRegion.coastline) {
      const dist = haversineDistance(
        attackerRegion.lat, attackerRegion.lng,
        targetRegion.lat, targetRegion.lng
      );
      if (dist <= WAR_NAVAL_MAX_DISTANCE_KM) {
        allowedTypes.push('naval');
      }
    }

    if (allowedTypes.length > 0) {
      validTargets.push({
        id: targetRegion.id,
        name: targetRegion.name,
        nation_id: targetRegion.nation_id,
        allowedTypes
      });
    }
  }

  // Sort alphabetically by name
  validTargets.sort((a, b) => a.name.localeCompare(b.name));

  return {
    type: 'success' as const,
    statusCode: 200,
    payload: validTargets,
  };
}
