/**
 * DailyTasksPage – The main daily gameplay system dashboard.
 *
 * This is a vertical scrollable mobile-first page composed of modular sections:
 * 1. Daily tasks checklist
 * 2. Reward summary
 * 3. Farming automation
 * 4. Military training / daily damage
 * 5. Military academy
 * 6. Perks upgrade
 * 7. Free rewards & streaks
 *
 * All data currently uses mock data as fallback until backend is ready.
 * The component receives user and region data from the parent App component.
 */
import React from 'react';
import { motion } from 'motion/react';
import type { User, Region } from '../../types';

import DailyTasksCard from './DailyTasksCard';
import RewardSummaryCard from './RewardSummaryCard';
import FarmingAutomationCard from './FarmingAutomationCard';
import MilitaryTrainingCard from './MilitaryTrainingCard';
import AcademyCard from './AcademyCard';
import PerksUpgradeCard from './PerksUpgradeCard';
import FreeRewardsCard from './FreeRewardsCard';

import {
  MOCK_DAILY_TASKS,
  MOCK_AUTO_WORK,
  MOCK_FARMING_BONUS,
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

  // Derive farming bonus from region health
  const regionHealth = playerRegion?.health || 5;
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
          Gestisci le tue routine quotidiane per massimizzare la crescita
        </p>
      </div>

      {/* Daily Tasks Checklist */}
      <DailyTasksCard tasks={MOCK_DAILY_TASKS} />

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
