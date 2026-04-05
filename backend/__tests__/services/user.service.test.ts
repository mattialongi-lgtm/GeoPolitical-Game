import { UserService } from '../../services/user.service';
import { createMockSupabase } from '../setup';

describe('UserService', () => {
  let service: UserService;
  let supabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    supabase = createMockSupabase();
    service = new UserService(supabase);
  });

  describe('getUserById', () => {
    it('should return user data on success', async () => {
      const userData = { id: 'u1', username: 'player1', money: 1000 };
      supabase._setResult(userData);

      const result = await service.getUserById('u1');

      expect(result.type).toBe('success');
      if (result.type === 'success') {
        expect(result.payload).toEqual(userData);
      }
      expect(supabase.from).toHaveBeenCalledWith('users');
    });

    it('should return system_error on db error', async () => {
      supabase._setResult(null, { message: 'connection lost' });

      const result = await service.getUserById('u1');

      expect(result.type).toBe('system_error');
      if (result.type !== 'success') {
        expect(result.message).toContain('connection lost');
      }
    });

    it('should return not_found when no user data', async () => {
      supabase._setResult(null);

      const result = await service.getUserById('missing');

      expect(result.type).toBe('not_found');
    });
  });

  describe('getInventory', () => {
    it('should return inventory map on success', async () => {
      const rows = [
        { itemId: 'sword', quantity: 3 },
        { itemId: 'shield', quantity: 1 },
      ];
      supabase._setResult(rows);

      const result = await service.getInventory('u1');

      expect(result.type).toBe('success');
      if (result.type === 'success') {
        expect(result.payload).toEqual({ sword: 3, shield: 1 });
      }
    });

    it('should return empty map when no inventory rows', async () => {
      supabase._setResult([]);

      const result = await service.getInventory('u1');

      expect(result.type).toBe('success');
      if (result.type === 'success') {
        expect(result.payload).toEqual({});
      }
    });

    it('should return system_error on db error', async () => {
      supabase._setResult(null, { message: 'timeout' });

      const result = await service.getInventory('u1');

      expect(result.type).toBe('system_error');
    });
  });

  describe('changeDisplayedNation', () => {
    it('should return validation_error when nationId is empty', async () => {
      const result = await service.changeDisplayedNation('u1', '');

      expect(result.type).toBe('validation_error');
    });

    it('should return success on valid update', async () => {
      supabase._setResult(null);

      const result = await service.changeDisplayedNation('u1', 'IT');

      expect(result.type).toBe('success');
    });

    it('should return system_error on db failure', async () => {
      supabase._setResult(null, { message: 'update failed' });

      const result = await service.changeDisplayedNation('u1', 'IT');

      expect(result.type).toBe('system_error');
    });
  });

  describe('updateUsername', () => {
    it('should reject empty username', async () => {
      const result = await service.updateUsername('u1', '');
      expect(result.type).toBe('validation_error');
    });

    it('should reject username longer than 30 chars', async () => {
      const longName = 'a'.repeat(31);
      const result = await service.updateUsername('u1', longName);
      expect(result.type).toBe('validation_error');
    });

    it('should reject duplicate username', async () => {
      // Uniqueness check → returns existing user
      supabase._setResult({ id: 'other-user' });

      const result = await service.updateUsername('u1', 'taken-name');

      expect(result.type).toBe('validation_error');
      if (result.type !== 'success') {
        expect(result.message).toContain('già in uso');
      }
    });

    it('should succeed with unique username', async () => {
      // First query: uniqueness check → null (no conflict)
      // Second query: update → no error
      supabase._pushResult(null); // maybeSingle → no existing user
      supabase._pushResult(null); // update chain → no error

      const result = await service.updateUsername('u1', 'new-name');

      expect(result.type).toBe('success');
    });
  });
});
