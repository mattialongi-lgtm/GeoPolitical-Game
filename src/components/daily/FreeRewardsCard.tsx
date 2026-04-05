/**
 * FreeRewardsCard – Free rewards wallet with streak system.
 * Shows claimed/available free rewards from all sources, work streak progress,
 * periodic reward milestones, and bottle value breakdown.
 */
import React from 'react';
import { Gift, Flame, Calendar, TrendingUp, Zap, Swords, Coins } from 'lucide-react';
import type { FreeRewardEntry, WorkStreak, PeriodicRewardProgress, BottleValueBreakdown } from '../../types';

interface FreeRewardsCardProps {
  rewards: FreeRewardEntry[];
  streak: WorkStreak;
  periodicRewards: PeriodicRewardProgress[];
  bottleValue: BottleValueBreakdown;
  onClaimReward?: (rewardId: string) => void;
}

export default function FreeRewardsCard({
  rewards,
  streak,
  periodicRewards,
  bottleValue,
  onClaimReward,
}: FreeRewardsCardProps) {
  const unclaimedRewards = rewards.filter(r => r.claimedAt === null);
  const claimedToday = rewards.filter(r => {
    if (!r.claimedAt) return false;
    const today = new Date().toDateString();
    return new Date(r.claimedAt).toDateString() === today;
  });

  const totalBottlesToday = claimedToday
    .filter(r => r.type === 'energy_bottles')
    .reduce((sum, r) => sum + r.amount, 0);

  const totalGoldToday = claimedToday
    .filter(r => r.type === 'gold')
    .reduce((sum, r) => sum + r.amount, 0);

  return (
    <div id="rewards" className="bg-gray-900/80 border border-gray-700/50 rounded-2xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-white uppercase tracking-wider">🎁 Ricompense Gratuite</h3>
        {unclaimedRewards.length > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
            {unclaimedRewards.length} disponibili
          </span>
        )}
      </div>

      {/* Today's summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
          <span className="text-lg">🍾</span>
          <p className="text-sm font-black text-emerald-400">{totalBottlesToday}</p>
          <p className="text-[9px] text-gray-500">Bottiglie oggi</p>
        </div>
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
          <span className="text-lg">🪙</span>
          <p className="text-sm font-black text-amber-400">{totalGoldToday}</p>
          <p className="text-[9px] text-gray-500">Gold oggi</p>
        </div>
      </div>

      {/* Available rewards */}
      {unclaimedRewards.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Da riscattare</p>
          {unclaimedRewards.map((reward) => (
            <div key={reward.id} className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <span className="text-lg shrink-0">{reward.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white">{reward.sourceLabel}</p>
                <p className="text-[10px] text-gray-500">
                  {reward.amount} {reward.type === 'energy_bottles' ? 'bottiglie' : reward.type === 'gold' ? 'oro' : reward.type}
                </p>
              </div>
              <button
                onClick={() => onClaimReward?.(reward.id)}
                className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-[10px] font-bold active:scale-[0.95] transition-all shrink-0"
              >
                <Gift className="w-3 h-3 inline mr-1" />
                Riscatta
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Work streak */}
      <div className="p-3 rounded-xl bg-gray-800/50 border border-gray-700/30 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400" />
            <p className="text-[10px] font-bold text-gray-400 uppercase">Streak Lavorativa</p>
          </div>
          <span className="text-xs font-black text-orange-400">{streak.currentStreak} giorni 🔥</span>
        </div>

        {/* Streak milestones */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
          {streak.milestones.map((milestone, idx) => {
            const isReached = streak.currentStreak >= milestone.days;
            const isCurrent = !isReached && (idx === 0 || streak.currentStreak >= streak.milestones[idx - 1].days);

            return (
              <div
                key={milestone.days}
                className={`shrink-0 w-14 p-2 rounded-lg text-center border transition-all
                  ${isReached && milestone.claimed ? 'bg-emerald-500/15 border-emerald-500/30' :
                    isReached ? 'bg-amber-500/15 border-amber-500/30' :
                    isCurrent ? 'bg-gray-800/80 border-sky-500/30' :
                    'bg-gray-800/40 border-gray-700/20'}`}
              >
                <span className="text-base">{milestone.reward.icon}</span>
                <p className={`text-[10px] font-bold ${isReached ? 'text-emerald-400' : 'text-gray-500'}`}>
                  {milestone.days}gg
                </p>
                <p className="text-[8px] text-gray-600">+{milestone.reward.amount}</p>
                {isReached && milestone.claimed && (
                  <p className="text-[7px] text-emerald-500">✓</p>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-[9px] text-gray-500">
          Record: {streak.longestStreak} giorni consecutivi
        </p>
      </div>

      {/* Periodic rewards */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Ricompense Periodiche</p>
        {periodicRewards.map((pr) => {
          const percent = pr.totalDaysRequired > 0
            ? Math.round((pr.daysCompleted / pr.totalDaysRequired) * 100)
            : 0;

          return (
            <div key={pr.id} className="p-2.5 rounded-xl bg-gray-800/50 border border-gray-700/30 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-sky-400" />
                  <p className="text-[10px] font-bold text-white">{pr.label}</p>
                </div>
                <span className="text-[10px] text-gray-500">{pr.daysCompleted}/{pr.totalDaysRequired} giorni</span>
              </div>
              <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-sky-400 rounded-full transition-all"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="text-[9px] text-gray-500">
                Ricompensa: {pr.reward.icon} {pr.reward.amount} {pr.reward.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Bottle value breakdown */}
      <div className="p-3 rounded-xl bg-gray-800/50 border border-gray-700/30 space-y-2">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">💡 Valore Strategico Bottiglie</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <Zap className="w-3.5 h-3.5 text-yellow-400 mx-auto mb-0.5" />
            <p className="text-xs font-bold text-white">{bottleValue.autoWorkHours}h</p>
            <p className="text-[8px] text-gray-500">Lavoro auto</p>
          </div>
          <div>
            <Swords className="w-3.5 h-3.5 text-red-400 mx-auto mb-0.5" />
            <p className="text-xs font-bold text-white">{bottleValue.maxDamagePotential.toLocaleString()}</p>
            <p className="text-[8px] text-gray-500">Danno max</p>
          </div>
          <div>
            <Coins className="w-3.5 h-3.5 text-amber-400 mx-auto mb-0.5" />
            <p className="text-xs font-bold text-white">{bottleValue.goldFarmEquivalent}</p>
            <p className="text-[8px] text-gray-500">Gold equiv.</p>
          </div>
        </div>
        <p className="text-[9px] text-gray-500 italic text-center">
          Ogni bottiglia ha un valore reale nel gameplay — non sprecarla!
        </p>
      </div>
    </div>
  );
}
