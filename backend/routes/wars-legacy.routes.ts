import { createWarsLegacyHandlers } from '../handlers/wars-legacy.handler';
import type { WarType, TroopType } from '../../src/types';

interface RegisterWarsLegacyRoutesDeps {
  app: any;
  authenticate: any;
  supabase: any;
  generateSecureId: (len: number) => string;
  getUserPerks: (userId: string, boosterInfo?: Record<string, any>) => Promise<Record<string, number>>;
  addXP: (...args: any[]) => Promise<any>;
  updateMissionProgress: (userId: string, missionType: string, progress: Record<string, number>) => Promise<any>;
  canManageRegion: (regionId: string, userId: string) => Promise<boolean>;
  retrySupabaseOperation: (...args: any[]) => Promise<any>;
  performWarDeployAction: (params: { userId: string; warId: string; side: string; weaponId: string }) => Promise<any>;
  GAME_CONFIG: any;
  TROOP_BASE_DAMAGE: Record<string, number>;
  TROOP_ENERGY_COST: Record<string, number>;
  TROOP_MONEY_COST: Record<string, number>;
  WAR_TYPE_ALLOWED_TROOPS: any;
  calculateDamage: (...args: any[]) => any;
  calculateDamageCap: (...args: any[]) => any;
  validateTroopDeployment: (...args: any[]) => any;
  getMaxDeployableTroops: (...args: any[]) => any;
  getAvailableTroops: (warType: WarType, navalPhase: number) => TroopType[];
  shouldAutoAttackFire: (...args: any[]) => boolean;
  normalizeRegionLikeId: (value: any) => string | null;
  canReadRegionScopedData: (user: any, regionId: string) => Promise<boolean>;
  getRegionBuildings: (regionId: string) => Promise<Record<string, number>>;
  calculateRegionalIndices: (buildings: Record<string, number>) => any;
}

export function registerWarsLegacyRoutes(deps: RegisterWarsLegacyRoutesDeps) {
  const { app, authenticate } = deps;
  const h = createWarsLegacyHandlers(deps);

  // War actions
  app.post('/api/wars/deploy', authenticate, h.deployWeapon);
  app.post('/api/wars/:warId/join', authenticate, h.joinWar);

  // War queries
  app.get('/api/wars/:warId/participants', authenticate, h.getParticipants);
  app.get('/api/wars/:warId/deployments', authenticate, h.getDeployments);
  app.get('/api/wars/:warId/history', authenticate, h.getHistory);
  app.get('/api/wars/:warId/available-troops', authenticate, h.getAvailableTroopsForWar);

  // Auto-attack
  app.post('/api/wars/:warId/auto-attack', authenticate, h.setAutoAttack);
  app.get('/api/wars/:warId/auto-attack', authenticate, h.getAutoAttack);

  // Revolution & coup
  app.post('/api/wars/revolution', authenticate, h.createRevolution);
  app.post('/api/wars/coup', authenticate, h.createCoup);

  // Lobbies
  app.get('/api/lobbies/:regionId', authenticate, h.getLobbies);
  app.post('/api/lobbies/:id/expire', authenticate, h.expireLobby);

  // Military agreements
  app.post('/api/military-agreements', authenticate, h.createMilitaryAgreement);
  app.get('/api/military-agreements/:stateId', authenticate, h.getMilitaryAgreements);

  // War departments
  app.get('/api/war-departments/:stateId', authenticate, h.getWarDepartments);

  // Revolutions & coups per region
  app.get('/api/revolutions/:regionId', authenticate, h.getRevolutions);
  app.get('/api/coups/:regionId', authenticate, h.getCoups);
}
