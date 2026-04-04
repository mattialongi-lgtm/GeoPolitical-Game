import { createRegionsHandlers } from '../handlers/regions.handler';

interface RegisterRegionsRoutesDeps {
  app: any;
  authenticate: any;
  supabase: any;
  canManageRegion: any;
  canReadRegionScopedData: any;
  getNationForRegion: any;
  getActiveDeep: any;
  computeEffectiveCap: any;
  getSetting: any;
  getStateEnergyCompensation: any;
  AUTONOMY_CONFIG: any;
  BUILDING_LABELS: any;
  GAME_CONFIG: any;
}

export function registerRegionsRoutes(deps: RegisterRegionsRoutesDeps) {
  const { app, authenticate } = deps;
  const h = createRegionsHandlers(deps);

  app.get('/api/regions', authenticate, h.getRegions);
  app.get('/api/regions/:id', authenticate, h.getRegionById);
  app.get('/api/regions/:id/resources', authenticate, h.getRegionResources);
  app.post('/api/regions/:id/refill-extraction', authenticate, h.refillExtraction);
  app.get('/api/regions/:id/autonomy', authenticate, h.getRegionAutonomy);
  app.get('/api/regions/:id/buildings', authenticate, h.getRegionBuildings);
  app.get('/api/regions/:id/energy', authenticate, h.getRegionEnergy);
  app.get('/api/regions/:id/economy', authenticate, h.getRegionEconomy);
  app.get('/api/regions/:id/indexes', authenticate, h.getRegionIndexes);
  app.post('/api/regions/:id/governor', authenticate, h.assignGovernor);
  app.delete('/api/regions/:id/governor', authenticate, h.removeGovernor);
  app.get('/api/regions/:id/parliament', authenticate, h.getRegionParliament);
  app.get('/api/regions/:id/laws', authenticate, h.getRegionLaws);
  app.get('/api/nations/:nationId/energy', authenticate, h.getNationEnergy);
}
