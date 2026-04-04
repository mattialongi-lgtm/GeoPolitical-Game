/**
 * Services barrel + factory.
 *
 * `createServices(supabase)` instantiates every domain service and
 * returns a typed container that handlers / controllers can consume.
 *
 * NOTE: WarService, FactoryCreateService, ProductionService etc.
 * require repository-level dependencies — they are wired separately
 * in their respective route files (e.g. `war.routes.ts`).
 * This factory covers the newer, simpler services that take only
 * the supabase client.
 */

import { ExtractionService } from './extraction.service';
import { EconomyService } from './economy.service';
import { GovernanceService } from './governance.service';
import { UserService } from './user.service';

// ── Re-exports ──────────────────────────────────────────────────
export { ExtractionService } from './extraction.service';
export { EconomyService } from './economy.service';
export { GovernanceService } from './governance.service';
export { UserService } from './user.service';
export { WarService } from './war.service';
export { FactoryCreateService } from './factory-create.service';
export { ProductionService } from './production.service';

// Re-export service-result helpers so consumers can do
// `import { serviceSuccess } from '../services'`
export {
  serviceSuccess,
  validationError,
  forbiddenError,
  notFoundError,
  conflictError,
  systemError,
} from './service-result';
export type { ServiceResult, ServiceSuccess, ServiceFailure } from './service-result';
export { mapServiceResultToHttp } from './http-result.mapper';

// ── Service container ───────────────────────────────────────────

export interface Services {
  extraction: ExtractionService;
  economy: EconomyService;
  governance: GovernanceService;
  user: UserService;
}

/**
 * Create all simple domain services that depend only on the
 * Supabase client.  Services that need repositories or other deps
 * (WarService, FactoryCreateService, ProductionService) are
 * instantiated at the route-registration level.
 */
export function createServices(supabase: any): Services {
  return {
    extraction: new ExtractionService(supabase),
    economy: new EconomyService(supabase),
    governance: new GovernanceService(supabase),
    user: new UserService(supabase),
  };
}
