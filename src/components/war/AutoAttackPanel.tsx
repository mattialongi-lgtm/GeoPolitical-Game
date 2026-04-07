import React, { useState } from 'react';
import { Zap, Timer } from 'lucide-react';
import type { TroopType, WarSide, AutoAttackType } from '../../types';

const TROOP_LABELS: Record<TroopType, string> = {
  tank: '🛡️ Carri armati',
  aircraft: '✈️ Aerei',
  battleship: '🚢 Corazzate navali',
};

interface AutoAttackPanelProps {
  warId: string;
  availableTroops: TroopType[];
  currentAutoAttack: { side: WarSide; troopType: TroopType; autoType: AutoAttackType; expiresAt: string | null } | null;
  onSetAutoAttack: (side: WarSide, troopType: TroopType, autoType: AutoAttackType) => Promise<void>;
  onStopAutoAttack: () => Promise<void>;
}

export const AutoAttackPanel: React.FC<AutoAttackPanelProps> = ({
  warId,
  availableTroops,
  currentAutoAttack,
  onSetAutoAttack,
  onStopAutoAttack,
}) => {
  const [selectedSide, setSelectedSide] = useState<WarSide>('attacker');
  const [selectedTroop, setSelectedTroop] = useState<TroopType>(availableTroops[0] || 'tank');
  const [selectedMode, setSelectedMode] = useState<AutoAttackType>('hourly');

  if (currentAutoAttack) {
    return (
      <div className="bg-amber-500/15 border border-amber-400/30 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="animate-pulse text-lg">⚔️</span>
            <div>
              <p className="font-black text-amber-300 text-sm uppercase">Auto-attacco Attivo</p>
              <p className="text-[10px] font-bold text-amber-400">
                {currentAutoAttack.side === 'attacker' ? 'Attaccante' : 'Difensore'} •{' '}
                {TROOP_LABELS[currentAutoAttack.troopType] || currentAutoAttack.troopType} •{' '}
                {currentAutoAttack.autoType === 'hourly' ? 'Danno Orario (1h, senza energia o bibite)' : 'Auto-War standard (ogni 10 min)'}
              </p>
            </div>
          </div>
          <button
            onClick={onStopAutoAttack}
            className="px-4 py-2 bg-red-500 text-white rounded-xl font-black text-xs uppercase hover:bg-red-600 transition-all"
          >
            ⏹ Ferma
          </button>
        </div>
        {currentAutoAttack.expiresAt && (
          <div className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
            <Timer className="w-3 h-3" />
            Scade: {new Date(currentAutoAttack.expiresAt).toLocaleString()}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-amber-500/15 border border-amber-400/30 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="w-5 h-5 text-amber-400" />
        <div>
          <p className="font-black text-amber-300 text-sm uppercase">Attacco Automatico</p>
          <p className="text-[10px] font-bold text-amber-400">Configura attacchi automatici. Solo il Danno Orario è compatibile con Auto-Work.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] font-black text-amber-400 uppercase mb-1 block">Schieramento</label>
          <div className="flex gap-1">
            {(['attacker', 'defender'] as WarSide[]).map(s => (
              <button
                key={s}
                onClick={() => setSelectedSide(s)}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                  selectedSide === s ? 'bg-amber-500 text-white' : 'bg-gray-800/60 border border-gray-700/40 text-amber-400 hover:bg-gray-700/50'
                }`}
              >
                {s === 'attacker' ? 'ATK' : 'DEF'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[9px] font-black text-amber-400 uppercase mb-1 block">Modalità</label>
          <div className="flex gap-1">
            {([
              { type: 'hourly' as AutoAttackType, label: 'Danno Orario' },
              { type: 'maximum' as AutoAttackType, label: 'Auto-War' },
            ]).map(m => (
              <button
                key={m.type}
                onClick={() => setSelectedMode(m.type)}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                  selectedMode === m.type ? 'bg-amber-500 text-white' : 'bg-gray-800/60 border border-gray-700/40 text-amber-400 hover:bg-gray-700/50'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="text-[9px] font-black text-amber-400 uppercase mb-1 block">Truppe</label>
        <div className="grid grid-cols-3 gap-1">
          {availableTroops.map(t => (
            <button
              key={t}
              onClick={() => setSelectedTroop(t)}
              className={`py-1.5 px-2 rounded-lg text-[9px] font-black transition-all ${
                selectedTroop === t ? 'bg-amber-500 text-white' : 'bg-gray-800/60 border border-gray-700/40 text-amber-300 hover:bg-gray-700/50'
              }`}
            >
              {TROOP_LABELS[t] || t}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => onSetAutoAttack(selectedSide, selectedTroop, selectedMode)}
        className="w-full py-2.5 bg-amber-500 text-white rounded-xl font-black uppercase text-xs shadow-lg shadow-amber-900/30 hover:bg-amber-600 transition-all flex items-center justify-center gap-1"
      >
        <Zap className="w-3.5 h-3.5" /> Attiva Auto-attacco
      </button>

      <div className="text-[9px] font-medium text-amber-400">
        ⏰ Danno Orario: ogni 1h, senza energia o bibite • Auto-War standard: ogni 10 min, incompatibile con Auto-Work
      </div>
    </div>
  );
};
