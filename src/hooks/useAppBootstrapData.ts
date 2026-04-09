import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { User, Region, Article, War } from '../types';
import type { WorldStats } from '../components/home/mockData';
import { fetchUserOnly, fetchSlowBootstrapData } from '../api/appClient';

// Intervalli di polling separati per volatilità dei dati
const POLL_USER_MS   = 20_000;  // /api/me — energia, soldi, XP cambiano spesso
const POLL_SLOW_MS  = 120_000;  // regioni, nazioni, guerre, articoli, world-stats

interface UseAppBootstrapDataParams {
  setUser: Dispatch<SetStateAction<User | null>>;
  setRegions: Dispatch<SetStateAction<Region[]>>;
  setNations: Dispatch<SetStateAction<any[]>>;
  setArticles: Dispatch<SetStateAction<Article[]>>;
  setWars: Dispatch<SetStateAction<{ active: War[]; ended: War[] }>>;
  setWorldStats: Dispatch<SetStateAction<WorldStats>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
}

export function useAppBootstrapData({
  setUser,
  setRegions,
  setNations,
  setArticles,
  setWars,
  setWorldStats,
  setLoading,
}: UseAppBootstrapDataParams) {
  // ── Fetch veloce: solo /api/me ──────────────────────────────
  const fetchUser = useCallback(async () => {
    if (!document.cookie.includes('sb-access-token')) return;
    try {
      const data = await fetchUserOnly();
      if (data.ok) setUser(data.data as User);
      else setUser(null);
    } catch (err) {
      console.error('[bootstrap] fetchUser error:', err);
    } finally {
      setLoading(false);
    }
  }, [setUser, setLoading]);

  // ── Fetch lento: regioni, nazioni, guerre, articoli, stats ──
  const fetchSlowData = useCallback(async () => {
    if (!document.cookie.includes('sb-access-token')) return;
    try {
      const data = await fetchSlowBootstrapData();

      const regionsData = data.regions.ok ? (data.regions.data || []) : [];
      if (data.regions.ok) setRegions(regionsData as Region[]);
      if (data.nations.ok) setNations((data.nations.data || []) as any[]);
      if (data.articles.ok) setArticles((data.articles.data || []) as Article[]);
      if (data.wars.ok) setWars(data.wars.data as { active: War[]; ended: War[] });

      setWorldStats((prev) => {
        let ws = data.worldStats.ok && data.worldStats.data
          ? (data.worldStats.data as WorldStats)
          : prev;

        if (regionsData.length > 0) {
          const independentCount = regionsData.filter((r: any) =>
            !r.nation_id || r.territoryStatus === 'INDEPENDENT_REGION'
          ).length;
          ws = {
            ...ws,
            totalRegions: regionsData.length,
            independentRegions: independentCount,
          };
        }

        if (!ws.totalStates || ws.totalStates <= 0) {
          const nationsFallback = data.nations.ok && Array.isArray(data.nations.data)
            ? (data.nations.data as any[]).length : 0;
          if (nationsFallback > 0) ws = { ...ws, totalStates: nationsFallback };
        }

        return ws;
      });
    } catch (err) {
      console.error('[bootstrap] fetchSlowData error:', err);
    }
  }, [setArticles, setNations, setRegions, setWars, setWorldStats]);

  const userIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const slowIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPolling = useCallback(() => {
    if (!userIntervalRef.current) {
      userIntervalRef.current = setInterval(fetchUser, POLL_USER_MS);
    }
    if (!slowIntervalRef.current) {
      slowIntervalRef.current = setInterval(fetchSlowData, POLL_SLOW_MS);
    }
  }, [fetchUser, fetchSlowData]);

  const stopPolling = useCallback(() => {
    if (userIntervalRef.current) { clearInterval(userIntervalRef.current); userIntervalRef.current = null; }
    if (slowIntervalRef.current) { clearInterval(slowIntervalRef.current); slowIntervalRef.current = null; }
  }, []);

  useEffect(() => {
    // Prima fetch immediata di tutti i dati
    fetchUser();
    fetchSlowData();
    startPolling();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        // Torna visibile: aggiorna subito solo user (i dati lenti aspettano il prossimo tick)
        fetchUser();
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchUser, fetchSlowData, startPolling, stopPolling]);

  // fetchData esposto per i POST che richiedono refresh immediato del profilo utente
  return { fetchData: fetchUser };
}
