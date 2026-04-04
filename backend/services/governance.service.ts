/**
 * GovernanceService — business logic for regional & national governance.
 *
 * Covers minister management, government form changes, autonomy
 * operations, and budget queries.
 */

import {
  serviceSuccess,
  validationError,
  forbiddenError,
  notFoundError,
  systemError,
  type ServiceResult,
} from './service-result';

export class GovernanceService {
  constructor(private readonly supabase: any) {}

  /**
   * Check whether a user is the owner (leader / dictator) of a
   * nation identified by the ISO-2 code.
   */
  async isNationLeader(
    userId: string,
    iso2: string,
  ): Promise<boolean> {
    const { data: region } = await this.supabase
      .from('regions')
      .select('ownerUserId')
      .eq('nation_id', iso2)
      .eq('isCapital', true)
      .maybeSingle();
    return region?.ownerUserId === userId;
  }

  /**
   * List ministers for a given nation.
   */
  async getMinistersByNation(
    iso2: string,
  ): Promise<ServiceResult<any[]>> {
    const { data, error } = await this.supabase
      .from('ministers')
      .select('*, user:users(id, username, avatarData)')
      .eq('stateId', iso2)
      .eq('status', 'ACTIVE')
      .order('role', { ascending: true });

    if (error) return systemError(error.message);
    return serviceSuccess(data || []);
  }

  /**
   * Remove (deactivate) a minister.
   */
  async removeMinister(
    iso2: string,
    role: string,
    requesterId: string,
  ): Promise<ServiceResult<void>> {
    const isLeader = await this.isNationLeader(requesterId, iso2);
    if (!isLeader) {
      return forbiddenError('Solo il Leader può rimuovere ministri.');
    }

    const { error } = await this.supabase
      .from('ministers')
      .update({ status: 'REMOVED' })
      .eq('stateId', iso2)
      .eq('role', role)
      .eq('status', 'ACTIVE');

    if (error) return systemError(error.message);
    return serviceSuccess(undefined);
  }

  /**
   * Fetch budget overview for a region.
   */
  async getRegionBudget(
    regionId: string,
  ): Promise<ServiceResult<any>> {
    const { data, error } = await this.supabase
      .from('budgets')
      .select('*')
      .eq('ownerType', 'REGION')
      .eq('ownerId', regionId)
      .maybeSingle();

    if (error) return systemError(error.message);
    if (!data) return notFoundError('Budget per questa regione');
    return serviceSuccess(data);
  }
}
