import { GovernanceService } from '../../services/governance.service';
import { createMockSupabase } from '../setup';

describe('GovernanceService', () => {
  let service: GovernanceService;
  let supabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    supabase = createMockSupabase();
    service = new GovernanceService(supabase);
  });

  describe('isNationLeader', () => {
    it('should return true when user owns the capital region', async () => {
      supabase._setResult({ ownerUserId: 'u1' });

      const result = await service.isNationLeader('u1', 'IT');

      expect(result).toBe(true);
    });

    it('should return false when different user owns capital', async () => {
      supabase._setResult({ ownerUserId: 'other-user' });

      const result = await service.isNationLeader('u1', 'IT');

      expect(result).toBe(false);
    });

    it('should return false when no capital region found', async () => {
      supabase._setResult(null);

      const result = await service.isNationLeader('u1', 'XX');

      expect(result).toBe(false);
    });
  });

  describe('getMinistersByNation', () => {
    it('should return ministers list on success', async () => {
      const ministers = [
        { id: 'm1', role: 'ECONOMY', user: { id: 'u1', username: 'player1' } },
      ];
      supabase._setResult(ministers);

      const result = await service.getMinistersByNation('IT');

      expect(result.type).toBe('success');
      if (result.type === 'success') {
        expect(result.payload).toEqual(ministers);
      }
    });

    it('should return empty array when no ministers', async () => {
      supabase._setResult([]);

      const result = await service.getMinistersByNation('XX');

      expect(result.type).toBe('success');
      if (result.type === 'success') {
        expect(result.payload).toEqual([]);
      }
    });

    it('should return system_error on db failure', async () => {
      supabase._setResult(null, { message: 'timeout' });

      const result = await service.getMinistersByNation('IT');

      expect(result.type).toBe('system_error');
    });
  });

  describe('removeMinister', () => {
    it('should return forbidden when requester is not leader', async () => {
      supabase._setResult({ ownerUserId: 'leader-user' });

      const result = await service.removeMinister('IT', 'ECONOMY', 'not-leader');

      expect(result.type).toBe('forbidden');
    });

    it('should succeed when requester is the nation leader', async () => {
      // isNationLeader → match
      supabase._pushResult({ ownerUserId: 'leader' });
      // update → no error
      supabase._pushResult(null);

      const result = await service.removeMinister('IT', 'ECONOMY', 'leader');

      expect(result.type).toBe('success');
    });

    it('should return system_error on update failure', async () => {
      // isNationLeader → match
      supabase._pushResult({ ownerUserId: 'leader' });
      // update → error
      supabase._setResult(null, { message: 'update failed' });

      const result = await service.removeMinister('IT', 'ECONOMY', 'leader');

      expect(result.type).toBe('system_error');
    });
  });

  describe('getRegionBudget', () => {
    it('should return budget data on success', async () => {
      const budget = { moneyEUR: 5000, ownerId: 'r1' };
      supabase._setResult(budget);

      const result = await service.getRegionBudget('r1');

      expect(result.type).toBe('success');
      if (result.type === 'success') {
        expect(result.payload).toEqual(budget);
      }
    });

    it('should return not_found when no budget exists', async () => {
      supabase._setResult(null);

      const result = await service.getRegionBudget('r1');

      expect(result.type).toBe('not_found');
    });

    it('should return system_error on db error', async () => {
      supabase._setResult(null, { message: 'connection lost' });

      const result = await service.getRegionBudget('r1');

      expect(result.type).toBe('system_error');
    });
  });
});
