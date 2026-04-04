/**
 * UserService — business logic for user profile and progression.
 *
 * Covers profile updates, XP/level calculations, and inventory
 * management.
 */

import {
  serviceSuccess,
  validationError,
  notFoundError,
  systemError,
  type ServiceResult,
} from './service-result';

export class UserService {
  constructor(private readonly supabase: any) {}

  /**
   * Fetch a user by ID with basic profile fields.
   */
  async getUserById(
    userId: string,
  ): Promise<ServiceResult<any>> {
    const { data, error } = await this.supabase
      .from('users')
      .select('id, username, email, money, gold, energy, xp, level, regionId, originalNationId, displayedNationId, avatarData, lastLogin, createdAt')
      .eq('id', userId)
      .single();

    if (error) return systemError(error.message);
    if (!data) return notFoundError(`Utente con id ${userId} non trovato`);
    return serviceSuccess(data);
  }

  /**
   * Get the full player inventory as a `{ itemId: quantity }` map.
   */
  async getInventory(
    userId: string,
  ): Promise<ServiceResult<Record<string, number>>> {
    const { data, error } = await this.supabase
      .from('user_inventory')
      .select('itemId, quantity')
      .eq('userId', userId);

    if (error) return systemError(error.message);

    const inventory: Record<string, number> = {};
    for (const row of data || []) {
      inventory[row.itemId] = row.quantity;
    }
    return serviceSuccess(inventory);
  }

  /**
   * Update the user's displayed nation.
   */
  async changeDisplayedNation(
    userId: string,
    nationId: string,
  ): Promise<ServiceResult<void>> {
    if (!nationId) return validationError('nationId è obbligatorio');

    const { error } = await this.supabase
      .from('users')
      .update({ displayedNationId: nationId })
      .eq('id', userId);

    if (error) return systemError(error.message);
    return serviceSuccess(undefined);
  }

  /**
   * Update the user's username (with uniqueness check).
   */
  async updateUsername(
    userId: string,
    username: string,
  ): Promise<ServiceResult<void>> {
    if (!username || username.length < 1 || username.length > 30) {
      return validationError('Username deve essere tra 1 e 30 caratteri');
    }

    // Check uniqueness
    const { data: existing } = await this.supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .neq('id', userId)
      .maybeSingle();

    if (existing) {
      return validationError('Username già in uso.');
    }

    const { error } = await this.supabase
      .from('users')
      .update({ username })
      .eq('id', userId);

    if (error) return systemError(error.message);
    return serviceSuccess(undefined);
  }
}
