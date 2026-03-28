export class ProductionRepository {
  constructor(private readonly supabase: any) {}

  async getUserMoney(userId: string): Promise<number> {
    const { data } = await this.supabase.from('users').select('money').eq('id', userId).single();
    return Number(data?.money || 0);
  }

  async tryUpdateUserMoneyCAS(userId: string, expectedMoney: number, nextMoney: number): Promise<boolean> {
    const { data } = await this.supabase
      .from('users')
      .update({ money: nextMoney })
      .eq('id', userId)
      .eq('money', expectedMoney)
      .select('id')
      .maybeSingle();

    return !!data;
  }

  async getUserInventory(userId: string) {
    const { data } = await this.supabase.from('user_inventory').select('*').eq('userId', userId);
    return data || [];
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

  async tryUpdateInventoryQuantityCAS(userId: string, itemId: string, expectedQuantity: number, nextQuantity: number): Promise<boolean> {
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

  async getLastQueueItem(userId: string) {
    const { data } = await this.supabase
      .from('production_queue')
      .select('willCompleteAt')
      .eq('userId', userId)
      .in('status', ['queued', 'producing'])
      .order('willCompleteAt', { ascending: false })
      .limit(1)
      .maybeSingle();

    return data;
  }

  async deductMoney(userId: string, amount: number): Promise<string | null> {
    const { data, error } = await this.supabase.rpc('safe_deduct_currency', {
      p_user_id: userId,
      p_money_cost: amount,
      p_gold_cost: 0,
      p_energy_cost: 0,
    });

    if (error) throw new Error(error.message);

    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    if (parsed?.error) return parsed.error;

    return null;
  }

  async insertQueue(item: {
    id: string;
    userId: string;
    weaponType: string;
    qty: number;
    status: string;
    startedAt: string;
    willCompleteAt: string;
    createdAt: string;
  }): Promise<void> {
    const { error } = await this.supabase.from('production_queue').insert(item);
    if (error) throw new Error(error.message);
  }

  async deleteQueueItem(id: string, userId: string): Promise<void> {
    await this.supabase.from('production_queue').delete().eq('id', id).eq('userId', userId);
  }

  async cleanupZeroInventory(userId: string): Promise<void> {
    await this.supabase.from('user_inventory').delete().eq('userId', userId).lte('quantity', 0);
  }
}
