/**
 * User & Profile Handlers
 *
 * Extracted from server.ts — no logic changes.
 * Covers: /api/me, /api/players, /api/players/:id,
 *   /api/profile/avatar, /api/profile/username,
 *   /api/actions/change-displayed-nation, /api/actions/change-original-nation,
 *   /api/dev/add-currency
 */
export function createUserHandlers(deps: {
  supabase: any;
  getUserPerks: (userId: string, boosterInfo?: Record<string, any>) => Promise<Record<string, number>>;
  isAllowedAvatarDataUrl: (value: string) => boolean;
  IS_PRODUCTION: boolean;
  ENABLE_DEV_ENDPOINTS: boolean;
}) {
  const { supabase, getUserPerks, isAllowedAvatarDataUrl, IS_PRODUCTION, ENABLE_DEV_ENDPOINTS } = deps;

  // GET /api/me
  function getMe(req: any, res: any) {
    res.set('Cache-Control', 'no-store');
    res.json(req.user);
  }

  // GET /api/players
  async function getPlayers(req: any, res: any) {
    try {
      const onlyOnline = String(req.query.online || '').toLowerCase() === 'true';
      const onlineThreshold = Date.now() - 5 * 60 * 1000;

      let query = supabase
        .from('users')
        .select('id, username, regionId, originalNation, level, lastLogin, avatarData', { count: 'exact' })
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
      res.status(500).json({ error: "Errore nel caricamento dei giocatori: " + err.message });
    }
  }

  // GET /api/players/:id
  async function getPlayerById(req: any, res: any) {
    console.log(`[ProfileRequest] Fetching player ${req.params.id}`);
    try {
      const { data: player, error } = await supabase
        .from('users')
        .select('*')
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

  // POST /api/profile/avatar
  async function updateAvatar(req: any, res: any) {
    const { avatarData } = req.body;
    if (!avatarData || typeof avatarData !== "string") {
      return res.status(400).json({ error: "Dati immagine mancanti" });
    }
    if (!isAllowedAvatarDataUrl(avatarData)) {
      return res.status(400).json({ error: "Formato immagine non valido" });
    }
    if (avatarData.length > 700000) {
      return res.status(400).json({ error: "Immagine troppo grande (max ~512KB)" });
    }
    await supabase.from('users').update({ avatarData }).eq('id', req.user.id);
    res.json({ success: true });
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

  return {
    getMe,
    getPlayers,
    getPlayerById,
    changeDisplayedNation,
    changeOriginalNation,
    updateAvatar,
    updateUsername,
    addCurrency,
  };
}
