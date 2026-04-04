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

export class EconomyService {
  constructor(private readonly supabase: any) {}

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
      const { error } = await this.supabase.rpc('safe_deduct_currency', {
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
}
