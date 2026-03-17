/**
 * QuickAccessMenu – Top bar quick action buttons for the Home dashboard.
 * Provides rapid access to: Map, Market, Storage, Auctions, and more.
 */
import React from "react";
import { Globe, ShoppingCart, Archive, Landmark, Users, Shield, Hammer, Search, CalendarCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface QuickAction {
  icon: React.ElementType;
  label: string;
  route: string;
  color: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { icon: CalendarCheck, label: "Giornaliere", route: "/daily", color: "bg-cyan-600" },
  { icon: Globe, label: "Mappa", route: "/map", color: "bg-indigo-600" },
  { icon: ShoppingCart, label: "Mercato", route: "/market", color: "bg-emerald-600" },
  { icon: Archive, label: "Magazzino", route: "/storage", color: "bg-amber-600" },
  { icon: Landmark, label: "Parlamento", route: "/parliament", color: "bg-blue-600" },
  { icon: Users, label: "Partito", route: "/party", color: "bg-purple-600" },
  { icon: Shield, label: "Blocchi", route: "/blocs", color: "bg-rose-600" },
  { icon: Hammer, label: "Produci", route: "/produce", color: "bg-orange-600" },
];

export default function QuickAccessMenu() {
  const navigate = useNavigate();

  return (
    <div className="-mx-1 px-1">
      <div className="grid grid-cols-8 gap-1 pb-1">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.route}
              onClick={() => navigate(action.route)}
              className="flex flex-col items-center gap-1.5 active:scale-90 transition-all"
            >
              <div className={`w-full aspect-square max-w-[3rem] rounded-2xl flex items-center justify-center ${action.color} shadow-lg`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <span className="text-[9px] font-bold text-gray-400 truncate w-full text-center">{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
