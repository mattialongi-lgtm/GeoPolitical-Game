import { createGovernanceHandlers } from '../../handlers/governance.handler';
import { createMockRequest, createMockResponse, createMockSupabase } from '../setup';

function createDeps(overrides: Record<string, any> = {}) {
  return {
    supabase: createMockSupabase(),
    atomicOperations: {
      budgetDonate: jest.fn(),
      budgetCleanRadiation: jest.fn(),
      ministersAssign: jest.fn(),
      ministersRevoke: jest.fn(),
      leaderVote: jest.fn(),
      sanctionsApply: jest.fn(),
      sanctionsRevoke: jest.fn(),
    },
    generateSecureId: jest.fn().mockReturnValue('id-1'),
    isValidIso2: jest.fn().mockReturnValue(true),
    isValidUuid: jest.fn().mockReturnValue(true),
    canManageRegion: jest.fn().mockResolvedValue(true),
    assertCanManageRegion: jest.fn().mockResolvedValue('IT'),
    getUserPerks: jest.fn().mockResolvedValue({}),
    addXP: jest.fn().mockResolvedValue(undefined),
    addBudgetTransaction: jest.fn().mockResolvedValue(undefined),
    retrySupabaseOperation: jest.fn().mockResolvedValue(undefined),
    GAME_CONFIG: {},
    ...overrides,
  };
}

describe('governance.handler atomic flows', () => {
  it('uses atomic budgetDonate RPC', async () => {
    const deps = createDeps();
    deps.atomicOperations.budgetDonate.mockResolvedValue({ success: true, donated: 123 });
    const handlers = createGovernanceHandlers(deps as any);

    const req = createMockRequest({
      body: { entityId: 'IT', amount: 1, currency: 'EUR', idempotencyKey: 'don-1' },
      user: { id: 'user-1', level: 60, money: 100, gold: 0 },
      headers: {},
    });
    const res = createMockResponse();

    await handlers.budgetDonate(req, res);

    expect(deps.atomicOperations.budgetDonate).toHaveBeenCalledWith({
      userId: 'user-1',
      entityId: 'IT',
      amount: 1,
      currency: 'EUR',
      operationKey: 'don-1',
    });
    expect(res._body).toEqual({ success: true, donated: 123 });
  });

  it('uses atomic ministersAssign RPC', async () => {
    const deps = createDeps();
    deps.atomicOperations.ministersAssign.mockResolvedValue({ success: true, title: 'Minister of Economics' });
    deps.supabase._pushResult({ governmentForm: 'PRESIDENTIAL_REPUBLIC' });
    deps.supabase._pushResult(null);
    const handlers = createGovernanceHandlers(deps as any);

    const req = createMockRequest({
      body: { userId: 'user-2', role: 'economics', iso2: 'IT', idempotencyKey: 'min-1' },
      user: { id: 'leader-1' },
      headers: {},
    });
    const res = createMockResponse();

    await handlers.ministersAssign(req, res);

    expect(deps.atomicOperations.ministersAssign).toHaveBeenCalledWith({
      leaderUserId: 'leader-1',
      stateId: 'IT',
      userId: 'user-2',
      role: 'economics',
      operationKey: 'min-1',
    });
    expect(res._body).toEqual({ success: true, title: 'Minister of Economics' });
  });

  it('uses atomic leaderVote RPC', async () => {
    const deps = createDeps();
    deps.atomicOperations.leaderVote.mockResolvedValue({ success: true });
    const handlers = createGovernanceHandlers(deps as any);

    const req = createMockRequest({
      body: { regionId: 'IT', candidateId: 'cand-1', idempotencyKey: 'vote-1' },
      user: { id: 'voter-1', residenceId: 'IT' },
      headers: {},
    });
    const res = createMockResponse();

    await handlers.leaderVote(req, res);

    expect(deps.atomicOperations.leaderVote).toHaveBeenCalledWith({
      regionId: 'IT',
      voterId: 'voter-1',
      candidateId: 'cand-1',
      operationKey: 'vote-1',
    });
    expect(res._body).toEqual({ success: true });
  });

  it('uses atomic sanctionsApply RPC', async () => {
    const deps = createDeps();
    deps.atomicOperations.sanctionsApply.mockResolvedValue({ success: true });
    const handlers = createGovernanceHandlers(deps as any);

    const req = createMockRequest({
      body: { targetStateId: 'FR', fromStateId: 'IT', idempotencyKey: 's-1' },
      user: { id: 'leader-1', regionId: 'IT' },
      headers: {},
    });
    const res = createMockResponse();

    await handlers.sanctionsApply(req, res);

    expect(deps.atomicOperations.sanctionsApply).toHaveBeenCalledWith({
      actorUserId: 'leader-1',
      fromStateId: 'IT',
      targetStateId: 'FR',
      operationKey: 's-1',
    });
    expect(res._body).toEqual({ success: true });
  });
});

