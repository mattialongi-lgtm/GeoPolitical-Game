/**
 * PartySummaryCard – Party info, player resources, soldier of the hour, and hot war.
 * A compact riepilogativa card for the Home dashboard.
 */
import React from "react";
import { Users, Award, Swords, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { PartyInfo, PlayerResources, SoldierOfTheHour, ActiveWar } from "./mockData";

interface PartySummaryCardProps {
  party: PartyInfo | null;
  resources: PlayerResources;
  soldier: SoldierOfTheHour | null;
  hotWar: ActiveWar | null;
}

const resourceItems = [
  { key: 'gold' as const, emoji: '🪙', label: 'Oro', color: 'text-amber-400' },
  { key: 'oil' as const, emoji: '🛢️', label: 'Petrolio', color: 'text-orange-400' },
  { key: 'minerals' as const, emoji: '🪨', label: 'Minerali', color: 'text-gray-300' },
  { key: 'uranium' as const, emoji: '☢️', label: 'Uranio', color: 'text-cyan-400' },
  { key: 'diamonds' as const, emoji: '💎', label: 'Diamanti', color: 'text-purple-400' },
  { key: 'energyDrinks' as const, emoji: '🥤', label: 'Drink', color: 'text-sky-400' },
  { key: 'liquidOxygen' as const, emoji: '🧊', label: 'O₂ Liq.', color: 'text-blue-300' },
  { key: 'helium3' as const, emoji: '⚛️', label: 'He-3', color: 'text-teal-400' },
];

export default function PartySummaryCard({ party, resources, soldier, hotWar }: PartySummaryCardProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-3">
      {/* Party */}
      {party && (
        <button
          onClick={() => navigate("/party")}
          className="w-full bg-gray-800/60 border border-gray-700/40 rounded-xl p-3 flex items-center gap-3 hover:border-purple-500/40 active:scale-[0.98] transition-all"
        >
          <span className="text-2xl">{party.logo}</span>
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
        <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
          <div className="flex gap-2 pb-1" style={{ minWidth: 'min-content' }}>
            {resourceItems.map((r) => (
              <div
                key={r.key}
                className="flex flex-col items-center gap-1 min-w-[60px] p-2.5 rounded-xl bg-gray-800/50 border border-gray-700/30"
              >
                <span className="text-lg">{r.emoji}</span>
                <span className={`text-xs font-black tabular-nums ${r.color}`}>{(resources[r.key] || 0).toLocaleString()}</span>
                <span className="text-[8px] font-bold text-gray-500 uppercase">{r.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Soldier of the Hour + Hot War */}
      <div className="grid grid-cols-2 gap-2">
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
        {hotWar && (
          <button
            onClick={() => navigate("/wars")}
            className="bg-gray-800/50 border border-red-900/30 rounded-xl p-3 space-y-1 text-left hover:border-red-500/40 active:scale-[0.97] transition-all"
          >
            <div className="flex items-center gap-1.5">
              <Swords className="w-3.5 h-3.5 text-red-400" />
              <span className="text-[9px] font-black text-red-400/80 uppercase tracking-wider">Guerra Calda</span>
            </div>
            <p className="text-[10px] font-bold text-white truncate">{hotWar.attackerName} vs {hotWar.defenderName}</p>
            <p className="text-[10px] text-gray-400">{hotWar.regionName}</p>
          </button>
        )}
      </div>
    </div>
  );
}
