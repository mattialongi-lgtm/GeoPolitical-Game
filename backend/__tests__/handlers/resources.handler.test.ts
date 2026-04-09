import { createResourcesHandlers } from '../../handlers/resources.handler';
import { createMockRequest, createMockResponse, createMockSupabase } from '../setup';

describe('resources.handler', () => {
  it('prefers the current auto-work factory for matching manual extraction', async () => {
    const supabase = createMockSupabase();
    const executeExtractionWork = jest.fn().mockResolvedValue({ success: true, amount: 5 });
    const updateCooldown = jest.fn().mockResolvedValue(undefined);

    supabase._pushResult({
      factoryId: 'preferred-factory',
      activatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    supabase._pushResult({
      id: 'preferred-factory',
      type: 'oil',
      regionId: 'IT',
      level: 1,
      isActive: true,
      payMode: 'resource',
    });

    const handlers = createResourcesHandlers({
      supabase,
      getUserPerks: jest.fn(),
      addXP: jest.fn(),
      updateMissionProgress: jest.fn(),
      retrySupabaseOperation: jest.fn(),
      generateSecureId: jest.fn(),
      checkCooldown: jest.fn().mockResolvedValue(true),
      updateCooldown,
      executeExtractionWork,
      computeDeepCost: jest.fn(),
      getNationForRegion: jest.fn(),
      getActiveDeep: jest.fn(),
      computeEffectiveCap: jest.fn(),
      getSetting: jest.fn().mockResolvedValue('2000'),
      getCachedDeepLevels: jest.fn(),
      getPlayerWorkExperience: jest.fn(),
      incrementPlayerWorkExperience: jest.fn(),
      getRegionPowerPlants: jest.fn(),
      getDepartmentBonus: jest.fn(),
      getResourceCoefficient: jest.fn(),
      getWorkExperienceMultiplier: jest.fn(),
      getWorkExperienceGainForEnergyCost: jest.fn(),
      getMaxWorkXpPerResource: jest.fn(),
      calculateExtraction: jest.fn(),
      createAutomationError: jest.fn(),
      GAME_CONFIG: {},
      RESOURCE_TYPES: ['oil', 'gold_ore'],
      EXTRACTION_CONFIG: {},
      FACTORY_CONFIG: {
        TYPES: {
          oil: { resource: 'oil' },
        },
      },
    });

    const req = createMockRequest({
      body: { regionId: 'IT', resourceType: 'oil' },
      user: { id: 'user-1', regionId: 'IT' },
    });
    const res = createMockResponse();

    await handlers.workExtract(req, res);

    expect(executeExtractionWork).toHaveBeenCalledWith(req.user, 'preferred-factory');
    expect(updateCooldown).toHaveBeenCalledWith('user-1', 'resource_extract_work');
    expect(res._body).toEqual({ success: true, amount: 5 });
  });
});
