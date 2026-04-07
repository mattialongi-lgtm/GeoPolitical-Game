import { createAutomationHandlers } from '../handlers/automation.handler';

interface RegisterAutomationRoutesDeps {
  app: any;
  authenticate: any;
  supabase: any;
  GAME_CONFIG: any;
  FACTORY_CONFIG: any;
}

export function registerAutomationRoutes(deps: RegisterAutomationRoutesDeps) {
  const { app, authenticate } = deps;
  const h = createAutomationHandlers(deps);

  app.get('/api/automation/work', authenticate, h.getAutoWork);
  app.post('/api/automation/work', authenticate, h.setAutoWork);
  app.get('/api/automation/training', authenticate, h.getAutoTraining);
  app.get('/api/automation/war-attacks', authenticate, h.getAutoWarAttacks);
  app.post('/api/automation/training', authenticate, h.setAutoTraining);
}
