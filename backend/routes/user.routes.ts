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

  app.get('/api/me', authenticate, h.getMe);
  app.get('/api/players', authenticate, h.getPlayers);
  app.get('/api/players/:id', authenticate, h.getPlayerById);
  app.post('/api/actions/change-displayed-nation', authenticate, h.changeDisplayedNation);
  app.post('/api/actions/change-original-nation', authenticate, h.changeOriginalNation);
  app.post('/api/profile/avatar', authenticate, h.updateAvatar);
  app.put('/api/profile/username', authenticate, h.updateUsername);
  app.post('/api/dev/add-currency', authenticate, h.addCurrency);
}
