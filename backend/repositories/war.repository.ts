export class WarRepository {
  constructor(private readonly supabase: any) {}

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

  async getRegionById(regionId: string) {
    const { data } = await this.supabase
      .from('regions')
      .select('*')
      .eq('id', regionId)
      .single();

    return data;
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
    return this.supabase.from('wars').insert(warData);
  }

  async insertWarParticipant(participant: any) {
    return this.supabase.from('war_participants').insert(participant);
  }

  async insertWarHistory(event: any) {
    return this.supabase.from('war_history').insert(event);
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
    return this.supabase
      .from('users')
      .update({ energy, money })
      .eq('id', userId);
  }

  async updateWarScore(warId: string, updateData: any) {
    return this.supabase
      .from('wars')
      .update(updateData)
      .eq('id', warId);
  }

  async insertWarDeployment(payload: any) {
    return this.supabase.from('war_deployments').insert(payload);
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
    return this.supabase
      .from('war_participants')
      .update(payload)
      .eq('id', participantId);
  }

  async insertActionLog(payload: any) {
    return this.supabase.from('action_logs').insert(payload);
  }
}
