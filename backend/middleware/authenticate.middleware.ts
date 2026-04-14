type SupabaseClientLike = {
  auth: { getUser: (jwt: string) => Promise<{ data: { user: any } ; error: any }> };
  from: (table: string) => any;
};

type AtomicOperationsLike = {
  provisionInitialUser: (params: {
    userId: string;
    email: string | null;
    username: string | null;
    defaultRegionId: string;
    lastEnergyUpdate: number;
    lastLogin: number;
  }) => Promise<{ success: boolean; created?: boolean; user?: any }>;
};

// ── Auth cache ───────────────────────────────────────────────
// Evita 5-9 query Supabase per ogni richiesta: il risultato
// dell'hydration utente viene tenuto 45 secondi per token.
const AUTH_CACHE_TTL_MS = 45_000;
const authCache = new Map<string, { user: any; expiresAt: number }>();

// ▼ MINIMAL select per /api/me polling (ogni 20s) — ~20 campi essenziali
// Evita: email, influence, militaryExp, createdAt, lastLogin, perkPoints
const AUTH_USER_SELECT_MINIMAL = [
  'id',
  'username',
  'money',
  'gold',
  'energy',
  'regionId',
  'residenceId',
  'workPermitId',
  'originalNation',
  'displayedNation',
  'lastOriginalNationChange',
  'lastEnergyUpdate',
  'xp',
  'level',
  'energyDrinks',
  'lastEnergyDrink',
  'warMedals',
  'lastMedalClaim',
  'travelingTo',
  'travelingUntil',
  'travelingFrom',
  'travelDurationMs',
  'perkUpgradesJson',
  'boostersJson',
].join(', ');

function getCachedAuthUser(token: string): any | null {
  const entry = authCache.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    authCache.delete(token);
    return null;
  }
  return entry.user;
}

function setCachedAuthUser(token: string, user: any): void {
  // Pulizia periodica per evitare memory leak su server long-running
  if (authCache.size > 2000) {
    const now = Date.now();
    for (const [k, v] of authCache) {
      if (now > v.expiresAt) authCache.delete(k);
    }
  }
  authCache.set(token, {
    user: { ...user },
    expiresAt: Date.now() + AUTH_CACHE_TTL_MS,
  });
}

export function createAuthenticateMiddleware(deps: {
  supabase: SupabaseClientLike;
  atomicOperations: AtomicOperationsLike;
  gameConfig: { ENERGY_MAX: number };
  isTransientSupabaseNetworkError: (error: any) => boolean;
}) {
  const { supabase, atomicOperations, gameConfig, isTransientSupabaseNetworkError } = deps;

  // Middleware to verify Supabase JWT and update user state
  return async (req: any, res: any, next: any) => {
    let token = null;

    // 1. Try Authorization header first (Bearer <token>)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    } else {
      token = req.cookies?.['sb-access-token'] || req.cookies?.['token'];
    }

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Access token missing.' });
    }

    // ▼ Cache hit: skip all Supabase queries for this request
    const cachedUser = getCachedAuthUser(token);
    if (cachedUser) {
      req.user = cachedUser;
      return next();
    }

    try {
      // Verify token with Supabase
      // We use the default client (anon/user) to verify the token
      // eslint-disable-next-line no-console
      console.log('[Auth] Verifying bearer token.');
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser(token);

      if (authError || !authUser) {
        // eslint-disable-next-line no-console
        console.error('[Auth] Token verification failed:', {
          message: authError?.message,
          status: authError?.status,
          code: authError?.code,
          fullError: authError,
        });
        if (authError?.message?.includes('token is expired')) {
          // Routine expiration, no need to log as error
        }
        return res.status(401).json({ error: 'Unauthorized: Invalid session.' });
      }

      // Fetch user data from 'users' table — using MINIMAL select to reduce query size
      // We use the service role client (global 'supabase') to bypass RLS and see all columns/users
      const { data: initialUser, error: userError } = await supabase
        .from('users')
        .select(AUTH_USER_SELECT_MINIMAL)
        .eq('id', authUser.id)
        .single();
      let user: any = initialUser;

      if (userError || !user) {
        if (userError && userError.code !== 'PGRST116') {
          // eslint-disable-next-line no-console
          console.error('Error fetching user from table:', userError);
        }

        const pickDefaultRegionId = async (): Promise<string | null> => {
          const preferredRegionIds = ['IT-RM', 'IT'];
          for (const regionId of preferredRegionIds) {
            const { data: preferred, error: preferredErr } = await supabase
              .from('regions')
              .select('id')
              .eq('id', regionId)
              .maybeSingle();
            if (preferredErr && preferredErr.code !== 'PGRST116') {
              // eslint-disable-next-line no-console
              console.error(`[JIT] Error checking preferred region ${regionId}:`, preferredErr);
            }
            if (preferred?.id) return preferred.id;
          }

          const { data: anyRegion, error: anyRegionErr } = await supabase
            .from('regions')
            .select('id')
            .limit(1);

          if (anyRegionErr) {
            // eslint-disable-next-line no-console
            console.error('[JIT] Error selecting fallback region:', anyRegionErr);
            return null;
          }

          return anyRegion?.[0]?.id ?? null;
        };

        // Just-in-time provisioning: create user if they exist in Auth but not in public.users
        // eslint-disable-next-line no-console
        console.log(`[JIT] Provisioning new user: ${authUser.email} (${authUser.id})`);
        const defaultRegionId = await pickDefaultRegionId();
        if (!defaultRegionId) {
          return res
            .status(500)
            .json({ error: 'Failed to create user profile: no region available in database.' });
        }

        try {
          const provisionResult = await atomicOperations.provisionInitialUser({
            userId: authUser.id,
            email: authUser.email ?? null,
            username: authUser.user_metadata?.username ?? null,
            defaultRegionId,
            lastEnergyUpdate: Date.now(),
            lastLogin: Date.now(),
          });

          if (!provisionResult?.success || !provisionResult?.user) {
            // eslint-disable-next-line no-console
            console.error('[JIT] Provisioning RPC returned failure:', provisionResult);
            return res.status(500).json({
              error:
                "Failed to create user profile. Please check if 'regions' table is populated.",
            });
          }

          user = provisionResult.user;

          if (provisionResult.created) {
            // eslint-disable-next-line no-console
            console.log(`[JIT] Successfully provisioned user: ${user.username}`);
          } else {
            // eslint-disable-next-line no-console
            console.log(`[JIT] Provisioning replay detected, reusing user: ${user.username}`);
          }
        } catch (createError: any) {
          // eslint-disable-next-line no-console
          console.error('[JIT] Error provisioning user:', createError);
          return res
            .status(500)
            .json({ error: "Failed to create user profile. Please check if 'regions' table is populated." });
        }
      }

      // Attach user to request
      req.user = user;
      req.user.maxEnergy = gameConfig.ENERGY_MAX;

      // Load minimal parsed data from JSON columns
      try {
        req.user.perkUpgrades = JSON.parse(user.perkUpgradesJson || '{}');
      } catch {
        req.user.perkUpgrades = {};
      }
      try {
        req.user.boosters = JSON.parse(user.boostersJson || '{}');
      } catch {
        req.user.boosters = {};
      }

      // Provide placeholder values to prevent frontend errors
      // These will be filled by /api/sync-state when called
      req.user.perks = {};
      req.user.partyId = undefined;
      req.user.partyName = undefined;
      req.user.partyLogo = undefined;
      req.user.inventory = {};
      req.user.inventoryVolume = 0;
      req.user.oilExp = 0;
      req.user.mineralsExp = 0;
      req.user.uraniumExp = 0;
      req.user.diamondsExp = 0;
      req.user.goldOreExp = 0;

      // ▼ Salva in cache per evitare re-hydration nei prossimi 45s
      setCachedAuthUser(token, req.user);

      next();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Auth Middleware Critical Error:', err);
      if (isTransientSupabaseNetworkError(err)) {
        return res
          .status(503)
          .json({ error: 'Service temporarily unavailable. Please retry in a few seconds.' });
      }
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
}

