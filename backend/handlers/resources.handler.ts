/**
 * Resources & Extraction Handlers
 *
 * Extracted from server.ts — no logic changes.
 * Covers: /api/resources/player-state, /api/resources/work-extract,
 *   /api/resources/recharge, /api/resources/recharge-info,
 *   /api/resources/deep-exploration/cost, /api/resources/deep-exploration/activate,
 *   /api/resources/deep-exploration/status,
 *   /api/extraction/work, /api/extraction/breakdown,
 *   /api/extraction/player-experience, /api/extraction/transfer-work-exp,
 *   /api/extraction/region-dashboard/:id, /api/extraction/leaderboard
 */

import { logger } from '../utils/logger';
import { REGION_RESOURCE_CAPS_BY_TYPE } from '../../src/types';
import {
  getFactoryResourceType,
  isExtractionFactoryEligible,
  pickPreferredExtractionFactory,
} from '../utils/extraction-factory';

export function createResourcesHandlers(deps: {
  supabase: any;
  atomicOperations: any;
  getUserPerks: any;
  addXP: any;
  updateMissionProgress: any;
  retrySupabaseOperation: any;
  generateSecureId: any;
  checkCooldown: any;
  updateCooldown: any;
  executeExtractionWork: any;
  computeDeepCost: any;
  getNationForRegion: any;
  getActiveDeep: any;
  computeEffectiveCap: any;
  getSetting: any;
  getCachedDeepLevels: any;
  getPlayerWorkExperience: any;
  incrementPlayerWorkExperience: any;
  getRegionPowerPlants: any;
  getDepartmentBonus: any;
  getResourceCoefficient: any;
  getWorkExperienceMultiplier: any;
  getWorkExperienceGainForEnergyCost: any;
  getMaxWorkXpPerResource: any;
  calculateExtraction: any;
  createAutomationError: any;
  GAME_CONFIG: any;
  RESOURCE_TYPES: any;
  EXTRACTION_CONFIG: any;
  FACTORY_CONFIG: any;
}) {
  const {
    supabase, atomicOperations, getUserPerks, addXP, updateMissionProgress,
    retrySupabaseOperation, generateSecureId,
    checkCooldown, updateCooldown,
    executeExtractionWork, computeDeepCost,
    getNationForRegion, getActiveDeep, computeEffectiveCap, getSetting,
    getCachedDeepLevels,
    getPlayerWorkExperience, incrementPlayerWorkExperience,
    getRegionPowerPlants, getDepartmentBonus,
    getResourceCoefficient,
    getWorkExperienceMultiplier, getWorkExperienceGainForEnergyCost,
    getMaxWorkXpPerResource, calculateExtraction,
    createAutomationError,
    GAME_CONFIG, RESOURCE_TYPES, EXTRACTION_CONFIG, FACTORY_CONFIG,
  } = deps;

  const isAutomationExpired = (activatedAt?: string | null, expiresAt?: string | null, now = Date.now()) => {
    if (expiresAt) return new Date(expiresAt).getTime() <= now;
    if (!activatedAt) return false;
    return (now - new Date(activatedAt).getTime()) >= 24 * 60 * 60 * 1000;
  };

  async function getExtractionRegionResourceRollup24h(regionId: string): Promise<Record<string, any>> {
    const analytics: Record<string, any> = {};
    try {
      const { data, error } = await supabase
        .from('mv_extraction_region_resource_24h')
        .select('"resourceType","extractionCount","totalExtracted","totalPlayerAmount","totalTaxAmount","totalStateAmount","totalAutonomyAmount","totalMoneyGenerated","totalWithdrawnPoints"')
        .eq('regionId', regionId);
      if (error) throw error;
      for (const row of (data || [])) {
        const rt = row.resourceType;
        if (!rt) continue;
        analytics[rt] = {
          totalExtracted: Number(row.totalExtracted || 0),
          totalPlayerAmount: Number(row.totalPlayerAmount || 0),
          totalTaxAmount: Number(row.totalTaxAmount || 0),
          totalStateAmount: Number(row.totalStateAmount || 0),
          totalAutonomyAmount: Number(row.totalAutonomyAmount || 0),
          totalMoneyGenerated: Number(row.totalMoneyGenerated || 0),
          totalWithdrawnPoints: Number(row.totalWithdrawnPoints || 0),
          extractionCount: Number(row.extractionCount || 0),
        };
      }
      return analytics;
    } catch {
      return {};
    }
  }

  // GET /api/resources/player-state
  async function getPlayerState(req: any, res: any) {
    const user = req.user;
    const regionId = (req.query.regionId as string) || user.regionId;
    try {
      const { data: states, error } = await supabase
        .from('player_extraction_state')
        .select('*')
        .eq('playerId', user.id)
        .eq('regionId', regionId);

      if (error) throw error;
      res.json({ states: states || [] });
    } catch (err: any) {
      console.error("Error fetching player extraction state:", err);
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  // POST /api/resources/work-extract
  async function workExtract(req: any, res: any) {
    const user = req.user;
    const { regionId, resourceType } = req.body;

    if (!regionId || !resourceType) {
      return res.status(400).json({ error: "regionId e resourceType sono obbligatori." });
    }
    if (!RESOURCE_TYPES.includes(resourceType)) {
      return res.status(400).json({ error: "Tipo di risorsa non valido." });
    }

    try {
      const extractionCooldownMs = parseInt(await getSetting('work_extract_cooldown_ms')) || 2000;
      const canExtract = await checkCooldown(user.id, 'resource_extract_work', extractionCooldownMs);
      if (!canExtract) {
        return res.status(429).json({ error: "Troppi tentativi ravvicinati. Riprova tra pochi secondi." });
      }

      const factoryTypeCandidates = Object.entries(FACTORY_CONFIG.TYPES)
        .filter(([, def]: any) => def?.resource === resourceType)
        .map(([type]) => type);

      if (factoryTypeCandidates.length === 0) {
        return res.status(400).json({ error: "Nessuna fabbrica compatibile per questa risorsa." });
      }

      let preferredFactoryId: string | null = null;
      try {
        const { data: activeAutoWork, error: autoWorkError } = await supabase
          .from('work_auto_actions')
          .select('factoryId, activatedAt, expiresAt')
          .eq('userId', user.id)
          .eq('isActive', true)
          .maybeSingle();

        if (!autoWorkError && activeAutoWork && !isAutomationExpired(activeAutoWork.activatedAt, activeAutoWork.expiresAt)) {
          preferredFactoryId = activeAutoWork.factoryId || null;
        }
      } catch {
        preferredFactoryId = null;
      }

      let targetFactory = null as any;
      if (preferredFactoryId) {
        const { data: preferredFactory, error: preferredFactoryError } = await supabase
          .from('factories')
          .select('*')
          .eq('id', preferredFactoryId)
          .maybeSingle();
        if (preferredFactoryError) throw preferredFactoryError;

        if (
          isExtractionFactoryEligible(preferredFactory, FACTORY_CONFIG) &&
          preferredFactory.regionId === regionId &&
          getFactoryResourceType(preferredFactory, FACTORY_CONFIG) === resourceType
        ) {
          targetFactory = preferredFactory;
        }
      }

      if (!targetFactory) {
        const { data: factories, error: factoryErr } = await supabase
          .from('factories')
          .select('*')
          .eq('regionId', regionId)
          .in('type', factoryTypeCandidates)
          .eq('isActive', true)
          .eq('payMode', 'resource')
          .order('level', { ascending: false });

        if (factoryErr) throw factoryErr;
        targetFactory = pickPreferredExtractionFactory(factories, FACTORY_CONFIG, resourceType, preferredFactoryId);
      }

      if (!targetFactory) {
        return res.status(404).json({ error: "Nessuna fabbrica attiva in Modalita Risorse trovata per questa risorsa nella regione selezionata." });
      }

      const result = await executeExtractionWork(user, targetFactory.id);
      await updateCooldown(user.id, 'resource_extract_work');
      return res.json(result);
    } catch (err: any) {
      if (err?.statusCode) {
        return res.status(err.statusCode).json({
          error: err.message,
          ...(err?.reason ? { reason: err.reason } : {}),
        });
      }
      console.error("Error in work-extract:", err);
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      return res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  // POST /api/resources/recharge
  // Ricarica il cap disponibile corrente. Solo il Ministro dell'Economia o il Leader possono farlo.
  // Il totale sbloccato oggi (totalUnlockedToday) non può mai superare dailyMaxCap.
  async function recharge(req: any, res: any) {
    const user = req.user;
    const { regionId, resourceType, rechargeAmount } = req.body;

    if (!regionId || !resourceType) {
      return res.status(400).json({ error: "regionId e resourceType sono obbligatori." });
    }

    try {
      const result = await atomicOperations.rechargeResource({
        userId: user.id,
        regionId,
        resourceType,
        rechargeAmount: typeof rechargeAmount === 'number' ? rechargeAmount : null,
      });

      const codeToStatus: Record<string, number> = {
        invalid_input: 400,
        daily_max_reached: 400,
        cooldown_active: 400,
        insufficient_budget: 400,
        forbidden: 403,
        region_not_found: 404,
        resource_not_found: 404,
      };

      if (!result?.success) {
        return res.status(codeToStatus[result?.code] || 400).json({
          error: result?.message || "An unexpected error occurred. Please try again.",
          ...(result?.cooldownRemaining ? { cooldownRemaining: result.cooldownRemaining } : {}),
          ...(result?.dailyMaxCap ? { dailyMaxCap: result.dailyMaxCap } : {}),
          ...(result?.totalUnlockedToday ? { totalUnlockedToday: result.totalUnlockedToday } : {}),
        });
      }

      res.json(result);
    } catch (err: any) {
      logger.error('operation_failed', { error: err?.message, path: req?.path, flow: 'resource_recharge_atomic' });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  // GET /api/resources/recharge-info
  async function getRechargeInfo(req: any, res: any) {
    const regionId = req.query.regionId as string;
    const resourceType = req.query.resourceType as string;
    if (!regionId || !resourceType) return res.status(400).json({ error: "regionId e resourceType obbligatori" });

    try {
      const cooldownSec = parseInt(await getSetting('recharge_cooldown_seconds')) || 1800;
      const costEur = parseInt(await getSetting('recharge_cost_eur')) || 0;

      const [rechargeData, regionRes, budget] = await Promise.all([
        supabase.from('resource_recharges').select('lastRechargeAt').eq('regionId', regionId).eq('resourceType', resourceType).maybeSingle().then(r => r.data),
        supabase.from('region_resources').select('dailyMaxCap, currentAvailableCap, totalUnlockedToday, initialAvailableCap').eq('regionId', regionId).eq('resourceType', resourceType).maybeSingle().then(r => r.data),
        supabase.from('budgets').select('moneyEUR').eq('ownerType', 'REGION').eq('ownerId', regionId).maybeSingle().then(r => r.data),
      ]);

      let cooldownRemaining = 0;
      if (rechargeData?.lastRechargeAt) {
        const elapsed = (Date.now() - new Date(rechargeData.lastRechargeAt).getTime()) / 1000;
        cooldownRemaining = Math.max(0, cooldownSec - elapsed);
      }

      const dailyMaxCap = regionRes?.dailyMaxCap ?? 0;
      const totalUnlockedToday = regionRes?.totalUnlockedToday ?? 0;
      const canUnlockMore = Math.max(0, dailyMaxCap - totalUnlockedToday);

      res.json({
        cooldownRemaining: Math.ceil(cooldownRemaining),
        cooldownTotal: cooldownSec,
        costEur,
        lastRechargeAt: rechargeData?.lastRechargeAt || null,
        treasuryEur: budget?.moneyEUR || 0,
        canAfford: costEur === 0 || (budget?.moneyEUR || 0) >= costEur,
        dailyMaxCap,
        currentAvailableCap: regionRes?.currentAvailableCap ?? 0,
        totalUnlockedToday,
        canUnlockMore,
        initialAvailableCap: regionRes?.initialAvailableCap ?? 0,
      });
    } catch (err: any) {
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  // POST /api/resources/deep-exploration/cost
  async function getDeepExplorationCost(req: any, res: any) {
    const { nationId, resourceType, level } = req.body;
    if (!nationId || !resourceType || !level) {
      return res.status(400).json({ error: "nationId, resourceType e level sono obbligatori." });
    }

    try {
      const preview = await computeDeepCost(nationId, resourceType, parseInt(level));
      res.json(preview);
    } catch (err: any) {
      console.error("Error computing deep cost:", err);
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  // POST /api/resources/deep-exploration/activate
  async function activateDeepExploration(req: any, res: any) {
    const user = req.user;
    const { nationId, resourceType, level } = req.body;

    if (!nationId || !resourceType || !level) {
      return res.status(400).json({ error: "nationId, resourceType e level sono obbligatori." });
    }

    try {
      const result = await atomicOperations.activateDeepExploration({
        userId: user.id,
        nationId,
        resourceType,
        level: parseInt(level, 10),
      });

      const codeToStatus: Record<string, number> = {
        invalid_input: 400,
        invalid_level: 400,
        cap_limit_exceeded: 400,
        active_deep_exists: 400,
        insufficient_budget: 400,
        insufficient_diamonds: 400,
        insufficient_gold: 400,
        forbidden: 403,
        capital_not_configured: 400,
        nation_not_found: 404,
        resource_not_configured: 404,
        user_not_found: 404,
      };

      if (!result?.success) {
        return res.status(codeToStatus[result?.code] || 400).json({ error: result?.message || "An unexpected error occurred. Please try again." });
      }

      res.json(result);
    } catch (err: any) {
      logger.error('operation_failed', { error: err?.message, path: req?.path, flow: 'deep_activation_atomic' });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  // GET /api/resources/deep-exploration/status
  async function getDeepExplorationStatus(req: any, res: any) {
    const nationId = req.query.nationId as string;
    if (!nationId) return res.status(400).json({ error: "nationId obbligatorio" });

    try {
      const nowStr = new Date().toISOString();
      const [{ data: active }, levels] = await Promise.all([
        supabase
          .from('deep_explorations')
          .select('*')
          .eq('nationId', nationId)
          .eq('isActive', true)
          .gte('endsAt', nowStr)
          .order('startsAt', { ascending: false })
          .limit(1),
        getCachedDeepLevels()
      ]);

      res.json({
        active: active && active.length > 0 ? active[0] : null,
        levels: levels || [],
      });
    } catch (err: any) {
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  // POST /api/extraction/work
  async function extractionWork(req: any, res: any) {
    const user = req.user;
    const { factoryId } = req.body;

    if (!factoryId) {
      return res.status(400).json({ error: "factoryId è obbligatorio." });
    }

    try {
      const result = await executeExtractionWork(user, factoryId);
      return res.json(result);
    } catch (err: any) {
      if (err?.statusCode) {
        return res.status(err.statusCode).json({
          error: err.message,
          ...(err?.reason ? { reason: err.reason } : {}),
        });
      }
      console.error("Error in extraction/work:", err);
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      return res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  // GET /api/extraction/breakdown
  async function getExtractionBreakdown(req: any, res: any) {
    const user = req.user;
    const factoryId = req.query.factoryId as string;
    if (!factoryId) return res.status(400).json({ error: "factoryId è obbligatorio." });

    try {
      const { data: factory } = await supabase.from('factories').select('id, type, regionId, level').eq('id', factoryId).single();
      if (!factory) return res.status(404).json({ error: "Fabbrica non trovata." });

      const factoryType = factory.type || '';
      const typeDef = FACTORY_CONFIG.TYPES[factoryType];
      if (!typeDef) return res.status(400).json({ error: "Tipo fabbrica non valido." });

      const resourceType = typeDef.resource;
      const regionId = factory.regionId;

      const { data: regionRel } = await supabase.from('regions')
        .select('id, marketTaxRate, industryTaxPercent, regionalProfitSharePercent, healthIndex')
        .eq('id', regionId).single();
      if (!regionRel) return res.status(404).json({ error: "Regione non trovata." });

      const { data: regionRes } = await supabase
        .from('region_resources')
        .select('regionId, resourceType, baseCapPerRecharge, currentAvailableCap, totalUnlockedToday, dailyMaxCap')
        .eq('regionId', regionId)
        .eq('resourceType', resourceType)
        .maybeSingle();

      const nationId = await getNationForRegion(regionId);
      const capMaxGlobal = parseInt(await getSetting('cap_max_global')) || 2000;
      const deep = nationId ? await getActiveDeep(nationId, resourceType) : null;
      const baseCap = regionRes?.baseCapPerRecharge ?? REGION_RESOURCE_CAPS_BY_TYPE[resourceType] ?? 200;
      const effectiveCap = computeEffectiveCap(baseCap, deep, capMaxGlobal);
      const deepBonus = deep ? Math.max(0, (deep.targetCap || 0) - baseCap) : 0;
      const currentAvailableCap = regionRes?.currentAvailableCap ?? 999999;

      const perks = user.perks || {};
      const maxWorkExperience = getMaxWorkXpPerResource(perks['ISTRUZIONE'] || 0);
      const [workExp, numPowerPlants, departmentBonusLevel] = await Promise.all([
        getPlayerWorkExperience(user.id, resourceType, maxWorkExperience),
        getRegionPowerPlants(regionId),
        getDepartmentBonus(regionId, resourceType),
      ]);

      const resourceCoefficient = getResourceCoefficient(resourceType, effectiveCap, numPowerPlants);

      const taxRate = regionRel.marketTaxRate ?? regionRel.industryTaxPercent ?? FACTORY_CONFIG.DEFAULT_INDUSTRY_TAX_RATE;
      const autonomySharePercent = regionRel.regionalProfitSharePercent ?? 0;

      const breakdown = calculateExtraction({
        playerLevel: user.level || 1,
        factoryLevel: factory.level || 1,
        workExperience: workExp,
        resourceType,
        resourceCoefficient,
        departmentBonusLevel,
        nationBonusEnabled: true,
        taxRate,
        ownerProfitRate: FACTORY_CONFIG.OWNER_PROFIT_RATE,
        autonomySharePercent,
        regionCapMax: baseCap,
        regionDeepBonus: deepBonus,
        regionCapTotal: effectiveCap,
        regionResidualToday: currentAvailableCap,
        regionHealthIndex: regionRel.healthIndex || 1,
      });

      const resistenza = perks['RESISTENZA'] || 0;
      const energyReduction = Math.min(0.5, resistenza / 100);
      const actualEnergyCost = Math.ceil(EXTRACTION_CONFIG.WORK_ACTION_ENERGY_COST * (1 - energyReduction));

      res.set('Cache-Control', 'no-store');
      res.json({
        breakdown,
        energyCost: actualEnergyCost,
        factoryType,
        factoryLevel: factory.level,
        resourceLabel: (FACTORY_CONFIG.TYPES[factoryType] as any)?.label || factoryType,
        workExperience: workExp,
        canWork: currentAvailableCap > 0 && user.energy >= actualEnergyCost,
      });
    } catch (err: any) {
      console.error("Error in extraction/breakdown:", err);
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  // GET /api/extraction/player-experience
  async function getPlayerExperience(req: any, res: any) {
    try {
      const educationLevel = req.user?.perks?.['ISTRUZIONE'] || 0;
      const maxExperience = getMaxWorkXpPerResource(educationLevel);
      const { data, error } = await supabase
        .from('player_resource_work_experience')
        .select('*')
        .eq('playerId', req.user.id)
        .order('resourceType', { ascending: true });

      if (error) throw error;
      res.set('Cache-Control', 'no-store');
      res.json({
        experience: (data || []).map((entry: any) => ({
          ...entry,
          experience: Math.max(0, Math.floor(Number(entry?.experience) || 0)),
          totalExtractions: Math.max(0, Math.floor(Number(entry?.totalExtractions) || 0)),
          maxExperience,
        })),
        maxExperience,
      });
    } catch (err: any) {
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  // POST /api/extraction/transfer-work-exp
  async function transferWorkExp(req: any, res: any) {
    try {
      const user = req.user;
      const sourceResource = String(req.body?.sourceResource || '').trim();
      const targetResource = String(req.body?.targetResource || '').trim();
      const xpToTransfer = Math.floor(Number(req.body?.xpToTransfer) || 0);

      if (!sourceResource || !targetResource) {
        return res.status(400).json({ error: "sourceResource e targetResource sono obbligatori" });
      }
      if (sourceResource === targetResource) {
        return res.status(400).json({ error: "sourceResource e targetResource non possono essere uguali" });
      }
      if (xpToTransfer <= 0) {
        return res.status(400).json({ error: "xpToTransfer deve essere > 0" });
      }

      const allowed = new Set((RESOURCE_TYPES as any[]) || []);
      if (!allowed.has(sourceResource as any) || !allowed.has(targetResource as any)) {
        return res.status(400).json({ error: "Risorsa non valida" });
      }

      const { data, error } = await supabase.rpc('transfer_work_experience', {
        p_player_id: user.id,
        p_source_resource: sourceResource,
        p_target_resource: targetResource,
        p_xp_to_transfer: xpToTransfer,
      });
      if (error) {
        return res.status(400).json({ error: error.message });
      }

      res.set('Cache-Control', 'no-store');
      return res.json({ success: true, transfer: data });
    } catch (err: any) {
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      return res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  // GET /api/extraction/region-dashboard/:id
  async function getRegionDashboard(req: any, res: any) {
    const regionId = req.params.id;
    try {
      const { data: region } = await supabase.from('regions').select('*').eq('id', regionId).single();
      if (!region) return res.status(404).json({ error: "Regione non trovata." });

      const { data: resources } = await supabase
        .from('region_resources')
        .select('*')
        .eq('regionId', regionId);

      const nationId = await getNationForRegion(regionId);
      const capMaxGlobal = parseInt(await getSetting('cap_max_global')) || 2000;

      const enriched = await Promise.all((resources || []).map(async (r: any) => {
        const deep = nationId ? await getActiveDeep(nationId, r.resourceType) : null;
        const effectiveCap = computeEffectiveCap(r.baseCapPerRecharge, deep, capMaxGlobal);
        const deepBonus = deep ? Math.max(0, (deep.targetCap || 0) - r.baseCapPerRecharge) : 0;
        const dailyMaxCap = r.dailyMaxCap ?? r.dailyAvailable ?? 5000;
        const currentAvailableCap = r.currentAvailableCap ?? 0;
        const totalUnlockedToday = r.totalUnlockedToday ?? 0;
        return {
          resourceType: r.resourceType,
          baseCap: r.baseCapPerRecharge,
          deepBonus,
          effectiveCap,
          dailyMaxCap,
          currentAvailableCap,
          dailyExtracted: r.dailyExtracted,
          totalUnlockedToday,
          canUnlockMore: Math.max(0, dailyMaxCap - totalUnlockedToday),
          remainingDaily: currentAvailableCap,
          deepActive: !!deep,
          deepEndsAt: deep?.endsAt || null,
        };
      }));

      const analytics = await getExtractionRegionResourceRollup24h(regionId);

      const { data: deptBonuses } = await supabase
        .from('resource_department_bonuses')
        .select('*')
        .eq('regionId', regionId);

      res.json({
        regionId,
        regionName: region.name,
        isAutonomous: region.isAutonomous || false,
        taxRate: region.marketTaxRate ?? region.industryTaxPercent ?? FACTORY_CONFIG.DEFAULT_INDUSTRY_TAX_RATE,
        autonomySharePercent: region.regionalProfitSharePercent ?? 0,
        resources: enriched,
        analytics24h: analytics,
        departmentBonuses: deptBonuses || [],
      });
    } catch (err: any) {
      console.error("Error in region dashboard:", err);
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  // GET /api/extraction/leaderboard
  async function getExtractionLeaderboard(req: any, res: any) {
    try {
      const regionId = req.query.regionId as string;

      let rows: any[] = [];

      if (regionId) {
        const { data, error } = await supabase
          .from('mv_extraction_player_region_24h')
          .select('"playerId","totalPlayerAmount"')
          .eq('regionId', regionId)
          .order('totalPlayerAmount', { ascending: false })
          .limit(20);
        if (error) throw error;
        rows = data || [];
      } else {
        // Back-compat fallback (global leaderboard) — heavier and not used by current UI.
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: logs } = await supabase
          .from('extraction_detailed_logs')
          .select('playerId, playerAmount')
          .gte('createdAt', since24h);

        const playerTotals: Record<string, number> = {};
        for (const log of (logs || [])) {
          if (!log?.playerId) continue;
          playerTotals[log.playerId] = (playerTotals[log.playerId] || 0) + Number(log.playerAmount || 0);
        }

        rows = Object.entries(playerTotals)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([playerId, totalPlayerAmount]) => ({ playerId, totalPlayerAmount }));
      }

      const playerIds = (rows || []).map((r: any) => r.playerId).filter(Boolean);
      let usernameMap: Record<string, any> = {};
      if (playerIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, username, level')
          .in('id', playerIds);
        for (const u of (users || [])) usernameMap[u.id] = u;
      }

      const leaderboard = (rows || []).map((r: any) => ({
        playerId: r.playerId,
        username: usernameMap[r.playerId]?.username || 'Unknown',
        level: usernameMap[r.playerId]?.level || 1,
        totalExtracted: Math.round(Number(r.totalPlayerAmount || 0)),
      }));

      res.json({ leaderboard });
    } catch (err: any) {
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  return {
    getPlayerState,
    workExtract,
    recharge,
    getRechargeInfo,
    getDeepExplorationCost,
    activateDeepExploration,
    getDeepExplorationStatus,
    extractionWork,
    getExtractionBreakdown,
    getPlayerExperience,
    transferWorkExp,
    getRegionDashboard,
    getExtractionLeaderboard,
  };
}
