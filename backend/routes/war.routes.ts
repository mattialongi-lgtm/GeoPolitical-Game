import { WarController } from '../controllers/war.controller';
import { WarRepository } from '../repositories/war.repository';
import { WarDomainDeps } from '../services/war-domain.helpers';
import { WarService } from '../services/war.service';

interface RegisterWarRoutesDeps {
  app: any;
  authenticate: any;
  supabase: any;
  warDomain: WarDomainDeps;
}

export function registerWarRoutes({
  app,
  authenticate,
  supabase,
  warDomain,
}: RegisterWarRoutesDeps) {
  const warRepository = new WarRepository(supabase);
  const warService = new WarService(warRepository, warDomain);
  const warController = new WarController(warService);

  app.get('/api/wars', authenticate, warController.listWars);
  app.get('/api/wars/validation', authenticate, warController.validateWarTypes);
  app.get('/api/wars/targets/:attackerRegionId', authenticate, warController.getValidTargets);
  app.get('/api/wars/player-damage-summary', authenticate, warController.getPlayerDamageSummary);
  app.get('/api/wars/:id/stats', authenticate, warController.getWarStats);
  app.post('/api/wars/create', authenticate, warController.createWar);
  app.post('/api/wars/deploy-troops', authenticate, warController.deployTroops);
}
