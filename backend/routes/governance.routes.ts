import { createGovernanceHandlers } from '../handlers/governance.handler';

interface RegisterGovernanceRoutesDeps {
  app: any;
  authenticate: any;
  supabase: any;
  generateSecureId: (len: number) => string;
  isValidIso2: (v: string) => boolean;
  isValidUuid: (v: string) => boolean;
  canManageRegion: (regionId: string, userId: string) => Promise<boolean>;
  assertCanManageRegion: (req: any, res: any, rawRegionId: any, forbiddenMessage: string) => Promise<string | null>;
  getUserPerks: (userId: string, boosterInfo?: Record<string, any>) => Promise<Record<string, number>>;
  addXP: (userId: string, amount: number) => Promise<void>;
  addBudgetTransaction: (...args: any[]) => Promise<any>;
  retrySupabaseOperation: (...args: any[]) => Promise<any>;
  GAME_CONFIG: Record<string, any>;
}

export function registerGovernanceRoutes(deps: RegisterGovernanceRoutesDeps) {
  const { app, authenticate } = deps;
  const h = createGovernanceHandlers(deps);

  // Budget
  app.post('/api/budget/donate', authenticate, h.budgetDonate);
  app.post('/api/budget/clean-radiation', authenticate, h.budgetCleanRadiation);
  app.post('/api/budget/explore', authenticate, h.budgetExplore);
  app.get('/api/budget/:ownerType/:ownerId', authenticate, h.getBudget);

  // Ministers
  app.post('/api/ministers/assign', authenticate, h.ministersAssign);
  app.post('/api/ministers/revoke', authenticate, h.ministersRevoke);
  app.get('/api/ministers/:iso2', authenticate, h.getMinistersByIso2);
  app.post('/api/ministers/sanctions', authenticate, h.ministersSanctions);
  app.delete('/api/ministers/market-offer/:id', authenticate, h.ministersDeleteMarketOffer);

  // Applications & Actions
  app.post('/api/actions/apply', authenticate, h.actionsApply);
  app.get('/api/applications/:regionId', authenticate, h.getApplications);
  app.get('/api/leader/orders/:regionId', authenticate, h.getLeaderOrders);
  app.post('/api/actions/resolve-application', authenticate, h.resolveApplication);
  app.post('/api/actions/toggle-borders', authenticate, h.toggleBorders);

  // Government
  app.post('/api/government/assign-minister', authenticate, h.governmentAssignMinister);
  app.post('/api/government/transition', authenticate, h.governmentTransition);

  // Leader System
  app.post('/api/leader/candidate', authenticate, h.leaderCandidate);
  app.post('/api/leader/vote', authenticate, h.leaderVote);
  app.post('/api/leader/update-state-ui', authenticate, h.leaderUpdateStateUi);

  // Minister Orders
  app.get('/api/ministers/orders', authenticate, h.getMinistersOrders);
  app.post('/api/ministers/orders', authenticate, h.postMinistersOrders);

  // Managed Regions
  app.get('/api/users/me/managed-regions', authenticate, h.getManagedRegions);

  // Sanctions
  app.post('/api/sanctions/apply', authenticate, h.sanctionsApply);
  app.post('/api/sanctions/revoke', authenticate, h.sanctionsRevoke);
}
