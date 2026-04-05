/**
 * AcademyCard – Military academy daily construction.
 * Shows build eligibility, rewards, countdown, and CTA.
 * The player can build once per day in their residence region.
 */
import React, { useState, useEffect } from 'react';
import { GraduationCap, MapPin, Clock, Gift, AlertCircle } from 'lucide-react';
import type { AcademyState } from '../../types';

interface AcademyCardProps {
  academy: AcademyState;
  residenceRegionName?: string;
  currentRegionName?: string;
  onBuild?: () => void;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Disponibile ora';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

export default function AcademyCard({ academy, residenceRegionName, currentRegionName, onBuild }: AcademyCardProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const timeUntilNext = academy.nextBuildAt - now;
  const isAvailable = !academy.built && academy.canBuild && timeUntilNext <= 0;

  return (
    <div id="academy" className="bg-gray-900/80 border border-gray-700/50 rounded-2xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-white uppercase tracking-wider">🎖️ Accademia Militare</h3>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${academy.built ? 'bg-emerald-500/20 text-emerald-400' : isAvailable ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-700 text-gray-400'}`}>
          {academy.built ? '✅ COSTRUITA' : isAvailable ? '🟡 DA COSTRUIRE' : '⏳ NON DISPONIBILE'}
        </span>
      </div>

      {/* Residence check */}
      {!academy.isInResidenceRegion && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
          <MapPin className="w-4 h-4 text-red-400 shrink-0" />
          <div>
            <p className="text-[10px] font-bold text-red-400">Non sei nella tua regione di residenza</p>
            <p className="text-[9px] text-gray-500">
              Puoi costruire l&apos;accademia solo in {residenceRegionName || 'la tua regione di residenza'}.
              {currentRegionName && <> Attualmente sei in {currentRegionName}.</>}
            </p>
          </div>
        </div>
      )}

      {/* Daily reminder */}
      {!academy.built && academy.isInResidenceRegion && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-[10px] text-amber-300">
            <span className="font-bold">Reminder:</span> Non hai ancora costruito l&apos;accademia oggi! Costruiscila per ottenere le ricompense gratuite.
          </p>
        </div>
      )}

      {/* Academy built success */}
      {academy.built && (
        <div className="text-center p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <GraduationCap className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-xs font-bold text-emerald-400">Accademia costruita con successo!</p>
          <p className="text-[10px] text-gray-500 mt-1">Prossima disponibilità tra {formatCountdown(timeUntilNext)}</p>
        </div>
      )}

      {/* Rewards preview */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Ricompense</p>
        <div className="grid grid-cols-2 gap-2">
          {academy.rewards.map((reward, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-800/50 border border-gray-700/30">
              <span className="text-lg">{reward.icon}</span>
              <div>
                <p className="text-xs font-bold text-white">{reward.amount}</p>
                <p className="text-[9px] text-gray-500">{reward.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Countdown */}
      {!academy.built && !isAvailable && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-800/50">
          <Clock className="w-4 h-4 text-sky-400" />
          <p className="text-xs text-gray-400">
            Disponibile tra <span className="font-bold text-sky-400">{formatCountdown(timeUntilNext)}</span>
          </p>
        </div>
      )}

      {/* CTA */}
      <button
        onClick={onBuild}
        disabled={!isAvailable}
        className={`w-full py-3 rounded-xl font-bold text-sm shadow-lg transition-all
          ${isAvailable
            ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white active:scale-[0.97]'
            : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
      >
        {academy.built ? '✅ Già costruita oggi' : isAvailable ? '🎖️ Costruisci ora' : '⏳ Non disponibile'}
      </button>

      {/* Info text */}
      <p className="text-[9px] text-gray-500 text-center italic">
        L&apos;accademia è un gesto quotidiano essenziale. Le ricompense si accumulano nel tempo!
      </p>
    </div>
  );
}
