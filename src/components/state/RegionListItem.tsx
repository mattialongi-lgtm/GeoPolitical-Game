/**
 * RegionListItem – Single region entry in the state's regions list.
 * Shows region name, population, main resource, development level, and optional governor.
 */
import React from 'react';
import { MapPin, Users, Gem, TrendingUp } from 'lucide-react';

interface RegionListItemProps {
  name: string;
  population: number;
  mainResource?: string;
  developmentLevel?: number;
  governor?: string;
  onClick?: () => void;
}

export default function RegionListItem({
  name,
  population,
  mainResource,
  developmentLevel,
  governor,
  onClick,
}: RegionListItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 border-b border-gray-800/40 last:border-b-0 hover:bg-gray-800/30 transition-colors text-left"
    >
      <div className="w-9 h-9 rounded-xl bg-emerald-600/20 flex items-center justify-center shrink-0">
        <MapPin className="w-4 h-4 text-emerald-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white truncate">{name}</p>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="flex items-center gap-1 text-[10px] text-gray-500 font-semibold">
            <Users className="w-3 h-3" />
            {population.toLocaleString('it-IT')}
          </span>
          {mainResource && (
            <span className="flex items-center gap-1 text-[10px] text-gray-500 font-semibold">
              <Gem className="w-3 h-3" />
              {mainResource}
            </span>
          )}
          {developmentLevel !== undefined && (
            <span className="flex items-center gap-1 text-[10px] text-gray-500 font-semibold">
              <TrendingUp className="w-3 h-3" />
              Lv. {developmentLevel}
            </span>
          )}
        </div>
        {governor && (
          <p className="text-[10px] text-indigo-400 font-semibold mt-0.5">Gov: {governor}</p>
        )}
      </div>
    </button>
  );
}
