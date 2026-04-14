import { createPoliticsHandlers } from '../../handlers/politics.handler';
import { createMockRequest, createMockResponse, createMockSupabase } from '../setup';

function createDeps(overrides: Record<string, any> = {}) {
  return {
    supabase: createMockSupabase(),
    atomicOperations: {
      createParty: jest.fn(),
      joinParty: jest.fn(),
      createBloc: jest.fn(),
      applyToBloc: jest.fn(),
      voteBlocApplication: jest.fn(),
      proposeBlocRegulation: jest.fn(),
      voteBlocRegulation: jest.fn(),
      proposeLaw: jest.fn(),
      resolveLaw: jest.fn(),
    },
    generateSecureId: jest.fn().mockReturnValue('id-1'),
    getUserPerks: jest.fn().mockResolvedValue({}),
    partyAssetsService: { transferPartyAsset: jest.fn() },
    mapServiceResultToHttp: jest.fn(),
    LawRegistry: {
      transfer_budget: { category: 'Economia e Tasse', delayDays: 1, validate: jest.fn().mockResolvedValue(null) },
      grant_autonomy: { category: 'Autonomie Regionali', delayDays: 1, validate: jest.fn().mockResolvedValue(null) },
    },
    GAME_CONFIG: {},
    ...overrides,
  };
}

describe('politics.handler atomic flows', () => {
  it('uses atomic createParty RPC', async () => {
    const deps = createDeps();
    deps.atomicOperations.createParty.mockResolvedValue({ success: true, partyId: 'party-1' });
    const handlers = createPoliticsHandlers(deps as any);
    const req = createMockRequest({
      body: { name: 'Alpha', idempotencyKey: 'party-key' },
      user: { id: 'user-1', username: 'alice', residenceId: 'IT', gold: 200 },
      headers: {},
    });
    const res = createMockResponse();

    await handlers.createParty(req, res);

    expect(deps.atomicOperations.createParty).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      name: 'Alpha',
      operationKey: 'party-key',
    }));
    expect(res._body).toEqual({ success: true, partyId: 'party-1' });
  });

  it('uses atomic bloc vote RPC', async () => {
    const deps = createDeps();
    deps.atomicOperations.voteBlocApplication.mockResolvedValue({ success: true, result: 'approved' });
    const handlers = createPoliticsHandlers(deps as any);
    const req = createMockRequest({
      params: { id: 'app-1' },
      body: { voterStateId: 'IT', choice: true },
      user: { id: 'leader-1' },
      headers: {},
    });
    const res = createMockResponse();

    await handlers.voteApplication(req, res);

    expect(deps.atomicOperations.voteBlocApplication).toHaveBeenCalledWith({
      applicationId: 'app-1',
      voterUserId: 'leader-1',
      voterStateId: 'IT',
      choice: 1,
      operationKey: null,
    });
    expect(res._body).toEqual({ success: true, result: 'approved' });
  });

  it('uses atomic proposeLaw RPC for immediate laws', async () => {
    const deps = createDeps();
    deps.atomicOperations.proposeLaw.mockResolvedValue({ success: true, lawId: 'law-1', immediate: true });
    deps.supabase._pushResult({ id: 'IT', ownerUserId: 'leader-1', governmentForm: 'DICTATORSHIP', dictatorship: 1 });
    deps.supabase._pushResult(null);
    const handlers = createPoliticsHandlers(deps as any);
    const req = createMockRequest({
      body: { type: 'grant_autonomy', params: { targetRegionId: 'RM' }, idempotencyKey: 'law-key' },
      user: { id: 'leader-1', residenceId: 'IT' },
      headers: {},
    });
    const res = createMockResponse();

    await handlers.proposeLaw(req, res);

    expect(deps.atomicOperations.proposeLaw).toHaveBeenCalledWith({
      userId: 'leader-1',
      regionId: 'IT',
      type: 'grant_autonomy',
      params: { targetRegionId: 'RM' },
      forceImmediate: true,
      operationKey: 'law-key',
    });
    expect(res._body).toEqual({
      success: true,
      lawId: 'law-1',
      immediate: true,
      message: 'Legge approvata immediatamente grazie ai tuoi poteri ministeriali.',
    });
  });

  it('uses atomic resolveLaw RPC for withdraw', async () => {
    const deps = createDeps();
    deps.atomicOperations.resolveLaw.mockResolvedValue({ success: true, result: 'withdrawn' });
    deps.supabase._pushResult({ id: 'law-1', status: 'pending', proposerId: 'user-1' });
    const handlers = createPoliticsHandlers(deps as any);
    const req = createMockRequest({
      body: { lawId: 'law-1' },
      user: { id: 'user-1' },
      headers: {},
    });
    const res = createMockResponse();

    await handlers.withdrawLaw(req, res);

    expect(deps.atomicOperations.resolveLaw).toHaveBeenCalledWith({
      lawId: 'law-1',
      actorUserId: 'user-1',
      action: 'withdraw',
      operationKey: null,
    });
    expect(res._body).toEqual({ success: true });
  });
});
