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

export function createResourcesHandlers(deps: {
  supabase: any;
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
    supabase, getUserPerks, addXP, updateMissionProgress,
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

      const { data: factories, error: factoryErr } = await supabase
        .from('factories')
        .select('*')
        .eq('regionId', regionId)
        .in('type', factoryTypeCandidates)
        .eq('isActive', true)
        .order('level', { ascending: false })
        .limit(1);

      if (factoryErr) throw factoryErr;
      const targetFactory = factories?.[0];
      if (!targetFactory) {
        return res.status(404).json({ error: "Nessuna fabbrica attiva trovata per questa risorsa nella regione selezionata." });
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
  async function recharge(req: any, res: any) {
    const user = req.user;
    const { regionId, resourceType } = req.body;

    if (!regionId || !resourceType) {
      return res.status(400).json({ error: "regionId e resourceType sono obbligatori." });
    }

    try {
      const { data: region, error: regErr } = await supabase
        .from('regions')
        .select('*')
        .eq('id', regionId)
        .single();
      if (regErr || !region) return res.status(404).json({ error: "Regione non trovata." });

      const isLeader = region.ownerUserId === user.id;
      const isEconomyMinister = region.economicAdviserId === user.id;

      if (!isLeader && !isEconomyMinister) {
        return res.status(403).json({ error: "Solo il Dittatore/Leader o il Ministro dell'Economia possono ricaricare." });
      }

      const cooldownSec = parseInt(await getSetting('recharge_cooldown_seconds')) || 7200;
      const { data: rechargeData } = await supabase
        .from('resource_recharges')
        .select('*')
        .eq('regionId', regionId)
        .eq('resourceType', resourceType)
        .maybeSingle();

      if (rechargeData?.lastRechargeAt) {
        const elapsed = (Date.now() - new Date(rechargeData.lastRechargeAt).getTime()) / 1000;
        if (elapsed < cooldownSec) {
          const remaining = Math.ceil(cooldownSec - elapsed);
          return res.status(400).json({
            error: `Cooldown attivo. Riprova tra ${Math.ceil(remaining / 60)} minuti.`,
            cooldownRemaining: remaining,
          });
        }
      }

      const costEur = parseInt(await getSetting('recharge_cost_eur')) || 50000;
      const costGold = parseInt(await getSetting('recharge_cost_gold')) || 0;
      const costDiamonds = parseInt(await getSetting('recharge_cost_diamonds')) || 0;

      if (costEur > 0) {
        try {
          await supabase.rpc('add_budget_transaction', {
            p_owner_type: 'REGION',
            p_owner_id: regionId,
            p_type: 'EXPENSE',
            p_subtype: 'RESOURCE_RECHARGE',
            p_money_delta: -costEur,
            p_created_by: user.id,
            p_metadata: { resourceType, costEur, costGold, costDiamonds },
          });
        } catch (budgetErr: any) {
          return res.status(400).json({ error: "Fondi del tesoro insufficienti per la ricarica. Servono €" + costEur.toLocaleString() });
        }
      }

      const { error: resetErr } = await supabase
        .from('player_extraction_state')
        .update({ extractedSinceLastRecharge: 0, updatedAt: new Date().toISOString() })
        .eq('regionId', regionId)
        .eq('resourceType', resourceType);
      if (resetErr) throw resetErr;

      const nowIso = new Date().toISOString();
      if (rechargeData) {
        await supabase
          .from('resource_recharges')
          .update({ lastRechargeAt: nowIso, rechargedByUserId: user.id })
          .eq('regionId', regionId)
          .eq('resourceType', resourceType);
      } else {
        await supabase
          .from('resource_recharges')
          .insert({ regionId, resourceType, lastRechargeAt: nowIso, rechargedByUserId: user.id });
      }

      res.json({
        success: true,
        message: `Ricarica completata per ${resourceType} nella regione ${regionId}.`,
        costEur,
        cooldownSeconds: cooldownSec,
      });
    } catch (err: any) {
      console.error("Error in resource recharge:", err);
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  // GET /api/resources/recharge-info
  async function getRechargeInfo(req: any, res: any) {
    const regionId = req.query.regionId as string;
    const resourceType = req.query.resourceType as string;
    if (!regionId || !resourceType) return res.status(400).json({ error: "regionId e resourceType obbligatori" });

    try {
      const cooldownSec = parseInt(await getSetting('recharge_cooldown_seconds')) || 7200;
      const costEur = parseInt(await getSetting('recharge_cost_eur')) || 50000;

      const { data: rechargeData } = await supabase
        .from('resource_recharges')
        .select('*')
        .eq('regionId', regionId)
        .eq('resourceType', resourceType)
        .maybeSingle();

      let cooldownRemaining = 0;
      if (rechargeData?.lastRechargeAt) {
        const elapsed = (Date.now() - new Date(rechargeData.lastRechargeAt).getTime()) / 1000;
        cooldownRemaining = Math.max(0, cooldownSec - elapsed);
      }

      const { data: budget } = await supabase.from('budgets').select('moneyEUR').eq('ownerType', 'REGION').eq('ownerId', regionId).maybeSingle();

      res.json({
        cooldownRemaining: Math.ceil(cooldownRemaining),
        cooldownTotal: cooldownSec,
        costEur,
        lastRechargeAt: rechargeData?.lastRechargeAt || null,
        treasuryEur: budget?.moneyEUR || 0,
        canAfford: (budget?.moneyEUR || 0) >= costEur,
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
      const { data: nationRegions } = await supabase
        .from('regions')
        .select('id, ownerUserId, economicAdviserId, nation_id, isCapital')
        .eq('nation_id', nationId);

      if (!nationRegions || nationRegions.length === 0) {
        return res.status(404).json({ error: "Nazione non trovata." });
      }

      const capitalRegion = nationRegions.find((r: any) => r.isCapital);
      if (!capitalRegion) {
        return res.status(400).json({ error: "Capitale nazionale non configurata." });
      }

      const isLeaderOfNation = capitalRegion.ownerUserId === user.id;
      const isEconomyMinisterOfNation = capitalRegion.economicAdviserId === user.id;

      if (!isLeaderOfNation && !isEconomyMinisterOfNation) {
        return res.status(403).json({ error: "Solo il Leader/Dittatore o il Ministro dell'Economia può attivare Deep Exploration." });
      }

      const nowStr = new Date().toISOString();
      const { data: existingDeep } = await supabase
        .from('deep_explorations')
        .select('id, resourceType, endsAt')
        .eq('nationId', nationId)
        .eq('isActive', true)
        .gte('endsAt', nowStr)
        .limit(1);

      if (existingDeep && existingDeep.length > 0) {
        return res.status(400).json({
          error: `Deep Exploration già attiva per ${existingDeep[0].resourceType}. Scade il ${new Date(existingDeep[0].endsAt).toLocaleString('it-IT')}.`,
        });
      }

      const preview = await computeDeepCost(nationId, resourceType, parseInt(level));
      const primaryRegionId = capitalRegion.id;

      const rollbackCosts = async (refundEur: boolean, refundDiamonds: boolean, reason: string) => {
        if (refundEur && preview.costEur > 0) {
          await supabase.rpc('add_budget_transaction', {
            p_owner_type: 'REGION',
            p_owner_id: primaryRegionId,
            p_type: 'INCOME',
            p_subtype: 'DEEP_EXPLORATION_REFUND',
            p_money_delta: preview.costEur,
            p_created_by: user.id,
            p_metadata: { reason },
          });
        }
        if (refundDiamonds && preview.costDiamonds > 0) {
          const { data: dInv } = await supabase.from('user_inventory')
            .select('quantity').eq('userId', user.id).eq('itemId', 'diamonds').maybeSingle();
          await supabase.from('user_inventory')
            .update({ quantity: (dInv?.quantity || 0) + preview.costDiamonds })
            .eq('userId', user.id).eq('itemId', 'diamonds');
        }
      };

      if (preview.costEur > 0) {
        try {
          await supabase.rpc('add_budget_transaction', {
            p_owner_type: 'REGION',
            p_owner_id: primaryRegionId,
            p_type: 'EXPENSE',
            p_subtype: 'DEEP_EXPLORATION',
            p_money_delta: -preview.costEur,
            p_created_by: user.id,
            p_metadata: {
              resourceType,
              level,
              targetCap: preview.targetCap,
              costDiamonds: preview.costDiamonds,
              costGold: preview.costGold,
            },
          });
        } catch (budgetErr: any) {
          return res.status(400).json({ error: "Fondi EUR insufficienti nel tesoro nazionale. Servono €" + preview.costEur.toLocaleString() });
        }
      }

      if (preview.costDiamonds > 0) {
        const { data: diamondInv } = await supabase.from('user_inventory')
          .select('quantity').eq('userId', user.id).eq('itemId', 'diamonds').maybeSingle();
        const currentDiamonds = diamondInv?.quantity || 0;

        if (currentDiamonds < preview.costDiamonds) {
          await rollbackCosts(true, false, 'diamond_insufficient');
          return res.status(400).json({ error: `Diamanti insufficienti. Servono ${preview.costDiamonds}, hai ${currentDiamonds}.` });
        }

        await supabase.from('user_inventory')
          .update({ quantity: currentDiamonds - preview.costDiamonds })
          .eq('userId', user.id).eq('itemId', 'diamonds');
      }

      if (preview.costGold > 0) {
        if (user.gold < preview.costGold) {
          await rollbackCosts(true, true, 'gold_insufficient');
          return res.status(400).json({ error: `Gold insufficiente. Servono ${preview.costGold}, hai ${user.gold}.` });
        }
        await supabase.from('users').update({ gold: user.gold - preview.costGold }).eq('id', user.id);
      }

      const durationDays = parseInt(await getSetting('deep_duration_days')) || 7;
      const startsAt = new Date();
      const endsAt = new Date(startsAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
      const deepId = 'deep_' + generateSecureId(9);

      await supabase.from('deep_explorations').insert({
        id: deepId,
        nationId,
        resourceType,
        level: parseInt(level),
        targetCap: preview.targetCap,
        activatedByUserId: user.id,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        isActive: true,
        costDiamonds: preview.costDiamonds,
        costEur: preview.costEur,
        costGold: preview.costGold,
      });

      res.json({
        success: true,
        deepId,
        targetCap: preview.targetCap,
        endsAt: endsAt.toISOString(),
        costs: {
          diamonds: preview.costDiamonds,
          eur: preview.costEur,
          gold: preview.costGold,
        },
        message: `Deep Exploration Livello ${level} attivata per ${resourceType}! Durata: ${durationDays} giorni.`,
      });
    } catch (err: any) {
      console.error("Error activating deep exploration:", err);
      logger.error('operation_failed', { error: err?.message, path: req?.path });
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
      const { data: factory } = await supabase.from('factories').select('*').eq('id', factoryId).single();
      if (!factory) return res.status(404).json({ error: "Fabbrica non trovata." });

      const factoryType = factory.type || '';
      const typeDef = FACTORY_CONFIG.TYPES[factoryType];
      if (!typeDef) return res.status(400).json({ error: "Tipo fabbrica non valido." });

      const resourceType = typeDef.resource;
      const regionId = factory.regionId;

      const { data: regionRel } = await supabase.from('regions').select('*').eq('id', regionId).single();
      if (!regionRel) return res.status(404).json({ error: "Regione non trovata." });

      const { data: regionRes } = await supabase
        .from('region_resources')
        .select('*')
        .eq('regionId', regionId)
        .eq('resourceType', resourceType)
        .maybeSingle();

      const nationId = await getNationForRegion(regionId);
      const capMaxGlobal = parseInt(await getSetting('cap_max_global')) || 2000;
      const deep = nationId ? await getActiveDeep(nationId, resourceType) : null;
      const baseCap = regionRes?.baseCapPerRecharge ?? REGION_RESOURCE_CAPS_BY_TYPE[resourceType] ?? 200;
      const effectiveCap = computeEffectiveCap(baseCap, deep, capMaxGlobal);
      const deepBonus = deep ? Math.max(0, (deep.targetCap || 0) - baseCap) : 0;
      const dailyAvailable = regionRes?.dailyAvailable ?? 999999;
      const dailyExtracted = regionRes?.dailyExtracted ?? 0;
      const remainingDaily = Math.max(0, dailyAvailable - dailyExtracted);

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
        regionResidualToday: remainingDaily,
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
        canWork: remainingDaily > 0 && user.energy >= actualEnergyCost,
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
        const remainingDaily = Math.max(0, r.dailyAvailable - r.dailyExtracted);
        return {
          resourceType: r.resourceType,
          baseCap: r.baseCapPerRecharge,
          deepBonus,
          effectiveCap,
          dailyAvailable: r.dailyAvailable,
          dailyExtracted: r.dailyExtracted,
          remainingDaily,
          deepActive: !!deep,
          deepEndsAt: deep?.endsAt || null,
        };
      }));

      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentLogs } = await supabase
        .from('extraction_detailed_logs')
        .select('resourceType, grossAmount, playerAmount, taxAmount, stateAmount, autonomyAmount, moneyGenerated, withdrawnPoints')
        .eq('regionId', regionId)
        .gte('createdAt', since24h);

      const analytics: Record<string, any> = {};
      for (const log of (recentLogs || [])) {
        const rt = log.resourceType;
        if (!analytics[rt]) {
          analytics[rt] = {
            totalExtracted: 0, totalPlayerAmount: 0, totalTaxAmount: 0,
            totalStateAmount: 0, totalAutonomyAmount: 0, totalMoneyGenerated: 0,
            totalWithdrawnPoints: 0, extractionCount: 0,
          };
        }
        analytics[rt].totalExtracted += Number(log.grossAmount || 0);
        analytics[rt].totalPlayerAmount += Number(log.playerAmount || 0);
        analytics[rt].totalTaxAmount += Number(log.taxAmount || 0);
        analytics[rt].totalStateAmount += Number(log.stateAmount || 0);
        analytics[rt].totalAutonomyAmount += Number(log.autonomyAmount || 0);
        analytics[rt].totalMoneyGenerated += Number(log.moneyGenerated || 0);
        analytics[rt].totalWithdrawnPoints += Number(log.withdrawnPoints || 0);
        analytics[rt].extractionCount += 1;
      }

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
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const regionId = req.query.regionId as string;

      let query = supabase
        .from('extraction_detailed_logs')
        .select('playerId, playerAmount, resourceType')
        .gte('createdAt', since24h);

      if (regionId) query = query.eq('regionId', regionId);

      const { data: logs } = await query;

      const playerTotals: Record<string, number> = {};
      for (const log of (logs || [])) {
        playerTotals[log.playerId] = (playerTotals[log.playerId] || 0) + Number(log.playerAmount || 0);
      }

      const sorted = Object.entries(playerTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20);

      const playerIds = sorted.map(([id]) => id);
      let usernameMap: Record<string, any> = {};
      if (playerIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, username, level')
          .in('id', playerIds);
        for (const u of (users || [])) usernameMap[u.id] = u;
      }

      const leaderboard = sorted.map(([id, total]) => ({
        playerId: id,
        username: usernameMap[id]?.username || 'Unknown',
        level: usernameMap[id]?.level || 1,
        totalExtracted: Math.round(total),
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
