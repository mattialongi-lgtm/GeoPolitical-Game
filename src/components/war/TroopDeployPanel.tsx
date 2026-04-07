import React, { useState } from 'react';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import type { TroopType, WarSide } from '../../types';
import { TROOP_BASE_DAMAGE, TROOP_ENERGY_COST } from '../../types';

const TROOP_LABELS: Record<TroopType, { emoji: string; name: string }> = {
  tank: { emoji: '🛡️', name: 'Carri armati' },
  aircraft: { emoji: '✈️', name: 'Aerei' },
  battleship: { emoji: '🚢', name: 'Corazzate navali' },
};

interface TroopDeployPanelProps {
  warId: string;
  side: WarSide;
  availableTroops: TroopType[];
  userEnergy: number;
  onDeploy: (troopType: TroopType, quantity: number) => Promise<void>;
  deploying: boolean;
  sideColor: 'indigo' | 'rose';
}

export const TroopDeployPanel: React.FC<TroopDeployPanelProps> = ({
  warId,
  side,
  availableTroops,
  userEnergy,
  onDeploy,
  deploying,
  sideColor,
}) => {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState(true);

  const bgColor = sideColor === 'indigo' ? 'bg-indigo-500/10' : 'bg-rose-500/10';
  const borderColor = sideColor === 'indigo' ? 'border-indigo-500/20' : 'border-rose-500/20';
  const textColor = sideColor === 'indigo' ? 'text-indigo-400' : 'text-rose-400';
  const accentColor = sideColor === 'indigo' ? 'text-indigo-400' : 'text-rose-400';
  const btnBorder = sideColor === 'indigo' ? 'border-indigo-500/20' : 'border-rose-500/20';

  return (
    <div className={`${bgColor} rounded-3xl p-4 border ${borderColor} space-y-3`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <h5 className={`text-xs font-black ${textColor} uppercase`}>
          {side === 'attacker' ? 'Supporta Attaccante' : 'Supporta Difensore'}
        </h5>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="space-y-2">
          {availableTroops.map((troop) => {
            const label = TROOP_LABELS[troop] || { emoji: '⚔️', name: troop };
            const baseDmg = TROOP_BASE_DAMAGE[troop];
            const energyCost = TROOP_ENERGY_COST[troop];
            const qty = quantities[troop] || 1;
            const canAfford = userEnergy >= energyCost * qty;

            return (
              <div key={troop} className={`bg-gray-800/60 border ${btnBorder} p-3 rounded-2xl border border-gray-700/40 space-y-2`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm flex items-center gap-2 text-gray-100">
                    {label.emoji} {label.name}
                  </span>
                  <div className="flex flex-col items-end">
                    <span className={`text-xs font-black ${accentColor}`}>+{(baseDmg * qty).toLocaleString()} Danni</span>
                    <span className="text-[10px] font-bold text-gray-400">-{energyCost * qty}⚡</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-gray-800/60 rounded-xl border border-gray-700/40">
                    <button
                      onClick={() => setQuantities(prev => ({ ...prev, [troop]: Math.max(1, (prev[troop] || 1) - 1) }))}
                      className="px-2 py-1 text-gray-400 hover:text-gray-200 font-black"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={qty}
                      onChange={(e) => setQuantities(prev => ({ ...prev, [troop]: Math.max(1, parseInt(e.target.value) || 1) }))}
                      className="w-12 text-center text-sm font-black bg-transparent border-0 focus:ring-0 text-gray-100"
                    />
                    <button
                      onClick={() => setQuantities(prev => ({ ...prev, [troop]: (prev[troop] || 1) + 1 }))}
                      className="px-2 py-1 text-gray-400 hover:text-gray-200 font-black"
                    >
                      +
                    </button>
                  </div>
                  <button
                    disabled={deploying || !canAfford}
                    onClick={() => onDeploy(troop, qty)}
                    className={`flex-1 py-2 ${sideColor === 'indigo' ? 'bg-indigo-500 hover:bg-indigo-600 shadow-indigo-900/30' : 'bg-rose-500 hover:bg-rose-600 shadow-rose-900/30'} text-white rounded-xl font-black text-xs uppercase shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-1`}
                  >
                    {deploying ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    Schiera
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
