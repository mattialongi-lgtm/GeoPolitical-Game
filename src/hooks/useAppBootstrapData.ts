import { useCallback, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { User, Region, Article, War } from '../types';
import type { WorldStats } from '../components/home/mockData';
import {
  fetchArticlesOnly,
  fetchMyAvatarOnly,
  fetchRegionsAndNations,
  fetchUserOnly,
  fetchWarsOnly,
  fetchWorldStatsOnly,
} from '../api/appClient';
import { usePollingTask } from './usePollingTask';

const POLL_USER_MS = 20_000;
const POLL_REGIONS_AND_NATIONS_MS = 90_000;
const POLL_WORLD_STATS_MS = 300_000;
const AVATAR_CACHE_TTL_MS = 10 * 60_000;

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
  const regionsRef = useRef<Region[]>([]);
  const nationsRef = useRef<any[]>([]);

  const userInFlightRef = useRef(false);
  const userAvatarInFlightRef = useRef(false);
  const regionsAndNationsInFlightRef = useRef(false);
  const articlesInFlightRef = useRef(false);
  const warsInFlightRef = useRef(false);
  const worldStatsInFlightRef = useRef(false);
  const userAvatarCacheRef = useRef<{ userId: string | null; avatarData: string | null; fetchedAt: number }>({
    userId: null,
    avatarData: null,
    fetchedAt: 0,
  });

  const hasSession = () => document.cookie.includes('sb-access-token');

  const applyWorldStatsCounts = useCallback((base: WorldStats | null, fallback: WorldStats) => {
    let next = base ?? fallback;
    const regions = regionsRef.current;
    const nations = nationsRef.current;

    if (regions.length > 0) {
      const independentCount = regions.filter((region: any) =>
        !region.nation_id || region.territoryStatus === 'INDEPENDENT_REGION'
      ).length;

      next = {
        ...next,
        totalRegions: regions.length,
        independentRegions: independentCount,
      };
    }

    if ((!next.totalStates || next.totalStates <= 0) && nations.length > 0) {
      next = {
        ...next,
        totalStates: nations.length,
      };
    }

    return next;
  }, []);

  const refreshUser = useCallback(async (opts: { forceAvatarRefresh?: boolean } = {}) => {
    if (!hasSession()) {
      userAvatarCacheRef.current = { userId: null, avatarData: null, fetchedAt: 0 };
      setUser(null);
      setLoading(false);
      return;
    }
    if (userInFlightRef.current) return;

    userInFlightRef.current = true;
    try {
      const data = await fetchUserOnly();
      if (data.ok && data.data) {
        const baseUser = data.data as User;
        const now = Date.now();
        const avatarCache = userAvatarCacheRef.current;
        const avatarCacheMatchesUser = avatarCache.userId === baseUser.id;
        const avatarCacheFresh = avatarCacheMatchesUser && (now - avatarCache.fetchedAt) < AVATAR_CACHE_TTL_MS;

        if (avatarCacheMatchesUser && avatarCache.avatarData) {
          baseUser.avatarData = avatarCache.avatarData;
        }

        setUser(baseUser);

        const shouldFetchAvatar =
          !userAvatarInFlightRef.current &&
          (
            opts.forceAvatarRefresh === true ||
            !avatarCacheMatchesUser ||
            !avatarCacheFresh
          );

        if (shouldFetchAvatar) {
          userAvatarInFlightRef.current = true;
          try {
            const avatarResult = await fetchMyAvatarOnly();
            const avatarData = avatarResult.ok ? (avatarResult.data?.avatarData ?? null) : null;
            userAvatarCacheRef.current = {
              userId: baseUser.id,
              avatarData,
              fetchedAt: Date.now(),
            };
            setUser((prev) => {
              if (!prev || prev.id !== baseUser.id) return prev;
              return { ...prev, avatarData: avatarData || undefined };
            });
          } catch (avatarErr) {
            console.error('[bootstrap] refreshUser avatar fetch error:', avatarErr);
          } finally {
            userAvatarInFlightRef.current = false;
          }
        }
      } else {
        userAvatarCacheRef.current = { userId: null, avatarData: null, fetchedAt: 0 };
        setUser(null);
      }
    } catch (err) {
      console.error('[bootstrap] refreshUser error:', err);
    } finally {
      userInFlightRef.current = false;
      setLoading(false);
    }
  }, [setLoading, setUser]);

  const refreshRegionsAndNations = useCallback(async () => {
    if (!hasSession() || regionsAndNationsInFlightRef.current) return;

    regionsAndNationsInFlightRef.current = true;
    try {
      const data = await fetchRegionsAndNations();

      if (data.regions.ok) {
        const nextRegions = (data.regions.data || []) as Region[];
        regionsRef.current = nextRegions;
        setRegions(nextRegions);
      }

      if (data.nations.ok) {
        const nextNations = (data.nations.data || []) as any[];
        nationsRef.current = nextNations;
        setNations(nextNations);
      }

      setWorldStats((prev) => applyWorldStatsCounts(null, prev));
    } catch (err) {
      console.error('[bootstrap] refreshRegionsAndNations error:', err);
    } finally {
      regionsAndNationsInFlightRef.current = false;
    }
  }, [applyWorldStatsCounts, setNations, setRegions, setWorldStats]);

  const refreshArticles = useCallback(async () => {
    if (!hasSession() || articlesInFlightRef.current) return;

    articlesInFlightRef.current = true;
    try {
      const data = await fetchArticlesOnly();
      if (data.ok) setArticles((data.data || []) as Article[]);
    } catch (err) {
      console.error('[bootstrap] refreshArticles error:', err);
    } finally {
      articlesInFlightRef.current = false;
    }
  }, [setArticles]);

  const refreshWars = useCallback(async () => {
    if (!hasSession() || warsInFlightRef.current) return;

    warsInFlightRef.current = true;
    try {
      const data = await fetchWarsOnly();
      if (data.ok) setWars(data.data as { active: War[]; ended: War[] });
    } catch (err) {
      console.error('[bootstrap] refreshWars error:', err);
    } finally {
      warsInFlightRef.current = false;
    }
  }, [setWars]);

  const refreshWorldStats = useCallback(async () => {
    if (!hasSession() || worldStatsInFlightRef.current) return;

    worldStatsInFlightRef.current = true;
    try {
      const data = await fetchWorldStatsOnly();
      setWorldStats((prev) => applyWorldStatsCounts(
        data.ok && data.data ? (data.data as WorldStats) : null,
        prev,
      ));
    } catch (err) {
      console.error('[bootstrap] refreshWorldStats error:', err);
    } finally {
      worldStatsInFlightRef.current = false;
    }
  }, [applyWorldStatsCounts, setWorldStats]);

  usePollingTask(refreshUser, {
    intervalMs: POLL_USER_MS,
    refreshOnVisible: true,
    refreshOnFocus: true,
  });

  usePollingTask(refreshRegionsAndNations, {
    intervalMs: POLL_REGIONS_AND_NATIONS_MS,
    refreshOnVisible: true,
    refreshOnFocus: true,
  });

  usePollingTask(refreshWorldStats, {
    intervalMs: POLL_WORLD_STATS_MS,
    refreshOnVisible: true,
    refreshOnFocus: true,
  });

  const refreshInitialSlowData = useCallback(async () => {
    await Promise.all([
      refreshArticles(),
      refreshWars(),
    ]);
  }, [refreshArticles, refreshWars]);

  usePollingTask(refreshInitialSlowData, {
    intervalMs: null,
    refreshOnVisible: false,
    refreshOnFocus: false,
  });

  const refreshBootstrapData = useCallback(async () => {
    await Promise.all([
      refreshUser({ forceAvatarRefresh: true }),
      refreshRegionsAndNations(),
      refreshArticles(),
      refreshWars(),
      refreshWorldStats(),
    ]);
  }, [refreshArticles, refreshRegionsAndNations, refreshUser, refreshWars, refreshWorldStats]);

  const fetchData = useCallback(() => refreshUser({ forceAvatarRefresh: true }), [refreshUser]);

  return {
    fetchData,
    refreshBootstrapData,
    refreshArticles,
    refreshRegionsAndNations,
    refreshWars,
    refreshWorldStats,
  };
}
