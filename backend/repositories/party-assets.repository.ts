export class PartyAssetsRepository {
  constructor(private readonly supabase: any) {}

  async getPartyMembership(userId: string) {
    const { data } = await this.supabase
      .from('party_members')
      .select('partyId, joinedAt')
      .eq('userId', userId)
      .maybeSingle();

    return data;
  }

  async isUserInParty(userId: string, partyId: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('party_members')
      .select('partyId')
      .eq('userId', userId)
      .eq('partyId', partyId)
      .maybeSingle();

    return !!data;
  }

  async getUserMoneyGold(userId: string): Promise<{ money: number; gold: number }> {
    const { data } = await this.supabase
      .from('users')
      .select('money, gold')
      .eq('id', userId)
      .single();

    return {
      money: Number(data?.money || 0),
      gold: Number(data?.gold || 0),
    };
  }

  async deductCurrency(userId: string, moneyCost: number, goldCost: number): Promise<string | null> {
    const { data, error } = await this.supabase.rpc('safe_deduct_currency', {
      p_user_id: userId,
      p_money_cost: moneyCost,
      p_gold_cost: goldCost,
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

  async tryUpdateMoneyCAS(userId: string, expectedMoney: number, nextMoney: number): Promise<boolean> {
    const { data } = await this.supabase
      .from('users')
      .update({ money: nextMoney })
      .eq('id', userId)
      .eq('money', expectedMoney)
      .select('id')
      .maybeSingle();

    return !!data;
  }

  async tryUpdateGoldCAS(userId: string, expectedGold: number, nextGold: number): Promise<boolean> {
    const { data } = await this.supabase
      .from('users')
      .update({ gold: nextGold })
      .eq('id', userId)
      .eq('gold', expectedGold)
      .select('id')
      .maybeSingle();

    return !!data;
  }

  async getInventoryQuantity(userId: string, itemId: string): Promise<number | null> {
    const { data } = await this.supabase
      .from('user_inventory')
      .select('quantity')
      .eq('userId', userId)
      .eq('itemId', itemId)
      .maybeSingle();

    if (!data) return null;
    return Number(data.quantity || 0);
  }

  async tryUpdateInventoryCAS(userId: string, itemId: string, expectedQuantity: number, nextQuantity: number): Promise<boolean> {
    const { data } = await this.supabase
      .from('user_inventory')
      .update({ quantity: nextQuantity })
      .eq('userId', userId)
      .eq('itemId', itemId)
      .eq('quantity', expectedQuantity)
      .select('userId')
      .maybeSingle();

    return !!data;
  }

  async insertInventory(userId: string, itemId: string, quantity: number): Promise<void> {
    const { error } = await this.supabase
      .from('user_inventory')
      .insert({ userId, itemId, quantity });

    if (error) {
      throw new Error(error.message);
    }
  }

  async insertPartyLog(partyId: string, details: string, id: string, timestampIso: string): Promise<void> {
    await this.supabase.from('party_logs').insert({
      id,
      partyId,
      action: 'contribution',
      details,
      timestamp: timestampIso,
    });
  }
}
