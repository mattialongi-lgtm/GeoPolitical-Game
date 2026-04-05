import React from "react";
import {
  Zap,
  User as UserIcon,
  Globe,
  Shield,
  LogOut,
  Gem,
  Hammer,
  Landmark,
  Users,
  Sun,
  Moon,
  MoreVertical,
  ShoppingCart,
  Archive,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { TerritorialBrandLogo } from "./index";

export function AppHeader(props: any) {
  const {
    user, energyTimer, isDarkMode, setIsDarkMode, isMenuOpen, setIsMenuOpen,
    actionLoading, handleUseDrink, handleLogout, isDashboardRoute,
  } = props;

  const navigate = useNavigate();

  if (isDashboardRoute) return null;

  return (
    <header className="bg-gray-950/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-40 px-4 py-3 flex justify-between items-center gap-3 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
      <div className="flex items-center gap-2 shrink-0">
        <TerritorialBrandLogo className="h-9 w-auto max-w-[12rem] object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]" />
      </div>
      <div className="flex items-center gap-2 overflow-x-auto flex-1 justify-end scrollbar-hide">
        {/* Money */}
        <div className="bg-emerald-500/10 px-3 py-2 rounded-2xl border border-emerald-500/20 flex items-center gap-1.5 shrink-0 transition-all hover:bg-emerald-500/20">
          <span className="text-[11px] font-black text-emerald-400/90 tracking-tighter">
            ${(user.money || 0).toLocaleString()}
          </span>
        </div>
        
        {/* Gold */}
        <div className="bg-amber-500/10 px-3 py-2 rounded-2xl border border-amber-500/20 flex items-center gap-1.5 shrink-0 transition-all hover:bg-amber-500/20">
          <span className="text-[11px] font-black text-amber-400/90 tracking-tighter">
            🪙{user.gold || 0}
          </span>
        </div>

        {/* Energy */}
        <div className="bg-indigo-500/10 px-3 py-2 rounded-2xl border border-indigo-500/20 flex items-center gap-2 shrink-0 transition-all hover:bg-indigo-500/20 group">
          <div className="relative">
            <Zap className="w-3.5 h-3.5 text-indigo-400 fill-indigo-400/20 group-hover:scale-110 transition-transform" />
            <div className="absolute inset-0 bg-indigo-400 blur-sm opacity-0 group-hover:opacity-40 transition-opacity" />
          </div>
          <div className="flex flex-col items-start leading-none gap-0.5">
            <span className="text-[11px] font-black text-gray-100 tracking-tighter">
              {user.energy}<span className="text-gray-500 font-bold">/300</span>
            </span>
            {energyTimer !== "MAX" && (
              <span className="text-[7px] font-black text-indigo-400/80 uppercase tracking-widest">{energyTimer}</span>
            )}
          </div>
        </div>

        {/* Energy Drinks */}
        <button
          onClick={handleUseDrink}
          disabled={actionLoading}
          title="Usa Drink Energetico"
          className="bg-sky-500/10 p-2 rounded-2xl border border-sky-500/20 flex items-center justify-center shrink-0 hover:bg-sky-500/20 transition-all active:scale-95 disabled:opacity-50 group relative"
        >
          <span className="text-lg leading-none filter drop-shadow-sm group-hover:rotate-12 transition-transform">🥤</span>
          <div className="absolute -top-1 -right-1 bg-sky-500 text-[8px] font-black text-white px-1.5 py-0.5 rounded-full shadow-lg border border-sky-400/50">
            {user.energyDrinks || 0}
          </div>
        </button>

        {/* Profile Avatar */}
        <button
          onClick={() => navigate("/profile")}
          className="w-10 h-10 rounded-2xl overflow-hidden bg-white/5 flex items-center justify-center shrink-0 border border-white/10 hover:border-indigo-500/50 transition-all active:scale-95 shadow-lg group"
          title="Profilo"
        >
          {user.avatarData ? (
            <img src={user.avatarData} alt="avatar" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
          ) : (
            <UserIcon className="w-5 h-5 text-gray-400 group-hover:text-indigo-400 transition-colors" />
          )}
        </button>
        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 text-gray-400 hover:text-indigo-400 transition-colors bg-gray-800/60 rounded-xl border border-gray-700/40"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          <AnimatePresence>
            {isMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-[998]"
                  onClick={() => setIsMenuOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -8 }}
                  className="fixed right-4 top-14 w-52 bg-gray-800 rounded-2xl shadow-xl border border-gray-700/50 py-2 z-[999] overflow-hidden"
                >
                  <button onClick={() => { navigate("/map"); setIsMenuOpen(false); }} className="w-full px-4 py-3 text-left text-sm font-bold text-gray-200 hover:bg-gray-700/50 flex items-center gap-3 transition-colors">
                    <Globe className="w-4 h-4 text-indigo-400" /> MAPPA
                  </button>
                  <button onClick={() => { navigate("/market"); setIsMenuOpen(false); }} className="w-full px-4 py-3 text-left text-sm font-bold text-gray-200 hover:bg-gray-700/50 flex items-center gap-3 transition-colors">
                    <ShoppingCart className="w-4 h-4 text-emerald-400" /> MERCATO
                  </button>
                  <button onClick={() => { navigate("/storage"); setIsMenuOpen(false); }} className="w-full px-4 py-3 text-left text-sm font-bold text-gray-200 hover:bg-gray-700/50 flex items-center gap-3 transition-colors">
                    <Archive className="w-4 h-4 text-indigo-400" /> MAGAZZINO
                  </button>
                  <button onClick={() => { navigate("/nation"); setIsMenuOpen(false); }} className="w-full px-4 py-3 text-left text-sm font-bold text-gray-200 hover:bg-gray-700/50 flex items-center gap-3 transition-colors">
                    <Shield className="w-4 h-4 text-rose-400" /> NAZIONE
                  </button>
                  <button onClick={() => { navigate("/parliament"); setIsMenuOpen(false); }} className="w-full px-4 py-3 text-left text-sm font-bold text-gray-200 hover:bg-gray-700/50 flex items-center gap-3 transition-colors">
                    <Landmark className="w-4 h-4 text-blue-400" /> PARLAMENTO
                  </button>
                  <button onClick={() => { navigate("/party"); setIsMenuOpen(false); }} className="w-full px-4 py-3 text-left text-sm font-bold text-gray-200 hover:bg-gray-700/50 flex items-center gap-3 transition-colors">
                    <Users className="w-4 h-4 text-purple-400" /> PARTITO
                  </button>
                  <button onClick={() => { navigate("/blocs"); setIsMenuOpen(false); }} className="w-full px-4 py-3 text-left text-sm font-bold text-gray-200 hover:bg-gray-700/50 flex items-center gap-3 transition-colors">
                    <Shield className="w-4 h-4 text-indigo-400" /> BLOCCHI
                  </button>
                  <button onClick={() => { navigate("/produce"); setIsMenuOpen(false); }} className="w-full px-4 py-3 text-left text-sm font-bold text-gray-200 hover:bg-gray-700/50 flex items-center gap-3 transition-colors">
                    <Hammer className="w-4 h-4 text-orange-400" /> PRODUCI ARMI
                  </button>
                  <button onClick={() => { navigate("/shop"); setIsMenuOpen(false); }} className="w-full px-4 py-3 text-left text-sm font-bold text-gray-200 hover:bg-gray-700/50 flex items-center gap-3 transition-colors">
                    <Gem className="w-4 h-4 text-yellow-400" /> NEGOZIO
                  </button>
                  <div className="h-px bg-gray-700/50 my-1" />
                  <button onClick={() => { setIsDarkMode((prev: boolean) => !prev); setIsMenuOpen(false); }} aria-label={isDarkMode ? 'Passa alla modalità chiara' : 'Passa alla modalità scura'} className="w-full px-4 py-3 text-left text-sm font-bold text-gray-200 hover:bg-gray-700/50 flex items-center gap-3 transition-colors">
                    {isDarkMode ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-blue-400" />}
                    {isDarkMode ? 'MODALITÀ CHIARA' : 'MODALITÀ SCURA'}
                  </button>
                  <div className="h-px bg-gray-700/50 my-1" />
                  <button onClick={handleLogout} className="w-full px-4 py-3 text-left text-sm font-bold text-red-400 hover:bg-red-900/20 flex items-center gap-3 transition-colors">
                    <LogOut className="w-4 h-4" /> LOGOUT
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
