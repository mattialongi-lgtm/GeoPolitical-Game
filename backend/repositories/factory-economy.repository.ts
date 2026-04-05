export type FactoryBudgetRow = {
  id: string;
  ownerUserId: string;
  budget: number | null;
};

export class FactoryEconomyRepository {
  constructor(private readonly supabase: any) {}

  async getFactoryBudgetRow(factoryId: string): Promise<FactoryBudgetRow | null> {
    const { data, error } = await this.supabase
      .from('factories')
      .select('id, ownerUserId, budget')
      .eq('id', factoryId)
      .maybeSingle();

    if (error) {
      throw new Error(`Factory lookup failed: ${error.message}`);
    }

    return data ?? null;
  }

  async deductUserMoney(userId: string, amount: number): Promise<string | null> {
    const { data, error } = await this.supabase.rpc('safe_deduct_currency', {
      p_user_id: userId,
      p_money_cost: amount,
      p_gold_cost: 0,
      p_energy_cost: 0,
    });

    if (error) {
      throw new Error(`safe_deduct_currency failed: ${error.message}`);
    }

    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    if (parsed?.error) {
      return parsed.error;
    }

    return null;
  }

  async tryUpdateFactoryBudgetWithCAS(factoryId: string, expectedBudget: number | null, nextBudget: number): Promise<boolean> {
    let query = this.supabase
      .from('factories')
      .update({ budget: nextBudget })
      .eq('id', factoryId);

    if (expectedBudget === null) {
      query = query.is('budget', null);
    } else {
      query = query.eq('budget', expectedBudget);
    }

    const { data, error } = await query
      .select('id')
      .maybeSingle();

    if (error) {
      throw new Error(`Factory budget update failed: ${error.message}`);
    }

    return !!data;
  }

  async getUserMoney(userId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('users')
      .select('money')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(`User lookup failed: ${error.message}`);
    }

    if (!data) {
      throw new Error('Utente non trovato.');
    }

    return Number(data.money || 0);
  }

  async tryUpdateUserMoneyWithCAS(userId: string, expectedMoney: number, nextMoney: number): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('users')
      .update({ money: nextMoney })
      .eq('id', userId)
      .eq('money', expectedMoney)
      .select('id')
      .maybeSingle();

    if (error) {
      throw new Error(`User money update failed: ${error.message}`);
    }

    return !!data;
  }
}
