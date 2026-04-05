import { useCallback, useEffect, useState } from 'react';
import type { DailyMission, MissionReward } from '../../types';
import { DAILY_GAMEPLAY_CONFIG } from '../../types';
import { claimDailyBonus, claimDailyMission, fetchDailyMissions } from '../../api/dailyClient';

interface UseDailyMissionsResult {
  missions: DailyMission[];
  bonusClaimed: boolean;
  bonusReward: MissionReward;
  missionsLoading: boolean;
  missionsError: string | null;
  refreshMissions: () => Promise<void>;
  handleClaimMission: (missionId: string) => Promise<void>;
  handleClaimBonus: () => Promise<void>;
}

export function useDailyMissions(): UseDailyMissionsResult {
  const [missions, setMissions] = useState<DailyMission[]>([]);
  const [bonusClaimed, setBonusClaimed] = useState(false);
  const [bonusReward, setBonusReward] = useState<MissionReward>(DAILY_GAMEPLAY_CONFIG.DAILY_MISSIONS_BONUS);
  const [missionsLoading, setMissionsLoading] = useState(true);
  const [missionsError, setMissionsError] = useState<string | null>(null);

  const refreshMissions = useCallback(async () => {
    try {
      setMissionsError(null);
      const data = await fetchDailyMissions();
      setMissions(data.missions.map(m => ({
        id: m.id,
        mission_key: m.mission_key,
        title: m.title,
        description: m.description,
        category: m.category,
        icon: m.icon,
        target: m.target,
        progress: m.progress,
        status: m.status,
        reward: m.reward,
        route: m.route,
      })));
      setBonusClaimed(data.bonusClaimed);
      setBonusReward(data.bonusReward);
    } catch (err: any) {
      console.error('[DailyMissions] Fetch error:', err);
      setMissionsError('Errore nel caricamento delle missioni');
    } finally {
      setMissionsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMissions();
    const interval = setInterval(refreshMissions, 60000);
    return () => clearInterval(interval);
  }, [refreshMissions]);

  const handleClaimMission = useCallback(async (missionId: string) => {
    try {
      const ok = await claimDailyMission(missionId);
      if (ok) {
        setMissions(prev => prev.map(m =>
          m.id === missionId ? { ...m, status: 'claimed' as const } : m
        ));
      }
    } catch (err) {
      console.error('[DailyMissions] Claim error:', err);
    }
  }, []);

  const handleClaimBonus = useCallback(async () => {
    try {
      const ok = await claimDailyBonus();
      if (ok) {
        setBonusClaimed(true);
      }
    } catch (err) {
      console.error('[DailyMissions] Bonus claim error:', err);
    }
  }, []);

  return {
    missions,
    bonusClaimed,
    bonusReward,
    missionsLoading,
    missionsError,
    refreshMissions,
    handleClaimMission,
    handleClaimBonus,
  };
}
