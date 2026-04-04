/**
 * Daily Missions Handlers
 *
 * Extracted from server.ts — no logic changes.
 * Covers: /api/daily/missions, /api/daily/missions/claim/:id,
 *   /api/daily/missions/claim-bonus
 */
export function createDailyHandlers(deps: {
  supabase: any;
  ensureDailyMissions: (userId: string, playerLevel: number) => Promise<any[]>;
  dailyRewardService: any;
  mapServiceResultToHttp: (result: any) => { statusCode: number; body: any };
  isDailyMissionClaimSuccess: (payload: any) => boolean;
  isDailyBonusClaimSuccess: (payload: any) => boolean;
  DAILY_GAMEPLAY_CONFIG: any;
}) {
  const { supabase, ensureDailyMissions, dailyRewardService, mapServiceResultToHttp, isDailyMissionClaimSuccess, isDailyBonusClaimSuccess, DAILY_GAMEPLAY_CONFIG } = deps;

  // GET /api/daily/missions
  async function getDailyMissions(req: any, res: any) {
    try {
      const user = req.user;
      const today = new Date().toISOString().slice(0, 10);

      const missions = await ensureDailyMissions(user.id, user.level || 1);

      // Check bonus claim status
      const { data: bonusClaim } = await supabase
        .from('daily_mission_bonus_claims')
        .select('id')
        .eq('user_id', user.id)
        .eq('claim_date', today)
        .maybeSingle();

      return res.json({
        missions,
        resetDate: today,
        bonusClaimed: !!bonusClaim,
        bonusReward: DAILY_GAMEPLAY_CONFIG.DAILY_MISSIONS_BONUS,
      });
    } catch (err: any) {
      console.error('[DailyMissions] GET error:', err);
      return res.status(500).json({ error: 'Errore nel recupero missioni giornaliere' });
    }
  }

  // POST /api/daily/missions/claim/:id
  async function claimMission(req: any, res: any) {
    try {
      const user = req.user;
      const missionId = req.params.id;

      const claimResult = await dailyRewardService.claimMissionReward(user.id, missionId);

      if (claimResult.type !== 'success') {
        if (claimResult.type === 'validation_error') {
          console.warn('[DailyMissions][claim][validation_error]', { userId: user.id, missionId, message: claimResult.message });
        } else {
          console.error('[DailyMissions][claim][system_error]', { userId: user.id, missionId, message: claimResult.message });
        }
        const http = mapServiceResultToHttp(claimResult);
        return res.status(http.statusCode).json(http.body);
      }

      if (!isDailyMissionClaimSuccess(claimResult.payload)) {
        console.error('[ContractViolation] POST /api/daily/missions/claim/:id unexpected payload shape', {
          userId: user.id,
          missionId,
        });
      }

      const http = mapServiceResultToHttp(claimResult);
      return res.status(http.statusCode).json(http.body);
    } catch (err: any) {
      console.error('[DailyMissions] Claim error:', err);
      return res.status(500).json({ error: 'Errore nel riscatto della missione' });
    }
  }

  // POST /api/daily/missions/claim-bonus
  async function claimBonus(req: any, res: any) {
    try {
      const user = req.user;
      const bonusResult = await dailyRewardService.claimDailyBonus(user.id);

      if (bonusResult.type !== 'success') {
        if (bonusResult.type === 'validation_error') {
          console.warn('[DailyMissions][claim-bonus][validation_error]', { userId: user.id, message: bonusResult.message });
        } else {
          console.error('[DailyMissions][claim-bonus][system_error]', { userId: user.id, message: bonusResult.message });
        }
        const http = mapServiceResultToHttp(bonusResult);
        return res.status(http.statusCode).json(http.body);
      }

      if (!isDailyBonusClaimSuccess(bonusResult.payload)) {
        console.error('[ContractViolation] POST /api/daily/missions/claim-bonus unexpected payload shape', {
          userId: user.id,
        });
      }

      const http = mapServiceResultToHttp(bonusResult);
      return res.status(http.statusCode).json(http.body);
    } catch (err: any) {
      console.error('[DailyMissions] Bonus claim error:', err);
      return res.status(500).json({ error: 'Errore nel riscatto del bonus' });
    }
  }

  return {
    getDailyMissions,
    claimMission,
    claimBonus,
  };
}
