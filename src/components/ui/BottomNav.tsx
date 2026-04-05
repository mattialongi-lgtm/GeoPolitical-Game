import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, FileText, Pickaxe, Bomb, User as UserIcon } from "lucide-react";
import { motion } from "motion/react";

export const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const tabs = [
    { id: "/", label: "Home", icon: Home },
    { id: "/articles", label: "Articoli", icon: FileText },
    { id: "/work", label: "Lavoro", icon: Pickaxe },
    { id: "/wars", label: "Guerre", icon: Bomb },
    { id: "/profile", label: "Profilo", icon: UserIcon },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-900/80 backdrop-blur-xl border-t border-white/5 px-4 py-3 flex justify-around items-center z-50 pb-safe shadow-[0_-8px_32px_rgba(0,0,0,0.4)]">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = location.pathname === tab.id ||
          (tab.id === "/articles" && (location.pathname.startsWith("/articles"))) ||
          (tab.id === "/work" && location.pathname.startsWith("/work")) ||
          (tab.id === "/wars" && location.pathname.startsWith("/wars")) ||
          (tab.id === "/" && location.pathname.startsWith("/countries"));
        return (
          <button
            key={tab.id}
            onClick={() => navigate(tab.id)}
            className={`flex flex-col items-center gap-1 min-w-[64px] py-1 rounded-2xl transition-all duration-300 relative ${isActive ? "text-indigo-400" : "text-gray-500 hover:text-gray-300"}`}
          >
            <div className={`p-2 rounded-xl transition-all duration-300 ${isActive ? "bg-indigo-500/20 shadow-[0_0_15px_rgba(129,140,248,0.3)]" : "group-hover:bg-gray-800/50"}`}>
              <Icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? "scale-110 drop-shadow-[0_0_8px_rgba(129,140,248,0.6)]" : ""}`} />
            </div>
            <span className={`text-[9px] font-black uppercase tracking-widest transition-all ${isActive ? "opacity-100 translate-y-0" : "opacity-70 group-hover:opacity-100"}`}>{tab.label}</span>
            {isActive && (
              <motion.div 
                layoutId="nav-active"
                className="absolute -top-3 w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.8)]"
              />
            )}
          </button>
        );
      })}
    </nav>
  );
};
