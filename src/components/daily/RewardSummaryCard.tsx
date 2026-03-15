/**
 * RewardSummaryCard – Summary of all daily rewards obtained.
 * Quick overview of today's gains from all sources.
 */
import React from 'react';
import { Trophy, TrendingUp } from 'lucide-react';
import type { FreeRewardEntry } from '../../types';

interface RewardSummaryCardProps {
  rewards: FreeRewardEntry[];
}

export default function RewardSummaryCard({ rewards }: RewardSummaryCardProps) {
  const today = new Date().toDateString();
  const todayRewards = rewards.filter(r => {
    if (!r.claimedAt) return false;
    return new Date(r.claimedAt).toDateString() === today;
  });

  const unclaimedCount = rewards.filter(r => r.claimedAt === null).length;

  const totalByType: Record<string, number> = {};
  todayRewards.forEach(r => {
    totalByType[r.type] = (totalByType[r.type] || 0) + r.amount;
  });

  const TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
    energy_bottles: { label: 'Bottiglie', icon: '🍾', color: 'text-emerald-400' },
    gold: { label: 'Oro', icon: '🪙', color: 'text-amber-400' },
    money: { label: 'Denaro', icon: '💶', color: 'text-green-400' },
    xp: { label: 'XP', icon: '⭐', color: 'text-purple-400' },
  };

  return (
    <div className="bg-gray-900/80 border border-gray-700/50 rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-white uppercase tracking-wider">🏆 Riepilogo Ricompense</h3>
        {unclaimedCount > 0 && (
          <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full animate-pulse">
            {unclaimedCount} da riscattare
          </span>
        )}
      </div>

      {/* Summary grid */}
      {Object.keys(totalByType).length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(totalByType).map(([type, amount]) => {
            const meta = TYPE_LABELS[type] || { label: type, icon: '📦', color: 'text-gray-400' };
            return (
              <div key={type} className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-800/50 border border-gray-700/30">
                <span className="text-lg">{meta.icon}</span>
                <div>
                  <p className={`text-sm font-black ${meta.color}`}>{amount.toLocaleString()}</p>
                  <p className="text-[9px] text-gray-500">{meta.label} oggi</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-4">
          <Trophy className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-xs text-gray-500">Nessuna ricompensa riscattata oggi</p>
          <p className="text-[10px] text-gray-600">Completa le task per ottenere ricompense!</p>
        </div>
      )}

      {/* Source breakdown */}
      {todayRewards.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Fonti</p>
          {todayRewards.map((r) => (
            <div key={r.id} className="flex items-center justify-between py-1 border-b border-gray-800/50 last:border-0">
              <div className="flex items-center gap-2">
                <span className="text-sm">{r.icon}</span>
                <p className="text-[10px] text-gray-400">{r.sourceLabel}</p>
              </div>
              <p className="text-[10px] font-bold text-gray-300">+{r.amount}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
