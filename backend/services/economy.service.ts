/**
 * EconomyService — business logic for marketplace transactions.
 *
 * Wraps budget transactions, marketplace queries, and currency
 * operations that are currently spread across multiple handlers.
 */

import {
  serviceSuccess,
  validationError,
  notFoundError,
  systemError,
  type ServiceResult,
} from './service-result';
import { EconomyRepository } from '../repositories/economy.repository';

export class EconomyService {
  private readonly repo: EconomyRepository;

  constructor(private readonly supabase: any) {
    this.repo = new EconomyRepository(supabase);
  }

  /**
   * Add a budget transaction to a region or state treasury.
   */
  async addBudgetTransaction(params: {
    ownerType: 'REGION' | 'STATE';
    ownerId: string;
    type: 'INCOME' | 'EXPENSE';
    subtype: string;
    moneyDelta: number;
    createdBy: string;
    metadata?: Record<string, any>;
  }): Promise<ServiceResult<any>> {
    try {
      const { data, error } = await this.supabase.rpc(
        'add_budget_transaction',
        {
          p_owner_type: params.ownerType,
          p_owner_id: params.ownerId,
          p_type: params.type,
          p_subtype: params.subtype,
          p_money_delta: params.moneyDelta,
          p_created_by: params.createdBy,
          p_metadata: params.metadata || {},
        },
      );

      if (error) return systemError(error.message);
      return serviceSuccess(data);
    } catch (err: any) {
      return systemError(`addBudgetTransaction failed: ${err.message}`);
    }
  }

  /**
   * Safely deduct currency from a user (wrapper around the RPC with
   * JS fallback).
   */
  async safeDeductCurrency(
    userId: string,
    moneyCost: number,
    goldCost: number,
    energyCost: number,
  ): Promise<ServiceResult<void>> {
    try {
      const { error } = await this.repo.safeDeductCurrencyRpc({
        p_user_id: userId,
        p_money_cost: moneyCost,
        p_gold_cost: goldCost,
        p_energy_cost: energyCost,
      });

      if (error) return validationError(error.message);
      return serviceSuccess(undefined);
    } catch (err: any) {
      return systemError(`safeDeductCurrency failed: ${err.message}`);
    }
  }

  /**
   * Helper legacy-style: throw on failure and keep handler code thin.
   */
  async safeDeductCurrencyOrThrow(params: {
    userId: string;
    moneyCost: number;
    goldCost: number;
    energyCost: number;
  }) {
    const result = await this.safeDeductCurrency(
      params.userId,
      params.moneyCost,
      params.goldCost,
      params.energyCost,
    );
    if (result.type !== 'success') {
      throw new Error(result.message || 'safe_deduct_currency failed');
    }
  }

  /**
   * Legacy helper signature used across route deps (pre-layering).
   *
   * Keep the atomic DB path via RPC where available, but fall back to
   * optimistic updates for older schemas / ambiguous overload errors.
   */
  async addBudgetTransactionLegacy(
    ownerType: string,
    ownerId: string,
    type: string,
    subtype: string,
    moneyDelta: number,
    resourcesDelta: Record<string, number> = {},
    createdByUserId: string | null = null,
    metadata: any = {},
    generateSecureId: (len?: number) => string,
  ) {
    const normalizeResourcesDelta = (raw: Record<string, number> = {}) => {
      const normalized: Record<string, number> = {};
      for (const [key, value] of Object.entries(raw || {})) {
        const parsed = Math.trunc(Number(value) || 0);
        if (parsed !== 0) normalized[key] = parsed;
      }
      return normalized;
    };

    const addBudgetTransactionFallback = async () => {
      const normalizedMoneyDelta = Math.trunc(Number(moneyDelta) || 0);
      const normalizedResourcesDelta = normalizeResourcesDelta(resourcesDelta);

      for (let attempt = 0; attempt < 3; attempt++) {
        const budget = await this.repo.getBudgetForUpdate(ownerType, ownerId);
        if (!budget?.id) {
          await this.repo.ensureBudgetExists(ownerType, ownerId);
          continue;
        }

        const currentMoney = Math.trunc(Number(budget.moneyEUR) || 0);
        const newMoney = currentMoney + normalizedMoneyDelta;
        if (newMoney < 0) throw new Error('Fondi insufficienti');

        const rawResources =
          typeof budget.resources === 'string'
            ? JSON.parse(budget.resources || '{}')
            : budget.resources || {};
        const newResources: Record<string, number> = {};
        for (const [key, value] of Object.entries(rawResources || {})) {
          newResources[key] = Math.trunc(Number(value) || 0);
        }

        for (const [key, delta] of Object.entries(normalizedResourcesDelta)) {
          const nextValue = (newResources[key] || 0) + delta;
          if (nextValue < 0) throw new Error(`Risorse insufficienti: ${key}`);
          newResources[key] = nextValue;
        }

        const now = Date.now();
        const { data: updatedBudget, error: updateErr } = await this.repo.updateBudgetOptimistic({
          budgetId: budget.id,
          expectedMoneyEUR: budget.moneyEUR,
          nextMoneyEUR: newMoney,
          expectedResources: budget.resources,
          nextResources: newResources,
          updatedAt: now,
        });

        if (updateErr) {
          await new Promise((r) => setTimeout(r, 25 * (attempt + 1)));
          continue;
        }
        if (!updatedBudget?.id) {
          await new Promise((r) => setTimeout(r, 25 * (attempt + 1)));
          continue;
        }

        const txId = generateSecureId(12);
        const txPayload: any = {
          id: txId,
          budgetId: budget.id,
          type,
          subtype,
          moneyDelta: normalizedMoneyDelta,
          resourcesDelta: normalizedResourcesDelta,
          createdAt: now,
          metadata: metadata || {},
        };
        if (createdByUserId) txPayload.createdByUserId = createdByUserId;

        let { error: txErr } = await this.repo.insertBudgetTransactionRow(txPayload);
        if (txErr && txPayload.createdByUserId) {
          const txMsg = String((txErr as any)?.message || '').toLowerCase();
          if (txMsg.includes('uuid') || txMsg.includes('invalid input syntax')) {
            delete txPayload.createdByUserId;
            ({ error: txErr } = await this.repo.insertBudgetTransactionRow(txPayload));
          }
        }
        if (txErr) throw txErr;

        return txId;
      }

      throw new Error('Conflitto durante aggiornamento budget. Riprova.');
    };

    await this.repo.ensureBudgetExists(ownerType, ownerId);

    const payload = {
      p_owner_type: ownerType,
      p_owner_id: ownerId,
      p_type: type,
      p_subtype: subtype,
      p_money_delta: moneyDelta,
      p_resources_delta: resourcesDelta,
      p_created_by: createdByUserId,
      p_metadata: metadata,
    };

    let { data, error } = await this.repo.addBudgetTransactionRpc(payload);

    if (error) {
      const msg = String((error as any)?.message || '').toLowerCase();
      if (msg.includes('budget') || msg.includes('non trovato')) {
        await this.repo.ensureBudgetExists(ownerType, ownerId);
        ({ data, error } = await this.repo.addBudgetTransactionRpc(payload));
      }
      if (error) {
        const retryMsg = String((error as any)?.message || '').toLowerCase();
        const isAmbiguousOverload =
          retryMsg.includes('could not choose the best candidate function') &&
          retryMsg.includes('add_budget_transaction');
        if (isAmbiguousOverload) {
          return await addBudgetTransactionFallback();
        }
      }
    }

    if (error) throw error;
    return data;
  }

  /**
   * Fetch marketplace offers for a region with optional filters.
   */
  async getMarketOffers(
    regionId?: string,
    itemName?: string,
  ): Promise<ServiceResult<any[]>> {
    let query = this.supabase
      .from('marketplace_offers')
      .select('*, seller:users(id, username)')
      .eq('status', 'active')
      .order('createdAt', { ascending: false });

    if (regionId) query = query.eq('regionId', regionId);
    if (itemName) query = query.eq('itemName', itemName);

    const { data, error } = await query;
    if (error) return systemError(error.message);
    return serviceSuccess(data || []);
  }

  /**
   * Legacy (non-atomic) state donation flow, extracted from state handlers.
   * Keeps existing behavior but centralizes economic steps in one place.
   */
  async donateToStateBudget(params: {
    nationId: string;
    userId: string;
    type: string;
    amount: number;
  }) {
    const { nationId, userId, type, amount } = params;

    // 1. Get user and verify balance
    const { data: user, error: userError } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) throw new Error('Utente non trovato');

    // 2. Resource mapping & Check
    const resourceMap: Record<string, string> = {
      petrolio: 'oil',
      minerali: 'minerals',
      uranio: 'uranium',
      diamanti: 'diamonds',
      soldi: 'money',
    };
    const realType = resourceMap[type] || type;

    if (realType === 'money') {
      if (BigInt(user.money || 0) < BigInt(amount)) {
        const err: any = new Error('Saldo denaro insufficiente');
        err.statusCode = 400;
        throw err;
      }
    } else if (realType === 'gold') {
      if (BigInt(user.gold || 0) < BigInt(amount)) {
        const err: any = new Error('Saldo gold insufficiente');
        err.statusCode = 400;
        throw err;
      }
    } else {
      const { data: inv } = await this.supabase
        .from('user_inventory')
        .select('*')
        .eq('userId', userId)
        .eq('itemId', realType)
        .single();
      if (!inv || BigInt(inv.quantity || 0) < BigInt(amount)) {
        const err: any = new Error(`Saldo ${realType} insufficiente`);
        err.statusCode = 400;
        throw err;
      }
    }

    // 3. Map to budget key (oro -> gold_ore)
    const budgetResourceKey = realType === 'gold' ? 'gold_ore' : realType;

    // 4. Update State Budget (handles auto-creation if missing)
    let { data: budgets, error: budgetError } = await this.supabase
      .from('budgets')
      .select('*')
      .eq('ownerType', 'STATE')
      .eq('ownerId', nationId)
      .maybeSingle();

    if (budgetError) throw budgetError;

    if (!budgets) {
      // Auto-create missing budget
      const { data: newBudget, error: createError } = await this.supabase
        .from('budgets')
        .insert({
          ownerType: 'STATE',
          ownerId: nationId,
          moneyEUR: 0,
          resources: {},
          updatedAt: Date.now(),
        })
        .select()
        .single();

      if (createError) {
        if (createError.code === '23505') {
          const { data: retryBudget } = await this.supabase
            .from('budgets')
            .select('*')
            .eq('ownerType', 'STATE')
            .eq('ownerId', nationId)
            .single();
          budgets = retryBudget;
        } else {
          // eslint-disable-next-line no-console
          console.error('Budget creation error:', createError);
          throw new Error("Errore nell'inizializzazione del budget statale");
        }
      } else {
        budgets = newBudget;
      }
    }

    if (!budgets) throw new Error('Errore critico: Budget non recuperabile');

    // 5. Define transaction ID early
    const txId = `don_${Date.now()}_${userId}`;

    // 6. Update User (Deduct funds/resources)
    if (realType === 'money') {
      await this.supabase
        .from('users')
        .update({ money: BigInt(user.money || 0) - BigInt(amount) })
        .eq('id', userId);
    } else if (realType === 'gold') {
      await this.supabase
        .from('users')
        .update({ gold: BigInt(user.gold || 0) - BigInt(amount) })
        .eq('id', userId);
    } else {
      const { data: currentInv } = await this.supabase
        .from('user_inventory')
        .select('quantity')
        .eq('userId', userId)
        .eq('itemId', realType)
        .single();
      await this.supabase
        .from('user_inventory')
        .update({ quantity: BigInt(currentInv?.quantity || 0) - BigInt(amount) })
        .eq('userId', userId)
        .eq('itemId', realType);
    }

    // 7. Update Budget
    const updateData: any = { updatedAt: Date.now() };
    if (realType === 'money') {
      updateData.moneyEUR = BigInt(budgets.moneyEUR || 0) + BigInt(amount);
    } else {
      const currentRes = budgets.resources || {};
      currentRes[budgetResourceKey] =
        (Number(currentRes[budgetResourceKey]) || 0) + Number(amount);
      updateData.resources = currentRes;
    }

    const { error: budgetUpdateError } = await this.supabase
      .from('budgets')
      .update(updateData)
      .eq('id', budgets.id);
    if (budgetUpdateError) throw budgetUpdateError;

    // 8. Log transaction
    await this.supabase.from('budget_transactions').insert({
      id: txId,
      budgetId: budgets.id,
      type: 'INCOME',
      subtype: 'DONATION',
      moneyDelta: realType === 'money' ? amount : 0,
      resourcesDelta: realType !== 'money' ? { [budgetResourceKey]: amount } : {},
      createdAt: Date.now(),
      createdByUserId: userId,
      metadata: { donor: user.username, resourceType: realType },
    });

    // 9. Sync Nations treasury_balance
    if (realType === 'money') {
      const { data: nation } = await this.supabase
        .from('nations')
        .select('treasury_balance')
        .eq('id', nationId)
        .single();
      if (nation) {
        await this.supabase
          .from('nations')
          .update({ treasury_balance: BigInt(nation.treasury_balance || 0) + BigInt(amount) })
          .eq('id', nationId);
      }
    }

    return {
      success: true,
      message: 'Donazione effettuata con successo!',
      transactionId: txId,
    };
  }
}
