import { registerUserRoutes } from './user.routes';
import { registerWorldRoutes } from './world.routes';
import { registerStateRoutes } from './state.routes';
import { registerCountriesRoutes } from './countries.routes';
import { registerActionsRoutes } from './actions.routes';
import { registerFactoriesRoutes } from './factories.routes';
import { registerFactoryMarketRoutes } from './factory-market.routes';
import { registerMarketRoutes } from './market.routes';
import { registerGovernanceRoutes } from './governance.routes';
import { registerMediaRoutes } from './media.routes';
import { registerCommunicationRoutes } from './communication.routes';
import { registerWarsLegacyRoutes } from './wars-legacy.routes';
import { registerAutomationRoutes } from './automation.routes';
import { registerPoliticsRoutes } from './politics.routes';
import { registerDailyRoutes } from './daily.routes';
import { registerRegionsRoutes } from './regions.routes';
import { registerResourcesRoutes } from './resources.routes';
import { registerWarRoutes } from './war.routes';

/**
 * Register all extracted route groups on the Express app.
 *
 * `deps` is a bag of shared dependencies (supabase client, helpers,
 * config objects, middleware, etc.) that each route group picks from.
 * Each `registerXRoutes` function destructures only what it needs.
 */
export function setupRoutes(deps: any) {
  registerUserRoutes(deps);
  registerWorldRoutes(deps);
  registerStateRoutes(deps);
  registerCountriesRoutes(deps);
  registerActionsRoutes(deps);
  registerFactoriesRoutes(deps);
  registerFactoryMarketRoutes(deps);
  registerMarketRoutes(deps);
  registerGovernanceRoutes(deps);
  registerMediaRoutes(deps);
  registerCommunicationRoutes(deps);
  registerWarsLegacyRoutes(deps);
  registerAutomationRoutes(deps);
  registerPoliticsRoutes(deps);
  registerDailyRoutes(deps);
  registerRegionsRoutes(deps);
  registerResourcesRoutes(deps);
  registerWarRoutes(deps);
}
