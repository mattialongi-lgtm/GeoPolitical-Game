/**
 * StateStatsCarousel – Player's state statistics.
 * Shows state population, parties, factories, regions, orders, online.
 */
import React, { useState } from "react";
import { Flag, Users, Factory, MapPin, ScrollText, Wifi } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { StateStats } from "./mockData";

interface StatItem {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  accent: string;
  onClick: () => void;
}

interface StateStatsCarouselProps {
  stats: StateStats;
  navigateToCountry: (id: string) => void;
}

const MiniStat = ({ icon: Icon, label, value, color, accent, onClick }: StatItem & { key?: any }) => (

  <button
    onClick={onClick}
    className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-800/50 border border-gray-700/40 hover:border-sky-500/40 active:scale-[0.97] transition-all flex-1 min-w-[140px]"
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

export default function StateStatsCarousel({ stats, navigateToCountry }: StateStatsCarouselProps) {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);

  const rows: StatItem[][] = [
    [
      { icon: Flag, label: "Stato", value: stats.name, color: "bg-sky-600", accent: "text-sky-400", onClick: () => navigate("/state/" + stats.iso2) },
      { icon: Users, label: "Partiti", value: stats.parties, color: "bg-purple-600", accent: "text-purple-400", onClick: () => navigate("/parties") },
      { icon: Factory, label: "Fabbriche", value: stats.factories, color: "bg-amber-600", accent: "text-amber-400", onClick: () => navigate("/world-factories") },
    ],
    [
      { icon: MapPin, label: "Regioni", value: stats.regions, color: "bg-emerald-600", accent: "text-emerald-400", onClick: () => navigate("/world-map") },
      { icon: ScrollText, label: "Ordini", value: "Attivi", color: "bg-rose-600", accent: "text-rose-400", onClick: () => navigate("/governance/orders") },
      { icon: Wifi, label: "Online", value: stats.onlinePlayers, color: "bg-yellow-500", accent: "text-yellow-400", onClick: () => navigate("/players?filter=online") },
    ],

  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">🏛️ Il Tuo Stato</h3>
        <div className="flex gap-1">
          {rows.map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className={`w-2 h-2 rounded-full transition-all ${page === i ? 'bg-sky-500 w-5' : 'bg-gray-600'}`}
            />
          ))}
        </div>
      </div>
      <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
        <div className="flex gap-2 pb-1 flex-wrap">
          {rows[page].map((s, i) => (
            <MiniStat 
              key={i} 
              icon={s.icon} 
              label={s.label} 
              value={s.value} 
              color={s.color} 
              accent={s.accent} 
              onClick={s.onClick} 
            />
          ))}
        </div>
      </div>

      {/* Current Orders Banner */}
      {page === 1 && stats.currentOrders && (
        <div className="bg-gray-800/60 border border-gray-700/40 rounded-xl p-3 space-y-1">
          <div className="flex items-center gap-2">
            <ScrollText className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-[10px] font-black text-rose-400 uppercase tracking-wider">Ordini del Leader</span>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">{stats.currentOrders}</p>
        </div>
      )}
    </div>
  );
}
