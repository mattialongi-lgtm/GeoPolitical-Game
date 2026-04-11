/**
 * User & Profile Handlers
 *
 * Extracted from server.ts — no logic changes.
 * Covers: /api/me, /api/players, /api/players/:id,
 *   /api/profile/avatar, /api/profile/username,
 *   /api/actions/change-displayed-nation, /api/actions/change-original-nation,
 *   /api/dev/add-currency
 */
import { logger } from '../utils/logger';

const PLAYERS_BASE_SELECT = 'id, username, regionId, originalNation, level, lastLogin';
const PUBLIC_PLAYER_PROFILE_SELECT = [
  'id',
  'username',
  'money',
  'gold',
  'energy',
  'xp',
  'level',
  'regionId',
  'residenceId',
  'workPermitId',
  'originalNation',
  'displayedNation',
  'lastOriginalNationChange',
  'lastEnergyUpdate',
  'energyDrinks',
  'lastEnergyDrink',
  'warMedals',
  'lastMedalClaim',
  'lastLogin',
  'perkUpgradesJson',
  'travelingTo',
  'travelingUntil',
  'travelingFrom',
  'travelDurationMs',
  'militaryExp',
  'avatarData',
  'createdAt',
].join(', ');

export function createUserHandlers(deps: {
  supabase: any;
  getUserPerks: (userId: string, boosterInfo?: Record<string, any>) => Promise<Record<string, number>>;
  isAllowedAvatarDataUrl: (value: string) => boolean;
  IS_PRODUCTION: boolean;
  ENABLE_DEV_ENDPOINTS: boolean;
}) {
  const { supabase, getUserPerks, isAllowedAvatarDataUrl, IS_PRODUCTION, ENABLE_DEV_ENDPOINTS } = deps;

  // GET /api/me — OPTIMIZED: minimal response for frequent polling (every 20s)
  // Returns only core state: money, gold, energy, regions, travel status, perks/boosters JSON
  // Heavy data (inventory, party membership, work experience) loaded separately by /api/sync-state
  function getMe(req: any, res: any) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json(req.user);
  }

  // GET /api/players
  async function getPlayers(req: any, res: any) {
    try {
      const onlyOnline = String(req.query.online || '').toLowerCase() === 'true';
      const includeAvatar = String(req.query.includeAvatar || '').toLowerCase() === 'true';
      const onlineThreshold = Date.now() - 5 * 60 * 1000;
      const playersSelect = includeAvatar ? `${PLAYERS_BASE_SELECT}, avatarData` : PLAYERS_BASE_SELECT;

      let query = supabase
        .from('users')
        .select(playersSelect, { count: 'exact' })
        .not('username', 'ilike', 'app_%')
        .not('username', 'ilike', 'mgr_%')
        .not('username', 'ilike', 'out_%')
        .not('username', 'ilike', 'res_%')
        .order('level', { ascending: false })
        .limit(200);

      if (onlyOnline) query = query.gte('lastLogin', onlineThreshold);

      const { data, count, error } = await query;
      if (error) throw error;

      res.json({
        players: data || [],
        total: count || 0,
        onlineOnly: onlyOnline,
        onlineThreshold,
      });
    } catch (err: any) {
      console.error("Error fetching players:", err);
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  // GET /api/players/:id
  async function getPlayerById(req: any, res: any) {
    console.log(`[ProfileRequest] Fetching player ${req.params.id}`);
    try {
      const { data: player, error } = await supabase
        .from('users')
        .select(PUBLIC_PLAYER_PROFILE_SELECT)
        .eq('id', req.params.id)
        .single();
      if (error || !player) {
        console.log(`[ProfileRequest] Player ${req.params.id} NOT FOUND in users table. Supabase error:`, error?.message);
        return res.status(404).json({ error: "Giocatore non trovato" });
      }

      // Attach party membership (name/logo) for public profile.
      try {
        const { data: membership } = await supabase
          .from('party_members')
          .select('partyId, parties(name, logo)')
          .eq('userId', player.id)
          .maybeSingle() as any;

        if (membership) {
          player.partyId = membership.partyId;
          player.partyName = membership.parties?.name;
          player.partyLogo = membership.parties?.logo;
        }
      } catch (partyErr) {
        console.error("[ProfileRequest] Error loading party membership:", partyErr);
      }

      // Attach perks and upgrade queue for public profile.
      try {
        player.perks = await getUserPerks(player.id);
      } catch (perkErr) {
        console.error("[ProfileRequest] Error loading perks:", perkErr);
        player.perks = {};
      }
      try {
        player.perkUpgrades = JSON.parse(player.perkUpgradesJson || '{}');
      } catch {
        player.perkUpgrades = {};
      }

      console.log(`[ProfileRequest] Player FOUND: ${player.username}, sending data...`);
      // Remove sensitive data
      delete player.email;
      delete player.password;

      res.json(player);
    } catch (err: any) {
      res.status(500).json({ error: "Errore nel caricamento del profilo" });
    }
  }

  // POST /api/actions/change-displayed-nation
  async function changeDisplayedNation(req: any, res: any) {
    const user = req.user;
    const { nationId } = req.body;
    if (!nationId) return res.status(400).json({ error: "Nessuna nazione specificata." });

    await supabase.from('users').update({ displayedNation: nationId }).eq('id', user.id);
    res.json({ success: true, displayedNation: nationId });
  }

  // POST /api/actions/change-original-nation
  async function changeOriginalNation(req: any, res: any) {
    const user = req.user;
    const { nationId } = req.body;
    if (!nationId) return res.status(400).json({ error: "Nessuna nazione specificata." });
    const normalizedNationId = String(nationId).trim().toUpperCase();

    const { data: nationExists, error: nationError } = await supabase
      .from('nations')
      .select('id')
      .eq('id', normalizedNationId)
      .maybeSingle();

    if (nationError) return res.status(500).json({ error: "Errore nel controllo della nazione." });
    if (!nationExists) return res.status(400).json({ error: "Nazione non valida." });

    const now = Date.now();
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    if (now - (user.lastOriginalNationChange || 0) < THIRTY_DAYS && user.lastOriginalNationChange !== 0) {
      const nextAvail = new Date(user.lastOriginalNationChange + THIRTY_DAYS).toLocaleDateString();
      return res.status(400).json({ error: `Puoi cambiare di nuovo la Nazione Originale il ${nextAvail}.` });
    }

    await supabase.from('users').update({
      originalNation: normalizedNationId,
      lastOriginalNationChange: now
    }).eq('id', user.id);

    res.json({ success: true, originalNation: normalizedNationId, lastOriginalNationChange: now });
  }

  // GET /api/profile/avatar
  async function getMyAvatar(req: any, res: any) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('avatarData')
        .eq('id', req.user.id)
        .single();

      if (error) throw error;
      return res.json({ avatarData: data?.avatarData || null });
    } catch (err: any) {
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      return res.status(500).json({ error: "Errore nel caricamento avatar" });
    }
  }

  // POST /api/profile/avatar
  async function updateAvatar(req: any, res: any) {
    const { avatarData } = req.body;
    if (!avatarData || typeof avatarData !== "string") {
      return res.status(400).json({ error: "Dati immagine mancanti" });
    }
    if (!isAllowedAvatarDataUrl(avatarData)) {
      return res.status(400).json({ error: "Formato immagine non valido" });
    }
    if (avatarData.length > 260000) {
      return res.status(400).json({ error: "Immagine troppo grande (max ~190KB)" });
    }
    await supabase.from('users').update({ avatarData }).eq('id', req.user.id);
    res.json({ success: true, avatarData });
  }

  // PUT /api/profile/username
  async function updateUsername(req: any, res: any) {
    const { username } = req.body;
    if (!username || typeof username !== "string") return res.status(400).json({ error: "Username mancante" });
    const trimmed = username.trim();
    if (trimmed.length < 3 || trimmed.length > 20) return res.status(400).json({ error: "Username deve essere tra 3 e 20 caratteri" });
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) return res.status(400).json({ error: "Solo lettere, numeri e underscore" });

    try {
      const { error: uError } = await supabase.from('users').update({ username: trimmed }).eq('id', req.user.id);
      if (uError) throw uError;

      await supabase.from('articles').update({ authorName: trimmed }).eq('authorId', req.user.id);

      res.json({ success: true, username: trimmed });
    } catch (e: any) {
      if (e.message?.includes("duplicate")) return res.status(409).json({ error: "Username già in uso" });
      res.status(500).json({ error: "Errore interno: " + e.message });
    }
  }

  // POST /api/dev/add-currency
  async function addCurrency(req: any, res: any) {
    if (IS_PRODUCTION || !ENABLE_DEV_ENDPOINTS) {
      return res.status(404).json({ error: "Endpoint non disponibile." });
    }

    const { cash = 10000, gold = 10000 } = req.body;
    const cashNum = Number(cash);
    const goldNum = Number(gold);
    if (!Number.isFinite(cashNum) || !Number.isFinite(goldNum) || cashNum < 0 || goldNum < 0) {
      return res.status(400).json({ error: "Valori non validi." });
    }

    const { data: user } = await supabase.from('users').select('money, gold').eq('id', req.user.id).single();
    if (user) {
      await supabase.from('users').update({
        money: (user.money || 0) + cashNum,
        gold: (user.gold || 0) + goldNum
      }).eq('id', req.user.id);
    }
    res.json({ success: true, cash: cashNum, gold: goldNum });
  }

  // POST /api/sync-state — Load heavy data & execute side effects
  // Called less frequently (e.g., 60s or on demand) instead of every auth request
  async function syncState(req: any, res: any) {
    const user = req.user;
    const userId = user.id;
    const nowTs = Date.now();

    try {
      // ▼ 1. Load party membership (join query)
      try {
        const { data: membership } = await supabase
          .from('party_members')
          .select('partyId, parties(name, logo)')
          .eq('userId', userId)
          .maybeSingle() as any;

        if (membership) {
          user.partyId = membership.partyId;
          user.partyName = membership.parties?.name;
          user.partyLogo = membership.parties?.logo;
        }
      } catch (err) {
        console.error("[SyncState] Error loading party membership:", err);
      }

      // ▼ 2. Load perk levels from perks table
      try {
        user.perks = await getUserPerks(userId);
      } catch (err) {
        console.error("[SyncState] Error loading perks:", err);
        user.perks = {};
      }

      // ▼ 3. Load inventory from user_inventory table
      try {
        const { data: invItems } = await supabase.from('user_inventory')
          .select('itemId, quantity')
          .eq('userId', userId);
        const inventoryObj: Record<string, number> = {};
        let totalVolume = 0;
        (invItems || []).forEach((item: any) => {
          if (item.quantity > 0) {
            inventoryObj[item.itemId] = item.quantity;
            totalVolume += item.quantity;
            // Flatten common resources for frontend compatibility
            if (['oil', 'minerals', 'uranium', 'diamonds', 'energyDrinks', 'liquidOxygen', 'helium3'].includes(item.itemId)) {
              user[item.itemId] = item.quantity;
            }
          }
        });
        user.inventory = inventoryObj;
        user.inventoryVolume = totalVolume;
      } catch (err) {
        console.error("[SyncState] Error loading inventory:", err);
        user.inventory = {};
        user.inventoryVolume = 0;
      }

      // ▼ 4. Load work experience
      try {
        user.oilExp = 0;
        user.mineralsExp = 0;
        user.uraniumExp = 0;
        user.diamondsExp = 0;
        user.goldOreExp = 0;

        const { data: workExpRows } = await supabase
          .from('player_resource_work_experience')
          .select('resourceType, experience')
          .eq('playerId', userId);

        for (const row of workExpRows || []) {
          const experience = Math.max(0, Math.floor(Number(row?.experience) || 0));
          const resourceType = row?.resourceType;
          if (resourceType === 'oil') user.oilExp = experience;
          else if (resourceType === 'minerals') user.mineralsExp = experience;
          else if (resourceType === 'uranium') user.uraniumExp = experience;
          else if (resourceType === 'diamonds') user.diamondsExp = experience;
          else if (resourceType === 'gold_ore') user.goldOreExp = experience;
        }
      } catch (err) {
        console.error("[SyncState] Error loading work experience:", err);
      }

      // ▼ 5. Side effect: Update lastLogin timestamp (rate limited: only if > 60s old)
      const lastLoginTime = typeof user.lastLogin === 'number'
        ? user.lastLogin
        : (user.lastLogin ? new Date(user.lastLogin).getTime() : 0);

      if (!lastLoginTime || nowTs - lastLoginTime > 60000) {
        await supabase.from('users').update({ lastLogin: nowTs }).eq('id', userId);
        user.lastLogin = nowTs;
      }

      // ▼ 6. Side effect: Auto-finalize completed perk upgrades
      let upgradesChanged = false;
      const perkUpgrades = user.perkUpgrades || {};
      if (typeof perkUpgrades === 'object' && !Array.isArray(perkUpgrades)) {
        for (const [perkId, upg] of Object.entries(perkUpgrades as Record<string, any>)) {
          if (upg.willCompleteAt && upg.willCompleteAt <= nowTs) {
            const newLevel = (user.perks[perkId] || 0) + 1;
            const { error: upsertErr } = await supabase.from('perks').upsert(
              { userId, perkId, level: newLevel },
              { onConflict: 'userId,perkId' }
            );
            if (!upsertErr) {
              user.perks[perkId] = newLevel;
              delete perkUpgrades[perkId];
              upgradesChanged = true;
            } else {
              console.error("[SyncState] Error finalizing perk upgrade:", upsertErr);
            }
          }
        }
        if (upgradesChanged) {
          const { error: updateErr } = await supabase.from('users').update({
            perkUpgradesJson: JSON.stringify(perkUpgrades)
          }).eq('id', userId);
          if (updateErr) {
            console.error("[SyncState] Error updating perkUpgradesJson:", updateErr);
          }
        }
      }

      // ▼ 7. Side effect: Auto-complete travel if travelingUntil has passed
      if (user.travelingUntil && user.travelingTo && nowTs >= user.travelingUntil) {
        const { error: travelErr } = await supabase.from('users').update({
          regionId: user.travelingTo,
          travelingUntil: null,
          travelingTo: null,
          travelingFrom: null,
          travelDurationMs: null
        }).eq('id', userId);
        if (!travelErr) {
          user.regionId = user.travelingTo;
          user.travelingUntil = null;
          user.travelingTo = null;
          user.travelingFrom = null;
          user.travelDurationMs = null;
        }
      }

      // ▼ 8. Side effect: Energy regeneration (using perks data if available)
      // Only proceed if perks were loaded in this sync
      if (Object.keys(user.perks || {}).length > 0) {
        const ENERGY_MAX = 300; // From GAME_CONFIG.ENERGY_MAX
        const ENERGY_REGEN_RATE = 5; // From GAME_CONFIG.ENERGY_REGEN_RATE

        if ((user.energy || 0) < ENERGY_MAX) {
          const regenBonus = (user.perks?.['regen_boost'] || 0) * 5;
          const regenRate = ENERGY_REGEN_RATE + regenBonus;
          const lastUpdate = typeof user.lastEnergyUpdate === 'number'
            ? user.lastEnergyUpdate
            : (user.lastEnergyUpdate ? new Date(user.lastEnergyUpdate).getTime() : nowTs);

          const hoursPassed = (nowTs - lastUpdate) / (1000 * 60 * 60);
          const regen = Math.floor(hoursPassed * regenRate);

          if (regen > 0) {
            const newEnergy = Math.min(ENERGY_MAX, (user.energy || 0) + regen);
            await supabase.from('users')
              .update({ energy: newEnergy, lastEnergyUpdate: nowTs })
              .eq('id', userId);
            user.energy = newEnergy;
            user.lastEnergyUpdate = nowTs;
          }
        }
      }

      res.json(user);
    } catch (err: any) {
      console.error("[SyncState] Error:", err);
      res.status(500).json({ error: "Failed to sync state. Please try again." });
    }
  }

  return {
    getMe,
    getPlayers,
    getPlayerById,
    changeDisplayedNation,
    changeOriginalNation,
    getMyAvatar,
    updateAvatar,
    updateUsername,
    addCurrency,
    syncState,
  };
}
