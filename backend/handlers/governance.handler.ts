/**
 * Governance Handlers
 *
 * Extracted from server.ts — no logic changes.
 * Covers: /api/budget/*, /api/ministers/*, /api/actions/apply,
 *   /api/actions/resolve-application, /api/actions/toggle-borders,
 *   /api/applications/:regionId, /api/leader/*,
 *   /api/government/*, /api/users/me/managed-regions,
 *   /api/sanctions/*
 */
import { logger } from '../utils/logger';
import { randomInt } from 'crypto';
import type { EconomyService } from '../services/economy.service';

export function createGovernanceHandlers(deps: {
  supabase: any;
  atomicOperations?: any;
  economyService?: EconomyService;
  generateSecureId: (len: number) => string;
  isValidIso2: (v: string) => boolean;
  isValidUuid: (v: string) => boolean;
  canManageRegion: (regionId: string, userId: string) => Promise<boolean>;
  assertCanManageRegion: (req: any, res: any, rawRegionId: any, forbiddenMessage: string) => Promise<string | null>;
  getUserPerks: (userId: string, boosterInfo?: Record<string, any>) => Promise<Record<string, number>>;
  addXP: (userId: string, amount: number) => Promise<void>;
  addBudgetTransaction: (...args: any[]) => Promise<any>;
  retrySupabaseOperation: (...args: any[]) => Promise<any>;
  GAME_CONFIG: Record<string, any>;
}) {
  const {
    supabase,
    atomicOperations,
    economyService,
    generateSecureId,
    isValidIso2,
    isValidUuid,
    canManageRegion,
    assertCanManageRegion,
    getUserPerks,
    addXP,
    addBudgetTransaction,
    retrySupabaseOperation,
    GAME_CONFIG,
  } = deps;

  const normalizeRegionLikeId = (value: any): string | null => {
    const normalized = String(value || '').trim().toUpperCase();
    return isValidIso2(normalized) ? normalized : null;
  };

  const calculateMinisterWage = async (stateId: string, role: string) => {
    const { data: region } = await supabase
      .from('regions')
      .select('governmentForm, economyLevel, ownerUserId, healthIndex, educationIndex, developmentIndex')
      .eq('id', stateId)
      .single();

    if (!region) return 0;

    // 1. Base from regional indices (no legacy Health/Education/Military params)
    const devIndex =
      ((region.developmentIndex ?? 1) +
        (region.educationIndex ?? 1) +
        (region.healthIndex ?? 1) +
        (region.economyLevel ?? 1)) /
      4;

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

  // POST /api/budget/donate
  async function budgetDonate(req: any, res: any) {
    const user = req.user;
    const { entityId, amount, currency } = req.body;

    if (user.level < 60) return res.status(403).json({ error: "Devi essere al Livello 60 per effettuare donazioni di Stato." });
    if (!entityId || !amount) return res.status(400).json({ error: "Dati donazione non validi." });
    if (currency !== 'EUR' && currency !== 'GOLD') return res.status(400).json({ error: "Valuta non supportata." });

    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0 || Math.floor(amountNum) !== amountNum) {
      return res.status(400).json({ error: "Importo non valido. Deve essere un numero intero positivo." });
    }
    if (currency === 'EUR' && user.money < amountNum) return res.status(400).json({ error: "Fondi in € insufficienti." });
    if (currency === 'GOLD' && user.gold < amountNum) return res.status(400).json({ error: "Fondi in Gold insufficienti." });

    if (atomicOperations?.budgetDonate) {
      const result = await atomicOperations.budgetDonate({
        userId: user.id,
        entityId,
        amount: amountNum,
        currency,
        operationKey: req.body?.idempotencyKey || req.headers?.['x-idempotency-key'] || null,
      });

      if (!result?.success) {
        const codeToStatus: Record<string, number> = {
          invalid_input: 400,
          forbidden: 403,
          insufficient_funds: 400,
          user_not_found: 404,
        };
        return res.status(codeToStatus[result?.code] || 400).json({ error: result?.message || "La donazione è fallita." });
      }

      return res.json({ success: true, donated: result?.donated ?? null });
    }

    const conversionRate = 500000;
    const moneyDelta = currency === 'GOLD' ? amountNum * conversionRate : amountNum;

    try {
      if (!economyService) throw new Error('EconomyService not wired');

      await economyService.safeDeductCurrencyOrThrow({
        userId: user.id,
        moneyCost: currency === 'EUR' ? amountNum : 0,
        goldCost: currency === 'GOLD' ? amountNum : 0,
        energyCost: 0,
      });

      await addBudgetTransaction(
        'REGION',
        entityId,
        'INCOME',
        'DONATION',
        moneyDelta,
        {},
        user.id,
        { originalCurrency: currency, originalAmount: amountNum },
      );

      res.json({ success: true, donated: moneyDelta });
    } catch (err: any) {
      console.error("Donation error:", err);
      res.status(500).json({ error: "La donazione è fallita." });
    }
  }

  // POST /api/budget/clean-radiation
  async function budgetCleanRadiation(req: any, res: any) {
    const user = req.user;
    const { regionId } = req.body;
    if (!regionId) return res.status(400).json({ error: "Nessuna regione specificata." });

    if (atomicOperations?.budgetCleanRadiation) {
      const result = await atomicOperations.budgetCleanRadiation({
        userId: user.id,
        regionId,
        operationKey: req.body?.idempotencyKey || req.headers?.['x-idempotency-key'] || null,
      });

      if (!result?.success) {
        const codeToStatus: Record<string, number> = {
          invalid_input: 400,
          forbidden: 403,
          region_not_found: 404,
          no_radiation: 400,
          insufficient_budget: 400,
        };
        return res.status(codeToStatus[result?.code] || 400).json({ error: result?.message || "Fondi insufficienti." });
      }

      return res.json({ success: true });
    }

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
      await addBudgetTransaction('REGION', regionId, 'EXPENSE', 'RADIATION_CLEAN', -cost, {}, user.id);

      await supabase
        .from('regions')
        .update({ radiation: Math.max(0, (region.radiation || 0) - 10) })
        .eq('id', regionId);

      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message || "Fondi insufficienti." });
    }
  }

  // POST /api/budget/explore
  async function budgetExplore(req: any, res: any) {
    const user = req.user;
    const { regionId, type } = req.body;
    if (!regionId || (type !== 'normal' && type !== 'deep')) return res.status(400).json({ error: "Parametri esplorazione non validi." });

    const { data: region, error: regionError } = await supabase.from('regions').select('ownerUserId').eq('id', regionId).single();
    if (regionError || !region || region.ownerUserId !== user.id) return res.status(403).json({ error: "Azione riservata al Leader." });

    const isDeep = type === 'deep';
    const cost = isDeep ? 50000 : 15000;

    try {
      const foundOil = isDeep ? randomInt(100, 600) : randomInt(20, 120);
      const foundItems: Record<string, number> = { oil: foundOil };

      await addBudgetTransaction(
        'REGION',
        regionId,
        'EXPENSE',
        isDeep ? 'EXPLORE_DEEP' : 'EXPLORE_NORMAL',
        -cost,
        foundItems,
        user.id,
      );

      res.json({ success: true, message: `Esplorazione completata!` });
    } catch (err: any) {
      res.status(400).json({ error: err.message || "Fondi insufficienti." });
    }
  }

  // GET /api/budget/:ownerType/:ownerId
  async function getBudget(req: any, res: any) {
    const { ownerType, ownerId } = req.params;
    const normalizedOwnerType = (ownerType || '').toUpperCase();

    if (normalizedOwnerType !== 'REGION') {
      return res.status(403).json({ error: "Tipo di budget non autorizzato." });
    }

    const { data: region, error: regionError } = await supabase
      .from('regions')
      .select('ownerUserId')
      .eq('id', ownerId)
      .single();

    if (regionError || !region || region.ownerUserId !== req.user.id) {
      return res.status(403).json({ error: "Azione riservata al Leader." });
    }

    const { data: budget, error: budgetError } = await supabase
      .from('budgets')
      .select('*')
      .eq('ownerType', normalizedOwnerType)
      .eq('ownerId', ownerId)
      .single();

    if (budgetError || !budget) return res.status(404).json({ error: "Budget non trovato." });

    const { data: transactions, error: txError } = await supabase
      .from('budget_transactions')
      .select('*, users(username)')
      .eq('budgetId', budget.id)
      .order('createdAt', { ascending: false })
      .limit(50);

    if (txError) return res.status(500).json({ error: txError.message || "Errore nel recupero transazioni." });

    // Format to match old structure (t.username instead of t.users.username)
    const formattedTxs = (transactions || []).map((t: any) => ({
      ...t,
      createdBy: t.users?.username
    }));

    res.json({ budget, transactions: formattedTxs });
  }

  // POST /api/ministers/assign
  async function ministersAssign(req: any, res: any) {
    const leader = req.user;
    const { userId, role, iso2: rawIso2 } = req.body;
    const iso2 = normalizeRegionLikeId(String(rawIso2 || '').replace('NATION_', ''));

    if (!userId || !role || !iso2) return res.status(400).json({ error: "Dati mancanti." });
    const managedIso2 = await assertCanManageRegion(req, res, iso2, "Solo il Leader può nominare i ministri.");
    if (!managedIso2) return;

    const { data: region, error: regionError } = await supabase
      .from('regions')
      .select('governmentForm')
      .eq('id', managedIso2)
      .single();
    if (regionError || !region) return res.status(404).json({ error: "Regione non trovata." });

    if (role === 'foreign' && (region.governmentForm === 'DICTATORSHIP' || region.governmentForm === 'ONE_PARTY_SYSTEM')) {
      return res.status(403).json({ error: "Questa carica non esiste in questa forma di governo." });
    }

    const { data: existingAsMinister } = await supabase.from('ministers').select('stateId').eq('userId', userId).eq('status', 'ACTIVE').maybeSingle();
    if (existingAsMinister) {
      return res.status(400).json({ error: "L'utente ricopre già una carica ministeriale in un altro Stato." });
    }

    if (atomicOperations?.ministersAssign) {
      const result = await atomicOperations.ministersAssign({
        leaderUserId: leader.id,
        stateId: managedIso2,
        userId,
        role,
        operationKey: req.body?.idempotencyKey || req.headers?.['x-idempotency-key'] || null,
      });

      if (!result?.success) {
        const codeToStatus: Record<string, number> = {
          invalid_input: 400,
          forbidden: 403,
          region_not_found: 404,
          user_not_found: 404,
          role_not_supported: 400,
          already_minister: 409,
        };
        return res.status(codeToStatus[result?.code] || 400).json({ error: result?.message || "Errore durante l'assegnazione." });
      }

      return res.json({ success: true, title: result?.title ?? null });
    }

    const { data: targetUser } = await supabase.from('users').select('username').eq('id', userId).maybeSingle();
    if (!targetUser) return res.status(404).json({ error: "Utente non trovato." });

    const title = (role === 'economics' && region.governmentForm === 'DICTATORSHIP') ? "Economic Advisor" : (role === 'economics' ? "Minister of Economics" : "Foreign Minister");

    try {
      // 1. Deactivate old minister
      await supabase.from('ministers').update({ status: 'REVOKED' }).eq('stateId', managedIso2).eq('role', role);

      // 2. Insert new minister
      await supabase.from('ministers').insert({
        id: generateSecureId(9),
        stateId: managedIso2,
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
      await supabase.from('regions').update(updateObj).eq('id', managedIso2);

      res.json({ success: true, title });
    } catch (err: any) {
      console.error("Minister assignment error:", err);
      res.status(500).json({ error: "Errore durante l'assegnazione." });
    }
  }

  // POST /api/ministers/revoke
  async function ministersRevoke(req: any, res: any) {
    const { role, iso2: rawIso2 } = req.body;
    const iso2 = normalizeRegionLikeId(String(rawIso2 || '').replace('NATION_', ''));
    const managedIso2 = await assertCanManageRegion(req, res, iso2, "Solo il Leader può revocare i ministri.");
    if (!managedIso2) return;

    if (atomicOperations?.ministersRevoke) {
      const result = await atomicOperations.ministersRevoke({
        leaderUserId: req.user.id,
        stateId: managedIso2,
        role,
        operationKey: req.body?.idempotencyKey || req.headers?.['x-idempotency-key'] || null,
      });

      if (!result?.success) {
        const codeToStatus: Record<string, number> = {
          invalid_input: 400,
          forbidden: 403,
          region_not_found: 404,
        };
        return res.status(codeToStatus[result?.code] || 400).json({ error: result?.message || "Errore durante la revoca." });
      }

      return res.json({ success: true });
    }

    try {
      await supabase.from('ministers').update({ status: 'REVOKED' }).eq('stateId', managedIso2).eq('role', role);

      const updateObj: any = {};
      if (role === 'economics') updateObj.economicAdviserId = null;
      else updateObj.foreignMinisterId = null;
      await supabase.from('regions').update(updateObj).eq('id', managedIso2);

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Errore durante la revoca." });
    }
  }

  // GET /api/ministers/:iso2
  async function getMinistersByIso2(req: any, res: any) {
    const iso2 = (req.params.iso2 || '').toUpperCase().replace('NATION_', '');
    if (!isValidIso2(iso2)) return res.status(400).json({ error: "Codice paese non valido." });

    const { data: ministers, error } = await supabase
      .from('ministers')
      .select('*, users(username, avatarData)')
      .or(`stateId.eq.${iso2},stateId.eq.nation_${iso2}`)
      .eq('status', 'ACTIVE');

    if (error) {
      logger.error('operation_failed', { error: error.message });
      return res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }

    const wageEconomics = await calculateMinisterWage(iso2, 'economics');
    const wageForeign = await calculateMinisterWage(iso2, 'foreign');

    // Format for backward compatibility if needed (users property to username)
    const formattedMinisters = ministers?.map((m: any) => {
      const { users, ...ministerFields } = m;
      return {
        ...ministerFields,
        username: users?.username,
        avatarData: users?.avatarData || null
      };
    });

    res.json({ ministers: formattedMinisters, wages: { economics: wageEconomics, foreign: wageForeign } });
  }

  // POST /api/ministers/sanctions
  async function ministersSanctions(req: any, res: any) {
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
      logger.error('operation_failed', { error: err?.message });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  // DELETE /api/ministers/market-offer/:id
  async function ministersDeleteMarketOffer(req: any, res: any) {
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
      logger.error('operation_failed', { error: err?.message });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  // POST /api/actions/apply
  async function actionsApply(req: any, res: any) {
    const user = req.user;
    const { regionId, type } = req.body;
    const normalizedRegionId = String(regionId || '').trim().toUpperCase();

    if (!["residence", "work_permit"].includes(type)) return res.status(400).json({ error: "Tipo di richiesta non valido." });
    if (!isValidIso2(normalizedRegionId)) return res.status(400).json({ error: "Regione non valida." });
    const { data: rpcResult, error: rpcError } = await supabase.rpc('create_application_atomic', {
      p_user_id: user.id,
      p_username: user.username,
      p_region_id: normalizedRegionId,
      p_type: type,
    });

    if (rpcError) {
      console.error("[apply] RPC failure:", rpcError);
      return res.status(500).json({ error: "Errore interno durante la creazione della richiesta." });
    }

    const codeToStatus: Record<string, number> = {
      invalid_input: 400,
      invalid_region: 400,
      invalid_type: 400,
      already_assigned: 400,
      user_not_found: 404,
      region_not_found: 404,
      duplicate_pending: 409,
    };

    const result = rpcResult || {};
    if (!result.success) {
      return res.status(codeToStatus[result.code] || 400).json({ error: result.message || "Operazione non riuscita." });
    }

    res.json({
      success: true,
      autoAccepted: !!result.autoAccepted,
      status: result.status,
      applicationId: result.applicationId,
    });
  }

  // GET /api/applications/:regionId
  async function getApplications(req: any, res: any) {
    const { regionId } = req.params;
    const normalizedRegionId = String(regionId || '').trim().toUpperCase();
    if (!isValidIso2(normalizedRegionId)) return res.status(400).json({ error: "Regione non valida." });

    const authorized = await canManageRegion(normalizedRegionId, req.user.id);
    if (!authorized) return res.status(403).json({ error: "Non autorizzato a visualizzare le richieste di questa regione." });

    const { data: apps, error } = await supabase
      .from('applications')
      .select('*')
      .eq('regionId', normalizedRegionId)
      .eq('status', 'pending')
      .order('createdAt', { ascending: false });

    if (error) {
      logger.error('operation_failed', { error: error.message });
      return res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
    res.json(apps);
  }

  // GET /api/leader/orders/:regionId
  async function getLeaderOrders(req: any, res: any) {
    try {
      const normalizedRegionId = String(req.params.regionId || '').trim().toUpperCase();
      if (!isValidIso2(normalizedRegionId)) return res.status(400).json({ error: "Regione non valida." });

      const authorized = await canManageRegion(normalizedRegionId, req.user.id);
      if (!authorized) return res.status(403).json({ error: "Non autorizzato a visualizzare gli ordini di questa regione." });

      const { data: orders } = await supabase.from('leader_orders')
        .select('*')
        .eq('regionId', normalizedRegionId)
        .order('createdAt', { ascending: false })
        .limit(20);
      res.json(orders || []);
    } catch (err) {
      res.json([]);
    }
  }

  // POST /api/actions/resolve-application
  async function resolveApplication(req: any, res: any) {
    const user = req.user;
    const { applicationId, action } = req.body; // action = 'accept' | 'reject'
    if (typeof applicationId !== 'string' || !applicationId.trim()) {
      return res.status(400).json({ error: "applicationId non valido." });
    }
    if (action !== 'accept' && action !== 'reject') {
      return res.status(400).json({ error: "Azione non valida. Usa 'accept' o 'reject'." });
    }

    const { data: rpcResult, error: rpcError } = await supabase.rpc('resolve_application_atomic', {
      p_application_id: applicationId.trim(),
      p_action: action,
      p_actor_user_id: user.id,
    });

    if (rpcError) {
      console.error("[resolve-application] RPC failure:", rpcError);
      return res.status(500).json({ error: "Errore interno durante la risoluzione della richiesta." });
    }

    const codeToStatus: Record<string, number> = {
      invalid_input: 400,
      invalid_action: 400,
      not_found: 404,
      region_not_found: 404,
      forbidden: 403,
      already_resolved: 409,
      invalid_application_type: 409,
      user_not_found: 409,
      race_condition: 409,
    };

    const result = rpcResult || {};
    if (!result.success) {
      return res.status(codeToStatus[result.code] || 400).json({ error: result.message || "Operazione non riuscita." });
    }

    res.json({
      success: true,
      action,
      status: result.status,
      idempotent: !!result.idempotent,
    });
  }

  // POST /api/actions/toggle-borders
  async function toggleBorders(req: any, res: any) {
    const { regionId, state } = req.body;
    const managedRegionId = await assertCanManageRegion(req, res, regionId, "Non sei il Governatore di questa regione.");
    if (!managedRegionId) return;

    await supabase.from('regions').update({ workRestrictions: state ? 1 : 0 }).eq('id', managedRegionId);
    res.json({ success: true });
  }

  // POST /api/government/assign-minister
  async function governmentAssignMinister(req: any, res: any) {
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
      const { data: targetUser } = await supabase.from('users').select('id').eq('id', ministerId).maybeSingle();
      if (!targetUser) return res.status(404).json({ error: "Utente non trovato." });
    }

    const updateData: any = {};
    updateData[role] = ministerId || null;
    await supabase.from('regions').update(updateData).eq('id', regionId);

    res.json({ success: true, role, ministerId });
  }

  // POST /api/government/transition
  async function governmentTransition(req: any, res: any) {
    const user = req.user;
    const { regionId, targetForm } = req.body;

    if (!regionId || !targetForm) return res.status(400).json({ error: "Missing parameters." });

    const { data: region } = await supabase.from('regions').select('leaderUserId, governmentForm').eq('id', regionId).single();
    if (!region) return res.status(404).json({ error: "Region not found." });
    if (region.leaderUserId !== user.id) {
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
  }

  // POST /api/leader/candidate
  async function leaderCandidate(req: any, res: any) {
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
  }

  // POST /api/leader/vote
  async function leaderVote(req: any, res: any) {
    const user = req.user;
    const { regionId, candidateId } = req.body;

    if (user.residenceId !== regionId) return res.status(403).json({ error: "Devi essere cittadino per votare." });

    if (atomicOperations?.leaderVote) {
      const result = await atomicOperations.leaderVote({
        regionId,
        voterId: user.id,
        candidateId,
        operationKey: req.body?.idempotencyKey || req.headers?.['x-idempotency-key'] || null,
      });

      if (!result?.success) {
        const codeToStatus: Record<string, number> = {
          invalid_input: 400,
          forbidden: 403,
          already_voted: 409,
          candidate_not_found: 404,
        };
        return res.status(codeToStatus[result?.code] || 400).json({ error: result?.message || "Operazione non riuscita." });
      }

      return res.json({ success: true });
    }

    const { error } = await supabase.from('leader_votes').insert({ regionId, voterId: user.id, candidateId });
    if (error) return res.status(400).json({ error: "Hai già votato o regione non valida." });

    await supabase.rpc('increment_candidate_votes', { p_region_id: regionId, p_candidate_id: candidateId });
    res.json({ success: true });
  }

  // POST /api/leader/update-state-ui
  async function leaderUpdateStateUi(req: any, res: any) {
    const user = req.user;
    const { regionId, stateColor, stateHymn } = req.body;

    const { data: region } = await supabase.from('regions').select('leaderUserId').eq('id', regionId).single();
    if (!region || region.leaderUserId !== user.id) return res.status(403).json({ error: "Solo il Leader può modificare queste impostazioni." });

    await supabase.from('regions').update({
      stateColor: stateColor || '#334155',
      stateHymn: stateHymn || ''
    }).eq('id', regionId);

    res.json({ success: true });
  }

  // GET /api/ministers/orders
  async function getMinistersOrders(req: any, res: any) {
    const { data: regions } = await supabase.from('regions').select('id').eq('leaderUserId', req.user.id);
    if (!regions || regions.length === 0) return res.status(403).json({ error: "Non sei un leader." });

    const regionIds = regions.map((r: any) => r.id);
    const { data: orders } = await supabase.from('leader_orders')
      .select('*')
      .in('regionId', regionIds)
      .order('createdAt', { ascending: false })
      .limit(20);

    res.json(orders || []);
  }

  // POST /api/ministers/orders
  async function postMinistersOrders(req: any, res: any) {
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
  }

  // GET /api/users/me/managed-regions
  async function getManagedRegions(req: any, res: any) {
    try {
      const user = req.user;
      const { data: regions } = await supabase
        .from('regions')
        .select('id, name')
        .or(`ownerUserId.eq.${user.id},leaderUserId.eq.${user.id}`);

      res.json(regions || []);
    } catch (err: any) {
      console.error("Errore nel recupero delle regioni governate:", err);
      res.status(500).json({ error: "Errore interno del server." });
    }
  }

  // POST /api/sanctions/apply
  async function sanctionsApply(req: any, res: any) {
    const user = req.user;
    const { targetStateId: rawTarget, fromStateId: rawFrom } = req.body;
    const targetStateId = rawTarget?.toUpperCase().replace('NATION_', '').replace('nation_', '');
    const finalFromStateId = (rawFrom || user.regionId)?.toUpperCase().replace('NATION_', '').replace('nation_', '');

    if (atomicOperations?.sanctionsApply) {
      const result = await atomicOperations.sanctionsApply({
        actorUserId: user.id,
        fromStateId: finalFromStateId,
        targetStateId,
        operationKey: req.body?.idempotencyKey || req.headers?.['x-idempotency-key'] || null,
      });

      if (!result?.success) {
        const codeToStatus: Record<string, number> = {
          invalid_input: 400,
          forbidden: 403,
          region_not_found: 404,
          target_not_found: 404,
          conflict: 409,
        };
        return res.status(codeToStatus[result?.code] || 400).json({ error: result?.message || "Operazione non riuscita." });
      }

      return res.json({ success: true });
    }

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
      id: generateSecureId(9),
      fromStateId: finalFromStateId,
      targetStateId,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      createdByUserId: user.id
    });

    res.json({ success: true });
  }

  // POST /api/sanctions/revoke
  async function sanctionsRevoke(req: any, res: any) {
    const user = req.user;
    const { sanctionId } = req.body;

    if (atomicOperations?.sanctionsRevoke) {
      const result = await atomicOperations.sanctionsRevoke({
        actorUserId: user.id,
        sanctionId,
        operationKey: req.body?.idempotencyKey || req.headers?.['x-idempotency-key'] || null,
      });

      if (!result?.success) {
        const codeToStatus: Record<string, number> = {
          invalid_input: 400,
          forbidden: 403,
          not_found: 404,
          conflict: 409,
        };
        return res.status(codeToStatus[result?.code] || 400).json({ error: result?.message || "Operazione non riuscita." });
      }

      return res.json({ success: true });
    }

    const { data: sanction } = await supabase.from('sanctions').select('*').eq('id', sanctionId).single();
    if (!sanction) return res.status(404).json({ error: "Sanzione non trovata." });

    await supabase.from('sanctions').update({
      status: 'REVOKED',
      revokedAt: new Date().toISOString(),
      revokedByUserId: user.id
    }).eq('id', sanctionId);

    res.json({ success: true });
  }

  return {
    budgetDonate,
    budgetCleanRadiation,
    budgetExplore,
    getBudget,
    ministersAssign,
    ministersRevoke,
    getMinistersByIso2,
    ministersSanctions,
    ministersDeleteMarketOffer,
    actionsApply,
    getApplications,
    getLeaderOrders,
    resolveApplication,
    toggleBorders,
    governmentAssignMinister,
    governmentTransition,
    leaderCandidate,
    leaderVote,
    leaderUpdateStateUi,
    getMinistersOrders,
    postMinistersOrders,
    getManagedRegions,
    sanctionsApply,
    sanctionsRevoke,
  };
}
