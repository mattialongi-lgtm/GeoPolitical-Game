/**
 * StateIdentityCard – Visual identity block showing flag/emblem and representative image.
 * Displays the state's flag on the left, a representative building/image on the right,
 * and a parliament button below.
 */
import React from 'react';
import { Landmark } from 'lucide-react';

interface StateIdentityCardProps {
  flag: string;
  flagUrl?: string;
  representativeImage?: string;
  stateName: string;
  onParliamentClick?: () => void;
}

export default function StateIdentityCard({
  flag,
  flagUrl,
  representativeImage,
  stateName,
  onParliamentClick,
}: StateIdentityCardProps) {
  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-4">
        {/* Flag / Emblem */}
        <div className="w-20 h-14 rounded-xl bg-gray-800 border border-gray-700/50 flex items-center justify-center overflow-hidden">
          {flagUrl ? (
            <img src={flagUrl} alt={`Bandiera ${stateName}`} className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl">{flag || '🏛️'}</span>
          )}
        </div>
        {/* Representative Image */}
        <div className="flex-1 h-14 rounded-xl bg-gray-800 border border-gray-700/50 flex items-center justify-center overflow-hidden">
          {representativeImage ? (
            <img src={representativeImage} alt={`${stateName} parlamento`} className="w-full h-full object-cover" />
          ) : (
            <div className="flex items-center gap-2 text-gray-600">
              <Landmark className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Capitale</span>
            </div>
          )}
        </div>
      </div>
      {/* Parliament Button */}
      <button
        onClick={onParliamentClick}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-800 border border-gray-700/50 hover:border-indigo-500/40 transition-colors"
      >
        <Landmark className="w-4 h-4 text-indigo-400" />
        <span className="text-xs font-bold text-gray-300">Parlamento dello Stato</span>
      </button>
    </div>
  );
}
