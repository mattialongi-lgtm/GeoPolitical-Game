import type { MissionReward } from '../../src/types';

export class DailyRewardRepository {
  constructor(private readonly supabase: any) {}

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
    return this.supabase
      .from('daily_missions')
      .update({ status: 'claimed', updated_at: new Date().toISOString() })
      .eq('id', missionId);
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
    return this.supabase.from('daily_mission_bonus_claims').insert({
      user_id: userId,
      claim_date: date,
      reward,
    });
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

    return this.supabase
      .from('users')
      .update({
        money: money + (reward.money || 0),
        gold: gold + (reward.gold || 0),
        xp: xp + (reward.xp || 0),
      })
      .eq('id', userId);
  }
}
