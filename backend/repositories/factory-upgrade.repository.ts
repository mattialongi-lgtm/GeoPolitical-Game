export class FactoryUpgradeRepository {
  constructor(private readonly supabase: any) {}

  async getFactoryById(factoryId: string) {
    const { data } = await this.supabase
      .from('factories')
      .select('*')
      .eq('id', factoryId)
      .maybeSingle();

    return data;
  }

  async runUpgradeFactoryRpc(factoryId: string, targetLevel: number, userId: string) {
    return this.supabase.rpc('upgrade_factory', {
      p_factory_id: factoryId,
      p_target_level: targetLevel,
      p_user_id: userId,
    });
  }

  async getFactoryAggregateCost(levelTo: number) {
    const { data } = await this.supabase
      .from('factory_upgrade_costs')
      .select('aggregate_cost')
      .eq('level_to', levelTo)
      .maybeSingle();

    return data;
  }

  async getUserGold(userId: string): Promise<number> {
    const { data } = await this.supabase
      .from('users')
      .select('gold')
      .eq('id', userId)
      .single();

    return Number(data?.gold || 0);
  }

  async tryUpdateUserGoldWithCAS(userId: string, expectedGold: number, nextGold: number): Promise<boolean> {
    const { data } = await this.supabase
      .from('users')
      .update({ gold: nextGold })
      .eq('id', userId)
      .eq('gold', expectedGold)
      .select('id')
      .maybeSingle();

    return !!data;
  }

  async tryUpdateFactoryLevelWithCAS(factoryId: string, expectedLevel: number, nextLevel: number): Promise<boolean> {
    const { data } = await this.supabase
      .from('factories')
      .update({ level: nextLevel })
      .eq('id', factoryId)
      .eq('level', expectedLevel)
      .select('id')
      .maybeSingle();

    return !!data;
  }
}
