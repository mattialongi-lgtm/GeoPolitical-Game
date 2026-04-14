type SupabaseLike = {
  from: (table: string) => any;
  rpc: (fn: string, params?: any) => Promise<{ data: any; error: any }>;
};

export class EconomyRepository {
  constructor(private readonly supabase: SupabaseLike) {}

  async ensureBudgetExists(ownerType: string, ownerId: string) {
    const { data: existing, error: readErr } = await this.supabase
      .from('budgets')
      .select('id')
      .eq('ownerType', ownerType)
      .eq('ownerId', ownerId)
      .maybeSingle();
    if (readErr) throw readErr;
    if (existing?.id) return;

    const { error: insertErr } = await this.supabase.from('budgets').insert({
      ownerType,
      ownerId,
      moneyEUR: 0,
      resources: {},
      updatedAt: Date.now(),
    });

    if (!insertErr) return;

    // Race-safe retry read
    const { data: retry, error: retryErr } = await this.supabase
      .from('budgets')
      .select('id')
      .eq('ownerType', ownerType)
      .eq('ownerId', ownerId)
      .maybeSingle();
    if (retryErr) throw retryErr;
    if (!retry?.id) throw insertErr;
  }

  async getBudgetForUpdate(ownerType: string, ownerId: string) {
    const { data: budget, error: budgetErr } = await this.supabase
      .from('budgets')
      .select('id, moneyEUR, resources')
      .eq('ownerType', ownerType)
      .eq('ownerId', ownerId)
      .maybeSingle();
    if (budgetErr) throw budgetErr;
    return budget;
  }

  async updateBudgetOptimistic(params: {
    budgetId: string;
    expectedMoneyEUR: any;
    nextMoneyEUR: number;
    expectedResources: any;
    nextResources: Record<string, number>;
    updatedAt: number;
  }) {
    return this.supabase
      .from('budgets')
      .update({
        moneyEUR: params.nextMoneyEUR,
        resources: params.nextResources,
        updatedAt: params.updatedAt,
      })
      .eq('id', params.budgetId)
      .eq('moneyEUR', params.expectedMoneyEUR)
      .eq('resources', params.expectedResources)
      .select('id')
      .maybeSingle();
  }

  async insertBudgetTransactionRow(payload: any) {
    return this.supabase.from('budget_transactions').insert(payload);
  }

  async addBudgetTransactionRpc(payload: any) {
    return this.supabase.rpc('add_budget_transaction', payload);
  }

  async safeDeductCurrencyRpc(payload: any) {
    return this.supabase.rpc('safe_deduct_currency', payload);
  }
}

