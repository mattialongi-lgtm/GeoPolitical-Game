/**
 * Shared mock factories for backend unit tests.
 *
 * Usage:
 *   import { createMockSupabase, createMockRequest, createMockResponse } from '../setup';
 */

/* ─── Mock Supabase client ───────────────────────────────────────
 * Creates a deeply-chainable mock.  Every method call returns a
 * new proxy so that chains like `.from().select().eq().eq().maybeSingle()`
 * always work.  Use `mockTerminal(supabase, data, error)` to make
 * the *last* method in any chain resolve to `{ data, error }`.
 */
export function createMockSupabase() {
  // The "terminal result" — what the chain resolves to when awaited.
  let terminalResult: { data: any; error: any } = { data: null, error: null };
  const terminalResults: Array<{ data: any; error: any }> = [];

  function makeChain(): any {
    const chain: any = {};

    const chainMethods = [
      'select', 'insert', 'update', 'delete', 'upsert',
      'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in',
      'order', 'limit', 'range', 'match', 'or', 'filter',
    ];

    for (const m of chainMethods) {
      chain[m] = jest.fn().mockImplementation(() => makeChain());
    }

    // Terminal methods — return a Promise with the terminal result
    chain.single = jest.fn().mockImplementation(() => {
      const res = terminalResults.shift() ?? terminalResult;
      return Promise.resolve(res);
    });
    chain.maybeSingle = jest.fn().mockImplementation(() => {
      const res = terminalResults.shift() ?? terminalResult;
      return Promise.resolve(res);
    });

    // Make the chain itself thenable (for `await query`)
    chain.then = (resolve: any, reject: any) => {
      const res = terminalResults.shift() ?? terminalResult;
      return Promise.resolve(res).then(resolve, reject);
    };

    return chain;
  }

  const rpc = jest.fn().mockResolvedValue({ data: null, error: null });
  const from = jest.fn().mockImplementation(() => makeChain());

  const supabase: any = {
    rpc,
    from,
    auth: { getUser: jest.fn() },
    /**
     * Set the default terminal result for all chain resolutions.
     */
    _setResult(data: any, error: any = null) {
      terminalResult = { data, error };
    },
    /**
     * Queue a one-time terminal result (consumed FIFO).
     * Useful for tests that trigger multiple DB calls.
     */
    _pushResult(data: any, error: any = null) {
      terminalResults.push({ data, error });
    },
    /**
     * Reset queued results.
     */
    _resetResults() {
      terminalResults.length = 0;
      terminalResult = { data: null, error: null };
    },
  };

  return supabase;
}

/* ─── Mock Express request ───────────────────────────────────── */
export function createMockRequest(overrides: Record<string, any> = {}) {
  return {
    body: {},
    params: {},
    query: {},
    path: '/test',
    method: 'GET',
    user: {
      id: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
      money: 100000,
      gold: 500,
      energy: 100,
      xp: 0,
      level: 1,
      regionId: 'region-1',
      originalNationId: 'IT',
      displayedNationId: 'IT',
      perks: {},
      perkUpgrades: {},
      boosters: {},
      inventory: {},
      inventoryVolume: 0,
    },
    ...overrides,
  } as any;
}

/* ─── Mock Express response ──────────────────────────────────── */
export function createMockResponse() {
  const res: any = {
    statusCode: 200,
    _body: null as any,
    status: jest.fn().mockImplementation(function (this: any, code: number) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn().mockImplementation(function (this: any, body: any) {
      this._body = body;
      return this;
    }),
    send: jest.fn().mockReturnThis(),
  };
  return res;
}

/* ─── Mock Express next function ─────────────────────────────── */
export function createMockNext(): jest.Mock {
  return jest.fn();
}
