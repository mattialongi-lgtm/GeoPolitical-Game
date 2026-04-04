/**
 * ExtractionService — business logic for resource extraction.
 *
 * Encapsulates computation helpers (daily limits, cap calculation,
 * XP tracking) that are currently inlined in handlers.  The DB calls
 * still go through supabase directly for now — repository extraction
 * is a future step.
 */

import {
  serviceSuccess,
  validationError,
  notFoundError,
  systemError,
  type ServiceResult,
} from './service-result';

export class ExtractionService {
  constructor(private readonly supabase: any) {}

  /**
   * Get player extraction state for a specific region.
   */
  async getPlayerState(
    playerId: string,
    regionId: string,
  ): Promise<ServiceResult<any>> {
    const { data: states, error } = await this.supabase
      .from('player_extraction_state')
      .select('*')
      .eq('playerId', playerId)
      .eq('regionId', regionId);

    if (error) return systemError(error.message);
    return serviceSuccess({ states: states || [] });
  }

  /**
   * Get recharge info (cooldown, cost, role check).
   */
  async getRechargeInfo(
    regionId: string,
    resourceType: string,
    getSetting: (key: string) => Promise<any>,
  ): Promise<ServiceResult<any>> {
    if (!regionId || !resourceType) {
      return validationError('regionId e resourceType obbligatori');
    }

    const cooldownSec =
      parseInt(await getSetting('recharge_cooldown_seconds')) || 7200;
    const costEur =
      parseInt(await getSetting('recharge_cost_eur')) || 50000;

    const { data: rechargeData } = await this.supabase
      .from('resource_recharges')
      .select('*')
      .eq('regionId', regionId)
      .eq('resourceType', resourceType)
      .maybeSingle();

    let cooldownRemaining = 0;
    if (rechargeData?.lastRechargeAt) {
      const elapsed =
        (Date.now() - new Date(rechargeData.lastRechargeAt).getTime()) / 1000;
      cooldownRemaining = Math.max(0, cooldownSec - elapsed);
    }

    const { data: budget } = await this.supabase
      .from('budgets')
      .select('moneyEUR')
      .eq('ownerType', 'REGION')
      .eq('ownerId', regionId)
      .maybeSingle();

    return serviceSuccess({
      cooldownRemaining: Math.ceil(cooldownRemaining),
      cooldownTotal: cooldownSec,
      costEur,
      lastRechargeAt: rechargeData?.lastRechargeAt || null,
      treasuryEur: budget?.moneyEUR || 0,
      canAfford: (budget?.moneyEUR || 0) >= costEur,
    });
  }

  /**
   * Get leaderboard of top extractors in the last 24h.
   */
  async getLeaderboard(regionId?: string): Promise<ServiceResult<any>> {
    const since24h = new Date(
      Date.now() - 24 * 60 * 60 * 1000,
    ).toISOString();

    let query = this.supabase
      .from('extraction_detailed_logs')
      .select('playerId, playerAmount, resourceType')
      .gte('createdAt', since24h);

    if (regionId) query = query.eq('regionId', regionId);

    const { data: logs } = await query;

    const playerTotals: Record<string, number> = {};
    for (const log of logs || []) {
      playerTotals[log.playerId] =
        (playerTotals[log.playerId] || 0) + Number(log.playerAmount || 0);
    }

    const sorted = Object.entries(playerTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    const playerIds = sorted.map(([id]) => id);
    const usernameMap: Record<string, any> = {};
    if (playerIds.length > 0) {
      const { data: users } = await this.supabase
        .from('users')
        .select('id, username, level')
        .in('id', playerIds);
      for (const u of users || []) usernameMap[u.id] = u;
    }

    const leaderboard = sorted.map(([id, total]) => ({
      playerId: id,
      username: usernameMap[id]?.username || 'Unknown',
      level: usernameMap[id]?.level || 1,
      totalExtracted: Math.round(total),
    }));

    return serviceSuccess({ leaderboard });
  }
}
