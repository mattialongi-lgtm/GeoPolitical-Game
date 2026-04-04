import { createFactoryMarketHandlers } from '../handlers/factory-market.handler';

interface RegisterFactoryMarketRoutesDeps {
  app: any;
  authenticate: any;
  supabase: any;
  generateSecureId: (len: number) => string;
  estimateFactoryValue: (type: string, level: number, recentProfit?: number) => number;
  FACTORY_CONFIG: any;
  factoryYieldMultiplier: (level: number) => number;
  factoryStorageLimit: (type: string, level: number) => number;
}

export function registerFactoryMarketRoutes(deps: RegisterFactoryMarketRoutesDeps) {
  const { app, authenticate } = deps;
  const h = createFactoryMarketHandlers(deps);

  app.get('/api/factory-market', authenticate, h.getMarket);
  app.post('/api/factory-market/list', authenticate, h.listForSale);
  app.post('/api/factory-market/buy', authenticate, h.buyListing);
  app.post('/api/factory-market/cancel', authenticate, h.cancelListing);
}
