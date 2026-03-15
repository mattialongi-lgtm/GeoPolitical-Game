/**
 * RegionStatsCarousel – Player's current region statistics.
 * Shows region population, parties, factories, pollution, academies, online.
 */
import React, { useState } from "react";
import { MapPin, Users, Factory, CloudRain, Shield, Wifi } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { RegionStats } from "./mockData";

interface RegionStatsCarouselProps {
  stats: RegionStats;
  userRegionId: string;
  navigateToCountry: (id: string) => void;
}

const MiniStat = ({ icon: Icon, label, value, color, accent, onClick }: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
  accent: string;
  onClick?: () => void;
}) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-800/50 border border-gray-700/40 hover:border-emerald-500/40 active:scale-[0.97] transition-all flex-1 min-w-[140px]"
  >
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
      <Icon className="w-4 h-4 text-white" />
    </div>
    <div className="text-left">
      <span className={`text-sm font-black ${accent} tabular-nums`}>{typeof value === 'number' ? value.toLocaleString() : value}</span>
      <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">{label}</p>
    </div>
  </button>
);

export default function RegionStatsCarousel({ stats, userRegionId, navigateToCountry }: RegionStatsCarouselProps) {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);

  const rows = [
    [
      { icon: MapPin, label: "La tua regione", value: stats.name, color: "bg-emerald-600", accent: "text-emerald-400", onClick: () => navigateToCountry(userRegionId) },
      { icon: Users, label: "Partiti", value: stats.parties, color: "bg-purple-600", accent: "text-purple-400", onClick: () => {} },
      { icon: Factory, label: "Fabbriche", value: stats.factories, color: "bg-amber-600", accent: "text-amber-400", onClick: () => {} },
    ],
    [
      { icon: CloudRain, label: "Inquinamento", value: `${stats.pollution}%`, color: "bg-red-600", accent: "text-red-400", onClick: () => {} },
      { icon: Shield, label: "Accademie Mil.", value: stats.militaryAcademies, color: "bg-sky-600", accent: "text-sky-400", onClick: () => {} },
      { icon: Wifi, label: "Online", value: stats.onlinePlayers, color: "bg-yellow-500", accent: "text-yellow-400", onClick: () => {} },
    ],
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">📍 La Tua Regione</h3>
        <div className="flex gap-1">
          {rows.map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className={`w-2 h-2 rounded-full transition-all ${page === i ? 'bg-emerald-500 w-5' : 'bg-gray-600'}`}
            />
          ))}
        </div>
      </div>
      <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
        <div className="flex gap-2 pb-1 flex-wrap">
          {rows[page].map((s, i) => (
            <MiniStat key={i} {...s} />
          ))}
        </div>
      </div>
      {page === 1 && stats.pollution > 20 && (
        <p className="text-[10px] text-red-400/80 font-medium px-1">
          ⚠️ L'inquinamento elevato rallenta il recupero energia nella regione.
        </p>
      )}
    </div>
  );
}
