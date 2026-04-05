import React from "react";
import { Link } from "react-router-dom";

export const ResourceStrip = ({ user }: { user: any }) => (
  <div className="bg-white p-4 rounded-[2.5rem] shadow-sm border border-slate-100">
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Magazzino Risorse (Clicca per cronologia)</p>
    <div className="flex justify-between items-center gap-2 overflow-x-auto">
      {[
        { id: "money", emoji: "💵", label: "Cash", val: user.money || 0, color: "text-emerald-600" },
        { id: "gold_ore", emoji: "🪙", label: "Oro", val: user.gold || 0, color: "text-amber-600" },
        { id: "oil", emoji: "🛢️", label: "Petrolio", val: user.oil || 0, color: "text-orange-600" },
        { id: "minerals", emoji: "🪨", label: "Minerali", val: user.minerals || 0, color: "text-slate-600" },
        { id: "uranium", emoji: "☢️", label: "Uranio", val: user.uranium || 0, color: "text-cyan-600" },
        { id: "diamonds", emoji: "💎", label: "Diamanti", val: user.diamonds || 0, color: "text-purple-600" },
        { id: "energy_drink", emoji: "🥤", label: "Drink", val: user.energyDrinks || 0, color: "text-sky-600" },
      ].map(r => (
        <Link key={r.id} to={`/inventory/history/${r.id}`} className="flex flex-col items-center gap-1 min-w-[56px] hover:scale-110 transition-transform cursor-pointer group">
          <span className="text-xl group-hover:drop-shadow-md transition-all">{r.emoji}</span>
          <span className={`text-sm font-black ${r.color}`}>{r.val}</span>
          <span className="text-[8px] font-bold text-slate-400 uppercase truncate w-full text-center">{r.label}</span>
        </Link>
      ))}
    </div>
  </div>
);
