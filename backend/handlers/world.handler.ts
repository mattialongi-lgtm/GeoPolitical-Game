/**
 * World & Global Handlers
 *
 * Extracted from server.ts — no logic changes.
 * Covers: /api/world-stats, /api/dashboard-stats, /api/nations,
 *   /api/nations/:id, /api/leaderboard
 */
export function createWorldHandlers(deps: {
  supabase: any;
}) {
  const { supabase } = deps;

  // GET /api/world-stats
  async function getWorldStats(_req: any, res: any) {
    try {
      const onlineThreshold = Date.now() - 5 * 60 * 1000; // 5 minutes

      const [usersRes, onlineRes, regionsRes, blocsRes, partiesRes, factoriesRes] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true })
          .not('username', 'ilike', 'app_%')
          .not('username', 'ilike', 'mgr_%')
          .not('username', 'ilike', 'out_%')
          .not('username', 'ilike', 'res_%'),
        supabase.from('users').select('id', { count: 'exact', head: true }).gte('lastLogin', onlineThreshold)
          .not('username', 'ilike', 'app_%')
          .not('username', 'ilike', 'mgr_%')
          .not('username', 'ilike', 'out_%')
          .not('username', 'ilike', 'res_%'),
        supabase.from('regions').select('id', { count: 'exact', head: true }),
        supabase.from('blocs').select('id', { count: 'exact', head: true }),
        supabase.from('parties').select('id', { count: 'exact', head: true }),
        supabase.from('factories').select('id', { count: 'exact', head: true }),
      ]);

      // Count ACTIVE states only (fallback to legacy behavior if column missing)
      let nationsRes = await supabase
        .from('nations')
        .select('id', { count: 'exact', head: true })
        .eq('isActiveState', true);
      if (nationsRes.error) {
        nationsRes = await supabase.from('nations').select('id', { count: 'exact', head: true });
      }
      let totalStates = nationsRes.count || 0;
      if (totalStates === 0 && !nationsRes.error) {
        // Safety fallback: derive active states from real players if flags not backfilled yet
        const { data: userNations } = await supabase
          .from('users')
          .select('originalNation')
          .not('username', 'ilike', 'app_%')
          .not('username', 'ilike', 'mgr_%')
          .not('username', 'ilike', 'out_%')
          .not('username', 'ilike', 'res_%');
        totalStates = new Set((userNations || []).map((u: any) => u.originalNation).filter(Boolean)).size;
      }

      // Count regions with no nation_id (independent)
      const independentRes = await supabase
        .from('regions')
        .select('id', { count: 'exact', head: true })
        .is('nation_id', null);

      res.json({
        totalPlayers: usersRes.count || 0,
        onlinePlayers: onlineRes.count || 0,
        totalRegions: regionsRes.count || 0,
        totalStates,
        totalBlocs: blocsRes.count || 0,
        independentRegions: independentRes.count || 0,
        totalParties: partiesRes.count || 0,
        totalFactories: factoriesRes.count || 0,
      });
    } catch (error) {
      res.status(500).json({ error: "Errore nel caricamento statistiche mondiali" });
    }
  }

  // GET /api/dashboard-stats
  async function getDashboardStats(req: any, res: any) {
    const user = req.user;
    const isoId = user.regionId;
    const nationId = user.originalNation || user.regionId?.split('-')[0];
    const onlineThreshold = Date.now() - 5 * 60 * 1000;

    try {
      const [regionParties, regionFactories, regionOnline, stateRegions, stateParties, stateFactories, stateOnline] = await Promise.all([
        supabase.from('parties').select('id', { count: 'exact', head: true }).eq('regionId', isoId),
        supabase.from('factories').select('id', { count: 'exact', head: true }).eq('regionId', isoId),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('regionId', isoId).gte('lastLogin', onlineThreshold)
          .not('username', 'ilike', 'app_%')
          .not('username', 'ilike', 'mgr_%')
          .not('username', 'ilike', 'out_%')
          .not('username', 'ilike', 'res_%'),
        supabase.from('regions').select('id', { count: 'exact', head: true }).eq('nation_id', nationId),
        supabase.from('parties').select('id', { count: 'exact', head: true }).ilike('regionId', `${nationId}%`),
        supabase.from('factories').select('id', { count: 'exact', head: true }).ilike('regionId', `${nationId}%`),
        supabase.from('users').select('id', { count: 'exact', head: true }).ilike('regionId', `${nationId}%`).gte('lastLogin', onlineThreshold)
          .not('username', 'ilike', 'app_%')
          .not('username', 'ilike', 'mgr_%')
          .not('username', 'ilike', 'out_%')
          .not('username', 'ilike', 'res_%'),
      ]);

      res.json({
        region: {
          parties: regionParties.count || 0,
          factories: regionFactories.count || 0,
          online: regionOnline.count || 0,
        },
        state: {
          regions: stateRegions.count || 0,
          parties: stateParties.count || 0,
          factories: stateFactories.count || 0,
          online: stateOnline.count || 0,
        }
      });
    } catch (error) {
      console.error("[DashboardStats] Error:", error);
      res.status(500).json({ error: "Errore nel caricamento statistiche dashboard" });
    }
  }

  // GET /api/nations
  async function getNations(_req: any, res: any) {
    try {
      const includeInactive = String(_req.query.includeInactive || '').toLowerCase() === 'true';

      let nations: any[] = [];
      let nationsErr: any = null;

      if (!includeInactive) {
        const filtered = await supabase
          .from('nations')
          .select('id, name, logo, leaderUserId, updatedAt')
          .eq('isActiveState', true);
        nations = filtered.data || [];
        nationsErr = filtered.error;
        if (nationsErr) {
          // Back-compat fallback (older schema without isActiveState)
          const legacy = await supabase.from('nations').select('id, name, logo, leaderUserId, updatedAt');
          nations = legacy.data || [];
          nationsErr = legacy.error;
        }
      } else {
        const all = await supabase.from('nations').select('id, name, logo, leaderUserId, updatedAt');
        nations = all.data || [];
        nationsErr = all.error;
      }

      if (nationsErr) throw nationsErr;

      const { data: regions } = await supabase
        .from('regions')
        .select('id, nation_id, population');

      const regionCounts: Record<string, { count: number; population: number }> = {};
      (regions || []).forEach((r: any) => {
        if (!r.nation_id) return;
        if (!regionCounts[r.nation_id]) regionCounts[r.nation_id] = { count: 0, population: 0 };
        regionCounts[r.nation_id].count += 1;
        regionCounts[r.nation_id].population += r.population || 0;
      });

      // Count players per nation
      const { data: userStats } = await supabase
        .from('users')
        .select('originalNation');
      const playerCounts: Record<string, number> = {};
      (userStats || []).forEach((u: any) => {
        const nid = u.originalNation;
        if (nid) playerCounts[nid] = (playerCounts[nid] || 0) + 1;
      });

      const leaderIds = [...new Set((nations || []).map((n: any) => n.leaderUserId).filter(Boolean))];
      const leaderMap: Record<string, string> = {};
      if (leaderIds.length > 0) {
        const { data: leaders } = await supabase.from('users').select('id, username').in('id', leaderIds);
        (leaders || []).forEach((l: any) => { leaderMap[l.id] = l.username; });
      }

      const enriched = (nations || []).map((n: any) => ({
        ...n,
        leaderName: n.leaderUserId ? (leaderMap[n.leaderUserId] || null) : null,
        regionCount: regionCounts[n.id]?.count || 0,
        population: regionCounts[n.id]?.population || 0,
        playerCount: playerCounts[n.id] || 0,
      }));

      res.json(enriched);
    } catch (err: any) {
      console.error("Error fetching nations:", err);
      res.status(500).json({ error: "Errore nel caricamento degli stati: " + err.message });
    }
  }

  // GET /api/nations/:id
  async function getNationById(req: any, res: any) {
    const { data: nation } = await supabase
      .from('nations')
      .select('*, users!leaderUserId(username)')
      .eq('id', req.params.id)
      .single();

    if (!nation) return res.status(404).json({ error: "Nazione non trovata." });

    const { data: regions } = await supabase.from('regions').select('id, name, population, economyLevel').eq('nation_id', nation.id);
    res.json({ ...nation, leaderName: (nation as any).users?.username, regions: regions || [] });
  }

  // GET /api/leaderboard
  async function getLeaderboard(req: any, res: any) {
    const { data: leaders, error } = await supabase
      .from('users')
      .select('username, level, money')
      .order('level', { ascending: false })
      .limit(10);

    if (error) return res.status(500).json({ error: error.message });
    res.json(leaders);
  }

  return {
    getWorldStats,
    getDashboardStats,
    getNations,
    getNationById,
    getLeaderboard,
  };
}
