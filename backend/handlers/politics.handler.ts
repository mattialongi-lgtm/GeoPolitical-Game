/**
 * Politics Handlers
 *
 * Extracted from server.ts — no logic changes.
 * Covers: /api/parties/*, /api/elections/*, /api/parliament/*,
 *   /api/blocs/*
 */
// LawRegistry is passed as a dependency to avoid circular imports with server.ts
import { logger } from '../utils/logger';
import type { EconomyService } from '../services/economy.service';

export function createPoliticsHandlers(deps: {
  supabase: any;
  atomicOperations?: any;
  economyService?: EconomyService;
  generateSecureId: (length?: number) => string;
  getUserPerks: (userId: string, boosterInfo?: Record<string, any>) => Promise<Record<string, number>>;
  partyAssetsService: any;
  mapServiceResultToHttp: (result: any) => { statusCode: number; body: any };
  LawRegistry: any;
  GAME_CONFIG: any;
}) {
  const { supabase, atomicOperations, economyService, generateSecureId, getUserPerks, partyAssetsService, mapServiceResultToHttp, LawRegistry, GAME_CONFIG } = deps;

  // Helper: primaries cycle
  const PRIMARIES_CYCLE_MS = 5 * 24 * 60 * 60 * 1000;
  const getPrimariesCycleStart = () => new Date(Math.floor(Date.now() / PRIMARIES_CYCLE_MS) * PRIMARIES_CYCLE_MS).toISOString();

  // Helper: item type
  const getItemType = (itemId: string): string => {
    const resources = ['oil', 'minerals', 'uranium', 'diamonds'];
    const weapons = ['tank', 'aircraft', 'battleship'];
    if (resources.includes(itemId)) return 'resources';
    if (weapons.includes(itemId)) return 'weapons';
    return 'items';
  };

  // Helper: party caps
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

  // POST /api/parties/create
  async function createParty(req: any, res: any) {
    const user = req.user;
    const { name, ideology, tag, description, logo } = req.body;
    const regionId = user.residenceId || "IT";

    if (!name || name.trim().length === 0) return res.status(400).json({ error: "Nome obbligatorio." });
    if (user.gold < 100) return res.status(400).json({ error: "Fondi in Gold insufficienti (costa 100 Gold)." });

    try {
      if (atomicOperations?.createParty) {
        const result = await atomicOperations.createParty({
          userId: user.id,
          username: user.username,
          regionId,
          name: name.trim(),
          ideology,
          tag,
          description,
          logo,
          operationKey: req.body?.idempotencyKey || req.headers?.['x-idempotency-key'] || null,
        });

        if (!result?.success) {
          const codeToStatus: Record<string, number> = {
            invalid_input: 400,
            insufficient_gold: 400,
            already_member: 409,
            user_not_found: 404,
          };
          return res.status(codeToStatus[result?.code] || 400).json({ error: result?.message || "Operazione non riuscita." });
        }

        return res.json({ success: true, partyId: result.partyId });
      }

      const { data: existingMember } = await supabase.from('party_members').select('partyId').eq('userId', user.id).maybeSingle();
      if (existingMember) return res.status(400).json({ error: "Sei già membro di un partito." });
      const partyId = generateSecureId(9);
      const now = Date.now();
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
      await supabase.from('party_members').insert({ userId: user.id, partyId, role: 'leader', joinedAt: now });
      if (!economyService) throw new Error('EconomyService not wired');
      await economyService.safeDeductCurrencyOrThrow({
        userId: user.id,
        moneyCost: 0,
        goldCost: 100,
        energyCost: 0,
      });
      await supabase.from('party_logs').insert({
        id: generateSecureId(9), partyId, action: 'created', details: `Partito creato da ${user.username} in ${regionId}`, timestamp: now
      });
      return res.json({ success: true, partyId });
    } catch (err: any) {
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  // PUT /api/parties/edit
  async function editParty(req: any, res: any) {
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
  }

  // GET /api/parties
  async function getParties(req: any, res: any) {
    const regionId = req.query.regionId as string | undefined;
    let query = supabase.from('parties').select('*').order('createdAt', { ascending: false });
    if (regionId) query = query.eq('regionId', regionId.toUpperCase());
    const { data: parties, error } = await query;

    if (error) {
      console.error("Error fetching parties:", error);
      return res.status(500).json({ error: "Errore nel caricamento dei partiti." });
    }

    // Batch fetch all leader usernames in a single query
    const leaderIds = [...new Set((parties || []).map(p => p.leaderUserId).filter(Boolean))];
    const leaderMap = new Map<string, string>();
    if (leaderIds.length > 0) {
      const { data: leaders } = await supabase.from('users').select('id, username').in('id', leaderIds);
      (leaders || []).forEach((l: any) => leaderMap.set(l.id, l.username));
    }

    // Batch fetch all member counts in a single query instead of one per party
    const partyIds = (parties || []).map((p: any) => p.id);
    const countMap = new Map<string, number>();
    if (partyIds.length > 0) {
      const { data: allMembers } = await supabase.from('party_members').select('partyId').in('partyId', partyIds);
      for (const m of (allMembers || [])) {
        countMap.set(m.partyId, (countMap.get(m.partyId) || 0) + 1);
      }
    }

    const partiesWithCounts = (parties || []).map((p: any) => ({
      ...p,
      leaderName: leaderMap.get(p.leaderUserId) || 'Sconosciuto',
      memberCount: countMap.get(p.id) || 0
    }));

    res.json(partiesWithCounts.sort((a, b) => b.memberCount - a.memberCount));
  }

  // GET /api/parties/my
  async function getMyParty(req: any, res: any) {
    const { data: membership } = await supabase.from('party_members').select('partyId').eq('userId', req.user.id).maybeSingle();
    if (!membership) return res.status(404).json({ error: "Non sei in nessun partito." });

    // Fetch full party data (same logic as /api/parties/:id)
    const { data: party, error: partyError } = await supabase
      .from('parties')
      .select('*')
      .eq('id', membership.partyId)
      .single();

    if (partyError || !party) return res.status(404).json({ error: "Partito non trovato" });

    let leaderName = 'Sconosciuto';
    if (party.leaderUserId) {
      const { data: leader } = await supabase.from('users').select('username').eq('id', party.leaderUserId).single();
      if (leader) leaderName = leader.username;
    }

    const { data: members } = await supabase
      .from('party_members')
      .select('*')
      .eq('partyId', membership.partyId)
      .order('joinedAt', { ascending: true });

    // Batch fetch member usernames
    const memberUserIds = [...new Set((members || []).map((m: any) => m.userId).filter(Boolean))];
    const userMap = new Map<string, any>();
    if (memberUserIds.length > 0) {
      const { data: usersData } = await supabase.from('users').select('id, username, level, lastLogin').in('id', memberUserIds);
      (usersData || []).forEach((u: any) => userMap.set(u.id, u));
    }

    const mappedMembers = (members || []).map((m: any) => {
      const userData = userMap.get(m.userId);
      return {
        ...m,
        username: userData?.username || 'Sconosciuto',
        level: userData?.level || 0,
        lastLogin: userData?.lastLogin || 0
      };
    });

    const now = Date.now();
    const activeMembersCount = mappedMembers.filter((m: any) => {
      const lastLoginTs = typeof m.lastLogin === 'string' ? new Date(m.lastLogin).getTime() : (m.lastLogin || 0);
      return now - lastLoginTs <= 48 * 60 * 60 * 1000;
    }).length;

    res.json({
      party: { ...party, leaderName },
      members: mappedMembers,
      activeMembersCount
    });
  }

  // GET /api/parties/:id
  async function getPartyById(req: any, res: any) {
    const { id } = req.params;
    const { data: party, error: partyError } = await supabase
      .from('parties')
      .select('*')
      .eq('id', id)
      .single();

    if (partyError || !party) return res.status(404).json({ error: "Partito non trovato" });

    let leaderName = 'Sconosciuto';
    if (party.leaderUserId) {
      const { data: leader } = await supabase.from('users').select('username').eq('id', party.leaderUserId).single();
      if (leader) leaderName = leader.username;
    }

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
    const activeMembersCount = mappedMembers.filter((m: any) => {
      const lastLoginTs = typeof m.lastLogin === 'string' ? new Date(m.lastLogin).getTime() : (m.lastLogin || 0);
      return now - lastLoginTs <= 48 * 60 * 60 * 1000;
    }).length;

    // Primaries vote counts for current cycle
    const currentCycleStart = getPrimariesCycleStart();

    const { data: primariesVotes } = await supabase
      .from('party_primaries')
      .select('candidateId')
      .eq('partyId', id)
      .gte('createdAt', currentCycleStart);

    const voteCounts: Record<string, number> = {};
    (primariesVotes || []).forEach((v: any) => {
      voteCounts[v.candidateId] = (voteCounts[v.candidateId] || 0) + 1;
    });

    // Check if current user has already voted in this cycle
    const { data: myVote } = await supabase
      .from('party_primaries')
      .select('id')
      .eq('voterId', req.user.id)
      .eq('partyId', id)
      .gte('createdAt', currentCycleStart)
      .maybeSingle();

    res.json({
      party: { ...party, leaderName },
      members: mappedMembers,
      activeMembersCount,
      primariesVoteCounts: voteCounts,
      hasVotedPrimaries: !!myVote
    });
  }

  // POST /api/parties/roles
  async function setPartyRoles(req: any, res: any) {
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
  }

  // POST /api/parties/kick
  async function kickMember(req: any, res: any) {
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

    const logId = generateSecureId(9);
    await supabase.from('party_logs').insert({
      id: logId,
      partyId,
      action: 'kick',
      details: `Utente rimosso dal partito. Esecutore: ${user.username}`,
      timestamp: Date.now()
    });

    res.json({ success: true });
  }

  // POST /api/parties/set-wage
  async function setWage(req: any, res: any) {
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
  }

  // POST /api/parties/pay-wages
  async function payWages(req: any, res: any) {
    const user = req.user;
    const { partyId } = req.body;

    const { data: party } = await supabase.from('parties').select('leaderUserId').eq('id', partyId).single();
    if (!party || party.leaderUserId !== user.id) return res.status(403).json({ error: "Solo il leader può pagare i salari." });

    const { data: lastPayment } = await supabase.from('party_logs').select('timestamp').eq('partyId', partyId).eq('action', 'pay_wages').order('timestamp', { ascending: false }).limit(1).maybeSingle();
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

    // Update members using SQL arithmetic (gold = gold + X) to avoid read-then-write race conditions
    const updates = validToPay.map(async (m) => {
      const cashAdd = m.salaryCash || 0;
      const goldAdd = m.salaryGold || 0;
      // Use raw RPC or direct SQL update with relative increments
      // Supabase JS doesn't support increment natively, so we refetch and update
      // but we use maybeSingle to handle missing users gracefully
      const { data: memberUser } = await supabase.from('users').select('money, gold').eq('id', m.userId).maybeSingle();
      if (memberUser) {
        return supabase.from('users').update({
          money: (memberUser.money || 0) + cashAdd,
          gold: (memberUser.gold || 0) + goldAdd
        }).eq('id', m.userId);
      }
    });
    await Promise.all(updates);

    await supabase.from('party_logs').insert({
      id: generateSecureId(9),
      partyId,
      action: 'pay_wages',
      details: `Pagati totali $${totalCash} e ${totalGold} Gold a ${validToPay.length} membri.`,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, paidMembers: validToPay.length, totalCash, totalGold });
  }

  // POST /api/parties/contribute
  async function contribute(req: any, res: any) {
    const user = req.user;

    try {
      const result = await partyAssetsService.transferPartyAsset({
        senderUser: { id: user.id, username: user.username },
        targetUserId: req.body?.targetUserId,
        itemType: req.body?.itemType,
        amount: req.body?.amount,
        logIdFactory: () => generateSecureId(9),
        nowIsoFactory: () => new Date().toISOString(),
      });

      const http = mapServiceResultToHttp(result);
      return res.status(http.statusCode).json(http.body);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  // POST /api/parties/invite
  async function invite(req: any, res: any) {
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
      id: generateSecureId(9),
      partyId: myMembership.partyId,
      userId: targetUserId,
      invitedBy: user.id,
      status: 'pending',
      createdAt: new Date().toISOString()
    });

    res.json({ success: true });
  }

  // GET /api/parties/my-invites
  async function getMyInvites(req: any, res: any) {
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
  }

  // POST /api/parties/join
  async function joinParty(req: any, res: any) {
    const user = req.user;
    const { inviteId } = req.body;

    if (atomicOperations?.joinParty) {
      const result = await atomicOperations.joinParty({
        inviteId,
        userId: user.id,
        operationKey: req.body?.idempotencyKey || req.headers?.['x-idempotency-key'] || null,
      });

      if (!result?.success) {
        const codeToStatus: Record<string, number> = {
          invalid_input: 400,
          invite_invalid: 400,
          invite_not_found: 404,
          already_member: 409,
        };
        return res.status(codeToStatus[result?.code] || 400).json({ error: result?.message || "Operazione non riuscita." });
      }

      return res.json({ success: true, partyId: result.partyId });
    }

    const { data: invite } = await supabase.from('party_invites').select('partyId, status').eq('id', inviteId).eq('userId', user.id).single();
    if (!invite) return res.status(404).json({ error: "Invito non trovato." });
    if (invite.status !== 'pending') return res.status(400).json({ error: "L'invito non è più valido." });
    const { data: existingMember } = await supabase.from('party_members').select('partyId').eq('userId', user.id).single();
    if (existingMember) return res.status(400).json({ error: "Fai già parte di un partito." });
    await supabase.from('party_invites').update({ status: 'accepted' }).eq('id', inviteId);
    await supabase.from('party_members').insert({ userId: user.id, partyId: invite.partyId, role: 'member', joinedAt: new Date().toISOString() });
    await supabase.from('party_invites').update({ status: 'rejected' }).eq('userId', user.id).eq('status', 'pending');
    res.json({ success: true, partyId: invite.partyId });
  }

  // POST /api/parties/primaries-vote
  async function primariesVote(req: any, res: any) {
    const user = req.user;
    const { candidateId } = req.body;

    const { data: myMembership } = await supabase.from('party_members').select('partyId').eq('userId', user.id).single();
    if (!myMembership) return res.status(403).json({ error: "Non fai parte di alcun partito." });

    const { data: targetMembership } = await supabase.from('party_members').select('partyId').eq('userId', candidateId).single();
    if (!targetMembership || targetMembership.partyId !== myMembership.partyId) return res.status(400).json({ error: "Candidato non valido." });

    const currentCycleStart = getPrimariesCycleStart();

    const { data: existingVote } = await supabase.from('party_primaries').select('id').eq('voterId', user.id).gte('createdAt', currentCycleStart).single();
    if (existingVote) return res.status(400).json({ error: "Hai già votato in questo ciclo." });

    await supabase.from('party_primaries').insert({
      id: generateSecureId(9),
      partyId: myMembership.partyId,
      candidateId,
      voterId: user.id,
      createdAt: new Date().toISOString()
    });

    res.json({ success: true });
  }

  // GET /api/elections
  async function getElections(req: any, res: any) {
    const user = req.user;
    const { data: election } = await supabase.from('elections').select('*').eq('regionId', user.residenceId).eq('status', 'active').order('createdAt', { ascending: false }).limit(1).single();

    const { data: parties } = await supabase.from('parties').select('id, name, tag, logo, ideology').eq('regionId', user.residenceId);

    if (!election) return res.json({ election: null, parties: parties || [], myVote: null });

    const { data: votes } = await supabase.from('election_votes').select('partyId').eq('electionId', election.id);

    const voteCounts: Record<string, number> = {};
    (votes || []).forEach(v => voteCounts[v.partyId] = (voteCounts[v.partyId] || 0) + 1);

    const partiesWithVotes = (parties || []).map((p: any) => ({
      ...p,
      votes: voteCounts[p.id] || 0
    }));

    const { data: myVote } = await supabase.from('election_votes').select('partyId').eq('electionId', election.id).eq('voterId', user.id).single();

    res.json({ election, parties: partiesWithVotes, myVote: myVote?.partyId });
  }

  // POST /api/elections/vote
  async function voteElection(req: any, res: any) {
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
      id: generateSecureId(9),
      electionId,
      voterId: user.id,
      partyId,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true });
  }

  // GET /api/parliament
  async function getParliament(req: any, res: any) {
    const user = req.user;
    const { data: members } = await supabase
      .from('parliament_members')
      .select('userId, partyId, electedAt')
      .eq('regionId', user.residenceId);

    if (!members || members.length === 0) return res.json([]);

    const userIds = [...new Set(members.map((m: any) => m.userId))];
    const partyIds = [...new Set(members.map((m: any) => m.partyId).filter(Boolean))];

    const { data: users } = await supabase.from('users').select('id, username, level').in('id', userIds);
    const parties = partyIds.length > 0
      ? (await supabase.from('parties').select('id, name, tag').in('id', partyIds)).data
      : [];

    const userMap: Record<string, any> = {};
    (users || []).forEach((u: any) => { userMap[u.id] = u; });
    const partyMap: Record<string, any> = {};
    (parties || []).forEach((p: any) => { partyMap[p.id] = p; });

    const mapped = members.map((m: any) => ({
      userId: m.userId,
      username: userMap[m.userId]?.username,
      level: userMap[m.userId]?.level,
      partyName: partyMap[m.partyId]?.name,
      partyTag: partyMap[m.partyId]?.tag,
      electedAt: m.electedAt
    }));

    res.json(mapped);
  }

  // GET /api/blocs
  async function getBlocs(req: any, res: any) {
    const { data: blocs } = await supabase.from('blocs').select('*, users!ownerUserId(username)');

    // Batch-load all active memberships with region owner info in a single query
    const blocIds = (blocs || []).map((b: any) => b.id);
    const memberCountMap = new Map<string, number>();
    const userMemberSet = new Set<string>();

    if (blocIds.length > 0) {
      const { data: allMemberships } = await supabase
        .from('bloc_memberships')
        .select('blocId, stateId, regions!stateId(ownerUserId)')
        .in('blocId', blocIds)
        .eq('status', 'active');

      for (const m of (allMemberships || [])) {
        memberCountMap.set(m.blocId, (memberCountMap.get(m.blocId) || 0) + 1);
        if ((m as any).regions?.ownerUserId === req.user.id) {
          userMemberSet.add(m.blocId);
        }
      }
    }

    const mapped = (blocs || []).map((b: any) => ({
      ...b,
      ownerName: b.users?.username,
      memberCount: memberCountMap.get(b.id) || 0,
      isMyBloc: userMemberSet.has(b.id) ? 1 : 0
    }));

    const filtered = mapped.filter(b => b.memberCount >= 2 || b.isMyBloc > 0);
    res.json(filtered);
  }

  // GET /api/blocs-map
  async function getBlocsMap(req: any, res: any) {
    try {
      const { data, error } = await supabase
        .from('bloc_memberships')
        .select('stateId, blocId, blocs(name, logo)')
        .eq('status', 'active');
      if (error) throw error;

      const memberships = (data || []).map((m: any) => ({
        stateId: m.stateId,
        blocId: m.blocId,
        blocName: m.blocs?.name,
        logo: m.blocs?.logo,
      }));

      const stateIds = [...new Set(memberships.map((m) => m.stateId).filter(Boolean))];
      if (stateIds.length === 0) return res.json([]);

      // Expand: apply bloc membership to ALL regions belonging to that state (nation_id = stateId)
      const { data: memberRegions } = await supabase
        .from('regions')
        .select('id, nation_id')
        .in('nation_id', stateIds);

      const byState = new Map<string, string[]>();
      (memberRegions || []).forEach((r: any) => {
        if (!r?.nation_id) return;
        if (!byState.has(r.nation_id)) byState.set(r.nation_id, []);
        byState.get(r.nation_id)!.push(r.id);
      });

      const expanded: any[] = [];
      for (const m of memberships) {
        const regionIds = new Set<string>();
        if (m.stateId) regionIds.add(m.stateId);
        for (const rid of (byState.get(m.stateId) || [])) regionIds.add(rid);
        for (const rid of regionIds) {
          expanded.push({
            regionId: rid,
            stateId: m.stateId,
            blocId: m.blocId,
            blocName: m.blocName,
            logo: m.logo,
          });
        }
      }

      res.json(expanded);
    } catch (e: any) {
      console.error("[BlocsMap] Error:", e?.message || e);
      res.status(500).json({ error: "Errore nel caricamento mappa blocchi" });
    }
  }

  // GET /api/blocs/:id
  async function getBlocById(req: any, res: any) {
    const user = req.user;
    const blocId = req.params.id;

    const { data: bloc } = await supabase.from('blocs').select('*, users!ownerUserId(username), regions!ownerStateId(name)').eq('id', blocId).single();
    if (!bloc) return res.status(404).json({ error: "Blocco non trovato." });

    const { data: members } = await supabase.from('bloc_memberships').select('*, regions!stateId(name, ownerUserId, nation_id, users!ownerUserId(username), nations!nation_id(name, logo))').eq('blocId', blocId).eq('status', 'active');
    const mMapped = (members || []).map((m: any) => ({
      ...m,
      stateName: m.regions?.name,
      nationName: m.regions?.nations?.name || null,
      nationLogo: m.regions?.nations?.logo || null,
      leaderName: m.regions?.users?.username,
      ownerUserId: m.regions?.ownerUserId
    }));

    const { data: reg } = await supabase.from('bloc_regulations').select('*').eq('blocId', blocId).single();
    const regulations = reg || { openBorders: 0, defaultMilitaryAgreement: 0 };

    const isMemberLeader = mMapped.some(m => m.ownerUserId === user.id);

    let applications: any[] = [];
    let proposals: any[] = [];

    if (isMemberLeader) {
      const [{ data: apps }, { data: props }] = await Promise.all([
        supabase.from('bloc_applications').select('*, regions!stateId(name, ownerUserId, users!ownerUserId(username))').eq('blocId', blocId).eq('status', 'pending'),
        supabase.from('bloc_regulation_proposals').select('*').eq('blocId', blocId).eq('status', 'pending')
      ]);

      // Batch-load all votes for applications and proposals in a single query
      const allTargetIds = [...(apps || []).map((a: any) => a.id), ...(props || []).map((p: any) => p.id)];
      let voteMap = new Map<string, any[]>();
      if (allTargetIds.length > 0) {
        const { data: allVotes } = await supabase.from('bloc_votes').select('*').in('targetId', allTargetIds);
        for (const v of (allVotes || [])) {
          if (!voteMap.has(v.targetId)) voteMap.set(v.targetId, []);
          voteMap.get(v.targetId)!.push(v);
        }
      }

      for (const a of (apps || [])) {
        applications.push({ ...a, stateName: a.regions?.name, leaderName: a.regions?.users?.username, votes: voteMap.get(a.id) || [] });
      }
      for (const p of (props || [])) {
        proposals.push({ ...p, votes: voteMap.get(p.id) || [] });
      }
    }

    res.json({ bloc: { ...bloc, ownerName: (bloc as any).users?.username, ownerStateName: (bloc as any).regions?.name }, members: mMapped, regulations, applications, proposals, isMemberLeader });
  }

  // POST /api/blocs/:id/update
  async function updateBloc(req: any, res: any) {
    const user = req.user;
    const blocId = req.params.id;
    const { name, description, logo } = req.body;

    if (!name || name.trim().length === 0) return res.status(400).json({ error: "Nome obbligatorio." });
    const { data: bloc } = await supabase.from('blocs').select('ownerUserId').eq('id', blocId).single();
    if (!bloc) return res.status(404).json({ error: "Blocco non trovato." });
    if (bloc.ownerUserId !== user.id) return res.status(403).json({ error: "Solo il fondatore può farlo." });

    await supabase.from('blocs').update({ name: name.trim(), description: description || '', logo: logo || '' }).eq('id', blocId);
    res.json({ success: true });
  }

  // POST /api/blocs/create
  async function createBloc(req: any, res: any) {
    const user = req.user;
    const { name, stateId, description, logo } = req.body;

    if (!name || name.trim().length === 0) return res.status(400).json({ error: "Nome obbligatorio." });
    if (!stateId) return res.status(400).json({ error: "Devi selezionare uno Stato da te guidato." });

    if (atomicOperations?.createBloc) {
      const result = await atomicOperations.createBloc({
        userId: user.id,
        stateId,
        name: name.trim(),
        description,
        logo,
        operationKey: req.body?.idempotencyKey || req.headers?.['x-idempotency-key'] || null,
      });

      if (!result?.success) {
        const codeToStatus: Record<string, number> = {
          invalid_input: 400,
          forbidden: 403,
          region_not_found: 404,
          already_member: 409,
          name_conflict: 409,
        };
        return res.status(codeToStatus[result?.code] || 400).json({ error: result?.message || "Operazione non riuscita." });
      }

      return res.json({ success: true, blocId: result.blocId });
    }

    const { data: region } = await supabase.from('regions').select('ownerUserId').eq('id', stateId).single();
    if (!region || region.ownerUserId !== user.id) return res.status(403).json({ error: "Solo il Leader dello Stato può creare un blocco a suo nome." });
    const { data: existingMembership } = await supabase.from('bloc_memberships').select('blocId').eq('stateId', stateId).eq('status', 'active').maybeSingle();
    if (existingMembership) return res.status(400).json({ error: "Questo Stato fa già parte di un blocco." });
    const { data: existingBloc } = await supabase.from('blocs').select('id').eq('name', name.trim()).maybeSingle();
    if (existingBloc) return res.status(409).json({ error: "Esiste già un blocco con questo nome." });
    const id = generateSecureId(9);
    const now = new Date().toISOString();
    await supabase.from('blocs').insert({ id, name: name.trim(), logo: logo || '', description: description || '', ownerStateId: stateId, ownerUserId: user.id, createdAt: now });
    await supabase.from('bloc_memberships').insert({ blocId: id, stateId, status: 'active', joinedAt: now });
    await supabase.from('bloc_regulations').insert({ blocId: id, openBorders: 0, defaultMilitaryAgreement: 0 });
    res.json({ success: true, blocId: id });
  }

  // POST /api/blocs/:id/apply
  async function applyToBloc(req: any, res: any) {
    const user = req.user;
    const blocId = req.params.id;
    const { stateId } = req.body;

    if (!stateId) return res.status(400).json({ error: "Stato non specificato." });

    if (atomicOperations?.applyToBloc) {
      const result = await atomicOperations.applyToBloc({
        blocId,
        userId: user.id,
        stateId,
        operationKey: req.body?.idempotencyKey || req.headers?.['x-idempotency-key'] || null,
      });

      if (!result?.success) {
        const codeToStatus: Record<string, number> = {
          invalid_input: 400,
          forbidden: 403,
          region_not_found: 404,
          already_member: 409,
        };
        return res.status(codeToStatus[result?.code] || 400).json({ error: result?.message || "Operazione non riuscita." });
      }

      return res.json({ success: true });
    }

    const { data: region } = await supabase.from('regions').select('ownerUserId').eq('id', stateId).single();
    if (!region || region.ownerUserId !== user.id) return res.status(403).json({ error: "Solo il leader può candidarsi." });
    const { data: existingMember } = await supabase.from('bloc_memberships').select('blocId').eq('stateId', stateId).eq('status', 'active').maybeSingle();
    if (existingMember) return res.status(400).json({ error: "Questo Stato è già in un blocco." });
    const { data: existingApp } = await supabase.from('bloc_applications').select('id').eq('blocId', blocId).eq('stateId', stateId).eq('status', 'pending').maybeSingle();
    if (existingApp) return res.status(400).json({ error: "Candidatura già pendente." });
    await supabase.from('bloc_applications').insert({
      id: generateSecureId(9), blocId, stateId, createdAt: new Date().toISOString(), status: 'pending'
    });
    res.json({ success: true });
  }

  // POST /api/blocs/applications/:id/vote
  async function voteApplication(req: any, res: any) {
    const user = req.user;
    const appId = req.params.id;
    const { voterStateId, choice } = req.body;
    const voteChoice = choice ? 1 : 0;

    if (atomicOperations?.voteBlocApplication) {
      const result = await atomicOperations.voteBlocApplication({
        applicationId: appId,
        voterUserId: user.id,
        voterStateId,
        choice: voteChoice,
        operationKey: req.body?.idempotencyKey || req.headers?.['x-idempotency-key'] || null,
      });

      if (!result?.success) {
        const codeToStatus: Record<string, number> = {
          invalid_input: 400,
          invalid_application: 400,
          forbidden: 403,
        };
        return res.status(codeToStatus[result?.code] || 400).json({ error: result?.message || "Operazione non riuscita." });
      }

      return res.json({ success: true, result: result.result });
    }

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
  }

  // POST /api/blocs/:id/regulations/propose
  async function proposeRegulation(req: any, res: any) {
    const user = req.user;
    const blocId = req.params.id;
    const { proposerStateId, type, proposedValue } = req.body;
    const value = proposedValue ? 1 : 0;

    if (!['openBorders', 'migrationOpen', 'defaultMilitaryAgreement'].includes(type)) return res.status(400).json({ error: "Tipo non valido." });

    if (atomicOperations?.proposeBlocRegulation) {
      const result = await atomicOperations.proposeBlocRegulation({
        blocId,
        proposerUserId: user.id,
        proposerStateId,
        type,
        proposedValue: value,
        operationKey: req.body?.idempotencyKey || req.headers?.['x-idempotency-key'] || null,
      });

      if (!result?.success) {
        const codeToStatus: Record<string, number> = {
          invalid_input: 400,
          invalid_type: 400,
          forbidden: 403,
          duplicate_pending: 409,
        };
        return res.status(codeToStatus[result?.code] || 400).json({ error: result?.message || "Operazione non riuscita." });
      }

      return res.json({ success: true, proposalId: result.proposalId });
    }

    const { data: membership } = await supabase.from('bloc_memberships').select('status').eq('blocId', blocId).eq('stateId', proposerStateId).eq('status', 'active').single();
    if (!membership) return res.status(403).json({ error: "Non sei un membro attivo." });
    const { data: region } = await supabase.from('regions').select('ownerUserId').eq('id', proposerStateId).single();
    if (!region || region.ownerUserId !== user.id) return res.status(403).json({ error: "Solo il leader può proporre." });
    const { data: existingProp } = await supabase.from('bloc_regulation_proposals').select('id').eq('blocId', blocId).eq('type', type).eq('status', 'pending').maybeSingle();
    if (existingProp) return res.status(400).json({ error: "Proposta già pendente." });
    const id = generateSecureId(9);
    const now = new Date().toISOString();
    await supabase.from('bloc_regulation_proposals').insert({ id, blocId, type, proposedValue: value, createdAt: now, status: 'pending' });
    await supabase.from('bloc_votes').insert({ targetId: id, voterStateId: proposerStateId, choice: 1, createdAt: now });
    res.json({ success: true });
  }

  // POST /api/blocs/regulations/proposals/:id/vote
  async function voteRegulationProposal(req: any, res: any) {
    const user = req.user;
    const propId = req.params.id;
    const { voterStateId, choice } = req.body;
    const voteChoice = choice ? 1 : 0;

    if (atomicOperations?.voteBlocRegulation) {
      const result = await atomicOperations.voteBlocRegulation({
        proposalId: propId,
        voterUserId: user.id,
        voterStateId,
        choice: voteChoice,
        operationKey: req.body?.idempotencyKey || req.headers?.['x-idempotency-key'] || null,
      });

      if (!result?.success) {
        const codeToStatus: Record<string, number> = {
          invalid_input: 400,
          invalid_proposal: 400,
          forbidden: 403,
        };
        return res.status(codeToStatus[result?.code] || 400).json({ error: result?.message || "Operazione non riuscita." });
      }

      return res.json({ success: true, result: result.result });
    }

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
  }

  // GET /api/parliament/laws
  async function getParliamentLaws(req: any, res: any) {
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
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  // POST /api/parliament/laws/propose
  async function proposeLaw(req: any, res: any) {
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

      const autocracies = ["DICTATORSHIP", "ONE_PARTY_SYSTEM"];
      const isEconomicsMinister = region.economicAdviserId === user.id;
      const lawCat = lawDef.category;
      const canFastPass = (isEconomicsMinister && (lawCat === "Economia e Tasse" || lawCat === "Costruzioni Statali")) ||
        (isForeignMinister && (type === 'open_borders' || type === 'close_borders'));
      const forceImmediate = !!(region.dictatorship || autocracies.includes(region.governmentForm) || canFastPass);

      if (forceImmediate && !isLeader && (region.dictatorship || autocracies.includes(region.governmentForm))) {
        return res.status(403).json({ error: "In questo regime solo il Leader può legiferare." });
      }

      if (atomicOperations?.proposeLaw) {
        const result = await atomicOperations.proposeLaw({
          userId: user.id,
          regionId: region.id,
          type,
          params,
          forceImmediate,
          operationKey: req.body?.idempotencyKey || req.headers?.['x-idempotency-key'] || null,
        });

        if (!result?.success) {
          const codeToStatus: Record<string, number> = {
            invalid_input: 400,
            region_not_found: 404,
            duplicate_pending: 409,
            dictatorship_limit: 409,
            forbidden: 403,
          };
          return res.status(codeToStatus[result?.code] || 400).json({ error: result?.message || "Operazione non riuscita." });
        }

        return res.json({
          success: true,
          lawId: result.lawId,
          immediate: !!result.immediate,
          ...(forceImmediate ? { message: "Legge approvata immediatamente grazie ai tuoi poteri ministeriali." } : {}),
        });
      }

      const lawId = `law_${Date.now()}_${generateSecureId(6)}`;
      const nowIso = new Date().toISOString();
      if (forceImmediate) {
        await supabase.from('laws').insert({
          id: lawId, regionId: region.id, proposerId: user.id, type, params, status: 'passed', createdAt: nowIso, expiresAt: nowIso
        });
        await lawDef.execute(region, params, lawId);
        return res.json({ success: true, lawId, immediate: true, ...(canFastPass ? { message: "Legge approvata immediatamente grazie ai tuoi poteri ministeriali." } : {}) });
      }
      const expiresAt = new Date(Date.now() + (lawDef.delayDays * 24 * 60 * 60 * 1000)).toISOString();
      await supabase.from('laws').insert({ id: lawId, regionId: region.id, proposerId: user.id, type, params, status: 'pending', createdAt: nowIso, expiresAt });
      await supabase.from('law_votes').insert({ lawId, voterId: user.id, vote: 'yes', createdAt: nowIso });
      res.json({ success: true, lawId, immediate: false });
    } catch (err: any) {
      console.error("Error proposing law:", err);
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  // POST /api/parliament/laws/vote
  async function voteLaw(req: any, res: any) {
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

        if (atomicOperations?.resolveLaw) {
          const result = await atomicOperations.resolveLaw({
            lawId,
            actorUserId: user.id,
            action: vote === 'yes' || vote === 'assent' ? 'assent' : 'veto',
            operationKey: req.body?.idempotencyKey || req.headers?.['x-idempotency-key'] || null,
          });
          if (!result?.success) {
            return res.status(400).json({ error: result?.message || "Operazione non riuscita." });
          }
          return res.json({ success: true, result: result.result });
        }

        if (vote === 'yes' || vote === 'assent') {
          await supabase.from('laws').update({ status: 'passed' }).eq('id', lawId);
          try { await LawRegistry[law.type]?.execute(region, law.params, law.id); } catch (e) { console.error(`Error executing law ${law.type} after assent:`, e); }
          return res.json({ success: true, result: 'passed' });
        }
        await supabase.from('laws').update({ status: 'rejected' }).eq('id', lawId);
        return res.json({ success: true, result: 'vetoed' });
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
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  // POST /api/parliament/laws/withdraw
  async function withdrawLaw(req: any, res: any) {
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

    if (atomicOperations?.resolveLaw) {
      const result = await atomicOperations.resolveLaw({
        lawId,
        actorUserId: user.id,
        action: 'withdraw',
        operationKey: req.body?.idempotencyKey || req.headers?.['x-idempotency-key'] || null,
      });
      if (!result?.success) return res.status(400).json({ error: result?.message || "Operazione non riuscita." });
      return res.json({ success: true });
    }

    const { error: uError } = await supabase.from('laws').update({ status: 'withdrawn' }).eq('id', lawId);
    if (uError) return res.status(500).json({ error: uError.message });
    res.json({ success: true });
  }

  // POST /api/parliament/laws/pass
  async function passLaw(req: any, res: any) {
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

      if (atomicOperations?.resolveLaw) {
        const result = await atomicOperations.resolveLaw({
          lawId,
          actorUserId: user.id,
          action: 'fast_pass',
          operationKey: req.body?.idempotencyKey || req.headers?.['x-idempotency-key'] || null,
        });
        if (!result?.success) return res.status(400).json({ error: result?.message || "Operazione non riuscita." });
        return res.json({ success: true, message: "Legge approvata via Fast-Pass ministeriale." });
      }

      await supabase.from('laws').update({ status: 'passed', expiresAt: new Date().toISOString() }).eq('id', lawId);
      try { await lawDef.execute(region, law.params, law.id); } catch (e) { console.error(`Error executing fast-passed law ${law.type}:`, e); }
      res.json({ success: true, message: "Legge approvata via Fast-Pass ministeriale." });
    } catch (err: any) {
      console.error("Error in fast-pass:", err);
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  return {
    createParty,
    editParty,
    getParties,
    getMyParty,
    getPartyById,
    setPartyRoles,
    kickMember,
    setWage,
    payWages,
    contribute,
    invite,
    getMyInvites,
    joinParty,
    primariesVote,
    getElections,
    voteElection,
    getParliament,
    getBlocs,
    getBlocsMap,
    getBlocById,
    updateBloc,
    createBloc,
    applyToBloc,
    voteApplication,
    proposeRegulation,
    voteRegulationProposal,
    getParliamentLaws,
    proposeLaw,
    voteLaw,
    withdrawLaw,
    passLaw,
  };
}
