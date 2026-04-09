import { createAutomationHandlers } from '../../handlers/automation.handler';
import { createMockRequest, createMockResponse, createMockSupabase } from '../setup';

describe('automation.handler', () => {
  it('rejects auto-work activation on factories outside Modalita Risorse', async () => {
    const supabase = createMockSupabase();
    supabase._pushResult({
      id: 'factory-1',
      type: 'oil',
      name: 'Salary Oil',
      level: 4,
      regionId: 'IT',
      isActive: true,
      payMode: 'salary',
    });

    const handlers = createAutomationHandlers({
      supabase,
      GAME_CONFIG: {},
      FACTORY_CONFIG: {
        TYPES: {
          oil: { resource: 'oil' },
        },
      },
    });

    const req = createMockRequest({
      body: { factoryId: 'factory-1' },
      user: { id: 'user-1', regionId: 'IT' },
    });
    const res = createMockResponse();

    await handlers.setAutoWork(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res._body).toEqual({
      error: 'Auto-lavoro estrattivo disponibile solo su fabbriche attive in Modalita Risorse.',
    });
  });
});
