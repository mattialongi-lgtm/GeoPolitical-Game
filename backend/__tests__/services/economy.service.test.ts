import { EconomyService } from '../../services/economy.service';
import { createMockSupabase } from '../setup';

describe('EconomyService', () => {
  let service: EconomyService;
  let supabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    supabase = createMockSupabase();
    service = new EconomyService(supabase);
  });

  describe('addBudgetTransaction', () => {
    it('should call RPC with correct params', async () => {
      supabase.rpc.mockResolvedValue({ data: { ok: true }, error: null });

      const result = await service.addBudgetTransaction({
        ownerType: 'REGION',
        ownerId: 'r1',
        type: 'INCOME',
        subtype: 'tax',
        moneyDelta: 500,
        createdBy: 'u1',
      });

      expect(supabase.rpc).toHaveBeenCalledWith('add_budget_transaction', {
        p_owner_type: 'REGION',
        p_owner_id: 'r1',
        p_type: 'INCOME',
        p_subtype: 'tax',
        p_money_delta: 500,
        p_created_by: 'u1',
        p_metadata: {},
      });
      expect(result.type).toBe('success');
    });

    it('should pass metadata when provided', async () => {
      supabase.rpc.mockResolvedValue({ data: null, error: null });

      await service.addBudgetTransaction({
        ownerType: 'STATE',
        ownerId: 's1',
        type: 'EXPENSE',
        subtype: 'military',
        moneyDelta: -200,
        createdBy: 'u1',
        metadata: { reason: 'war' },
      });

      expect(supabase.rpc).toHaveBeenCalledWith(
        'add_budget_transaction',
        expect.objectContaining({ p_metadata: { reason: 'war' } }),
      );
    });

    it('should return system_error on RPC error', async () => {
      supabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC failed' },
      });

      const result = await service.addBudgetTransaction({
        ownerType: 'STATE',
        ownerId: 's1',
        type: 'EXPENSE',
        subtype: 'salary',
        moneyDelta: -100,
        createdBy: 'u1',
      });

      expect(result.type).toBe('system_error');
    });

    it('should handle exceptions gracefully', async () => {
      supabase.rpc.mockRejectedValue(new Error('network error'));

      const result = await service.addBudgetTransaction({
        ownerType: 'REGION',
        ownerId: 'r1',
        type: 'INCOME',
        subtype: 'tax',
        moneyDelta: 500,
        createdBy: 'u1',
      });

      expect(result.type).toBe('system_error');
      if (result.type !== 'success') {
        expect(result.message).toContain('network error');
      }
    });
  });

  describe('safeDeductCurrency', () => {
    it('should call safe_deduct_currency RPC', async () => {
      supabase.rpc.mockResolvedValue({ data: null, error: null });

      const result = await service.safeDeductCurrency('u1', 100, 10, 5);

      expect(supabase.rpc).toHaveBeenCalledWith('safe_deduct_currency', {
        p_user_id: 'u1',
        p_money_cost: 100,
        p_gold_cost: 10,
        p_energy_cost: 5,
      });
      expect(result.type).toBe('success');
    });

    it('should return validation_error when RPC fails', async () => {
      supabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Fondi insufficienti' },
      });

      const result = await service.safeDeductCurrency('u1', 999999, 0, 0);

      expect(result.type).toBe('validation_error');
    });

    it('should return system_error on exception', async () => {
      supabase.rpc.mockRejectedValue(new Error('timeout'));

      const result = await service.safeDeductCurrency('u1', 100, 0, 0);

      expect(result.type).toBe('system_error');
    });
  });

  describe('getMarketOffers', () => {
    it('should return offers on success', async () => {
      const offers = [{ id: 'o1', itemName: 'oil', price: 10 }];
      supabase._setResult(offers);

      const result = await service.getMarketOffers();

      expect(result.type).toBe('success');
      if (result.type === 'success') {
        expect(result.payload).toEqual(offers);
      }
    });

    it('should filter by regionId when provided', async () => {
      supabase._setResult([]);

      const result = await service.getMarketOffers('r1');

      expect(result.type).toBe('success');
      expect(supabase.from).toHaveBeenCalledWith('marketplace_offers');
    });

    it('should filter by itemName when provided', async () => {
      supabase._setResult([]);

      const result = await service.getMarketOffers(undefined, 'oil');

      expect(result.type).toBe('success');
    });

    it('should return empty array when no offers exist', async () => {
      supabase._setResult(null);

      const result = await service.getMarketOffers();

      expect(result.type).toBe('success');
      if (result.type === 'success') {
        expect(result.payload).toEqual([]);
      }
    });

    it('should return system_error on db error', async () => {
      supabase._setResult(null, { message: 'query error' });

      const result = await service.getMarketOffers();

      expect(result.type).toBe('system_error');
    });
  });
});
