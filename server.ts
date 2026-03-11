import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { GAME_CONFIG, PERKS_DEFS, BOOSTER_CONFIG } from "./src/types";

console.log("Starting server.ts...");

const app = express();
const PORT = 3000;
const SECRET_KEY = "territorial-secret-key";

// Seeded Random Helper
const seededRandom = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return () => {
    hash = (hash * 16807) % 2147483647;
    return (hash - 1) / 2147483646;
  };
};

const generateGameStatsForCountry = (iso2: string) => {
  const rng = seededRandom(iso2);
  const resourceTypes = ["Oil", "Steel", "Food", "Tech", "Uranium"];
  const numResources = 1 + Math.floor(rng() * 3);
  const selectedResources = [];
  const shuffled = [...resourceTypes].sort(() => rng() - 0.5);

  const getIndicator = () => 1 + Math.floor(rng() * 10); // 1-10

  for (let i = 0; i < numResources; i++) {
    selectedResources.push({
      type: shuffled[i],
      base: 10 + Math.floor(rng() * 90)
    });
  }

  return {
    indicators: {
      health: getIndicator(),
      education: getIndicator(),
      industry: getIndicator(),
      security: getIndicator(),
      infrastructure: getIndicator(),
      morale: getIndicator(),
      economy: getIndicator(),
      tech: getIndicator(),
      resourcesQuality: getIndicator(),
      stability: getIndicator()
    },
    resources: selectedResources,
  };
};

// Initialize Supabase Client (Service Role for admin bypass)
const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase URL or Key missing in Environment Variables!");
}

const supabase = createClient(supabaseUrl, supabaseKey);

app.use(express.json());
app.use(cookieParser());

// Helper to get user perks, including active boosters
const getUserPerks = async (userId: string, boosterInfo?: Record<string, any>) => {
  const { data: perks } = await supabase.from('perks').select('perkId, level').eq('userId', userId);
  const perkMap: Record<string, number> = {};
  if (perks) {
    perks.forEach((p: any) => perkMap[p.perkId] = p.level);
  }

  // Energy & XP Booster calculation
  if (boosterInfo) {
    // Current logic uses boosters stored in user's Perks upgrades JSON
    // but the system is transitioning to a dedicated table/column.
    // Keeping it simple for now based on incoming boosterInfo.
    if (boosterInfo.type === 'ENERGY_BOOSTER') perkMap['RESISTENZA'] = (perkMap['RESISTENZA'] || 0) + (boosterInfo.strength || 0);
    if (boosterInfo.type === 'XP_BOOSTER') perkMap['ISTRUZIONE'] = (perkMap['ISTRUZIONE'] || 0) + (boosterInfo.strength || 0);
  }

  return perkMap;
};

// Helper to calculate XP and Level Up
const addXP = async (userId: string, amount: number) => {
  try {
    await supabase.rpc('add_user_xp', { p_user_id: userId, p_amount: amount });
  } catch (error) {
    console.error("Error adding XP:", error);
  }
};

const calculateMinisterWage = async (stateId: string, role: string) => {
  const { data: region } = await supabase
    .from('regions')
    .select('governmentForm, education, health, economyLevel, ownerUserId')
    .eq('id', stateId)
    .single();

  if (!region) return 0;

  // 1. Base from Development Index (Avg of Edu, Health, Economy)
  const devIndex = (region.education + region.health + region.economyLevel) / 3;

  // 2. Multiplier from Government Form
  let govMult = 1.0;
  if (region.governmentForm === 'PRESIDENTIAL_REPUBLIC') govMult = 1.5;
  if (region.governmentForm === 'DICTATORSHIP') govMult = 2.0;
  if (region.governmentForm === 'ONE_PARTY_SYSTEM') govMult = 1.8;

  // 3. Multiplier from Region Count (representing state size/complexity)
  const { count } = await supabase
    .from('regions')
    .select('*', { count: 'exact', head: true })
    .eq('ownerUserId', region.ownerUserId);

  const sizeMult = 1 + ((count || 1) * 0.1);

  const baseWage = 10; // 10 Gold base
  return Math.floor(baseWage * devIndex * govMult * sizeMult);
};

// Middleware to verify Supabase JWT and update user state
const authenticate = async (req: any, res: any, next: any) => {
  let token = null;

  // 1. Try Authorization header first (Bearer <token>)
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7);
  } else {
    token = req.cookies?.['sb-access-token'] || req.cookies?.['token'];
  }

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: Access token missing." });
  }

  try {
    // Verify token with Supabase
    // We use the default client (anon/user) to verify the token
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authUser) {
      console.error("Token verification failed:", authError);
      return res.status(401).json({ error: "Unauthorized: Invalid session." });
    }

    // Fetch user data from 'users' table
    // We use the service role client (global 'supabase') to bypass RLS and see all columns/users
    let { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (userError || !user) {
      if (userError && userError.code !== 'PGRST116') {
         console.error("Error fetching user from table:", userError);
      }

      // Just-in-time provisioning: create user if they exist in Auth but not in public.users
      console.log(`[JIT] Provisioning new user: ${authUser.email} (${authUser.id})`);
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          id: authUser.id,
          username: authUser.user_metadata?.username || authUser.email?.split('@')[0] || `User_${authUser.id.substring(0, 5)}`,
          money: 5000,
          gold: 50,
          energy: 100,
          xp: 0,
          level: 1,
          regionId: 'IT-RM', // Default region (Ensure this exists in your regions table)
          residenceId: 'IT-RM',
          lastEnergyUpdate: Date.now(),
          lastLogin: Date.now()
        })
        .select()
        .single();
      
      if (createError) {
        console.error("[JIT] Error provisioning user:", createError);
        return res.status(500).json({ error: "Failed to create user profile. Please check if 'regions' table is populated." });
      }
      console.log(`[JIT] Successfully provisioned user: ${newUser.username}`);
      user = newUser;
    }

    // Attach user to request
    req.user = user;
    req.user.maxEnergy = GAME_CONFIG.ENERGY_MAX;

    // Load perk levels from perks table
    req.user.perks = await getUserPerks(user.id);

    // Parse perkUpgrades and boosters from JSON columns
    try {
      req.user.perkUpgrades = JSON.parse(user.perkUpgradesJson || '{}');
    } catch { req.user.perkUpgrades = {}; }
    try {
      req.user.boosters = JSON.parse(user.boostersJson || '{}');
    } catch { req.user.boosters = {}; }

    // Auto-finalize completed perk upgrades
    const nowTs = Date.now();
    let upgradesChanged = false;
    for (const [perkId, upg] of Object.entries(req.user.perkUpgrades as Record<string, any>)) {
      if (upg.willCompleteAt && upg.willCompleteAt <= nowTs) {
        // Upgrade completed → increment perk level
        const newLevel = (req.user.perks[perkId] || 0) + 1;
        const { error: upsertErr } = await supabase.from('perks').upsert(
          { userId: user.id, perkId, level: newLevel },
          { onConflict: 'userId,perkId' }
        );
        if (!upsertErr) {
          req.user.perks[perkId] = newLevel;
          delete req.user.perkUpgrades[perkId];
          upgradesChanged = true;
        } else {
          console.error("Error finalizing perk upgrade:", upsertErr);
        }
      }
    }
    if (upgradesChanged) {
      const { error: updateErr } = await supabase.from('users').update({
        perkUpgradesJson: JSON.stringify(req.user.perkUpgrades)
      }).eq('id', user.id);
      if (updateErr) {
        console.error("Error updating perkUpgradesJson:", updateErr);
      }
    }

    next();
  } catch (err) {
    console.error("Auth Middleware Critical Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


// Auth Routes are now handled on the Client with Supabase Auth
// The server only needs to verify the session and provide profile synchronization if needed.

// Game Routes
app.get("/api/me", authenticate, (req: any, res) => {
  res.json(req.user);
});

app.get("/api/regions", authenticate, async (req, res) => {
  const { data: regions, error } = await supabase
    .from('regions')
    .select(`
      *,
      owner:users!ownerUserId(username),
      leader:users!leaderUserId(username, level)
    `);

  if (error) return res.status(500).json({ error: error.message });

  // Format for backward compatibility if needed
  const formatted = regions.map(r => ({
    ...r,
    ownerName: r.owner?.username,
    leaderName: r.leader?.username,
    leaderLevel: r.leader?.level
  }));

  res.json(formatted);
});

app.get("/api/regions/:id", authenticate, async (req, res) => {
  try {
    const regionId = (req.params.id || '').toUpperCase().replace('NATION_', '');

    const { data: region, error } = await supabase
      .from('regions')
      .select(`
        *,
        owner:users!ownerUserId(username),
        leader:users!leaderUserId(username, level),
        nation:nations(*),
        factories:factories(count)
      `)
      .eq('id', regionId)
      .single();

    if (error || !region) return res.status(404).json({ error: "Regione non trovata" });

    // Get sibling regions
    const { data: memberRegions } = await supabase
      .from('regions')
      .select('id, name, population')
      .eq('nation_id', region.nation_id);

    res.json({
      ...region,
      ownerName: region.owner?.username,
      leaderName: region.leader?.username,
      leaderLevel: region.leader?.level,
      memberRegions: memberRegions || [region]
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/countries/:iso2", authenticate, async (req: any, res) => {
  const { iso2 } = req.params;
  if (!iso2 || iso2 === "-99") return res.status(400).json({ error: "Regione non disponibile" });

  try {
    const isoId = iso2.toUpperCase();

    // 1. Get region data from Supabase
    let { data: region, error } = await supabase
      .from('regions')
      .select(`
        *,
        owner:users!ownerUserId(username),
        leader:users!leaderUserId(username, level),
        nation:nations(*)
      `)
      .eq('id', isoId)
      .single();

    if (error || !region) {
      // Auto-create in Supabase if missing (equivalent to SQLite Insert OR Ignore)
      const { data: newRegion, error: createError } = await supabase
        .from('regions')
        .insert({
          id: isoId,
          name: isoId,
          population: 1000000,
          health: 1,
          education: 1,
          military: 1,
          stability: 5
        })
        .select()
        .single();

      if (!createError) region = newRegion;
    }

    if (!region) return res.status(404).json({ error: "Regione non trovata" });

    // 2. Generate stats (simplified, should eventually be in a trigger)
    const gameStats = generateGameStatsForCountry(isoId);

    // 3. Get sibling regions
    const { data: memberRegions } = await supabase
      .from('regions')
      .select('id, name, population')
      .eq('nation_id', region.nation_id);

    // 4. Construct response
    const response = {
      ...gameStats,
      ...region,
      ownerName: region.owner?.username,
      leaderName: region.leader?.username,
      leaderLevel: region.leader?.level,
      memberRegions: memberRegions || [region],
      indicators: {
        ...(gameStats?.indicators || {}),
        health: region.health || 1,
        education: region.education || 1,
        military: region.military || 1,
        stability: region.stability || 1
      }
    };

    res.json(response);
  } catch (err) {
    console.error("Error fetching country detail:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/countries/:iso2/agreements", authenticate, async (req: any, res) => {
  const { iso2 } = req.params;
  try {
    const stateId = iso2.toUpperCase();

    const { data: agreements, error } = await supabase
      .from('migration_agreements')
      .select('*, rf:regions!fromStateId(name), rt:regions!toStateId(name)')
      .or(`fromStateId.eq.${stateId},toStateId.eq.${stateId}`)
      .eq('status', 'ACTIVE')
      .order('activatedAt', { ascending: false });

    if (error) throw error;

    const enriched = await Promise.all((agreements || []).map(async (ag: any) => {
      const partnerId = ag.fromStateId === stateId ? ag.toStateId : ag.fromStateId;
      const partnerName = ag.fromStateId === stateId ? ag.rt?.name : ag.rf?.name;

      const { data: inverse } = await supabase
        .from('migration_agreements')
        .select('id')
        .eq('fromStateId', ag.toStateId)
        .eq('toStateId', ag.fromStateId)
        .eq('status', 'ACTIVE')
        .maybeSingle();

      return {
        ...ag,
        partnerId,
        partnerName,
        direction: ag.fromStateId === stateId ? 'OUTGOING' : 'INCOMING',
        agreementType: inverse ? 'BILATERAL' : 'UNILATERAL'
      };
    }));

    res.json({
      outgoing: enriched.filter(a => a.direction === 'OUTGOING'),
      incoming: enriched.filter(a => a.direction === 'INCOMING')
    });
  } catch (err) {
    console.error("Error fetching agreements:", err);
    res.status(500).json({ error: "Errore caricamento accordi." });
  }
});

/// Market API (Supabase)
app.get("/api/market/listings", authenticate, async (req: any, res) => {
  const { data: listings, error } = await supabase
    .from('market_offers')
    .select('*')
    .order('createdAt', { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ error: error.message });
  res.json(listings || []);
});

app.post("/api/market/listings", authenticate, async (req: any, res) => {
  const { itemName, quantity, price } = req.body;
  const user = req.user;

  if (!itemName || !quantity || !price || quantity <= 0 || price <= 0) {
    return res.status(400).json({ error: "Dati non validi." });
  }

  try {
    const offerId = Math.random().toString(36).substring(2, 11);
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
});

// Actions
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

// --- Budget Core Helper ---
// --- Budget Core Helper (Supabase RPC based) ---
async function addBudgetTransaction(
  ownerType: string,
  ownerId: string,
  type: string,
  subtype: string,
  moneyDelta: number,
  resourcesDelta: Record<string, number> = {},
  createdByUserId: string | null = null,
  metadata: any = {}
) {
  // We use an RPC 'add_budget_transaction' defined in schema.sql to ensure atomicity
  const { data, error } = await supabase.rpc('add_budget_transaction', {
    p_owner_type: ownerType,
    p_owner_id: ownerId,
    p_type: type,
    p_subtype: subtype,
    p_money_delta: moneyDelta,
    p_resources_delta: resourcesDelta,
    p_created_by: createdByUserId,
    p_metadata: metadata
  });

  if (error) throw error;
  return data;
}

app.post("/api/actions/work", authenticate, async (req: any, res) => {
  const user = req.user;
  const userRegion = user.region_id || 'IT';

  const { factoryId } = req.body;

  // 1. Get Factory Data
  const { data: factory, error: fError } = await supabase
    .from('factories')
    .select('*')
    .eq('id', factoryId)
    .single();

  if (fError || !factory) return res.status(404).json({ error: "Nessuna fabbrica trovata" });
  if (user.level < factory.min_level) return res.status(400).json({ error: `Richiede livello ${factory.min_level}` });

  // 2. Check Immigration/Work Restrictions
  const { data: regionRel, error: rError } = await supabase
    .from('regions')
    .select('work_restrictions, market_tax_rate')
    .eq('id', userRegion)
    .single();

  const restrictionsActive = regionRel?.work_restrictions === 1;
  const isResident = user.residence_id === userRegion;
  const hasWorkPermit = user.work_permit_id === userRegion;

  if (restrictionsActive && !isResident && !hasWorkPermit) {
    return res.status(403).json({ error: "Questa nazione richiede un Permesso di Lavoro per operare fabbriche statali." });
  }

  // 3. Cooldown Check (Using RPC or simple query)
  const { data: cooldownData } = await supabase
    .from('user_factory_cooldowns')
    .select('last_used')
    .eq('user_id', user.id)
    .eq('factory_id', factoryId)
    .single();

  if (cooldownData && Date.now() - new Date(cooldownData.last_used).getTime() < factory.cooldown_sec * 1000) {
    return res.status(400).json({ error: "Factory on cooldown" });
  }

  // 4. Energy and Perks Logic
  const perks = user.perks || {};
  const resistenza = perks['RESISTENZA'] || 0;
  const energyReduction = Math.min(0.5, resistenza / 100);
  const energyCost = Math.ceil(factory.energy_cost * (1 - energyReduction));

  if (user.energy < energyCost) return res.status(400).json({ error: "Not enough energy" });

  const forzaBoost = (perks['FORZA'] || 0) * 0.03;
  const earnings = Math.floor(factory.payout_money * (1 + forzaBoost));

  const taxRate = regionRel?.market_tax_rate || 10;
  const taxes = Math.floor(earnings * (taxRate / 100));
  const netEarnings = earnings - taxes;

  try {
    // Perform updates via a custom RPC to ensure atomicity
    const { error: workError } = await supabase.rpc('process_work_action', {
      p_user_id: user.id,
      p_factory_id: factoryId,
      p_energy_cost: energyCost,
      p_net_earnings: netEarnings,
      p_taxes: taxes,
      p_region_id: userRegion
    });

    if (workError) throw workError;

    // XP Gain (simplified, should ideally be in the RPC too)
    const xpGain = GAME_CONFIG.XP_PER_WORK + (perks['ISTRUZIONE'] || 0) * 2;
    // For now, мы call addXP helper if it's updated or just do it here
    await supabase.rpc('add_user_xp', { p_user_id: user.id, p_amount: xpGain });

    res.json({ success: true, earnings: netEarnings, taxes, energyCost, xpGain });
  } catch (err: any) {
    console.error("Work execution failed:", err);
    res.status(500).json({ error: "Errore durante il lavoro: " + err.message });
  }
});


app.get("/api/factories", authenticate, async (req: any, res) => {
  const { data: factories } = await supabase.from('factories').select('*');
  const { data: cooldowns } = await supabase.from('user_factory_cooldowns').select('factoryId, lastUsed').eq('userId', req.user.id);

  const cooldownMap = new Map((cooldowns || []).map(c => [c.factoryId, c]));
  const factoriesWithCooldown = (factories || []).map(f => {
    const cd = cooldownMap.get(f.id);
    const lastUsed = cd ? new Date(cd.lastUsed).getTime() : 0;
    const remaining = cd ? Math.max(0, (f.cooldownSec * 1000) - (Date.now() - lastUsed)) : 0;
    return { ...f, remainingCooldown: remaining };
  });

  res.json(factoriesWithCooldown);
});

// Create a new player-owned factory
app.post("/api/factories/create", authenticate, async (req: any, res) => {
  const user = req.user;
  const { name, type, regionId } = req.body;

  if (!name || !type || !regionId) return res.status(400).json({ error: "Dati mancanti." });

  const validTypes = ['oil', 'minerals', 'uranium', 'diamonds'];
  if (!validTypes.includes(type)) return res.status(400).json({ error: "Tipo di fabbrica non valido." });

  const costs: Record<string, number> = { oil: 5000, minerals: 5000, uranium: 15000, diamonds: 25000 };
  const cost = costs[type] || 5000;

  if (user.money < cost) return res.status(400).json({ error: `Fondi insufficienti. Servono $${cost}.` });

  try {
    await supabase.from('users').update({ money: user.money - cost }).eq('id', user.id);

    const { data: factory, error } = await supabase.from('factories').insert({
      name,
      type,
      regionId: regionId.toUpperCase(),
      ownerUserId: user.id,
      wage: 50,
      budget: 0,
      level: 1,
      cooldownSec: 600,
      createdAt: new Date().toISOString()
    }).select().single();

    if (error) throw error;
    res.json(factory);
  } catch (err: any) {
    res.status(500).json({ error: "Errore nella creazione: " + err.message });
  }
});

// Deposit money into a factory's budget
app.post("/api/factories/deposit", authenticate, async (req: any, res) => {
  const user = req.user;
  const { factoryId, amount } = req.body;

  if (!factoryId || !amount || amount <= 0) return res.status(400).json({ error: "Parametri non validi." });

  const { data: factory } = await supabase.from('factories').select('*').eq('id', factoryId).single();
  if (!factory) return res.status(404).json({ error: "Fabbrica non trovata." });
  if (factory.ownerUserId !== user.id) return res.status(403).json({ error: "Non sei il proprietario." });
  if (user.money < amount) return res.status(400).json({ error: "Fondi insufficienti." });

  try {
    await supabase.from('users').update({ money: user.money - amount }).eq('id', user.id);
    await supabase.from('factories').update({ budget: (factory.budget || 0) + amount }).eq('id', factoryId);
    res.json({ success: true, newBudget: (factory.budget || 0) + amount });
  } catch (err: any) {
    res.status(500).json({ error: "Errore nel deposito: " + err.message });
  }
});


app.post("/api/actions/propaganda", authenticate, async (req: any, res) => {
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
      influence: user.influence + influenceGain,
      energy: user.energy - energyCost
    }).eq('id', user.id);

    await supabase.rpc('update_region_stability', { p_region_id: regionId, p_delta: 10 });

    await supabase.from('cooldowns').upsert({
      user_id: user.id,
      action_type: 'propaganda',
      last_used: new Date().toISOString()
    });

    await supabase.rpc('add_user_xp', { p_user_id: user.id, p_amount: GAME_CONFIG.XP_PER_PROPAGANDA });

    res.json({ success: true, influenceGain });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/actions/invest", authenticate, async (req: any, res) => {
  const user = req.user;
  const { regionId } = req.body;
  const perks = user.perks || {};

  const moneyCost = GAME_CONFIG.INVEST_MONEY_COST;
  const energyEfficiency = (perks['RESISTENZA'] || 0) * 0.005;
  const energyCost = Math.ceil(GAME_CONFIG.INVEST_ENERGY_COST * (1 - energyEfficiency));

  if (user.money < moneyCost) return res.status(400).json({ error: "Not enough money" });
  if (user.energy < energyCost) return res.status(400).json({ error: "Not enough energy" });

  try {
    await supabase.from('users').update({
      money: user.money - moneyCost,
      energy: user.energy - energyCost
    }).eq('id', user.id);

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
});

app.post("/api/actions/craft-drink", authenticate, async (req: any, res) => {
  const user = req.user;
  const cost = GAME_CONFIG.ENERGY_DRINK_COST_GOLD;
  if (user.gold < cost) return res.status(400).json({ error: `Oro insufficiente. Ti servono 🏅 ${cost}.` });

  try {
    const { data, error } = await supabase
      .from('users')
      .update({
        gold: user.gold - cost,
        energyDrinks: (user.energyDrinks || 0) + 1
      })
      .eq('id', user.id)
      .select('energyDrinks')
      .single();

    if (error) throw error;
    res.json({ success: true, energyDrinks: data.energyDrinks });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/actions/use-drink", authenticate, async (req: any, res) => {
  const user = req.user;
  if (user.energyDrinks <= 0) return res.status(400).json({ error: "Non hai Energy Drinks disponibili nell'inventario." });

  const now = Date.now();
  if (now - (user.lastEnergyDrink || 0) < GAME_CONFIG.ENERGY_DRINK_COOLDOWN) {
    const remainingMin = Math.ceil((GAME_CONFIG.ENERGY_DRINK_COOLDOWN - (now - user.lastEnergyDrink)) / 60000);
    return res.status(400).json({ error: `Drink in cooldown. Attendi altri ${remainingMin} minuti.` });
  }

  try {
    await supabase.from('users').update({
      energyDrinks: user.energyDrinks - 1,
      energy: GAME_CONFIG.ENERGY_MAX,
      lastEnergyDrink: now
    }).eq('id', user.id);

    res.json({ success: true, newEnergy: GAME_CONFIG.ENERGY_MAX });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/actions/claim-medal", authenticate, async (req: any, res) => {
  const user = req.user;
  const now = Date.now();

  if (now - (user.lastMedalClaim || 0) < GAME_CONFIG.MEDAL_CLAIM_COOLDOWN) {
    const remainingMin = Math.ceil((GAME_CONFIG.MEDAL_CLAIM_COOLDOWN - (now - (user.lastMedalClaim || 0))) / 60000);
    return res.status(400).json({ error: `La prossima medaglia sarà disponibile tra ${remainingMin} minuti.` });
  }

  try {
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({
        warMedals: (user.warMedals || 0) + 1,
        lastMedalClaim: now
      })
      .eq('id', user.id)
      .select('warMedals')
      .single();

    if (error) throw error;
    res.json({ success: true, warMedals: updatedUser.warMedals });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Residence and Permits API ---

app.post("/api/actions/travel", authenticate, async (req: any, res) => {
  const user = req.user;
  const { regionId } = req.body;
  if (!regionId) return res.status(400).json({ error: "Nessuna destinazione specificata." });
  if (user.regionId === regionId) return res.status(400).json({ error: "Sei già in questa regione." });

  // 1. Fetch target region info
  const { data: targetRegion, error: regionError } = await supabase
    .from('regions')
    .select('workRestrictions, travelFee')
    .eq('id', regionId)
    .single();

  if (regionError || !targetRegion) return res.status(404).json({ error: "Regione inesistente." });

  let isRestricted = targetRegion.workRestrictions === 1;
  let travelFee = targetRegion.travelFee || 0;
  const sourceStateId = user.residenceId || user.regionId;

  // 2. Bloc check
  const { data: userBloc } = await supabase.from('bloc_memberships').select('blocId').eq('stateId', sourceStateId).eq('status', 'active').maybeSingle();
  const { data: targetBloc } = await supabase.from('bloc_memberships').select('blocId').eq('stateId', regionId).eq('status', 'active').maybeSingle();

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
      .eq('fromStateId', regionId)
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
    // 5. Atomic Travel Action via RPC (or sequential calls for now, but RPC is better for budget)
    if (isRestricted && travelFee > 0) {
      await supabase.from('users').update({ regionId, money: user.money - travelFee }).eq('id', user.id);
      await supabase.rpc('add_budget_transaction', {
        p_owner_type: 'REGION',
        p_owner_id: regionId,
        p_type: 'INCOME',
        p_subtype: 'TRAVEL_FEE',
        p_money_delta: travelFee,
        p_resources_delta: {},
        p_created_by: user.id,
        p_metadata: { fromRegion: user.regionId }
      });
    } else {
      await supabase.from('users').update({ regionId }).eq('id', user.id);
    }

    res.json({ success: true, regionId });
  } catch (err: any) {
    console.error("Travel error:", err);
    res.status(500).json({ error: "Errore durante il viaggio" });
  }
});

app.post("/api/budget/donate", authenticate, async (req: any, res) => {
  const user = req.user;
  const { entityId, amount, currency } = req.body;

  if (user.level < 60) return res.status(403).json({ error: "Devi essere al Livello 60 per effettuare donazioni di Stato." });
  if (!entityId || !amount || amount <= 0) return res.status(400).json({ error: "Dati donazione non validi." });
  if (currency !== 'EUR' && currency !== 'GOLD') return res.status(400).json({ error: "Valuta non supportata." });

  const amountNum = Number(amount);
  if (currency === 'EUR' && user.money < amountNum) return res.status(400).json({ error: "Fondi in € insufficienti." });
  if (currency === 'GOLD' && user.gold < amountNum) return res.status(400).json({ error: "Fondi in Gold insufficienti." });

  const conversionRate = 500000;
  const moneyDelta = currency === 'GOLD' ? amountNum * conversionRate : amountNum;

  try {
    if (currency === 'EUR') {
      await supabase.from('users').update({ money: user.money - amountNum }).eq('id', user.id);
    } else {
      await supabase.from('users').update({ gold: user.gold - amountNum }).eq('id', user.id);
    }

    await supabase.rpc('add_budget_transaction', {
      p_owner_type: 'REGION',
      p_owner_id: entityId,
      p_type: 'INCOME',
      p_subtype: 'DONATION',
      p_money_delta: moneyDelta,
      p_resources_delta: {},
      p_created_by: user.id,
      p_metadata: { originalCurrency: currency, originalAmount: amountNum }
    });

    res.json({ success: true, donated: moneyDelta });
  } catch (err: any) {
    console.error("Donation error:", err);
    res.status(500).json({ error: "La donazione è fallita." });
  }
});

app.post("/api/budget/clean-radiation", authenticate, async (req: any, res) => {
  const user = req.user;
  const { regionId } = req.body;
  if (!regionId) return res.status(400).json({ error: "Nessuna regione specificata." });

  // Only Governor/Leader can do this
  const { data: region, error: regionError } = await supabase
    .from('regions')
    .select('ownerUserId, radiation')
    .eq('id', regionId)
    .single();

  if (regionError || !region || region.ownerUserId !== user.id) {
    return res.status(403).json({ error: "Azione riservata al Leader." });
  }
  if (region.radiation <= 0) return res.status(400).json({ error: "Nessuna radiazione da pulire." });

  const cost = 10000;

  try {
    await supabase.rpc('add_budget_transaction', {
      p_owner_type: 'REGION',
      p_owner_id: regionId,
      p_type: 'EXPENSE',
      p_subtype: 'RADIATION_CLEAN',
      p_money_delta: -cost,
      p_resources_delta: {},
      p_created_by: user.id
    });

    await supabase
      .from('regions')
      .update({ radiation: Math.max(0, (region.radiation || 0) - 10) })
      .eq('id', regionId);

    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Fondi insufficienti." });
  }
});

app.post("/api/budget/explore", authenticate, async (req: any, res) => {
  const user = req.user;
  const { regionId, type } = req.body;
  if (!regionId || (type !== 'normal' && type !== 'deep')) return res.status(400).json({ error: "Parametri esplorazione non validi." });

  const { data: region, error: regionError } = await supabase.from('regions').select('ownerUserId').eq('id', regionId).single();
  if (regionError || !region || region.ownerUserId !== user.id) return res.status(403).json({ error: "Azione riservata al Leader." });

  const isDeep = type === 'deep';
  const cost = isDeep ? 50000 : 15000;

  try {
    const foundOil = isDeep ? Math.floor(Math.random() * 500) + 100 : Math.floor(Math.random() * 100) + 20;
    const foundItems: Record<string, number> = { oil: foundOil };

    await supabase.rpc('add_budget_transaction', {
      p_owner_type: 'REGION',
      p_owner_id: regionId,
      p_type: 'EXPENSE',
      p_subtype: isDeep ? 'EXPLORE_DEEP' : 'EXPLORE_NORMAL',
      p_money_delta: -cost,
      p_resources_delta: foundItems,
      p_created_by: user.id
    });

    res.json({ success: true, message: `Esplorazione completata!` });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Fondi insufficienti." });
  }
});

app.get("/api/budget/:ownerType/:ownerId", authenticate, async (req: any, res) => {
  const { ownerType, ownerId } = req.params;

  const { data: budget, error: budgetError } = await supabase
    .from('budgets')
    .select('*')
    .eq('ownerType', ownerType)
    .eq('ownerId', ownerId)
    .single();

  if (budgetError || !budget) return res.status(404).json({ error: "Budget non trovato." });

  const { data: transactions, error: txError } = await supabase
    .from('budget_transactions')
    .select('*, users(username)')
    .eq('budgetId', budget.id)
    .order('createdAt', { ascending: false })
    .limit(50);

  // Format to match old structure (t.username instead of t.users.username)
  const formattedTxs = (transactions || []).map((t: any) => ({
    ...t,
    createdBy: t.users?.username
  }));

  res.json({ budget, transactions: formattedTxs });
});

// --- MINISTERS API ---

app.post("/api/ministers/assign", authenticate, async (req: any, res) => {
  const leader = req.user;
  const { userId, role, iso2: rawIso2 } = req.body;
  const iso2 = rawIso2?.toUpperCase().replace('NATION_', '');

  if (!userId || !role || !iso2) return res.status(400).json({ error: "Dati mancanti." });

  const { data: region, error: regionError } = await supabase.from('regions').select('ownerUserId, governmentForm').eq('id', iso2).single();
  if (regionError || !region || region.ownerUserId !== leader.id) {
    return res.status(403).json({ error: "Solo il Leader può nominare i ministri." });
  }

  if (role === 'foreign' && (region.governmentForm === 'DICTATORSHIP' || region.governmentForm === 'ONE_PARTY_SYSTEM')) {
    return res.status(403).json({ error: "Questa carica non esiste in questa forma di governo." });
  }

  const { data: existingAsMinister } = await supabase.from('ministers').select('stateId').eq('userId', userId).eq('status', 'ACTIVE').maybeSingle();
  if (existingAsMinister) {
    return res.status(400).json({ error: "L'utente ricopre già una carica ministeriale in un altro Stato." });
  }

  const { data: targetUser } = await supabase.from('users').select('username').eq('id', userId).single();
  if (!targetUser) return res.status(404).json({ error: "Utente non trovato." });

  const title = (role === 'economics' && region.governmentForm === 'DICTATORSHIP') ? "Economic Advisor" : (role === 'economics' ? "Minister of Economics" : "Foreign Minister");

  try {
    // 1. Deactivate old minister
    await supabase.from('ministers').update({ status: 'REVOKED' }).eq('stateId', iso2).eq('role', role);

    // 2. Insert new minister
    await supabase.from('ministers').insert({
      id: Math.random().toString(36).substring(2, 11),
      stateId: iso2,
      userId,
      role,
      title,
      assignedByUserId: leader.id,
      assignedAt: Date.now()
    });

    // 3. Update regions cache
    const updateObj: any = {};
    if (role === 'economics') updateObj.economicAdviserId = userId;
    else updateObj.foreignMinisterId = userId;
    await supabase.from('regions').update(updateObj).eq('id', iso2);

    res.json({ success: true, title });
  } catch (err: any) {
    console.error("Minister assignment error:", err);
    res.status(500).json({ error: "Errore durante l'assegnazione." });
  }
});

app.post("/api/ministers/revoke", authenticate, async (req: any, res) => {
  const leader = req.user;
  const { role, iso2: rawIso2 } = req.body;
  const iso2 = rawIso2?.toUpperCase().replace('NATION_', '');

  const { data: region, error: regionError } = await supabase.from('regions').select('ownerUserId').eq('id', iso2).single();
  if (regionError || !region || region.ownerUserId !== leader.id) {
    return res.status(403).json({ error: "Solo il Leader può revocare i ministri." });
  }

  try {
    await supabase.from('ministers').update({ status: 'REVOKED' }).eq('stateId', iso2).eq('role', role);

    const updateObj: any = {};
    if (role === 'economics') updateObj.economicAdviserId = null;
    else updateObj.foreignMinisterId = null;
    await supabase.from('regions').update(updateObj).eq('id', iso2);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Errore durante la revoca." });
  }
});

app.get("/api/ministers/:iso2", authenticate, async (req: any, res) => {
  const iso2 = (req.params.iso2 || '').toUpperCase().replace('NATION_', '');

  const { data: ministers, error } = await supabase
    .from('ministers')
    .select('*, users(username)')
    .or(`stateId.eq.${iso2},stateId.eq.nation_${iso2}`)
    .eq('status', 'ACTIVE');

  if (error) return res.status(500).json({ error: error.message });

  const wageEconomics = await calculateMinisterWage(iso2, 'economics');
  const wageForeign = await calculateMinisterWage(iso2, 'foreign');

  // Format for backward compatibility if needed (users property to username)
  const formattedMinisters = ministers?.map((m: any) => ({
    ...m,
    username: m.users?.username
  }));

  res.json({ ministers: formattedMinisters, wages: { economics: wageEconomics, foreign: wageForeign } });
});

app.post("/api/ministers/sanctions", authenticate, async (req: any, res) => {
  const user = req.user;
  const { iso2: rawIso2, active, scope } = req.body;
  const iso2 = rawIso2?.toUpperCase().replace('NATION_', '');

  // Check if user is Minister of Economics or Leader
  const { data: region, error: rError } = await supabase
    .from('regions')
    .select('ownerUserId, economicAdviserId')
    .eq('id', iso2)
    .single();

  if (rError || !region) return res.status(404).json({ error: "Regione non trovata." });
  if (region.ownerUserId !== user.id && region.economicAdviserId !== user.id) {
    return res.status(403).json({ error: "Azione riservata al Ministro dell'Economia o al Leader." });
  }

  try {
    const { error } = await supabase
      .from('regions')
      .update({
        sanctionsActive: active ? 1 : 0,
        sanctionsScope: scope || {}
      })
      .eq('id', iso2);

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Errore durante l'aggiornamento delle sanzioni: " + err.message });
  }
});

app.delete("/api/ministers/market-offer/:id", authenticate, async (req: any, res) => {
  const user = req.user;
  const { id } = req.params;

  const { data: offer, error: oError } = await supabase
    .from('market_offers')
    .select('regionId')
    .eq('id', id)
    .single();

  if (oError || !offer) return res.status(404).json({ error: "Offerta non trovata." });

  const { data: region, error: rError } = await supabase
    .from('regions')
    .select('ownerUserId, economicAdviserId')
    .eq('id', offer.regionId)
    .single();

  if (rError || !region || (region.ownerUserId !== user.id && region.economicAdviserId !== user.id)) {
    return res.status(403).json({ error: "Azione riservata al Ministro dell'Economia o al Leader di questo Stato." });
  }

  try {
    const { error: dError } = await supabase
      .from('market_offers')
      .delete()
      .eq('id', id);

    if (dError) throw dError;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Errore durante la rimozione dell'offerta: " + err.message });
  }
});

app.post("/api/actions/apply", authenticate, async (req: any, res) => {
  const user = req.user;
  const { regionId, type } = req.body;

  if (!["residence", "work_permit"].includes(type)) return res.status(400).json({ error: "Tipo di richiesta non valido." });
  if (type === "residence" && user.residenceId === regionId) return res.status(400).json({ error: "Siedi già in questa regione." });
  if (type === "work_permit" && user.workPermitId === regionId) return res.status(400).json({ error: "Hai già un permesso di lavoro qui." });

  const { data: existing } = await supabase
    .from('applications')
    .select('id')
    .eq('userId', user.id)
    .eq('regionId', regionId)
    .eq('type', type)
    .eq('status', 'pending')
    .maybeSingle();

  if (existing) return res.status(400).json({ error: "Hai già inviato una richiesta in attesa di approvazione." });

  const { data: region } = await supabase
    .from('regions')
    .select('ownerUserId')
    .eq('id', regionId)
    .single();

  if (!region) return res.status(404).json({ error: "Regione inesistente." });

  const id = Math.random().toString(36).substring(2, 9);
  const now = new Date().toISOString();

  if (!region.ownerUserId) {
    if (type === 'residence') {
      await supabase.from('users').update({ residenceId: regionId }).eq('id', user.id);
    } else {
      await supabase.from('users').update({ workPermitId: regionId }).eq('id', user.id);
    }
    await supabase.from('applications').insert({
      id, userId: user.id, username: user.username, regionId, type, status: 'accepted', createdAt: now
    });
    return res.json({ success: true, autoAccepted: true });
  }

  await supabase.from('applications').insert({
    id, userId: user.id, username: user.username, regionId, type, status: 'pending', createdAt: now
  });

  res.json({ success: true, autoAccepted: false });
});

app.get("/api/applications/:regionId", authenticate, async (req: any, res) => {
  const { regionId } = req.params;
  const { data: apps, error } = await supabase
    .from('applications')
    .select('*')
    .eq('regionId', regionId)
    .eq('status', 'pending')
    .order('createdAt', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(apps);
});

app.get("/api/leader/orders/:regionId", authenticate, async (req: any, res) => {
  try {
    const { data: orders } = await supabase.from('leader_orders')
      .select('*')
      .eq('regionId', req.params.regionId)
      .order('createdAt', { ascending: false })
      .limit(20);
    res.json(orders || []);
  } catch (err) {
    res.json([]);
  }
});

app.post("/api/actions/resolve-application", authenticate, async (req: any, res) => {
  const user = req.user;
  const { applicationId, action } = req.body; // action = 'accept' | 'reject'

  const { data: application, error: aError } = await supabase
    .from('applications')
    .select('*')
    .eq('id', applicationId)
    .single();

  if (aError || !application) return res.status(404).json({ error: "Richiesta non trovata." });

  const { data: regionInfo, error: rError } = await supabase
    .from('regions')
    .select('leaderUserId, governmentForm')
    .eq('id', application.regionId)
    .single();

  if (rError || !regionInfo) return res.status(404).json({ error: "Regione non trovata." });

  if (regionInfo.leaderUserId !== user.id) {
    return res.status(403).json({ error: "Solo il Leader può approvare residenze o visti." });
  }

  if (action === 'accept') {
    if (application.type === 'residence') {
      await supabase.from('users').update({ residenceId: application.regionId }).eq('id', application.userId);
    } else {
      await supabase.from('users').update({ workPermitId: application.regionId }).eq('id', application.userId);
    }
    await supabase.from('applications').update({ status: 'accepted' }).eq('id', applicationId);
  } else {
    await supabase.from('applications').update({ status: 'rejected' }).eq('id', applicationId);
  }

  res.json({ success: true, action });
});

app.post("/api/actions/toggle-borders", authenticate, async (req: any, res) => {
  const user = req.user;
  const { regionId, state } = req.body;
  const { data: region } = await supabase.from('regions').select('ownerUserId').eq('id', regionId).single();

  if (!region || region.ownerUserId !== user.id) {
    return res.status(403).json({ error: "Non sei il Governatore di questa regione." });
  }

  await supabase.from('regions').update({ workRestrictions: state ? 1 : 0 }).eq('id', regionId);
  res.json({ success: true });
});

// --- Government & Ministers API ---
app.post("/api/government/assign-minister", authenticate, async (req: any, res) => {
  const user = req.user;
  const { regionId, role, ministerId } = req.body;

  if (!regionId || !role) return res.status(400).json({ error: "Missing parameters." });
  if (role !== "economicAdviserId" && role !== "foreignMinisterId") return res.status(400).json({ error: "Invalid role." });

  const { data: region } = await supabase.from('regions').select('leaderUserId, governmentForm').eq('id', regionId).single();
  if (!region) return res.status(404).json({ error: "Region not found." });
  if (region.leaderUserId !== user.id) return res.status(403).json({ error: "Solo il Leader può assegnare i ministri." });

  const autocracies = ["DICTATORSHIP", "ONE_PARTY_SYSTEM", "EXECUTIVE_MONARCHY"];
  if (role === "foreignMinisterId" && autocracies.includes(region.governmentForm)) {
    return res.status(400).json({ error: "Questa forma di governo non prevede un Ministro degli Esteri." });
  }

  if (ministerId) {
    const { data: targetUser } = await supabase.from('users').select('id').eq('id', ministerId).single();
    if (!targetUser) return res.status(404).json({ error: "Utente non trovato." });
  }

  const updateData: any = {};
  updateData[role] = ministerId || null;
  await supabase.from('regions').update(updateData).eq('id', regionId);

  res.json({ success: true, role, ministerId });
});

app.post("/api/government/transition", authenticate, async (req: any, res) => {
  const user = req.user;
  const { regionId, targetForm } = req.body;

  if (!regionId || !targetForm) return res.status(400).json({ error: "Missing parameters." });

  const { data: region } = await supabase.from('regions').select('leaderUserId, governmentForm').eq('id', regionId).single();
  if (!region) return res.status(404).json({ error: "Region not found." });
  if (region.leaderUserId && region.leaderUserId !== user.id) {
    return res.status(403).json({ error: "Azione riservata al Leader dello Stato." });
  }

  const currentForm = region.governmentForm;
  const allowedTransitions = [
    { from: "DICTATORSHIP", to: "ONE_PARTY_SYSTEM" },
    { from: "DICTATORSHIP", to: "EXECUTIVE_MONARCHY" },
    { from: "ONE_PARTY_SYSTEM", to: "DICTATORSHIP" },
    { from: "EXECUTIVE_MONARCHY", to: "DICTATORSHIP" },
    { from: "DICTATORSHIP", to: "PRESIDENTIAL_REPUBLIC" },
  ];

  const isValid = allowedTransitions.some(t => t.from === currentForm && t.to === targetForm);
  if (!isValid) {
    return res.status(400).json({ error: `Transizione diretta da ${currentForm} a ${targetForm} non consentita.` });
  }

  const updateData: any = { governmentForm: targetForm };
  if (targetForm === 'PARLIAMENTARY_REPUBLIC') {
    updateData.leaderUserId = null;
    updateData.leaderTitle = 'None';
    updateData.nextLeaderElectionAt = null;
  } else if (['DICTATORSHIP', 'ONE_PARTY_SYSTEM', 'EXECUTIVE_MONARCHY'].includes(targetForm)) {
    updateData.leaderUserId = user.id;
    updateData.leaderTitle = targetForm === 'EXECUTIVE_MONARCHY' ? 'Sovrano' : 'Dittatore';
    updateData.nextLeaderElectionAt = null;
  } else if (['PRESIDENTIAL_REPUBLIC', 'DOMINANT_PARTY'].includes(targetForm)) {
    updateData.leaderTitle = 'Leader';
    updateData.nextLeaderElectionAt = new Date(Date.now() + (5 * 24 * 60 * 60 * 1000)).toISOString();
  }

  await supabase.from('regions').update(updateData).eq('id', regionId);
  return res.json({ success: true, newForm: targetForm });
});

// --- Leader System Specific API ---

app.post("/api/leader/candidate", authenticate, async (req: any, res) => {
  const user = req.user;
  const { regionId } = req.body;

  const { data: region } = await supabase.from('regions').select('governmentForm').eq('id', regionId).single();
  if (!region) return res.status(404).json({ error: "Regione non trovata." });
  if (!['PRESIDENTIAL_REPUBLIC', 'DOMINANT_PARTY'].includes(region.governmentForm)) {
    return res.status(400).json({ error: "Questa forma di governo non prevede elezioni del Leader." });
  }

  if (user.residenceId !== regionId) {
    return res.status(403).json({ error: "Devi essere cittadino per candidarti." });
  }

  const { error } = await supabase.from('leader_candidates').insert({ regionId, userId: user.id, votes: 0 });
  if (error) return res.status(400).json({ error: "Sei già candidato." });
  res.json({ success: true });
});

app.post("/api/leader/vote", authenticate, async (req: any, res) => {
  const user = req.user;
  const { regionId, candidateId } = req.body;

  if (user.residenceId !== regionId) return res.status(403).json({ error: "Devi essere cittadino per votare." });

  // Use a transaction or just two inserts? Supabase doesn't easily do transactions via JS without RPC.
  // But we can use an RPC for atomic voting if needed.
  // For now, simpler:
  const { error } = await supabase.from('leader_votes').insert({ regionId, voterId: user.id, candidateId });
  if (error) return res.status(400).json({ error: "Hai già votato o regione non valida." });

  await supabase.rpc('increment_candidate_votes', { p_region_id: regionId, p_candidate_id: candidateId });
  res.json({ success: true });
});

app.post("/api/leader/update-state-ui", authenticate, async (req: any, res) => {
  const user = req.user;
  const { regionId, stateColor, stateHymn } = req.body;

  const { data: region } = await supabase.from('regions').select('leaderUserId').eq('id', regionId).single();
  if (!region || region.leaderUserId !== user.id) return res.status(403).json({ error: "Solo il Leader può modificare queste impostazioni." });

  await supabase.from('regions').update({
    stateColor: stateColor || '#334155',
    stateHymn: stateHymn || ''
  }).eq('id', regionId);

  res.json({ success: true });
});

// (Orphaned broken orders block removed, replaced by /api/ministers/orders above)
// Leader Orders API
app.get("/api/ministers/orders", authenticate, async (req: any, res) => {
  const { data: regions } = await supabase.from('regions').select('id').eq('leaderUserId', req.user.id);
  if (!regions || regions.length === 0) return res.status(403).json({ error: "Non sei un leader." });

  const regionIds = regions.map(r => r.id);
  const { data: orders } = await supabase.from('leader_orders')
    .select('*')
    .in('regionId', regionIds)
    .order('createdAt', { ascending: false })
    .limit(20);

  res.json(orders || []);
});

app.post("/api/ministers/orders", authenticate, async (req: any, res) => {
  const { regionId, title, content } = req.body;
  if (!regionId || !title || !content) return res.status(400).json({ error: "Dati mancanti." });

  const { data: region } = await supabase.from('regions').select('leaderUserId').eq('id', regionId).single();
  if (!region || region.leaderUserId !== req.user.id) return res.status(403).json({ error: "Non sei il leader di questa regione." });

  await supabase.from('leader_orders').insert({
    regionId,
    leaderId: req.user.id,
    title,
    content,
    createdAt: new Date().toISOString()
  });

  res.json({ success: true });
});

// --- Nation Management API ---

app.post("/api/actions/change-displayed-nation", authenticate, async (req: any, res) => {
  const user = req.user;
  const { nationId } = req.body;
  if (!nationId) return res.status(400).json({ error: "Nessuna nazione specificata." });

  await supabase.from('users').update({ displayedNation: nationId }).eq('id', user.id);
  res.json({ success: true, displayedNation: nationId });
});

app.post("/api/actions/change-original-nation", authenticate, async (req: any, res) => {
  const user = req.user;
  const { nationId } = req.body;
  if (!nationId) return res.status(400).json({ error: "Nessuna nazione specificata." });

  const now = Date.now();
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  if (now - (user.lastOriginalNationChange || 0) < THIRTY_DAYS && user.lastOriginalNationChange !== 0) {
    const nextAvail = new Date(user.lastOriginalNationChange + THIRTY_DAYS).toLocaleDateString();
    return res.status(400).json({ error: `Puoi cambiare di nuovo la Nazione Originale il ${nextAvail}.` });
  }

  await supabase.from('users').update({
    originalNation: nationId,
    lastOriginalNationChange: now
  }).eq('id', user.id);

  res.json({ success: true, originalNation: nationId, lastOriginalNationChange: now });
});

app.post("/api/actions/attack", authenticate, async (req: any, res) => {
  const user = req.user;
  const { regionId } = req.body;

  const perks = await getUserPerks(user.id);

  // RESISTENZA reduces energy in war too (same formula as work, capped at lv50)
  const resistenza = perks['RESISTENZA'] || 0;
  const energyReduction = Math.min(0.5, resistenza / 100);
  const energyCost = Math.ceil(GAME_CONFIG.ATTACK_ENERGY_COST * (1 - energyReduction));

  let finalEnergyCost = energyCost;
  let usedMedal = false;

  if (user.warMedals > 0) {
    finalEnergyCost = 0;
    usedMedal = true;
  } else {
    if (user.energy < finalEnergyCost) return res.status(400).json({ error: "Not enough energy" });
  }

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
  const { data: attackerBloc } = await supabase.from('bloc_memberships').select('blocId').eq('stateId', user.regionId).eq('status', 'active').maybeSingle();
  const { data: defenderBloc } = await supabase.from('bloc_memberships').select('blocId').eq('stateId', regionId).eq('status', 'active').maybeSingle();

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

  const winProbability = Math.min(0.9, 0.3 + (user.influence / 1000) + totalDmgBonus + alphaBonus);
  const success = Math.random() < winProbability;

  if (usedMedal) {
    await supabase.from('users').update({ warMedals: user.warMedals - 1 }).eq('id', user.id);
  } else {
    await supabase.from('users').update({ energy: user.energy - finalEnergyCost }).eq('id', user.id);
  }

  if (success) {
    await supabase.from('regions').update({
      ownerUserId: user.id,
      stability: Math.max(0, (region.stability || 100) - 20)
    }).eq('id', regionId);

    const warId = Math.random().toString(36).substring(2, 9);
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

    await supabase.rpc('add_user_xp', { p_user_id: user.id, p_amount: GAME_CONFIG.XP_PER_ATTACK });
  } else {
    await supabase.rpc('add_user_xp', { p_user_id: user.id, p_amount: Math.floor(GAME_CONFIG.XP_PER_ATTACK / 2) });
  }

  await supabase.from('cooldowns').upsert({
    user_id: user.id,
    action_type: 'attack',
    last_used: new Date().toISOString()
  });

  res.json({ success, winProbability: Math.round(winProbability * 100) });
});

// --- War Interactive Deploy API ---
app.post("/api/wars/deploy", authenticate, async (req: any, res) => {
  const user = req.user;
  const { warId, side, weaponId } = req.body;

  if (!warId || !side || !weaponId) return res.status(400).json({ error: "Dati mancanti." });
  if (side !== 'attacker' && side !== 'defender') return res.status(400).json({ error: "Schieramento non valido." });

  const { data: war } = await supabase.from('wars').select('*').eq('id', warId).single();
  if (!war) return res.status(404).json({ error: "Guerra inesistente." });
  if (war.status !== 'active') return res.status(400).json({ error: "Questa guerra è già terminata." });

  const weapons: any = {
    infantry: { energy: 10, cash: 50, damage: 100 },
    tank: { energy: 30, cash: 500, damage: 1000 },
    airstrike: { energy: 50, cash: 2000, damage: 5000 }
  };

  const weapon = weapons[weaponId];
  if (!weapon) return res.status(400).json({ error: "Armamento sconosciuto." });

  if (user.energy < weapon.energy) return res.status(400).json({ error: `Energia insufficiente (richiesti ${weapon.energy}).` });
  if (user.money < weapon.cash) return res.status(400).json({ error: `Fondi insufficienti (richiesti $${weapon.cash}).` });

  // Damage Calculation
  let totalDamage = weapon.damage;
  const isPatriot = (side === 'attacker' && war.attackerCountryIso2 === user.originalNation) ||
    (side === 'defender' && war.defenderCountryIso2 === user.originalNation);

  if (isPatriot) totalDamage = Math.floor(totalDamage * 1.10);

  const perks = await getUserPerks(user.id);
  const forzaBonus = (perks['FORZA'] || 0) * 0.05;
  const resistBonus = (perks['RESISTENZA'] || 0) * 0.03;
  totalDamage = Math.floor(totalDamage * (1 + forzaBonus + resistBonus));

  try {
    // Deduct resources
    await supabase.from('users').update({
      energy: user.energy - weapon.energy,
      money: user.money - weapon.cash
    }).eq('id', user.id);

    // Update scores
    if (side === 'attacker') {
      await supabase.from('wars').update({ attackerScore: (war.attackerScore || 0) + totalDamage }).eq('id', warId);
    } else {
      await supabase.from('wars').update({ defenderScore: (war.defenderScore || 0) + totalDamage }).eq('id', warId);
    }

    res.json({ success: true, damageDealt: totalDamage, side });
  } catch (err) {
    res.status(500).json({ error: "Errore durante lo schieramento in battaglia." });
  }
});

// Articles API
app.get("/api/articles", authenticate, async (req, res) => {
  const { data: articles, error } = await supabase.from('articles').select('*').order('createdAt', { ascending: false }).limit(50);
  if (error) {
    console.error("Articles fetch error:", error);
    return res.json([]);
  }
  res.json(articles || []);
});

app.get("/api/articles/:id", authenticate, async (req, res) => {
  const { data: article } = await supabase.from('articles').select('*').eq('id', req.params.id).single();
  if (!article) return res.status(404).json({ error: "Article not found" });
  res.json(article);
});

app.post("/api/articles", authenticate, async (req: any, res) => {
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: "Title and content required" });

  // Rate limit: max 5 per hour
  const oneHourAgo = new Date(Date.now() - (60 * 60 * 1000)).toISOString();
  const { count } = await supabase.from('articles')
    .select('id', { count: 'exact', head: true })
    .eq('authorId', req.user.id)
    .gt('createdAt', oneHourAgo);

  if (count && count >= 5) return res.status(429).json({ error: "Rate limit exceeded (max 5 articles per hour)" });

  const id = Math.random().toString(36).substring(2, 9);
  const now = new Date().toISOString();
  const { error: insertError } = await supabase.from('articles').insert({
    id,
    authorId: req.user.id,
    authorName: req.user.username,
    title,
    content,
    createdAt: now,
    updatedAt: now
  });

  if (insertError) {
    console.error("Article insert error:", insertError);
    return res.status(500).json({ error: "Errore nella creazione dell'articolo." });
  }

  res.json({ success: true, id });
});

app.put("/api/articles/:id", authenticate, async (req: any, res) => {
  const { title, content } = req.body;
  const { data: article } = await supabase.from('articles').select('authorId').eq('id', req.params.id).single();
  if (!article) return res.status(404).json({ error: "Article not found" });
  if (article.authorId !== req.user.id) return res.status(403).json({ error: "Forbidden" });

  await supabase.from('articles').update({
    title,
    content,
    updatedAt: new Date().toISOString()
  }).eq('id', req.params.id);

  res.json({ success: true });
});

app.delete("/api/articles/:id", authenticate, async (req: any, res) => {
  const { data: article } = await supabase.from('articles').select('authorId').eq('id', req.params.id).single();
  if (!article) return res.status(404).json({ error: "Article not found" });
  if (article.authorId !== req.user.id) return res.status(403).json({ error: "Forbidden" });

  await supabase.from('articles').delete().eq('id', req.params.id);
  res.json({ success: true });
});

// Chat API
app.get("/api/chat", authenticate, async (req, res) => {
  const { data: messages, error } = await supabase.from('chat_messages')
    .select('id, userId, username, regionId, message, createdAt')
    .order('createdAt', { ascending: false })
    .limit(50);

  if (error) {
    console.error("Chat fetch error:", error);
    return res.json([]);
  }

  res.json(messages ? messages.reverse() : []); // oldest first for display
});

app.post("/api/chat", authenticate, async (req: any, res) => {
  const { message } = req.body;
  const user = req.user;
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({ error: "Messaggio vuoto" });
  }
  if (message.trim().length > 280) {
    return res.status(400).json({ error: "Messaggio troppo lungo (max 280 caratteri)" });
  }

  // Rate limit: 1 message per 5 seconds
  const { data: lastMsg } = await supabase.from('chat_messages')
    .select('createdAt')
    .eq('userId', user.id)
    .order('createdAt', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastMsg && Date.now() - new Date(lastMsg.createdAt).getTime() < 5000) {
    return res.status(429).json({ error: "Aspetta qualche secondo prima di inviare un altro messaggio" });
  }

  const { error: insertError } = await supabase.from('chat_messages').insert({
    userId: user.id,
    username: user.username,
    regionId: user.regionId || "?",
    message: message.trim(),
    createdAt: new Date().toISOString()
  });

  if (insertError) {
    console.error("Chat insert error:", insertError);
    return res.status(500).json({ error: "Errore nell'invio del messaggio." });
  }

  res.json({ success: true });
});

// Profile Avatar
app.post("/api/profile/avatar", authenticate, async (req: any, res) => {
  const { avatarData } = req.body;
  if (!avatarData || typeof avatarData !== "string") {
    return res.status(400).json({ error: "Dati immagine mancanti" });
  }
  // Must be a valid base64 data URL (jpeg or png only)
  if (!avatarData.startsWith("data:image/")) {
    return res.status(400).json({ error: "Formato immagine non valido" });
  }
  // Limit: ~512KB base64
  if (avatarData.length > 700000) {
    return res.status(400).json({ error: "Immagine troppo grande (max ~512KB)" });
  }
  await supabase.from('users').update({ avatarData }).eq('id', req.user.id);
  res.json({ success: true });
});

// Dev: Add currency (use for testing)
app.post("/api/dev/add-currency", authenticate, async (req: any, res) => {
  const { cash = 10000, gold = 10000 } = req.body;
  const { data: user } = await supabase.from('users').select('money, gold').eq('id', req.user.id).single();
  if (user) {
    await supabase.from('users').update({
      money: (user.money || 0) + Number(cash),
      gold: (user.gold || 0) + Number(gold)
    }).eq('id', req.user.id);
  }
  res.json({ success: true, cash, gold });
});

// ==========================================
// PLAYER-DRIVEN FACTORIES API
// ==========================================

// (Orphaned legacy code removed)


// Change username
app.put("/api/profile/username", authenticate, async (req: any, res) => {
  const { username } = req.body;
  if (!username || typeof username !== "string") return res.status(400).json({ error: "Username mancante" });
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 20) return res.status(400).json({ error: "Username deve essere tra 3 e 20 caratteri" });
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) return res.status(400).json({ error: "Solo lettere, numeri e underscore" });

  try {
    const { error: uError } = await supabase.from('users').update({ username: trimmed }).eq('id', req.user.id);
    if (uError) throw uError;

    // Also update authorName in articles (if articles table exists in Supabase)
    await supabase.from('articles').update({ authorName: trimmed }).eq('authorId', req.user.id);

    res.json({ success: true, username: trimmed });
  } catch (e: any) {
    if (e.message?.includes("duplicate")) return res.status(409).json({ error: "Username già in uso" });
    res.status(500).json({ error: "Errore interno: " + e.message });
  }
});

app.post("/api/work", authenticate, async (req: any, res) => {
  const user = req.user;
  const userRegion = user.regionId || 'IT';
  const { factoryId } = req.body;

  const { data: factory } = await supabase.from('factories').select('*').eq('id', factoryId).single();
  if (!factory) return res.status(404).json({ error: "Fabbrica non trovata." });

  // Require player to be in the same region physically
  if (factory.regionId !== userRegion) return res.status(400).json({ error: "Devi viaggiare in questa regione per lavorare qui." });

  // Controllo immigrazione
  const { data: currentRegion } = await supabase.from('regions').select('*').eq('id', factory.regionId).single();
  const restrictionsActive = currentRegion?.workRestrictions === 1;
  const isResident = user.residenceId === factory.regionId;
  const { data: hasWorkPermit } = await supabase.from('work_permits')
    .select('id')
    .eq('userId', user.id)
    .eq('regionId', factory.regionId)
    .maybeSingle();

  if (restrictionsActive && !isResident && !hasWorkPermit && user.id !== factory.ownerUserId) {
    return res.status(403).json({ error: "Questa regione richiede un Permesso di Lavoro." });
  }

  // Cooldown
  const { data: lastWork } = await supabase.from('user_factory_cooldowns')
    .select('lastUsed')
    .eq('userId', user.id)
    .eq('factoryId', factoryId)
    .maybeSingle();

  // Base cooldown: 10 minutes (600s)
  if (lastWork && Date.now() - new Date(lastWork.lastUsed).getTime() < 600 * 1000) {
    return res.status(400).json({ error: "Fabbrica in cooldown (10 min)." });
  }

  // Energy
  const perks = await getUserPerks(user.id);
  const energyEfficiency = (perks['RESISTENZA'] || 0) * 0.005;
  const energyCost = Math.ceil(10 * (1 - energyEfficiency)); // Base 10 energy
  if (user.energy < energyCost) return res.status(400).json({ error: "Energia insufficiente." });

  // Check budget
  if (factory.budget < factory.wage) {
    return res.status(400).json({ error: "L'azienda non ha abbastanza fondi per pagarti il salario." });
  }

  // Check Owner Storage Space
  const { data: owner } = await supabase.from('users').select('id').eq('id', factory.ownerUserId).single();
  if (!owner) return res.status(404).json({ error: "Proprietario inesistente." });

  const { data: ownerInv } = await supabase.from('user_inventory').select('quantity').eq('userId', owner.id);
  const ownerVol = (ownerInv || []).reduce((sum: number, item: any) => sum + item.quantity, 0);

  const ownerPerks = await getUserPerks(owner.id);
  const ownerResistenza = ownerPerks['RESISTENZA'] || 0;

  const maxStorage = Math.floor(GAME_CONFIG.STORAGE_BASE_CAPACITY * (1 + (ownerResistenza * 0.01)));

  // Calculate Output Amount
  let outputBase = factory.level * 2;
  let bonusMult = 1.0;
  if (factory.type === 'oil') bonusMult = currentRegion.oilBonus || 1.0;
  else if (factory.type === 'minerals') bonusMult = currentRegion.mineralsBonus || 1.0;
  else if (factory.type === 'uranium') bonusMult = currentRegion.uraniumBonus || 1.0;
  else if (factory.type === 'diamonds') bonusMult = currentRegion.diamondsBonus || 1.0;

  const finalOutput = Math.max(1, Math.floor(outputBase * bonusMult));

  // PRESIDENTIAL_REPUBLIC: Double wage bonus for Leader and economic/foreign ministers
  let govBonus = 1;
  if (currentRegion && currentRegion.governmentForm === 'PRESIDENTIAL_REPUBLIC') {
    if (user.id === currentRegion.ownerUserId || user.id === currentRegion.economicAdviserId || user.id === currentRegion.foreignMinisterId) {
      govBonus = 2;
    }
  }

  const finalWage = Math.floor(factory.wage * govBonus);

  if (factory.budget < finalWage) {
    return res.status(400).json({ error: "L'azienda non ha abbastanza fondi per pagarti il salario." });
  }

  if (ownerVol + finalOutput > maxStorage) {
    return res.status(400).json({ error: "Il magazzino dell'azienda è pieno." });
  }

  // EXECUTE WORK
  try {
    await supabase.rpc('execute_factory_work', {
      p_user_id: user.id,
      p_factory_id: factoryId,
      p_wage: finalWage,
      p_output_item: factory.type,
      p_output_qty: finalOutput,
      p_energy_cost: energyCost,
      p_owner_id: owner.id
    });

    res.json({ success: true, wage: finalWage, output: finalOutput });
  } catch (err: any) {
    res.status(500).json({ error: "Errore durante il lavoro: " + err.message });
  }
});

// Wars API
app.get("/api/wars", authenticate, async (req: any, res) => {
  const { data: active } = await supabase.from('wars').select('*').eq('status', 'active').order('startedAt', { ascending: false });
  const { data: ended } = await supabase.from('wars').select('*').eq('status', 'ended').order('endsAt', { ascending: false }).limit(20);
  res.json({ active: active || [], ended: ended || [] });
});

app.get("/api/wars/:id", authenticate, async (req: any, res) => {
  const { data: war } = await supabase.from('wars').select('*').eq('id', req.params.id).single();
  if (!war) return res.status(404).json({ error: "War not found" });
  res.json(war);
});

app.post("/api/perks/upgrade", authenticate, async (req: any, res) => {
  const user = req.user;
  const { perkId, useGold } = req.body;

  const perkDef = PERKS_DEFS.find(p => p.id === perkId);
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
    return res.status(400).json({ error: `Gold insufficiente. Servono 🏅 ${goldCost}` });
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
  if (useGold) {
    updateData.money = (user.money || 0) - cashCost;
    updateData.gold = (user.gold || 0) - goldCost;
  } else {
    updateData.money = (user.money || 0) - cashCost;
  }

  await supabase.from('users').update(updateData).eq('id', user.id);

  return res.json({ success: true, queued: true, willCompleteAt, timeSec });
});

app.post("/api/perks/booster", authenticate, async (req: any, res) => {
  const user = req.user;
  const { perkId, useGold } = req.body;

  const perkDef = PERKS_DEFS.find(p => p.id === perkId);
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
    if (user.gold < price) return res.status(400).json({ error: `Oro insufficiente. Servono 🏅 ${price} Gold.` });
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
  if (useGold) {
    updateData.gold = (user.gold || 0) - price;
  } else {
    updateData.money = (user.money || 0) - price;
  }

  await supabase.from('users').update(updateData).eq('id', user.id);

  return res.json({
    success: true,
    expiresAt,
    duration,
    perkId
  });
});

// ==============================================================
// SANCTIONS SYSTEM
// ==============================================================

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

app.get("/api/countries/:iso2/sanctions", authenticate, async (req: any, res) => {
  const stateId = (req.params.iso2 || '').toUpperCase();
  const normalizedId = stateId.replace('NATION_', '').replace('nation_', '');

  const { data: sanctions } = await supabase
    .from('sanctions')
    .select('*, regions!targetStateId(name)')
    .eq('fromStateId', normalizedId)
    .eq('status', 'ACTIVE');

  res.json(sanctions || []);
});

app.post("/api/sanctions/apply", authenticate, async (req: any, res) => {
  const user = req.user;
  const { targetStateId: rawTarget, fromStateId: rawFrom } = req.body;
  const targetStateId = rawTarget?.toUpperCase().replace('NATION_', '').replace('nation_', '');
  const finalFromStateId = (rawFrom || user.regionId)?.toUpperCase().replace('NATION_', '').replace('nation_', '');

  const { data: region } = await supabase.from('regions').select('ownerUserId, economicAdviserId').eq('id', finalFromStateId).single();
  if (!region) return res.status(404).json({ error: "Regione non trovata." });

  const isLeader = region.ownerUserId === user.id;
  const { data: minister } = await supabase.from('ministers')
    .select('id')
    .eq('stateId', finalFromStateId)
    .eq('userId', user.id)
    .eq('role', 'economics')
    .eq('status', 'ACTIVE')
    .single();

  if (!isLeader && !minister) return res.status(403).json({ error: "Autorizzazione insufficiente." });

  await supabase.from('sanctions').insert({
    id: Math.random().toString(36).substring(2, 11),
    fromStateId: finalFromStateId,
    targetStateId,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    createdByUserId: user.id
  });

  res.json({ success: true });
});

app.post("/api/sanctions/revoke", authenticate, async (req: any, res) => {
  const user = req.user;
  const { sanctionId } = req.body;

  const { data: sanction } = await supabase.from('sanctions').select('*').eq('id', sanctionId).single();
  if (!sanction) return res.status(404).json({ error: "Sanzione non trovata." });

  await supabase.from('sanctions').update({
    status: 'REVOKED',
    revokedAt: new Date().toISOString(),
    revokedByUserId: user.id
  }).eq('id', sanctionId);

  res.json({ success: true });
});

// ==============================================================
// MARKET API (Player-Driven)
// ==============================================================

// Get state inventory (budget resources) for the leader's state
app.get("/api/market/state-inventory", authenticate, async (req: any, res) => {
  const user = req.user;
  try {
    // Find region where user is leader/owner
    const { data: region } = await supabase
      .from('regions')
      .select('id')
      .eq('ownerUserId', user.id)
      .maybeSingle();

    if (!region) return res.json({ resources: {}, moneyEUR: 0 });

    const { data: budget } = await supabase
      .from('budgets')
      .select('moneyEUR, resources')
      .eq('ownerType', 'REGION')
      .eq('ownerId', region.id)
      .maybeSingle();

    res.json(budget || { resources: {}, moneyEUR: 0 });
  } catch (err) {
    res.status(500).json({ error: "Errore nel caricamento dell'inventario statale." });
  }
});

app.get("/api/market/offers", authenticate, async (req: any, res) => {
  try {
    const { data: offers } = await supabase
      .from('market_offers')
      .select('*, minPrice:itemId(id)') // Simplified placeholder for minPrice logic if needed
      .order('createdAt', { ascending: false })
      .limit(100);

    res.json(offers);
  } catch (err) {
    res.status(500).json({ error: "Errore nel caricamento del mercato." });
  }
});

app.post("/api/market/offer", authenticate, async (req: any, res) => {
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
    await supabase.rpc('create_market_offer', {
      p_user_id: user.id,
      p_item_id: itemId,
      p_quantity: quantity,
      p_price: price,
      p_region_id: user.regionId,
      p_tax_rate: taxRate,
      p_origin_state_id: user.originalNation || user.regionId
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error("Market offer error:", err);
    res.status(500).json({ error: "Errore durante la creazione dell'offerta." });
  }
});

app.post("/api/market/buy", authenticate, async (req: any, res) => {
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
});

// ==============================================================
// WEAPON PRODUCTION API (SQLite)
// ==============================================================
const WEAPONS_DEF: Record<string, { timeMin: number, costCash: number, power: number, reqOil?: number, reqMinerals?: number, reqUranium?: number, reqDiamonds?: number }> = {
  rifle: { timeMin: 1, costCash: 100, power: 2, reqMinerals: 2 },
  drone: { timeMin: 8, costCash: 800, power: 20, reqMinerals: 10, reqOil: 5 },
  artillery: { timeMin: 5, costCash: 500, power: 12, reqMinerals: 15, reqOil: 2 },
  tank: { timeMin: 15, costCash: 1500, power: 40, reqMinerals: 30, reqOil: 15, reqUranium: 1 },
  missile: { timeMin: 30, costCash: 5000, power: 150, reqMinerals: 50, reqOil: 40, reqUranium: 10, reqDiamonds: 2 },
};

app.post("/api/produce", authenticate, async (req: any, res) => {
  const user = req.user;
  const { weaponType, qty } = req.body;

  const weapon = WEAPONS_DEF[weaponType];
  if (!weapon) return res.status(400).json({ error: "Tipo di arma non valido" });

  const amount = Math.max(1, parseInt(qty) || 1);
  const totalCost = weapon.costCash * amount;

  // Refetch user money/inventory to be sure
  const { data: userData } = await supabase.from('users').select('money').eq('id', user.id).single();
  if (userData && userData.money < totalCost) {
    return res.status(400).json({ error: `Fondi insufficienti. Costo totale: $${totalCost.toLocaleString()}` });
  }

  const { data: inv } = await supabase.from('user_inventory').select('*').eq('userId', user.id);
  const inventoryMap = new Map((inv || []).map(i => [i.itemId, i.quantity]));

  // Check required resources
  const reqOil = (weapon.reqOil || 0) * amount;
  const reqMinerals = (weapon.reqMinerals || 0) * amount;
  const reqUranium = (weapon.reqUranium || 0) * amount;
  const reqDiamonds = (weapon.reqDiamonds || 0) * amount;

  if (
    (inventoryMap.get('oil') || 0) < reqOil ||
    (inventoryMap.get('minerals') || 0) < reqMinerals ||
    (inventoryMap.get('uranium') || 0) < reqUranium ||
    (inventoryMap.get('diamonds') || 0) < reqDiamonds
  ) {
    return res.status(400).json({ error: "Non hai abbastanza risorse nel Magazzino Privato per produrre queste armi." });
  }

  // Calculate required vs freed space
  const currentVol = (inv || []).reduce((sum: number, item: any) => sum + item.quantity, 0);
  const spaceFreed = reqOil + reqMinerals + reqUranium + reqDiamonds;
  const spaceConsumed = amount;

  const perks = await getUserPerks(user.id);
  const resistanceLv = perks['RESISTENZA'] || 0;
  const maxStorage = Math.floor(GAME_CONFIG.STORAGE_BASE_CAPACITY * (1 + (resistanceLv * 0.01)));

  if (currentVol - spaceFreed + spaceConsumed > maxStorage) {
    return res.status(400).json({ error: `Spazio nel Magazzino Privato insufficiente.` });
  }

  try {
    const now = Date.now();
    let startOffset = 0;

    const { data: lastQueueItem } = await supabase
      .from('production_queue')
      .select('willCompleteAt')
      .eq('userId', user.id)
      .in('status', ['queued', 'producing'])
      .order('willCompleteAt', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastQueueItem) {
      const lastComplete = new Date(lastQueueItem.willCompleteAt).getTime();
      if (lastComplete > now) startOffset = lastComplete - now;
    }

    const startedAt = now + startOffset;
    const willCompleteAt = startedAt + weapon.timeMin * 60 * 1000 * amount;
    const prodId = Math.random().toString(36).substring(2, 11);

    // Atomicity: We should really use a transaction but for simplicity we'll do sequential calls
    // In production, an RPC is better.
    await supabase.from('production_queue').insert({
      id: prodId,
      userId: user.id,
      weaponType,
      qty: amount,
      status: 'queued',
      startedAt: new Date(startedAt).toISOString(),
      willCompleteAt: new Date(willCompleteAt).toISOString(),
      createdAt: new Date(now).toISOString()
    });

    await supabase.from('users').update({ money: (userData?.money || 0) - totalCost }).eq('id', user.id);

    // Deduct resources
    const resourceUpdates = [];
    if (reqOil > 0) resourceUpdates.push(supabase.from('user_inventory').update({ quantity: (inventoryMap.get('oil') || 0) - reqOil }).eq('userId', user.id).eq('itemId', 'oil'));
    if (reqMinerals > 0) resourceUpdates.push(supabase.from('user_inventory').update({ quantity: (inventoryMap.get('minerals') || 0) - reqMinerals }).eq('userId', user.id).eq('itemId', 'minerals'));
    if (reqUranium > 0) resourceUpdates.push(supabase.from('user_inventory').update({ quantity: (inventoryMap.get('uranium') || 0) - reqUranium }).eq('userId', user.id).eq('itemId', 'uranium'));
    if (reqDiamonds > 0) resourceUpdates.push(supabase.from('user_inventory').update({ quantity: (inventoryMap.get('diamonds') || 0) - reqDiamonds }).eq('userId', user.id).eq('itemId', 'diamonds'));

    await Promise.all(resourceUpdates);

    // Cleanup zero quantity items
    await supabase.from('user_inventory').delete().eq('userId', user.id).lte('quantity', 0);

    res.json({ success: true, totalCost });
  } catch (err: any) {
    console.error("Produce error:", err);
    res.status(500).json({ error: "Errore nella produzione: " + err.message });
  }
});

app.get("/api/produce/list", authenticate, async (req: any, res) => {
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
  const items = (queue || []).map(d => {
    const isReady = new Date(d.willCompleteAt).getTime() <= now && d.status !== "claimed";
    return {
      ...d,
      status: isReady ? "ready" : d.status,
    };
  });
  res.json(items);
});

app.post("/api/produce/claim", authenticate, async (req: any, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "ID richiesto" });

  const { data: d } = await supabase.from('production_queue').select('*').eq('id', id).eq('userId', req.user.id).single();
  if (!d) return res.status(404).json({ error: "Item non trovato" });
  if (d.status === "claimed") return res.status(400).json({ error: "Già ritirato" });
  if (new Date(d.willCompleteAt).getTime() > Date.now()) return res.status(400).json({ error: "Produzione in corso" });

  await supabase.from('production_queue').update({ status: 'claimed' }).eq('id', id);

  const { data: inv } = await supabase.from('user_inventory').select('quantity').eq('userId', req.user.id).eq('itemId', d.weaponType).single();
  if (inv) {
    await supabase.from('user_inventory').update({ quantity: (inv.quantity || 0) + (d.qty || 1) }).eq('userId', req.user.id).eq('itemId', d.weaponType);
  } else {
    await supabase.from('user_inventory').insert({ userId: req.user.id, itemId: d.weaponType, quantity: d.qty || 1 });
  }

  res.json({ success: true });
});

// --- Nation Management API ---
app.get("/api/nations/:id", authenticate, async (req: any, res) => {
  const { data: nation } = await supabase
    .from('nations')
    .select('*, users!leaderUserId(username)')
    .eq('id', req.params.id)
    .single();

  if (!nation) return res.status(404).json({ error: "Nazione non trovata." });

  const { data: regions } = await supabase.from('regions').select('id, name, population, economyLevel').eq('nation_id', nation.id);
  res.json({ ...nation, leaderName: (nation as any).users?.username, regions: regions || [] });
});

app.post("/api/leader/nation/branding", authenticate, async (req: any, res) => {
  const { name, logo, nationId } = req.body;
  if (!name) return res.status(400).json({ error: "Nome nazione obbligatorio." });

  const { data: nation } = await supabase.from('nations').select('*').eq('id', nationId).single();
  if (!nation) return res.status(404).json({ error: "Nazione non trovata." });
  if (nation.leaderUserId !== req.user.id) return res.status(403).json({ error: "Solo il Leader può farlo." });

  await supabase.from('nations').update({ name, logo: logo || '🏛️', updatedAt: new Date().toISOString() }).eq('id', nationId);
  res.json({ success: true });
});

// ==========================================
// POLITICAL PARTIES API (Phase 7)
// ==========================================

app.post("/api/parties/create", authenticate, async (req: any, res) => {
  const user = req.user;
  const { name, ideology, tag, description, logo } = req.body;
  const regionId = user.residenceId || "IT";

  if (!name || name.trim().length === 0) return res.status(400).json({ error: "Nome obbligatorio." });
  if (user.gold < 100) return res.status(400).json({ error: "Fondi in Gold insufficienti (costa 100 Gold)." });

  const { data: existingMember } = await supabase.from('party_members').select('partyId').eq('userId', user.id).maybeSingle();
  if (existingMember) return res.status(400).json({ error: "Sei già membro di un partito." });

  const partyId = Math.random().toString(36).substring(2, 11);
  const now = Date.now();

  try {
    // 1. Create party
    await supabase.from('parties').insert({
      id: partyId,
      name: name.trim(),
      ideology: ideology || "",
      tag: tag || "",
      description: description || "",
      logo: logo || "",
      regionId,
      leaderUserId: user.id,
      createdAt: now
    });

    // 2. Add founder as leader
    await supabase.from('party_members').insert({
      userId: user.id,
      partyId,
      role: 'leader',
      joinedAt: now
    });

    // 3. Deduct gold
    await supabase.from('users').update({ gold: user.gold - 100 }).eq('id', user.id);

    // 4. Log creation
    await supabase.from('party_logs').insert({
      id: Math.random().toString(36).substring(2, 11),
      partyId,
      action: 'created',
      details: `Partito creato da ${user.username} in ${regionId}`,
      timestamp: now
    });

    res.json({ success: true, partyId });
  } catch (err: any) {
    res.status(500).json({ error: "Errore nella creazione del partito: " + err.message });
  }
});

app.put("/api/parties/edit", authenticate, async (req: any, res) => {
  const user = req.user;
  const { partyId, name, ideology, tag, description, logo } = req.body;

  const { data: party } = await supabase.from('parties').select('leaderUserId').eq('id', partyId).single();
  if (!party) return res.status(404).json({ error: "Partito inesistente." });
  if (party.leaderUserId !== user.id) return res.status(403).json({ error: "Solo il leader può modificare le info del partito." });

  if (!name || name.trim().length === 0) return res.status(400).json({ error: "Nome obbligatorio." });

  await supabase.from('parties').update({
    name: name.trim(),
    ideology: ideology || "",
    tag: tag || "",
    description: description || "",
    logo: logo || ""
  }).eq('id', partyId);

  res.json({ success: true });
});

app.get("/api/parties", authenticate, async (req: any, res) => {
  const { data: parties } = await supabase
    .from('parties')
    .select('*, users!leaderUserId(username)')
    .order('createdAt', { ascending: false });

  const partiesWithCounts = await Promise.all((parties || []).map(async (p: any) => {
    const { count } = await supabase.from('party_members').select('*', { count: 'exact', head: true }).eq('partyId', p.id);
    return {
      ...p,
      leaderName: p.users?.username,
      memberCount: count || 0
    };
  }));

  res.json(partiesWithCounts.sort((a, b) => b.memberCount - a.memberCount));
});

app.get("/api/parties/my", authenticate, async (req: any, res) => {
  const { data: membership } = await supabase.from('party_members').select('partyId').eq('userId', req.user.id).maybeSingle();
  if (!membership) return res.status(404).json({ error: "Non sei in nessun partito." });
  res.json({ partyId: membership.partyId }); // Usually better to return JSON than redirect in API
});

app.get("/api/parties/:id", authenticate, async (req: any, res) => {
  const { id } = req.params;
  const { data: party } = await supabase
    .from('parties')
    .select('*, users!leaderUserId(username)')
    .eq('id', id)
    .single();

  if (!party) return res.status(404).json({ error: "Partito non trovato" });

  const { data: members } = await supabase
    .from('party_members')
    .select('*, users!userId(username, level, lastLogin)')
    .eq('partyId', id)
    .order('joinedAt', { ascending: true });

  const mappedMembers = (members || []).map((m: any) => ({
    ...m,
    username: m.users?.username,
    level: m.users?.level,
    lastLogin: m.users?.lastLogin
  }));

  const now = Date.now();
  const activeMembersCount = mappedMembers.filter((m: any) =>
    m.level >= 60 &&
    now - (m.lastLogin || 0) <= 24 * 60 * 60 * 1000 &&
    now - (new Date(m.joinedAt).getTime()) >= 72 * 60 * 60 * 1000
  ).length;

  res.json({
    party: { ...party, leaderName: party.users?.username },
    members: mappedMembers,
    activeMembersCount
  });
});

app.post("/api/parties/roles", authenticate, async (req: any, res) => {
  const user = req.user;
  const { partyId, targetUserId, newRole } = req.body;

  if (!['secretary', 'member'].includes(newRole)) return res.status(400).json({ error: "Ruolo non valido." });

  const { data: party } = await supabase.from('parties').select('leaderUserId').eq('id', partyId).single();
  if (!party || party.leaderUserId !== user.id) return res.status(403).json({ error: "Solo il leader può assegnare i ruoli." });

  if (targetUserId === user.id) return res.status(400).json({ error: "Non puoi modificare il tuo stesso ruolo." });

  const { data: targetMember } = await supabase.from('party_members').select('role').eq('userId', targetUserId).eq('partyId', partyId).single();
  if (!targetMember) return res.status(404).json({ error: "Il giocatore non è in questo partito." });

  await supabase.from('party_members').update({ role: newRole }).eq('userId', targetUserId).eq('partyId', partyId);
  res.json({ success: true, newRole });
});

app.post("/api/parties/kick", authenticate, async (req: any, res) => {
  const user = req.user;
  const { partyId, targetUserId } = req.body;

  const { data: myMembership } = await supabase.from('party_members').select('role').eq('userId', user.id).eq('partyId', partyId).single();
  if (!myMembership || (myMembership.role !== 'leader' && myMembership.role !== 'secretary')) {
    return res.status(403).json({ error: "Non hai i permessi per espellere." });
  }

  const { data: targetMember } = await supabase.from('party_members').select('role').eq('userId', targetUserId).eq('partyId', partyId).single();
  if (!targetMember) return res.status(404).json({ error: "Il giocatore non è in questo partito." });

  if (targetMember.role === 'leader') return res.status(403).json({ error: "Non puoi espellere il leader." });
  if (myMembership.role === 'secretary' && targetMember.role === 'secretary') return res.status(403).json({ error: "Un segretario non può espellere un altro segretario." });

  await supabase.from('party_members').delete().eq('userId', targetUserId).eq('partyId', partyId);

  const logId = Math.random().toString(36).substring(2, 11);
  await supabase.from('party_logs').insert({
    id: logId,
    partyId,
    action: 'kick',
    details: `Utente rimosso dal partito. Esecutore: ${user.username}`,
    timestamp: Date.now()
  });

  res.json({ success: true });
});

const getItemType = (itemId: string): string => {
  const resources = ['oil', 'minerals', 'uranium', 'diamonds'];
  const weapons = ['infantry', 'tank', 'airstrike'];
  if (resources.includes(itemId)) return 'resources';
  if (weapons.includes(itemId)) return 'weapons';
  return 'items';
};

const calculatePartyCaps = async (partyId: string) => {
  const { data: members } = await supabase
    .from('party_members')
    .select('userId, users(level, lastLogin), joinedAt')
    .eq('partyId', partyId);

  const now = Date.now();
  const activeMembers = (members || []).map((m: any) => ({
    userId: m.userId,
    level: m.users?.level || 0,
    lastLogin: m.users?.lastLogin || 0,
    joinedAt: m.joinedAt
  })).filter(m =>
    m.level >= 60 &&
    now - (m.lastLogin || 0) <= 24 * 60 * 60 * 1000 &&
    now - m.joinedAt >= 72 * 60 * 60 * 1000
  );

  const activeCount = activeMembers.length;
  // Dynamic CAPS based on active members
  const maxGoldPerUser = Math.min(200, 50 + (activeCount * 5));
  const maxGoldTotal = Math.min(5000, activeCount * 100);

  return { activeCount, activeMembers, maxGoldPerUser, maxGoldTotal };
};

app.post("/api/parties/set-wage", authenticate, async (req: any, res) => {
  const user = req.user;
  const { partyId, targetUserId, salaryCash, salaryGold } = req.body;

  const { data: party } = await supabase.from('parties').select('leaderUserId').eq('id', partyId).single();
  if (!party || party.leaderUserId !== user.id) return res.status(403).json({ error: "Solo il leader può impostare i salari." });

  const { data: targetMember } = await supabase.from('party_members').select('role').eq('userId', targetUserId).eq('partyId', partyId).single();
  if (!targetMember) return res.status(404).json({ error: "Il giocatore non è in questo partito." });

  const cash = Math.max(0, parseInt(salaryCash) || 0);
  const gold = Math.max(0, parseInt(salaryGold) || 0);

  const caps = await calculatePartyCaps(partyId);
  if (gold > caps.maxGoldPerUser) {
    return res.status(400).json({ error: `Il limite di Gold per utente è ${caps.maxGoldPerUser} (basato su ${caps.activeCount} membri attivi).` });
  }

  await supabase.from('party_members').update({ salaryCash: cash, salaryGold: gold }).eq('userId', targetUserId).eq('partyId', partyId);

  res.json({ success: true, salaryCash: cash, salaryGold: gold });
});

app.post("/api/parties/pay-wages", authenticate, async (req: any, res) => {
  const user = req.user;
  const { partyId } = req.body;

  const { data: party } = await supabase.from('parties').select('leaderUserId').eq('id', partyId).single();
  if (!party || party.leaderUserId !== user.id) return res.status(403).json({ error: "Solo il leader può pagare i salari." });

  const { data: lastPayment } = await supabase.from('party_logs').select('timestamp').eq('partyId', partyId).eq('action', 'pay_wages').order('timestamp', { ascending: false }).limit(1).single();
  if (lastPayment && Date.now() - new Date(lastPayment.timestamp).getTime() < 24 * 60 * 60 * 1000) {
    const hoursLeft = Math.ceil((24 * 60 * 60 * 1000 - (Date.now() - new Date(lastPayment.timestamp).getTime())) / (60 * 60 * 1000));
    return res.status(400).json({ error: `I salari sono già stati pagati. Riprova tra ${hoursLeft} ore.` });
  }

  const caps = await calculatePartyCaps(partyId);
  const activeIds = new Set(caps.activeMembers.map((m: any) => m.userId));

  const { data: toPay } = await supabase.from('party_members').select('userId, salaryCash, salaryGold').eq('partyId', partyId).or('salaryCash.gt.0,salaryGold.gt.0');
  const validToPay = (toPay || []).filter(m => activeIds.has(m.userId));

  let totalCash = 0;
  let totalGold = 0;
  validToPay.forEach(m => {
    totalCash += m.salaryCash || 0;
    totalGold += m.salaryGold || 0;
  });

  if (totalGold > caps.maxGoldTotal) return res.status(400).json({ error: `Il totale di Gold (${totalGold}) supera il limite massimo distribuibile di ${caps.maxGoldTotal}.` });
  if (user.money < totalCash || user.gold < totalGold) return res.status(400).json({ error: `Fondi insufficienti sul tuo conto personale.` });

  if (validToPay.length === 0) return res.status(400).json({ error: "Nessun membro attivo riceve stipendi." });

  // Update Leader
  await supabase.from('users').update({ money: user.money - totalCash, gold: user.gold - totalGold }).eq('id', user.id);

  // Update members (Note: This is not atomic in this loop, but Supabase doesn't support easy multi-update with different amounts in one go without RPC)
  const updates = validToPay.map(async (m) => {
    const { data: memberUser } = await supabase.from('users').select('money, gold').eq('id', m.userId).single();
    if (memberUser) {
      return supabase.from('users').update({
        money: (memberUser.money || 0) + m.salaryCash,
        gold: (memberUser.gold || 0) + m.salaryGold
      }).eq('id', m.userId);
    }
  });
  await Promise.all(updates);

  await supabase.from('party_logs').insert({
    id: Math.random().toString(36).substring(2, 11),
    partyId,
    action: 'pay_wages',
    details: `Pagati totali $${totalCash} e ${totalGold} Gold a ${validToPay.length} membri.`,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, paidMembers: validToPay.length, totalCash, totalGold });
});

app.post("/api/parties/contribute", authenticate, async (req: any, res) => {
  const user = req.user;
  const { targetUserId, itemType, amount } = req.body;
  const numAmount = parseInt(amount) || 0;

  if (numAmount <= 0) return res.status(400).json({ error: "Quantità non valida." });
  if (user.id === targetUserId) return res.status(400).json({ error: "Non puoi inviare a te stesso." });

  const { data: myMembership } = await supabase.from('party_members').select('partyId, joinedAt').eq('userId', user.id).single();
  if (!myMembership) return res.status(403).json({ error: "Non fai parte di alcun partito." });

  if (Date.now() - new Date(myMembership.joinedAt).getTime() < 7 * 24 * 60 * 60 * 1000) {
    return res.status(403).json({ error: "Devi essere nel partito da almeno 7 giorni." });
  }

  const { data: targetMembership } = await supabase.from('party_members').select('partyId').eq('userId', targetUserId).eq('partyId', myMembership.partyId).single();
  if (!targetMembership) return res.status(404).json({ error: "Il destinatario non fa parte del tuo partito." });

  try {
    if (itemType === 'cash') {
      if (user.money < numAmount) throw new Error("Cash insufficiente.");
      await supabase.from('users').update({ money: user.money - numAmount }).eq('id', user.id);
      const { data: tu } = await supabase.from('users').select('money').eq('id', targetUserId).single();
      await supabase.from('users').update({ money: (tu?.money || 0) + numAmount }).eq('id', targetUserId);
    } else if (itemType === 'gold') {
      if (user.gold < numAmount) throw new Error("Gold insufficiente.");
      await supabase.from('users').update({ gold: user.gold - numAmount }).eq('id', user.id);
      const { data: tu } = await supabase.from('users').select('gold').eq('id', targetUserId).single();
      await supabase.from('users').update({ gold: (tu?.gold || 0) + numAmount }).eq('id', targetUserId);
    } else {
      const { data: userInv } = await supabase.from('user_inventory').select('quantity').eq('userId', user.id).eq('itemId', itemType).single();
      if (!userInv || userInv.quantity < numAmount) throw new Error("Oggetto insufficiente.");

      await supabase.from('user_inventory').update({ quantity: (userInv.quantity || 0) - numAmount }).eq('userId', user.id).eq('itemId', itemType);

      const { data: targetInv } = await supabase.from('user_inventory').select('quantity').eq('userId', targetUserId).eq('itemId', itemType).single();
      if (targetInv) {
        await supabase.from('user_inventory').update({ quantity: (targetInv.quantity || 0) + numAmount }).eq('userId', targetUserId).eq('itemId', itemType);
      } else {
        await supabase.from('user_inventory').insert({ userId: targetUserId, itemId: itemType, quantity: numAmount });
      }
    }

    await supabase.from('party_logs').insert({
      id: Math.random().toString(36).substring(2, 11),
      partyId: myMembership.partyId,
      action: 'contribution',
      details: `${user.username} ha inviato ${numAmount} ${itemType} a ID:${targetUserId}`,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/parties/invite", authenticate, async (req: any, res) => {
  const user = req.user;
  const { targetUserId } = req.body;

  const { data: myMembership } = await supabase.from('party_members').select('partyId, role').eq('userId', user.id).single();
  if (!myMembership || (myMembership.role !== 'leader' && myMembership.role !== 'secretary')) {
    return res.status(403).json({ error: "Solo Leader e Segretari possono invitare." });
  }

  const { data: targetMembership } = await supabase.from('party_members').select('partyId').eq('userId', targetUserId).single();
  if (targetMembership) return res.status(400).json({ error: "L'utente fa già parte di un partito." });

  const { data: existingInvite } = await supabase.from('party_invites').select('id').eq('partyId', myMembership.partyId).eq('userId', targetUserId).eq('status', 'pending').single();
  if (existingInvite) return res.status(400).json({ error: "L'utente ha già un invito pendente." });

  await supabase.from('party_invites').insert({
    id: Math.random().toString(36).substring(2, 11),
    partyId: myMembership.partyId,
    userId: targetUserId,
    invitedBy: user.id,
    status: 'pending',
    createdAt: new Date().toISOString()
  });

  res.json({ success: true });
});

app.get("/api/parties/my-invites", authenticate, async (req: any, res) => {
  const { data: invites } = await supabase
    .from('party_invites')
    .select('*, parties(name), users!invitedBy(username)')
    .eq('userId', req.user.id)
    .eq('status', 'pending');

  const mapped = (invites || []).map((i: any) => ({
    ...i,
    partyName: i.parties?.name,
    inviterName: i.users?.username
  }));

  res.json(mapped);
});

app.post("/api/parties/join", authenticate, async (req: any, res) => {
  const user = req.user;
  const { inviteId } = req.body;

  const { data: invite } = await supabase.from('party_invites').select('partyId, status').eq('id', inviteId).eq('userId', user.id).single();
  if (!invite) return res.status(404).json({ error: "Invito non trovato." });
  if (invite.status !== 'pending') return res.status(400).json({ error: "L'invito non è più valido." });

  const { data: existingMember } = await supabase.from('party_members').select('partyId').eq('userId', user.id).single();
  if (existingMember) return res.status(400).json({ error: "Fai già parte di un partito." });

  await supabase.from('party_invites').update({ status: 'accepted' }).eq('id', inviteId);
  await supabase.from('party_members').insert({ userId: user.id, partyId: invite.partyId, role: 'member', joinedAt: new Date().toISOString() });
  await supabase.from('party_invites').update({ status: 'rejected' }).eq('userId', user.id).eq('status', 'pending');

  res.json({ success: true, partyId: invite.partyId });
});

app.post("/api/parties/primaries-vote", authenticate, async (req: any, res) => {
  const user = req.user;
  const { candidateId } = req.body;

  const { data: myMembership } = await supabase.from('party_members').select('partyId').eq('userId', user.id).single();
  if (!myMembership) return res.status(403).json({ error: "Non fai parte di alcun partito." });

  const { data: targetMembership } = await supabase.from('party_members').select('partyId').eq('userId', candidateId).single();
  if (!targetMembership || targetMembership.partyId !== myMembership.partyId) return res.status(400).json({ error: "Candidato non valido." });

  const cyclePeriodMs = 5 * 24 * 60 * 60 * 1000;
  const currentCycleStart = new Date(Math.floor(Date.now() / cyclePeriodMs) * cyclePeriodMs).toISOString();

  const { data: existingVote } = await supabase.from('party_primaries').select('id').eq('voterId', user.id).gte('createdAt', currentCycleStart).single();
  if (existingVote) return res.status(400).json({ error: "Hai già votato in questo ciclo." });

  await supabase.from('party_primaries').insert({
    id: Math.random().toString(36).substring(2, 11),
    partyId: myMembership.partyId,
    candidateId,
    voterId: user.id,
    createdAt: new Date().toISOString()
  });

  res.json({ success: true });
});
// ==========================================
// PARLIAMENT & ELECTIONS API
// ==========================================

app.get("/api/elections", authenticate, async (req: any, res) => {
  const user = req.user;
  const { data: election } = await supabase.from('elections').select('*').eq('regionId', user.residenceId).eq('status', 'active').order('createdAt', { ascending: false }).limit(1).single();

  if (!election) return res.json({ election: null, parties: [], myVote: null });

  const { data: parties } = await supabase.from('parties').select('id, name, tag, logo, ideology').eq('regionId', user.residenceId);
  const { data: votes } = await supabase.from('election_votes').select('partyId').eq('electionId', election.id);

  const voteCounts: Record<string, number> = {};
  (votes || []).forEach(v => voteCounts[v.partyId] = (voteCounts[v.partyId] || 0) + 1);

  const partiesWithVotes = (parties || []).map((p: any) => ({
    ...p,
    votes: voteCounts[p.id] || 0
  }));

  const { data: myVote } = await supabase.from('election_votes').select('partyId').eq('electionId', election.id).eq('voterId', user.id).single();

  res.json({ election, parties: partiesWithVotes, myVote: myVote?.partyId });
});

app.post("/api/elections/vote", authenticate, async (req: any, res) => {
  const user = req.user;
  const { electionId, partyId } = req.body;

  const { data: election } = await supabase.from('elections').select('regionId, status').eq('id', electionId).single();
  if (!election || election.status !== 'active') return res.status(400).json({ error: "Elezione non attiva." });
  if (election.regionId !== user.residenceId) return res.status(403).json({ error: "Vota nella tua residenza." });

  const { data: party } = await supabase.from('parties').select('id').eq('id', partyId).eq('regionId', user.residenceId).single();
  if (!party) return res.status(400).json({ error: "Partito non valido." });

  const { data: existingVote } = await supabase.from('election_votes').select('id').eq('electionId', electionId).eq('voterId', user.id).single();
  if (existingVote) return res.status(400).json({ error: "Hai già votato." });

  await supabase.from('election_votes').insert({
    id: Math.random().toString(36).substring(2, 11),
    electionId,
    voterId: user.id,
    partyId,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true });
});

app.get("/api/parliament", authenticate, async (req: any, res) => {
  const user = req.user;
  const { data: members } = await supabase
    .from('parliament_members')
    .select('userId, electedAt, users(username, level), parties(name, tag)')
    .eq('regionId', user.residenceId);

  const mapped = (members || []).map((m: any) => ({
    userId: m.userId,
    username: m.users?.username,
    level: m.users?.level,
    partyName: m.parties?.name,
    partyTag: m.parties?.tag,
    electedAt: m.electedAt
  }));

  res.json(mapped);
});


// ==========================================
// STATE LAWS REGISTRY
// ==========================================

// ==========================================
// BLOCS API
// ==========================================

app.get("/api/blocs", authenticate, async (req: any, res) => {
  const { data: blocs } = await supabase.from('blocs').select('*, users!ownerUserId(username)');

  const mapped = await Promise.all((blocs || []).map(async (b: any) => {
    const { count: memberCount } = await supabase.from('bloc_memberships').select('*', { count: 'exact', head: true }).eq('blocId', b.id).eq('status', 'active');
    const { count: isMyBloc } = await supabase.from('bloc_memberships')
      .select('*, regions!stateId(ownerUserId)', { count: 'exact', head: true })
      .eq('blocId', b.id)
      .eq('status', 'active');
    // Note: The logic for 'isMyBloc' in the original SQL was a bit complex. 
    // Simplified: check if user is leader of any member state.
    const { data: myMemberStates } = await supabase.from('bloc_memberships').select('stateId, regions!stateId(ownerUserId)').eq('blocId', b.id).eq('status', 'active');
    const isUserMember = myMemberStates?.some((m: any) => m.regions?.ownerUserId === req.user.id);

    return {
      ...b,
      ownerName: b.users?.username,
      memberCount: memberCount || 0,
      isMyBloc: isUserMember ? 1 : 0
    };
  }));

  const filtered = mapped.filter(b => b.memberCount >= 2 || b.isMyBloc > 0);
  res.json(filtered);
});

app.get("/api/blocs-map", async (req, res) => {
  const { data } = await supabase.from('bloc_memberships').select('stateId, blocId, blocs(name)').eq('status', 'active');
  const mapped = (data || []).map((m: any) => ({
    stateId: m.stateId,
    blocId: m.blocId,
    blocName: m.blocs?.name
  }));
  res.json(mapped);
});

app.get("/api/blocs/:id", authenticate, async (req: any, res) => {
  const user = req.user;
  const blocId = req.params.id;

  const { data: bloc } = await supabase.from('blocs').select('*, users!ownerUserId(username), regions!ownerStateId(name)').eq('id', blocId).single();
  if (!bloc) return res.status(404).json({ error: "Blocco non trovato." });

  const { data: members } = await supabase.from('bloc_memberships').select('*, regions!stateId(name, ownerUserId, users!ownerUserId(username))').eq('blocId', blocId).eq('status', 'active');
  const mMapped = (members || []).map((m: any) => ({
    ...m,
    stateName: m.regions?.name,
    leaderName: m.regions?.users?.username,
    ownerUserId: m.regions?.ownerUserId
  }));

  const { data: reg } = await supabase.from('bloc_regulations').select('*').eq('blocId', blocId).single();
  const regulations = reg || { openBorders: 0, defaultMilitaryAgreement: 0 };

  const isMemberLeader = mMapped.some(m => m.ownerUserId === user.id);

  let applications = [];
  let proposals = [];

  if (isMemberLeader) {
    const { data: apps } = await supabase.from('bloc_applications').select('*, regions!stateId(name, ownerUserId, users!ownerUserId(username))').eq('blocId', blocId).eq('status', 'pending');
    for (const a of (apps || [])) {
      const { data: votes } = await supabase.from('bloc_votes').select('*').eq('targetId', a.id);
      applications.push({ ...a, stateName: a.regions?.name, leaderName: a.regions?.users?.username, votes: votes || [] });
    }

    const { data: props } = await supabase.from('bloc_regulation_proposals').select('*').eq('blocId', blocId).eq('status', 'pending');
    for (const p of (props || [])) {
      const { data: votes } = await supabase.from('bloc_votes').select('*').eq('targetId', p.id);
      proposals.push({ ...p, votes: votes || [] });
    }
  }

  res.json({ bloc: { ...bloc, ownerName: (bloc as any).users?.username, ownerStateName: (bloc as any).regions?.name }, members: mMapped, regulations, applications, proposals, isMemberLeader });
});

app.post("/api/blocs/:id/update", authenticate, async (req: any, res) => {
  const user = req.user;
  const blocId = req.params.id;
  const { name, description, logo } = req.body;

  if (!name || name.trim().length === 0) return res.status(400).json({ error: "Nome obbligatorio." });
  const { data: bloc } = await supabase.from('blocs').select('ownerUserId').eq('id', blocId).single();
  if (!bloc) return res.status(404).json({ error: "Blocco non trovato." });
  if (bloc.ownerUserId !== user.id) return res.status(403).json({ error: "Solo il fondatore può farlo." });

  await supabase.from('blocs').update({ name: name.trim(), description: description || '', logo: logo || '' }).eq('id', blocId);
  res.json({ success: true });
});

app.post("/api/blocs/create", authenticate, async (req: any, res) => {
  const user = req.user;
  const { name, stateId, description, logo } = req.body;

  if (!name || name.trim().length === 0) return res.status(400).json({ error: "Nome obbligatorio." });
  if (!stateId) return res.status(400).json({ error: "Devi selezionare uno Stato da te guidato." });

  const { data: region } = await supabase.from('regions').select('ownerUserId').eq('id', stateId).single();
  if (!region || region.ownerUserId !== user.id) return res.status(403).json({ error: "Solo il Leader dello Stato può creare un blocco a suo nome." });

  const { data: existingMembership } = await supabase.from('bloc_memberships').select('blocId').eq('stateId', stateId).eq('status', 'active').maybeSingle();
  if (existingMembership) return res.status(400).json({ error: "Questo Stato fa già parte di un blocco." });

  const { data: existingBloc } = await supabase.from('blocs').select('id').eq('name', name.trim()).maybeSingle();
  if (existingBloc) return res.status(409).json({ error: "Esiste già un blocco con questo nome." });

  const id = Math.random().toString(36).substring(2, 11);
  const now = new Date().toISOString();

  await supabase.from('blocs').insert({ id, name: name.trim(), logo: logo || '', description: description || '', ownerStateId: stateId, ownerUserId: user.id, createdAt: now });
  await supabase.from('bloc_memberships').insert({ blocId: id, stateId, status: 'active', joinedAt: now });
  await supabase.from('bloc_regulations').insert({ blocId: id, openBorders: 0, defaultMilitaryAgreement: 0 });

  res.json({ success: true, blocId: id });
});

app.post("/api/blocs/:id/apply", authenticate, async (req: any, res) => {
  const user = req.user;
  const blocId = req.params.id;
  const { stateId } = req.body;

  if (!stateId) return res.status(400).json({ error: "Stato non specificato." });

  const { data: region } = await supabase.from('regions').select('ownerUserId').eq('id', stateId).single();
  if (!region || region.ownerUserId !== user.id) return res.status(403).json({ error: "Solo il leader può candidarsi." });

  const { data: existingMember } = await supabase.from('bloc_memberships').select('blocId').eq('stateId', stateId).eq('status', 'active').maybeSingle();
  if (existingMember) return res.status(400).json({ error: "Questo Stato è già in un blocco." });

  const { data: existingApp } = await supabase.from('bloc_applications').select('id').eq('blocId', blocId).eq('stateId', stateId).eq('status', 'pending').maybeSingle();
  if (existingApp) return res.status(400).json({ error: "Candidatura già pendente." });

  await supabase.from('bloc_applications').insert({
    id: Math.random().toString(36).substring(2, 11),
    blocId,
    stateId,
    createdAt: new Date().toISOString(),
    status: 'pending'
  });

  res.json({ success: true });
});

app.post("/api/blocs/applications/:id/vote", authenticate, async (req: any, res) => {
  const user = req.user;
  const appId = req.params.id;
  const { voterStateId, choice } = req.body;
  const voteChoice = choice ? 1 : 0;

  const { data: application } = await supabase.from('bloc_applications').select('*').eq('id', appId).single();
  if (!application || application.status !== 'pending') return res.status(400).json({ error: "Candidatura non valida." });

  const blocId = application.blocId;
  const { data: membership } = await supabase.from('bloc_memberships').select('status').eq('blocId', blocId).eq('stateId', voterStateId).eq('status', 'active').single();
  if (!membership) return res.status(403).json({ error: "Stato non autorizzato a votare." });

  const { data: voterRegion } = await supabase.from('regions').select('ownerUserId').eq('id', voterStateId).single();
  if (!voterRegion || voterRegion.ownerUserId !== user.id) return res.status(403).json({ error: "Solo il leader può votare." });

  const { data: existingVote } = await supabase.from('bloc_votes').select('*').eq('targetId', appId).eq('voterStateId', voterStateId).maybeSingle();
  if (existingVote) return res.status(400).json({ error: "Voto già inviato." });

  await supabase.from('bloc_votes').insert({ targetId: appId, voterStateId, choice: voteChoice, createdAt: new Date().toISOString() });

  const { data: activeMembers } = await supabase.from('bloc_memberships').select('stateId').eq('blocId', blocId).eq('status', 'active');
  const activeCount = activeMembers?.length || 0;

  const { data: allVotes } = await supabase.from('bloc_votes').select('choice').eq('targetId', appId);
  const yesVotes = allVotes?.filter(v => v.choice === 1).length || 0;
  const noVotes = allVotes?.filter(v => v.choice === 0).length || 0;

  const requiredToPass = Math.floor(activeCount / 2) + 1;
  const requiredToReject = activeCount - requiredToPass + 1;

  if (yesVotes >= requiredToPass) {
    await supabase.from('bloc_applications').update({ status: 'approved' }).eq('id', appId);
    await supabase.from('bloc_memberships').insert({ blocId, stateId: application.stateId, status: 'active', joinedAt: new Date().toISOString() });
  } else if (noVotes >= requiredToReject || (yesVotes + noVotes) >= activeCount) {
    await supabase.from('bloc_applications').update({ status: 'rejected' }).eq('id', appId);
  }

  res.json({ success: true });
});

app.post("/api/blocs/:id/regulations/propose", authenticate, async (req: any, res) => {
  const user = req.user;
  const blocId = req.params.id;
  const { proposerStateId, type, proposedValue } = req.body;
  const value = proposedValue ? 1 : 0;

  if (!['openBorders', 'migrationOpen', 'defaultMilitaryAgreement'].includes(type)) return res.status(400).json({ error: "Tipo non valido." });

  const { data: membership } = await supabase.from('bloc_memberships').select('status').eq('blocId', blocId).eq('stateId', proposerStateId).eq('status', 'active').single();
  if (!membership) return res.status(403).json({ error: "Non sei un membro attivo." });

  const { data: region } = await supabase.from('regions').select('ownerUserId').eq('id', proposerStateId).single();
  if (!region || region.ownerUserId !== user.id) return res.status(403).json({ error: "Solo il leader può proporre." });

  const { data: existingProp } = await supabase.from('bloc_regulation_proposals').select('id').eq('blocId', blocId).eq('type', type).eq('status', 'pending').maybeSingle();
  if (existingProp) return res.status(400).json({ error: "Proposta già pendente." });

  const id = Math.random().toString(36).substring(2, 11);
  const now = new Date().toISOString();
  await supabase.from('bloc_regulation_proposals').insert({ id, blocId, type, proposedValue: value, createdAt: now, status: 'pending' });
  await supabase.from('bloc_votes').insert({ targetId: id, voterStateId: proposerStateId, choice: 1, createdAt: now });

  res.json({ success: true });
});

app.post("/api/blocs/regulations/proposals/:id/vote", authenticate, async (req: any, res) => {
  const user = req.user;
  const propId = req.params.id;
  const { voterStateId, choice } = req.body;
  const voteChoice = choice ? 1 : 0;

  const { data: proposal } = await supabase.from('bloc_regulation_proposals').select('*').eq('id', propId).single();
  if (!proposal || proposal.status !== 'pending') return res.status(400).json({ error: "Proposta non valida." });

  const blocId = proposal.blocId;
  const { data: membership } = await supabase.from('bloc_memberships').select('status').eq('blocId', blocId).eq('stateId', voterStateId).eq('status', 'active').single();
  if (!membership) return res.status(403).json({ error: "Non sei membro del blocco." });

  const { data: voterRegion } = await supabase.from('regions').select('ownerUserId').eq('id', voterStateId).single();
  if (!voterRegion || voterRegion.ownerUserId !== user.id) return res.status(403).json({ error: "Solo il leader può votare." });

  const { data: existingVote } = await supabase.from('bloc_votes').select('*').eq('targetId', propId).eq('voterStateId', voterStateId).maybeSingle();
  if (existingVote) return res.status(400).json({ error: "Voto già inviato." });

  await supabase.from('bloc_votes').insert({ targetId: propId, voterStateId, choice: voteChoice, createdAt: new Date().toISOString() });

  const { data: activeMembers } = await supabase.from('bloc_memberships').select('stateId').eq('blocId', blocId).eq('status', 'active');
  const activeCount = activeMembers?.length || 0;

  const { data: allVotes } = await supabase.from('bloc_votes').select('choice').eq('targetId', propId);
  const yesVotes = allVotes?.filter(v => v.choice === 1).length || 0;
  const noVotes = allVotes?.filter(v => v.choice === 0).length || 0;

  const requiredToPass = Math.floor(activeCount / 2) + 1;
  const requiredToReject = activeCount - requiredToPass + 1;

  if (yesVotes >= requiredToPass) {
    await supabase.from('bloc_regulation_proposals').update({ status: 'approved' }).eq('id', propId);
    const updateObj: any = {};
    updateObj[proposal.type] = proposal.proposedValue;
    await supabase.from('bloc_regulations').update(updateObj).eq('blocId', blocId);
  } else if (noVotes >= requiredToReject || (yesVotes + noVotes) >= activeCount) {
    await supabase.from('bloc_regulation_proposals').update({ status: 'rejected' }).eq('id', propId);
  }

  res.json({ success: true });
});

export const LawRegistry: Record<string, {
  category: string;
  icon: string;
  title: string;
  description: string;
  threshold: number; // e.g. 0.5 for >50%, 0.8 for >=80%
  delayDays: number; // how long it stays in pending (e.g. 1)
  validate: (region: any, params: any, proposer: any) => Promise<string | null>; // returns error string or null
  execute: (region: any, params: any, sourceLawId?: string) => Promise<void>;
}> = {
  change_market_tax: {
    category: "Economia e Tasse",
    icon: "BadgeDollarSign",
    title: "Modifica tassa di mercato",
    description: "Imposta la tassa sulle transazioni di mercato nella regione.",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region, params) => {
      const tax = parseInt(params.tax);
      if (isNaN(tax) || tax < 0 || tax > 100) return "Tassa non valida (deve essere tra 0 e 100)";
      return null;
    },
    execute: async (region, params) => {
      await supabase.from('regions').update({ marketTaxRate: parseInt(params.tax) }).eq('id', region.id);
    }
  },
  change_salary_tax: {
    category: "Economia e Tasse",
    icon: "Briefcase",
    title: "Modifica tassa sui salari",
    description: "Imposta la percentuale di tassazione sugli stipendi guadagnati nelle fabbriche.",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region, params) => {
      const tax = parseInt(params.tax);
      if (isNaN(tax) || tax < 0 || tax > 100) return "Tassa non valida (deve essere tra 0 e 100)";
      return null;
    },
    execute: async (region, params) => {
      await supabase.from('regions').update({ taxes: parseInt(params.tax) }).eq('id', region.id);
    }
  },
  transfer_budget: {
    category: "Economia e Tasse",
    icon: "ArrowRightLeft",
    title: "Trasferimento Budget",
    description: "Trasferisce denaro dal budget statale a un'altra nazione.",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region, params) => {
      const amount = parseInt(params.amount);
      if (isNaN(amount) || amount <= 0) return "Importo non valido.";

      const { data: budget } = await supabase.from('budgets').select('moneyEUR').eq('ownerType', 'REGION').eq('ownerId', region.id).single();
      if (!budget || budget.moneyEUR < amount) return "Spesa superiore ai fondi in bilancio attuali.";

      const { data: target } = await supabase.from('regions').select('id').eq('id', params.targetRegionId).single();
      if (!target) return "Nazione destinataria inesistente.";
      if (params.targetRegionId === region.id) return "Non puoi trasferire budget a te stesso.";

      return null;
    },
    execute: async (region, params) => {
      const amount = parseInt(params.amount);

      await supabase.rpc('add_budget_transaction', {
        p_owner_type: 'REGION',
        p_owner_id: region.id,
        p_type: 'EXPENSE',
        p_subtype: 'BUDGET_TRANSFER',
        p_money_delta: -amount,
        p_metadata: { to: params.targetRegionId }
      });
      await supabase.rpc('add_budget_transaction', {
        p_owner_type: 'REGION',
        p_owner_id: params.targetRegionId,
        p_type: 'INCOME',
        p_subtype: 'BUDGET_TRANSFER',
        p_money_delta: amount,
        p_metadata: { from: region.id }
      });
    }
  },
  proclaim_dictatorship: {
    category: "Politica Interna",
    icon: "Crown",
    title: "Proclamazione Dittatura",
    description: "Il Leader diventa dittatore assoluto. Le leggi passano senza voto.",
    threshold: 0.8,
    delayDays: 1,
    validate: async (region, params, proposer) => {
      const now = Date.now();
      const THIRTY_ONE_DAYS = 31 * 24 * 60 * 60 * 1000;
      if (now - (region.foundationDate || 0) < THIRTY_ONE_DAYS && region.foundationDate !== 0) {
        return "Devono passare almeno 31 giorni dalla fondazione dello Stato.";
      }
      if (region.ownerUserId !== proposer.id) {
        return "Solo il Leader attuale può proclamare la dittatura.";
      }
      return null;
    },
    execute: async (region, params, sourceLawId) => {
      const { data: law } = await supabase.from('laws').select('proposerId').eq('id', sourceLawId).single();
      const proposerId = law ? law.proposerId : region.ownerUserId;

      await supabase.from('regions').update({
        dictatorship: 1,
        governmentForm: 'DICTATORSHIP',
        leaderUserId: proposerId,
        ownerUserId: proposerId,
        leaderTitle: 'Dittatore'
      }).eq('id', region.id);
    }
  },
  revoke_dictatorship: {
    category: "Politica Interna",
    icon: "Scale",
    title: "Ritorno alla Democrazia",
    description: "Revoca lo stato di Dittatura. Il parlamento torna ad avere potere.",
    threshold: 0.8,
    delayDays: 1,
    validate: async (region) => {
      if (!region.dictatorship) return "Lo stato non è in dittatura.";
      return null;
    },
    execute: async (region) => {
      await supabase.from('regions').update({ dictatorship: 0, governmentForm: 'PRESIDENTIAL_REPUBLIC', leaderTitle: 'Presidente' }).eq('id', region.id);
    }
  },
  change_state_name: {
    category: "Politica Interna",
    icon: "Flag",
    title: "Cambio nome dello Stato",
    description: "Modifica il nome ufficiale della nazione.",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region, params) => {
      if (!params.name || params.name.length > 22) return "Nome non valido (max 22 caratteri).";
      const { data: existing } = await supabase.from('regions').select('id').eq('name', params.name).neq('id', region.id).maybeSingle();
      if (existing) return "Nome già in uso da un'altra nazione.";
      return null;
    },
    execute: async (region, params) => {
      await supabase.from('regions').update({ name: params.name }).eq('id', region.id);
    }
  },
  change_parliament_size: {
    category: "Politica Interna",
    icon: "Users",
    title: "Dimensione Parlamento",
    description: "Modifica il numero dei seggi in Parlamento (da 10 a 100).",
    threshold: 0.8,
    delayDays: 1,
    validate: async (region, params) => {
      const size = parseInt(params.size);
      if (isNaN(size) || size < 10 || size > 100) return "Dimensione non valida (min 10, max 100).";
      return null;
    },
    execute: async (region, params) => {
      await supabase.from('regions').update({ parliamentSize: parseInt(params.size) }).eq('id', region.id);
    }
  },
  change_parliament_duration: {
    category: "Politica Interna",
    icon: "Clock",
    title: "Durata Mandato",
    description: "Modifica i giorni di durata del mandato parlamentare (da 3 a 30).",
    threshold: 0.8,
    delayDays: 1,
    validate: async (region, params) => {
      const days = parseInt(params.days);
      if (isNaN(days) || days < 3 || days > 30) return "Durata non valida (min 3, max 30).";
      return null;
    },
    execute: async (region, params) => {
      await supabase.from('regions').update({ parliamentDuration: parseInt(params.days) }).eq('id', region.id);
    }
  },
  open_borders: {
    category: "Politica Interna",
    icon: "Unlock",
    title: "Apri Confini",
    description: "Permette a chiunque di prendere la residenza o il permesso di lavoro.",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region) => {
      if (region.residencePolicy === 'open') return "I confini sono già aperti.";
      return null;
    },
    execute: async (region) => {
      await supabase.from('regions').update({ residencePolicy: 'open' }).eq('id', region.id);
    }
  },
  close_borders: {
    category: "Politica Interna",
    icon: "Lock",
    title: "Chiudi Confini",
    description: "Blocca l'immigrazione. Solo il Leader può approvare visti lavorativi.",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region) => {
      if (region.residencePolicy === 'closed') return "I confini sono già chiusi.";
      return null;
    },
    execute: async (region) => {
      await supabase.from('regions').update({ residencePolicy: 'closed' }).eq('id', region.id);
    }
  },
  build_hospital: {
    category: "Costruzioni Statali",
    icon: "Heart",
    title: "Costruzione Ospedale",
    description: "Aumenta la Salute (Health) della nazione di 1 punto. Costo: $25.000",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region, params, proposer) => {
      if (region.health >= 11) return "Livello Salute già al massimo (11).";
      const { data: budget } = await supabase.from('budgets').select('moneyEUR').eq('ownerType', 'REGION').eq('ownerId', region.id).single();
      if (!budget || budget.moneyEUR < 25000) return "Fondi statali in bilancio insufficienti ($25.000 richiesti).";
      return null;
    },
    execute: async (region) => {
      const { data: currentRegion } = await supabase.from('regions').select('health').eq('id', region.id).single();
      if (currentRegion && currentRegion.health < 11) {
        await supabase.rpc('add_budget_transaction', {
          p_owner_type: 'REGION',
          p_owner_id: region.id,
          p_type: 'EXPENSE',
          p_subtype: 'BUILDING',
          p_money_delta: -25000,
          p_metadata: { building: 'hospital' }
        });
        await supabase.from('regions').update({ health: currentRegion.health + 1 }).eq('id', region.id);
      }
    }
  },
  migration_agreement: {
    category: "Diplomazia",
    icon: "PlaneTakeoff",
    title: "Accordo di Migrazione",
    description: "Permette ai cittadini di un'altra nazione di viaggiare liberamente nel nostro territorio.",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region, params) => {
      if (!params || !params.targetRegionId) return "ID Nazione bersaglio obbligatorio.";
      if (params.targetRegionId === region.id) return "Non puoi fare un accordo con te stesso.";
      const { data: target } = await supabase.from('regions').select('id').eq('id', params.targetRegionId).single();
      if (!target) return "Nazione bersaglio inesistente.";
      const { data: existing } = await supabase.from('migration_agreements').select('status').eq('fromStateId', region.id).eq('toStateId', params.targetRegionId).maybeSingle();
      if (existing && existing.status === 'ACTIVE') return "Esiste già un accordo attivo con questa nazione.";
      return null;
    },
    execute: async (region, params, sourceLawId) => {
      const id = Math.random().toString(36).substring(2, 11);
      const nowIso = new Date().toISOString();
      await supabase.from('migration_agreements').upsert({
        id,
        fromStateId: region.id,
        toStateId: params.targetRegionId,
        status: 'ACTIVE',
        type: 'UNILATERAL',
        createdAt: nowIso,
        activatedAt: nowIso,
        sourceLawId: sourceLawId || null,
        updatedAt: nowIso
      });

      // Check if it's now BILATERAL
      const { data: inverse } = await supabase.from('migration_agreements').select('status').eq('fromStateId', params.targetRegionId).eq('toStateId', region.id).maybeSingle();
      if (inverse && inverse.status === 'ACTIVE') {
        await supabase.from('migration_agreements').update({ type: 'BILATERAL' }).eq('fromStateId', region.id).eq('toStateId', params.targetRegionId);
        await supabase.from('migration_agreements').update({ type: 'BILATERAL' }).eq('fromStateId', params.targetRegionId).eq('toStateId', region.id);
      }
    }
  },
  revoke_migration_agreement: {
    category: "Diplomazia",
    icon: "PlaneLanding",
    title: "Revoca Accordo Migrazione",
    description: "Annulla l'accordo di migrazione con un'altra nazione.",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region, params) => {
      if (!params || !params.targetRegionId) return "ID Nazione bersaglio obbligatorio.";
      const { data: existing } = await supabase.from('migration_agreements').select('status').eq('fromStateId', region.id).eq('toStateId', params.targetRegionId).maybeSingle();
      if (!existing || existing.status !== 'ACTIVE') return "Non c'è un accordo attivo da revocare.";
      return null;
    },
    execute: async (region, params, sourceLawId) => {
      const nowIso = new Date().toISOString();
      await supabase.from('migration_agreements').update({
        status: 'INACTIVE',
        type: 'UNILATERAL',
        revokedAt: nowIso,
        sourceLawId: sourceLawId || null,
        updatedAt: nowIso
      }).eq('fromStateId', region.id).eq('toStateId', params.targetRegionId);

      // Reset the other side to unilateral if it was bilateral
      await supabase.from('migration_agreements').update({ type: 'UNILATERAL' }).eq('fromStateId', params.targetRegionId).eq('toStateId', region.id);
    }
  },
  build_military_base: {
    category: "Costruzioni Statali",
    icon: "ShieldAlert",
    title: "Base Militare",
    description: "Aumenta la potenza Militare della nazione di 1 punto. Costo: $50.000",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region, params, proposer) => {
      if (region.military >= 11) return "Livello Militare già al massimo (11).";
      const { data: budget } = await supabase.from('budgets').select('moneyEUR').eq('ownerType', 'REGION').eq('ownerId', region.id).single();
      if (!budget || budget.moneyEUR < 50000) return "Fondi statali in bilancio insufficienti ($50.000 richiesti).";
      return null;
    },
    execute: async (region) => {
      const { data: currentRegion } = await supabase.from('regions').select('military').eq('id', region.id).single();
      if (currentRegion && currentRegion.military < 11) {
        await supabase.rpc('add_budget_transaction', {
          p_owner_type: 'REGION',
          p_owner_id: region.id,
          p_type: 'EXPENSE',
          p_subtype: 'BUILDING',
          p_money_delta: -50000,
          p_metadata: { building: 'military_base' }
        });
        await supabase.from('regions').update({ military: currentRegion.military + 1 }).eq('id', region.id);
      }
    }
  },
  build_school: {
    category: "Costruzioni Statali",
    icon: "GraduationCap",
    title: "Costruzione Scuola",
    description: "Aumenta l'Istruzione (Education) della nazione di 1 punto. Costo: $20.000",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region, params, proposer) => {
      if (region.education >= 11) return "Livello Istruzione già al massimo (11).";
      const { data: budget } = await supabase.from('budgets').select('moneyEUR').eq('ownerType', 'REGION').eq('ownerId', region.id).single();
      if (!budget || budget.moneyEUR < 20000) return "Fondi statali in bilancio insufficienti ($20.000 richiesti).";
      return null;
    },
    execute: async (region) => {
      const { data: currentRegion } = await supabase.from('regions').select('education').eq('id', region.id).single();
      if (currentRegion && currentRegion.education < 11) {
        await supabase.rpc('add_budget_transaction', {
          p_owner_type: 'REGION',
          p_owner_id: region.id,
          p_type: 'EXPENSE',
          p_subtype: 'BUILDING',
          p_money_delta: -20000,
          p_metadata: { building: 'school' }
        });
        await supabase.from('regions').update({ education: currentRegion.education + 1 }).eq('id', region.id);
      }
    }
  },
  declare_war: {
    category: "Guerra e Diplomazia",
    icon: "Swords",
    title: "Dichiarazione di Guerra",
    description: "Avvia una guerra contro la nazione bersaglio.",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region, params) => {
      if (!params || !params.targetRegionId) return "ID Nazione bersaglio obbligatorio.";
      const { data: target } = await supabase.from('regions').select('id').eq('id', params.targetRegionId).single();
      if (!target) return "Nazione bersaglio inesistente.";
      if (params.targetRegionId === region.id) return "Non puoi dichiarare guerra a te stesso.";

      const { data: existingWar } = await supabase.from('wars').select('id')
        .eq('status', 'active')
        .or(`attackerCountryIso2.eq.${region.id},defenderCountryIso2.eq.${region.id}`)
        .or(`attackerCountryIso2.eq.${params.targetRegionId},defenderCountryIso2.eq.${params.targetRegionId}`)
        .maybeSingle();

      if (existingWar) return "Sei già in guerra con questa nazione o una nazione coinvolta.";

      // Bloc restriction
      const { data: attackerBloc } = await supabase.from('bloc_memberships').select('blocId').eq('stateId', region.id).eq('status', 'active').maybeSingle();
      const { data: defenderBloc } = await supabase.from('bloc_memberships').select('blocId').eq('stateId', params.targetRegionId).eq('status', 'active').maybeSingle();
      if (attackerBloc && defenderBloc && attackerBloc.blocId === defenderBloc.blocId) {
        return "Non puoi dichiarare guerra a un membro dello stesso Blocco Geopolitico.";
      }

      const { count: activeWars } = await supabase.from('wars').select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .or(`attackerCountryIso2.eq.${region.id},defenderCountryIso2.eq.${region.id}`);

      const baseCost = 50000;
      const cost = Math.floor(baseCost * (1 + 0.25 * (activeWars || 0)));
      const { data: budget } = await supabase.from('budgets').select('moneyEUR').eq('ownerType', 'REGION').eq('ownerId', region.id).single();
      if (!budget || budget.moneyEUR < cost) return `Fondi in bilancio insufficienti ($${cost} richiesti assecondando le guerre simultanee).`;

      return null;
    },
    execute: async (region, params) => {
      const { count: activeWars } = await supabase.from('wars').select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .or(`attackerCountryIso2.eq.${region.id},defenderCountryIso2.eq.${region.id}`);

      const baseCost = 50000;
      const cost = Math.floor(baseCost * (1 + 0.25 * (activeWars || 0)));
      const nowIso = new Date().toISOString();

      await supabase.rpc('add_budget_transaction', {
        p_owner_type: 'REGION',
        p_owner_id: region.id,
        p_type: 'EXPENSE',
        p_subtype: 'WAR_START',
        p_money_delta: -cost,
        p_metadata: { target: params.targetRegionId }
      });

      await supabase.from('wars').insert({
        id: `war_${Date.now()}_${region.id}_${params.targetRegionId}`,
        attackerCountryIso2: region.id,
        defenderCountryIso2: params.targetRegionId,
        status: 'active',
        startedAt: nowIso,
        endsAt: new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString(),
        attackerScore: 0,
        defenderScore: 0,
        lastEventAt: nowIso
      });
    }
  },
  peace_treaty: {
    category: "Guerra e Diplomazia",
    icon: "Handshake",
    title: "Trattato di Pace",
    description: "Propone o accetta la fine delle ostilità con una nazione in guerra.",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region, params) => {
      if (!params || !params.targetRegionId) return "ID Nazione bersaglio obbligatorio.";
      const { data: target } = await supabase.from('regions').select('id').eq('id', params.targetRegionId).single();
      if (!target) return "Nazione bersaglio inesistente.";
      const { data: existingWar } = await supabase.from('wars').select('id')
        .eq('status', 'active')
        .or(`attackerCountryIso2.eq.${region.id},defenderCountryIso2.eq.${region.id}`)
        .or(`attackerCountryIso2.eq.${params.targetRegionId},defenderCountryIso2.eq.${params.targetRegionId}`)
        .maybeSingle();
      if (!existingWar) return "Non c'è una guerra attiva con questa nazione.";
      return null;
    },
    execute: async (region, params) => {
      const { data: existingWar } = await supabase.from('wars').select('*')
        .eq('status', 'active')
        .or(`attackerCountryIso2.eq.${region.id},defenderCountryIso2.eq.${region.id}`)
        .or(`attackerCountryIso2.eq.${params.targetRegionId},defenderCountryIso2.eq.${params.targetRegionId}`)
        .maybeSingle();

      if (existingWar) {
        // Determine winner based on scores
        let winner = null;
        let loser = null;
        if (existingWar.attackerScore > existingWar.defenderScore) {
          winner = existingWar.attackerCountryIso2;
          loser = existingWar.defenderCountryIso2;
        } else if (existingWar.defenderScore > existingWar.attackerScore) {
          winner = existingWar.defenderCountryIso2;
          loser = existingWar.attackerCountryIso2;
        }

        // Execute War Loot Transfer if there's a clear winner
        if (winner && loser) {
          const { data: loserBudget } = await supabase.from('budgets').select('moneyEUR').eq('ownerType', 'REGION').eq('ownerId', loser).single();
          if (loserBudget && loserBudget.moneyEUR > 0) {
            const stolenMoney = loserBudget.moneyEUR;

            await supabase.rpc('add_budget_transaction', {
              p_owner_type: 'REGION',
              p_owner_id: loser,
              p_type: 'WAR_LOOT',
              p_subtype: 'LOOT_LOST',
              p_money_delta: -stolenMoney,
              p_metadata: { to: winner, warId: existingWar.id }
            });

            await supabase.rpc('add_budget_transaction', {
              p_owner_type: 'REGION',
              p_owner_id: winner,
              p_type: 'WAR_LOOT',
              p_subtype: 'LOOT_WON',
              p_money_delta: stolenMoney,
              p_metadata: { from: loser, warId: existingWar.id }
            });
          }
        }
        await supabase.from('wars').update({ status: 'ended', endsAt: new Date().toISOString() }).eq('id', existingWar.id);
      }
    }
  },
  apply_sanctions: {
    category: "Diplomazia",
    icon: "ShieldAlert",
    title: "Applica Sanzioni",
    description: "Impedisce il commercio e gli spostamenti da/verso la nazione bersaglio.",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region, params) => {
      if (!params || !params.targetRegionId) return "ID Nazione bersaglio obbligatorio.";
      const { data: target } = await supabase.from('regions').select('id').eq('id', params.targetRegionId).single();
      if (!target) return "Nazione bersaglio inesistente.";
      if (params.targetRegionId === region.id) return "Non puoi sanzionare te stesso.";

      const { data: existing } = await supabase.from('sanctions').select('id').eq('fromStateId', region.id).eq('targetStateId', params.targetRegionId).eq('status', 'ACTIVE').maybeSingle();
      if (existing) return "Esiste già una sanzione attiva contro questa nazione.";
      return null;
    },
    execute: async (region, params, sourceLawId) => {
      const { data: law } = await supabase.from('laws').select('proposerId').eq('id', sourceLawId).single();
      const creatorId = law ? law.proposerId : region.ownerUserId;

      await supabase.from('sanctions').insert({
        id: `sanc_${Date.now()}_${region.id}_${params.targetRegionId}`,
        fromStateId: region.id,
        targetStateId: params.targetRegionId,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        createdByUserId: creatorId
      });
    }
  },
  revoke_sanctions: {
    category: "Diplomazia",
    icon: "Unlock",
    title: "Revoca Sanzioni",
    description: "Annulla le sanzioni attive verso una nazione.",
    threshold: 0.5,
    delayDays: 1,
    validate: async (region, params) => {
      if (!params || !params.targetRegionId) return "ID Nazione bersaglio obbligatorio.";
      const { data: existing } = await supabase.from('sanctions').select('id').eq('fromStateId', region.id).eq('targetStateId', params.targetRegionId).eq('status', 'ACTIVE').maybeSingle();
      if (!existing) return "Non c'è una sanzione attiva da revocare.";
      return null;
    },
    execute: async (region, params, sourceLawId) => {
      const { data: law } = await supabase.from('laws').select('proposerId').eq('id', sourceLawId).single();
      const revokerId = law ? law.proposerId : region.ownerUserId;

      await supabase.from('sanctions').update({ status: 'REVOKED', revokedAt: new Date().toISOString(), revokedByUserId: revokerId })
        .eq('fromStateId', region.id).eq('targetStateId', params.targetRegionId).eq('status', 'ACTIVE');
    }
  }
};

app.get("/api/parliament/laws", authenticate, async (req: any, res) => {
  const regionId = req.query.regionId || req.user.residenceId;
  if (!regionId) return res.status(400).json({ error: "Region ID required" });

  try {
    const { data: laws, error } = await supabase
      .from('laws')
      .select('*, proposerName:users!proposerId(username)')
      .eq('regionId', regionId)
      .order('createdAt', { ascending: false });

    if (error) throw error;

    const lawsWithVotes = await Promise.all((laws || []).map(async (l: any) => {
      const { data: votes } = await supabase
        .from('law_votes')
        .select('vote, voterId')
        .eq('lawId', l.id);

      const proCount = (votes || []).filter(v => v.vote === 'yes' || v.vote === 'pro').length;
      const contraCount = (votes || []).filter(v => v.vote === 'no' || v.vote === 'contra').length;
      const myVote = (votes || []).find(v => v.voterId === req.user.id)?.vote || null;

      return {
        ...l,
        proposerName: l.proposerName?.username || 'Sconosciuto',
        yesVotes: proCount,
        noVotes: contraCount,
        myVote
      };
    }));

    const registryForFrontend = Object.entries(LawRegistry).reduce((acc: any, [key, law]: any) => {
      acc[key] = {
        category: law.category,
        icon: law.icon,
        title: law.title,
        description: law.description,
        threshold: law.threshold,
        delayDays: law.delayDays
      };
      return acc;
    }, {});

    res.json({ laws: lawsWithVotes, registry: registryForFrontend });
  } catch (err: any) {
    console.error("Error fetching laws:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/parliament/laws/propose", authenticate, async (req: any, res) => {
  const user = req.user;
  const { type, params } = req.body;

  try {
    const lawDef = LawRegistry[type];
    if (!lawDef) return res.status(400).json({ error: "Tipo di legge sconosciuto." });

    const { data: region, error: regionError } = await supabase.from('regions').select('*').eq('id', user.residenceId).single();
    if (regionError || !region) return res.status(404).json({ error: "Regione non trovata." });

    const { data: isMp } = await supabase.from('parliament_members').select('userId').eq('userId', user.id).eq('regionId', user.residenceId).maybeSingle();
    const isLeader = region.ownerUserId === user.id;
    const isForeignMinister = region.foreignMinisterId === user.id;
    const isMigrationLaw = type === 'migration_agreement' || type === 'revoke_migration_agreement';

    if (!isMp && !isLeader && !(isForeignMinister && isMigrationLaw)) {
      return res.status(403).json({ error: "Non hai i permessi per proporre leggi in questa regione." });
    }

    // specific dict check
    if (type === "proclaim_dictatorship") {
      const dictatorshipAttempts = (region.dictatorshipAttempts || 0) + 1;
      if (dictatorshipAttempts > 2) {
        return res.status(400).json({ error: "Hai già raggiunto il limite di 2 tentativi di dittatura in questo mandato parlamentare." });
      }
      await supabase.from('regions').update({ dictatorshipAttempts }).eq('id', region.id);
    }

    const validationError = await lawDef.validate(region, params, user);
    if (validationError) return res.status(400).json({ error: validationError });

    const { data: activeLaw } = await supabase.from('laws').select('id')
      .eq('regionId', region.id)
      .eq('type', type)
      .in('status', ['pending', 'pending_assent'])
      .maybeSingle();

    if (activeLaw) return res.status(400).json({ error: "Una proposta simile è già in votazione o in attesa di sanzione." });

    const lawId = `law_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const nowIso = new Date().toISOString();

    // Check Dictatorship / Autocracies
    const autocracies = ["DICTATORSHIP", "ONE_PARTY_SYSTEM"];
    if (region.dictatorship || autocracies.includes(region.governmentForm)) {
      if (!isLeader) return res.status(403).json({ error: "In questo regime solo il Leader può legiferare." });

      await supabase.from('laws').insert({
        id: lawId, regionId: region.id, proposerId: user.id, type, params, status: 'passed', createdAt: nowIso, expiresAt: nowIso
      });

      await lawDef.execute(region, params, lawId);
      return res.json({ success: true, lawId, immediate: true });
    }

    // Normal Democracy / Executive Monarchy
    const isEconomicsMinister = region.economicAdviserId === user.id;
    const lawCat = lawDef.category;
    const canFastPass = (isEconomicsMinister && (lawCat === "Economia e Tasse" || lawCat === "Costruzioni Statali")) ||
      (isForeignMinister && (type === 'open_borders' || type === 'close_borders'));

    if (canFastPass) {
      await supabase.from('laws').insert({
        id: lawId, regionId: region.id, proposerId: user.id, type, params, status: 'passed', createdAt: nowIso, expiresAt: nowIso
      });
      await lawDef.execute(region, params, lawId);
      return res.json({ success: true, lawId, immediate: true, message: "Legge approvata immediatamente grazie ai tuoi poteri ministeriali." });
    }

    const expiresAt = new Date(Date.now() + (lawDef.delayDays * 24 * 60 * 60 * 1000)).toISOString();
    await supabase.from('laws').insert({
      id: lawId, regionId: region.id, proposerId: user.id, type, params, status: 'pending', createdAt: nowIso, expiresAt
    });

    // Auto-vote PRO
    await supabase.from('law_votes').insert({ lawId, voterId: user.id, vote: 'yes', createdAt: nowIso });

    res.json({ success: true, lawId, immediate: false });
  } catch (err: any) {
    console.error("Error proposing law:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/parliament/laws/vote", authenticate, async (req: any, res) => {
  const user = req.user;
  const { lawId, vote } = req.body; // vote: 'yes' or 'no'

  if (!['yes', 'no'].includes(vote)) return res.status(400).json({ error: "Voto non valido." });

  try {
    const { data: law, error: lawError } = await supabase.from('laws').select('*').eq('id', lawId).single();
    if (lawError || !law) return res.status(404).json({ error: "Legge non trovata." });

    const { data: region, error: regionError } = await supabase.from('regions').select('*').eq('id', law.regionId).single();
    if (regionError || !region) return res.status(404).json({ error: "Regione non trovata." });

    // Handle Assent Phase (Executive Monarchy)
    if (law.status === 'pending_assent') {
      if (region.governmentForm !== "EXECUTIVE_MONARCHY") {
        return res.status(400).json({ error: "L'Assenso del Sovrano si applica solo in Monarchia Esecutiva." });
      }

      const isEconomyLaw = LawRegistry[law.type]?.category === "Economia e Tasse";
      const canAssent = (isEconomyLaw && (user.id === region.economicAdviserId || user.id === region.ownerUserId)) ||
        (!isEconomyLaw && user.id === region.ownerUserId);

      if (!canAssent) {
        return res.status(403).json({ error: "Non hai l'autorità per sanzionare o porre veto a questa legge." });
      }

      const nowIso = new Date().toISOString();
      if (vote === 'yes' || vote === 'assent') {
        await supabase.from('laws').update({ status: 'passed' }).eq('id', lawId);
        try {
          await LawRegistry[law.type]?.execute(region, law.params, law.id);
        } catch (e) {
          console.error(`Error executing law ${law.type} after assent:`, e);
        }
        return res.json({ success: true, result: 'passed' });
      } else {
        await supabase.from('laws').update({ status: 'rejected' }).eq('id', lawId);
        return res.json({ success: true, result: 'vetoed' });
      }
    }

    // Normal Voting Phase
    if (law.status !== 'pending') return res.status(400).json({ error: "Votazione chiusa." });

    const { data: isMp } = await supabase.from('parliament_members').select('userId').eq('userId', user.id).eq('regionId', law.regionId).maybeSingle();
    const isLeader = region.ownerUserId === user.id;

    if (!isMp && !isLeader) {
      return res.status(403).json({ error: "Solo i Parlamentari o il Leader possono votare le leggi." });
    }

    const { error: upsertError } = await supabase.from('law_votes').upsert({
      lawId,
      voterId: user.id,
      vote,
      createdAt: new Date().toISOString()
    });

    if (upsertError) throw upsertError;

    res.json({ success: true });
  } catch (err: any) {
    console.error("Error voting on law:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/parliament/laws/withdraw", authenticate, async (req: any, res) => {
  const user = req.user;
  const { lawId } = req.body;

  const { data: law, error: lError } = await supabase
    .from('laws')
    .select('*')
    .eq('id', lawId)
    .single();

  if (lError || !law) return res.status(404).json({ error: "Legge non trovata." });
  if (law.status !== 'pending' && law.status !== 'pending_assent') return res.status(400).json({ error: "Puoi ritirare solo leggi attualmente in votazione." });
  if (law.proposerId !== user.id) return res.status(403).json({ error: "Solo il creatore della proposta può ritirarla." });

  const { error: uError } = await supabase
    .from('laws')
    .update({ status: 'withdrawn' })
    .eq('id', lawId);

  if (uError) return res.status(500).json({ error: uError.message });
  res.json({ success: true });
});

// Minister Fast-Pass: approve a pending law immediately
app.post("/api/parliament/laws/pass", authenticate, async (req: any, res) => {
  const user = req.user;
  const { lawId } = req.body;

  try {
    const { data: law, error: lawError } = await supabase.from('laws').select('*').eq('id', lawId).single();
    if (lawError || !law) return res.status(404).json({ error: "Legge non trovata." });
    if (law.status !== 'pending') return res.status(400).json({ error: "Solo leggi in votazione possono essere approvate via Fast-Pass." });

    const { data: region, error: regionError } = await supabase.from('regions').select('*').eq('id', law.regionId).single();
    if (regionError || !region) return res.status(404).json({ error: "Regione non trovata." });

    const lawDef = LawRegistry[law.type];
    if (!lawDef) return res.status(400).json({ error: "Tipo di legge sconosciuto." });

    // Check if user has fast-pass authority
    const isEconomicsMinister = region.economicAdviserId === user.id;
    const isForeignMinister = region.foreignMinisterId === user.id;
    const lawCat = lawDef.category;

    const canFastPass = (isEconomicsMinister && (lawCat === "Economia e Tasse" || lawCat === "Costruzioni Statali")) ||
      (isForeignMinister && (law.type === 'open_borders' || law.type === 'close_borders' || lawCat === 'Diplomacy' || lawCat === 'Residency'));

    if (!canFastPass) {
      return res.status(403).json({ error: "Non hai i poteri ministeriali per approvare questa legge via Fast-Pass." });
    }

    await supabase.from('laws').update({ status: 'passed', expiresAt: new Date().toISOString() }).eq('id', lawId);

    try {
      await lawDef.execute(region, law.params, law.id);
    } catch (e) {
      console.error(`Error executing fast-passed law ${law.type}:`, e);
    }

    res.json({ success: true, message: "Legge approvata via Fast-Pass ministeriale." });
  } catch (err: any) {
    console.error("Error in fast-pass:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/leaderboard", authenticate, async (req, res) => {
  const { data: leaders, error } = await supabase
    .from('users')
    .select('username, influence, money')
    .order('influence', { ascending: false })
    .limit(10);

  if (error) return res.status(500).json({ error: error.message });
  res.json(leaders);
});

// Election Cronjob - Migrated to Supabase
async function checkAndResolveElections() {
  const { data: regions } = await supabase.from('regions').select('id');
  if (!regions) return;

  const now = Date.now();
  const nowIso = new Date().toISOString();
  const electionDuration = 3 * 24 * 60 * 60 * 1000; // 3 days

  const { data: activeElections } = await supabase.from('elections').select('*').eq('status', 'active');
  const activeElectionByRegion = new Map(activeElections?.map((e: any) => [e.regionId, e]) || []);

  for (const r of regions) {
    const activeElection = activeElectionByRegion.get(r.id);

    if (!activeElection) {
      await supabase.from('elections').insert({
        id: Math.random().toString(36).substring(2, 11),
        regionId: r.id,
        status: 'active',
        createdAt: nowIso,
        closesAt: new Date(now + electionDuration).toISOString()
      });
    } else if (new Date(activeElection.closesAt).getTime() <= now) {
      // Resolve election
      await supabase.from('elections').update({ status: 'closed' }).eq('id', activeElection.id);

      const { data: partyVotes } = await supabase.rpc('get_election_votes_count', { p_election_id: activeElection.id });
      // Note: We need a helper RPC for complex grouping like this if we want it to be efficient.
      // Alternatively, we can fetch all and group in JS (less scalable but okay for small scale).

      // Let's assume we have our RPC or we use a more standard query.
      const totalVotes = partyVotes?.reduce((sum: number, pv: any) => sum + pv.count, 0) || 0;

      await supabase.from('parliament_members').delete().eq('regionId', r.id);

      if (totalVotes > 0) {
        const totalSeats = 20;
        for (const pv of (partyVotes || [])) {
          const wonSeats = Math.round((pv.count / totalVotes) * totalSeats);
          if (wonSeats > 0) {
            // Get top candidates from primaries for this party
            const cyclePeriodMs = 5 * 24 * 60 * 60 * 1000;
            const currentCycleStart = new Date(now - cyclePeriodMs).toISOString();

            const { data: candidates } = await supabase
              .from('party_primaries')
              .select('candidateId, count:candidateId.count()')
              .eq('partyId', pv.partyId)
              .gte('createdAt', currentCycleStart)
              .order('count', { ascending: false })
              .limit(wonSeats);

            let finalCandidates = candidates?.map((c: any) => c.candidateId) || [];

            if (finalCandidates.length < wonSeats) {
              const { data: fallback } = await supabase
                .from('party_members')
                .select('userId, users(level)')
                .eq('partyId', pv.partyId)
                .not('userId', 'in', `(${finalCandidates.join(',') || 'NULL'})`)
                .order('users(level)', { ascending: false })
                .limit(wonSeats - finalCandidates.length);

              if (fallback) {
                finalCandidates = [...finalCandidates, ...fallback.map((f: any) => f.userId)];
              }
            }

            for (const mpId of finalCandidates) {
              await supabase.from('parliament_members').insert({
                userId: mpId, regionId: r.id, partyId: pv.partyId, electedAt: nowIso
              });
            }
          }
        }
      }

      // Automatically scheduled by logic above (activeElection resolved, insertion happens next tick or we can insert now)
    }
  }
}

async function checkAndResolveLeaderElections() {
  const now = Date.now();
  const nowIso = new Date().toISOString();
  const { data: regions } = await supabase
    .from('regions')
    .select('id, governmentForm, nextLeaderElectionAt')
    .in('governmentForm', ['PRESIDENTIAL_REPUBLIC', 'DOMINANT_PARTY']);

  if (!regions) return;

  for (const r of regions) {
    if (!r.nextLeaderElectionAt) {
      const firstElection = new Date(now + (5 * 24 * 60 * 60 * 1000)).toISOString();
      await supabase.from('regions').update({ nextLeaderElectionAt: firstElection }).eq('id', r.id);
      continue;
    }

    if (new Date(r.nextLeaderElectionAt).getTime() <= now) {
      const { data: winner } = await supabase
        .from('leader_candidates')
        .select('userId, votes')
        .eq('regionId', r.id)
        .order('votes', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (winner) {
        const title = r.governmentForm === 'PRESIDENTIAL_REPUBLIC' ? 'Presidente' : 'Leader';
        await supabase.from('regions').update({
          leaderUserId: winner.userId,
          leaderTitle: title,
          nextLeaderElectionAt: new Date(now + (5 * 24 * 60 * 60 * 1000)).toISOString()
        }).eq('id', r.id);

        await supabase.from('ministers').update({ status: 'REVOKED' }).eq('stateId', r.id);
        await supabase.from('regions').update({ economicAdviserId: null, foreignMinisterId: null }).eq('id', r.id);
      }

      await supabase.from('leader_candidates').delete().eq('regionId', r.id);
      await supabase.from('leader_votes').delete().eq('regionId', r.id);
    }
  }
}

async function checkAndResolveLaws() {
  const nowIso = new Date().toISOString();

  const { data: pendingLaws } = await supabase
    .from('laws')
    .select('*, regions(governmentForm)')
    .eq('status', 'pending')
    .lte('expiresAt', nowIso);

  if (!pendingLaws) return;

  for (const law of pendingLaws) {
    const { data: votes } = await supabase
      .from('law_votes')
      .select('vote')
      .eq('lawId', law.id);

    const yes = votes?.filter(v => v.vote === 'yes').length || 0;
    const no = votes?.filter(v => v.vote === 'no').length || 0;
    const totalVotes = yes + no;

    const lawDef = LawRegistry[law.type];
    if (!lawDef) {
      await supabase.from('laws').update({ status: 'rejected' }).eq('id', law.id);
      continue;
    }

    const passRatio = totalVotes > 0 ? (yes / totalVotes) : 0;
    let passed = false;

    if (lawDef.threshold === 0.5) {
      passed = yes > no;
    } else {
      passed = totalVotes > 0 && passRatio >= lawDef.threshold;
    }

    if (passed) {
      // Accessing governmentForm from joined regions relation
      const govForm = (law.regions as any)?.governmentForm;
      if (govForm === "EXECUTIVE_MONARCHY") {
        await supabase.from('laws').update({ status: 'pending_assent' }).eq('id', law.id);
        continue;
      }

      await supabase.from('laws').update({ status: 'passed' }).eq('id', law.id);

      try {
        const { data: region } = await supabase.from('regions').select('*').eq('id', law.regionId).single();
        if (region) {
          const params = law.params ? (typeof law.params === 'string' ? JSON.parse(law.params) : law.params) : { newValue: law.newValue };
          await lawDef.execute(region, params, law.id);
        }
      } catch (e) {
        console.error(`Error executing law ${law.type} (${law.id}):`, e);
      }
    } else {
      await supabase.from('laws').update({ status: 'rejected' }).eq('id', law.id);
    }
  }
}

// Budget Cronjob Automation
async function budgetMaintenanceTick() {
  try {
    const { data: regions } = await supabase.from('regions').select('id, workRestrictions, residencePolicy');
    if (!regions) return;

    // Cost definitions
    const borderClosedCost = 100; // $100 per minute
    const residenceRestrictedCost = 50; // $50 per minute

    for (const r of regions) {
      let maintenanceCost = 0;
      let reasons: string[] = [];

      if (r.workRestrictions === 1) {
        maintenanceCost += borderClosedCost;
        reasons.push("Confini chiusi");
      }
      if (r.residencePolicy !== 'open') {
        maintenanceCost += residenceRestrictedCost;
        reasons.push("Residenza controllata");
      }

      if (maintenanceCost > 0) {
        try {
          await supabase.rpc('add_budget_transaction', {
            p_owner_type: 'REGION',
            p_owner_id: r.id,
            p_type: 'EXPENSE',
            p_subtype: 'BORDERS_MAINTENANCE',
            p_money_delta: -maintenanceCost,
            p_metadata: { reasons }
          });
        } catch (e) {
          // Budget insufficient, auto-open borders and free residence
          await supabase.from('regions').update({ workRestrictions: 0, residencePolicy: 'open' }).eq('id', r.id);
          console.log(`Region ${r.id} ran out of budget for maintenance. Borders auto-opened.`);
        }
      }
    }
  } catch (error) {
    console.error("Error in budgetMaintenanceTick:", error);
  }
}

// War Resolution Cronjob
async function checkAndResolveWars() {
  try {
    const { data: expiredWars } = await supabase
      .from('wars')
      .select('*')
      .eq('status', 'active')
      .lt('endsAt', new Date().toISOString());

    if (!expiredWars || expiredWars.length === 0) return;

    for (const war of expiredWars) {
      let winner = null;
      let loser = null;

      if (war.attackerScore > war.defenderScore) {
        winner = war.attackerCountryIso2;
        loser = war.defenderCountryIso2;
      } else if (war.defenderScore > war.attackerScore) {
        winner = war.defenderCountryIso2;
        loser = war.attackerCountryIso2;
      }

      if (winner && loser) {
        // Transfer Treasury (Loot)
        const { data: loserBudget } = await supabase.from('budgets').select('moneyEUR').eq('ownerType', 'REGION').eq('ownerId', loser).single();
        if (loserBudget && loserBudget.moneyEUR > 0) {
          const loot = loserBudget.moneyEUR;

          await supabase.rpc('add_budget_transaction', {
            p_owner_type: 'REGION',
            p_owner_id: loser,
            p_type: 'EXPENSE',
            p_subtype: 'WAR_LOOT_LOST',
            p_money_delta: -loot,
            p_metadata: { to: winner, warId: war.id }
          });

          await supabase.rpc('add_budget_transaction', {
            p_owner_type: 'REGION',
            p_owner_id: winner,
            p_type: 'INCOME',
            p_subtype: 'WAR_LOOT_WON',
            p_money_delta: loot,
            p_metadata: { from: loser, warId: war.id }
          });

          console.log(`[WAR] ${winner} looted ${loot} EUR from ${loser}`);
        }

        // Conquest Logic: If Attacker wins, they take over the region
        if (winner === war.attackerCountryIso2) {
          const { data: attackerRegion } = await supabase.from('regions').select('leaderUserId, nationId').eq('id', winner).single();
          if (attackerRegion && attackerRegion.leaderUserId) {
            await supabase.from('regions').update({
              ownerUserId: attackerRegion.leaderUserId,
              nationId: attackerRegion.nationId || `nation_${winner}`,
              stability: 30
            }).eq('id', loser);

            console.log(`[WAR] ${winner} CONQUERED ${loser}. Region added to nation: ${attackerRegion.nationId}`);
          }
        }
      }

      await supabase.from('wars').update({ status: 'ended', endsAt: new Date().toISOString() }).eq('id', war.id);
    }
  } catch (error) {
    console.error("Error in checkAndResolveWars:", error);
  }
}

// Vite middleware for development
async function startServer() {
  checkAndResolveElections();
  checkAndResolveLeaderElections();
  checkAndResolveLaws();
  checkAndResolveWars();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  }).on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`FATAL ERROR: Port ${PORT} is already in use.`);
    } else {
      console.error("FATAL ERROR: Server failed to start:", err);
    }
    process.exit(1);
  });

  // Global Budget Tick (every 60 seconds)
  setInterval(() => {
    try {
      budgetMaintenanceTick();
    } catch (e) {
      console.error("Budget tick error:", e);
    }
  }, 60 * 1000);

  // Global Economy Tick (every 10 minutes)
  // DISABLED: Regions are now passive containers.
  /*
  setInterval(async () => {
    console.log("Running economy tick...");
    // Future: Migrate this to a Supabase Cron or Edge Function if needed.
  }, 10 * 60 * 1000);
  */

  // Game Cronjobs (Laws and Elections)
  setInterval(() => {
    checkAndResolveElections();
    checkAndResolveLaws();
    checkAndResolveWars();
  }, 60 * 1000); // Check every minute
}

startServer();
