import { createActionsHandlers } from '../handlers/actions.handler';
import { writeLimiter } from '../middleware/rateLimiter.middleware';

interface RegisterActionsRoutesDeps {
  app: any;
  authenticate: any;
  supabase: any;
  atomicOperations: any;
  getUserPerks: (userId: string, boosterInfo?: Record<string, any>) => Promise<Record<string, number>>;
  addXP: (userId: string, amount: number) => Promise<void>;
  generateSecureId: (length: number) => string;
  addBudgetTransaction: (...args: any[]) => Promise<any>;
  isValidIso2: (code: string) => boolean;
  performTrainingAction: (userId: string) => Promise<any>;
  tryUseEnergyDrinkForUser: (...args: any[]) => Promise<any>;
  performWorkAction: (userId: string, factoryId: string, options?: any) => Promise<any>;
  updateMissionProgress: (userId: string, type: string, data: Record<string, any>) => Promise<any>;
  retrySupabaseOperation: (...args: any[]) => Promise<any>;
  GAME_CONFIG: any;
  PERKS_DEFS: any[];
  BOOSTER_CONFIG: any;
  RESOURCE_TYPES: any;
  FACTORY_CONFIG: any;
  EXTRACTION_CONFIG: any;
  AUTONOMY_CONFIG: any;
  factoryYieldMultiplier: (level: number) => number;
  factoryStorageLimit: (type: string, level: number) => number;
  calculateDamage: (...args: any[]) => number;
  calculateDamageCap: (...args: any[]) => number;
  incrementPlayerWorkExperience: (userId: string, resourceType: string, gain: number, istruzioneLevel: number) => Promise<any>;
}

export function registerActionsRoutes(deps: RegisterActionsRoutesDeps) {
  const { app, authenticate } = deps;
  const h = createActionsHandlers(deps);

  app.post('/api/actions/work', writeLimiter, authenticate, h.actionsWork);
  app.post('/api/actions/propaganda', writeLimiter, authenticate, h.actionsPropaganda);
  app.post('/api/actions/invest', writeLimiter, authenticate, h.actionsInvest);
  app.post('/api/actions/craft-drink', writeLimiter, authenticate, h.actionsCraftDrink);
  app.post('/api/actions/use-drink', writeLimiter, authenticate, h.actionsUseDrink);
  app.post('/api/actions/travel', writeLimiter, authenticate, h.actionsTravel);
  app.post('/api/actions/cancel-travel', writeLimiter, authenticate, h.actionsCancelTravel);
  app.post('/api/actions/attack', writeLimiter, authenticate, h.actionsAttack);
  app.post('/api/actions/train', writeLimiter, authenticate, h.actionsTrain);
  app.post('/api/work', writeLimiter, authenticate, h.work);
  app.post('/api/perks/upgrade', writeLimiter, authenticate, h.perksUpgrade);
  app.post('/api/perks/booster', writeLimiter, authenticate, h.perksBooster);
}
