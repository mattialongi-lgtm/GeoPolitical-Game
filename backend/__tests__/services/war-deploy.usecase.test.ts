import { executeWarDeployUseCase, type DeployTroopsInput } from '../../services/war-deploy.usecase';
import type { WarRepository } from '../../repositories/war.repository';
import type { WarDomainDeps } from '../../services/war-domain.helpers';

/* ─── Helpers ─────────────────────────────────────────────── */

function createMockWarRepository(): jest.Mocked<WarRepository> {
  return {
    getWarById: jest.fn(),
    runWarDeployRpc: jest.fn(),
    safeDeductCurrency: jest.fn(),
    updateUserEnergyAndMoney: jest.fn(),
    updateWarScore: jest.fn(),
    insertWarDeployment: jest.fn(),
    getWarParticipantByWarAndUser: jest.fn(),
    updateWarParticipantById: jest.fn(),
    insertWarParticipant: jest.fn(),
    insertActionLog: jest.fn(),
    getWarDepartmentBonus: jest.fn(),
    getRegionNationId: jest.fn(),
    // Query methods not used in deploy — stub to satisfy type
    getActiveWars: jest.fn(),
    getEndedWars: jest.fn(),
    getWarParticipants: jest.fn(),
    getDamageParticipantsByUser: jest.fn(),
    getUsersByIds: jest.fn(),
    getWarDeployLogs: jest.fn(),
    getUserWarDeployLogs: jest.fn(),
    getWarsByIds: jest.fn(),
    getRegionById: jest.fn(),
    getAllRegionsDetailed: jest.fn(),
    getAllNationsBasic: jest.fn(),
    getActiveWarTouchingRegion: jest.fn(),
    getActiveRevolution: jest.fn(),
    getActiveCoup: jest.fn(),
    getActiveBlocMembership: jest.fn(),
    insertWar: jest.fn(),
    insertWarHistory: jest.fn(),
  } as unknown as jest.Mocked<WarRepository>;
}

function createMockDeps(): WarDomainDeps {
  return {
    validateWarCreation: jest.fn().mockReturnValue({ valid: true }),
    getRegionBuildings: jest.fn().mockResolvedValue({}),
    calculateInitialAttackDamage: jest.fn().mockReturnValue(0),
    calculateInitialDefensePoints: jest.fn().mockReturnValue(0),
    calculateDistancePenalty: jest.fn().mockReturnValue(1),
    getWarDuration: jest.fn().mockReturnValue(0),
    generateWarId: jest.fn().mockReturnValue('war-id'),
    validateTroopDeployment: jest.fn().mockReturnValue({
      valid: true,
      energyCost: 300,
      moneyCost: 0,
    }),
    getUserPerks: jest.fn().mockResolvedValue({}),
    getMaxDeployableTroops: jest.fn().mockReturnValue(100),
    calculateRegionalIndices: jest.fn().mockReturnValue({ militaryIndex: 1 }),
    calculateDamage: jest.fn().mockReturnValue({
      baseDamage: 100,
      finalDamage: 110,
    }),
    addXP: jest.fn().mockResolvedValue(undefined),
    updateMissionProgress: jest.fn().mockResolvedValue(undefined),
    troopEnergyCostByType: { tank: 300 },
    xpPerAttack: 5,
  };
}

function createDefaultInput(): DeployTroopsInput {
  return {
    user: {
      id: 'user-1',
      username: 'testuser',
      energy: 1000,
      money: 5000,
      level: 5,
      regionId: 'region-1',
      isPremium: false,
    },
    warId: 'war-1',
    side: 'attacker',
    troopType: 'tank',
    quantity: 1,
  };
}

const activeWar = {
  id: 'war-1',
  status: 'active',
  warType: 'land',
  navalPhase: 0,
  attackerScore: 500,
  defenderScore: 300,
  attackerRegionId: 'region-a',
  defenderRegionId: 'region-d',
  attackerCountryIso2: 'IT',
  defenderCountryIso2: 'DE',
  distancePenalty: 0,
};

/* ─── Tests ───────────────────────────────────────────────── */

describe('executeWarDeployUseCase', () => {
  let repo: jest.Mocked<WarRepository>;
  let deps: WarDomainDeps;

  beforeEach(() => {
    repo = createMockWarRepository();
    deps = createMockDeps();
  });

  describe('success path', () => {
    it('should call rpc_war_deploy and return success', async () => {
      repo.getWarById.mockResolvedValue(activeWar);
      repo.runWarDeployRpc.mockResolvedValue({
        data: { success: true, damage: 110, newScore: 610, energy: 700, money: 5000 },
        error: null,
      });

      const result = await executeWarDeployUseCase(repo, deps, createDefaultInput());

      expect(result.type).toBe('success');
      expect(result.statusCode).toBe(200);
      if (result.type === 'success') {
        expect(result.payload.success).toBe(true);
        expect(result.payload.damageDealt).toBe(110);
      }
      expect(repo.runWarDeployRpc).toHaveBeenCalledWith({
        warId: 'war-1',
        userId: 'user-1',
        side: 'attacker',
        weaponId: 'tank',
        energyCost: 300,
        moneyCost: 0,
        damage: 110,
      });
    });
  });

  describe('insufficient energy', () => {
    it('should return validation_error from RPC when energy is insufficient', async () => {
      repo.getWarById.mockResolvedValue(activeWar);
      repo.runWarDeployRpc.mockResolvedValue({
        data: { error: 'Energia insufficiente. Servono 300, hai 100.' },
        error: null,
      });

      const result = await executeWarDeployUseCase(repo, deps, createDefaultInput());

      expect(result.type).toBe('validation_error');
      expect(result.statusCode).toBe(400);
      if (result.type !== 'success') {
        expect(result.message).toContain('Energia insufficiente');
      }
    });

    it('should return validation_error from troop validation when energy is too low', async () => {
      (deps.validateTroopDeployment as jest.Mock).mockReturnValue({
        valid: false,
        error: 'Energia insufficiente per questo tipo di truppa.',
        energyCost: 300,
        moneyCost: 0,
      });
      repo.getWarById.mockResolvedValue(activeWar);

      const result = await executeWarDeployUseCase(repo, deps, createDefaultInput());

      expect(result.type).toBe('validation_error');
      expect(result.statusCode).toBe(400);
      // RPC should NOT be called when validation fails
      expect(repo.runWarDeployRpc).not.toHaveBeenCalled();
    });
  });

  describe('insufficient money', () => {
    it('should return validation_error from RPC when money is insufficient', async () => {
      repo.getWarById.mockResolvedValue(activeWar);
      repo.runWarDeployRpc.mockResolvedValue({
        data: { error: 'Fondi insufficienti. Servono $500, hai $100.' },
        error: null,
      });

      const result = await executeWarDeployUseCase(repo, deps, createDefaultInput());

      expect(result.type).toBe('validation_error');
      expect(result.statusCode).toBe(400);
      if (result.type !== 'success') {
        expect(result.message).toContain('Fondi insufficienti');
      }
    });
  });

  describe('war not active', () => {
    it('should return validation_error when war status is not active', async () => {
      repo.getWarById.mockResolvedValue({ ...activeWar, status: 'ended' });

      const result = await executeWarDeployUseCase(repo, deps, createDefaultInput());

      expect(result.type).toBe('validation_error');
      expect(result.statusCode).toBe(400);
      if (result.type !== 'success') {
        expect(result.message).toContain('terminata');
      }
      expect(repo.runWarDeployRpc).not.toHaveBeenCalled();
    });

    it('should return not_found when war does not exist', async () => {
      repo.getWarById.mockResolvedValue(null);

      const result = await executeWarDeployUseCase(repo, deps, createDefaultInput());

      expect(result.type).toBe('not_found');
      expect(result.statusCode).toBe(404);
      expect(repo.runWarDeployRpc).not.toHaveBeenCalled();
    });
  });

  describe('RPC fallback', () => {
    it('should use safe_deduct_currency fallback when RPC throws', async () => {
      repo.getWarById.mockResolvedValue(activeWar);
      repo.runWarDeployRpc.mockRejectedValue(new Error('function not found'));
      repo.safeDeductCurrency.mockResolvedValue({ data: null, error: null });
      repo.getWarParticipantByWarAndUser.mockResolvedValue(null);

      const result = await executeWarDeployUseCase(repo, deps, createDefaultInput());

      expect(result.type).toBe('success');
      expect(repo.safeDeductCurrency).toHaveBeenCalledWith('user-1', 0, 0, 300);
      expect(repo.updateWarScore).toHaveBeenCalled();
      expect(repo.insertWarParticipant).toHaveBeenCalled();
      expect(repo.insertActionLog).toHaveBeenCalled();
    });

    it('should return validation_error when fallback deduction fails', async () => {
      repo.getWarById.mockResolvedValue(activeWar);
      repo.runWarDeployRpc.mockRejectedValue(new Error('function not found'));
      repo.safeDeductCurrency.mockResolvedValue({
        data: null,
        error: { message: 'Energia insufficiente' },
      });

      const result = await executeWarDeployUseCase(repo, deps, createDefaultInput());

      expect(result.type).toBe('validation_error');
      expect(result.statusCode).toBe(400);
    });
  });

  describe('validation', () => {
    it('should return validation_error for missing warId', async () => {
      const input = createDefaultInput();
      input.warId = '';

      const result = await executeWarDeployUseCase(repo, deps, input);

      expect(result.type).toBe('validation_error');
      expect(result.statusCode).toBe(400);
    });
  });
});
