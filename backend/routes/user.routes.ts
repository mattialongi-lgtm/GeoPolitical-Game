import { createUserHandlers } from '../handlers/user.handler';

interface RegisterUserRoutesDeps {
  app: any;
  authenticate: any;
  supabase: any;
  getUserPerks: (userId: string, boosterInfo?: Record<string, any>) => Promise<Record<string, number>>;
  isAllowedAvatarDataUrl: (value: string) => boolean;
  IS_PRODUCTION: boolean;
  ENABLE_DEV_ENDPOINTS: boolean;
}

export function registerUserRoutes(deps: RegisterUserRoutesDeps) {
  const { app, authenticate } = deps;
  const h = createUserHandlers(deps);

  // ▼ OPTIMIZED: /api/me now returns minimal data for frequent polling (20s)
  app.get('/api/me', authenticate, h.getMe);

  // ▼ NEW: /api/sync-state loads heavy data & executes side effects (call less frequently)
  app.post('/api/sync-state', authenticate, h.syncState);

  app.get('/api/players', authenticate, h.getPlayers);
  app.get('/api/players/:id', authenticate, h.getPlayerById);
  app.post('/api/actions/change-displayed-nation', authenticate, h.changeDisplayedNation);
  app.post('/api/actions/change-original-nation', authenticate, h.changeOriginalNation);
  app.get('/api/profile/avatar', authenticate, h.getMyAvatar);
  app.post('/api/profile/avatar', authenticate, h.updateAvatar);
  app.put('/api/profile/username', authenticate, h.updateUsername);
  app.post('/api/dev/add-currency', authenticate, h.addCurrency);
}
