const isObject = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null;

export function isWarsListResponse(payload: unknown): boolean {
  if (!isObject(payload)) return false;
  return Array.isArray(payload.active) && Array.isArray(payload.ended);
}

export function isWarStatsResponse(payload: unknown): boolean {
  if (!isObject(payload)) return false;
  if (!('war' in payload) || !('stats' in payload)) return false;
  if (!isObject(payload.stats)) return false;
  return Array.isArray(payload.stats.attacker) && Array.isArray(payload.stats.defender);
}

export function isPlayerDamageSummaryResponse(payload: unknown): boolean {
  if (!isObject(payload)) return false;
  return typeof payload.totalDamage === 'number' && Array.isArray(payload.wars);
}

export function isDailyMissionClaimSuccess(payload: unknown): boolean {
  if (!isObject(payload)) return false;
  return payload.success === true && typeof payload.mission_key === 'string' && isObject(payload.reward);
}

export function isDailyBonusClaimSuccess(payload: unknown): boolean {
  if (!isObject(payload)) return false;
  return payload.success === true && isObject(payload.reward);
}
