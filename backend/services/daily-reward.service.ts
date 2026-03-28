import type { MissionReward } from '../../src/types';
import { DAILY_GAMEPLAY_CONFIG } from '../../src/types';
import { DailyRewardRepository } from '../repositories/daily-reward.repository';
import { serviceSuccess, systemError, type ServiceResult, validationError } from './service-result';

export class DailyRewardService {
  constructor(private readonly repository: DailyRewardRepository) {}

  async claimMissionReward(userId: string, missionId: string): Promise<ServiceResult<any>> {
    const { data, error } = await this.repository.claimMissionRewardRpc(userId, missionId);

    if (error) {
      return systemError(error.message, { source: 'claimMissionRewardRpc' });
    }

    const result = typeof data === 'string' ? JSON.parse(data) : data;

    if (result?.error) {
      return validationError(result.error);
    }

    if (result?.success) {
      return serviceSuccess(result);
    }

    // Compatibility fallback (legacy DBs missing/altering RPC behavior).
    const mission = await this.repository.getCompletedMissionForClaim(userId, missionId);

    if (!mission) {
      return validationError('Missione non trovata o non completata');
    }

    const reward = mission.reward as MissionReward;

    await this.repository.markMissionClaimed(missionId);
    await this.repository.grantRewardToUser(userId, reward);

    return serviceSuccess(
      {
        success: true,
        mission_key: mission.mission_key,
        reward: mission.reward,
      },
      200,
      { fallbackUsed: true },
    );
  }

  async claimDailyBonus(userId: string): Promise<ServiceResult<any>> {
    const today = new Date().toISOString().slice(0, 10);

    const missions = await this.repository.getMissionStatusesForDate(userId, today);
    if (!missions || missions.length === 0) {
      return validationError('Nessuna missione trovata per oggi');
    }

    const allClaimed = missions.every((m: any) => m.status === 'claimed');
    if (!allClaimed) {
      return validationError('Devi prima riscattare tutte le missioni completate');
    }

    const existing = await this.repository.getBonusClaimForDate(userId, today);
    if (existing) {
      return validationError('Bonus già riscattato oggi');
    }

    const bonus = DAILY_GAMEPLAY_CONFIG.DAILY_MISSIONS_BONUS;

    await this.repository.insertBonusClaim(userId, today, bonus);
    await this.repository.grantRewardToUser(userId, bonus);

    return serviceSuccess({
      success: true,
      reward: bonus,
    });
  }
}
