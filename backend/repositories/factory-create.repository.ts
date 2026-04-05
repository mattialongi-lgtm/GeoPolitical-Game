export class FactoryCreateRepository {
  constructor(private readonly supabase: any) {}

  private throwOnMutationError(error: any, context: string): void {
    if (error) {
      throw new Error(`[FactoryCreateRepository] ${context}: ${error.message}`);
    }
  }

  async getUserMoney(userId: string): Promise<number> {
    const { data } = await this.supabase
      .from('users')
      .select('money')
      .eq('id', userId)
      .single();

    return Number(data?.money || 0);
  }

  async deductUserMoney(userId: string, amount: number): Promise<string | null> {
    const { data, error } = await this.supabase.rpc('safe_deduct_currency', {
      p_user_id: userId,
      p_money_cost: amount,
      p_gold_cost: 0,
      p_energy_cost: 0,
    });

    if (error) {
      throw new Error(error.message);
    }

    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    if (parsed?.error) {
      return parsed.error;
    }

    return null;
  }

  async insertFactory(payload: any) {
    const response = await this.supabase
      .from('factories')
      .insert(payload)
      .select()
      .single();
    this.throwOnMutationError(response.error, 'insertFactory');
    return response;
  }

  async tryUpdateUserMoneyWithCAS(userId: string, expectedMoney: number, nextMoney: number): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('users')
      .update({ money: nextMoney })
      .eq('id', userId)
      .eq('money', expectedMoney)
      .select('id')
      .maybeSingle();

    this.throwOnMutationError(error, 'tryUpdateUserMoneyWithCAS');
    return !!data;
  }
}
