/**
 * WarQuickPanel – Always-visible war panel on the Home dashboard.
 * Shows the nearest/latest war with damage bars, timer, and quick actions.
 */
import React, { useState, useEffect } from "react";
import { Swords, Shield, Zap, Target, Clock, ChevronRight, ToggleLeft, ToggleRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { ActiveWar } from "./mockData";
import { WarFactionBadge } from "../war";

interface WarQuickPanelProps {
  wars: ActiveWar[];
}

const formatTimeRemaining = (endsAt: number): string => {
  const ms = Math.max(0, endsAt - Date.now());
  if (ms <= 0) return "00:00:00";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const DamageBar = ({ attackerDamage, defenderDamage }: { attackerDamage: number; defenderDamage: number }) => {
  const total = attackerDamage + defenderDamage;
  const attackPct = total > 0 ? (attackerDamage / total) * 100 : 50;

  return (
    <div className="space-y-1">
      <div className="flex h-3 rounded-full overflow-hidden bg-gray-700/50">
        <div
          className="bg-gradient-to-r from-red-600 to-red-500 transition-all duration-500 relative"
          style={{ width: `${attackPct}%` }}
        >
          <div className="absolute inset-0 bg-white/10 animate-pulse" />
        </div>
        <div
          className="bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
          style={{ width: `${100 - attackPct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] font-black tabular-nums">
        <span className="text-red-400">{attackerDamage.toLocaleString()}</span>
        <span className="text-blue-400">{defenderDamage.toLocaleString()}</span>
      </div>
    </div>
  );
};

export default function WarQuickPanel({ wars }: WarQuickPanelProps) {
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now());
  const [autoMode, setAutoMode] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const currentWar = wars[0]; // Show nearest/most relevant war

  if (!currentWar) {
    return (
      <div className="space-y-2">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">⚔️ Guerre</h3>
        <div className="bg-gray-800/40 border border-gray-700/30 rounded-xl p-4 text-center">
          <Shield className="w-6 h-6 text-gray-600 mx-auto mb-2" />
          <p className="text-xs text-gray-500 font-medium">Nessuna guerra attiva nelle vicinanze</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">⚔️ Guerre</h3>
        <button
          onClick={() => navigate("/wars")}
          className="flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Tutte <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* Main War Card */}
      <div className="bg-gray-800/60 border border-red-900/30 rounded-xl p-3 space-y-3">
        {/* War Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-red-400" />
            <span className="text-[10px] font-bold text-gray-400 uppercase">{currentWar.regionName}</span>
          </div>
          <div className="flex items-center gap-1 bg-gray-900/60 px-2 py-1 rounded-lg">
            <Clock className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] font-black text-amber-400 tabular-nums">{formatTimeRemaining(currentWar.endsAt)}</span>
          </div>
        </div>

        {/* Factions */}
        <div className="flex items-center justify-between">
          <button className="text-left hover:opacity-80 transition-opacity">
            <WarFactionBadge
              name={currentWar.attackerDisplayName || currentWar.attackerName}
              icon={currentWar.attackerIso2}
              iconSizeClass="w-5 h-5"
              textClassName="text-sm font-black text-red-400"
            />
            <p className="text-[9px] text-gray-500 font-medium">🗡️ Attaccante</p>
          </button>
          <span className="text-lg font-black text-gray-600">VS</span>
          <button className="text-right hover:opacity-80 transition-opacity">
            <WarFactionBadge
              name={currentWar.defenderDisplayName || currentWar.defenderName}
              icon={currentWar.defenderIso2}
              align="right"
              iconSizeClass="w-5 h-5"
              textClassName="text-sm font-black text-blue-400"
            />
            <p className="text-[9px] text-gray-500 font-medium">🛡️ Difensore</p>
          </button>
        </div>

        {/* Damage Bar */}
        <DamageBar attackerDamage={currentWar.attackerDamage} defenderDamage={currentWar.defenderDamage} />

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => navigate("/wars")}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 transition-all text-white text-xs font-black"
          >
            <Swords className="w-4 h-4" /> LOTTA
          </button>
          <button
            onClick={() => setAutoMode(!autoMode)}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border active:scale-95 transition-all text-xs font-bold ${
              autoMode
                ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400'
                : 'bg-gray-700/30 border-gray-600/40 text-gray-400'
            }`}
          >
            {autoMode ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            Auto
          </button>
          <button
            onClick={() => navigate("/wars")}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 active:scale-95 transition-all text-xs font-bold"
          >
            <Target className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Additional Wars Preview */}
      {wars.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
          {wars.slice(1, 4).map((war) => (
            <button
              key={war.id}
              onClick={() => navigate("/wars")}
              className="min-w-[160px] bg-gray-800/40 border border-gray-700/30 rounded-xl p-2.5 text-left hover:border-red-500/30 transition-all shrink-0"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-bold text-gray-500 truncate">{war.regionName}</span>
                <span className="text-[9px] font-bold text-amber-400 tabular-nums">{formatTimeRemaining(war.endsAt)}</span>
              </div>
              <WarFactionBadge
                name={war.attackerDisplayName || war.attackerName}
                icon={war.attackerIso2}
                iconSizeClass="w-4 h-4"
                textClassName="text-[10px] font-bold text-red-400"
              />
              <WarFactionBadge
                name={`vs ${war.defenderDisplayName || war.defenderName}`}
                icon={war.defenderIso2}
                iconSizeClass="w-4 h-4"
                textClassName="text-[10px] font-bold text-blue-400"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
