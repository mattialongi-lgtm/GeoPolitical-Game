import { createActionsHandlers } from '../../handlers/actions.handler';
import { createMockRequest, createMockResponse, createMockSupabase } from '../setup';

function createDeps(overrides: Record<string, any> = {}) {
  return {
    supabase: createMockSupabase(),
    atomicOperations: {
      startTravel: jest.fn(),
      attackRegion: jest.fn(),
    },
    getUserPerks: jest.fn().mockResolvedValue({}),
    addXP: jest.fn(),
    generateSecureId: jest.fn().mockReturnValue('war1234'),
    addBudgetTransaction: jest.fn(),
    isValidIso2: jest.fn().mockReturnValue(true),
    performTrainingAction: jest.fn(),
    tryUseEnergyDrinkForUser: jest.fn(),
    performWorkAction: jest.fn(),
    updateMissionProgress: jest.fn(),
    retrySupabaseOperation: jest.fn(),
    GAME_CONFIG: {
      ATTACK_COOLDOWN: 60_000,
      ATTACK_ENERGY_COST: 30,
      XP_PER_ATTACK: 12,
      ENERGY_DRINK_COST_GOLD: 30,
      ENERGY_DRINK_COOLDOWN: 60_000,
      ENERGY_MAX: 100,
    },
    PERKS_DEFS: [],
    BOOSTER_CONFIG: {},
    RESOURCE_TYPES: [],
    FACTORY_CONFIG: {},
    EXTRACTION_CONFIG: {},
    AUTONOMY_CONFIG: {},
    factoryYieldMultiplier: jest.fn(),
    factoryStorageLimit: jest.fn(),
    calculateDamage: jest.fn(),
    calculateDamageCap: jest.fn(),
    incrementPlayerWorkExperience: jest.fn(),
    ...overrides,
  };
}

describe('actions.handler atomic flows', () => {
  it('uses atomic travel RPC and preserves response shape', async () => {
    const deps = createDeps();
    deps.atomicOperations.startTravel.mockResolvedValue({
      success: true,
      regionId: 'FR',
      travelMinutes: 17,
      travelingUntil: 123456789,
      travelingFrom: 'IT',
      travelDurationMs: 1_020_000,
    });

    const handlers = createActionsHandlers(deps as any);
    const req = createMockRequest({
      body: { regionId: 'fr' },
      user: { id: 'user-1', regionId: 'IT', residenceId: 'IT' },
    });
    const res = createMockResponse();

    await handlers.actionsTravel(req, res);

    expect(deps.atomicOperations.startTravel).toHaveBeenCalledWith({
      userId: 'user-1',
      targetRegionId: 'FR',
      travelTimeMs: expect.any(Number),
    });
    expect(res.statusCode).toBe(200);
    expect(res._body).toEqual({
      success: true,
      regionId: 'FR',
      travelMinutes: 17,
      travelingUntil: 123456789,
      travelingFrom: 'IT',
      travelDurationMs: 1_020_000,
    });
  });

  it('maps atomic attack authorization failures to 403', async () => {
    const deps = createDeps();
    deps.atomicOperations.attackRegion.mockResolvedValue({
      success: false,
      code: 'forbidden_same_bloc',
      message: 'Non puoi dichiarare guerra a un membro dello stesso Blocco Geopolitico.',
    });

    const handlers = createActionsHandlers(deps as any);
    const req = createMockRequest({
      body: { regionId: 'FR' },
      user: { id: 'user-1', regionId: 'IT' },
    });
    const res = createMockResponse();

    await handlers.actionsAttack(req, res);

    expect(res.statusCode).toBe(403);
    expect(res._body).toEqual({
      error: 'Non puoi dichiarare guerra a un membro dello stesso Blocco Geopolitico.',
    });
  });

  it('maps atomic attack success back to legacy payload fields', async () => {
    const deps = createDeps();
    deps.atomicOperations.attackRegion.mockResolvedValue({
      success: true,
      attackSucceeded: true,
      winProbability: 84,
    });

    const handlers = createActionsHandlers(deps as any);
    const req = createMockRequest({
      body: { regionId: 'FR' },
      user: { id: 'user-1', regionId: 'IT' },
    });
    const res = createMockResponse();

    await handlers.actionsAttack(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._body).toEqual({
      success: true,
      winProbability: 84,
    });
  });
});
