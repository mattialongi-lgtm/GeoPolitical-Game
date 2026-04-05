import type { MissionReward } from '../../src/types';

export class DailyRewardRepository {
  constructor(private readonly supabase: any) {}

  private throwOnMutationError(error: any, context: string): void {
    if (error) {
      throw new Error(`[DailyRewardRepository] ${context}: ${error.message}`);
    }
  }

  async claimMissionRewardRpc(userId: string, missionId: string) {
    return this.supabase.rpc('claim_mission_reward', {
      p_user_id: userId,
      p_mission_id: missionId,
    });
  }

  async getCompletedMissionForClaim(userId: string, missionId: string) {
    const { data } = await this.supabase
      .from('daily_missions')
      .select('*')
      .eq('id', missionId)
      .eq('user_id', userId)
      .eq('status', 'completed')
      .single();

    return data;
  }

  async markMissionClaimed(missionId: string) {
    const response = await this.supabase
      .from('daily_missions')
      .update({ status: 'claimed', updated_at: new Date().toISOString() })
      .eq('id', missionId);
    this.throwOnMutationError(response.error, 'markMissionClaimed');
    return response;
  }

  async getMissionStatusesForDate(userId: string, date: string) {
    const { data } = await this.supabase
      .from('daily_missions')
      .select('status')
      .eq('user_id', userId)
      .eq('reset_date', date);

    return data || [];
  }

  async getBonusClaimForDate(userId: string, date: string) {
    const { data } = await this.supabase
      .from('daily_mission_bonus_claims')
      .select('id')
      .eq('user_id', userId)
      .eq('claim_date', date)
      .maybeSingle();

    return data;
  }

  async insertBonusClaim(userId: string, date: string, reward: MissionReward) {
    const response = await this.supabase.from('daily_mission_bonus_claims').insert({
      user_id: userId,
      claim_date: date,
      reward,
    });
    this.throwOnMutationError(response.error, 'insertBonusClaim');
    return response;
  }

  async grantRewardToUser(userId: string, reward: MissionReward) {
    const { data: currentUser } = await this.supabase
      .from('users')
      .select('money, gold, xp')
      .eq('id', userId)
      .single();

    if (!currentUser) {
      throw new Error(`User not found for reward grant: ${userId}`);
    }

    const money = currentUser.money || 0;
    const gold = currentUser.gold || 0;
    const xp = currentUser.xp || 0;

    const response = await this.supabase
      .from('users')
      .update({
        money: money + (reward.money || 0),
        gold: gold + (reward.gold || 0),
        xp: xp + (reward.xp || 0),
      })
      .eq('id', userId);
    this.throwOnMutationError(response.error, 'grantRewardToUser');
    return response;
  }
}
