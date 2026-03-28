import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { User, Region, Article, War } from '../types';
import type { WorldStats } from '../components/home/mockData';
import { fetchAppBootstrapData } from '../api/appClient';

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
  const fetchData = useCallback(async () => {
    try {
      const data = await fetchAppBootstrapData();

      if (data.user.ok) {
        setUser(data.user.data as User);
      } else {
        setUser(null);
      }

      const regionsData = data.regions.ok ? (data.regions.data || []) : [];

      if (data.regions.ok) {
        setRegions(regionsData as Region[]);
      }
      if (data.nations.ok) {
        setNations((data.nations.data || []) as any[]);
      }
      if (data.articles.ok) {
        setArticles((data.articles.data || []) as Article[]);
      }
      if (data.wars.ok) {
        setWars(data.wars.data as { active: War[]; ended: War[] });
      }

      setWorldStats((prev) => {
        let ws = data.worldStats.ok && data.worldStats.data
          ? (data.worldStats.data as WorldStats)
          : prev;

        if (regionsData.length > 0) {
          const independentCount = regionsData.filter((r: any) => !r.nation_id).length;
          const uniqueStates = new Set(regionsData.map((r: any) => r.nation_id).filter(Boolean)).size;
          ws = {
            ...ws,
            totalRegions: regionsData.length,
            independentRegions: independentCount,
            totalStates: uniqueStates,
          };
        }

        return ws;
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [setArticles, setLoading, setNations, setRegions, setUser, setWars, setWorldStats]);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    pollIntervalRef.current = setInterval(fetchData, 10000);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      } else {
        fetchData();
        pollIntervalRef.current = setInterval(fetchData, 10000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchData]);

  return { fetchData };
}
