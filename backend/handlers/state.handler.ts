/**
 * State & Department Handlers
 *
 * Extracted from server.ts — no logic changes.
 * Covers: /api/state/:id, /api/state/:id/donate,
 *   /api/state/:id/departments, /api/state/:id/departments/contribute,
 *   /api/leader/nation/branding, /api/nations/:nationId/energy
 */

// ── Dipartimenti di Stato ──────────────────────────────────
// Lista centralizzata dei dipartimenti validi (risorse + militari)
// Il controllo avviene SOLO server-side — il client non è mai trusted
const DEPT_RESOURCE: readonly string[] = Object.freeze([
  'oil','minerals','uranium','diamonds','gold_ore','liquid_oxygen','helium3','energy','food','steel','gas'
]);
const DEPT_MILITARY: readonly string[] = Object.freeze([
  'tank','aircraft','battleship'
]);
const ALL_VALID_DEPARTMENTS = new Set<string>([...DEPT_RESOURCE, ...DEPT_MILITARY]);
const DEPARTMENT_DAILY_POINTS = 10;
const DEPARTMENT_EDUCATION_REQUIREMENT = 100; // livello perk ISTRUZIONE richiesto

// Labels e icone per la UI dei dipartimenti
const DEPT_META: Record<string, { label: string; icon: string; category: 'resource' | 'military' }> = {
  oil:           { label: 'Petrolio',          icon: '🛢️', category: 'resource' },
  minerals:      { label: 'Minerali',          icon: '🪨', category: 'resource' },
  uranium:       { label: 'Uranio',            icon: '☢️', category: 'resource' },
  diamonds:      { label: 'Diamanti',          icon: '💎', category: 'resource' },
  gold_ore:      { label: 'Oro',               icon: '🪙', category: 'resource' },
  liquid_oxygen: { label: 'Ossigeno Liquido',  icon: '🧊', category: 'resource' },
  helium3:       { label: 'Elio-3',            icon: '⚗️', category: 'resource' },
  energy:        { label: 'Energia',           icon: '⚡', category: 'resource' },
  food:          { label: 'Cibo',              icon: '🍞', category: 'resource' },
  steel:         { label: 'Acciaio',           icon: '⛓️', category: 'resource' },
  gas:           { label: 'Gas Naturale',      icon: '🔥', category: 'resource' },
  tank:          { label: 'Carri Armati',      icon: '🛡️', category: 'military' },
  aircraft:      { label: 'Aerei',             icon: '✈️', category: 'military' },
  battleship:    { label: 'Corazzate Navali',  icon: '⚓', category: 'military' },
};

/**
 * Calcola il bonus percentuale basato sul rank globale.
 * Struttura preparata per la fase 2 — NON ancora applicata al gameplay.
 * rank 1 → +10%, 2 → +8%, 3 → +6%, 4-5 → +4%, resto → 0%
 */
function getDeptBonusMultiplier(rank: number): number {
  if (rank === 1) return 0.10;
  if (rank === 2) return 0.08;
  if (rank === 3) return 0.06;
  if (rank <= 5)  return 0.04;
  return 0;
}

export function createStateHandlers(deps: {
  supabase: any;
  calculateStateSalaries: any;
  getUserPerks: any;
  addXP: any;
  canManageRegion: any;
  retrySupabaseOperation: any;
  GAME_CONFIG: any;
}) {
  const { supabase, calculateStateSalaries } = deps;

  // GET /api/state/:id
  async function getState(req: any, res: any) {
    try {
      let nationId = (req.params.id || '').toUpperCase();
      if (nationId.includes('-')) nationId = nationId.split('-')[0];
      
      // 1. Fetch main nation data
      const { data: nation, error: nationError } = await supabase
        .from('nations')
        .select(`
          *,
          leader:users!leaderUserId(id, username, avatarData)
        `)
        .eq('id', nationId)
        .single();

      if (nationError || !nation) {
        // Fallback: if nation record doesn't exist, we might want to return 404
        // or a basic "independent" state view.
        return res.status(404).json({ error: "Stato non trovato" });
      }

      // 2. Fetch Ministers
      const { data: ministers } = await supabase
        .from('ministers')
        .select('*, user:users(id, username, avatarData)')
        .eq('stateId', nationId)
        .eq('status', 'ACTIVE');

      const economyMinister = ministers?.find((m: any) => m.role === 'economics' || m.role === 'ECONOMICS');
      const foreignMinister = ministers?.find((m: any) => m.role === 'foreign' || m.role === 'FOREIGN');

      // 3. Fetch Regions belonging to this nation via the nation_id foreign key OR leader ownership (definitive fix)
      const { data: regions, error: regionsError } = await supabase
        .from('regions')
        .select('id, name, population, "developmentIndex", governor:users!governorPlayerId(username), "isAutonomous", "energyGeneration", "energyConsumption", "residencePolicy", "workRestrictions", "nextLeaderElectionAt"')
        .or(`nation_id.eq.${nationId}${nation.leaderUserId ? `,ownerUserId.eq.${nation.leaderUserId}` : ''}`);

      if (regionsError) {
        console.error(`[StatePage] Error fetching regions for ${nationId}:`, regionsError.message);
      }

      const regionIds = (regions || []).map((r: any) => r.id);
      console.log(`[StatePage] Nation ${nationId} has ${regions?.length || 0} regions:`, regionIds);

      // 4. Aggregates from regions
      const totalEnergyGen = (regions || []).reduce((sum: number, r: any) => sum + (Number(r.energyGeneration) || 0), 0);
      const totalEnergyCons = (regions || []).reduce((sum: number, r: any) => sum + (Number(r.energyConsumption) || 0), 0);
      const autonomousCount = (regions || []).filter((r: any) => (r as any).isAutonomous).length;
      const capitalRegion = (regions || []).find((r: any) => (r as any).isCapital) || regions?.[0];

      // 5. Counts: Citizens, Residents, Parties, Factories, Wars
      const [citizenCount, residentCount, partyCount, factoryCount, activeWarCount, userRegionBreakdown] = await Promise.all([
        // Citizens: users whose originalNation matches
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('originalNation', nationId),
        // Residents: users currently in these regions
        regionIds.length > 0
          ? supabase.from('users').select('id', { count: 'exact', head: true }).in('regionId', regionIds)
          : { count: 0 },
        // Parties: in these regions
        regionIds.length > 0
          ? supabase.from('parties').select('id', { count: 'exact', head: true }).in('regionId', regionIds)
          : { count: 0 },
        // Factories: in these regions
        regionIds.length > 0
          ? supabase.from('factories').select('id', { count: 'exact', head: true }).in('regionId', regionIds)
          : { count: 0 },
        // Active Wars: involving this nation or its regions
        supabase.from('wars').select('id', { count: 'exact', head: true })
          .or(`attackerCountryIso2.eq.${nationId},defenderCountryIso2.eq.${nationId}`)
          .eq('status', 'active'),
        // Player Breakdown: breakdown of users by region
        regionIds.length > 0
          ? supabase.from('users').select('regionId').in('regionId', regionIds)
          : { data: [] },
      ]);

      // Build the count map for individual regions
      const resCountPerRegion: Record<string, number> = {};
      if (userRegionBreakdown && (userRegionBreakdown as any).data) {
        (userRegionBreakdown as any).data.forEach((u: any) => {
          if (u.regionId) resCountPerRegion[u.regionId] = (resCountPerRegion[u.regionId] || 0) + 1;
        });
      }

      const totalPopulation = (residentCount as any).count || 0;

      // 5. Military Agreements
      const { data: militaryAgreements } = await supabase
        .from('military_agreements')
        .select(`
          *,
          partner:nations!partner_nation_id(id, name, logo)
        `)
        .eq('nation_id', nationId)
        .eq('status', 'ACTIVE');

      const sanctionsQuery = regionIds.length > 0
          ? supabase.from('sanctions')
              .select(`
                  *,
                  sourceNation:regions!fromStateId(id, nation:nations(id, name, logo)),
                  targetNation:regions!targetStateId(id, nation:nations(id, name, logo))
              `)
              .or(`fromStateId.in.(${regionIds.join(',')}),targetStateId.in.(${regionIds.join(',')})`)
              .eq('status', 'ACTIVE')
          : { data: [] };
      
      const { data: sanctions } = await (sanctionsQuery as any);

      // 5b. Migration Agreements — all active agreements where any region of this nation is involved
      let rawMigrationAgreements: any[] = [];
      if (regionIds.length > 0) {
        const sel = '*, rf:regions!fromStateId(id, name, nation:nations(id, name, logo)), rt:regions!toStateId(id, name, nation:nations(id, name, logo))';
        const [{ data: outgoingMig }, { data: incomingMig }] = await Promise.all([
          supabase.from('migration_agreements').select(sel).in('fromStateId', regionIds).eq('status', 'ACTIVE'),
          supabase.from('migration_agreements').select(sel).in('toStateId', regionIds).eq('status', 'ACTIVE'),
        ]);
        // Merge, deduplicate by id
        const seen = new Set<string>();
        for (const row of [...(outgoingMig || []), ...(incomingMig || [])]) {
          if (!seen.has(row.id)) { seen.add(row.id); rawMigrationAgreements.push(row); }
        }
      }

      // 6. Fetch National Budget/Inventory from 'budgets' table
      const { data: budgetData } = await supabase
        .from('budgets')
        .select('*')
        .eq('ownerId', nationId)
        .order('ownerType', { ascending: false }); // STATE before REGION if both exist

      const nationBudget = budgetData?.find((b: any) => b.ownerType === 'STATE') || budgetData?.[0];

      // Helper for translating state terms
      const translateTerm = (term: string | undefined | null): string => {
        if (!term) return '-';
        const map: any = {
          'open': 'Aperti',
          'closed': 'Chiusi',
          'Aperta': 'Aperta',
          'Chiusa': 'Chiusa',
          'Non necessaria': 'Non necessaria',
          'PARLIAMENTARY_REPUBLIC': 'Repubblica Parlamentare',
          'PRESIDENTIAL_REPUBLIC': 'Repubblica Presidenziale',
          'DICTATORSHIP': 'Dittatura',
          'ONE_PARTY_SYSTEM': 'Sistema a Partito Unico',
          'EXECUTIVE_MONARCHY': 'Monarchia Esecutiva',
        };
        return map[term] || term;
      };

      // Format output to match StatePage expectations
      const responseBody = {
        id: nation.id,
        name: nation.name,
        flag: nation.logo || '', // Emoji fallback handled by frontend if needed
        flagUrl: nation.logo?.startsWith('http') ? nation.logo : `https://flagcdn.com/${nation.id.toLowerCase()}.svg`,
        representativeImage: nation.representative_image || undefined,
        regionCount: regions?.length || 0,
        population: totalPopulation,
        governmentForm: translateTerm(nation.government_form),
        headOfState: nation.leader ? {
          name: nation.leader.username,
          role: 'Capo di Stato e Comandante',
          avatar: nation.leader.avatarData,
          salaryGold: calculateStateSalaries(nation.government_form, regions?.length || 0).headOfStateGold
        } : undefined,
        economyMinister: economyMinister ? {
          name: economyMinister.user?.username || 'Incaricato',
          role: "Ministro dell'Economia",
          avatar: economyMinister.user?.avatarData,
          salaryGold: calculateStateSalaries(nation.government_form, regions?.length || 0).ministerGold
        } : undefined,
        foreignMinister: foreignMinister ? {
          name: foreignMinister.user?.username || 'Incaricato',
          role: 'Ministro degli Esteri',
          avatar: foreignMinister.user?.avatarData,
          salaryGold: calculateStateSalaries(nation.government_form, regions?.length || 0).ministerGold
        } : undefined,
        geopoliticalBloc: nation.geopolitical_bloc || undefined,
        stats: {
          citizens: citizenCount.count || 0,
          residents: residentCount.count || 0,
          parties: partyCount.count || 0,
          factories: factoryCount.count || 0,
        },
        treasury: {
          balance: nation.treasury_balance || 0,
          dailyIncome: nation.treasury_daily_income || 0,
          dailyExpenses: nation.treasury_daily_expenses || 0,
          netBalance: (nation.treasury_daily_income || 0) - (nation.treasury_daily_expenses || 0),
          resources: nationBudget?.resources || {}
        },
        details: {
          workPermits: nation.work_permits || 0,
          mandateStart: nation.mandate_start ? new Date(nation.mandate_start).toLocaleString('it-IT') : '-',
          nextElections: (nation.next_elections || capitalRegion?.nextLeaderElectionAt) 
            ? new Date(nation.next_elections || capitalRegion.nextLeaderElectionAt).toLocaleString('it-IT') 
            : '-',
          autonomies: autonomousCount || nation.autonomies || 0,
          entryTax: nation.entry_tax || 0,
          borders: translateTerm(nation.borders_status || capitalRegion?.residencePolicy || 'open'),
          residenceToWork: translateTerm(nation.residence_to_work || (capitalRegion?.workRestrictions ? 'Necessaria' : 'Non necessaria')),
          residence: translateTerm(nation.residence_policy || capitalRegion?.residencePolicy || 'Aperta'),
          energyProduction: totalEnergyGen || nation.energy_production || 0,
          energyConsumption: totalEnergyCons || nation.energy_consumption || 0,
          foundationDate: nation.foundation_date ? new Date(nation.foundation_date).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-',
          ongoingWars: activeWarCount.count || 0,
        },
        bestDepartment: undefined as any, // populated below after dept query
        regions: (regions || []).map((r: any) => ({
          id: r.id,
          name: r.name,
          population: resCountPerRegion[r.id] || 0,
          mainResource: (r as any).mainResource || (r as any).primary_resource || 'Risorse Varie',
          developmentLevel: r.developmentIndex || 1,
          governor: (r as any).governor ? (Array.isArray((r as any).governor) ? (r as any).governor[0]?.username : (r as any).governor?.username) : undefined
        })),
        militaryAgreements: (militaryAgreements || []).map((a: any) => ({
          type: a.agreement_type,
          partnerName: a.partner?.name || 'Sconosciuto',
          partnerFlag: a.partner?.logo,
          status: a.status,
          expiresAt: a.expires_at ? new Date(a.expires_at).toLocaleDateString('it-IT') : undefined
        })),
        migrationAgreements: (rawMigrationAgreements || []).map((a: any) => {
          const isOutgoing = regionIds.includes(a.fromStateId);
          const partnerRegion = isOutgoing ? a.rt : a.rf;
          return {
            type: isOutgoing ? 'outgoing' : 'incoming',
            partnerName: partnerRegion?.nation?.name || partnerRegion?.name || 'Sconosciuto',
            partnerFlag: partnerRegion?.nation?.logo || undefined,
            status: a.status,
            agreementType: a.type || 'UNILATERAL',
          };
        }),
        sanctions: (sanctions || []).map((s: any) => ({
          type: regionIds.includes(s.targetStateId) ? 'sanction_received' : 'sanction_imposed',
          partnerName: regionIds.includes(s.targetStateId) ? s.sourceNation?.nation?.name : s.targetNation?.nation?.name,
          partnerFlag: regionIds.includes(s.targetStateId) ? s.sourceNation?.nation?.logo : s.targetNation?.nation?.logo,
          status: s.status,
          expiresAt: s.revokedAt ? new Date(s.revokedAt).toLocaleDateString('it-IT') : undefined
        })),
      };

      // Fetch real best department from DB (non-blocking: empty table → undefined)
      try {
        const { data: deptScores } = await supabase
          .from('state_department_scores')
          .select('department, score')
          .eq('nation_id', nationId)
          .order('score', { ascending: false })
          .limit(1);

        if (deptScores && deptScores.length > 0) {
          const top = deptScores[0];
          responseBody.bestDepartment = {
            name: top.department,
            value: top.score,
          };
        }
      } catch {
        // non-critical — leave bestDepartment as undefined
      }

      res.json(responseBody);
    } catch (err: any) {
      console.error("Error fetching state data:", err);
      res.status(500).json({ error: "Errore nel caricamento dei dati dello stato" });
    }
  }

  // POST /api/state/:id/donate
  async function donate(req: any, res: any) {
    const nationId = req.params.id;
    const { type, amount } = req.body;
    const userId = (req as any).user.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Importo non valido" });
    }

    try {
      // 1. Get user and verify balance
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError || !user) throw new Error("Utente non trovato");

      // 2. Resource mapping & Check
      const resourceMap: Record<string, string> = {
        'petrolio': 'oil',
        'minerali': 'minerals',
        'uranio': 'uranium',
        'diamanti': 'diamonds',
        'soldi': 'money'
      };
      const realType = resourceMap[type] || type;

      if (realType === 'money') {
        if (BigInt(user.money || 0) < BigInt(amount)) return res.status(400).json({ error: "Saldo denaro insufficiente" });
      } else if (realType === 'gold') {
        if (BigInt(user.gold || 0) < BigInt(amount)) return res.status(400).json({ error: "Saldo gold insufficiente" });
      } else {
        const { data: inv } = await supabase.from('user_inventory').select('*').eq('userId', userId).eq('itemId', realType).single();
        if (!inv || BigInt(inv.quantity || 0) < BigInt(amount)) {
          return res.status(400).json({ error: `Saldo ${realType} insufficiente` });
        }
      }

      // 3. Map to budget key (oro -> gold_ore)
      const budgetResourceKey = realType === 'gold' ? 'gold_ore' : realType;

      // 4. Update State Budget (handles auto-creation if missing)
      let { data: budgets, error: budgetError } = await supabase
        .from('budgets')
        .select('*')
        .eq('ownerType', 'STATE')
        .eq('ownerId', nationId)
        .maybeSingle();

      if (budgetError) throw budgetError;

      if (!budgets) {
        // Auto-create missing budget
        const { data: newBudget, error: createError } = await supabase
          .from('budgets')
          .insert({
            ownerType: 'STATE',
            ownerId: nationId,
            moneyEUR: 0,
            resources: {},
            updatedAt: Date.now()
          })
          .select()
          .single();
        
        if (createError) {
          if (createError.code === '23505') {
            const { data: retryBudget } = await supabase
              .from('budgets')
              .select('*')
              .eq('ownerType', 'STATE')
              .eq('ownerId', nationId)
              .single();
            budgets = retryBudget;
          } else {
            console.error("Budget creation error:", createError);
            throw new Error("Errore nell'inizializzazione del budget statale");
          }
        } else {
          budgets = newBudget;
        }
      }

      if (!budgets) throw new Error("Errore critico: Budget non recuperabile");

      // 5. Define transaction ID early
      const txId = `don_${Date.now()}_${userId}`;

      // 6. Update User (Deduct funds/resources)
      if (realType === 'money') {
        await supabase.from('users').update({ money: BigInt(user.money || 0) - BigInt(amount) }).eq('id', userId);
      } else if (realType === 'gold') {
        await supabase.from('users').update({ gold: BigInt(user.gold || 0) - BigInt(amount) }).eq('id', userId);
      } else {
        const { data: currentInv } = await supabase.from('user_inventory').select('quantity').eq('userId', userId).eq('itemId', realType).single();
        await supabase.from('user_inventory').update({ quantity: BigInt(currentInv?.quantity || 0) - BigInt(amount) }).eq('userId', userId).eq('itemId', realType);
      }

      // 7. Update Budget
      const updateData: any = { updatedAt: Date.now() };
      if (realType === 'money') {
        updateData.moneyEUR = BigInt(budgets.moneyEUR || 0) + BigInt(amount);
      } else {
        const currentRes = budgets.resources || {};
        currentRes[budgetResourceKey] = (Number(currentRes[budgetResourceKey]) || 0) + Number(amount);
        updateData.resources = currentRes;
      }

      const { error: budgetUpdateError } = await supabase.from('budgets').update(updateData).eq('id', budgets.id);
      if (budgetUpdateError) throw budgetUpdateError;

      // 8. Log transaction
      await supabase.from('budget_transactions').insert({
        id: txId,
        budgetId: budgets.id,
        type: 'INCOME',
        subtype: 'DONATION',
        moneyDelta: realType === 'money' ? amount : 0,
        resourcesDelta: realType !== 'money' ? { [budgetResourceKey]: amount } : {},
        createdAt: Date.now(),
        createdByUserId: userId,
        metadata: { donor: user.username, resourceType: realType }
      });

      // 9. Sync Nations treasury_balance
      if (realType === 'money') {
        const { data: nation } = await supabase.from('nations').select('treasury_balance').eq('id', nationId).single();
        if (nation) {
          await supabase.from('nations').update({ 
            treasury_balance: BigInt(nation.treasury_balance || 0) + BigInt(amount) 
          }).eq('id', nationId);
        }
      }

      res.json({ success: true, message: "Donazione effettuata con successo!", transactionId: txId });
    } catch (err: any) {
      console.error("Donation error:", err);
      res.status(500).json({ error: "Errore durante la donazione: " + (err.message || "Errore interno") });
    }
  }

  // GET /api/state/:id/departments
  async function getDepartments(req: any, res: any) {
    try {
      const nationId = (req.params.id || '').toUpperCase().split('-')[0];
      if (!nationId || !/^[A-Z]{2,4}$/.test(nationId)) {
        return res.status(400).json({ error: 'ID nazione non valido.' });
      }

      const userId = (req as any).user?.id || null;
      const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD' UTC

      // 1. Recupera punteggi di questa nazione
      const { data: nationScores, error: nsErr } = await supabase
        .from('state_department_scores')
        .select('department, score')
        .eq('nation_id', nationId);

      if (nsErr) throw nsErr;

      // 2. Per ogni dipartimento presente, calcola il ranking globale
      //    (quante nazioni hanno score > score di questa nazione)
      const departments: any[] = [];
      for (const dept of (nationScores || [])) {
        const { count: higherCount } = await supabase
          .from('state_department_scores')
          .select('nation_id', { count: 'exact', head: true })
          .eq('department', dept.department)
          .gt('score', dept.score);

        const rank = (higherCount || 0) + 1;
        const meta = DEPT_META[dept.department] || { label: dept.department, icon: '📊', category: 'resource' };
        departments.push({
          id: dept.department,
          label: meta.label,
          icon: meta.icon,
          category: meta.category,
          score: dept.score,
          rank,
          bonusMultiplier: getDeptBonusMultiplier(rank), // preparato, non ancora attivo
        });
      }

      // Ordina per score decrescente
      departments.sort((a: any, b: any) => b.score - a.score);

      // 3. Verifica se l'utente ha già lavorato oggi
      let canContributeToday = false;
      let todayContribution: any = null;

      if (userId) {
        const { data: existing } = await supabase
          .from('player_department_contributions')
          .select('contributions, created_at')
          .eq('player_id', userId)
          .eq('day_key', today)
          .maybeSingle();

        canContributeToday = !existing;
        todayContribution = existing?.contributions || null;

        // Controlla anche l'idoneità (ISTRUZIONE >= 100)
        if (canContributeToday) {
          const { data: perksRows } = await supabase
            .from('perks')
            .select('perkId, level')
            .eq('userId', userId)
            .eq('perkId', 'ISTRUZIONE');
          const istLevel = perksRows?.[0]?.level || 0;
          if (istLevel < DEPARTMENT_EDUCATION_REQUIREMENT) {
            canContributeToday = false; // non idoneo — insufficiente Istruzione
          }
        }
      }

      res.json({
        nationId,
        departments,
        canContributeToday,
        todayContribution,
        allDepartments: [...DEPT_RESOURCE, ...DEPT_MILITARY].map(d => ({
          id: d,
          ...DEPT_META[d],
        })),
      });
    } catch (err: any) {
      console.error('[Departments GET] Error:', err.message);
      res.status(500).json({ error: 'Errore nel caricamento dei dipartimenti.' });
    }
  }

  // POST /api/state/:id/departments/contribute
  async function contributeDepartments(req: any, res: any) {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Non autenticato.' });

    const nationId = (req.params.id || '').toUpperCase().split('-')[0];
    if (!nationId || !/^[A-Z]{2,4}$/.test(nationId)) {
      return res.status(400).json({ error: 'ID nazione non valido.' });
    }

    // 1. Leggi e valida il payload contributions
    const contributions: Record<string, number> = req.body?.contributions || {};
    if (!contributions || typeof contributions !== 'object' || Array.isArray(contributions)) {
      return res.status(400).json({ error: 'Payload contributions non valido.' });
    }

    // Controlla che tutti i campi siano dipartimenti validi e valori interi positivi
    let total = 0;
    for (const [dept, pts] of Object.entries(contributions)) {
      if (!ALL_VALID_DEPARTMENTS.has(dept)) {
        return res.status(400).json({ error: `Dipartimento "${dept}" non valido.` });
      }
      if (!Number.isInteger(pts) || pts <= 0) {
        return res.status(400).json({ error: `Valore non valido per il dipartimento "${dept}": deve essere un intero positivo.` });
      }
      total += pts;
    }

    // La somma DEVE essere esattamente 10
    if (total !== DEPARTMENT_DAILY_POINTS) {
      return res.status(400).json({ error: `La somma dei punti deve essere esattamente ${DEPARTMENT_DAILY_POINTS}. Ricevuto: ${total}.` });
    }

    // Almeno un dipartimento
    if (Object.keys(contributions).length === 0) {
      return res.status(400).json({ error: 'Devi assegnare almeno un punto a un dipartimento.' });
    }

    try {
      // 2. Recupera i dati del player autenticato
      const { data: player, error: playerErr } = await supabase
        .from('users')
        .select('residenceId, originalNation')
        .eq('id', userId)
        .single();

      if (playerErr || !player) {
        return res.status(404).json({ error: 'Profilo utente non trovato.' });
      }

      // 3. Verifica residenza: il player deve risiedere nella nazione target
      //    residenceId è una regione (es. 'IT-RM'), originalNation è la nazione (es. 'IT')
      const playerNation = (player.originalNation || '').toUpperCase().split('-')[0];
      if (playerNation !== nationId) {
        return res.status(403).json({ error: 'Puoi contribuire ai dipartimenti solo nello Stato in cui sei cittadino.' });
      }

      // 4. Verifica perk ISTRUZIONE >= 100
      const { data: perksRows } = await supabase
        .from('perks')
        .select('level')
        .eq('userId', userId)
        .eq('perkId', 'ISTRUZIONE')
        .maybeSingle();

      const istLevel = perksRows?.level || 0;
      if (istLevel < DEPARTMENT_EDUCATION_REQUIREMENT) {
        return res.status(403).json({
          error: `Requisito non soddisfatto: hai bisogno di Istruzione livello ${DEPARTMENT_EDUCATION_REQUIREMENT}. Il tuo livello attuale è ${istLevel}.`,
        });
      }

      // 5. Anti-duplice giornaliero: il UNIQUE constraint sul DB è il gate principale.
      //    Controlliamo anche PRIMA per dare un errore chiaro senza sprecare la write.
      const today = new Date().toISOString().slice(0, 10);
      const { data: existing } = await supabase
        .from('player_department_contributions')
        .select('id')
        .eq('player_id', userId)
        .eq('day_key', today)
        .maybeSingle();

      if (existing) {
        return res.status(409).json({ error: 'Hai già contribuito ai dipartimenti oggi. Riprova domani.' });
      }

      // 6. Inserisci il contributo giornaliero (il UNIQUE constraint blocca race conditions)
      const { error: insertErr } = await supabase
        .from('player_department_contributions')
        .insert({
          player_id: userId,
          nation_id: nationId,
          contributions: contributions as any,
          day_key: today,
        });

      if (insertErr) {
        // Codice 23505 = violazione unique — doppio submit concorrente
        if (insertErr.code === '23505') {
          return res.status(409).json({ error: 'Hai già contribuito ai dipartimenti oggi.' });
        }
        throw insertErr;
      }

      // 7. Aggiorna i punteggi aggregati per ogni dipartimento
      //    Usiamo upsert incrementale per ogni dipartimento
      for (const [dept, pts] of Object.entries(contributions)) {
        // Fetch current score
        const { data: current } = await supabase
          .from('state_department_scores')
          .select('score')
          .eq('nation_id', nationId)
          .eq('department', dept)
          .maybeSingle();

        const newScore = (current?.score || 0) + pts;

        await supabase
          .from('state_department_scores')
          .upsert({
            nation_id: nationId,
            department: dept,
            score: newScore,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'nation_id,department' });
      }

      res.json({ success: true, message: 'Contributo registrato con successo!' });
    } catch (err: any) {
      console.error('[Departments POST] Error:', err.message);
      res.status(500).json({ error: 'Errore durante il salvataggio del contributo.' });
    }
  }

  // POST /api/leader/nation/branding
  async function updateNationBranding(req: any, res: any) {
    const { name, logo, nationId } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Nome nazione obbligatorio." });
    if (name.trim().length > 40) return res.status(400).json({ error: "Nome troppo lungo (max 40 caratteri)." });

    const { data: nation } = await supabase.from('nations').select('*').eq('id', nationId).single();
    if (!nation) return res.status(404).json({ error: "Nazione non trovata." });
    if (nation.leaderUserId !== req.user.id) return res.status(403).json({ error: "Solo il Leader può farlo." });

    const { error: updateError } = await supabase.from('nations').update({ name: name.trim(), logo: logo || '🏛️', updatedAt: Date.now() }).eq('id', nationId);
    if (updateError) return res.status(500).json({ error: "Errore nel salvataggio: " + updateError.message });
    res.json({ success: true });
  }

  // GET /api/nations/:nationId/energy
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

      res.json({
        totalGeneration,
        totalConsumption,
        totalEfficiency: totalGeneration - totalConsumption,
        regions: regionDetails,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  return {
    getState,
    donate,
    getDepartments,
    contributeDepartments,
    updateNationBranding,
    getNationEnergy,
  };
}
