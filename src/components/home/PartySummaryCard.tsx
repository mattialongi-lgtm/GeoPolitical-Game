/**
 * PartySummaryCard – Party info, player resources, and soldier of the hour.
 * A compact riepilogativa card for the Home dashboard.
 */
import React from "react";
import { Users, Award, ChevronRight } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import type { PartyInfo, PlayerResources, SoldierOfTheHour } from "./mockData";

interface PartySummaryCardProps {
  party: PartyInfo | null;
  resources: PlayerResources;
  soldier: SoldierOfTheHour | null;
}

const resourceItems = [
  { key: 'gold' as const, historyId: 'gold_ore', emoji: '🪙', label: 'Oro', color: 'text-amber-400' },
  { key: 'oil' as const, historyId: 'oil', emoji: '🛢️', label: 'Petrolio', color: 'text-orange-400' },
  { key: 'minerals' as const, historyId: 'minerals', emoji: '🪨', label: 'Minerali', color: 'text-gray-300' },
  { key: 'uranium' as const, historyId: 'uranium', emoji: '☢️', label: 'Uranio', color: 'text-cyan-400' },
  { key: 'diamonds' as const, historyId: 'diamonds', emoji: '💎', label: 'Diamanti', color: 'text-purple-400' },
  { key: 'energyDrinks' as const, historyId: 'energy_drink', emoji: '🥤', label: 'Drink', color: 'text-sky-400' },
  { key: 'liquidOxygen' as const, historyId: 'liquid_oxygen', emoji: '🧊', label: 'O₂ Liq.', color: 'text-blue-300' },
  { key: 'helium3' as const, historyId: 'helium3', emoji: '⚛️', label: 'He-3', color: 'text-teal-400' },
];

export default function PartySummaryCard({ party, resources, soldier }: PartySummaryCardProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-3">
      {/* Party */}
      {party && (
        <button
          onClick={() => navigate("/party")}
          className="w-full bg-gray-800/60 border border-gray-700/40 rounded-xl p-3 flex items-center gap-3 hover:border-purple-500/40 active:scale-[0.98] transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center text-xl overflow-hidden shrink-0">
            {party.logo ? (
              party.logo.startsWith("http") ? (
                <img src={party.logo} alt={party.name} className="w-full h-full object-cover" />
              ) : (
                party.logo
              )
            ) : (
              "🛡️"
            )}
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-white">{party.name}</p>
            <p className="text-[10px] text-gray-400">
              <Users className="w-3 h-3 inline mr-1" />{party.members} membri
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-500" />
        </button>
      )}

      {/* Resources Carousel */}
      <div className="space-y-2">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">🎒 Magazzino</h3>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 sm:gap-2">
          {resourceItems.map((r) => (
            <Link
              key={r.key}
              to={`/inventory/history/${r.historyId}`}
              className="flex flex-col items-center gap-1 p-2 rounded-xl bg-gray-800/50 border border-gray-700/30 transition-all hover:bg-gray-800/80 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 active:scale-95 group cursor-pointer"
            >
              <span className="text-lg group-hover:scale-110 transition-transform">{r.emoji}</span>
              <span className={`text-[11px] sm:text-xs font-black tabular-nums ${r.color}`}>{(resources[r.key] || 0).toLocaleString()}</span>
              <span className="text-[7px] sm:text-[8px] font-bold text-gray-500 uppercase truncate w-full text-center">{r.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Soldier of the Hour */}
      {soldier && (
        <div className="bg-gray-800/50 border border-yellow-900/30 rounded-xl p-3 space-y-1">
          <div className="flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-[9px] font-black text-yellow-400/80 uppercase tracking-wider">Soldato dell'Ora</span>
          </div>
          <p className="text-sm font-black text-white truncate">{soldier.username}</p>
          <p className="text-xs font-bold text-yellow-400 tabular-nums">⚔️ {soldier.damage.toLocaleString()}</p>
        </div>
      )}
    </div>
  );
}
