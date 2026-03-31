import { WarRepository } from '../repositories/war.repository';
import type { WarDomainDeps } from './war-domain.helpers';
import { executeWarCreateUseCase, type CreateWarInput } from './war-create.usecase';
import { executeWarValidationUseCase, type ValidateWarTypesInput } from './war-validation.usecase';
import { executeWarDeployUseCase, type DeployTroopsInput } from './war-deploy.usecase';
import { executeGetValidWarTargetsUseCase, type GetValidWarTargetsInput } from './war-targets.usecase';

const createDefaultDeps = (): WarDomainDeps => ({
  validateWarCreation: () => ({ valid: true }),
  getRegionBuildings: async () => ({}),
  calculateInitialAttackDamage: () => 0,
  calculateInitialDefensePoints: () => 0,
  calculateDistancePenalty: () => 1,
  getWarDuration: () => 0,
  generateWarId: () => 'war',
  validateTroopDeployment: () => ({ valid: false, energyCost: 0, moneyCost: 0, error: 'not configured' }),
  getUserPerks: async () => ({}),
  getMaxDeployableTroops: () => 1,
  calculateRegionalIndices: () => ({ militaryIndex: 1 }),
  calculateDamage: () => ({ baseDamage: 0, finalDamage: 0 }),
  addXP: async () => undefined,
  updateMissionProgress: async () => undefined,
  troopEnergyCostByType: {},
  xpPerAttack: 0,
});

export class WarService {
  constructor(
    private readonly warRepository: WarRepository,
    private readonly deps: WarDomainDeps = createDefaultDeps(),
  ) {}

  async listWars() {
    const [active, ended] = await Promise.all([
      this.warRepository.getActiveWars(),
      this.warRepository.getEndedWars(20),
    ]);

    return { active, ended };
  }

  async getWarStats(warId: string) {
    const war = await this.warRepository.getWarById(warId);
    if (!war) {
      const notFoundError: any = new Error('Guerra non trovata.');
      notFoundError.statusCode = 404;
      throw notFoundError;
    }

    const attackerDamage: Record<string, any> = {};
    const defenderDamage: Record<string, any> = {};

    const participants = await this.warRepository.getWarParticipants(warId);

    if (participants.length > 0) {
      const userIds = participants.map((p: any) => p.userId);
      const usersData = await this.warRepository.getUsersByIds(userIds);
      const userMap: Record<string, any> = {};
      usersData.forEach((u: any) => { userMap[u.id] = u; });

      participants.forEach((p: any) => {
        const targetMap = p.side === 'attacker' ? attackerDamage : defenderDamage;
        const deployed = p.troopsDeployed || {};
        const hits = Object.values(deployed).reduce((sum: number, qty: any) => sum + (Number(qty) || 0), 0);
        const u = userMap[p.userId];
        targetMap[p.userId] = {
          userId: p.userId,
          username: u?.username || 'Guerriero',
          level: u?.level || 1,
          avatarData: u?.avatarData || null,
          totalDamage: p.totalDamage || 0,
          hits: hits || 1,
          side: p.side,
        };
      });
    }

    const participantUserIds = new Set((participants || []).map((p: any) => p.userId));
    const logs = await this.warRepository.getWarDeployLogs();

    (logs || []).forEach((log: any) => {
      try {
        const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
        if (details.warId !== warId) return;

        const targetMap = details.side === 'attacker' ? attackerDamage : defenderDamage;
        const uid = log.userId;

        if (!targetMap[uid]) {
          targetMap[uid] = {
            userId: uid,
            username: details.username || 'Guerriero',
            totalDamage: 0,
            hits: 0,
            side: details.side,
          };
        }

        if (!participantUserIds.has(uid)) {
          targetMap[uid].totalDamage += details.damage || 0;
          targetMap[uid].hits += 1;
        }
      } catch {
        // skip malformed logs
      }
    });

    return {
      war,
      stats: {
        attacker: Object.values(attackerDamage).sort((a: any, b: any) => b.totalDamage - a.totalDamage),
        defender: Object.values(defenderDamage).sort((a: any, b: any) => b.totalDamage - a.totalDamage),
      },
    };
  }

  async createWar(input: CreateWarInput) {
    return executeWarCreateUseCase(this.warRepository, this.deps, input);
  }

  async validateWarTypes(input: ValidateWarTypesInput) {
    return executeWarValidationUseCase(this.warRepository, input);
  }

  async deployTroops(input: DeployTroopsInput) {
    return executeWarDeployUseCase(this.warRepository, this.deps, input);
  }

  async getValidTargets(input: GetValidWarTargetsInput) {
    return executeGetValidWarTargetsUseCase(this.warRepository, input);
  }
}
