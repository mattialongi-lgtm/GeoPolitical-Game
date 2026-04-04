import { createDailyHandlers } from '../handlers/daily.handler';

interface RegisterDailyRoutesDeps {
  app: any;
  authenticate: any;
  supabase: any;
  ensureDailyMissions: (userId: string, playerLevel: number) => Promise<any[]>;
  dailyRewardService: any;
  mapServiceResultToHttp: (result: any) => { statusCode: number; body: any };
  isDailyMissionClaimSuccess: (payload: any) => boolean;
  isDailyBonusClaimSuccess: (payload: any) => boolean;
  DAILY_GAMEPLAY_CONFIG: any;
}

export function registerDailyRoutes(deps: RegisterDailyRoutesDeps) {
  const { app, authenticate } = deps;
  const h = createDailyHandlers(deps);

  app.get('/api/daily/missions', authenticate, h.getDailyMissions);
  app.post('/api/daily/missions/claim/:id', authenticate, h.claimMission);
  app.post('/api/daily/missions/claim-bonus', authenticate, h.claimBonus);
}
