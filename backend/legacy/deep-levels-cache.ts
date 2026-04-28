const DEEP_LEVELS_CACHE_TTL = 5 * 60 * 1000;

export function createDeepLevelsCache(supabase: any) {
  let deepLevelsCache: any[] | null = null;
  let deepLevelsCacheTs = 0;

  return async function getCachedDeepLevels() {
    const now = Date.now();
    if (!deepLevelsCache || now - deepLevelsCacheTs > DEEP_LEVELS_CACHE_TTL) {
      const { data } = await supabase
        .from("deep_levels")
        .select("*")
        .eq("enabled", true)
        .order("level", { ascending: true });
      deepLevelsCache = data || [];
      deepLevelsCacheTs = now;
    }
    return deepLevelsCache;
  };
}
