/**
 * MilitaryTrainingCard – Daily damage / training system.
 * Shows 24h countdown, damage targets (training, revolution defense, coup defense),
 * priority logic, and level progression dashboard.
 */
import React, { useState, useEffect } from 'react';
import { Swords, Shield, Flame, Target, TrendingUp, AlertTriangle } from 'lucide-react';
import type { DailyDamageState, DamageTarget, DamageTargetType } from '../../types';

interface MilitaryTrainingCardProps {
  damageState: DailyDamageState;
  onSendDamage?: (targetId: string) => void;
}

const TARGET_ICONS: Record<DamageTargetType, { icon: React.ElementType; color: string; accent: string }> = {
  military_training: { icon: Target, color: 'bg-blue-600', accent: 'text-blue-400' },
  revolution_defense: { icon: Flame, color: 'bg-orange-600', accent: 'text-orange-400' },
  coup_defense: { icon: Shield, color: 'bg-red-600', accent: 'text-red-400' },
  active_event: { icon: AlertTriangle, color: 'bg-purple-600', accent: 'text-purple-400' },
};

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function MilitaryTrainingCard({ damageState, onSendDamage }: MilitaryTrainingCardProps) {
  const [now, setNow] = useState(Date.now());
  const [selectedTarget, setSelectedTarget] = useState<string | null>(damageState.recommendedTarget);

  // Live countdown
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const timeRemaining = damageState.nextAvailableAt - now;
  const xpPercent = damageState.xpToNextLevel > 0
    ? Math.round((damageState.currentXp / damageState.xpToNextLevel) * 100)
    : 0;

  // Detect political events
  const hasActiveEvents = damageState.activeEvents.some(
    e => e.type === 'revolution_defense' || e.type === 'coup_defense' || e.type === 'active_event'
  );

  return (
    <div id="training" className="bg-gray-900/80 border border-gray-700/50 rounded-2xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-white uppercase tracking-wider">⚔️ Danno Giornaliero</h3>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${damageState.available ? 'bg-emerald-500/20 text-emerald-400' : 'bg-sky-500/20 text-sky-400'}`}>
          {damageState.available ? '🟢 DISPONIBILE' : '⏳ IN ATTESA'}
        </span>
      </div>

      {/* Countdown */}
      {!damageState.available && (
        <div className="text-center p-3 rounded-xl bg-gray-800/60 border border-gray-700/30">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Prossimo danno disponibile tra</p>
          <p className="text-2xl font-black text-sky-400 font-mono tabular-nums">{formatCountdown(timeRemaining)}</p>
        </div>
      )}

      {/* Active political event alert */}
      {hasActiveEvents && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20">
          <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" />
          <p className="text-[10px] text-orange-300">
            <span className="font-bold">Attenzione!</span> Ci sono eventi politici attivi nella tua regione. Considera di inviare il danno in difesa.
          </p>
        </div>
      )}

      {/* Damage targets */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Destinazione danno</p>
        {damageState.activeEvents.map((target) => {
          const cfg = TARGET_ICONS[target.type];
          const Icon = cfg.icon;
          const isSelected = selectedTarget === target.id;

          return (
            <button
              key={target.id}
              onClick={() => setSelectedTarget(target.id)}
              disabled={!damageState.available}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all
                ${isSelected ? 'bg-blue-500/15 border-blue-500/40' : 'bg-gray-800/40 border-gray-700/30 hover:border-gray-600/50'}
                ${!damageState.available ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-[0.98]'}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cfg.color} shrink-0`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-xs font-bold text-white">{target.label}</p>
                <p className="text-[10px] text-gray-500">{target.description}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-xs font-bold ${cfg.accent}`}>+{target.xpGain} XP</p>
                {target.recommended && (
                  <span className="text-[9px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                    Consigliato
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Level progression */}
      <div className="p-3 rounded-xl bg-gray-800/50 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            <p className="text-[10px] font-bold text-gray-400 uppercase">Progressione Livello</p>
          </div>
          <span className="text-xs font-black text-purple-400">Lv. {damageState.currentLevel}</span>
        </div>

        <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(xpPercent, 100)}%` }}
          />
        </div>

        <div className="flex justify-between text-[9px] text-gray-500">
          <span>{damageState.currentXp.toLocaleString()} XP</span>
          <span>{damageState.xpToNextLevel.toLocaleString()} XP</span>
        </div>

        <div className="flex items-center gap-2 mt-1">
          <Swords className="w-3.5 h-3.5 text-red-400" />
          <p className="text-[10px] text-gray-400">
            Danno massimo potenziale: <span className="font-bold text-red-400">{damageState.maxDamagePotential.toLocaleString()}</span>
          </p>
        </div>

        <p className="text-[9px] text-gray-500 italic">
          Fare danno ogni giorno aumenta il livello → più danno → migliore performance in guerra
        </p>
      </div>

      {/* CTA */}
      <button
        onClick={() => selectedTarget && onSendDamage?.(selectedTarget)}
        disabled={!damageState.available || !selectedTarget}
        className={`w-full py-3 rounded-xl font-bold text-sm shadow-lg transition-all
          ${damageState.available && selectedTarget
            ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white active:scale-[0.97]'
            : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
      >
        ⚔️ Invia Danno
      </button>
    </div>
  );
}
