/**
 * Factory Handlers
 *
 * Extracted from server.ts — no logic changes.
 * Covers: /api/factories, /api/factories/create, /api/factories/deposit,
 *   /api/factories/paymode, /api/factories/upgrade-cost, /api/factories/upgrade,
 *   /api/factories/all, /api/factories/:id, /api/factories/:id/withdraw
 */
export function createFactoriesHandlers(deps: {
  supabase: any;
  getUserPerks: (userId: string, boosterInfo?: Record<string, any>) => Promise<Record<string, number>>;
  generateSecureId: (len: number) => string;
  factoryCreateService: any;
  factoryUpgradeService: any;
  factoryEconomyService: any;
  mapServiceResultToHttp: (result: any) => { statusCode: number; body: any };
  FACTORY_CONFIG: any;
  GAME_CONFIG: any;
  EXTRACTION_CONFIG: any;
  factoryYieldMultiplier: (level: number) => number;
  factoryStorageLimit: (type: string, level: number) => number;
  estimateFactoryValue: (type: string, level: number, recentProfit?: number) => number;
  updateMissionProgress: (userId: string, missionType: string, payload: Record<string, number>) => Promise<void>;
}) {
  const {
    supabase,
    getUserPerks,
    factoryCreateService,
    factoryUpgradeService,
    factoryEconomyService,
    mapServiceResultToHttp,
    FACTORY_CONFIG,
    GAME_CONFIG,
    factoryYieldMultiplier,
    factoryStorageLimit,
    estimateFactoryValue,
    updateMissionProgress,
  } = deps;

  // GET /api/factories
  async function getFactories(req: any, res: any) {
    const regionId = (req.query.regionId as string) || req.user.regionId || 'IT';

    // Try exact match first, then also match sub-regions (e.g., "IT" matches "IT" and "IT-RM")
    let { data: factories, error } = await supabase.from('factories').select('*').eq('regionId', regionId);

    if (!error && (!factories || factories.length === 0) && regionId.length <= 3) {
      // No exact match found and regionId looks like a country code - try prefix match for sub-regions
      const { data: subFactories, error: subErr } = await supabase.from('factories').select('*').like('regionId', `${regionId}-%`);
      if (!subErr && subFactories && subFactories.length > 0) {
        factories = subFactories;
      }
    }

    if (error) {
      console.error("Error fetching factories:", error);
      return res.status(500).json({ error: "Errore nel caricamento delle fabbriche." });
    }

    const { data: cooldowns } = await supabase.from('user_factory_cooldowns').select('factoryId, lastUsed').eq('userId', req.user.id);

    // Batch fetch all owner usernames in a single query
    const ownerIds = [...new Set((factories || []).map((f: any) => f.ownerUserId).filter(Boolean))];
    const ownerMap = new Map<string, string>();
    if (ownerIds.length > 0) {
      const { data: owners } = await supabase.from('users').select('id, username').in('id', ownerIds);
      (owners || []).forEach((o: any) => ownerMap.set(o.id, o.username));
    }

    const cooldownMap = new Map((cooldowns || []).map((c: any) => [c.factoryId, c] as [string, any]));
    const factoriesWithCooldown = (factories || []).map((f: any) => {
      const cd = cooldownMap.get(f.id) as any;
      const lastUsed = cd ? new Date(cd.lastUsed).getTime() : 0;
      const remaining = cd ? Math.max(0, (f.cooldownSec * 1000) - (Date.now() - lastUsed)) : 0;
      const ownerName = ownerMap.get(f.ownerUserId) || 'Sconosciuto';
      return { ...f, ownerName, remainingCooldown: remaining };
    });

    res.json(factoriesWithCooldown);
  }

  // POST /api/factories/create
  async function createFactory(req: any, res: any) {
    const user = req.user;

    try {
      const result = await factoryCreateService.createFactory(user.id, req.body || {});

      const http = mapServiceResultToHttp(result);
      return res.status(http.statusCode).json(http.body);
    } catch (err: any) {
      res.status(500).json({ error: "Errore nella creazione: " + err.message });
    }
  }

  // POST /api/factories/deposit
  async function depositFactory(req: any, res: any) {
    const user = req.user;
    const { factoryId, amount } = req.body;

    const numAmount = Number(amount);
    if (!factoryId || !Number.isFinite(numAmount) || numAmount <= 0 || Math.floor(numAmount) !== numAmount) {
      return res.status(400).json({ error: "Parametri non validi." });
    }

    if (user.money < numAmount) return res.status(400).json({ error: "Fondi insufficienti." });

    try {
      const result = await factoryEconomyService.depositFactoryBudget(user.id, factoryId, numAmount);

      if (result.type === 'success') {
        return res.json({ success: true, newBudget: result.payload.newBudget });
      }

      const http = mapServiceResultToHttp(result);
      return res.status(http.statusCode).json(http.body);
    } catch (err: any) {
      res.status(500).json({ error: "Errore nel deposito: " + err.message });
    }
  }

  // POST /api/factories/paymode
  async function setPayMode(req: any, res: any) {
    const user = req.user;
    const { factoryId, payMode } = req.body;

    if (!factoryId || !['salary', 'resource'].includes(payMode)) {
      return res.status(400).json({ error: "Parametri non validi." });
    }

    const { data: factory } = await supabase.from('factories').select('*').eq('id', factoryId).single();
    if (!factory) return res.status(404).json({ error: "Fabbrica non trovata." });
    if (factory.ownerUserId !== user.id) return res.status(403).json({ error: "Non sei il proprietario." });

    try {
      await supabase.from('factories').update({ payMode }).eq('id', factoryId);
      res.json({ success: true, payMode });
    } catch (err: any) {
      res.status(500).json({ error: "Errore nel cambio modalità: " + err.message });
    }
  }

  // GET /api/factories/upgrade-cost
  async function getUpgradeCost(req: any, res: any) {
    const currentLevel = parseInt(req.query.currentLevel as string) || 1;
    const targetLevel = parseInt(req.query.targetLevel as string);

    if (!targetLevel || targetLevel <= currentLevel || targetLevel > 800) {
      return res.status(400).json({ error: "Livello target non valido." });
    }

    try {
      const { data: currentRow } = await supabase
        .from('factory_upgrade_costs')
        .select('aggregate_cost')
        .eq('level_to', currentLevel)
        .maybeSingle();

      const { data: targetRow } = await supabase
        .from('factory_upgrade_costs')
        .select('aggregate_cost')
        .eq('level_to', targetLevel)
        .maybeSingle();

      if (!targetRow) return res.status(400).json({ error: "Livello target non trovato nella tabella costi." });

      const currentAgg = currentRow?.aggregate_cost || 0;
      const goldCost = targetRow.aggregate_cost - currentAgg;

      res.json({ currentLevel, targetLevel, goldCost, currency: 'GOLD' });
    } catch (err: any) {
      res.status(500).json({ error: "Errore nel calcolo costo: " + err.message });
    }
  }

  // POST /api/factories/upgrade
  async function upgradeFactory(req: any, res: any) {
    const user = req.user;
    const { factoryId, targetLevel } = req.body;

    try {
      const result = await factoryUpgradeService.upgradeFactory(user.id, factoryId, targetLevel);

      const http = mapServiceResultToHttp(result);
      if (result.type === 'success') {
        res.status(http.statusCode).json(http.body);

        // ── Daily Missions: factory upgrade progress (non-blocking) ──
        try { await updateMissionProgress(user.id, 'FACTORY_UPGRADE', { upgrade_factory: 1 }); } catch { /* non-critical */ }
        return;
      }

      return res.status(http.statusCode).json(http.body);
    } catch (err: any) {
      res.status(500).json({ error: "Errore nell'upgrade: " + err.message });
    }
  }

  // GET /api/factories/all
  async function getAllFactories(req: any, res: any) {
    try {
      const { data: factories, error } = await supabase.from('factories')
        .select('*')
        .order('level', { ascending: false })
        .limit(100);

      if (error) throw error;

      const ownerIds = [...new Set((factories || []).map((f: any) => f.ownerUserId).filter(Boolean))];
      const ownerMap: Record<string, string> = {};
      if (ownerIds.length > 0) {
        const { data: owners } = await supabase.from('users').select('id, username').in('id', ownerIds);
        (owners || []).forEach((o: any) => { ownerMap[o.id] = o.username; });
      }

      const enriched = (factories || []).map((f: any) => {
        const typeDef = FACTORY_CONFIG.TYPES[f.type] || {};
        return {
          ...f,
          ownerName: ownerMap[f.ownerUserId] || 'Sconosciuto',
          typeDef,
          yieldMultiplier: Math.round(factoryYieldMultiplier(f.level || 1) * 100) / 100,
          storageCapacity: factoryStorageLimit(f.type, f.level || 1),
          estimatedValue: estimateFactoryValue(f.type, f.level || 1),
        };
      });

      res.json(enriched);
    } catch (error: any) {
      console.error("[/api/factories/all] Error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/factories/:id
  async function getFactoryById(req: any, res: any) {
    const { id } = req.params;
    try {
      const { data: factory, error } = await supabase.from('factories').select('*').eq('id', id).single();
      if (error || !factory) return res.status(404).json({ error: "Fabbrica non trovata." });

      // Get owner name
      const { data: owner } = await supabase.from('users').select('username').eq('id', factory.ownerUserId).single();

      // Get economy logs (last 7 days)
      const { data: econLogs } = await supabase.from('factory_economy_logs')
        .select('*')
        .eq('factoryId', id)
        .order('logDate', { ascending: false })
        .limit(7);

      // Get recent worker logs (last 20)
      const { data: workerLogs } = await supabase.from('factory_worker_logs')
        .select('*')
        .eq('factoryId', id)
        .order('workedAt', { ascending: false })
        .limit(20);

      // Get worker names
      const workerIds = [...new Set((workerLogs || []).map((w: any) => w.workerId))];
      const workerNameMap: Record<string, string> = {};
      if (workerIds.length > 0) {
        const { data: workers } = await supabase.from('users').select('id, username').in('id', workerIds);
        (workers || []).forEach((w: any) => { workerNameMap[w.id] = w.username; });
      }

      const typeDef = FACTORY_CONFIG.TYPES[factory.type] || {};
      const level = factory.level || 1;
      const yieldMult = factoryYieldMultiplier(level);
      const storageCap = factoryStorageLimit(factory.type, level);
      const storagePerLevel = FACTORY_CONFIG.STORAGE_PER_LEVEL[factory.type] || 0;

      // Calculate average daily profit for valuation
      const recentProfit = (econLogs || []).length > 0
        ? (econLogs || []).reduce((sum: number, l: any) => sum + (l.ownerProfit || 0), 0) / (econLogs || []).length
        : 0;
      const estimatedVal = estimateFactoryValue(factory.type, level, recentProfit);

      // Market listing status
      const { data: listing } = await supabase.from('factory_market_listings')
        .select('*')
        .eq('factoryId', id)
        .eq('status', 'active')
        .maybeSingle();

      res.json({
        ...factory,
        ownerName: owner?.username || 'Sconosciuto',
        typeDef,
        yieldMultiplier: Math.round(yieldMult * 100) / 100,
        storageCapacity: storageCap,
        storagePerLevel,
        storagePercent: storageCap > 0 ? Math.round(((factory.currentStorage || 0) / storageCap) * 100) : 0,
        estimatedValue: estimatedVal,
        economyLogs: (econLogs || []),
        recentWorkers: (workerLogs || []).map((w: any) => ({ ...w, workerName: workerNameMap[w.workerId] || 'Sconosciuto' })),
        activeListing: listing || null,
        nextLevelYield: Math.round(factoryYieldMultiplier(level + 1) * 100) / 100,
        nextLevelStorage: factoryStorageLimit(factory.type, level + 1),
      });
    } catch (err: any) {
      res.status(500).json({ error: "Errore nel caricamento dettaglio: " + err.message });
    }
  }

  // POST /api/factories/:id/withdraw
  async function withdrawFactory(req: any, res: any) {
    const { id: factoryId } = req.params;
    const user = req.user;

    try {
      const { data: factory, error: fError } = await supabase
        .from('factories')
        .select('*')
        .eq('id', factoryId)
        .single();

      if (fError || !factory) return res.status(404).json({ error: "Fabbrica non trovata." });
      if (factory.ownerUserId !== user.id) return res.status(403).json({ error: "Non sei il proprietario di questa fabbrica." });

      const amount = factory.currentStorage || 0;
      if (amount <= 0) return res.status(400).json({ error: "Il magazzino è vuoto." });

      // Check personal inventory capacity
      const { data: userInv } = await supabase.from('user_inventory').select('quantity').eq('userId', user.id);
      const currentVol = (userInv || []).reduce((sum: number, item: any) => sum + item.quantity, 0);
      const perks = await getUserPerks(user.id);
      const r = perks['RESISTENZA'] || 0;
      const maxStorage = Math.floor(GAME_CONFIG.STORAGE_BASE_CAPACITY * (1 + (r * 0.01)));

      if (currentVol + amount > maxStorage) {
        return res.status(400).json({ error: "Non hai abbastanza spazio nel tuo magazzino personale." });
      }

      // Move resources
      // 1. Update user inventory
      const { data: invItem } = await supabase.from('user_inventory')
        .select('quantity').eq('userId', user.id).eq('itemId', factory.type).maybeSingle();

      if (invItem) {
        await supabase.from('user_inventory').update({ quantity: invItem.quantity + amount })
          .eq('userId', user.id).eq('itemId', factory.type);
      } else {
        await supabase.from('user_inventory').insert({ userId: user.id, itemId: factory.type, quantity: amount });
      }

      // 2. Reset factory storage
      await supabase.from('factories').update({ currentStorage: 0 }).eq('id', factoryId);

      // 3. Log action
      await supabase.from('action_logs').insert({
        userId: user.id,
        action: 'FACTORY_WITHDRAW',
        details: JSON.stringify({ factoryId, amount, item: factory.type }),
        timestamp: Date.now()
      });

      res.json({ success: true, amount, item: factory.type });
    } catch (err: any) {
      console.error("Withdrawal error:", err);
      res.status(500).json({ error: "Errore durante il ritiro: " + err.message });
    }
  }

  return {
    getFactories,
    createFactory,
    depositFactory,
    setPayMode,
    getUpgradeCost,
    upgradeFactory,
    getAllFactories,
    getFactoryById,
    withdrawFactory,
  };
}
