import React from 'react';

interface WarDamageBarProps {
  attackerScore: number;
  defenderScore: number;
  attackerLabel?: string;
  defenderLabel?: string;
  height?: string;
  showPercentages?: boolean;
}

export const WarDamageBar: React.FC<WarDamageBarProps> = ({
  attackerScore,
  defenderScore,
  attackerLabel = 'Attaccante',
  defenderLabel = 'Difensore',
  height = 'h-5',
  showPercentages = true,
}) => {
  const total = attackerScore + defenderScore || 1;
  const attackerPct = Math.round((attackerScore / total) * 100);
  const defenderPct = 100 - attackerPct;

  return (
    <div className="space-y-1">
      {showPercentages && (
        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
          <span className="text-indigo-600">{attackerLabel} {attackerPct}%</span>
          <span className="text-rose-600">{defenderLabel} {defenderPct}%</span>
        </div>
      )}
      <div className={`w-full bg-slate-100 ${height} rounded-full overflow-hidden flex relative`}>
        <div
          className="bg-gradient-to-r from-indigo-500 to-indigo-400 h-full transition-all duration-700 ease-out"
          style={{ width: `${attackerPct}%` }}
        />
        <div
          className="bg-gradient-to-r from-rose-400 to-rose-500 h-full transition-all duration-700 ease-out"
          style={{ width: `${defenderPct}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-0.5 h-full bg-white/60" />
        </div>
      </div>
      <div className="flex justify-between text-[10px] font-bold text-slate-400">
        <span>{attackerScore.toLocaleString()} danni</span>
        <span>{defenderScore.toLocaleString()} danni</span>
      </div>
    </div>
  );
};
