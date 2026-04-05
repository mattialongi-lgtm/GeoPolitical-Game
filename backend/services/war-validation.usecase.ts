import type { WarRepository } from '../repositories/war.repository';
import { haversineDistance, WAR_NAVAL_MAX_DISTANCE_KM } from '../utils/geography';

export interface ValidateWarTypesInput {
  attackerRegionId: string;
  defenderRegionId: string;
}

export async function executeWarValidationUseCase(
  warRepository: WarRepository,
  input: ValidateWarTypesInput,
) {
  const { attackerRegionId, defenderRegionId } = input;

  if (!attackerRegionId || !defenderRegionId) {
    return {
      type: 'validation_error' as const,
      statusCode: 400,
      message: 'Regioni mancanti.',
    };
  }

  if (attackerRegionId === defenderRegionId) {
    return {
      type: 'validation_error' as const,
      statusCode: 400,
      message: 'Non puoi attaccare la stessa regione.',
    };
  }

  const [attackerRegion, defenderRegion] = await Promise.all([
    warRepository.getRegionById(attackerRegionId),
    warRepository.getRegionById(defenderRegionId),
  ]);

  if (!attackerRegion) {
    return { type: 'not_found' as const, statusCode: 404, message: 'Attaccante non trovato.' };
  }
  if (!defenderRegion) {
    return { type: 'not_found' as const, statusCode: 404, message: 'Difensore non trovato.' };
  }

  const allowedTypes: string[] = [];
  let landReason: string | null = null;
  let navalReason: string | null = null;

  // Land verification
  const attackerBorders = attackerRegion.borders || [];
  if (attackerBorders.includes(defenderRegionId)) {
    allowedTypes.push('land');
  } else {
    landReason = `${defenderRegion.name || defenderRegionId} non confina con la regione di partenza.`;
  }

  // Naval verification
  const ac = attackerRegion.coastline;
  const dc = defenderRegion.coastline;
  const dist = haversineDistance(
    attackerRegion.lat, attackerRegion.lng,
    defenderRegion.lat, defenderRegion.lng
  );

  if (ac && dc) {
    if (dist <= WAR_NAVAL_MAX_DISTANCE_KM) {
      allowedTypes.push('naval');
    } else {
      navalReason = `Distanza marittima eccessiva (${Math.round(dist)}km > ${WAR_NAVAL_MAX_DISTANCE_KM}km).`;
    }
  } else {
    if (!ac) navalReason = 'La regione attaccante non ha accesso al mare.';
    else if (!dc) navalReason = 'La regione bersaglio non ha accesso al mare.';
  }

  return {
    type: 'success' as const,
    statusCode: 200,
    payload: {
      allowedTypes,
      reasons: { land: landReason, naval: navalReason },
      distanceKm: dist === Infinity ? null : Math.round(dist)
    },
  };
}
