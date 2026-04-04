import { createMarketHandlers } from '../handlers/market.handler';

interface RegisterMarketRoutesDeps {
  app: any;
  authenticate: any;
  supabase: any;
  generateSecureId: (len: number) => string;
  getUserPerks: (userId: string, boosterInfo?: Record<string, any>) => Promise<Record<string, number>>;
  addBudgetTransaction: (
    ownerType: string,
    ownerId: string,
    type: string,
    subtype: string,
    moneyDelta: number,
    resourcesDelta?: Record<string, number>,
    createdByUserId?: string | null,
    metadata?: any
  ) => Promise<any>;
  checkCooldown: (userId: string, actionType: string, cooldownTime: number) => Promise<boolean>;
  updateCooldown: (userId: string, actionType: string) => Promise<void>;
  buyEnergyDrinksForUser: (userId: string, quantity?: number) => Promise<any>;
  updateMissionProgress: (userId: string, missionType: string, payload: Record<string, number>) => Promise<void>;
  addXP: (userId: string, amount: number) => Promise<void>;
  productionService: any;
  mapServiceResultToHttp: (result: any) => { statusCode: number; body: any };
  GAME_CONFIG: any;
}

export function registerMarketRoutes(deps: RegisterMarketRoutesDeps) {
  const { app, authenticate } = deps;
  const h = createMarketHandlers(deps);

  app.get('/api/market/listings', authenticate, h.getListings);
  app.post('/api/market/listings', authenticate, h.createListing);
  app.get('/api/market/state-inventory', authenticate, h.getStateInventory);
  app.get('/api/market/offers', authenticate, h.getOffers);
  app.post('/api/market/offer', authenticate, h.createOffer);
  app.post('/api/market/buy', authenticate, h.buyOffer);
  app.get('/api/inventory/history/:itemId', authenticate, h.getInventoryHistory);
  app.post('/api/market/energy-drinks/buy', authenticate, h.buyEnergyDrinks);
  app.post('/api/produce', authenticate, h.produce);
  app.get('/api/produce/list', authenticate, h.produceList);
  app.post('/api/produce/claim', authenticate, h.produceClaim);
}
