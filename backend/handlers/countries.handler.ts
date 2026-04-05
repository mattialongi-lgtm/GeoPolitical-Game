/**
 * Countries / Region Detail Handlers
 *
 * Extracted from server.ts — no logic changes.
 * Covers: /api/countries/:iso2, /api/countries/:iso2/agreements,
 *   /api/countries/:iso2/sanctions
 */

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

export function createCountriesHandlers(deps: {
  supabase: any;
  isValidIso2: any;
}) {
  const { supabase, isValidIso2 } = deps;

  // GET /api/countries/:iso2
  async function getCountry(req: any, res: any) {
    const { iso2 } = req.params;
    if (!iso2 || iso2 === "-99") return res.status(400).json({ error: "Regione non disponibile" });

    try {
      const isoId = iso2.toUpperCase();

      // 1. Get region data from Supabase
      let { data: region, error } = await supabase
        .from('regions')
        .select(`
          *,
          owner:users!ownerUserId(username, avatarData),
          leader:users!leaderUserId(username, level, avatarData),
          governor:users!governorPlayerId(username),
          economicAdviser:users!economicAdviserId(username, avatarData),
          foreignMinister:users!foreignMinisterId(username, avatarData),
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
            economyLevel: 1,
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
        .select('id, name, population, isCapital, isAutonomous')
        .eq('nation_id', region.nation_id);


      // 2b. Count player citizens (users with regionId matching this region)
      const { count: citizenCount } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('regionId', isoId);
      // Count residents (users with residenceId matching this region)
      const { count: residentCount } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('residenceId', isoId);
      // Count players in sibling regions
      const regionIds = (memberRegions || []).map((mr: any) => mr.id);
      const { data: memberUserStats } = await supabase
        .from('users')
        .select('regionId')
        .in('regionId', regionIds);
      
      const memberPlayerCounts: Record<string, number> = {};
      (memberUserStats || []).forEach((u: any) => {
        memberPlayerCounts[u.regionId] = (memberPlayerCounts[u.regionId] || 0) + 1;
      });


      // 4. Construct response
      const response = {
        ...gameStats,
        ...region,
        ownerName: region.owner?.username,
        ownerAvatarData: region.owner?.avatarData || null,
        leaderName: region.leader?.username,
        leaderLevel: region.leader?.level,
        leaderAvatarData: region.leader?.avatarData || null,
        governorName: region.governor?.username || null,
        economicAdviserName: region.economicAdviser?.username || null,
        economicAdviserAvatarData: region.economicAdviser?.avatarData || null,
        foreignMinisterName: region.foreignMinister?.username || null,
        foreignMinisterAvatarData: region.foreignMinister?.avatarData || null,
        citizenCount: citizenCount || 0,
        residentCount: residentCount || 0,
        memberRegions: (memberRegions || []).map((mr: any) => ({
          ...mr,
          playerCount: memberPlayerCounts[mr.id] || 0
        })) || [region],
        indicators: {
          ...(gameStats?.indicators || {}),
          healthIndex: region.healthIndex || 1,
          educationIndex: region.educationIndex || 1,
          militaryIndex: region.militaryIndex || 1,
          developmentIndex: region.developmentIndex || 1,
          stability: region.stability || 1,
        }
      };

      res.json(response);
    } catch (err) {
      console.error("Error fetching country detail:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  // GET /api/countries/:iso2/agreements
  async function getCountryAgreements(req: any, res: any) {
    const { iso2 } = req.params;
    try {
      const stateId = iso2.toUpperCase();
      if (!isValidIso2(stateId)) return res.status(400).json({ error: "Codice paese non valido." });

      const { data: agreements, error } = await supabase
        .from('migration_agreements')
        .select('*, rf:regions!fromStateId(name), rt:regions!toStateId(name)')
        .or(`fromStateId.eq.${stateId},toStateId.eq.${stateId}`)
        .eq('status', 'ACTIVE')
        .order('activatedAt', { ascending: false });

      if (error) throw error;

      // Determine bilateral status locally: an agreement is bilateral if an inverse
      // (fromStateId ↔ toStateId swapped) active agreement also exists in the result set.
      const inverseSet = new Set(
        (agreements || []).map((ag: any) => `${ag.fromStateId}|${ag.toStateId}`)
      );

      const enriched = (agreements || []).map((ag: any) => {
        const partnerId = ag.fromStateId === stateId ? ag.toStateId : ag.fromStateId;
        const partnerName = ag.fromStateId === stateId ? ag.rt?.name : ag.rf?.name;
        const hasBilateral = inverseSet.has(`${ag.toStateId}|${ag.fromStateId}`);

        return {
          ...ag,
          partnerId,
          partnerName,
          direction: ag.fromStateId === stateId ? 'OUTGOING' : 'INCOMING',
          agreementType: hasBilateral ? 'BILATERAL' : 'UNILATERAL'
        };
      });

      res.json({
        outgoing: enriched.filter((a: any) => a.direction === 'OUTGOING'),
        incoming: enriched.filter((a: any) => a.direction === 'INCOMING')
      });
    } catch (err) {
      console.error("Error fetching agreements:", err);
      res.status(500).json({ error: "Errore caricamento accordi." });
    }
  }

  // GET /api/countries/:iso2/sanctions
  async function getCountrySanctions(req: any, res: any) {
    const stateId = (req.params.iso2 || '').toUpperCase();
    const normalizedId = stateId.replace('NATION_', '').replace('nation_', '');

    const { data: sanctions } = await supabase
      .from('sanctions')
      .select('*, regions!targetStateId(name)')
      .eq('fromStateId', normalizedId)
      .eq('status', 'ACTIVE');

    res.json(sanctions || []);
  }

  return {
    getCountry,
    getCountryAgreements,
    getCountrySanctions,
  };
}
