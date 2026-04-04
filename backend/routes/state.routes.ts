import { createStateHandlers } from '../handlers/state.handler';

interface RegisterStateRoutesDeps {
  app: any;
  authenticate: any;
  supabase: any;
  calculateStateSalaries: any;
  getUserPerks: any;
  addXP: any;
  canManageRegion: any;
  retrySupabaseOperation: any;
  GAME_CONFIG: any;
}

export function registerStateRoutes(deps: RegisterStateRoutesDeps) {
  const { app, authenticate } = deps;
  const h = createStateHandlers(deps);

  app.get('/api/state/:id', authenticate, h.getState);
  app.post('/api/state/:id/donate', authenticate, h.donate);
  app.get('/api/state/:id/departments', authenticate, h.getDepartments);
  app.post('/api/state/:id/departments/contribute', authenticate, h.contributeDepartments);
  app.post('/api/leader/nation/branding', authenticate, h.updateNationBranding);
  app.get('/api/nations/:nationId/energy', authenticate, h.getNationEnergy);
}
