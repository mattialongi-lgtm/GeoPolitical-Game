export class WarRepository {
  constructor(private readonly supabase: any) {}

  private throwOnMutationError(error: any, context: string): void {
    if (error) {
      throw new Error(`[WarRepository] ${context}: ${error.message}`);
    }
  }

  async getActiveWars() {
    const { data } = await this.supabase
      .from('wars')
      .select('*')
      .eq('status', 'active')
      .order('startedAt', { ascending: false });

    return data || [];
  }

  async getEndedWars(limit: number = 20) {
    const { data } = await this.supabase
      .from('wars')
      .select('*')
      .eq('status', 'ended')
      .order('endsAt', { ascending: false })
      .limit(limit);

    return data || [];
  }

  async getWarById(warId: string) {
    const { data } = await this.supabase
      .from('wars')
      .select('*')
      .eq('id', warId)
      .single();

    return data;
  }

  async getWarParticipants(warId: string) {
    const { data } = await this.supabase
      .from('war_participants')
      .select('userId, totalDamage, side, troopsDeployed')
      .eq('warId', warId);

    return data || [];
  }

  async getDamageParticipantsByUser(userId: string) {
    const { data } = await this.supabase
      .from('war_participants')
      .select('warId, totalDamage, side')
      .eq('userId', userId)
      .gt('totalDamage', 0);

    return data || [];
  }

  async getUsersByIds(userIds: string[]) {
    if (userIds.length === 0) return [];

    const { data } = await this.supabase
      .from('users')
      .select('id, username, level, avatarData')
      .in('id', userIds);

    return data || [];
  }

  async getWarDeployLogs() {
    const { data } = await this.supabase
      .from('action_logs')
      .select('*')
      .eq('action', 'WAR_DEPLOY');

    return data || [];
  }

  async getUserWarDeployLogs(userId: string) {
    const { data } = await this.supabase
      .from('action_logs')
      .select('userId, details, timestamp')
      .eq('action', 'WAR_DEPLOY')
      .eq('userId', userId)
      .order('timestamp', { ascending: false });

    return data || [];
  }

  async getWarsByIds(warIds: string[]) {
    if (warIds.length === 0) return [];

    const { data } = await this.supabase
      .from('wars')
      .select('*')
      .in('id', warIds);

    return data || [];
  }

  async getRegionById(regionId: string) {
    const { data } = await this.supabase
      .from('regions')
      .select('*')
      .eq('id', regionId)
      .single();

    return data;
  }

  async getAllRegionsDetailed() {
    const { data } = await this.supabase
      .from('regions')
      .select('id, name, nation_id, borders, coastline, lat, lng');

    return data || [];
  }

  async getAllNationsBasic() {
    const { data } = await this.supabase
      .from('nations')
      .select('id, name, logo');

    return data || [];
  }

  async getActiveWarTouchingRegion(regionId: string) {
    const { data } = await this.supabase
      .from('wars')
      .select('id')
      .eq('status', 'active')
      .or(`"attackerRegionId".eq.${regionId},"defenderRegionId".eq.${regionId}`)
      .limit(1)
      .maybeSingle();

    return data;
  }

  async getActiveRevolution(regionId: string) {
    const { data } = await this.supabase
      .from('revolutions')
      .select('id')
      .eq('regionId', regionId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    return data;
  }

  async getActiveCoup(regionId: string) {
    const { data } = await this.supabase
      .from('coups')
      .select('id')
      .eq('regionId', regionId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    return data;
  }

  async getActiveBlocMembership(stateId: string) {
    const { data } = await this.supabase
      .from('bloc_memberships')
      .select('blocId')
      .eq('stateId', stateId)
      .eq('status', 'active')
      .maybeSingle();

    return data;
  }

  async insertWar(warData: any) {
    const response = await this.supabase.from('wars').insert(warData);
    this.throwOnMutationError(response.error, 'insertWar');
    return response;
  }

  async insertWarParticipant(participant: any) {
    const response = await this.supabase.from('war_participants').insert(participant);
    this.throwOnMutationError(response.error, 'insertWarParticipant');
    return response;
  }

  async insertWarHistory(event: any) {
    const response = await this.supabase.from('war_history').insert(event);
    this.throwOnMutationError(response.error, 'insertWarHistory');
    return response;
  }

  async getRegionNationId(regionId: string) {
    const { data } = await this.supabase
      .from('regions')
      .select('nation_id')
      .eq('id', regionId)
      .maybeSingle();

    return data;
  }

  async getWarDepartmentBonus(stateId: string, departmentType: string) {
    const { data } = await this.supabase
      .from('war_departments')
      .select('bonusPercent')
      .eq('stateId', stateId)
      .eq('departmentType', departmentType)
      .maybeSingle();

    return data;
  }

  async updateUserEnergyAndMoney(userId: string, energy: number, money: number) {
    const response = await this.supabase
      .from('users')
      .update({ energy, money })
      .eq('id', userId);
    this.throwOnMutationError(response.error, 'updateUserEnergyAndMoney');
    return response;
  }

  async updateWarScore(warId: string, updateData: any) {
    const response = await this.supabase
      .from('wars')
      .update(updateData)
      .eq('id', warId);
    this.throwOnMutationError(response.error, 'updateWarScore');
    return response;
  }

  async insertWarDeployment(payload: any) {
    const response = await this.supabase.from('war_deployments').insert(payload);
    this.throwOnMutationError(response.error, 'insertWarDeployment');
    return response;
  }

  async getWarParticipantByWarAndUser(warId: string, userId: string) {
    const { data } = await this.supabase
      .from('war_participants')
      .select('id, totalDamage, troopsDeployed')
      .eq('warId', warId)
      .eq('userId', userId)
      .maybeSingle();

    return data;
  }

  async updateWarParticipantById(participantId: string, payload: any) {
    const response = await this.supabase
      .from('war_participants')
      .update(payload)
      .eq('id', participantId);
    this.throwOnMutationError(response.error, 'updateWarParticipantById');
    return response;
  }

  async insertActionLog(payload: any) {
    const response = await this.supabase.from('action_logs').insert(payload);
    this.throwOnMutationError(response.error, 'insertActionLog');
    return response;
  }

  async runWarDeployRpc(payload: {
    warId: string;
    userId: string;
    side: 'attacker' | 'defender';
    weaponId: string;
    energyCost: number;
    moneyCost: number;
    damage: number;
  }) {
    return this.supabase.rpc('rpc_war_deploy', {
      p_user_id: payload.userId,
      p_war_id: payload.warId,
      p_side: payload.side,
      p_weapon_id: payload.weaponId,
      p_energy_cost: payload.energyCost,
      p_money_cost: payload.moneyCost,
      p_damage: payload.damage,
    });
  }

  async safeDeductCurrency(
    userId: string,
    moneyCost: number,
    goldCost: number,
    energyCost: number,
  ) {
    return this.supabase.rpc('safe_deduct_currency', {
      p_user_id: userId,
      p_money_cost: moneyCost,
      p_gold_cost: goldCost,
      p_energy_cost: energyCost,
    });
  }
}
