import { createWorldHandlers } from '../handlers/world.handler';

interface RegisterWorldRoutesDeps {
  app: any;
  authenticate: any;
  supabase: any;
}

export function registerWorldRoutes(deps: RegisterWorldRoutesDeps) {
  const { app, authenticate } = deps;
  const h = createWorldHandlers(deps);

  app.get('/api/world-stats', authenticate, h.getWorldStats);
  app.get('/api/dashboard-stats', authenticate, h.getDashboardStats);
  app.get('/api/nations', authenticate, h.getNations);
  app.get('/api/nations/:id', authenticate, h.getNationById);
  app.get('/api/leaderboard', authenticate, h.getLeaderboard);
}
