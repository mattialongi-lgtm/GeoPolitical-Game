/**
 * DailyTasksPage – The main daily gameplay system dashboard.
 *
 * This is a vertical scrollable mobile-first page composed of modular sections:
 * 1. Daily missions (real, from API)
 * 2. Reward summary
 * 3. Farming automation
 * 4. Military training / daily damage
 * 5. Military academy
 * 6. Perks upgrade
 * 7. Free rewards & streaks
 *
 * Missions are fetched from /api/daily/missions and update in real time.
 */
import React from 'react';
import { motion } from 'motion/react';
import type { User, Region } from '../../types';
import { useDailyMissions } from '../../hooks/daily/useDailyMissions';

import DailyMissionsCard from './DailyMissionsCard';
import RewardSummaryCard from './RewardSummaryCard';
import FarmingAutomationCard from './FarmingAutomationCard';
import MilitaryTrainingCard from './MilitaryTrainingCard';
import AcademyCard from './AcademyCard';
import PerksUpgradeCard from './PerksUpgradeCard';
import FreeRewardsCard from './FreeRewardsCard';

import {
  MOCK_AUTO_WORK,
  MOCK_FARMING_RESOURCES,
  MOCK_DAILY_DAMAGE,
  MOCK_ACADEMY_STATE,
  MOCK_PERK_ENTRIES,
  MOCK_FREE_REWARDS,
  MOCK_WORK_STREAK,
  MOCK_PERIODIC_REWARDS,
  MOCK_BOTTLE_VALUE,
} from './mockData';

interface DailyTasksPageProps {
  user: User & { perks?: Record<string, number>; maxEnergy?: number; [key: string]: any };
  regions: Region[];
}

/** Divider between sections */
const SectionDivider = () => (
  <div className="h-px bg-gradient-to-r from-transparent via-gray-700/50 to-transparent" />
);

export default function DailyTasksPage({ user, regions }: DailyTasksPageProps) {
  const playerRegion = regions.find(r => r.id === user.regionId);
  const residenceRegion = regions.find(r => r.id === user.residenceId);

  const {
    missions,
    bonusClaimed,
    bonusReward,
    missionsLoading,
    missionsError,
    refreshMissions,
    handleClaimMission,
    handleClaimBonus,
  } = useDailyMissions();

  // Derive farming bonus from regional health index
  const regionHealth = playerRegion?.healthIndex || 5;
  const farmingBonus = {
    regionHealth,
    bonusMultiplier: Math.min(1 + regionHealth * 0.05, 1.50),
    suggestion: regionHealth >= 7
      ? `La salute della tua regione è ottima (${regionHealth}/10)! +${Math.round(regionHealth * 5)}% rendimento farming.`
      : regionHealth >= 4
        ? `La salute della tua regione è nella media (${regionHealth}/10). +${Math.round(regionHealth * 5)}% rendimento.`
        : `La salute della tua regione è bassa (${regionHealth}/10). Considera di spostarti per un farming migliore.`,
  };

  // Check if player is in residence region (for academy)
  const isInResidenceRegion = user.regionId === user.residenceId;
  const academyState = {
    ...MOCK_ACADEMY_STATE,
    isInResidenceRegion,
    canBuild: isInResidenceRegion && !MOCK_ACADEMY_STATE.built,
  };

  // Perk entries from user data (fallback to mock)
  const perkEntries = MOCK_PERK_ENTRIES.map(p => ({
    ...p,
    currentLevel: user.perks?.[p.perkId] || p.currentLevel,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-5"
    >
      {/* Page header */}
      <div className="text-center">
        <h2 className="text-lg font-black text-white">📋 Attività Giornaliere</h2>
        <p className="text-xs text-gray-500 mt-1">
          Completa le missioni giornaliere per guadagnare reward e far crescere il tuo impero
        </p>
      </div>

      {/* Daily Missions (real data from API) */}
      {missionsLoading ? (
        <div className="bg-gray-900/80 border border-gray-700/50 rounded-2xl p-6 text-center">
          <p className="text-xs text-gray-400 animate-pulse">Caricamento missioni...</p>
        </div>
      ) : missionsError ? (
        <div className="bg-gray-900/80 border border-red-500/30 rounded-2xl p-4 text-center">
          <p className="text-xs text-red-400">{missionsError}</p>
          <button
            onClick={() => { void refreshMissions(); }}
            className="mt-2 text-[10px] text-amber-400 underline hover:text-amber-300"
          >
            Riprova
          </button>
        </div>
      ) : (
        <DailyMissionsCard
          missions={missions}
          bonusClaimed={bonusClaimed}
          bonusReward={bonusReward}
          onClaimMission={handleClaimMission}
          onClaimBonus={handleClaimBonus}
        />
      )}

      <SectionDivider />

      {/* Reward Summary */}
      <RewardSummaryCard rewards={MOCK_FREE_REWARDS} />

      <SectionDivider />

      {/* Farming Automation */}
      <FarmingAutomationCard
        autoWork={MOCK_AUTO_WORK}
        farmingBonus={farmingBonus}
        resources={MOCK_FARMING_RESOURCES}
        onActivateAutoWork={(resource) => console.log('Activate auto-work:', resource)}
        onDeactivateAutoWork={() => console.log('Deactivate auto-work')}
      />

      <SectionDivider />

      {/* Military Training / Daily Damage */}
      <MilitaryTrainingCard
        damageState={MOCK_DAILY_DAMAGE}
        onSendDamage={(targetId) => console.log('Send damage to:', targetId)}
      />

      <SectionDivider />

      {/* Military Academy */}
      <AcademyCard
        academy={academyState}
        residenceRegionName={residenceRegion?.name || user.residenceId}
        currentRegionName={playerRegion?.name || user.regionId}
        onBuild={() => console.log('Build academy')}
      />

      <SectionDivider />

      {/* Perks Upgrade */}
      <PerksUpgradeCard
        perks={perkEntries}
        playerMoney={user.money || 0}
        playerGold={user.gold || 0}
        onUpgrade={(perkId) => console.log('Upgrade perk:', perkId)}
      />

      <SectionDivider />

      {/* Free Rewards & Streaks */}
      <FreeRewardsCard
        rewards={MOCK_FREE_REWARDS}
        streak={MOCK_WORK_STREAK}
        periodicRewards={MOCK_PERIODIC_REWARDS}
        bottleValue={MOCK_BOTTLE_VALUE}
        onClaimReward={(id) => console.log('Claim reward:', id)}
      />
    </motion.div>
  );
}
