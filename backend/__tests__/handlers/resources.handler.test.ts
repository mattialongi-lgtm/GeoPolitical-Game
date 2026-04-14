import { createResourcesHandlers } from '../../handlers/resources.handler';
import { createMockRequest, createMockResponse, createMockSupabase } from '../setup';

describe('resources.handler', () => {
  it('prefers the current auto-work factory for matching manual extraction', async () => {
    const supabase = createMockSupabase();
    const executeExtractionWork = jest.fn().mockResolvedValue({ success: true, amount: 5 });
    const updateCooldown = jest.fn().mockResolvedValue(undefined);
    const atomicOperations = {
      rechargeResource: jest.fn(),
      activateDeepExploration: jest.fn(),
    };

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
      atomicOperations,
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

  it('uses atomic recharge RPC and returns its payload', async () => {
    const supabase = createMockSupabase();
    const atomicOperations = {
      rechargeResource: jest.fn().mockResolvedValue({
        success: true,
        rechargedAmount: 40,
        dailyMaxCap: 500,
      }),
      activateDeepExploration: jest.fn(),
    };

    const handlers = createResourcesHandlers({
      supabase,
      atomicOperations,
      getUserPerks: jest.fn(),
      addXP: jest.fn(),
      updateMissionProgress: jest.fn(),
      retrySupabaseOperation: jest.fn(),
      generateSecureId: jest.fn(),
      checkCooldown: jest.fn().mockResolvedValue(true),
      updateCooldown: jest.fn(),
      executeExtractionWork: jest.fn(),
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
      RESOURCE_TYPES: ['oil'],
      EXTRACTION_CONFIG: {},
      FACTORY_CONFIG: { TYPES: {} },
    });

    const req = createMockRequest({
      body: { regionId: 'IT', resourceType: 'oil', rechargeAmount: 40 },
      user: { id: 'leader-1' },
    });
    const res = createMockResponse();

    await handlers.recharge(req, res);

    expect(atomicOperations.rechargeResource).toHaveBeenCalledWith({
      userId: 'leader-1',
      regionId: 'IT',
      resourceType: 'oil',
      rechargeAmount: 40,
    });
    expect(res._body).toEqual({
      success: true,
      rechargedAmount: 40,
      dailyMaxCap: 500,
    });
  });

  it('maps atomic deep exploration validation failures to 400', async () => {
    const supabase = createMockSupabase();
    const atomicOperations = {
      rechargeResource: jest.fn(),
      activateDeepExploration: jest.fn().mockResolvedValue({
        success: false,
        code: 'insufficient_diamonds',
        message: 'Diamanti insufficienti.',
      }),
    };

    const handlers = createResourcesHandlers({
      supabase,
      atomicOperations,
      getUserPerks: jest.fn(),
      addXP: jest.fn(),
      updateMissionProgress: jest.fn(),
      retrySupabaseOperation: jest.fn(),
      generateSecureId: jest.fn(),
      checkCooldown: jest.fn().mockResolvedValue(true),
      updateCooldown: jest.fn(),
      executeExtractionWork: jest.fn(),
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
      RESOURCE_TYPES: ['oil'],
      EXTRACTION_CONFIG: {},
      FACTORY_CONFIG: { TYPES: {} },
    });

    const req = createMockRequest({
      body: { nationId: 'IT', resourceType: 'oil', level: 2 },
      user: { id: 'leader-1' },
    });
    const res = createMockResponse();

    await handlers.activateDeepExploration(req, res);

    expect(res.statusCode).toBe(400);
    expect(res._body).toEqual({ error: 'Diamanti insufficienti.' });
  });
});
