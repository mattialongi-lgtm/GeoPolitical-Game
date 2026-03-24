/**
 * DailyMissionsCard – Displays daily missions with real progress, categories, and rewards.
 *
 * Each mission shows: icon, title, description, progress bar, reward, and claim button.
 * Completed missions can be claimed. All-complete triggers bonus.
 */
import React, { useState } from 'react';
import { CheckCircle2, Gift, Trophy, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { DailyMission, MissionReward, MissionCategory } from '../../types';

interface DailyMissionsCardProps {
  missions: DailyMission[];
  bonusClaimed: boolean;
  bonusReward: MissionReward;
  onClaimMission: (missionId: string) => void;
  onClaimBonus: () => void;
}

const CATEGORY_CONFIG: Record<MissionCategory, { label: string; color: string; bg: string }> = {
  work: { label: 'Lavoro', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  military: { label: 'Militare', color: 'text-red-400', bg: 'bg-red-500/10' },
  politics: { label: 'Politica', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  construction: { label: 'Costruzione', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  engagement: { label: 'Progressione', color: 'text-purple-400', bg: 'bg-purple-500/10' },
};

function formatReward(reward: MissionReward): string {
  const parts: string[] = [];
  if (reward.money) parts.push(`$${reward.money.toLocaleString()}`);
  if (reward.gold) parts.push(`🪙${reward.gold}`);
  if (reward.xp) parts.push(`✨${reward.xp} XP`);
  return parts.join(' · ');
}

export default function DailyMissionsCard({
  missions,
  bonusClaimed,
  bonusReward,
  onClaimMission,
  onClaimBonus,
}: DailyMissionsCardProps) {
  const navigate = useNavigate();
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const completedCount = missions.filter(m => m.status === 'completed' || m.status === 'claimed').length;
  const claimedCount = missions.filter(m => m.status === 'claimed').length;
  const totalCount = missions.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const allClaimed = claimedCount === totalCount && totalCount > 0;

  const handleClaim = (id: string) => {
    setClaimingId(id);
    onClaimMission(id);
    setTimeout(() => setClaimingId(null), 1000);
  };

  return (
    <div className="bg-gray-900/80 border border-gray-700/50 rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-white uppercase tracking-wider">🎯 Missioni Giornaliere</h3>
        <span className="text-xs font-bold text-emerald-400">{completedCount}/{totalCount}</span>
      </div>

      {/* Overall progress bar */}
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Missions list */}
      <div className="space-y-2">
        {missions.map((mission) => {
          const catConfig = CATEGORY_CONFIG[mission.category];
          const pct = mission.target > 0 ? Math.min(100, Math.round((mission.progress / mission.target) * 100)) : 0;
          const isComplete = mission.status === 'completed';
          const isClaimed = mission.status === 'claimed';
          const isClaiming = claimingId === mission.id;

          return (
            <div
              key={mission.id}
              className={`rounded-xl border p-3 transition-all ${
                isClaimed
                  ? 'bg-emerald-500/5 border-emerald-500/20 opacity-70'
                  : isComplete
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-gray-800/60 border-gray-700/40'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <span className="text-lg shrink-0 mt-0.5">{mission.icon}</span>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  {/* Title row */}
                  <div className="flex items-center gap-2">
                    <p className={`text-xs font-bold ${isClaimed ? 'text-gray-400 line-through' : 'text-white'}`}>
                      {mission.title}
                    </p>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${catConfig.bg} ${catConfig.color}`}>
                      {catConfig.label}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-[10px] text-gray-500">{mission.description}</p>

                  {/* Progress bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isClaimed ? 'bg-emerald-600' : isComplete ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-gray-400 shrink-0">
                      {mission.progress}/{mission.target}
                    </span>
                  </div>

                  {/* Reward */}
                  <p className="text-[10px] text-yellow-400/70">
                    🎁 {formatReward(mission.reward)}
                  </p>
                </div>

                {/* Action */}
                <div className="shrink-0 flex items-center">
                  {isClaimed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : isComplete ? (
                    <button
                      onClick={() => handleClaim(mission.id)}
                      disabled={isClaiming}
                      className="px-2.5 py-1 text-[10px] font-bold bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg transition-all active:scale-95 disabled:opacity-50"
                    >
                      {isClaiming ? '...' : 'Riscatta'}
                    </button>
                  ) : mission.route ? (
                    <button
                      onClick={() => navigate(mission.route!)}
                      className="p-1 rounded-lg hover:bg-gray-700/50 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* All-complete bonus */}
      {allClaimed && !bonusClaimed && (
        <button
          onClick={onClaimBonus}
          className="w-full flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/40 rounded-xl hover:border-yellow-400/60 transition-all active:scale-[0.98]"
        >
          <Trophy className="w-5 h-5 text-yellow-400" />
          <span className="text-xs font-bold text-yellow-300">
            Riscatta Bonus Completamento! {formatReward(bonusReward)}
          </span>
        </button>
      )}
      {bonusClaimed && (
        <div className="flex items-center justify-center gap-2 p-2 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
          <Trophy className="w-4 h-4 text-emerald-400" />
          <span className="text-[10px] font-bold text-emerald-400">
            ✅ Bonus giornaliero riscattato!
          </span>
        </div>
      )}

      {/* Footer */}
      {progressPercent < 100 && (
        <p className="text-[10px] text-gray-500 text-center italic">
          Completa tutte le missioni per ottenere un bonus extra! 🚀
        </p>
      )}
      {progressPercent === 100 && !allClaimed && (
        <p className="text-[10px] text-amber-400 text-center font-bold">
          🎉 Tutte le missioni completate! Riscatta le reward!
        </p>
      )}
    </div>
  );
}
