/**
 * WorldStatsCarousel – Horizontally scrollable world statistics.
 * Shows key global metrics: total players, online, regions, states.
 * Second swipe row: blocs, independent regions, parties, factories.
 */
import React, { useState } from "react";
import { Globe, Users, MapPin, Flag, Shield, Factory, UsersRound, Landmark } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { WorldStats } from "./mockData";

interface WorldStatsCarouselProps {
  stats: WorldStats;
}

const StatChip = ({ icon: Icon, label, value, color, onClick }: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
  onClick?: () => void;
}) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-1.5 min-w-[80px] shrink-0 p-3 rounded-2xl bg-gray-800/60 border border-gray-700/50 hover:border-indigo-500/50 active:scale-95 transition-all"
  >
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
      <Icon className="w-4.5 h-4.5 text-white" />
    </div>
    <span className="text-base font-black text-white tabular-nums">{typeof value === 'number' ? value.toLocaleString() : value}</span>
    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
  </button>
);

export default function WorldStatsCarousel({ stats }: WorldStatsCarouselProps) {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);

  const rows = [
    [
      { icon: Globe, label: "Mondo", value: "🗺️", color: "bg-indigo-600", onClick: () => navigate("/map") },
      { icon: Users, label: "Giocatori", value: stats.totalPlayers, color: "bg-emerald-600", onClick: () => {} },
      { icon: UsersRound, label: "Online", value: stats.onlinePlayers, color: "bg-yellow-500", onClick: () => {} },
      { icon: MapPin, label: "Regioni", value: stats.totalRegions, color: "bg-sky-600", onClick: () => navigate("/map") },
      { icon: Flag, label: "Stati", value: stats.totalStates, color: "bg-rose-600", onClick: () => {} },
    ],
    [
      { icon: Shield, label: "Blocchi", value: stats.totalBlocs, color: "bg-purple-600", onClick: () => navigate("/blocs") },
      { icon: MapPin, label: "Indipendenti", value: stats.independentRegions, color: "bg-orange-500", onClick: () => {} },
      { icon: Landmark, label: "Partiti", value: stats.totalParties, color: "bg-teal-600", onClick: () => {} },
      { icon: Factory, label: "Fabbriche", value: stats.totalFactories, color: "bg-amber-600", onClick: () => navigate("/factory-market") },
    ],
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">🌍 Statistiche Mondo</h3>
        <div className="flex gap-1">
          {rows.map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className={`w-2 h-2 rounded-full transition-all ${page === i ? 'bg-indigo-500 w-5' : 'bg-gray-600'}`}
            />
          ))}
        </div>
      </div>
      <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
        <div className="flex gap-2 pb-1" style={{ minWidth: 'min-content' }}>
          {rows[page].map((s, i) => (
            <StatChip key={i} {...s} />
          ))}
        </div>
      </div>
    </div>
  );
}
