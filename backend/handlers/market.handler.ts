/**
 * Market, Inventory & Produce Handlers
 *
 * Extracted from server.ts — no logic changes.
 * Covers: /api/market/listings, /api/market/state-inventory,
 *   /api/market/offers, /api/market/offer, /api/market/buy,
 *   /api/inventory/history/:itemId, /api/market/energy-drinks/buy,
 *   /api/produce, /api/produce/list, /api/produce/claim
 */
export function createMarketHandlers(deps: {
  supabase: any;
  generateSecureId: (len: number) => string;
  getUserPerks: (userId: string, boosterInfo?: Record<string, any>) => Promise<Record<string, number>>;
  addBudgetTransaction: (
    ownerType: string,
    ownerId: string,
    type: string,
    subtype: string,
    moneyDelta: number,
    resourcesDelta?: Record<string, number>,
    createdByUserId?: string | null,
    metadata?: any
  ) => Promise<any>;
  checkCooldown: (userId: string, actionType: string, cooldownTime: number) => Promise<boolean>;
  updateCooldown: (userId: string, actionType: string) => Promise<void>;
  buyEnergyDrinksForUser: (userId: string, quantity?: number) => Promise<any>;
  updateMissionProgress: (userId: string, missionType: string, payload: Record<string, number>) => Promise<void>;
  addXP: (userId: string, amount: number) => Promise<void>;
  productionService: any;
  mapServiceResultToHttp: (result: any) => { statusCode: number; body: any };
  GAME_CONFIG: any;
}) {
  const {
    supabase,
    generateSecureId,
    getUserPerks,
    buyEnergyDrinksForUser,
    productionService,
    mapServiceResultToHttp,
    GAME_CONFIG,
  } = deps;

  // Sanctions Helper
  const canSellInState = async (targetStateId: string, originStateId: string): Promise<boolean> => {
    const { data } = await supabase
      .from('sanctions')
      .select('id')
      .eq('fromStateId', targetStateId)
      .eq('targetStateId', originStateId)
      .eq('status', 'ACTIVE')
      .limit(1);
    return !data || data.length === 0;
  };

  // GET /api/market/listings
  async function getListings(req: any, res: any) {
    const { data: listings, error } = await supabase
      .from('market_offers')
      .select('*')
      .order('createdAt', { ascending: false })
      .limit(50);

    if (error) return res.status(500).json({ error: error.message });
    res.json(listings || []);
  }

  // POST /api/market/listings
  async function createListing(req: any, res: any) {
    const { itemName, quantity, price } = req.body;
    const user = req.user;

    if (!itemName || !quantity || !price || quantity <= 0 || price <= 0) {
      return res.status(400).json({ error: "Dati non validi." });
    }

    try {
      const offerId = generateSecureId(9);
      await supabase.from('market_offers').insert({
        id: offerId,
        sellerId: user.id,
        sellerName: user.username,
        itemId: itemName,
        quantity,
        price,
        regionId: user.regionId,
        originStateId: user.originalNation || user.regionId,
        createdAt: new Date().toISOString()
      });

      res.json({ success: true, offerId });
    } catch (err) {
      res.status(500).json({ error: "Errore durante la creazione dell'offerta." });
    }
  }

  // GET /api/market/state-inventory
  async function getStateInventory(req: any, res: any) {
    const user = req.user;
    try {
      // 1. Find if user is leader of a nation (STATE Level)
      const { data: nation } = await supabase
        .from('nations')
        .select('id')
        .eq('leaderUserId', user.id)
        .maybeSingle();

      // 2. Find if user owns any regions (REGION Level)
      const { data: region } = await supabase
        .from('regions')
        .select('id')
        .eq('ownerUserId', user.id)
        .maybeSingle();

      if (!nation && !region) return res.json([]);

      let budget = null;

      // 1. Try to fetch National budget first (if user is leader)
      if (nation) {
        const { data } = await supabase
          .from('budgets')
          .select('moneyEUR, resources')
          .eq('ownerType', 'STATE')
          .eq('ownerId', nation.id)
          .maybeSingle();
        if (data) budget = data;
      }

      // 2. Fallback to fetch Region budget (if user is owner)
      if (!budget && region) {
        const { data } = await supabase
          .from('budgets')
          .select('moneyEUR, resources')
          .eq('ownerType', 'REGION')
          .eq('ownerId', region.id)
          .maybeSingle();
        if (data) budget = data;
      }

      if (!budget) return res.json([]);

      const resources = typeof budget.resources === 'string' ? JSON.parse(budget.resources) : (budget.resources || {});
      const resourcesArray = Object.entries(resources)
        .filter(([_, qty]) => (qty as number) > 0)
        .map(([itemId, quantity]) => ({ itemId, quantity }));

      res.json(resourcesArray);
    } catch (err) {
      console.error("[StateInventory] Fatal Error:", err);
      res.status(500).json({ error: "Errore interno nel caricamento dell'inventario statale." });
    }
  }

  // GET /api/market/offers
  async function getOffers(req: any, res: any) {
    try {
      const { data: offers, error } = await supabase
        .from('market_offers')
        .select('*')
        .order('createdAt', { ascending: false })
        .limit(100);

      if (error) throw error;
      res.json(offers || []);
    } catch (err: any) {
      console.error("Market offers error:", err);
      res.status(500).json({ error: "Errore nel caricamento del mercato." });
    }
  }

  // POST /api/market/offer
  async function createOffer(req: any, res: any) {
    const user = req.user;
    const { itemId, quantity, price } = req.body;

    if (!itemId || !quantity || !price || quantity <= 0 || price <= 0) {
      return res.status(400).json({ error: "Parametri non validi." });
    }

    try {
      // Check Cooldown
      const { data: lastOffer } = await supabase
        .from('market_offers')
        .select('createdAt')
        .eq('sellerId', user.id)
        .eq('itemId', itemId)
        .order('createdAt', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastOffer && Date.now() - new Date(lastOffer.createdAt).getTime() < GAME_CONFIG.MARKET_OFFER_COOLDOWN_MS) {
        return res.status(400).json({ error: "Devi attendere 5 minuti prima di pubblicare un'altra offerta per questo oggetto." });
      }

      // Check Inventory
      const { data: userInv } = await supabase
        .from('user_inventory')
        .select('quantity')
        .eq('userId', user.id)
        .eq('itemId', itemId)
        .single();

      if (!userInv || userInv.quantity < quantity) {
        return res.status(400).json({ error: "Non hai abbastanza risorse nell'inventario per creare questa offerta." });
      }

      // Get Tax Rate & Sanctions
      const { data: region } = await supabase.from('regions').select('*').eq('id', user.regionId).single();
      const taxRate = region?.marketTaxRate !== undefined ? region.marketTaxRate : 10;

      // Sanctions Check
      const { data: sanctions } = await supabase.from('sanctions')
        .select('id')
        .eq('fromStateId', user.regionId)
        .eq('targetStateId', user.originalNation)
        .eq('status', 'ACTIVE')
        .maybeSingle();

      if (sanctions) {
        return res.status(403).json({ error: "Sanzioni commerciali attive: non puoi vendere prodotti della tua nazione in questo Stato." });
      }

      // Transaction via RPC
      const { error: rpcError } = await supabase.rpc('create_market_offer', {
        p_user_id: user.id,
        p_item_id: itemId,
        p_quantity: quantity,
        p_price: price,
        p_region_id: user.regionId,
        p_tax_rate: taxRate,
        p_origin_state_id: user.originalNation || user.regionId
      });

      if (rpcError) {
        console.error("Market offer RPC error:", rpcError);
        return res.status(500).json({ error: `Errore database: ${rpcError.message}` });
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error("Market offer error:", err);
      res.status(500).json({ error: "Errore durante la creazione dell'offerta." });
    }
  }

  // POST /api/market/buy
  async function buyOffer(req: any, res: any) {
    const user = req.user;
    const { offerId, quantity, isStateBuy } = req.body;

    if (!offerId || !quantity || quantity <= 0) {
      return res.status(400).json({ error: "Parametri non validi." });
    }

    try {
      const { error: buyError } = await supabase.rpc('purchase_market_offer', {
        p_buyer_id: user.id,
        p_offer_id: offerId,
        p_quantity: quantity,
        p_is_state_buy: isStateBuy ? true : false,
        p_buyer_state_id: user.residenceId || 'IT'
      });

      if (buyError) throw buyError;

      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  // GET /api/inventory/history/:itemId
  async function getInventoryHistory(req: any, res: any) {
    const user = req.user;
    const { itemId } = req.params;
    const isGold = itemId === 'gold_ore' || itemId === 'gold';

    try {
      // 1. Get current balance
      let currentBalance = 0;
      if (isGold) {
        const { data: userData } = await supabase.from('users').select('gold').eq('id', user.id).single();
        currentBalance = userData?.gold || 0;
      } else {
        const { data: inv } = await supabase.from('user_inventory')
          .select('quantity')
          .eq('userId', user.id)
          .eq('itemId', itemId)
          .maybeSingle();
        currentBalance = inv?.quantity || 0;
      }

      // 2. Fetch Extractions (Work)
      let extractions: any[] = [];
      if (isGold) {
        const { data: goldLogs } = await supabase.from('factory_worker_logs')
          .select('earningsGold, workedAt, factoryId')
          .eq('workerId', user.id)
          .gt('earningsGold', 0)
          .order('workedAt', { ascending: false })
          .limit(20);
        extractions = (goldLogs || []).map((l: any) => ({
          resourceAmount: l.earningsGold,
          workedAt: l.workedAt,
          factoryId: l.factoryId
        }));
      } else {
        const { data: resLogs } = await supabase.from('factory_worker_logs')
          .select('resourceAmount, workedAt, factoryId')
          .eq('workerId', user.id)
          .eq('resourceType', itemId)
          .order('workedAt', { ascending: false })
          .limit(20);
        extractions = resLogs || [];
      }

      // 3. Fetch Market Purchases
      const { data: purchases } = await supabase.from('market_transactions_log')
        .select('quantity, timestamp, sellerId')
        .eq('buyerId', user.id)
        .eq('itemId', itemId)
        .order('timestamp', { ascending: false })
        .limit(20);

      // 4. Fetch Withdrawals from Action Logs
      const { data: actions } = await supabase.from('action_logs')
        .select('details, timestamp')
        .eq('userId', user.id)
        .eq('action', 'FACTORY_WITHDRAW')
        .order('timestamp', { ascending: false })
        .limit(50);

      // 5. Consolidate
      const history: any[] = [];

      for (const ex of extractions) {
        history.push({
          type: 'scavo',
          amount: ex.resourceAmount,
          timestamp: ex.workedAt,
          source: 'Lavoro in Fabbrica'
        });
      }

      if (purchases) {
        for (const p of purchases) {
          history.push({
            type: 'acquisto',
            amount: p.quantity,
            timestamp: new Date(Number(p.timestamp)).toISOString(),
            source: 'Acquisto Mercato'
          });
        }
      }

      if (actions) {
        for (const a of actions) {
          try {
            const details = typeof a.details === 'string' ? JSON.parse(a.details) : a.details;
            if (details.item === itemId) {
              history.push({
                type: 'ritiro',
                amount: details.amount,
                timestamp: new Date(Number(a.timestamp)).toISOString(),
                source: 'Prelievo Magazzino'
              });
            }
          } catch (e) {}
        }
      }

      // Sort by timestamp descending
      history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      res.json({
        success: true,
        itemId,
        currentBalance,
        history: history.slice(0, 30)
      });
    } catch (err: any) {
      console.error("Inventory history error:", err);
      res.status(500).json({ error: "Errore nel caricamento della cronologia." });
    }
  }

  // POST /api/market/energy-drinks/buy
  async function buyEnergyDrinks(req: any, res: any) {
    const user = req.user;
    const quantity = req.body?.quantity;
    const purchase = await buyEnergyDrinksForUser(user.id, quantity);

    if (!purchase.ok) {
      return res.status(purchase.status).json({ error: purchase.error });
    }

    return res.json({
      success: true,
      quantity: purchase.payload?.quantity,
      unitCost: purchase.payload?.unitCost ?? GAME_CONFIG.ENERGY_DRINK_COST_GOLD,
      totalCost: purchase.payload?.totalCost,
      goldBefore: purchase.payload?.goldBefore,
      goldAfter: purchase.payload?.goldAfter,
      energyDrinksBefore: purchase.payload?.energyDrinksBefore,
      energyDrinksAfter: purchase.payload?.energyDrinksAfter
    });
  }

  // POST /api/produce
  async function produce(req: any, res: any) {
    const user = req.user;

    const perks = await getUserPerks(user.id);
    const resistanceLv = perks['RESISTENZA'] || 0;
    const maxStorage = Math.floor(GAME_CONFIG.STORAGE_BASE_CAPACITY * (1 + (resistanceLv * 0.01)));

    try {
      const result = await productionService.produce({
        userId: user.id,
        weaponType: req.body?.weaponType,
        qty: req.body?.qty,
        maxStorage,
        generateId: () => generateSecureId(9),
        nowMs: () => Date.now(),
      });

      const http = mapServiceResultToHttp(result);
      return res.status(http.statusCode).json(http.body);
    } catch (err: any) {
      console.error('Produce error:', err);
      return res.status(500).json({ error: 'Errore nella produzione: ' + err.message });
    }
  }

  // GET /api/produce/list
  async function produceList(req: any, res: any) {
    const { data: queue, error } = await supabase.from('production_queue')
      .select('*')
      .eq('userId', req.user.id)
      .order('createdAt', { ascending: false })
      .limit(20);

    if (error) {
      console.error("Produce list error:", error);
      return res.status(500).json({ error: "Errore nel caricamento" });
    }

    const now = Date.now();
    const items = (queue || []).map((d: any) => {
      const isReady = new Date(d.willCompleteAt).getTime() <= now && d.status !== "claimed";
      return {
        ...d,
        status: isReady ? "ready" : d.status,
      };
    });
    res.json(items);
  }

  // POST /api/produce/claim
  async function produceClaim(req: any, res: any) {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: "ID richiesto" });

    const nowIso = new Date().toISOString();
    const { data: claimedRows, error: claimError } = await supabase
      .from('production_queue')
      .update({ status: 'claimed' })
      .eq('id', id)
      .eq('userId', req.user.id)
      .neq('status', 'claimed')
      .lte('willCompleteAt', nowIso)
      .select('*');

    if (claimError) return res.status(500).json({ error: "Errore durante il ritiro." });
    if (!claimedRows || claimedRows.length === 0) {
      const { data: existingItem } = await supabase
        .from('production_queue')
        .select('id, status, willCompleteAt')
        .eq('id', id)
        .eq('userId', req.user.id)
        .maybeSingle();

      if (!existingItem) return res.status(404).json({ error: "Item non trovato" });
      if (existingItem.status === 'claimed') return res.status(400).json({ error: "Già ritirato" });
      if (new Date(existingItem.willCompleteAt).getTime() > Date.now()) return res.status(400).json({ error: "Produzione in corso" });
      return res.status(409).json({ error: "Conflitto di stato produzione. Riprova." });
    }

    const d = claimedRows[0];

    const { data: inv } = await supabase.from('user_inventory').select('quantity').eq('userId', req.user.id).eq('itemId', d.weaponType).single();
    if (inv) {
      await supabase.from('user_inventory').update({ quantity: (inv.quantity || 0) + (d.qty || 1) }).eq('userId', req.user.id).eq('itemId', d.weaponType);
    } else {
      await supabase.from('user_inventory').insert({ userId: req.user.id, itemId: d.weaponType, quantity: d.qty || 1 });
    }

    res.json({ success: true });
  }

  return {
    canSellInState,
    getListings,
    createListing,
    getStateInventory,
    getOffers,
    createOffer,
    buyOffer,
    getInventoryHistory,
    buyEnergyDrinks,
    produce,
    produceList,
    produceClaim,
  };
}
