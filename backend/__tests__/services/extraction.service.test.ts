import { ExtractionService } from '../../services/extraction.service';
import { createMockSupabase } from '../setup';

describe('ExtractionService', () => {
  let service: ExtractionService;
  let supabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    supabase = createMockSupabase();
    service = new ExtractionService(supabase);
  });

  describe('getPlayerState', () => {
    it('should return player extraction states on success', async () => {
      const states = [{ playerId: 'u1', regionId: 'r1', extracted: 100 }];
      supabase._setResult(states);

      const result = await service.getPlayerState('u1', 'r1');

      expect(result.type).toBe('success');
      if (result.type === 'success') {
        expect(result.payload.states).toEqual(states);
      }
    });

    it('should return empty states array when none found', async () => {
      supabase._setResult(null);

      const result = await service.getPlayerState('u1', 'r1');

      expect(result.type).toBe('success');
      if (result.type === 'success') {
        expect(result.payload.states).toEqual([]);
      }
    });

    it('should return system_error on db error', async () => {
      supabase._setResult(null, { message: 'db error' });

      const result = await service.getPlayerState('u1', 'r1');

      expect(result.type).toBe('system_error');
    });
  });

  describe('getRechargeInfo', () => {
    it('should return validation_error when regionId is missing', async () => {
      const getSetting = jest.fn();
      const result = await service.getRechargeInfo('', 'oil', getSetting);

      expect(result.type).toBe('validation_error');
    });

    it('should return validation_error when resourceType is missing', async () => {
      const getSetting = jest.fn();
      const result = await service.getRechargeInfo('r1', '', getSetting);

      expect(result.type).toBe('validation_error');
    });

    it('should return recharge info with defaults when no existing recharge', async () => {
      const getSetting = jest.fn()
        .mockResolvedValueOnce('7200')   // cooldown
        .mockResolvedValueOnce('50000');  // cost

      // recharge data → null, budget → has money
      supabase._pushResult(null);
      supabase._pushResult({ moneyEUR: 100000 });

      const result = await service.getRechargeInfo('r1', 'oil', getSetting);

      expect(result.type).toBe('success');
      if (result.type === 'success') {
        expect(result.payload.cooldownRemaining).toBe(0);
        expect(result.payload.cooldownTotal).toBe(7200);
        expect(result.payload.costEur).toBe(50000);
        expect(result.payload.canAfford).toBe(true);
      }
    });

    it('should calculate canAfford = false when treasury is insufficient', async () => {
      const getSetting = jest.fn()
        .mockResolvedValueOnce('7200')
        .mockResolvedValueOnce('50000');

      supabase._pushResult(null);  // recharge
      supabase._pushResult({ moneyEUR: 1000 });  // budget

      const result = await service.getRechargeInfo('r1', 'oil', getSetting);

      expect(result.type).toBe('success');
      if (result.type === 'success') {
        expect(result.payload.canAfford).toBe(false);
      }
    });

    it('should use default settings when getSetting returns non-numeric', async () => {
      const getSetting = jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(undefined);

      supabase._pushResult(null);
      supabase._pushResult(null);

      const result = await service.getRechargeInfo('r1', 'oil', getSetting);

      expect(result.type).toBe('success');
      if (result.type === 'success') {
        // Defaults: cooldown=7200, cost=50000
        expect(result.payload.cooldownTotal).toBe(7200);
        expect(result.payload.costEur).toBe(50000);
      }
    });
  });

  describe('getLeaderboard', () => {
    it('should aggregate and sort extraction data', async () => {
      const logs = [
        { playerId: 'u1', playerAmount: 100, resourceType: 'oil' },
        { playerId: 'u2', playerAmount: 200, resourceType: 'oil' },
        { playerId: 'u1', playerAmount: 50, resourceType: 'oil' },
      ];

      // First DB call: extraction logs
      supabase._pushResult(logs);
      // Second DB call: user lookup
      supabase._pushResult([
        { id: 'u1', username: 'player1', level: 5 },
        { id: 'u2', username: 'player2', level: 3 },
      ]);

      const result = await service.getLeaderboard();

      expect(result.type).toBe('success');
      if (result.type === 'success') {
        const lb = result.payload.leaderboard;
        expect(lb.length).toBe(2);
        // u2 has 200, u1 has 150 — u2 should be first
        expect(lb[0].playerId).toBe('u2');
        expect(lb[0].totalExtracted).toBe(200);
        expect(lb[1].playerId).toBe('u1');
        expect(lb[1].totalExtracted).toBe(150);
      }
    });

    it('should return empty leaderboard when no logs', async () => {
      supabase._setResult([]);

      const result = await service.getLeaderboard();

      expect(result.type).toBe('success');
      if (result.type === 'success') {
        expect(result.payload.leaderboard).toEqual([]);
      }
    });

    it('should pass regionId filter when provided', async () => {
      supabase._setResult([]);

      const result = await service.getLeaderboard('region-1');

      expect(result.type).toBe('success');
      expect(supabase.from).toHaveBeenCalledWith('extraction_detailed_logs');
    });
  });
});
