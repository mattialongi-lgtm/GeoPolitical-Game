/**
 * FarmingAutomationCard – Auto-work farming system.
 * Shows resource selection, duration, yield estimate, health bonus,
 * and contextual suggestions. Supports auto-work activation.
 */
import React, { useState } from 'react';
import { Pickaxe, Heart, Zap, Clock, Star, ChevronDown, ChevronUp } from 'lucide-react';
import type { AutoWorkConfig, FarmingBonus, FarmingResourceEntry } from '../../types';

interface FarmingAutomationCardProps {
  autoWork: AutoWorkConfig;
  farmingBonus: FarmingBonus;
  resources: FarmingResourceEntry[];
  onActivateAutoWork?: (resourceType: string) => void;
  onDeactivateAutoWork?: () => void;
}

function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3600000);
  return `${h}h`;
}

export default function FarmingAutomationCard({
  autoWork,
  farmingBonus,
  resources,
  onActivateAutoWork,
  onDeactivateAutoWork,
}: FarmingAutomationCardProps) {
  const [selectedResource, setSelectedResource] = useState(autoWork.resourceType);
  const [expanded, setExpanded] = useState(false);

  const selectedEntry = resources.find(r => r.resourceType === selectedResource) || resources[0];

  return (
    <div id="farming" className="bg-gray-900/80 border border-gray-700/50 rounded-2xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-white uppercase tracking-wider">⛏️ Farming Automatico</h3>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${autoWork.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-700 text-gray-400'}`}>
          {autoWork.active ? '🟢 ATTIVO' : '⚪ INATTIVO'}
        </span>
      </div>

      {/* Region health bonus */}
      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
        <Heart className="w-4 h-4 text-emerald-400" />
        <div className="flex-1">
          <p className="text-[10px] font-bold text-emerald-400 uppercase">Bonus Salute Regione</p>
          <p className="text-xs text-gray-300">{farmingBonus.suggestion}</p>
        </div>
        <span className="text-sm font-black text-emerald-400">×{farmingBonus.bonusMultiplier.toFixed(2)}</span>
      </div>

      {/* Resource selection */}
      <div className="space-y-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-800/60 border border-gray-700/40 hover:border-amber-500/40 transition-all"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">{selectedEntry?.icon}</span>
            <div className="text-left">
              <p className="text-xs font-bold text-white">{selectedEntry?.label}</p>
              <p className="text-[10px] text-gray-500">Risorsa selezionata</p>
            </div>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {expanded && (
          <div className="grid grid-cols-2 gap-2">
            {resources.map((res) => (
              <button
                key={res.resourceType}
                onClick={() => { setSelectedResource(res.resourceType); setExpanded(false); }}
                className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all text-left
                  ${selectedResource === res.resourceType
                    ? 'bg-amber-500/15 border-amber-500/40'
                    : 'bg-gray-800/40 border-gray-700/30 hover:border-gray-600/50'}`}
              >
                <span className="text-base">{res.icon}</span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-white truncate">{res.label}</p>
                  <p className="text-[9px] text-gray-500">~{res.estimatedYield.toLocaleString()}/ciclo</p>
                </div>
                {res.recommended && (
                  <Star className="w-3 h-3 text-amber-400 shrink-0 ml-auto" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2.5 rounded-xl bg-gray-800/50 text-center">
          <Clock className="w-4 h-4 text-sky-400 mx-auto mb-1" />
          <p className="text-xs font-black text-white">{formatDuration(autoWork.durationMs)}</p>
          <p className="text-[9px] text-gray-500">Durata</p>
        </div>
        <div className="p-2.5 rounded-xl bg-gray-800/50 text-center">
          <Pickaxe className="w-4 h-4 text-amber-400 mx-auto mb-1" />
          <p className="text-xs font-black text-white">~{selectedEntry?.estimatedYield.toLocaleString()}</p>
          <p className="text-[9px] text-gray-500">Resa stimata</p>
        </div>
        <div className="p-2.5 rounded-xl bg-gray-800/50 text-center">
          <Zap className="w-4 h-4 text-yellow-400 mx-auto mb-1" />
          <p className="text-xs font-black text-white">{selectedEntry?.energyCost}</p>
          <p className="text-[9px] text-gray-500">Energia</p>
        </div>
      </div>

      {/* Suggestion */}
      {selectedEntry?.recommended && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <Star className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <p className="text-[10px] text-amber-300">
            <span className="font-bold">Consigliato:</span> Imposta il lavoro automatico sull&apos;oro per massimizzare il guadagno.
          </p>
        </div>
      )}

      {/* CTA */}
      {!autoWork.active ? (
        <button
          onClick={() => onActivateAutoWork?.(selectedResource)}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold text-sm shadow-lg active:scale-[0.97] transition-all"
        >
          ⛏️ Avvia Lavoro Automatico
        </button>
      ) : (
        <button
          onClick={onDeactivateAutoWork}
          className="w-full py-3 rounded-xl bg-gray-700 text-gray-300 font-bold text-sm active:scale-[0.97] transition-all"
        >
          ⏹️ Ferma Lavoro Automatico
        </button>
      )}
    </div>
  );
}
