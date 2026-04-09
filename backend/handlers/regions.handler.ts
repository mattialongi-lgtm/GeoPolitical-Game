/**
 * Regions Handlers
 *
 * Extracted from server.ts — no logic changes.
 * Covers: /api/regions, /api/regions/:id, /api/regions/:id/resources,
 *   /api/regions/:id/refill-extraction, /api/regions/:id/autonomy,
 *   /api/regions/:id/buildings, /api/regions/:id/energy,
 *   /api/regions/:id/economy, /api/regions/:id/indexes,
 *   /api/regions/:id/governor, /api/regions/:id/parliament,
 *   /api/regions/:id/laws, /api/nations/:nationId/energy
 */
import {
  REGIONAL_EXTRACTION_CAPS,
  type BuildingType,
} from '../../src/types';
import { logger } from '../utils/logger';
import { pickPreferredExtractionFactory } from '../utils/extraction-factory';

export function createRegionsHandlers(deps: {
  supabase: any;
  canManageRegion: any;
  canReadRegionScopedData: any;
  getNationForRegion: any;
  getActiveDeep: any;
  computeEffectiveCap: any;
  getSetting: any;
  getStateEnergyCompensation: any;
  AUTONOMY_CONFIG: any;
  BUILDING_LABELS: any;
  GAME_CONFIG: any;
  FACTORY_CONFIG: any;
}) {
  const {
    supabase, canManageRegion, canReadRegionScopedData,
    getNationForRegion, getActiveDeep, computeEffectiveCap, getSetting,
    getStateEnergyCompensation,
    AUTONOMY_CONFIG, BUILDING_LABELS, GAME_CONFIG, FACTORY_CONFIG,
  } = deps;

  const isAutomationExpired = (activatedAt?: string | null, expiresAt?: string | null, now = Date.now()) => {
    if (expiresAt) return new Date(expiresAt).getTime() <= now;
    if (!activatedAt) return false;
    return (now - new Date(activatedAt).getTime()) >= 24 * 60 * 60 * 1000;
  };

  // ── Region Calculation Helpers (from server.ts lines 8443-8690) ──

  const ALL_BUILDING_TYPES: BuildingType[] = [
    'hospital', 'military_base', 'school', 'military_academy',
    'missile_system', 'airport', 'naval_port', 'space_port',
    'real_estate_fund', 'power_plant'
  ];

  async function getRegionBuildings(regionId: string): Promise<Record<string, number>> {
    const { data } = await supabase
      .from('regional_buildings')
      .select('buildingType, quantity')
      .eq('regionId', regionId);
    const map: Record<string, number> = {};
    for (const bt of ALL_BUILDING_TYPES) map[bt] = 0;
    for (const row of data || []) map[row.buildingType] = row.quantity || 0;
    return map;
  }

  function calcRawScore(key: string, buildings: Record<string, number>): number {
    const weights = AUTONOMY_CONFIG.INDEX_WEIGHTS[key] || {};
    let total = 0;
    for (const [bt, w] of Object.entries(weights)) total += (buildings[bt] || 0) * (w as number);
    return Math.round(total * 100) / 100;
  }

  function calculateIndexLevel(rawScore: number, thresholds: number[]): number {
    let level = 1;
    for (let i = 0; i < thresholds.length; i++) {
      if (rawScore >= thresholds[i]) level = i + 1;
      else break;
    }
    return Math.min(Math.max(1, level), thresholds.length);
  }

  function calculateIndexProgress(
    rawScore: number,
    thresholds: number[],
    level: number
  ): { progressPercent: number; currentScore: number; nextThreshold: number | null } {
    if (level >= thresholds.length) {
      return { progressPercent: 100, currentScore: Math.round(rawScore), nextThreshold: null };
    }
    const prevThreshold = level > 0 ? thresholds[level - 1] : 0;
    const nextThreshold = thresholds[level];
    const progressInLevel = rawScore - prevThreshold;
    const levelRange = nextThreshold - prevThreshold;
    const progressPercent = Math.min(100, Math.max(0, (progressInLevel / levelRange) * 100));
    return { progressPercent: Math.round(progressPercent * 100) / 100, currentScore: Math.round(rawScore), nextThreshold };
  }

  function getRegionalClassification(developmentLevel: number): 'developed' | 'developing' | 'underdeveloped' {
    const thresholds = AUTONOMY_CONFIG.CLASSIFICATION_THRESHOLDS;
    if (developmentLevel >= thresholds.developed) return 'developed';
    if (developmentLevel >= thresholds.developing) return 'developing';
    return 'underdeveloped';
  }

  function calculateRegionalIndices(buildings: Record<string, number>) {
    const thresholds = AUTONOMY_CONFIG.INDEX_THRESHOLDS;
    const rawHealth      = calcRawScore('health',      buildings);
    const rawMilitary    = calcRawScore('military',    buildings);
    const rawEducation   = calcRawScore('education',   buildings);
    const rawDevelopment = calcRawScore('development', buildings);
    const healthIndex      = calculateIndexLevel(rawHealth,      thresholds.health);
    const militaryIndex    = calculateIndexLevel(rawMilitary,    thresholds.military);
    const educationIndex   = calculateIndexLevel(rawEducation,   thresholds.education);
    const developmentIndex = calculateIndexLevel(rawDevelopment, thresholds.development);
    const healthProg      = calculateIndexProgress(rawHealth,      thresholds.health,      healthIndex);
    const militaryProg    = calculateIndexProgress(rawMilitary,    thresholds.military,    militaryIndex);
    const educationProg   = calculateIndexProgress(rawEducation,   thresholds.education,   educationIndex);
    const developmentProg = calculateIndexProgress(rawDevelopment, thresholds.development, developmentIndex);
    const classification = getRegionalClassification(developmentIndex);
    return {
      healthIndex, militaryIndex, educationIndex, developmentIndex,
      healthProgress: healthProg.progressPercent,
      militaryProgress: militaryProg.progressPercent,
      educationProgress: educationProg.progressPercent,
      developmentProgress: developmentProg.progressPercent,
      regionalClassification: classification,
      raw: { health: rawHealth, military: rawMilitary, education: rawEducation, development: rawDevelopment },
      nextThresholds: {
        health: healthProg.nextThreshold, military: militaryProg.nextThreshold,
        education: educationProg.nextThreshold, development: developmentProg.nextThreshold,
      },
      primaryCounts: {
        health: buildings['hospital'] || 0, military: buildings['military_base'] || 0,
        education: buildings['school'] || 0, development: buildings['real_estate_fund'] || 0,
      },
      rawScores: {
        health: rawHealth, military: Math.round(rawMilitary * 10) / 10,
        education: rawEducation, development: rawDevelopment,
      },
    };
  }

  function calculateIndexEffects(indices: ReturnType<typeof calculateRegionalIndices>) {
    const fx = AUTONOMY_CONFIG.INDEX_EFFECTS;
    return {
      energyCostReduction: indices.healthIndex * fx.health.energyCostReductionPerLevel,
      warAttackBonus: indices.militaryIndex * fx.military.attackBonusPerLevel,
      warDefenseBonus: indices.militaryIndex * fx.military.defenseBonusPerLevel,
      xpBonus: indices.educationIndex * fx.education.xpBonusPerLevel,
      salaryMultiplier: 1 + indices.developmentIndex * fx.development.salaryMultiplierPerLevel,
      coupRiskReduction: indices.developmentIndex * fx.development.coupRiskReductionPerLevel,
      classification: indices.regionalClassification,
      isAtRisk: indices.developmentIndex <= 1,
    };
  }

  function calculateEnergyStatus(buildings: Record<string, number>) {
    const cons = AUTONOMY_CONFIG.ENERGY_CONSUMPTION;
    let consumption = 0;
    for (const [bt, qty] of Object.entries(buildings)) {
      consumption += (cons[bt] || 0) * qty;
    }
    const generation = (buildings['power_plant'] || 0) * AUTONOMY_CONFIG.ENERGY_PRODUCTION_PER_PLANT;
    const efficiency = generation - consumption;
    const isDeficit = efficiency < 0;
    const surplusPowerPlants = efficiency > 0
      ? Math.floor(efficiency / AUTONOMY_CONFIG.ENERGY_PRODUCTION_PER_PLANT)
      : -Math.ceil(Math.abs(efficiency) / AUTONOMY_CONFIG.ENERGY_PRODUCTION_PER_PLANT);
    const avgConsumptionPerBuilding = 2;
    const supportableBuildings = efficiency > 0 ? Math.floor(efficiency / avgConsumptionPerBuilding) : 0;
    const excessBuildings = efficiency < 0 ? Math.ceil(Math.abs(efficiency) / avgConsumptionPerBuilding) : 0;
    return { generation, consumption, efficiency, surplusPowerPlants, supportableBuildings, excessBuildings, isDeficit };
  }

  function calculateMilitaryStats(buildings: Record<string, number>) {
    const coefAtk = AUTONOMY_CONFIG.ATTACK_BASE_COEFFICIENT;
    const coefDef = AUTONOMY_CONFIG.DEFENSE_STRUCTURAL_COEFFICIENT;
    const academies = buildings['military_academy'] || 0;
    const bases = buildings['military_base'] || 0;
    const hospitals = buildings['hospital'] || 0;
    const schools = buildings['school'] || 0;
    const missileSystems = buildings['missile_system'] || 0;
    const airports = buildings['airport'] || 0;
    const navalPorts = buildings['naval_port'] || 0;
    const spacePorts = buildings['space_port'] || 0;
    const powerPlants = buildings['power_plant'] || 0;
    const initialAttackDamage = academies * coefAtk;
    const R1 = academies * coefAtk;
    const R2 = bases * 2;
    const R3 = hospitals + schools + missileSystems + airports + navalPorts + spacePorts + powerPlants;
    const initialDefensePoints = R1 + ((R2 + R3) * coefDef);
    return {
      initialAttackDamage, initialDefensePoints,
      academies, bases, hospitals, schools, missileSystems, airports, navalPorts, spacePorts, powerPlants,
    };
  }

  // ── Handlers ──

  // Cache in-memory per /api/regions — i dati cambiano raramente
  let regionsCache: { data: any[]; fetchedAt: number } | null = null;
  const REGIONS_CACHE_TTL = 60_000; // 60 secondi

  async function getRegions(_req: any, res: any) {
    try {
      if (regionsCache && Date.now() - regionsCache.fetchedAt < REGIONS_CACHE_TTL) {
        return res.json(regionsCache.data);
      }

      const { data: regions, error } = await supabase
        .from('regions')
        .select(`*, owner:users!ownerUserId(username, avatarData), leader:users!leaderUserId(username, level, avatarData)`);
      if (error) throw error;

      // Conta player per regione con una sola query aggregata (solo regionId, no full scan)
      const { data: userStats, error: userError } = await supabase
        .from('users')
        .select('regionId')
        .not('regionId', 'is', null);
      const playerRegionCounts: Record<string, number> = {};
      if (!userError && userStats) {
        userStats.forEach((u: any) => {
          const rid = u.regionId;
          if (rid) playerRegionCounts[rid] = (playerRegionCounts[rid] || 0) + 1;
        });
      }
      const formatted = (regions || []).map((r: any) => ({
        ...r,
        ownerName: r.owner?.username,
        ownerAvatarData: r.owner?.avatarData || null,
        leaderName: r.leader?.username,
        leaderLevel: r.leader?.level,
        playerCount: playerRegionCounts[r.id] || 0
      }));

      regionsCache = { data: formatted, fetchedAt: Date.now() };
      res.json(formatted);
    } catch (err: any) {
      console.error("Error fetching regions:", err);
      logger.error('operation_failed', { error: err?.message });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  async function getRegionById(req: any, res: any) {
    try {
      const regionId = (req.params.id || '').toUpperCase().replace('NATION_', '');
      const { data: region, error } = await supabase
        .from('regions')
        .select(`*, owner:users!ownerUserId(username, avatarData), leader:users!leaderUserId(username, level, avatarData), governor:users!governorPlayerId(username), economicAdviser:users!economicAdviserId(username, avatarData), foreignMinister:users!foreignMinisterId(username, avatarData), nation:nations(*), factories:factories(count)`)
        .eq('id', regionId)
        .single();
      if (error || !region) return res.status(404).json({ error: "Regione non trovata" });
      const { data: memberRegions } = await supabase.from('regions').select('id, name, population, isCapital, isAutonomous').eq('nation_id', region.nation_id);
      const regionIds = (memberRegions || []).map((mr: any) => mr.id);
      const { data: memberUserStats } = await supabase.from('users').select('regionId').in('regionId', regionIds);
      const memberPlayerCounts: Record<string, number> = {};
      (memberUserStats || []).forEach((u: any) => {
        memberPlayerCounts[u.regionId] = (memberPlayerCounts[u.regionId] || 0) + 1;
      });
      res.json({
        ...region,
        ownerName: region.owner?.username,
        ownerAvatarData: region.owner?.avatarData || null,
        leaderName: region.leader?.username,
        leaderLevel: region.leader?.level,
        leaderAvatarData: region.leader?.avatarData || null,
        governorName: region.governor?.username || null,
        economicAdviserName: region.economicAdviser?.username || null,
        economicAdviserAvatarData: region.economicAdviser?.avatarData || null,
        foreignMinisterName: region.foreignMinister?.username || null,
        foreignMinisterAvatarData: region.foreignMinister?.avatarData || null,
        citizenCount: memberPlayerCounts[regionId] || 0,
        memberRegions: (memberRegions || []).map((mr: any) => ({
          ...mr,
          playerCount: memberPlayerCounts[mr.id] || 0
        }))
      });
    } catch (err: any) {
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  async function getRegionResources(req: any, res: any) {
    const regionId = req.params.id;
    try {
      const [{ data: resources, error }, { data: factories, error: factoriesError }] = await Promise.all([
        supabase.from('region_resources').select('*').eq('regionId', regionId),
        supabase.from('factories').select('id, name, type, level, regionId, isActive, payMode').eq('regionId', regionId).eq('isActive', true).eq('payMode', 'resource'),
      ]);
      if (error) throw error;
      if (factoriesError) throw factoriesError;
      if (!resources || resources.length === 0) {
        return res.json({ resources: [], deepActive: null });
      }

      let preferredFactoryId: string | null = null;
      try {
        const { data: activeAutoWork, error: activeAutoWorkError } = await supabase
          .from('work_auto_actions')
          .select('factoryId, activatedAt, expiresAt')
          .eq('userId', req.user.id)
          .eq('isActive', true)
          .maybeSingle();

        if (!activeAutoWorkError && activeAutoWork && !isAutomationExpired(activeAutoWork.activatedAt, activeAutoWork.expiresAt)) {
          preferredFactoryId = activeAutoWork.factoryId || null;
        }
      } catch {
        preferredFactoryId = null;
      }

      const nationId = await getNationForRegion(regionId);
      const capMaxGlobal = parseInt(await getSetting('cap_max_global')) || 2000;
      const enriched = await Promise.all(resources.map(async (r: any) => {
        const deep = nationId ? await getActiveDeep(nationId, r.resourceType) : null;
        const effectiveCap = computeEffectiveCap(r.baseCapPerRecharge, deep, capMaxGlobal);
        const dailyMaxCap = r.dailyMaxCap ?? r.dailyAvailable ?? 5000;
        const currentAvailableCap = r.currentAvailableCap ?? 0;
        const totalUnlockedToday = r.totalUnlockedToday ?? 0;
        const backingFactory = pickPreferredExtractionFactory(
          factories,
          FACTORY_CONFIG,
          r.resourceType,
          preferredFactoryId,
        );
        return {
          ...r,
          dailyMaxCap,
          currentAvailableCap,
          totalUnlockedToday,
          canUnlockMore: Math.max(0, dailyMaxCap - totalUnlockedToday),
          effectiveCapPerRecharge: effectiveCap,
          deepActive: !!deep,
          deepTargetCap: deep?.targetCap || null,
          deepEndsAt: deep?.endsAt || null,
          remainingDaily: currentAvailableCap, // backward compat: remainingDaily = currentAvailableCap
          backingFactoryId: backingFactory?.id || null,
          backingFactoryName: backingFactory?.name || null,
          backingFactoryLevel: Number(backingFactory?.level || 0),
          workEnabled: !!backingFactory,
          workDisabledReason: backingFactory ? null : "Nessuna fabbrica attiva in Modalita Risorse collegata a questa risorsa in questa regione.",
        };
      }));
      res.json({ resources: enriched });
    } catch (err: any) {
      console.error("Error fetching region resources:", err);
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  async function refillExtraction(req: any, res: any) {
    return res.status(403).json({
      error: "Il limite di estrazione non puo essere ripristinato manualmente. Si resetta solo ogni giorno alle 19:00 ora di Londra.",
    });

    try {
      const regionId = (req.params.id || '').toUpperCase();
      const { resourceType } = req.body;
      const userId = req.user.id;
      if (!['gold', 'oil', 'minerals', 'uranium', 'diamonds'].includes(resourceType)) {
        return res.status(400).json({ error: "Tipo risorsa non valido" });
      }
      const { data: user, error: userErr } = await supabase.from('users').select('gold').eq('id', userId).single();
      if (userErr || !user) return res.status(404).json({ error: "Utente non trovato" });
      const REFILL_COST = 100;
      if (user.gold < REFILL_COST) {
        return res.status(400).json({ error: `Oro insufficiente (richiesti ${REFILL_COST} Gold)` });
      }
      const { error: deductErr } = await supabase.from('users').update({ gold: user.gold - REFILL_COST }).eq('id', userId);
      if (deductErr) throw deductErr;
      const columnMap: Record<string, string> = {
        gold: 'dailyExtractedGold', oil: 'dailyExtractedOil', minerals: 'dailyExtractedMinerals',
        uranium: 'dailyExtractedUranium', diamonds: 'dailyExtractedDiamonds'
      };
      const column = columnMap[resourceType];
      const { error: resetErr } = await supabase.from('regions').update({ [column]: 0 }).eq('id', regionId);
      if (resetErr) throw resetErr;
      res.json({ success: true, message: `Limite ${resourceType} ripristinato! (-${REFILL_COST} Gold)` });
    } catch (err: any) {
      console.error("[RefillExtraction] Error:", err);
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  async function getRegionAutonomy(req: any, res: any) {
    try {
      const regionId = (req.params.id || '').toUpperCase();
      const { data: region, error } = await supabase
        .from('regions')
        .select('*, governor:users!governorPlayerId(username)')
        .eq('id', regionId)
        .single();
      if (error || !region) return res.status(404).json({ error: "Regione non trovata" });
      const buildings = await getRegionBuildings(regionId);
      const indices = calculateRegionalIndices(buildings);
      const energy = calculateEnergyStatus(buildings);
      const militaryStats = calculateMilitaryStats(buildings);
      const stateCompensation = energy.isDeficit ? await getStateEnergyCompensation(regionId, region.nation_id) : 0;
      const netEfficiency = energy.efficiency + Math.min(stateCompensation, Math.abs(energy.efficiency));
      const { data: transactions } = await supabase.from('regional_budget_transactions').select('*').eq('regionId', regionId).order('createdAt', { ascending: false }).limit(50);
      const { data: history } = await supabase.from('autonomy_history').select('*').eq('regionId', regionId).order('createdAt', { ascending: false }).limit(20);
      const governorName = region.governor?.username || null;
      const pollutionMalus = (region.pollution || 0) * AUTONOMY_CONFIG.POLLUTION_MALUS_PER_POINT;
      const effectiveHealthIndex = Math.max(1, indices.healthIndex * (1 - pollutionMalus / 100));
      const energyDeficitMalus = netEfficiency < 0 ? AUTONOMY_CONFIG.ENERGY_DEFICIT_MALUS * Math.abs(netEfficiency) : 0;
      res.json({
        region: {
          id: region.id, name: region.name, isCapital: region.isCapital || false,
          isAutonomous: region.isAutonomous || false, isBorderRegion: region.isBorderRegion || false,
          governorPlayerId: region.governorPlayerId, governorName,
          regionalParliamentEnabled: region.regionalParliamentEnabled || false,
          regionalBudget: region.regionalBudget || 0,
          nationalProfitSharePercent: region.nationalProfitSharePercent ?? 100,
          regionalProfitSharePercent: region.regionalProfitSharePercent ?? 0,
          workerTaxPercent: region.workerTaxPercent ?? 10,
          marketTaxRate: region.marketTaxRate ?? 10,
          industryTaxPercent: region.industryTaxPercent ?? 10,
          pollution: region.pollution || 0,
          autonomyGrantedAt: region.autonomyGrantedAt,
          autonomyRevokedAt: region.autonomyRevokedAt,
        },
        buildings,
        indices: { ...indices, effectiveHealthIndex },
        effects: calculateIndexEffects(indices),
        energy: { ...energy, stateCompensation, netEfficiency },
        militaryStats,
        pollutionMalus,
        energyDeficitMalus,
        extraction: {
          gold: { limit: region.dailyExtractionLimitGold ?? REGIONAL_EXTRACTION_CAPS.gold, extracted: region.dailyExtractedGold ?? 0, remaining: Math.max(0, (region.dailyExtractionLimitGold ?? REGIONAL_EXTRACTION_CAPS.gold) - (region.dailyExtractedGold ?? 0)) },
          oil: { limit: region.dailyExtractionLimitOil ?? REGIONAL_EXTRACTION_CAPS.oil, extracted: region.dailyExtractedOil ?? 0, remaining: Math.max(0, (region.dailyExtractionLimitOil ?? REGIONAL_EXTRACTION_CAPS.oil) - (region.dailyExtractedOil ?? 0)) },
          minerals: { limit: region.dailyExtractionLimitMinerals ?? REGIONAL_EXTRACTION_CAPS.minerals, extracted: region.dailyExtractedMinerals ?? 0, remaining: Math.max(0, (region.dailyExtractionLimitMinerals ?? REGIONAL_EXTRACTION_CAPS.minerals) - (region.dailyExtractedMinerals ?? 0)) },
          uranium: { limit: region.dailyExtractionLimitUranium ?? REGIONAL_EXTRACTION_CAPS.uranium, extracted: region.dailyExtractedUranium ?? 0, remaining: Math.max(0, (region.dailyExtractionLimitUranium ?? REGIONAL_EXTRACTION_CAPS.uranium) - (region.dailyExtractedUranium ?? 0)) },
          diamonds: { limit: region.dailyExtractionLimitDiamonds ?? REGIONAL_EXTRACTION_CAPS.diamonds, extracted: region.dailyExtractedDiamonds ?? 0, remaining: Math.max(0, (region.dailyExtractionLimitDiamonds ?? REGIONAL_EXTRACTION_CAPS.diamonds) - (region.dailyExtractedDiamonds ?? 0)) },
          nextResetAt: region.nextExtractionResetAt,
        },
        transactions: transactions || [],
        history: history || [],
      });
    } catch (err: any) {
      console.error("Error fetching region autonomy:", err);
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  async function getRegionBuildingsHandler(req: any, res: any) {
    try {
      const regionId = (req.params.id || '').toUpperCase();
      const buildings = await getRegionBuildings(regionId);
      const buildingDetails = ALL_BUILDING_TYPES.map(bt => ({
        type: bt,
        label: BUILDING_LABELS[bt] || bt,
        quantity: buildings[bt] || 0,
        cost: AUTONOMY_CONFIG.BUILDING_COSTS[bt] || 0,
        energyConsumption: AUTONOMY_CONFIG.ENERGY_CONSUMPTION[bt] || 0,
      }));
      res.json({ buildings: buildingDetails });
    } catch (err: any) {
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  async function getRegionEnergy(req: any, res: any) {
    try {
      const regionId = (req.params.id || '').toUpperCase();
      const { data: region } = await supabase.from('regions').select('nation_id, energyGeneration, energyConsumption, energyEfficiency').eq('id', regionId).single();
      if (!region) return res.status(404).json({ error: "Regione non trovata" });
      const buildings = await getRegionBuildings(regionId);
      const energy = calculateEnergyStatus(buildings);
      const stateCompensation = energy.isDeficit ? await getStateEnergyCompensation(regionId, region.nation_id) : 0;
      const netEfficiency = energy.efficiency + Math.min(stateCompensation, Math.abs(energy.efficiency));
      const breakdown = ALL_BUILDING_TYPES.map(bt => ({
        type: bt,
        label: BUILDING_LABELS[bt] || bt,
        quantity: buildings[bt] || 0,
        consumption: (AUTONOMY_CONFIG.ENERGY_CONSUMPTION[bt] || 0) * (buildings[bt] || 0),
        production: bt === 'power_plant' ? (buildings[bt] || 0) * AUTONOMY_CONFIG.ENERGY_PRODUCTION_PER_PLANT : 0,
      }));
      res.json({
        ...energy, stateCompensation, netEfficiency, breakdown,
        config: {
          productionPerPlant: AUTONOMY_CONFIG.ENERGY_PRODUCTION_PER_PLANT,
          buildingsPerPlant: AUTONOMY_CONFIG.BUILDINGS_PER_PLANT,
        },
      });
    } catch (err: any) {
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  async function getRegionEconomy(req: any, res: any) {
    try {
      const regionId = (req.params.id || '').toUpperCase();
      const { data: region } = await supabase.from('regions').select('*').eq('id', regionId).single();
      if (!region) return res.status(404).json({ error: "Regione non trovata" });
      const { data: transactions } = await supabase.from('regional_budget_transactions').select('*').eq('regionId', regionId).order('createdAt', { ascending: false }).limit(100);
      let totalIncome = 0, totalExpense = 0;
      for (const tx of transactions || []) {
        if ((tx.moneyDelta || 0) > 0) totalIncome += tx.moneyDelta;
        else totalExpense += Math.abs(tx.moneyDelta || 0);
      }
      res.json({
        regionalBudget: region.regionalBudget || 0,
        workerTaxPercent: region.workerTaxPercent ?? 10,
        marketTaxRate: region.marketTaxRate ?? 10,
        industryTaxPercent: region.industryTaxPercent ?? 10,
        nationalProfitSharePercent: region.nationalProfitSharePercent ?? 100,
        regionalProfitSharePercent: region.regionalProfitSharePercent ?? 0,
        isAutonomous: region.isAutonomous || false,
        totalIncome, totalExpense, netBalance: totalIncome - totalExpense,
        transactions: transactions || [],
      });
    } catch (err: any) {
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  async function getRegionIndexes(req: any, res: any) {
    try {
      const regionId = (req.params.id || '').toUpperCase();
      const { data: region, error } = await supabase
        .from('regions')
        .select('id, name, pollution, pollutionModifier, warModifier, crisisModifier')
        .eq('id', regionId)
        .single();
      if (error || !region) return res.status(404).json({ error: "Regione non trovata" });
      const buildings = await getRegionBuildings(regionId);
      const indices = calculateRegionalIndices(buildings);
      const effects = calculateIndexEffects(indices);
      const pollutionMalus = (region.pollution || 0) * AUTONOMY_CONFIG.POLLUTION_MALUS_PER_POINT;
      const externalModifiers = {
        pollution: region.pollution || 0, pollutionMalus,
        pollutionModifier: region.pollutionModifier || 0,
        warModifier: region.warModifier || 0,
        crisisModifier: region.crisisModifier || 0,
      };
      const effectiveHealthIndex = Math.max(1, indices.healthIndex * (1 - pollutionMalus / 100));
      const indexMeta = [
        {
          key: 'health', label: 'Salute', icon: '❤️', color: '#ef4444',
          source: 'Ospedali', buildingType: 'hospital',
          effect: 'Riduce il costo energetico delle azioni (+1% riduzione per livello)',
          level: indices.healthIndex, effectiveLevel: effectiveHealthIndex,
          progress: indices.healthProgress, currentScore: indices.primaryCounts.health,
          nextThreshold: indices.nextThresholds.health, thresholds: AUTONOMY_CONFIG.INDEX_THRESHOLDS.health,
        },
        {
          key: 'military', label: 'Militare', icon: '🛡️', color: '#f97316',
          source: 'Basi Militari (+ Accademie, Missili, Aeroporti, Porti)',
          buildingType: 'military_base',
          effect: 'Aumenta il danno in guerra e la resistenza in difesa (+3% attacco, +2% difesa per livello)',
          level: indices.militaryIndex, progress: indices.militaryProgress,
          currentScore: indices.primaryCounts.military, weightedScore: indices.rawScores.military,
          nextThreshold: indices.nextThresholds.military, thresholds: AUTONOMY_CONFIG.INDEX_THRESHOLDS.military,
        },
        {
          key: 'education', label: 'Istruzione', icon: '📚', color: '#6366f1',
          source: 'Scuole', buildingType: 'school',
          effect: "Aumenta l'XP guadagnata da ogni azione (+2% per livello)",
          level: indices.educationIndex, progress: indices.educationProgress,
          currentScore: indices.primaryCounts.education,
          nextThreshold: indices.nextThresholds.education, thresholds: AUTONOMY_CONFIG.INDEX_THRESHOLDS.education,
        },
        {
          key: 'development', label: 'Sviluppo', icon: '🏘️', color: '#10b981',
          source: 'Fondi Immobiliari', buildingType: 'real_estate_fund',
          effect: 'Stabilità politica, riduce rischio di crisi. Aumenta gli stipendi istituzionali (+5% per livello)',
          level: indices.developmentIndex, progress: indices.developmentProgress,
          currentScore: indices.primaryCounts.development,
          nextThreshold: indices.nextThresholds.development, thresholds: AUTONOMY_CONFIG.INDEX_THRESHOLDS.development,
        },
      ];
      res.json({
        regionId: region.id, regionName: region.name,
        indices, effects, indexMeta, externalModifiers,
        classification: {
          value: indices.regionalClassification,
          label: indices.regionalClassification === 'developed' ? '🟢 Regione Sviluppata'
            : indices.regionalClassification === 'developing' ? '🟡 Regione in Via di Sviluppo' : '🔴 Regione Arretrata',
          isAtRisk: effects.isAtRisk,
        },
        thresholds: AUTONOMY_CONFIG.INDEX_THRESHOLDS,
      });
    } catch (err: any) {
      console.error("Error fetching region indexes:", err);
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  async function assignGovernor(req: any, res: any) {
    try {
      const regionId = (req.params.id || '').toUpperCase();
      const { governorUserId } = req.body;
      if (!governorUserId) return res.status(400).json({ error: "ID governatore obbligatorio." });
      const { data: region } = await supabase.from('regions').select('*').eq('id', regionId).single();
      if (!region) return res.status(404).json({ error: "Regione non trovata" });
      if (!region.isAutonomous) return res.status(400).json({ error: "La regione non è autonoma." });
      const { data: parentRegion } = await supabase.from('regions').select('leaderUserId, governmentForm').eq('nation_id', region.nation_id).eq('isCapital', true).single();
      const isLeader = parentRegion?.leaderUserId === req.user.id;
      const isDictator = isLeader && ['DICTATORSHIP', 'ONE_PARTY_SYSTEM', 'EXECUTIVE_MONARCHY'].includes(parentRegion?.governmentForm);
      if (!isDictator) return res.status(403).json({ error: "Solo il leader di un regime autocratico può assegnare direttamente un governatore." });
      const { data: user } = await supabase.from('users').select('id, username').eq('id', governorUserId).single();
      if (!user) return res.status(404).json({ error: "Utente non trovato." });
      await supabase.from('regions').update({ governorPlayerId: governorUserId }).eq('id', regionId);
      res.json({ success: true, governorName: user.username });
    } catch (err: any) {
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  async function removeGovernor(req: any, res: any) {
    try {
      const regionId = (req.params.id || '').toUpperCase();
      const { data: region } = await supabase.from('regions').select('*, parentNation:regions!nation_id(leaderUserId, governmentForm)').eq('id', regionId).single();
      if (!region) return res.status(404).json({ error: "Regione non trovata" });
      if (!region.isAutonomous) return res.status(400).json({ error: "La regione non è autonoma." });
      const { data: capitalRegion } = await supabase.from('regions').select('leaderUserId').eq('nation_id', region.nation_id).eq('isCapital', true).single();
      if (capitalRegion?.leaderUserId !== req.user.id) {
        return res.status(403).json({ error: "Solo il leader nazionale può rimuovere un governatore." });
      }
      await supabase.from('regions').update({ governorPlayerId: null }).eq('id', regionId);
      res.json({ success: true });
    } catch (err: any) {
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  async function getRegionParliament(req: any, res: any) {
    try {
      const regionId = (req.params.id || '').toUpperCase();
      const { data: region } = await supabase.from('regions').select('regionalParliamentEnabled, isAutonomous').eq('id', regionId).single();
      if (!region) return res.status(404).json({ error: "Regione non trovata" });
      if (!region.isAutonomous || !region.regionalParliamentEnabled) {
        return res.json({ enabled: false, members: [] });
      }
      const { data: members } = await supabase.from('regional_parliament_members').select('*, user:users!userId(username, level)').eq('regionId', regionId);
      res.json({
        enabled: true,
        members: (members || []).map((m: any) => ({
          userId: m.userId, username: m.user?.username || 'Sconosciuto',
          level: m.user?.level || 1, electedAt: m.electedAt, termEndsAt: m.termEndsAt,
        })),
      });
    } catch (err: any) {
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  async function getRegionLaws(req: any, res: any) {
    try {
      const regionId = (req.params.id || '').toUpperCase();
      const { data: laws } = await supabase.from('regional_laws').select('*, proposer:users!proposerId(username)').eq('regionId', regionId).order('createdAt', { ascending: false }).limit(50);
      const lawsWithVotes = await Promise.all((laws || []).map(async (l: any) => {
        const { data: votes } = await supabase.from('regional_law_votes').select('vote, voterId').eq('lawId', l.id);
        const yesVotes = (votes || []).filter((v: any) => v.vote === 'yes').length;
        const noVotes = (votes || []).filter((v: any) => v.vote === 'no').length;
        const myVote = (votes || []).find((v: any) => v.voterId === req.user.id)?.vote || null;
        return { ...l, proposerName: l.proposer?.username || 'Sconosciuto', yesVotes, noVotes, myVote };
      }));
      res.json({ laws: lawsWithVotes });
    } catch (err: any) {
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  async function getNationEnergy(req: any, res: any) {
    try {
      const nationId = (req.params.nationId || '').toUpperCase();
      const { data: regions } = await supabase
        .from('regions')
        .select('id, name, isCapital, isAutonomous, energyGeneration, energyConsumption, energyEfficiency')
        .eq('nation_id', nationId);
      if (!regions || regions.length === 0) return res.status(404).json({ error: "Nazione non trovata" });
      let totalGeneration = 0, totalConsumption = 0;
      const regionDetails = regions.map((r: any) => {
        const gen = r.energyGeneration || 0;
        const cons = r.energyConsumption || 0;
        totalGeneration += gen;
        totalConsumption += cons;
        return { id: r.id, name: r.name, isCapital: r.isCapital, isAutonomous: r.isAutonomous, generation: gen, consumption: cons, efficiency: gen - cons };
      });
      res.json({ totalGeneration, totalConsumption, totalEfficiency: totalGeneration - totalConsumption, regions: regionDetails });
    } catch (err: any) {
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  return {
    getRegions, getRegionById, getRegionResources, refillExtraction,
    getRegionAutonomy, getRegionBuildings: getRegionBuildingsHandler,
    getRegionEnergy, getRegionEconomy, getRegionIndexes,
    assignGovernor, removeGovernor, getRegionParliament, getRegionLaws,
    getNationEnergy,
  };
}
