import { createResourcesHandlers } from '../handlers/resources.handler';
import { writeLimiter, strictLimiter } from '../middleware/rateLimiter.middleware';

interface RegisterResourcesRoutesDeps {
  app: any;
  authenticate: any;
  supabase: any;
  atomicOperations: any;
  getUserPerks: any;
  addXP: any;
  updateMissionProgress: any;
  retrySupabaseOperation: any;
  generateSecureId: any;
  checkCooldown: any;
  updateCooldown: any;
  executeExtractionWork: any;
  computeDeepCost: any;
  getNationForRegion: any;
  getActiveDeep: any;
  computeEffectiveCap: any;
  getSetting: any;
  getCachedDeepLevels: any;
  getPlayerWorkExperience: any;
  incrementPlayerWorkExperience: any;
  getRegionPowerPlants: any;
  getDepartmentBonus: any;
  getResourceCoefficient: any;
  getWorkExperienceMultiplier: any;
  getWorkExperienceGainForEnergyCost: any;
  getMaxWorkXpPerResource: any;
  calculateExtraction: any;
  createAutomationError: any;
  GAME_CONFIG: any;
  RESOURCE_TYPES: any;
  EXTRACTION_CONFIG: any;
  FACTORY_CONFIG: any;
}

export function registerResourcesRoutes(deps: RegisterResourcesRoutesDeps) {
  const { app, authenticate } = deps;
  const h = createResourcesHandlers(deps);

  // Resources
  app.get('/api/resources/player-state', authenticate, h.getPlayerState);
  app.post('/api/resources/work-extract', strictLimiter, authenticate, h.workExtract);
  app.post('/api/resources/recharge', writeLimiter, authenticate, h.recharge);
  app.get('/api/resources/recharge-info', authenticate, h.getRechargeInfo);
  app.post('/api/resources/deep-exploration/cost', writeLimiter, authenticate, h.getDeepExplorationCost);
  app.post('/api/resources/deep-exploration/activate', strictLimiter, authenticate, h.activateDeepExploration);
  app.get('/api/resources/deep-exploration/status', authenticate, h.getDeepExplorationStatus);

  // Extraction
  app.post('/api/extraction/work', writeLimiter, authenticate, h.extractionWork);
  app.get('/api/extraction/breakdown', authenticate, h.getExtractionBreakdown);
  app.get('/api/extraction/player-experience', authenticate, h.getPlayerExperience);
  app.post('/api/extraction/transfer-work-exp', writeLimiter, authenticate, h.transferWorkExp);
  app.get('/api/extraction/region-dashboard/:id', authenticate, h.getRegionDashboard);
  app.get('/api/extraction/leaderboard', authenticate, h.getExtractionLeaderboard);
}
