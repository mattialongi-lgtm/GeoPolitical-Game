import { createFactoryMarketHandlers } from '../../handlers/factory-market.handler';
import { createMockRequest, createMockResponse, createMockSupabase } from '../setup';

function createDeps(overrides: Record<string, any> = {}) {
  return {
    supabase: createMockSupabase(),
    atomicOperations: {
      listFactoryMarket: jest.fn(),
      cancelFactoryMarket: jest.fn(),
    },
    generateSecureId: jest.fn(),
    estimateFactoryValue: jest.fn(),
    FACTORY_CONFIG: { TYPES: {} },
    factoryYieldMultiplier: jest.fn(),
    factoryStorageLimit: jest.fn(),
    ...overrides,
  };
}

describe('factory-market.handler atomic flows', () => {
  it('uses atomic list RPC and preserves response shape', async () => {
    const deps = createDeps();
    deps.atomicOperations.listFactoryMarket.mockResolvedValue({
      success: true,
      listing: { id: 'listing-1', factoryId: 'factory-1' },
    });

    const handlers = createFactoryMarketHandlers(deps as any);
    const req = createMockRequest({
      body: { factoryId: 'factory-1', askingPrice: 1234, idempotencyKey: 'idem-1' },
      user: { id: 'seller-1' },
      headers: {},
    });
    const res = createMockResponse();

    await handlers.listForSale(req, res);

    expect(deps.atomicOperations.listFactoryMarket).toHaveBeenCalledWith({
      factoryId: 'factory-1',
      sellerId: 'seller-1',
      askingPrice: 1234,
      operationKey: 'idem-1',
    });
    expect(res._body).toEqual({
      success: true,
      listing: { id: 'listing-1', factoryId: 'factory-1' },
    });
  });

  it('maps atomic cancel conflicts to 409', async () => {
    const deps = createDeps();
    deps.atomicOperations.cancelFactoryMarket.mockResolvedValue({
      success: false,
      code: 'listing_not_active',
      message: 'Annuncio non attivo.',
    });

    const handlers = createFactoryMarketHandlers(deps as any);
    const req = createMockRequest({
      body: { listingId: 'listing-1' },
      user: { id: 'seller-1' },
      headers: {},
    });
    const res = createMockResponse();

    await handlers.cancelListing(req, res);

    expect(res.statusCode).toBe(409);
    expect(res._body).toEqual({ error: 'Annuncio non attivo.' });
  });
});
