import { createFactoriesHandlers } from '../handlers/factories.handler';

interface RegisterFactoriesRoutesDeps {
  app: any;
  authenticate: any;
  supabase: any;
  getUserPerks: (userId: string, boosterInfo?: Record<string, any>) => Promise<Record<string, number>>;
  generateSecureId: (len: number) => string;
  factoryCreateService: any;
  factoryUpgradeService: any;
  factoryEconomyService: any;
  mapServiceResultToHttp: (result: any) => { statusCode: number; body: any };
  FACTORY_CONFIG: any;
  GAME_CONFIG: any;
  EXTRACTION_CONFIG: any;
  factoryYieldMultiplier: (level: number) => number;
  factoryStorageLimit: (type: string, level: number) => number;
  estimateFactoryValue: (type: string, level: number, recentProfit?: number) => number;
  updateMissionProgress: (userId: string, missionType: string, payload: Record<string, number>) => Promise<void>;
}

export function registerFactoriesRoutes(deps: RegisterFactoriesRoutesDeps) {
  const { app, authenticate } = deps;
  const h = createFactoriesHandlers(deps);

  app.get('/api/factories', authenticate, h.getFactories);
  app.post('/api/factories/create', authenticate, h.createFactory);
  app.post('/api/factories/deposit', authenticate, h.depositFactory);
  app.post('/api/factories/paymode', authenticate, h.setPayMode);
  app.get('/api/factories/upgrade-cost', authenticate, h.getUpgradeCost);
  app.post('/api/factories/upgrade', authenticate, h.upgradeFactory);
  app.get('/api/factories/all', authenticate, h.getAllFactories);
  app.get('/api/factories/:id', authenticate, h.getFactoryById);
  app.post('/api/factories/:id/withdraw', authenticate, h.withdrawFactory);
}
