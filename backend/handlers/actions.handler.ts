/**
 * Actions Handlers (includes perks and train)
 *
 * Extracted from server.ts — no logic changes.
 * Covers: /api/actions/work, /api/actions/propaganda, /api/actions/invest,
 *   /api/actions/craft-drink, /api/actions/use-drink, /api/actions/travel,
 *   /api/actions/attack, /api/actions/train, /api/work,
 *   /api/perks/upgrade, /api/perks/booster
 */

// ── Travel helpers (module-level, no deps needed) ──

const COUNTRY_COORDS: Record<string, [number, number]> = {
  // Europe
  IT: [41.87, 12.57], FR: [46.60, 2.35], DE: [51.17, 10.45], ES: [40.46, -3.75],
  GB: [55.38, -3.44], PT: [39.40, -8.22], NL: [52.13, 4.89], BE: [50.50, 4.47],
  CH: [46.82, 8.23], AT: [47.52, 14.55], PL: [51.92, 19.15], CZ: [49.82, 15.47],
  SK: [48.67, 19.70], HU: [47.16, 19.50], RO: [45.94, 24.97], BG: [42.73, 25.49],
  GR: [39.07, 21.82], HR: [45.10, 15.20], RS: [44.02, 21.01], BA: [43.92, 17.68],
  SI: [46.15, 14.99], ME: [42.71, 19.37], MK: [41.51, 21.75], AL: [41.15, 20.17],
  XK: [42.60, 20.90], SE: [60.13, 18.64], NO: [60.47, 8.47], FI: [61.92, 25.75],
  DK: [56.26, 9.50], IS: [64.96, -19.02], IE: [53.41, -8.24], LT: [55.17, 23.88],
  LV: [56.88, 24.60], EE: [58.60, 25.01], LU: [49.82, 6.13], MT: [35.94, 14.38],
  CY: [35.13, 33.43], MD: [47.41, 28.37], BY: [53.71, 27.95], UA: [48.38, 31.17],
  // Asia
  RU: [61.52, 105.32], TR: [38.96, 35.24], CN: [35.86, 104.20], JP: [36.20, 138.25],
  KR: [35.91, 127.77], KP: [40.34, 127.51], IN: [20.59, 78.96], PK: [30.38, 69.35],
  BD: [23.68, 90.36], ID: [0.79, 113.92], MY: [4.21, 101.98], TH: [15.87, 100.99],
  VN: [14.06, 108.28], PH: [12.88, 121.77], MM: [21.92, 95.96], KH: [12.57, 104.99],
  LA: [19.86, 102.50], SG: [1.35, 103.82], TW: [23.70, 120.96], MN: [46.86, 103.85],
  KZ: [48.02, 66.92], UZ: [41.38, 64.59], TM: [38.97, 59.56], KG: [41.20, 74.77],
  TJ: [38.86, 71.28], AF: [33.94, 67.71], IQ: [33.22, 43.68], IR: [32.43, 53.69],
  SA: [23.89, 45.08], AE: [23.42, 53.85], QA: [25.35, 51.18], KW: [29.31, 47.48],
  OM: [21.51, 55.92], YE: [15.55, 48.52], JO: [30.59, 36.24], LB: [33.85, 35.86],
  SY: [34.80, 38.99], IL: [31.05, 34.85], PS: [31.95, 35.23], GE: [42.32, 43.36],
  AM: [40.07, 45.04], AZ: [40.14, 47.58], NP: [28.39, 84.12], LK: [7.87, 80.77],
  BT: [27.51, 90.43], MV: [3.20, 73.22], BN: [4.54, 114.73], TL: [8.87, 125.73],
  // Africa
  EG: [26.82, 30.80], MA: [31.79, -7.09], DZ: [28.03, 1.66], TN: [33.89, 9.54],
  LY: [26.34, 17.23], SD: [12.86, 30.22], SS: [6.88, 31.31], ET: [9.15, 40.49],
  KE: [0.02, 37.91], TZ: [-6.37, 34.89], UG: [1.37, 32.29], RW: [-1.94, 29.87],
  BI: [-3.37, 29.92], CD: [-4.04, 21.76], CG: [-0.23, 15.83], GA: [-0.80, 11.61],
  CM: [7.37, 12.35], NG: [9.08, 8.68], GH: [7.95, -1.02], CI: [7.54, -5.55],
  SN: [14.50, -14.45], ML: [17.57, -4.00], NE: [17.61, 8.08], BF: [12.24, -1.56],
  TG: [8.62, 1.21], BJ: [9.31, 2.32], GM: [13.44, -15.31], GW: [11.80, -15.18],
  GN: [9.95, -9.70], SL: [8.46, -11.78], LR: [6.43, -9.43], MR: [21.01, -10.94],
  ZA: [-30.56, 22.94], NA: [-22.96, 18.49], BW: [-22.33, 24.68], ZW: [-19.02, 29.15],
  MZ: [-18.67, 35.53], MG: [-18.77, 46.87], MW: [-13.25, 34.30], ZM: [-13.13, 27.85],
  AO: [-11.20, 17.87], SO: [5.15, 46.20], DJ: [11.83, 42.59], ER: [15.18, 39.78],
  ST: [0.19, 6.61], SC: [-4.68, 55.49], MU: [-20.35, 57.55], KM: [-11.88, 43.87],
  // Americas
  US: [37.09, -95.71], CA: [56.13, -106.35], MX: [23.63, -102.55], BR: [-14.24, -51.93],
  AR: [-38.42, -63.62], CL: [-35.68, -71.54], CO: [4.57, -74.30], VE: [6.42, -66.59],
  PE: [-9.19, -75.02], EC: [-1.83, -78.18], BO: [-16.29, -63.59], PY: [-23.44, -58.44],
  UY: [-32.52, -55.77], GY: [4.86, -58.93], SR: [3.92, -56.03], CU: [21.52, -77.78],
  HT: [18.97, -72.29], DO: [18.74, -70.16], JM: [18.11, -77.30], TT: [10.69, -61.22],
  PR: [18.22, -66.59], GT: [15.78, -90.23], HN: [15.20, -86.24], SV: [13.79, -88.90],
  NI: [12.87, -85.21], CR: [9.75, -83.75], PA: [8.54, -80.78], BZ: [17.19, -88.50],
  // Oceania
  AU: [-25.27, 133.78], NZ: [-40.90, 174.89], PG: [-6.31, 143.96], FJ: [-17.71, 178.07],
  WS: [-13.76, -172.10], TO: [-21.18, -175.20], VU: [-15.38, 166.96],
};

const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Travel time configuration
const TRAVEL_MIN_MINUTES = 1;
const TRAVEL_MAX_MINUTES = 60;
const TRAVEL_KM_PER_MINUTE = 100;
const TRAVEL_DEFAULT_MS = 2 * 60 * 1000; // 2 minutes fallback if coords unknown

const calculateTravelTimeMs = (fromIso2: string, toIso2: string): number => {
  const from = COUNTRY_COORDS[fromIso2.toUpperCase()];
  const to = COUNTRY_COORDS[toIso2.toUpperCase()];
  if (!from || !to) return TRAVEL_DEFAULT_MS;
  const distKm = haversineDistance(from[0], from[1], to[0], to[1]);
  const minutes = Math.max(TRAVEL_MIN_MINUTES, Math.min(TRAVEL_MAX_MINUTES, Math.round(distKm / TRAVEL_KM_PER_MINUTE)));
  return minutes * 60 * 1000;
};

export function createActionsHandlers(deps: {
  supabase: any;
  getUserPerks: (userId: string, boosterInfo?: Record<string, any>) => Promise<Record<string, number>>;
  addXP: (userId: string, amount: number) => Promise<void>;
  generateSecureId: (length: number) => string;
  addBudgetTransaction: (...args: any[]) => Promise<any>;
  isValidIso2: (code: string) => boolean;
  performTrainingAction: (userId: string) => Promise<any>;
  tryUseEnergyDrinkForUser: (...args: any[]) => Promise<any>;
  performWorkAction: (userId: string, factoryId: string, options?: any) => Promise<any>;
  updateMissionProgress: (userId: string, type: string, data: Record<string, any>) => Promise<any>;
  retrySupabaseOperation: (...args: any[]) => Promise<any>;
  GAME_CONFIG: any;
  PERKS_DEFS: any[];
  BOOSTER_CONFIG: any;
  RESOURCE_TYPES: any;
  FACTORY_CONFIG: any;
  EXTRACTION_CONFIG: any;
  AUTONOMY_CONFIG: any;
  factoryYieldMultiplier: (level: number) => number;
  factoryStorageLimit: (type: string, level: number) => number;
  calculateDamage: (...args: any[]) => number;
  calculateDamageCap: (...args: any[]) => number;
  incrementPlayerWorkExperience: (userId: string, resourceType: string, gain: number, istruzioneLevel: number) => Promise<any>;
}) {
  const {
    supabase, getUserPerks, addXP, generateSecureId, addBudgetTransaction,
    isValidIso2, performTrainingAction, performWorkAction,
    updateMissionProgress,
    GAME_CONFIG, PERKS_DEFS, BOOSTER_CONFIG, FACTORY_CONFIG, AUTONOMY_CONFIG,
    factoryYieldMultiplier, factoryStorageLimit,
    incrementPlayerWorkExperience,
  } = deps;

  // ── Cooldown helpers ──

  const checkCooldown = async (userId: string, actionType: string, cooldownTime: number) => {
    const { data } = await supabase
      .from('cooldowns')
      .select('last_used')
      .eq('user_id', userId)
      .eq('action_type', actionType)
      .maybeSingle();

    if (!data) return true;
    return (Date.now() - new Date(data.last_used).getTime()) >= cooldownTime;
  };

  const updateCooldown = async (userId: string, actionType: string) => {
    await supabase.from('cooldowns').upsert({
      user_id: userId,
      action_type: actionType,
      last_used: new Date().toISOString()
    });
  };

  // ── buyEnergyDrinksForUser helper (used by craft-drink) ──

  async function buyEnergyDrinksForUser(userId: string, quantityInput: unknown) {
    const quantity = Math.floor(Number(quantityInput) || 0);
    if (quantity <= 0) {
      return { ok: false as const, status: 400, error: "Quantita non valida. Deve essere un intero > 0." };
    }

    const unitCost = GAME_CONFIG.ENERGY_DRINK_COST_GOLD;
    const totalCost = quantity * unitCost;

    try {
      const { data, error } = await supabase.rpc('buy_energy_drinks', {
        p_user_id: userId,
        p_quantity: quantity,
      });

      if (error) {
        const message = String(error.message || "Errore durante l'acquisto dei drink.");

        // Fallback for environments where the migration has not been applied yet.
        // Keep business rule server-side: totalCost = quantity * 30 gold.
        if (/buy_energy_drinks|function .* does not exist/i.test(message)) {
          const { data: deductResult, error: deductError } = await supabase.rpc('safe_deduct_currency', {
            p_user_id: userId,
            p_money_cost: 0,
            p_gold_cost: totalCost,
            p_energy_cost: 0,
          });
          if (deductError) {
            return { ok: false as const, status: 500, error: String(deductError.message || "Errore durante la deduzione gold.") };
          }
          const deductData = typeof deductResult === 'string' ? JSON.parse(deductResult) : deductResult;
          if (deductData?.error) {
            return { ok: false as const, status: 400, error: String(deductData.error) };
          }

          const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .select('gold, energyDrinks')
            .eq('id', userId)
            .single();
          if (updateError || !updatedUser) {
            return { ok: false as const, status: 500, error: "Impossibile leggere lo stato utente dopo la deduzione gold." };
          }

          const drinksBefore = Math.max(0, Number(updatedUser.energyDrinks) || 0);
          const { data: drinkRows, error: drinksError } = await supabase
            .from('users')
            .update({ energyDrinks: drinksBefore + quantity })
            .eq('id', userId)
            .eq('energyDrinks', updatedUser.energyDrinks)
            .select('gold, energyDrinks')
            .single();
          if (drinksError || !drinkRows) {
            return { ok: false as const, status: 500, error: "Acquisto parziale: gold scalato ma drink non aggiornati. Contatta un admin." };
          }

          return {
            ok: true as const,
            payload: {
              success: true,
              playerId: userId,
              quantity,
              unitCost,
              totalCost,
              goldAfter: Number(drinkRows.gold || 0),
              energyDrinksBefore: drinksBefore,
              energyDrinksAfter: Number(drinkRows.energyDrinks || 0)
            }
          };
        }

        const status = /insufficiente|quantit|non trovato/i.test(message) ? 400 : 500;
        return { ok: false as const, status, error: message };
      }

      const payload = (typeof data === 'string' ? JSON.parse(data) : data) || {};
      return { ok: true as const, payload };
    } catch (err: any) {
      return { ok: false as const, status: 500, error: String(err?.message || "Errore durante l'acquisto dei drink.") };
    }
  }

  // ── POST /api/actions/work ──

  async function actionsWork(req: any, res: any) {
  const user = req.user;
  const userRegion = user.region_id || 'IT';

  const { factoryId } = req.body;

  // Canonical work logic lives in performWorkAction(); keep this endpoint as a compatibility alias.
  // NOTE: legacy implementation below is kept for now but bypassed to prevent divergence.
  try {
    if (!factoryId) return res.status(400).json({ error: "factoryId mancante." });
    const result = await performWorkAction(user.id, factoryId, { allowAutoDrink: false });
    return res.json(result);
  } catch (error: any) {
    if (error?.statusCode) return res.status(error.statusCode).json({ error: error.message });
    return res.status(500).json({ error: error?.message || "Errore durante il lavoro." });
  }

  // 1. Get Factory Data
  const { data: factory, error: fError } = await supabase
    .from('factories')
    .select('*')
    .eq('id', factoryId)
    .single();

  if (fError || !factory) return res.status(404).json({ error: "Nessuna fabbrica trovata" });
  const factoryMinLevel = factory.minLevel ?? 1;
  if (user.level < factoryMinLevel) return res.status(400).json({ error: `Richiede livello ${factoryMinLevel}` });
  if (factory.isActive === false) return res.status(400).json({ error: "Fabbrica non attiva." });

  // 2. Check Immigration/Work Restrictions
  const { data: regionRel, error: rError } = await supabase
    .from('regions')
    .select('*')
    .eq('id', userRegion)
    .single();

  const restrictionsActive = regionRel?.workRestrictions === 1;
  const isResident = user.residence_id === userRegion;
  const hasWorkPermit = user.work_permit_id === userRegion;

  if (restrictionsActive && !isResident && !hasWorkPermit) {
    return res.status(403).json({ error: "Questa nazione richiede un Permesso di Lavoro per operare fabbriche statali." });
  }

  // 3. Cooldown Check (Using RPC or simple query)
  const { data: cooldownData } = await supabase
    .from('user_factory_cooldowns')
    .select('lastUsed')
    .eq('userId', user.id)
    .eq('factoryId', factoryId)
    .single();

  if (cooldownData && Date.now() - new Date(cooldownData.lastUsed).getTime() < factory.cooldownSec * 1000) {
    return res.status(400).json({ error: "Factory on cooldown" });
  }

  // 4. Energy Logic: Every action consumes the full bar (300)
  const energyCost = 300;

  if (user.energy < energyCost) return res.status(400).json({ error: "Energia insufficiente (richiesti 300)." });

  const perks = await getUserPerks(user.id);
  const forzaBoost = (perks['FORZA'] || 0) * 0.03;
  const taxRate = regionRel?.marketTaxRate !== undefined ? regionRel.marketTaxRate : FACTORY_CONFIG.DEFAULT_INDUSTRY_TAX_RATE;

  // 5. Determine factory category and calculate outputs
  const factoryType = factory.type || '';
  const typeDef = FACTORY_CONFIG.TYPES[factoryType];
  const isGoldMine = typeDef?.category === 'gold';
  const level = factory.level || 1;
  const yieldMult = factoryYieldMultiplier(level);

  let netEarningsMoney = 0;
  let netEarningsGold = 0;
  let playerResourceOutput = 0;
  let stateResourceOutput = 0;
  let ownerCut = 0;
  let grossValue = 0;

  if (isGoldMine) {
    // Gold mine: dual payout (money + gold)
    const baseMoney = Math.floor(FACTORY_CONFIG.GOLD_MINE_MONEY_PER_WORK * yieldMult * (1 + forzaBoost));
    const baseGold = Math.round(FACTORY_CONFIG.GOLD_MINE_GOLD_PER_WORK * yieldMult * 100) / 100;
    const moneyTax = Math.floor(baseMoney * (taxRate / 100));
    const goldTax = Math.round(baseGold * (taxRate / 100) * 100) / 100;
    netEarningsMoney = baseMoney - moneyTax;
    netEarningsGold = Math.round((baseGold - goldTax) * 100) / 100;
    ownerCut = Math.floor(baseMoney * FACTORY_CONFIG.OWNER_PROFIT_RATE);
    grossValue = baseMoney;
  } else if (factory.payMode === 'salary') {
    // Salary mode: pay fixed wage from budget
    const earnings = Math.floor((factory.payoutMoney ?? factory.wage ?? 50) * (1 + forzaBoost));
    const taxes = Math.floor(earnings * (taxRate / 100));
    netEarningsMoney = earnings - taxes;
    grossValue = earnings;
    ownerCut = 0; // salary mode: no owner cut, paid from budget
  } else {
    // Resource mode: mine resources
    const resourceTypes = Object.keys(FACTORY_CONFIG.TYPES).filter(k => FACTORY_CONFIG.TYPES[k].category === 'resource');
    if (resourceTypes.includes(factoryType)) {
      let bonusMult = 1.0;
      if (factoryType === 'oil') bonusMult = regionRel?.oilBonus || 1.0;
      else if (factoryType === 'minerals') bonusMult = regionRel?.mineralsBonus || 1.0;
      else if (factoryType === 'uranium') bonusMult = regionRel?.uraniumBonus || 1.0;
      else if (factoryType === 'diamonds') bonusMult = regionRel?.diamondsBonus || 1.0;

      const resourceOutput = Math.max(1, Math.floor(level * FACTORY_CONFIG.BASE_RESOURCE_OUTPUT * bonusMult * (1 + forzaBoost)));
      stateResourceOutput = Math.floor(resourceOutput * (taxRate / 100));
      ownerCut = Math.floor(resourceOutput * FACTORY_CONFIG.OWNER_PROFIT_RATE);
      playerResourceOutput = resourceOutput - stateResourceOutput - ownerCut;
      if (playerResourceOutput < 0) playerResourceOutput = 0;
      grossValue = resourceOutput * (FACTORY_CONFIG.RESOURCE_VALUES[typeDef?.resource || ''] || 1);

      // Check storage capacity
      const storageLimit = factoryStorageLimit(factoryType, level);
      const currentStorage = factory.currentStorage || 0;
      if (storageLimit > 0 && currentStorage + ownerCut > storageLimit) {
        return res.status(400).json({ error: `Magazzino pieno! Capacità: ${storageLimit.toLocaleString()}, Attuale: ${currentStorage.toLocaleString()}` });
      }
    }
  }

  try {
    if (isGoldMine) {
      // Gold mine: deduct energy, add money and gold to worker
      const { error: energyErr } = await supabase.rpc('safe_deduct_currency', {
        p_user_id: user.id,
        p_money_cost: -netEarningsMoney,  // negative cost = add money
        p_gold_cost: netEarningsGold >= 1 ? -Math.floor(netEarningsGold) : 0,
        p_energy_cost: energyCost,
      });
      if (energyErr) throw energyErr;

      // Owner profit: atomically increment owner's money
      if (ownerCut > 0 && factory.ownerUserId !== user.id) {
        await supabase.rpc('safe_deduct_currency', {
          p_user_id: factory.ownerUserId,
          p_money_cost: -ownerCut,  // negative cost = add money
          p_gold_cost: 0,
          p_energy_cost: 0,
        });
      }
      // Tax to region
      const moneyTax = Math.floor(FACTORY_CONFIG.GOLD_MINE_MONEY_PER_WORK * yieldMult * (1 + forzaBoost) * (taxRate / 100));
      if (moneyTax > 0) {
        await supabase.rpc('add_budget_transaction', {
          p_owner_type: 'REGION',
          p_owner_id: userRegion,
          p_type: 'INCOME',
          p_subtype: 'INDUSTRY_TAX',
          p_money_delta: moneyTax,
          p_metadata: { factoryType: 'gold', factoryId }
        });
      }
    } else {
      // Perform updates via a custom RPC to ensure atomicity
      const { error: workError } = await supabase.rpc('process_work_action', {
        p_user_id: user.id,
        p_factory_id: factoryId,
        p_energy_cost: energyCost,
        p_net_earnings: netEarningsMoney,
        p_taxes: Math.floor(grossValue * (taxRate / 100)),
        p_region_id: userRegion
      });

      if (workError) throw workError;

      // Resource distribution: player gets resources minus state tax and owner cut
      if (playerResourceOutput > 0) {
        const { data: existingInv } = await supabase.from('user_inventory')
          .select('quantity').eq('userId', user.id).eq('itemId', factoryType).maybeSingle();
        if (existingInv) {
          await supabase.from('user_inventory')
            .update({ quantity: existingInv.quantity + playerResourceOutput })
            .eq('userId', user.id).eq('itemId', factoryType);
        } else {
          await supabase.from('user_inventory')
            .insert({ userId: user.id, itemId: factoryType, quantity: playerResourceOutput });
        }
      }

      // Owner gets resource cut into factory storage (handled atomically below)

      // State gets resource tax via budget transaction
      if (stateResourceOutput > 0) {
        await supabase.rpc('add_budget_transaction', {
          p_owner_type: 'REGION',
          p_owner_id: userRegion,
          p_type: 'INCOME',
          p_subtype: 'RESOURCE_TAX',
          p_money_delta: 0,
          p_resources_delta: { [factoryType]: stateResourceOutput },
          p_metadata: { resource: factoryType, quantity: stateResourceOutput, factoryId }
        });
      }
    }

    // Atomically update factory economy counters and storage (prevents race conditions)
    const productionCount = isGoldMine ? grossValue : (playerResourceOutput + stateResourceOutput + ownerCut);
    const storageDelta = (!isGoldMine && ownerCut > 0) ? ownerCut : 0;
    await supabase.rpc('increment_factory_counters', {
      p_factory_id: factoryId,
      p_worker_count: 1,
      p_production: productionCount,
      p_owner_profit: ownerCut,
      p_taxes_paid: Math.floor(grossValue * (taxRate / 100)),
      p_storage_delta: storageDelta,
    });

    // Log economy daily aggregate
    try {
      await supabase.rpc('upsert_factory_economy_log', {
        p_factory_id: factoryId,
        p_gross_income: grossValue,
        p_taxes_paid: Math.floor(grossValue * (taxRate / 100)),
        p_owner_profit: ownerCut,
        p_production: productionCount,
      });
    } catch { /* non-critical */ }

    // Log worker action
    try {
      await supabase.from('factory_worker_logs').insert({
        factoryId: factoryId,
        workerId: user.id,
        earningsMoney: netEarningsMoney,
        earningsGold: netEarningsGold,
        resourceType: isGoldMine ? null : (playerResourceOutput > 0 ? factoryType : null),
        resourceAmount: isGoldMine ? 0 : playerResourceOutput,
        ownerCut: ownerCut,
      });
    } catch { /* non-critical */ }

    // Update cooldown
    await supabase.from('user_factory_cooldowns').upsert({
      userId: user.id,
      factoryId: factoryId,
      lastUsed: new Date().toISOString(),
    }, { onConflict: 'userId,factoryId' });

    // XP Gain — boosted by regional Education Index
    const educationLevel = Math.max(1, (regionRel?.educationIndex || 1)) as number;
    const educationBonus = educationLevel * AUTONOMY_CONFIG.INDEX_EFFECTS.education.xpBonusPerLevel;
    const xpGain = Math.round((GAME_CONFIG.XP_PER_WORK + (perks['ISTRUZIONE'] || 0) * 2) * (1 + educationBonus));
    await addXP(user.id, xpGain);

    // Work Experience Gain — increment per-resource work experience
    let workExpGain = 0;
    const WORK_EXP_PER_ISTRUZIONE_LEVEL = 0.5;
    if (!isGoldMine && factoryType) {
      workExpGain = 1 + Math.floor((perks['ISTRUZIONE'] || 0) * WORK_EXP_PER_ISTRUZIONE_LEVEL);
      try {
        await incrementPlayerWorkExperience(user.id, factoryType, workExpGain, perks['ISTRUZIONE'] || 0);
      } catch (expErr) {
        console.error("Work experience increment failed (non-critical):", expErr);
      }
    }

    res.json({ 
      success: true, 
      earnings: netEarningsMoney,
      goldEarnings: netEarningsGold,
      taxes: Math.floor(grossValue * (taxRate / 100)), 
      energyCost, 
      xpGain,
      workExpGain,
      ownerCut,
      isGoldMine,
      payMode: factory.payMode,
      resourceOutput: playerResourceOutput > 0 ? { type: factoryType, player: playerResourceOutput, state: stateResourceOutput, ownerCut } : null
    });

    // ── Daily Missions: update work-related progress (non-blocking) ──
    try {
      await updateMissionProgress(user.id, 'WORK', {
        work_times: 1,
        earn_money: netEarningsMoney,
        earn_gold: netEarningsGold,
        produce_resources: playerResourceOutput > 0 ? playerResourceOutput : 0,
        start_production: 1,
        spend_energy: energyCost,
      });
      await updateMissionProgress(user.id, 'EARN_XP', { earn_xp: xpGain });
    } catch { /* non-critical */ }
  } catch (err: any) {
    console.error("Work execution failed:", err);
    res.status(500).json({ error: "Errore durante il lavoro: " + err.message });
  }
  }

  // ── POST /api/actions/propaganda ──

  async function actionsPropaganda(req: any, res: any) {
  const user = req.user;
  const { regionId } = req.body;
  const perks = user.perks || {};

  if (!regionId) return res.status(400).json({ error: "Region ID required" });

  const energyEfficiency = (perks['RESISTENZA'] || 0) * 0.005;
  const energyCost = Math.ceil(GAME_CONFIG.PROPAGANDA_ENERGY_COST * (1 - energyEfficiency));

  if (user.energy < energyCost) return res.status(400).json({ error: "Not enough energy" });

  // Cooldown check via Supabase
  const { data: lastProp } = await supabase
    .from('cooldowns')
    .select('last_used')
    .eq('user_id', user.id)
    .eq('action_type', 'propaganda')
    .single();

  if (lastProp && Date.now() - new Date(lastProp.last_used).getTime() < GAME_CONFIG.PROPAGANDA_COOLDOWN) {
    return res.status(400).json({ error: "Action on cooldown" });
  }

  const influenceGain = 5 + Math.floor(Math.random() * 5);

  try {
    // Perform updates
    await supabase.from('users').update({
      energy: user.energy - energyCost
    }).eq('id', user.id);

    await supabase.rpc('update_region_stability', { p_region_id: regionId, p_delta: 10 });

    await supabase.from('cooldowns').upsert({
      user_id: user.id,
      action_type: 'propaganda',
      last_used: new Date().toISOString()
    });

    await addXP(user.id, GAME_CONFIG.XP_PER_PROPAGANDA);

    res.json({ success: true, influenceGain });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
  }

  // ── POST /api/actions/invest ──

  async function actionsInvest(req: any, res: any) {
  const user = req.user;
  const { regionId } = req.body;
  const perks = user.perks || {};

  const moneyCost = GAME_CONFIG.INVEST_MONEY_COST;
  const energyEfficiency = (perks['RESISTENZA'] || 0) * 0.005;
  const energyCost = Math.ceil(GAME_CONFIG.INVEST_ENERGY_COST * (1 - energyEfficiency));

  if (user.money < moneyCost) return res.status(400).json({ error: "Not enough money" });
  if (user.energy < energyCost) return res.status(400).json({ error: "Not enough energy" });

  try {
    // Atomic currency + energy deduction
    const { data: deductResult, error: deductError } = await supabase.rpc('safe_deduct_currency', {
      p_user_id: user.id,
      p_money_cost: moneyCost,
      p_gold_cost: 0,
      p_energy_cost: energyCost,
    });
    if (deductError) throw deductError;
    const deductData = typeof deductResult === 'string' ? JSON.parse(deductResult) : deductResult;
    if (deductData?.error) return res.status(400).json({ error: deductData.error });

    // Update region stats (stability, population, economy)
    await supabase.rpc('process_invest_action', {
      p_region_id: regionId,
      p_stability_delta: 5,
      p_pop_delta: 1000,
      p_economy_delta: 3
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
  }

  // ── POST /api/actions/craft-drink ──

  async function actionsCraftDrink(req: any, res: any) {
  const user = req.user;
  const quantity = req.body?.quantity ?? 1;
  const purchase = await buyEnergyDrinksForUser(user.id, quantity);

  if (!purchase.ok) {
    return res.status(purchase.status).json({ error: purchase.error });
  }

  return res.json({
    success: true,
    quantity: purchase.payload?.quantity,
    unitCost: purchase.payload?.unitCost ?? GAME_CONFIG.ENERGY_DRINK_COST_GOLD,
    totalCost: purchase.payload?.totalCost,
    goldAfter: purchase.payload?.goldAfter,
    energyDrinks: purchase.payload?.energyDrinksAfter
  });
  }

  // ── POST /api/actions/use-drink ──

  async function actionsUseDrink(req: any, res: any) {
  const user = req.user;
  const now = Date.now();

  try {
    const { data: freshUser, error: readError } = await supabase
      .from('users')
      .select('energyDrinks, lastEnergyDrink')
      .eq('id', user.id)
      .single();
    if (readError) throw readError;

    if ((freshUser.energyDrinks || 0) <= 0) {
      return res.status(400).json({ error: "Non hai Energy Drinks disponibili nell'inventario." });
    }

    const elapsed = now - (freshUser.lastEnergyDrink || 0);
    if (elapsed < GAME_CONFIG.ENERGY_DRINK_COOLDOWN) {
      const remainingMin = Math.ceil((GAME_CONFIG.ENERGY_DRINK_COOLDOWN - elapsed) / 60000);
      return res.status(400).json({ error: `Drink in cooldown. Attendi altri ${remainingMin} minuti.` });
    }

    let updateQuery = supabase
      .from('users')
      .update({
        energyDrinks: freshUser.energyDrinks - 1,
        energy: GAME_CONFIG.ENERGY_MAX,
        lastEnergyDrink: now
      })
      .eq('id', user.id)
      .eq('energyDrinks', freshUser.energyDrinks);

    if (freshUser.lastEnergyDrink == null) {
      updateQuery = updateQuery.is('lastEnergyDrink', null);
    } else {
      updateQuery = updateQuery.eq('lastEnergyDrink', freshUser.lastEnergyDrink);
    }

    const { data: updatedUsers, error: updateError } = await updateQuery.select('id');
    if (updateError) throw updateError;
    if (!updatedUsers || updatedUsers.length === 0) {
      return res.status(409).json({ error: "Conflitto durante l'utilizzo del drink. Riprova." });
    }

    res.json({ success: true, newEnergy: GAME_CONFIG.ENERGY_MAX });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
  }

  // ── POST /api/actions/travel ──

  async function actionsTravel(req: any, res: any) {
  const user = req.user;
  const { regionId } = req.body;
  if (!regionId) return res.status(400).json({ error: "Nessuna destinazione specificata." });
  const normalizedRegionId = String(regionId).trim().toUpperCase();
  if (!isValidIso2(normalizedRegionId)) return res.status(400).json({ error: "Regione non valida." });
  if (user.regionId === normalizedRegionId) return res.status(400).json({ error: "Sei già in questa regione." });

  // Block travel if already traveling
  if (user.travelingUntil && Date.now() < user.travelingUntil) {
    const remainingMin = Math.ceil((user.travelingUntil - Date.now()) / 60000);
    return res.status(400).json({ error: `Sei già in viaggio verso ${user.travelingTo}. Arrivo tra ${remainingMin} minuti.` });
  }

  // 1. Fetch target region info (use * to avoid errors if optional columns are missing)
  const { data: targetRegion, error: regionError } = await supabase
    .from('regions')
    .select('*')
    .eq('id', normalizedRegionId)
    .single();

  if (regionError || !targetRegion) return res.status(404).json({ error: "Regione non trovata." });

  let isRestricted = targetRegion.workRestrictions === 1;
  let travelFee = targetRegion.travelFee || 0;
  const sourceStateId = user.residenceId || user.regionId;

  // 2. Bloc check
  const [{ data: userBloc }, { data: targetBloc }] = await Promise.all([
    supabase.from('bloc_memberships').select('blocId').eq('stateId', sourceStateId).eq('status', 'active').maybeSingle(),
    supabase.from('bloc_memberships').select('blocId').eq('stateId', normalizedRegionId).eq('status', 'active').maybeSingle()
  ]);

  if (userBloc && targetBloc && userBloc.blocId === targetBloc.blocId) {
    const { data: blocReg } = await supabase.from('bloc_regulations').select('openBorders, migrationOpen').eq('blocId', userBloc.blocId).maybeSingle();
    if (blocReg && (blocReg.openBorders || blocReg.migrationOpen)) {
      isRestricted = false;
      travelFee = 0;
    }
  }

  // 3. Migration Agreement check
  if (isRestricted || travelFee > 0) {
    const { data: agreement } = await supabase
      .from('migration_agreements')
      .select('id')
      .eq('fromStateId', normalizedRegionId)
      .eq('toStateId', sourceStateId)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (agreement) {
      isRestricted = false;
      travelFee = 0;
    }
  }

  // 4. Budget check
  if (isRestricted && travelFee > 0 && user.money < travelFee) {
    return res.status(400).json({ error: `Fondi insufficienti per pagare la tassa di frontiera ($${travelFee}).` });
  }

  try {
    // 5. Calculate travel time
    const travelTimeMs = calculateTravelTimeMs(user.regionId, normalizedRegionId);
    const travelingUntil = Date.now() + travelTimeMs;
    const travelMinutes = Math.round(travelTimeMs / 60000);

    // 6. Start travel (set travelingTo and travelingUntil instead of instant move)
    const updateData: any = { travelingTo: normalizedRegionId, travelingUntil };
    if (isRestricted && travelFee > 0) {
      updateData.money = user.money - travelFee;
    }

    await supabase.from('users').update(updateData).eq('id', user.id);

    // Budget transaction for travel fee
    if (isRestricted && travelFee > 0) {
      await supabase.rpc('add_budget_transaction', {
        p_owner_type: 'REGION',
        p_owner_id: normalizedRegionId,
        p_type: 'INCOME',
        p_subtype: 'TRAVEL_FEE',
        p_money_delta: travelFee,
        p_resources_delta: {},
        p_created_by: user.id,
        p_metadata: { fromRegion: user.regionId }
      });
    }

    res.json({ success: true, regionId: normalizedRegionId, travelMinutes, travelingUntil });
  } catch (err: any) {
    console.error("Travel error:", err);
    res.status(500).json({ error: "Errore durante il viaggio" });
  }
  }

  // ── POST /api/actions/attack ──

  async function actionsAttack(req: any, res: any) {
  const user = req.user;
  const { regionId } = req.body;

  const perks = await getUserPerks(user.id);

  // RESISTENZA reduces energy in war too (same formula as work, capped at lv50)
  const resistenza = perks['RESISTENZA'] || 0;
  const energyReduction = Math.min(0.5, resistenza / 100);
  const energyCost = Math.ceil(GAME_CONFIG.ATTACK_ENERGY_COST * (1 - energyReduction));

  let finalEnergyCost = energyCost;

  if (user.energy < finalEnergyCost) return res.status(400).json({ error: "Not enough energy" });

  // Cooldown check via Supabase
  const { data: lastAttack } = await supabase
    .from('cooldowns')
    .select('last_used')
    .eq('user_id', user.id)
    .eq('action_type', 'attack')
    .maybeSingle();

  if (lastAttack && Date.now() - new Date(lastAttack.last_used).getTime() < GAME_CONFIG.ATTACK_COOLDOWN) {
    return res.status(400).json({ error: "Action on cooldown" });
  }

  const { data: region } = await supabase.from('regions').select('*').eq('id', regionId).single();
  if (!region) return res.status(404).json({ error: "Region not found" });

  // Bloc restriction
  const [{ data: attackerBloc }, { data: defenderBloc }] = await Promise.all([
    supabase.from('bloc_memberships').select('blocId').eq('stateId', user.regionId).eq('status', 'active').maybeSingle(),
    supabase.from('bloc_memberships').select('blocId').eq('stateId', regionId).eq('status', 'active').maybeSingle()
  ]);

  if (attackerBloc && defenderBloc && attackerBloc.blocId === defenderBloc.blocId) {
    return res.status(403).json({ error: "Non puoi dichiarare guerra a un membro dello stesso Blocco Geopolitico." });
  }

  const forzaBonus = (perks['FORZA'] || 0) * 0.05;
  const istruzBonus = (perks['ISTRUZIONE'] || 0) * 0.02;
  const resistBonus = (perks['RESISTENZA'] || 0) * 0.03;
  const totalDmgBonus = forzaBonus + istruzBonus + resistBonus;

  let alphaBonus = 0;
  if (resistenza >= 50) alphaBonus += 0.10;
  if (resistenza >= 75) alphaBonus += 0.10;
  if (resistenza >= 100) alphaBonus += 0.15;

  const winProbability = Math.min(0.9, 0.3 + totalDmgBonus + alphaBonus);
  const success = Math.random() < winProbability;

  await supabase.from('users').update({ energy: user.energy - finalEnergyCost }).eq('id', user.id);

  if (success) {
    await supabase.from('regions').update({
      ownerUserId: user.id,
      stability: Math.max(0, (region.stability || 100) - 20)
    }).eq('id', regionId);

    const warId = generateSecureId(7);
    await supabase.from('wars').insert({
      id: warId,
      attackerCountryIso2: user.regionId,
      defenderCountryIso2: regionId,
      attackerUserId: user.id,
      defenderUserId: region.ownerUserId,
      status: 'ended',
      startedAt: new Date().toISOString(),
      endsAt: new Date().toISOString(),
      attackerScore: 100,
      defenderScore: 0
    });

    await addXP(user.id, GAME_CONFIG.XP_PER_ATTACK);
  } else {
    await addXP(user.id, Math.floor(GAME_CONFIG.XP_PER_ATTACK / 2));
  }

  await supabase.from('cooldowns').upsert({
    user_id: user.id,
    action_type: 'attack',
    last_used: new Date().toISOString()
  });

  res.json({ success, winProbability: Math.round(winProbability * 100) });
  }

  // ── POST /api/actions/train ──

  async function actionsTrain(req: any, res: any) {
  const user = req.user;

  try {
    const result = await performTrainingAction(user.id);
    return res.json(result);
  } catch (error: any) {
    if (error?.statusCode) return res.status(error.statusCode).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
  }

  // ── POST /api/work ──

  async function work(req: any, res: any) {
  const user = req.user;
  const { factoryId } = req.body;

  try {
    const result = await performWorkAction(user.id, factoryId);
    return res.json(result);
  } catch (error: any) {
    if (error?.statusCode) return res.status(error.statusCode).json({ error: error.message });
    return res.status(500).json({ error: error?.message || "Errore durante il lavoro." });
  }
  }

  // ── POST /api/perks/upgrade ──

  async function perksUpgrade(req: any, res: any) {
  const user = req.user;
  const { perkId, useGold } = req.body;

  const perkDef = PERKS_DEFS.find((p: any) => p.id === perkId);
  if (!perkDef) return res.status(404).json({ error: "Perk non trovato" });

  const currentLevel = user.perks[perkId] || 0;

  const targetLevel = currentLevel + 1;
  const baseCashCost = (perkDef as any).baseCashCost || 2000;
  const baseGoldCost = (perkDef as any).baseGoldCost || 20;
  const baseTimeCashSec = (perkDef as any).baseTimeCashSec || 3600;
  const baseTimeGoldSec = (perkDef as any).baseTimeGoldSec || 1200;

  const cashCost = Math.round(baseCashCost * Math.pow(1.5, currentLevel));
  const goldCost = Math.ceil(baseGoldCost * Math.pow(1.4, currentLevel));
  const cashTimeSec = Math.round(baseTimeCashSec * Math.pow(1.3, currentLevel));
  const goldTimeSec = Math.round(baseTimeGoldSec * Math.pow(1.3, currentLevel));

  // --- Enforce ONE upgrade at a time (globally across all perks) ---
  const { data: userData } = await supabase.from('users').select('perkUpgradesJson').eq('id', user.id).single();
  let existingUpgrades = JSON.parse(userData?.perkUpgradesJson || '{}');

  const nowTs = Date.now();
  const anyActive = Object.entries(existingUpgrades).some(([id, upg]: [string, any]) =>
    upg.willCompleteAt > nowTs
  );
  if (anyActive) {
    return res.status(400).json({ error: "Hai già un potenziamento in corso. Puoi imparare solo una abilità alla volta." });
  }

  // Check if this specific perk already queued
  if (existingUpgrades[perkId]?.willCompleteAt > nowTs) {
    return res.status(400).json({ error: "Questo perk è già in fase di potenziamento." });
  }

  // Cash is always required as a base cost
  if (user.money < cashCost) {
    return res.status(400).json({ error: `Cash insufficiente. Costo: $${cashCost.toLocaleString()}` });
  }

  if (useGold && user.gold < goldCost) {
    return res.status(400).json({ error: `Gold insufficiente. Servono 🪙 ${goldCost}` });
  }

  const timeSec = useGold ? goldTimeSec : cashTimeSec;
  const willCompleteAt = nowTs + (timeSec * 1000);

  // Store the new upgrade in existingUpgrades before saving
  existingUpgrades[perkId] = {
    startedAt: nowTs,
    willCompleteAt,
    targetLevel: targetLevel
  };

  const updateData: any = { perkUpgradesJson: JSON.stringify(existingUpgrades) };
  
  // Atomic currency deduction for perk upgrades
  const perkMoneyCost = cashCost;
  const perkGoldCost = useGold ? goldCost : 0;
  
  const { data: deductResult, error: deductError } = await supabase.rpc('safe_deduct_currency', {
    p_user_id: user.id,
    p_money_cost: perkMoneyCost,
    p_gold_cost: perkGoldCost,
    p_energy_cost: 0,
  });
  if (deductError) {
    return res.status(500).json({ error: "Errore nella deduzione: " + deductError.message });
  }
  const deductData = typeof deductResult === 'string' ? JSON.parse(deductResult) : deductResult;
  if (deductData?.error) return res.status(400).json({ error: deductData.error });

  await supabase.from('users').update(updateData).eq('id', user.id);

  // ── Daily Missions: perk upgrade progress (non-blocking) ──
  try {
    await updateMissionProgress(user.id, 'PERK_UPGRADE', { upgrade_perk: 1 });
  } catch { /* non-critical */ }

  return res.json({ success: true, queued: true, willCompleteAt, timeSec });
  }

  // ── POST /api/perks/booster ──

  async function perksBooster(req: any, res: any) {
  const user = req.user;
  const { perkId, useGold } = req.body;

  const perkDef = PERKS_DEFS.find((p: any) => p.id === perkId);
  if (!perkDef) return res.status(404).json({ error: "Perk non trovato" });

  const currentLevel = user.perks[perkId] || 0;

  // Check cooldown (only if there was a previous activation)
  let activeBoosters: Record<string, any> = {};
  try {
    activeBoosters = JSON.parse(user.boostersJson || '{}');
  } catch { activeBoosters = {}; }

  const nowTs = Date.now();
  const booster = activeBoosters[perkId];

  if (booster && nowTs < booster.lastActivatedAt + BOOSTER_CONFIG.COOLDOWN_MS) {
    const remainingCooldown = booster.lastActivatedAt + BOOSTER_CONFIG.COOLDOWN_MS - nowTs;
    const days = Math.floor(remainingCooldown / (24 * 60 * 60 * 1000));
    const hours = Math.floor((remainingCooldown % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    return res.status(400).json({ error: `Booster in ricarica. Riprova fra ${days}g ${hours}h.` });
  }

  const price = useGold ? BOOSTER_CONFIG.GOLD_PRICE : BOOSTER_CONFIG.CASH_PRICE;
  if (useGold) {
    if (user.gold < price) return res.status(400).json({ error: `Oro insufficiente. Servono 🪙 ${price} Gold.` });
  } else {
    if (user.money < price) return res.status(400).json({ error: `Cash insufficiente. Costo: $${price.toLocaleString()}` });
  }

  // Duration decay formula: base / (1 + perkLevel * decay)
  const baseDuration = useGold ? BOOSTER_CONFIG.BASE_DURATION_GOLD_MS : BOOSTER_CONFIG.BASE_DURATION_CASH_MS;
  const duration = Math.round(baseDuration / (1 + currentLevel * BOOSTER_CONFIG.DURATION_DECAY));
  const expiresAt = nowTs + duration;

  activeBoosters[perkId] = {
    expiresAt,
    lastActivatedAt: nowTs,
    isGold: !!useGold
  };

  const updateData: any = { boostersJson: JSON.stringify(activeBoosters) };
  
  // Atomic currency deduction for booster
  const { data: deductResult, error: deductError } = await supabase.rpc('safe_deduct_currency', {
    p_user_id: user.id,
    p_money_cost: useGold ? 0 : price,
    p_gold_cost: useGold ? price : 0,
    p_energy_cost: 0,
  });
  if (deductError) {
    return res.status(500).json({ error: "Errore nella deduzione: " + deductError.message });
  }
  const boosterDeductData = typeof deductResult === 'string' ? JSON.parse(deductResult) : deductResult;
  if (boosterDeductData?.error) return res.status(400).json({ error: boosterDeductData.error });

  await supabase.from('users').update(updateData).eq('id', user.id);

  return res.json({
    success: true,
    expiresAt,
    duration,
    perkId
  });
  }

  return {
    actionsWork,
    actionsPropaganda,
    actionsInvest,
    actionsCraftDrink,
    actionsUseDrink,
    actionsTravel,
    actionsAttack,
    actionsTrain,
    work,
    perksUpgrade,
    perksBooster,
  };
}
