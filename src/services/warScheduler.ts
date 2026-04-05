import { GAME_CONFIG } from '../types';

/**
 * Check if an auto-attack should fire based on type and last fired time
 */
export function shouldAutoAttackFire(
  autoType: 'hourly' | 'maximum',
  lastFiredAt: string | null,
  activatedAt: string,
  now: number = Date.now()
): boolean {
  const interval = autoType === 'hourly'
    ? GAME_CONFIG.WAR_AUTO_HOURLY_INTERVAL_MS
    : GAME_CONFIG.WAR_AUTO_MAX_INTERVAL_MS;

  // Check if expired (24h from activation)
  const activatedTime = new Date(activatedAt).getTime();
  if (now - activatedTime > GAME_CONFIG.WAR_AUTO_EXPIRE_MS) {
    return false;
  }

  // Check interval
  if (!lastFiredAt) return true;
  const lastTime = new Date(lastFiredAt).getTime();
  return (now - lastTime) >= interval;
}

/**
 * Get all wars that should be resolved (endsAt has passed)
 */
export function getWarsToResolve(wars: Array<{ id: string; endsAt: string | number; status: string }>): string[] {
  const now = Date.now();
  return wars
    .filter(w => w.status === 'active' && new Date(w.endsAt).getTime() <= now)
    .map(w => w.id);
}

/**
 * Get wars that need naval phase transition
 */
export function getNavalWarsForPhaseTransition(
  wars: Array<{ id: string; warType: string; navalPhase: number; createdAt: string; status: string }>
): string[] {
  const now = Date.now();
  return wars
    .filter(w =>
      w.status === 'active' &&
      w.warType === 'naval' &&
      w.navalPhase === 1 &&
      (now - new Date(w.createdAt).getTime()) >= GAME_CONFIG.WAR_NAVAL_PHASE_DURATION_MS
    )
    .map(w => w.id);
}
