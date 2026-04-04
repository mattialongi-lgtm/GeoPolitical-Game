/**
 * Wars Legacy Handlers
 *
 * Extracted from server.ts — no logic changes.
 * Covers war endpoints NOT already in backend/routes/war.routes.ts:
 *   POST /api/wars/deploy, POST /api/wars/:warId/join,
 *   GET  /api/wars/:warId/participants, GET /api/wars/:warId/deployments,
 *   GET  /api/wars/:warId/history, GET /api/wars/:warId/available-troops,
 *   POST /api/wars/:warId/auto-attack, GET /api/wars/:warId/auto-attack,
 *   POST /api/wars/revolution, POST /api/wars/coup,
 *   GET  /api/lobbies/:regionId, POST /api/lobbies/:id/expire,
 *   POST /api/military-agreements, GET /api/military-agreements/:stateId,
 *   GET  /api/war-departments/:stateId, GET /api/revolutions/:regionId,
 *   GET  /api/coups/:regionId
 */

import type { WarType, TroopType } from '../../src/types';

/* ------------------------------------------------------------------ */
/*  Automation / weapon constants & helpers (server.ts lines 4316-4370) */
/* ------------------------------------------------------------------ */

const AUTOMATION_EXPIRE_MS = 24 * 60 * 60 * 1000;

const WAR_WEAPON_CONFIG: Record<string, { energy: number; cash: number; damage: number }> = {
  tank:       { energy: 30, cash: 0, damage: 0 },   // damage filled at runtime via TROOP_BASE_DAMAGE
  aircraft:   { energy: 50, cash: 0, damage: 0 },
  battleship: { energy: 40, cash: 0, damage: 0 },
};

const LEGACY_WAR_WEAPON_ALIASES: Record<string, string> = {
  infantry:  'tank',
  airstrike: 'aircraft',
};

const normalizeWarWeaponId = (weaponId: string): string => {
  const normalized = (weaponId || '').trim().toLowerCase();
  return LEGACY_WAR_WEAPON_ALIASES[normalized] || normalized;
};

const getAllowedWeaponsForWar = (warType: string, navalPhase: number): string[] => {
  if (warType === 'naval' && navalPhase === 1) return ['battleship'];
  return ['tank', 'aircraft'];
};

const isAutomationExpired = (activatedAt?: string | null, expiresAt?: string | null, now = Date.now()) => {
  if (expiresAt) return new Date(expiresAt).getTime() <= now;
  if (!activatedAt) return false;
  return (now - new Date(activatedAt).getTime()) >= AUTOMATION_EXPIRE_MS;
};

const normalizeWarAutoType = (value: any): 'hourly' | 'maximum' => {
  return value === 'hourly' ? 'hourly' : 'maximum';
};

const isAutoAttackCompatibleWithAutoWork = (autoType: any): boolean => autoType === 'hourly';

/* ------------------------------------------------------------------ */
/*  Small inline helpers (from server.ts)                              */
/* ------------------------------------------------------------------ */

const isValidUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

/* ------------------------------------------------------------------ */
/*  Factory                                                            */
/* ------------------------------------------------------------------ */

export function createWarsLegacyHandlers(deps: {
  supabase: any;
  generateSecureId: (len: number) => string;
  getUserPerks: (userId: string, boosterInfo?: Record<string, any>) => Promise<Record<string, number>>;
  addXP: (...args: any[]) => Promise<any>;
  updateMissionProgress: (userId: string, missionType: string, progress: Record<string, number>) => Promise<any>;
  canManageRegion: (regionId: string, userId: string) => Promise<boolean>;
  retrySupabaseOperation: (...args: any[]) => Promise<any>;
  performWarDeployAction: (params: { userId: string; warId: string; side: string; weaponId: string }) => Promise<any>;
  GAME_CONFIG: any;
  TROOP_BASE_DAMAGE: Record<string, number>;
  TROOP_ENERGY_COST: Record<string, number>;
  TROOP_MONEY_COST: Record<string, number>;
  WAR_TYPE_ALLOWED_TROOPS: any;
  calculateDamage: (...args: any[]) => any;
  calculateDamageCap: (...args: any[]) => any;
  validateTroopDeployment: (...args: any[]) => any;
  getMaxDeployableTroops: (...args: any[]) => any;
  getAvailableTroops: (warType: WarType, navalPhase: number) => TroopType[];
  shouldAutoAttackFire: (...args: any[]) => boolean;
  normalizeRegionLikeId: (value: any) => string | null;
  canReadRegionScopedData: (user: any, regionId: string) => Promise<boolean>;
  getRegionBuildings: (regionId: string) => Promise<Record<string, number>>;
  calculateRegionalIndices: (buildings: Record<string, number>) => any;
}) {
  const {
    supabase,
    generateSecureId,
    updateMissionProgress,
    canManageRegion,
    performWarDeployAction,
    GAME_CONFIG,
    TROOP_BASE_DAMAGE,
    TROOP_ENERGY_COST,
    TROOP_MONEY_COST,
    getAvailableTroops,
    normalizeRegionLikeId,
    canReadRegionScopedData,
    getRegionBuildings,
    calculateRegionalIndices,
  } = deps;

  // Patch WAR_WEAPON_CONFIG damage values from runtime constants
  WAR_WEAPON_CONFIG.tank.damage       = TROOP_BASE_DAMAGE.tank;
  WAR_WEAPON_CONFIG.aircraft.damage   = TROOP_BASE_DAMAGE.aircraft;
  WAR_WEAPON_CONFIG.battleship.damage = TROOP_BASE_DAMAGE.battleship;

  /* -- local helpers ------------------------------------------------ */

  const assertCanManageRegion = async (
    req: any,
    res: any,
    rawRegionId: any,
    forbiddenMessage: string,
  ): Promise<string | null> => {
    const regionId = normalizeRegionLikeId(rawRegionId);
    if (!regionId) {
      res.status(400).json({ error: "Regione non valida." });
      return null;
    }
    const allowed = await canManageRegion(regionId, req.user?.id);
    if (!allowed) {
      res.status(403).json({ error: forbiddenMessage });
      return null;
    }
    return regionId;
  };

  /* ================================================================ */
  /*  Handler functions                                               */
  /* ================================================================ */

  // POST /api/wars/deploy
  async function deployWeapon(req: any, res: any) {
    const user = req.user;
    const { warId, side, weaponId } = req.body;

    try {
      const result = await performWarDeployAction({ userId: user.id, warId, side, weaponId });
      return res.json(result);
    } catch (error: any) {
      if (error?.statusCode) return res.status(error.statusCode).json({ error: error.message });
      return res.status(500).json({ error: error?.message || "Errore durante lo schieramento." });
    }
  }

  // POST /api/wars/:warId/join
  async function joinWar(req: any, res: any) {
    try {
      const user = req.user;
      const { warId } = req.params;
      const { side } = req.body;

      if (!side || (side !== 'attacker' && side !== 'defender')) {
        return res.status(400).json({ error: "Schieramento non valido." });
      }

      const { data: war } = await supabase.from('wars').select('*').eq('id', warId).single();
      if (!war) return res.status(404).json({ error: "Guerra inesistente." });
      if (war.status !== 'active') return res.status(400).json({ error: "Guerra già terminata." });

      // Check not already participating
      const { data: existing } = await supabase.from('war_participants')
        .select('id')
        .eq('warId', warId)
        .eq('userId', user.id)
        .maybeSingle();

      if (existing) return res.status(400).json({ error: "Sei già partecipante a questa guerra." });

      // Check military agreement for external wars
      const nationId = side === 'attacker' ? war.attackerCountryIso2 : war.defenderCountryIso2;
      if (user.regionId) {
        const { data: userRegion } = await supabase.from('regions').select('nation_id').eq('id', user.regionId).maybeSingle();
        if (userRegion?.nation_id !== nationId) {
          // External player — check military agreement
          const { data: agreement } = await supabase.from('war_military_agreements')
            .select('id')
            .eq('status', 'active')
            .or(`"stateA".eq.${userRegion?.nation_id},"stateB".eq.${userRegion?.nation_id}`)
            .or(`"stateA".eq.${nationId},"stateB".eq.${nationId}`)
            .maybeSingle();

          if (!agreement) {
            return res.status(403).json({ error: "Serve un accordo militare per combattere guerre esterne." });
          }
        }
      }

      await supabase.from('war_participants').insert({
        warId,
        userId: user.id,
        side,
        totalDamage: 0,
        troopsDeployed: {},
      });

      res.json({ success: true, message: "Ti sei unito alla guerra." });
    } catch (err: any) {
      res.status(500).json({ error: "Errore nell'unirsi alla guerra." });
    }
  }

  // GET /api/wars/:warId/participants
  async function getParticipants(req: any, res: any) {
    const { warId } = req.params;
    const { data: participants } = await supabase.from('war_participants')
      .select('*')
      .eq('warId', warId)
      .order('totalDamage', { ascending: false });

    res.json({ participants: participants || [] });
  }

  // GET /api/wars/:warId/deployments
  async function getDeployments(req: any, res: any) {
    const { warId } = req.params;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const { data: deployments } = await supabase.from('war_deployments')
      .select('*')
      .eq('warId', warId)
      .order('deployedAt', { ascending: false })
      .limit(limit);

    res.json({ deployments: deployments || [] });
  }

  // GET /api/wars/:warId/history
  async function getHistory(req: any, res: any) {
    const { warId } = req.params;
    const { data: history } = await supabase.from('war_history')
      .select('*')
      .eq('warId', warId)
      .order('createdAt', { ascending: false });

    res.json({ history: history || [] });
  }

  // GET /api/wars/:warId/available-troops
  async function getAvailableTroopsForWar(req: any, res: any) {
    const { warId } = req.params;
    const { data: war } = await supabase.from('wars').select('warType, navalPhase').eq('id', warId).single();
    if (!war) return res.status(404).json({ error: "Guerra inesistente." });

    const troops = getAvailableTroops((war.warType || 'land') as WarType, war.navalPhase || 0);
    const troopDetails = troops.map((t: TroopType) => ({
      type: t,
      baseDamage: TROOP_BASE_DAMAGE[t],
      energyCost: TROOP_ENERGY_COST[t],
      moneyCost: TROOP_MONEY_COST[t],
    }));

    res.json({ troops: troopDetails });
  }

  // POST /api/wars/:warId/auto-attack
  async function setAutoAttack(req: any, res: any) {
    try {
      const user = req.user;
      const { warId } = req.params;
      const { side, troopType, weaponId, autoType, enabled } = req.body;

      const { data: war } = await supabase.from('wars').select('status, warType, navalPhase').eq('id', warId).single();
      if (!war || war.status !== 'active') return res.status(400).json({ error: "Guerra non attiva." });

      if (enabled === false) {
        // Disable auto-attack
        await supabase.from('war_auto_attacks')
          .update({ isActive: false })
          .eq('warId', warId)
          .eq('userId', user.id);
        return res.json({ success: true, message: "Auto-attacco disattivato." });
      }

      const resolvedWeaponId = normalizeWarWeaponId(weaponId || troopType);
      const resolvedAutoType = normalizeWarAutoType(autoType);

      if (!side || !resolvedWeaponId || !resolvedAutoType) {
        return res.status(400).json({ error: "Dati mancanti per auto-attacco." });
      }

      const allowedWeapons = getAllowedWeaponsForWar(war.warType || 'land', war.navalPhase || 0);
      if (!allowedWeapons.includes(resolvedWeaponId)) {
        const message = war.warType === 'naval' && war.navalPhase === 1
          ? "Fase 1 navale: solo corazzate navali permesse."
          : "Per questa guerra puoi usare solo Carri armati e Aerei.";
        return res.status(400).json({ error: message });
      }

      if (!isAutoAttackCompatibleWithAutoWork(resolvedAutoType)) {
        const { data: activeAutoWork, error: autoWorkError } = await supabase
          .from('work_auto_actions')
          .select('id, activatedAt, expiresAt')
          .eq('userId', user.id)
          .eq('isActive', true)
          .maybeSingle();
        if (autoWorkError) throw autoWorkError;

        if (activeAutoWork) {
          if (isAutomationExpired(activeAutoWork.activatedAt, activeAutoWork.expiresAt)) {
            await supabase.from('work_auto_actions').update({ isActive: false }).eq('id', activeAutoWork.id);
          } else {
            return res.status(400).json({ error: "Non puoi attivare questa modalita di auto-attacco mentre Auto-Work e attivo." });
          }
        }
      }

      const expiresAt = new Date(Date.now() + AUTOMATION_EXPIRE_MS).toISOString();

      // Upsert auto-attack
      await supabase.from('war_auto_attacks').upsert({
        warId,
        userId: user.id,
        side,
        troopType: resolvedWeaponId,
        autoType: resolvedAutoType,
        isActive: true,
        activatedAt: new Date().toISOString(),
        lastFiredAt: null,
        expiresAt,
      }, { onConflict: 'warId,userId' });

      res.json({ success: true, message: `Auto-attacco ${resolvedAutoType} attivato.`, expiresAt, weaponId: resolvedWeaponId, autoType: resolvedAutoType });
    } catch (err: any) {
      res.status(500).json({ error: "Errore nell'impostazione dell'auto-attacco." });
    }
  }

  // GET /api/wars/:warId/auto-attack
  async function getAutoAttack(req: any, res: any) {
    const user = req.user;
    const { warId } = req.params;
    const { data: autoAttack } = await supabase.from('war_auto_attacks')
      .select('*')
      .eq('warId', warId)
      .eq('userId', user.id)
      .eq('isActive', true)
      .maybeSingle();

    if (autoAttack && isAutomationExpired(autoAttack.activatedAt, autoAttack.expiresAt)) {
      await supabase.from('war_auto_attacks').update({ isActive: false }).eq('id', autoAttack.id);
      return res.json({ autoAttack: null });
    }

    res.json({ autoAttack: autoAttack || null });
  }

  // POST /api/wars/revolution
  async function createRevolution(req: any, res: any) {
    try {
      const user = req.user;
      const { regionId } = req.body;

      if (!regionId) {
        return res.status(400).json({ error: "Dati mancanti: regionId richiesto." });
      }

      const goldCost = GAME_CONFIG.WAR_REVOLUTION_GOLD_COST;
      const minPlayers = GAME_CONFIG.WAR_REVOLUTION_MIN_PLAYERS;

      // Check user has enough gold
      const { data: freshUser } = await supabase.from('users').select('gold').eq('id', user.id).single();
      if (!freshUser || (freshUser.gold || 0) < goldCost) {
        return res.status(400).json({ error: `Gold insufficiente. Servono ${goldCost} Gold.` });
      }

      // Check cooldown
      const { data: lastRevolution } = await supabase.from('revolutions')
        .select('cooldownUntil')
        .eq('regionId', regionId)
        .order('createdAt', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastRevolution?.cooldownUntil && new Date(lastRevolution.cooldownUntil).getTime() > Date.now()) {
        return res.status(400).json({ error: "In questa regione è già stata avviata una rivoluzione negli ultimi 5 giorni." });
      }

      // Check no active revolution/coup war in this region (normal territorial wars do NOT block)
      const { data: activeInternalWar } = await supabase.from('wars')
        .select('id').eq('status', 'active')
        .eq('defenderRegionId', regionId)
        .in('warType', ['revolution', 'coup'])
        .maybeSingle();
      if (activeInternalWar) return res.status(400).json({ error: "Una rivoluzione o colpo di stato è già in corso in questa regione." });

      const { data: activeRev } = await supabase.from('revolutions')
        .select('id').eq('regionId', regionId).eq('status', 'active').maybeSingle();
      if (activeRev) return res.status(400).json({ error: "Rivoluzione già in corso." });

      // Check for existing pending lobby
      const { data: existingLobby } = await supabase.from('revolution_lobbies')
        .select('*')
        .eq('regionId', regionId)
        .eq('lobbyType', 'revolution')
        .eq('status', 'pending')
        .maybeSingle();

      if (existingLobby) {
        // Join existing lobby
        if ((existingLobby.participantIds || []).includes(user.id)) {
          return res.status(400).json({ error: "Sei già in questa lobby." });
        }

        const newParticipants = [...(existingLobby.participantIds || []), user.id];

        // Deduct gold from joining player
        await supabase.from('users').update({ gold: (freshUser.gold || 0) - goldCost }).eq('id', user.id);

        if (newParticipants.length >= minPlayers) {
          // Lobby is full - start the revolution!
          await supabase.from('revolution_lobbies').update({
            participantIds: newParticipants,
            status: 'started',
            updatedAt: new Date().toISOString(),
          }).eq('id', existingLobby.id);

          // Create war
          const warId = generateSecureId(9);
          const now = new Date();
          const { data: region } = await supabase.from('regions').select('*').eq('id', regionId).single();

          await supabase.from('wars').insert({
            id: warId,
            attackerCountryIso2: 'REV',
            defenderCountryIso2: region?.nation_id || regionId,
            attackerUserId: existingLobby.creatorId,
            defenderUserId: region?.leaderUserId || region?.ownerUserId || null,
            status: 'active',
            startedAt: now.toISOString(),
            endsAt: new Date(now.getTime() + GAME_CONFIG.WAR_DURATION_MS).toISOString(),
            attackerScore: 0, defenderScore: 0,
            warType: 'revolution',
            attackerRegionId: regionId, defenderRegionId: regionId,
            createdAt: now.toISOString(), updatedAt: now.toISOString(),
          });

          const cooldownUntil = new Date(now.getTime() + GAME_CONFIG.WAR_REVOLUTION_COOLDOWN_MS).toISOString();

          await supabase.from('revolutions').insert({
            regionId,
            initiatorIds: newParticipants,
            goldCost: goldCost * newParticipants.length,
            status: 'active',
            warId,
            cooldownUntil,
          });

          for (const uid of newParticipants) {
            await supabase.from('war_participants').insert({
              warId, userId: uid, side: 'attacker', totalDamage: 0, troopsDeployed: {},
            });
          }

          await supabase.from('war_history').insert({
            warId,
            eventType: 'war_started',
            eventData: { warType: 'revolution', regionId, initiatorIds: newParticipants, goldCost: goldCost * newParticipants.length },
          });

          res.json({ success: true, warId, message: "Rivoluzione iniziata!", started: true, participants: newParticipants.length, required: minPlayers });
        } else {
          // Update lobby with new participant
          await supabase.from('revolution_lobbies').update({
            participantIds: newParticipants,
            updatedAt: new Date().toISOString(),
          }).eq('id', existingLobby.id);

          res.json({ success: true, message: `Ti sei unito alla lobby! ${newParticipants.length}/${minPlayers} giocatori.`, started: false, participants: newParticipants.length, required: minPlayers, lobbyId: existingLobby.id });

          // ── Daily Missions: revolution progress (non-blocking) ──
          try { await updateMissionProgress(user.id, 'REVOLUTION_JOIN', { join_revolution: 1, check_revolution: 1, political_action: 1 }); } catch { /* non-critical */ }
        }
      } else {
        // Create new lobby
        // Deduct gold from creator
        await supabase.from('users').update({ gold: (freshUser.gold || 0) - goldCost }).eq('id', user.id);

        const { data: lobby, error: lobbyError } = await supabase.from('revolution_lobbies').insert({
          regionId,
          lobbyType: 'revolution',
          creatorId: user.id,
          participantIds: [user.id],
          requiredPlayers: minPlayers,
          status: 'pending',
          goldCostPerPlayer: goldCost,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }).select().single();

        if (lobbyError) throw lobbyError;

        res.json({ success: true, message: `Lobby rivoluzione creata! ${1}/${minPlayers} giocatori. In attesa di altri...`, started: false, participants: 1, required: minPlayers, lobbyId: lobby.id });

        // ── Daily Missions: revolution progress (non-blocking) ──
        try { await updateMissionProgress(user.id, 'REVOLUTION_JOIN', { join_revolution: 1, check_revolution: 1, political_action: 1 }); } catch { /* non-critical */ }
      }
    } catch (err: any) {
      console.error("Revolution error:", err);
      res.status(500).json({ error: "Errore nell'avvio della rivoluzione." });
    }
  }

  // POST /api/wars/coup
  async function createCoup(req: any, res: any) {
    try {
      const user = req.user;
      const { regionId } = req.body;

      if (!regionId) {
        return res.status(400).json({ error: "Dati mancanti: regionId richiesto." });
      }

      const minPlayers = GAME_CONFIG.WAR_COUP_MIN_PLAYERS;

      // Check development level must be 1
      const { data: region } = await supabase.from('regions').select('*').eq('id', regionId).single();
      if (!region) return res.status(404).json({ error: "Regione non trovata." });

      const buildings = await getRegionBuildings(regionId);
      const indices = calculateRegionalIndices(buildings);
      if (indices.developmentIndex !== GAME_CONFIG.WAR_COUP_MAX_DEVELOPMENT) {
        return res.status(400).json({ error: "Il colpo di stato può essere aperto solo con indice di sviluppo pari a 1." });
      }

      // Check no active revolution/coup war in this region (normal territorial wars do NOT block)
      const { data: activeInternalWar } = await supabase.from('wars')
        .select('id').eq('status', 'active')
        .eq('defenderRegionId', regionId)
        .in('warType', ['revolution', 'coup'])
        .maybeSingle();
      if (activeInternalWar) return res.status(400).json({ error: "Una rivoluzione o colpo di stato è già in corso in questa regione." });

      const { data: activeCoup } = await supabase.from('coups')
        .select('id').eq('regionId', regionId).eq('status', 'active').maybeSingle();
      if (activeCoup) return res.status(400).json({ error: "Colpo di stato già in corso." });

      // Check for existing pending lobby
      const { data: existingLobby } = await supabase.from('revolution_lobbies')
        .select('*')
        .eq('regionId', regionId)
        .eq('lobbyType', 'coup')
        .eq('status', 'pending')
        .maybeSingle();

      if (existingLobby) {
        // Join existing lobby
        if ((existingLobby.participantIds || []).includes(user.id)) {
          return res.status(400).json({ error: "Sei già in questa lobby." });
        }

        const newParticipants = [...(existingLobby.participantIds || []), user.id];

        if (newParticipants.length >= minPlayers) {
          // Lobby is full - start the coup!
          await supabase.from('revolution_lobbies').update({
            participantIds: newParticipants,
            status: 'started',
            updatedAt: new Date().toISOString(),
          }).eq('id', existingLobby.id);

          const warId = generateSecureId(9);
          const now = new Date();

          await supabase.from('wars').insert({
            id: warId,
            attackerCountryIso2: 'COUP',
            defenderCountryIso2: region.nation_id || regionId,
            attackerUserId: existingLobby.creatorId,
            defenderUserId: region.leaderUserId || region.ownerUserId || null,
            status: 'active',
            startedAt: now.toISOString(),
            endsAt: new Date(now.getTime() + GAME_CONFIG.WAR_DURATION_MS).toISOString(),
            attackerScore: 0, defenderScore: 0,
            warType: 'coup',
            attackerRegionId: regionId, defenderRegionId: regionId,
            createdAt: now.toISOString(), updatedAt: now.toISOString(),
          });

          await supabase.from('coups').insert({
            regionId,
            initiatorIds: newParticipants,
            status: 'active',
            warId,
          });

          for (const uid of newParticipants) {
            await supabase.from('war_participants').insert({
              warId, userId: uid, side: 'attacker', totalDamage: 0, troopsDeployed: {},
            });
          }

          await supabase.from('war_history').insert({
            warId,
            eventType: 'war_started',
            eventData: { warType: 'coup', regionId, initiatorIds: newParticipants },
          });

          res.json({ success: true, warId, message: "Colpo di stato iniziato!", started: true, participants: newParticipants.length, required: minPlayers });
        } else {
          await supabase.from('revolution_lobbies').update({
            participantIds: newParticipants,
            updatedAt: new Date().toISOString(),
          }).eq('id', existingLobby.id);

          res.json({ success: true, message: `Ti sei unito alla lobby! ${newParticipants.length}/${minPlayers} giocatori.`, started: false, participants: newParticipants.length, required: minPlayers, lobbyId: existingLobby.id });

          // ── Daily Missions: coup progress (non-blocking) ──
          try { await updateMissionProgress(user.id, 'COUP_JOIN', { join_revolution: 1, check_revolution: 1, political_action: 1 }); } catch { /* non-critical */ }
        }
      } else {
        // Create new lobby
        const { data: lobby, error: lobbyError } = await supabase.from('revolution_lobbies').insert({
          regionId,
          lobbyType: 'coup',
          creatorId: user.id,
          participantIds: [user.id],
          requiredPlayers: minPlayers,
          status: 'pending',
          goldCostPerPlayer: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }).select().single();

        if (lobbyError) throw lobbyError;

        res.json({ success: true, message: `Lobby colpo di stato creata! ${1}/${minPlayers} giocatori. In attesa di altri...`, started: false, participants: 1, required: minPlayers, lobbyId: lobby.id });

        // ── Daily Missions: coup progress (non-blocking) ──
        try { await updateMissionProgress(user.id, 'COUP_JOIN', { join_revolution: 1, check_revolution: 1, political_action: 1 }); } catch { /* non-critical */ }
      }
    } catch (err: any) {
      console.error("Coup error:", err);
      res.status(500).json({ error: "Errore nell'avvio del colpo di stato." });
    }
  }

  // GET /api/lobbies/:regionId
  async function getLobbies(req: any, res: any) {
    try {
      const normalizedRegionId = normalizeRegionLikeId(req.params.regionId);
      if (!normalizedRegionId) {
        return res.status(400).json({ error: "Regione non valida." });
      }

      const canRead = await canReadRegionScopedData(req.user, normalizedRegionId);
      if (!canRead) {
        return res.status(403).json({ error: "Non autorizzato a visualizzare le lobby di questa regione." });
      }

      const { data: lobbies } = await supabase.from('revolution_lobbies')
        .select('*')
        .eq('regionId', normalizedRegionId)
        .eq('status', 'pending')
        .order('createdAt', { ascending: false });

      // GET must be side-effect free: only filter active/pending lobbies in-memory.
      const now = Date.now();
      const active = (lobbies || []).filter((l: any) => {
        if (!l.expiresAt) return true;
        return new Date(l.expiresAt).getTime() >= now;
      });

      // Get usernames for participants
      const allParticipantIds = active.flatMap((l: any) => l.participantIds || []);
      const { data: users } = allParticipantIds.length > 0
        ? await supabase.from('users').select('id, username').in('id', allParticipantIds)
        : { data: [] };

      const usernameMap: Record<string, string> = {};
      (users || []).forEach((u: any) => { usernameMap[u.id] = u.username; });

      const result = active.map((l: any) => ({
        id: l.id,
        lobbyType: l.lobbyType,
        regionId: l.regionId,
        participants: (l.participantIds || []).map((uid: string) => ({ id: uid, username: usernameMap[uid] || uid })),
        required: l.requiredPlayers,
        current: (l.participantIds || []).length,
        goldCostPerPlayer: l.goldCostPerPlayer,
        createdAt: l.createdAt,
        expiresAt: l.expiresAt,
        isJoined: (l.participantIds || []).includes(req.user.id),
      }));

      res.json({ lobbies: result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  // POST /api/lobbies/:id/expire
  async function expireLobby(req: any, res: any) {
    const lobbyId = String(req.params.id || '').trim();
    if (!isValidUuid(lobbyId)) {
      return res.status(400).json({ error: "Lobby ID non valido." });
    }

    const { data: lobby, error: lobbyError } = await supabase
      .from('revolution_lobbies')
      .select('regionId')
      .eq('id', lobbyId)
      .maybeSingle();

    if (lobbyError) return res.status(500).json({ error: "Errore nel recupero lobby." });
    if (!lobby) return res.status(404).json({ error: "Lobby non trovata." });

    const managedRegionId = await assertCanManageRegion(req, res, lobby.regionId, "Non autorizzato a scadere questa lobby.");
    if (!managedRegionId) return;

    const { data: rpcResult, error: rpcError } = await supabase.rpc('expire_revolution_lobby_atomic', {
      p_lobby_id: lobbyId,
      p_actor_user_id: req.user.id,
    });

    if (rpcError) {
      console.error("[lobbies.expire] RPC failure:", rpcError);
      return res.status(500).json({ error: "Errore interno durante la scadenza della lobby." });
    }

    const codeToStatus: Record<string, number> = {
      invalid_input: 400,
      not_found: 404,
      region_not_found: 404,
      forbidden: 403,
      invalid_state: 409,
      not_expired: 409,
      race_condition: 409,
    };

    const result = rpcResult || {};
    if (!result.success) {
      return res.status(codeToStatus[result.code] || 400).json({ error: result.message || "Operazione non riuscita." });
    }

    return res.json({
      success: true,
      status: result.status,
      idempotent: !!result.idempotent,
      refundedParticipants: Number(result.refundedParticipants || 0),
    });
  }

  // POST /api/military-agreements
  async function createMilitaryAgreement(req: any, res: any) {
    try {
      const user = req.user;
      const { targetStateId, agreementType } = req.body;

      if (!targetStateId || !agreementType) {
        return res.status(400).json({ error: "Dati mancanti." });
      }

      // User must be leader of their nation
      const { data: userRegion } = await supabase.from('regions').select('nation_id, leaderUserId').eq('id', user.regionId).maybeSingle();
      if (!userRegion || userRegion.leaderUserId !== user.id) {
        return res.status(403).json({ error: "Solo il leader nazionale può proporre accordi militari." });
      }

      const initiatorState = userRegion.nation_id;
      if (!initiatorState) return res.status(400).json({ error: "Nazione non trovata." });

      // Normalize state pair (alphabetical order for uniqueness)
      const [stateA, stateB] = [initiatorState, targetStateId].sort();

      // Check existing
      const { data: existing } = await supabase.from('war_military_agreements')
        .select('id, status')
        .eq('stateA', stateA)
        .eq('stateB', stateB)
        .maybeSingle();

      if (existing && existing.status === 'active') {
        return res.status(400).json({ error: "Accordo militare già attivo." });
      }

      if (existing && existing.status === 'pending') {
        // If other side proposed, accept it
        if (agreementType === 'bilateral') {
          await supabase.from('war_military_agreements').update({
            status: 'active',
            updatedAt: new Date().toISOString(),
          }).eq('id', existing.id);
          return res.json({ success: true, message: "Accordo militare accettato!" });
        }
      }

      // Create new agreement
      await supabase.from('war_military_agreements').upsert({
        stateA,
        stateB,
        agreementType,
        initiatorState,
        status: agreementType === 'unilateral' ? 'active' : 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { onConflict: 'stateA,stateB' });

      res.json({ success: true, message: agreementType === 'unilateral' ? 'Accordo unilaterale attivato.' : 'Proposta di accordo inviata.' });
    } catch (err: any) {
      res.status(500).json({ error: "Errore nella creazione dell'accordo militare." });
    }
  }

  // GET /api/military-agreements/:stateId
  async function getMilitaryAgreements(req: any, res: any) {
    const stateId = normalizeRegionLikeId(req.params.stateId);
    if (!stateId) return res.status(400).json({ error: "Stato non valido." });

    const canRead = await canReadRegionScopedData(req.user, stateId);
    if (!canRead) {
      return res.status(403).json({ error: "Non autorizzato a visualizzare gli accordi militari di questo Stato." });
    }

    const { data: agreements } = await supabase.from('war_military_agreements')
      .select('*')
      .or(`"stateA".eq.${stateId},"stateB".eq.${stateId}`)
      .eq('status', 'active');

    res.json({ agreements: agreements || [] });
  }

  // GET /api/war-departments/:stateId
  async function getWarDepartments(req: any, res: any) {
    const stateId = normalizeRegionLikeId(req.params.stateId);
    if (!stateId) return res.status(400).json({ error: "Stato non valido." });

    const canRead = await canReadRegionScopedData(req.user, stateId);
    if (!canRead) {
      return res.status(403).json({ error: "Non autorizzato a visualizzare i dipartimenti di guerra di questo Stato." });
    }

    const { data: departments } = await supabase.from('war_departments')
      .select('*')
      .eq('stateId', stateId);

    res.json({ departments: departments || [] });
  }

  // GET /api/revolutions/:regionId
  async function getRevolutions(req: any, res: any) {
    const regionId = normalizeRegionLikeId(req.params.regionId);
    if (!regionId) return res.status(400).json({ error: "Regione non valida." });

    const canRead = await canReadRegionScopedData(req.user, regionId);
    if (!canRead) {
      return res.status(403).json({ error: "Non autorizzato a visualizzare le rivoluzioni di questa regione." });
    }

    const { data: revolutions } = await supabase.from('revolutions')
      .select('*')
      .eq('regionId', regionId)
      .order('createdAt', { ascending: false })
      .limit(10);

    res.json({ revolutions: revolutions || [] });
  }

  // GET /api/coups/:regionId
  async function getCoups(req: any, res: any) {
    const regionId = normalizeRegionLikeId(req.params.regionId);
    if (!regionId) return res.status(400).json({ error: "Regione non valida." });

    const canRead = await canReadRegionScopedData(req.user, regionId);
    if (!canRead) {
      return res.status(403).json({ error: "Non autorizzato a visualizzare i colpi di stato di questa regione." });
    }

    const { data: coups } = await supabase.from('coups')
      .select('*')
      .eq('regionId', regionId)
      .order('createdAt', { ascending: false })
      .limit(10);

    res.json({ coups: coups || [] });
  }

  return {
    deployWeapon,
    joinWar,
    getParticipants,
    getDeployments,
    getHistory,
    getAvailableTroopsForWar,
    setAutoAttack,
    getAutoAttack,
    createRevolution,
    createCoup,
    getLobbies,
    expireLobby,
    createMilitaryAgreement,
    getMilitaryAgreements,
    getWarDepartments,
    getRevolutions,
    getCoups,
  };
}
