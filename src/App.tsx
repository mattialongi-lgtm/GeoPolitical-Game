/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Globe,
  User as UserIcon,
  Shield,
  Zap,
  DollarSign,
  MapPin,
  LogOut,
  Trophy,
  Activity,
  ChevronRight,
  Loader2,
  Mail,
  Lock,
  ArrowRight,
  Home,
  FileText,
  Briefcase,
  Swords,
  Star,
  ChevronUp,
  ChevronDown,
  Info,
  Plus,
  Trash2,
  Edit2,
  Clock,
  Heart,
  Gem,
  Hammer,
  Package,
  CheckCircle2,
  Timer,
  Send,
  Camera,
  BookOpen,
  Check,
  AlertCircle,
  Users,
  Crown,
  Landmark,
  ArrowUpRight,
  Pickaxe,
  Bomb,
  Search,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  ChevronLeft,
  Target,
  Dumbbell,
  Award,
  Flag,
  Sun,
  Moon,
  ArrowLeft,
  ShieldAlert,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { User, Region, GAME_CONFIG, PERKS_DEFS, Article, ArticleBlock, Factory, War, BOOSTER_CONFIG, RESOURCE_TYPES, RESOURCE_LABELS, RESOURCE_ICONS_MAP, FACTORY_CONFIG } from "./types";
import type { ResourceType, DeepCostPreview } from "./types";
import type { WorldStats } from "./components/home/mockData";
import { DEFAULT_WORLD_STATS } from "./components/home/mockData";
import { supabase } from "./lib/supabase";
import { clearBackendAuthCookie, setBackendAuthCookie } from "./api/authClient";
import { useAuthBootstrap } from "./hooks/useAuthBootstrap";
import { useAppBootstrapData } from "./hooks/useAppBootstrapData";
import { useNavigate, useLocation, Routes, Route, Link, useParams, Navigate } from "react-router-dom";
import { MoreVertical, Settings, Box, Archive, Filter, ShoppingCart, RefreshCcw } from "lucide-react";
import { BlocsList } from "./components/BlocsList";
import { BlocCreate } from "./components/BlocCreate";
import { BlocDetail } from "./components/BlocDetail";
import { GovernmentView } from "./components/GovernmentView";
import { LeaderView } from "./components/LeaderView";
import { MinistersView } from "./components/MinistersView";
import WorldMap from "./components/WorldMap";
import FactoryDetail from "./components/FactoryDetail";
import FactoryMarket from "./components/FactoryMarket";
import NationsList from "./components/NationsList";
import PlayersList from "./components/PlayersList";
import PartiesList from "./components/PartiesList";
import WorldFactoriesList from "./components/WorldFactoriesList";
import IndependentRegionsList from "./components/IndependentRegionsList";
import ExtractionDashboard from "./components/ExtractionDashboard";
import ShopPage from "./components/ShopPage";
import { HomePage } from "./components/home";
import { DailyTasksPage } from "./components/daily";
import { StatePage } from "./components/state";
import { WarCreatePanel, RevolutionPanel, WarDamageBar, WarHistoryList, WarFactionBadge } from "./components/war";
import { ArticleBlockRenderer } from "./components/ArticleBlockRenderer";
import { ArticleEditor } from "./components/ArticleEditor";
import { ResourceIcon } from "./components/ResourceIcon";
import type { WarType, TroopType, WarSide } from "./types";
import territorialBrand from "./assets/branding/territorial-brand.svg";
import ResourceHistoryView from "./components/ResourceHistoryView";
import TotalDamageView from "./components/TotalDamageView";
import { fetchMyPlayerDamageSummary, type PlayerDamageSummary } from "./api/profileClient";
import { COUNTRY_FLAGS, getFlag, isoToFlag, PERK_ICONS, RESOURCE_ICONS, RESOURCE_NAMES, WEAPONS_CATALOG, LEGACY_MILITARY_UNITS } from "./constants";
import { getTs, formatDuration, formatRemaining, formatTime } from "./utils";
import { NationalFlag, NationLogo, WarTimer, BottomNav, StatCard, ResourceStrip, StatRow, DarkCard, TerritorialBrandLogo, Toast, TravelTimer, PerkTimer, PerkProgressBar, UsernameEditor } from './components/ui';
import Auth from './components/auth/Auth';
import GlobalChat from './components/chat/GlobalChat';
import Leaderboard from './components/leaderboard/Leaderboard';
import StorageView from './components/storage/StorageView';
import { ArticlesView } from './components/articles/ArticlesView';
import { ArticleDetailView } from './components/articles/ArticleDetailView';
import { NewspaperDetailView } from './components/articles/NewspaperDetailView';
import { NewArticleView } from './components/articles/NewArticleView';
import { WarsView } from './components/wars/WarsView';
import { WarStatsView } from './components/wars/WarStatsView';
import { PlayerFactoriesView } from './components/factories/PlayerFactoriesView';
import { MarketView } from './components/market/MarketView';
import { ProduceView } from './components/produce/ProduceView';
import { RegionResourcesTab } from './components/resources/RegionResourcesTab';
import { ResourceExtractView } from './components/resources/ResourceExtractView';
import { RechargeResourcePanel } from './components/resources/RechargeResourcePanel';
import { DeepExplorationPanel } from './components/resources/DeepExplorationPanel';

import { ProfileView } from './components/profile/ProfileView';
import { PublicProfileView } from './components/profile/PublicProfileView';
import { BudgetView } from './components/budget/BudgetView';
import { CountryDetailView } from './components/country/CountryDetailView';
import { NationView } from './components/nation/NationView';

// --- Main App ---

export default function App() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [nations, setNations] = useState<any[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [wars, setWars] = useState<{ active: War[], ended: War[] }>({ active: [], ended: [] });
  const [worldStats, setWorldStats] = useState<WorldStats>(DEFAULT_WORLD_STATS);
  const [currentView, setCurrentView] = useState<"home" | "articles" | "work" | "wars" | "profile" | "article-new" | "article-detail" | "country-detail">("home");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [energyTimer, setEnergyTimer] = useState("");

  // Work experience transfer (profile UI)
  const [workExpTransferSource, setWorkExpTransferSource] = useState<string>('oil');
  const [workExpTransferTarget, setWorkExpTransferTarget] = useState<string>('minerals');
  const [workExpTransferXp, setWorkExpTransferXp] = useState<number>(0);
  const [workExpTransferBusy, setWorkExpTransferBusy] = useState(false);
  const [workExpTransferError, setWorkExpTransferError] = useState<string | null>(null);
  const [workExpTransferOk, setWorkExpTransferOk] = useState<string | null>(null);

  // Auto-work state
  const [autoWorkFactoryId, setAutoWorkFactoryIdState] = useState<string | null>(null);
  const [autoWorkExpiresAt, setAutoWorkExpiresAt] = useState<string | null>(null);

  // Dark / Light mode toggle with localStorage persistence
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true; // default dark
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const { fetchData } = useAppBootstrapData({
    setUser,
    setRegions,
    setNations,
    setArticles,
    setWars,
    setWorldStats,
    setLoading,
  });

  useAuthBootstrap({
    onSessionReady: fetchData,
    onSignedOut: () => {
      setUser(null);
      setLoading(false);
    }
  });

  useEffect(() => {
    if (!user) return;
    const updateTimer = () => {
      // Max energy is now 300
      const maxE = 300;
      if (user.energy >= maxE) {
        setEnergyTimer("MAX");
        return;
      }
      const now = Date.now();
      const passed = now - user.lastEnergyUpdate;
      // 10 minutes ticks
      const TICK_MS = 10 * 60 * 1000;
      const msToNext = TICK_MS - (passed % TICK_MS);
      const m = Math.floor(msToNext / 60000);
      const s = Math.floor((msToNext % 60000) / 1000);
      setEnergyTimer(`${m}:${s.toString().padStart(2, '0')}`);
    };
    updateTimer();
    const iv = setInterval(updateTimer, 1000);
    return () => clearInterval(iv);
  }, [user]);

  const refreshAutoWorkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/automation/work");
      const data = await res.json();
      setAutoWorkFactoryIdState(data.autoWork?.factoryId || null);
      setAutoWorkExpiresAt(data.autoWork?.expiresAt || null);
    } catch {
      setAutoWorkFactoryIdState(null);
      setAutoWorkExpiresAt(null);
    }
  }, []);

  const setAutoWorkFactoryId = useCallback(async (factoryId: string | null) => {
    try {
      if (factoryId) {
        const warRes = await fetch("/api/automation/war-attacks");
        const warData = await warRes.json();
        const hasIncompatibleAutoAttack = (warData.autoAttacks || []).some((entry: any) => entry?.autoType !== 'hourly');
        if (hasIncompatibleAutoAttack) {
          alert("Auto-Work è compatibile solo con il Danno Orario, non con l'Auto-War standard.");
          return;
        }
      }

      const res = await fetch("/api/automation/work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(factoryId ? { factoryId } : { enabled: false }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      }
    } finally {
      await refreshAutoWorkStatus();
      fetchData();
    }
  }, [fetchData, refreshAutoWorkStatus]);

  useEffect(() => {
    if (!user) return;
    refreshAutoWorkStatus();
    const iv = setInterval(refreshAutoWorkStatus, 30000);
    return () => clearInterval(iv);
  }, [user, refreshAutoWorkStatus]);

  const handleUseDrink = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/actions/use-drink", { method: "POST" });
      const data = await res.json();
      if (data.error) alert(data.error);
      else fetchData();
    } catch { alert("Errore nell'uso del drink"); }
    finally { setActionLoading(false); }
  };

  const navigateToCountry = (iso2: string) => {
    if (!iso2 || iso2 === "-99") return alert("Regione non disponibile");
    navigate(`/countries/${iso2}`);
  };

  const handleAction = async (action: string, body: any = {}) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/actions/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else fetchData();
    } catch (err) {
      alert("Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearBackendAuthCookie();
    setUser(null);
  };

  const handleUpgradePerk = async (perkId: string, useGold: boolean = false) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/perks/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perkId, useGold }),
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else {
        // Optimistic update — show the timer immediately
        if (data.queued && user) {
          setUser({
            ...user,
            perkUpgrades: {
              ...(user.perkUpgrades || {}),
              [perkId]: {
                startedAt: Date.now(),
                willCompleteAt: data.willCompleteAt,
                targetLevel: (user.perks?.[perkId] || 0) + 1
              }
            }
          });
        }
        fetchData();
      }
    } catch (err) {
      alert("Upgrade failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivateBooster = async (perkId: string, useGold: boolean) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/perks/booster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perkId, useGold }),
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else {
        fetchData();
      }
    } catch (err) {
      alert("Booster activation failed");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
    </div>
  );

  if (!user) return <Auth onLogin={fetchData} />;

  const selectedRegion = regions.find(r => r.id === selectedRegionId);

  // Check if we are on a dashboard route that has its own sidebar/navigation
  const isDashboardRoute = 
    location.pathname.startsWith("/leader") || 
    location.pathname.startsWith("/ministers") ||
    location.pathname.startsWith("/inventory/history");

  return (
    <div className={`min-h-screen bg-gray-950 text-gray-100 font-sans pb-24`}>
      {/* Header - Hidden on Dashboards */}
      {!isDashboardRoute && (
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
                      <button onClick={() => { setIsDarkMode(prev => !prev); setIsMenuOpen(false); }} aria-label={isDarkMode ? 'Passa alla modalità chiara' : 'Passa alla modalità scura'} className="w-full px-4 py-3 text-left text-sm font-bold text-gray-200 hover:bg-gray-700/50 flex items-center gap-3 transition-colors">
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
      )}

      {/* Main Content */}
      <main className={`${isDashboardRoute ? 'max-w-none p-0' : 'max-w-2xl mx-auto p-6'}`}>
        <Routes>
          <Route path="/" element={<HomePage user={user} regions={regions} wars={wars} worldStats={worldStats} navigateToCountry={navigateToCountry} />} />
          <Route path="/daily" element={<DailyTasksPage user={user} regions={regions} />} />
          <Route path="/map" element={<WorldMap onRegionClick={navigateToCountry} regions={regions} />} />
          <Route path="/market" element={<MarketView user={user} fetchData={fetchData} />} />
          <Route path="/storage" element={<StorageView user={user} />} />
          <Route path="/inventory/history/:itemId" element={<ResourceHistoryView fetchData={fetchData} />} />
          <Route path="/profile/total-damage" element={user ? <TotalDamageView /> : <Navigate to="/" />} />
          <Route path="/produce" element={<ProduceView user={user} />} />
          <Route path="/states" element={<NationsList />} />
          <Route path="/state/:id" element={<StatePage user={user} />} />
          <Route path="/players" element={<PlayersList />} />
          <Route path="/parties" element={<PartiesList />} />
          <Route path="/world-factories" element={<WorldFactoriesList />} />
          <Route path="/independent-regions" element={<IndependentRegionsList />} />
          <Route path="/articles" element={<ArticlesView articles={articles} setSelectedArticleId={setSelectedArticleId} actionLoading={actionLoading} fetchData={fetchData} />} />
          <Route path="/articles/:id" element={<ArticleDetailView articles={articles} user={user} fetchData={fetchData} />} />
          <Route path="/articles/new" element={<NewArticleView actionLoading={actionLoading} fetchData={fetchData} />} />
          <Route path="/articles/edit/:editId" element={<NewArticleView actionLoading={actionLoading} fetchData={fetchData} />} />
          <Route path="/newspapers/:id" element={<NewspaperDetailView user={user} />} />
          <Route path="/work" element={
            user ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Mercato del Lavoro</h2>
                  <div className="bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span className="font-black text-slate-700">{user.energy}/300</span>
                  </div>
                </div>

                {user.regionId !== user.residenceId && user.workPermitId !== user.regionId && (
                  <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                    <p className="text-xs font-bold text-amber-800 leading-tight">
                      Sei all'estero come Turista in <span className="font-black">{user.regionId}</span>. Se questa nazione ha attivato le restrizioni, i tuoi turni di lavoro potrebbero essere bloccati senza Visto.
                    </p>
                  </div>
                )}

                {/* Risorse estraibili nella regione */}
                <ResourceExtractView user={user} fetchData={fetchData} />


                {false && (
                <div className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-3">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Panoramica risorse in {user.regionId}</h3>
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { emoji: "🪙", label: "Oro", color: "bg-amber-50" },
                      { emoji: "🛢️", label: "Petrolio", color: "bg-orange-50" },
                      { emoji: "🪨", label: "Minerali", color: "bg-slate-50" },
                      { emoji: "☢️", label: "Uranio", color: "bg-cyan-50" },
                      { emoji: "💎", label: "Diamanti", color: "bg-purple-50" },
                    ].map(r => (
                      <div key={r.label} className={`${r.color} p-2 rounded-xl flex flex-col items-center gap-1`}>
                        <span className="text-lg">{r.emoji}</span>
                        <span className="text-[8px] font-black text-slate-500 uppercase">{r.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                )}

                {/* Limiti giornalieri */}
                {false && (
                <div className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-3">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Limite risorse giornaliero</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-amber-50 p-3 rounded-xl flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-700">Estratte oggi</span>
                      <span className="text-sm font-black text-amber-800">{user.dailyExtracted || 0}</span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600">Limite</span>
                      <span className="text-sm font-black text-slate-800">{user.dailyLimit || 100}</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-indigo-500 h-full rounded-full transition-all" style={{ width: `${Math.min(100, ((user.dailyExtracted || 0) / (user.dailyLimit || 100)) * 100)}%` }} />
                  </div>
                </div>
                )}


                {/* Esperienza sulle risorse */}
                <div className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-3">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Esperienza Lavorativa</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { emoji: "🪙", label: "Oro", exp: user.goldOreExp || 0 },
                      { emoji: "🛢️", label: "Petrolio", exp: user.oilExp || 0 },
                      { emoji: "🪨", label: "Minerali", exp: user.mineralsExp || 0 },
                      { emoji: "☢️", label: "Uranio", exp: user.uraniumExp || 0 },
                      { emoji: "💎", label: "Diamanti", exp: user.diamondsExp || 0 },
                    ].map(r => (
                      <div key={r.label} className="bg-slate-50 p-3 rounded-xl flex items-center gap-2">
                        <span className="text-lg">{r.emoji}</span>
                        <div>
                          <span className="text-[9px] font-black text-slate-400 uppercase">{r.label}</span>
                          {(() => {
                            const edu = Math.max(0, Math.floor(Number(user?.perks?.['ISTRUZIONE'] || 0)));
                            const maxWorkXp = 2000 + (edu * 1000);
                            const current = Math.max(0, Math.floor(Number(r.exp) || 0));
                            const effective = Math.min(current, maxWorkXp);
                            const pct = maxWorkXp > 0 ? Math.min(100, (effective / maxWorkXp) * 100) : 0;
                            return (
                              <>
                                <p className="text-sm font-black text-slate-800">{effective.toLocaleString()} / {maxWorkXp.toLocaleString()} XP</p>
                                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
                                  <div className="bg-indigo-500 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Trasferimento EXP (XP -> altra risorsa) */}
                  {(() => {
                    const edu = Math.max(0, Math.floor(Number(user?.perks?.['ISTRUZIONE'] || 0)));
                    const maxWorkXp = 2000 + (edu * 1000);
                    const expByResource: Record<string, number> = {
                      oil: Math.max(0, Math.floor(Number(user?.oilExp) || 0)),
                      minerals: Math.max(0, Math.floor(Number(user?.mineralsExp) || 0)),
                      uranium: Math.max(0, Math.floor(Number(user?.uraniumExp) || 0)),
                      diamonds: Math.max(0, Math.floor(Number(user?.diamondsExp) || 0)),
                      gold_ore: Math.max(0, Math.floor(Number(user?.goldOreExp) || 0)),
                    };
                    const goldAvailable = Math.max(0, Math.floor(Number(user?.gold) || 0));
                    const xp = Math.max(0, Math.floor(Number(workExpTransferXp) || 0));
                    const goldCost = Math.max(1, Math.ceil(xp / 100));
                    const srcXp = expByResource[workExpTransferSource] ?? 0;
                    const dstXp = expByResource[workExpTransferTarget] ?? 0;
                    const canSubmit =
                      !workExpTransferBusy &&
                      workExpTransferSource !== workExpTransferTarget &&
                      xp > 0 &&
                      xp <= srcXp &&
                      dstXp < maxWorkXp &&
                      (dstXp + xp) <= maxWorkXp &&
                      goldAvailable >= goldCost;

                    return (
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] font-black text-slate-400 uppercase">Trasferisci EXP</p>
                          <p className="text-[9px] font-black text-slate-400">Costo: {goldCost}G</p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase">Sorgente</p>
                            <select
                              className="w-full mt-1 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-black text-slate-700"
                              value={workExpTransferSource}
                              onChange={(e) => setWorkExpTransferSource(e.target.value)}
                            >
                              <option value="oil">Petrolio ({expByResource.oil.toLocaleString()} XP)</option>
                              <option value="minerals">Minerali ({expByResource.minerals.toLocaleString()} XP)</option>
                              <option value="uranium">Uranio ({expByResource.uranium.toLocaleString()} XP)</option>
                              <option value="diamonds">Diamanti ({expByResource.diamonds.toLocaleString()} XP)</option>
                              <option value="gold_ore">Oro ({expByResource.gold_ore.toLocaleString()} XP)</option>
                            </select>
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase">Destinazione</p>
                            <select
                              className="w-full mt-1 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-black text-slate-700"
                              value={workExpTransferTarget}
                              onChange={(e) => setWorkExpTransferTarget(e.target.value)}
                            >
                              <option value="oil">Petrolio ({expByResource.oil.toLocaleString()} XP)</option>
                              <option value="minerals">Minerali ({expByResource.minerals.toLocaleString()} XP)</option>
                              <option value="uranium">Uranio ({expByResource.uranium.toLocaleString()} XP)</option>
                              <option value="diamonds">Diamanti ({expByResource.diamonds.toLocaleString()} XP)</option>
                              <option value="gold_ore">Oro ({expByResource.gold_ore.toLocaleString()} XP)</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="number"
                            min={0}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-black text-slate-700"
                            value={Number.isFinite(workExpTransferXp) ? workExpTransferXp : 0}
                            onChange={(e) => setWorkExpTransferXp(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                          />
                          <button
                            disabled={!canSubmit}
                            onClick={async () => {
                              setWorkExpTransferError(null);
                              setWorkExpTransferOk(null);
                              const src = String(workExpTransferSource || '').trim();
                              const dst = String(workExpTransferTarget || '').trim();
                              const transferXp = Math.max(0, Math.floor(Number(workExpTransferXp) || 0));
                              setWorkExpTransferBusy(true);
                              try {
                                const res = await fetch(`/api/extraction/transfer-work-exp`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ sourceResource: src, targetResource: dst, xpToTransfer: transferXp }),
                                });
                                const data = await res.json().catch(() => null);
                                if (!res.ok) throw new Error(data?.error || "Errore trasferimento.");
                                setWorkExpTransferOk(`Trasferite ${transferXp.toLocaleString()} XP (${goldCost}G).`);
                                fetchData();
                              } catch (e: any) {
                                setWorkExpTransferError(e?.message || "Errore trasferimento.");
                              } finally {
                                setWorkExpTransferBusy(false);
                              }
                            }}
                            className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black disabled:opacity-50"
                          >
                            {workExpTransferBusy ? "..." : "Trasferisci"}
                          </button>
                        </div>

                        <p className="text-[9px] text-slate-400 font-bold mt-2">
                          Cap: {maxWorkXp.toLocaleString()} XP (Istruzione {edu}) • Gold: {goldAvailable.toLocaleString()}G
                        </p>
                        {workExpTransferError && <p className="text-[10px] font-black text-red-600 mt-1">{workExpTransferError}</p>}
                        {workExpTransferOk && <p className="text-[10px] font-black text-emerald-600 mt-1">{workExpTransferOk}</p>}
                      </div>
                    );
                  })()}
                </div>


                {/* Modalità automatica */}
                <div className="p-5 rounded-[2.5rem] shadow-sm border space-y-3 bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-white shadow-sm">
                        <Zap className="w-5 h-5 text-amber-500" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-800">Modalità Automatica</h3>
                        <p className="text-[10px] text-slate-400 font-medium">Attivo per 24h, esegue il lavoro ogni 10 minuti e può coesistere solo con il Danno Orario</p>
                      </div>
                    </div>
                    {autoWorkFactoryId && (
                      <button onClick={() => setAutoWorkFactoryId(null)} className="px-4 py-2 bg-red-500 text-white rounded-xl font-black text-xs uppercase hover:bg-red-600">
                        ⏹ Ferma
                      </button>
                    )}
                  </div>
                  {autoWorkFactoryId ? (
                    <div className="bg-amber-100 rounded-xl p-3 flex items-center gap-2">
                      <span className="animate-pulse text-lg">⚙️</span>
                      <span className="text-xs font-black text-amber-800">Auto-lavoro attivo per 24h. Esegue il lavoro ogni 10 minuti, resta compatibile con il Danno Orario, ma non con l'Auto-War standard{autoWorkExpiresAt ? ` • Scade: ${new Date(autoWorkExpiresAt).toLocaleString('it-IT')}` : ''}.</span>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-600 font-medium">Seleziona una fabbrica qui sotto e clicca "Auto" per attivare il lavoro automatico. Auto-Work è compatibile solo con il Danno Orario.</p>
                  )}
                </div>

                <PlayerFactoriesView
                  user={user}
                  fetchData={fetchData}
                  autoWorkFactoryId={autoWorkFactoryId}
                  setAutoWorkFactoryId={setAutoWorkFactoryId}
                />
              </motion.div>
            ) : <Navigate to="/" />
          } />
          <Route path="/wars" element={<WarsView wars={wars} user={user} nations={nations} fetchData={fetchData} actionLoading={actionLoading} autoWorkFactoryId={autoWorkFactoryId} setAutoWorkFactoryId={setAutoWorkFactoryId} />} />
          <Route path="/wars/:warId" element={<WarsView wars={wars} user={user} nations={nations} fetchData={fetchData} actionLoading={actionLoading} autoWorkFactoryId={autoWorkFactoryId} setAutoWorkFactoryId={setAutoWorkFactoryId} />} />
          <Route path="/war/:warId/summary" element={<WarStatsView user={user} nations={nations} />} />
          <Route path="/party" element={<PartyHub user={user} fetchData={fetchData} />} />
          <Route path="/profile" element={<ProfileView user={user} regions={regions} nations={nations} handleUpgradePerk={handleUpgradePerk} handleActivateBooster={handleActivateBooster} actionLoading={actionLoading} fetchData={fetchData} />} />
          <Route path="/profile/:userId" element={<PublicProfileView regions={regions} nations={nations} />} />
          <Route path="/shop" element={user ? <ShopPage user={user} /> : <Navigate to="/" />} />
          <Route path="/factory/:id" element={user ? <FactoryDetail user={user} fetchData={fetchData} /> : <Navigate to="/" />} />
          <Route path="/factory-market" element={user ? <FactoryMarket user={user} fetchData={fetchData} /> : <Navigate to="/" />} />
          <Route path="/extraction/:id" element={user ? <ExtractionDashboard user={user} /> : <Navigate to="/" />} />
          <Route path="/countries/:iso2" element={<CountryDetailView user={user} handleAction={handleAction} actionLoading={actionLoading} fetchData={fetchData} />} />
          <Route path="/regions/:iso2" element={<CountryDetailView user={user} handleAction={handleAction} actionLoading={actionLoading} fetchData={fetchData} />} />
          <Route path="/leader" element={<LeaderView user={user} regionId={user?.residenceId || user?.regionId} fetchData={fetchData} />} />
          <Route path="/leader/:iso2" element={<LeaderView user={user} fetchData={fetchData} />} />
          <Route path="/ministers" element={<MinistersView user={user} fetchData={fetchData} />} />
          <Route path="/ministers/:iso2" element={<MinistersView user={user} fetchData={fetchData} />} />
          <Route path="/nation" element={<NationView user={user} fetchData={fetchData} />} />
          <Route path="/parliament" element={<ParliamentView user={user} />} />
          <Route path="/blocs" element={<BlocsList />} />
          <Route path="/blocs/create" element={<BlocCreate currentUser={user} regions={regions} />} />
          <Route path="/blocs/:id" element={<BlocDetail currentUser={user} regions={regions} />} />
        </Routes>
      </main>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}

// ==========================================
// POLITICAL PARTIES COMPONENTS
// ==========================================

const PartyDashboard = ({ party, members, activeMembersCount, myRole, user, reload, fetchData, primariesVoteCounts, hasVotedPrimaries }: any) => {
  const [activeTab, setActiveTab] = useState('info');
  const [loading, setLoading] = useState(false);
  const [targetUser, setTargetUser] = useState<any>(null);

  // Modals
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ name: party.name, ideology: party.ideology, tag: party.tag, description: party.description, logo: party.logo });
  const [showInvite, setShowInvite] = useState(false);
  const [inviteId, setInviteId] = useState("");

  // Economy
  const [wageForm, setWageForm] = useState({ targetUserId: '', salaryCash: 0, salaryGold: 0 });
  const [contributeForm, setContributeForm] = useState({ targetUserId: '', itemType: 'cash', amount: 0 });

  const maxGoldTotal = Math.min(5000, activeMembersCount * 100);
  const maxGoldPerUser = Math.min(200, 50 + (activeMembersCount * 5));

  const isLeader = myRole === 'leader';
  const isSecretary = myRole === 'secretary' || isLeader;

  const handleEdit = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/parties/edit", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ partyId: party.id, ...editForm }) });
      if ((await res.json()).error) alert("Errore modifica");
      else { setShowEdit(false); reload(); }
    } finally { setLoading(false); }
  };

  const handleInvite = async () => {
    if (!inviteId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/parties/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetUserId: inviteId }) });
      const data = await res.json();
      if (data.error) alert(data.error);
      else { alert("Invito inviato!"); setShowInvite(false); setInviteId(""); }
    } finally { setLoading(false); }
  };

  const handleRole = async (targetUserId: string, newRole: string) => {
    try {
      const res = await fetch("/api/parties/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ partyId: party.id, targetUserId, newRole }) });
      if (!(await res.json()).error) reload();
    } catch { alert("Errore"); }
  };

  const handleKick = async (targetUserId: string) => {
    if (!window.confirm("Sei sicuro di voler espellere questo membro?")) return;
    try {
      const res = await fetch("/api/parties/kick", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ partyId: party.id, targetUserId }) });
      if (!(await res.json()).error) reload();
    } catch { alert("Errore"); }
  };

  const handleSetWage = async () => {
    try {
      const res = await fetch("/api/parties/set-wage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ partyId: party.id, ...wageForm }) });
      const data = await res.json();
      if (data.error) alert(data.error);
      else reload();
    } catch { alert("Errore"); }
  };

  const handlePayWages = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/parties/pay-wages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ partyId: party.id }) });
      const data = await res.json();
      if (data.error) alert(data.error);
      else { alert(`Pagati ${data.totalCash}$ e ${data.totalGold}G a ${data.paidMembers} membri.`); fetchData(); }
    } catch { alert("Errore"); }
    finally { setLoading(false); }
  };

  const handleContribute = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/parties/contribute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(contributeForm) });
      const data = await res.json();
      if (data.error) alert(data.error);
      else { alert("Inviato!"); setTargetUser(null); fetchData(); }
    } catch { alert("Errore"); }
    finally { setLoading(false); }
  };

  const handleVote = async (candidateId: string) => {
    try {
      const res = await fetch("/api/parties/primaries-vote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateId }) });
      const data = await res.json();
      if (data.error) alert(data.error);
      else { alert("Voto registrato!"); reload(); }
    } catch { alert("Errore"); }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          {party.logo ? <img src={party.logo} className="w-32 h-32 rounded-3xl" /> : <Users className="w-32 h-32" />}
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6">
          {party.logo ? <img src={party.logo} className="w-24 h-24 rounded-2xl shadow-md object-cover" /> : <div className="w-24 h-24 bg-indigo-100 rounded-2xl flex items-center justify-center"><Users className="w-10 h-10 text-indigo-500" /></div>}
          <div className="flex-1">
            <h1 className="text-3xl font-black text-slate-900 leading-tight">{party.name} {party.tag && <span className="text-indigo-600">[{party.tag}]</span>}</h1>
            <p className="text-slate-500 font-bold mt-1 max-w-xl">{party.description || "Nessuna descrizione."}</p>
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-xs font-bold uppercase">Ideologia: {party.ideology || "Non definita"}</span>
              <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-xs font-bold uppercase">Regione: {party.regionId}</span>
              <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg text-xs font-black uppercase">Membri Attivi: {activeMembersCount}</span>
            </div>
          </div>
          {isLeader && (
            <button onClick={() => setShowEdit(true)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-3 rounded-xl transition-colors shrink-0">
              <Edit2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex overflow-x-auto gap-2 pb-2">
        <button onClick={() => setActiveTab('info')} className={`px-5 py-2.5 rounded-xl font-black text-sm uppercase tracking-wider whitespace-nowrap transition-colors ${activeTab === 'info' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>Membri</button>
        <button onClick={() => setActiveTab('economy')} className={`px-5 py-2.5 rounded-xl font-black text-sm uppercase tracking-wider whitespace-nowrap transition-colors ${activeTab === 'economy' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>Economia & Salari</button>
        <button onClick={() => setActiveTab('primaries')} className={`px-5 py-2.5 rounded-xl font-black text-sm uppercase tracking-wider whitespace-nowrap transition-colors ${activeTab === 'primaries' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>Primarie</button>
      </div>

      {activeTab === 'info' && (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-slate-800">Iscritti ({members.length})</h3>
            {isSecretary && (
              <button onClick={() => setShowInvite(true)} className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-4 py-2 font-black text-xs uppercase tracking-widest rounded-xl transition-colors shrink-0">
                + Invita Membro
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-3 px-2 text-xs font-black text-slate-400 uppercase tracking-widest">Player</th>
                  <th className="pb-3 px-2 text-xs font-black text-slate-400 uppercase tracking-widest">Ruolo</th>
                  <th className="pb-3 px-2 text-xs font-black text-slate-400 uppercase tracking-widest">Attività</th>
                  <th className="pb-3 px-2 text-xs font-black text-slate-400 uppercase tracking-widest">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {members.map((m: any) => {
                  const lastLoginTs = typeof m.lastLogin === 'string' ? new Date(m.lastLogin).getTime() : (m.lastLogin || 0);
                  const isActive = Date.now() - lastLoginTs <= 48 * 60 * 60 * 1000;
                  return (
                    <tr key={m.userId} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-slate-400">{m.level}</div>
                          <span className="font-bold text-slate-900">{m.username}</span>
                          {m.userId === party.leaderUserId && <Crown className="w-4 h-4 text-amber-500" />}
                        </div>
                      </td>
                      <td className="py-4 px-2 font-bold text-slate-600 capitalize">
                        {m.role === 'leader' ? <span className="text-amber-600">Leader</span> : m.role === 'secretary' ? <span className="text-indigo-600">Segretario</span> : "Membro"}
                      </td>
                      <td className="py-4 px-2">
                        {isActive ? <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded border border-emerald-100 text-[10px] font-black uppercase">Attivo</span> : <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded border border-slate-200 text-[10px] font-black uppercase">Inattivo</span>}
                      </td>
                      <td className="py-4 px-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {m.userId !== user.id && (
                            <button onClick={() => setTargetUser(m)} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 p-2 rounded-lg" title="Invia Contributo"><ArrowRight className="w-4 h-4" /></button>
                          )}
                          {isLeader && m.userId !== user.id && m.role !== 'leader' && (
                            <>
                              {m.role === 'secretary' ?
                                <button onClick={() => handleRole(m.userId, 'member')} className="bg-slate-100 text-slate-600 p-2 rounded-lg text-[10px] uppercase font-black tracking-wider" title="Rimuovi Segretario">Demansiona</button>
                                :
                                <button onClick={() => handleRole(m.userId, 'secretary')} className="bg-emerald-50 text-emerald-600 p-2 rounded-lg text-[10px] uppercase font-black tracking-wider" title="Promuovi a Segretario">Promuovi</button>
                              }
                            </>
                          )}
                          {isSecretary && m.role !== 'leader' && m.userId !== user.id && (
                            <button onClick={() => handleKick(m.userId)} className="bg-rose-50 hover:bg-rose-100 text-rose-600 p-2 rounded-lg" title="Espelli"><Trash2 className="w-4 h-4" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'economy' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm border-l-4 border-l-amber-400">
              <h4 className="text-slate-500 font-bold uppercase tracking-widest text-xs mb-1">Cap. Gold Distribuibile</h4>
              <p className="text-3xl font-black text-slate-900">{maxGoldTotal} <span className="text-sm text-slate-400">/ ciclo</span></p>
              <p className="text-xs text-slate-400 mt-2">Corrisponde a {activeMembersCount} membri attivi x 100 G.</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm border-l-4 border-l-sky-400">
              <h4 className="text-slate-500 font-bold uppercase tracking-widest text-xs mb-1">Max Gold per Utente</h4>
              <p className="text-3xl font-black text-slate-900">{maxGoldPerUser}</p>
              <p className="text-xs text-slate-400 mt-2">Limite personale per busta paga.</p>
            </div>
          </div>

          {isLeader && (
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4 overflow-x-auto min-w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-black text-slate-800">Impostazione Salari</h3>
                <button onClick={handlePayWages} disabled={loading} className="bg-emerald-500 text-white px-6 py-3 font-black text-sm uppercase rounded-xl hover:bg-emerald-600 shadow-lg shadow-emerald-200 transition-all focus:ring-4 focus:ring-emerald-100 flex items-center gap-2 shrink-0">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4 text-emerald-100" />} Paga
                </button>
              </div>

              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-black text-slate-400 uppercase tracking-widest">
                    <th className="pb-3 px-2">Player</th>
                    <th className="pb-3 px-2 text-center">Cash ($)</th>
                    <th className="pb-3 px-2 text-center">Gold</th>
                    <th className="pb-3 px-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {members.map((m: any) => (
                    <tr key={m.userId} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-2 font-bold text-slate-800">{m.username} {m.userId === wageForm.targetUserId && <span className="ml-2 w-2 h-2 rounded-full bg-indigo-500 inline-block animate-pulse"></span>}</td>
                      <td className="py-3 px-2 text-center">
                        <input type="number" min={0} defaultValue={m.salaryCash} onChange={e => { setWageForm({ targetUserId: m.userId, salaryCash: parseInt(e.target.value) || 0, salaryGold: wageForm.targetUserId === m.userId ? wageForm.salaryGold : m.salaryGold }) }} className="w-20 md:w-24 bg-white border border-slate-200 rounded p-1 text-sm font-bold text-slate-700 focus:border-indigo-400 outline-none text-center" />
                      </td>
                      <td className="py-3 px-2 text-center">
                        <input type="number" min={0} max={maxGoldPerUser} defaultValue={m.salaryGold} onChange={e => { setWageForm({ targetUserId: m.userId, salaryGold: parseInt(e.target.value) || 0, salaryCash: wageForm.targetUserId === m.userId ? wageForm.salaryCash : m.salaryCash }) }} className="w-16 md:w-20 bg-amber-50 border border-amber-200 rounded p-1 text-sm font-bold text-amber-700 outline-none text-center focus:border-amber-400" />
                      </td>
                      <td className="py-3 px-2 text-right">
                        <button onClick={handleSetWage} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-4 py-2 rounded-lg text-[10px] font-black uppercase disabled:opacity-50" disabled={wageForm.targetUserId !== m.userId}>Salva</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'primaries' && (
        <div className="bg-white p-6 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
          <Trophy className="w-16 h-16 text-indigo-200 mx-auto mb-4" />
          <h3 className="text-2xl font-black text-slate-800 mb-2">Elezioni Primarie</h3>
          <p className="text-slate-500 font-bold mb-8 max-w-md mx-auto">Vota un membro del tuo partito! I vincitori avranno la possibilità di candidarsi al Parlamento per le Elezioni Nazionali. Ciclo ogni 5 giorni.</p>

          {hasVotedPrimaries && (
            <div className="flex items-center justify-center gap-2 mb-6 bg-emerald-50 border border-emerald-200 rounded-2xl p-3">
              <Check className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-black text-emerald-700 uppercase">Hai già votato in questo ciclo</span>
            </div>
          )}

          <div className="grid gap-3 max-w-lg mx-auto text-left">
            {members.map((m: any) => (
              <div key={m.userId} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center font-black text-indigo-500">{m.level}</div>
                  <div>
                    <p className="font-black text-slate-900 leading-tight">{m.username}</p>
                    <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">{m.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-black text-indigo-600">{primariesVoteCounts[m.userId] || 0} voti</span>
                  {hasVotedPrimaries ? (
                    <span className="bg-slate-200 text-slate-500 px-5 py-2 font-black tracking-widest uppercase text-xs rounded-xl">
                      Votato
                    </span>
                  ) : (
                    <button onClick={() => handleVote(m.userId)} className="bg-indigo-600 text-white hover:bg-indigo-700 px-5 py-2 font-black tracking-widest uppercase text-xs rounded-xl shadow-md transition-all">
                      Vota
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Target User Contribute Modal */}
      <AnimatePresence>
        {targetUser && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setTargetUser(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white p-8 rounded-[2.5rem] shadow-2xl overflow-hidden relative z-10 w-full max-w-md border border-slate-100 space-y-6">
              <h3 className="text-2xl font-black text-slate-900 leading-tight">Invia a {targetUser.username}</h3>
              <p className="text-sm text-slate-500 font-bold px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl mt-2 line-clamp-3">I trasferimenti di fondi di partito sono tracciati nel log.</p>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1 mb-1 block">Risorsa</label>
                  <select value={contributeForm.itemType} onChange={e => setContributeForm({ ...contributeForm, targetUserId: targetUser.userId, itemType: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold outline-none text-slate-700 focus:border-indigo-300">
                    <option value="cash">💵 Cash ($)</option>
                    <option value="gold">🪙 Gold</option>
                    <option value="oil">🛢️ Petrolio</option>
                    <option value="minerals">🪨 Minerali</option>
                    <option value="uranium">☢️ Uranio</option>
                    <option value="diamonds">💎 Diamanti</option>
                    <option value="tank">🛡️ Carri armati</option>
                    <option value="aircraft">✈️ Aerei</option>
                    <option value="battleship">🚢 Corazzate navali</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1 mb-1 block">Quantità</label>
                  <input type="number" min={1} value={contributeForm.amount || ''} onChange={e => setContributeForm({ ...contributeForm, targetUserId: targetUser.userId, amount: parseInt(e.target.value) || 0 })} className="w-full bg-white border border-slate-200 p-3 rounded-xl font-bold outline-none focus:border-indigo-300 focus:ring-4 ring-indigo-50" placeholder="0" />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={() => setTargetUser(null)} className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-xl uppercase tracking-widest text-xs transition-colors">Annulla</button>
                <button onClick={handleContribute} disabled={loading || !contributeForm.amount} className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 text-white font-black rounded-xl uppercase tracking-widest text-xs transition-colors disabled:opacity-50">Invia</button>
              </div>
            </motion.div>
          </div>
        )}

        {showEdit && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowEdit(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white p-8 rounded-[2.5rem] shadow-2xl overflow-hidden relative z-10 w-full max-w-md border border-slate-100 space-y-6">
              <h3 className="text-2xl font-black text-slate-900 leading-tight">Modifica Partito</h3>
              <div className="space-y-3">
                <input placeholder="Nome" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-700 focus:border-indigo-300 outline-none" />
                <input placeholder="Tag" value={editForm.tag} onChange={e => setEditForm({ ...editForm, tag: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-700 focus:border-indigo-300 outline-none" />
                <input placeholder="Ideologia" value={editForm.ideology} onChange={e => setEditForm({ ...editForm, ideology: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-700 focus:border-indigo-300 outline-none" />
                <textarea placeholder="Descrizione" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-700 focus:border-indigo-300 outline-none resize-none h-24" />
                <input placeholder="URL Logo" value={editForm.logo} onChange={e => setEditForm({ ...editForm, logo: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-700 focus:border-indigo-300 outline-none" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowEdit(false)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 font-black rounded-xl uppercase tracking-widest text-xs transition-colors">Annulla</button>
                <button onClick={handleEdit} disabled={loading} className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl uppercase tracking-widest text-xs transition-colors shadow-lg">Salva</button>
              </div>
            </motion.div>
          </div>
        )}

        {showInvite && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowInvite(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white p-8 rounded-[2.5rem] shadow-2xl relative z-10 w-full max-w-sm border border-slate-100 space-y-4">
              <h3 className="text-xl font-black text-slate-900 leading-tight">Invita Membro</h3>
              <p className="text-sm font-bold text-slate-500">Inserisci l'ID dell'utente da invitare:</p>
              <input placeholder="User ID" value={inviteId} onChange={e => setInviteId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-700 focus:border-indigo-300 outline-none" />
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowInvite(false)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 font-black rounded-xl uppercase tracking-widest text-xs">Annulla</button>
                <button onClick={handleInvite} className="flex-1 px-4 py-3 bg-indigo-600 text-white font-black rounded-xl uppercase tracking-widest text-xs shadow-md">Invia</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const PartyHub = ({ user, fetchData }: any) => {
  const navigate = useNavigate();
  const [partyData, setPartyData] = useState<any>(null);
  const [globalParties, setGlobalParties] = useState<any[]>([]);
  const [myInvites, setMyInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', ideology: '', tag: '', description: '', logo: '' });

  const loadContent = async () => {
    setLoading(true);
    try {
      const myRes = await fetch("/api/parties/my");
      if (myRes.ok) {
        setPartyData(await myRes.json());
      } else {
        const gp = await fetch("/api/parties");
        if (gp.ok) setGlobalParties(await gp.json());

        const inv = await fetch("/api/parties/my-invites");
        if (inv.ok) setMyInvites(await inv.json());
      }
    } catch {
      // no party
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadContent(); }, []);

  const handleCreate = async () => {
    if (!createForm.name) return alert("Nome obbligatorio");
    if (!window.confirm("Costicchia 100 Gold. Sei sicuro?")) return;
    try {
      const res = await fetch("/api/parties/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(createForm) });
      const data = await res.json();
      if (data.error) alert(data.error);
      else { alert("Partito creato!"); setShowCreate(false); fetchData(); loadContent(); }
    } catch { alert("Errore creazione"); }
  };

  const handleAcceptInvite = async (inviteId: string) => {
    try {
      const res = await fetch("/api/parties/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inviteId }) });
      const data = await res.json();
      if (data.error) alert(data.error);
      else { fetchData(); loadContent(); }
    } catch { alert("Errore"); }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;

  if (partyData && partyData.party) {
    const { party, members, activeMembersCount, primariesVoteCounts, hasVotedPrimaries } = partyData;
    const myRole = members.find((m: any) => m.userId === user.id)?.role;
    return <PartyDashboard party={party} members={members} activeMembersCount={activeMembersCount} myRole={myRole} user={user} reload={loadContent} fetchData={fetchData} primariesVoteCounts={primariesVoteCounts || {}} hasVotedPrimaries={!!hasVotedPrimaries} />;
  }

  if (showCreate) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black">Fonda un Partito</h2>
          <button onClick={() => setShowCreate(false)} className="text-slate-400 font-bold hover:text-slate-600 transition-colors bg-slate-50 px-3 py-1.5 rounded-lg text-sm">Annulla</button>
        </div>
        <p className="text-sm font-bold text-amber-600 bg-amber-50 p-4 rounded-xl border border-amber-100 leading-tight">Costo fondazione: 100 Gold. Sede Ufficiale: <span className="font-black">{user.residenceId || 'IT'}</span></p>

        <div className="grid gap-3">
          <input placeholder="Nome Partito *" value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-300 focus:ring-4 shadow-sm ring-indigo-50 outline-none p-3 block rounded-xl font-bold transition-all" />
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Tag (es. PLI)" value={createForm.tag} onChange={e => setCreateForm({ ...createForm, tag: e.target.value })} className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-300 focus:ring-4 shadow-sm ring-indigo-50 outline-none p-3 block rounded-xl font-bold transition-all" />
            <input placeholder="Ideologia" value={createForm.ideology} onChange={e => setCreateForm({ ...createForm, ideology: e.target.value })} className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-300 focus:ring-4 shadow-sm ring-indigo-50 outline-none p-3 block rounded-xl font-bold transition-all" />
          </div>
          <textarea placeholder="Descrizione del partito..." value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })} className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-300 focus:ring-4 shadow-sm ring-indigo-50 outline-none p-3 block rounded-xl font-bold transition-all h-24 resize-none" />
          <input placeholder="URL Logo (Opzionale)" value={createForm.logo} onChange={e => setCreateForm({ ...createForm, logo: e.target.value })} className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-300 focus:ring-4 shadow-sm ring-indigo-50 outline-none p-3 block rounded-xl font-bold transition-all" />
        </div>

        <button onClick={handleCreate} disabled={user.gold < 100} className="w-full py-4 text-white font-black tracking-widest uppercase rounded-2xl shadow-xl hover:scale-105 transition-all bg-indigo-600 shadow-indigo-200 disabled:opacity-50 disabled:hover:scale-100 mt-2">
          Fonda il Partito
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 border border-indigo-400 p-8 rounded-[2.5rem] shadow-xl text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6 overflow-hidden relative">
        <div className="absolute -right-8 -top-8 opacity-20 pointer-events-none"><Trophy className="w-48 h-48" /></div>
        <div className="relative z-10">
          <h2 className="text-3xl font-black tracking-tight leading-none mb-2">Politica Nazionale</h2>
          <p className="text-white/80 font-bold text-sm max-w-sm">Unisciti a un partito per partecipare alle elezioni parlamentari o fondane uno nuovo per guidare il tuo paese.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="relative z-10 bg-white text-indigo-600 px-8 py-4 rounded-2xl font-black shadow-2xl hover:scale-105 transition-all w-full md:w-auto uppercase tracking-widest text-[10px] shrink-0">Fonda Partito</button>
      </div>

      {myInvites.length > 0 && (
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-full blur-3xl pointer-events-none" />
          <h3 className="text-xl font-black tracking-tight text-slate-800 relative z-10">Inviti Pendenti</h3>
          <div className="grid gap-3 relative z-10">
            {myInvites.map(inv => (
              <div key={inv.id} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                  <p className="font-black text-slate-900 leading-tight">{inv.partyName}</p>
                  <p className="text-xs font-bold text-slate-400 mt-0.5">Invitato da <span className="text-indigo-500">{inv.inviterName}</span></p>
                </div>
                <button onClick={() => handleAcceptInvite(inv.id)} className="w-full md:w-auto bg-emerald-500 text-white px-5 py-2.5 font-black text-[10px] uppercase tracking-widest rounded-xl shadow-md hover:bg-emerald-600 hover:scale-105 transition-all shrink-0">Accetta</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
        <h3 className="text-xl font-black tracking-tight text-slate-800">Partiti Esistenti ({globalParties.length})</h3>
        <div className="grid gap-3">
          {globalParties.map((p, i) => (
            <div key={p.id} className="flex flex-col md:flex-row md:items-center gap-4 p-4 border border-slate-100 hover:border-indigo-100 bg-white hover:bg-indigo-50/30 rounded-2xl transition-all shadow-sm hover:shadow-md cursor-pointer group">
              <div className="flex items-center gap-4 flex-1">
                <span className="text-xl font-black text-slate-300 w-8 text-center group-hover:text-indigo-300 transition-colors">#{i + 1}</span>
                {p.logo ? <img src={p.logo} alt="logo" className="w-14 h-14 rounded-xl object-cover shadow-sm bg-white shrink-0" /> : <div className="w-14 h-14 bg-indigo-50 rounded-xl flex items-center justify-center font-black text-indigo-200 border border-indigo-100 shrink-0">{p.tag || "P"}</div>}
                <div>
                  <p className="font-black text-slate-900 text-[15px] leading-tight transition-colors group-hover:text-indigo-900">{p.name} {p.tag && <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[10px] ml-1.5 align-middle select-none">{p.tag}</span>}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase mt-1 tracking-wider"><span className="text-indigo-600">{p.memberCount} Membri</span> <span className="mx-1.5 text-slate-300">•</span> Leader: <span className="text-slate-700">{p.leaderName}</span></p>
                </div>
              </div>
              <div className="hidden md:flex shrink-0">
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
              </div>
            </div>
          ))}
          {globalParties.length === 0 && (
            <div className="p-10 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50">
              <p className="text-slate-400 font-bold mb-1">Nessun partito fondato finora.</p>
              <p className="text-sm text-slate-400 font-bold">Sii il primo a scendere in politica!</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ══════════════════════════════════════════════════════════════════

const ParliamentView = ({ user }: { user: any }) => {
  const [activeTab, setActiveTab] = useState<'elections' | 'parliament' | 'laws' | 'dictatorship'>('elections');
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);

  // Data
  const [electionData, setElectionData] = useState<any>(null);
  const [parliamentData, setParliamentData] = useState<any[]>([]);
  const [lawsData, setLawsData] = useState<any[]>([]);
  const [registry, setRegistry] = useState<any>(null);
  const [regionData, setRegionData] = useState<any>(null);

  const isDictatorship = regionData?.dictatorship === 1;

  const loadData = async (currentTab?: string) => {
    const tab = currentTab || activeTab;
    setLoading(true);
    try {
      // Always fetch region basic info for parliament configs (like dictatorship)
      let rData: any = regionData;
      if (user?.residenceId) {
        const rRes = await fetch(`/api/regions/${user.residenceId}`);
        if (rRes.ok) {
          rData = await rRes.json();
          setRegionData(rData);
        }
      }

      const dictMode = rData?.dictatorship === 1;

      if (!dictMode) {
        const pRes = await fetch("/api/parliament");
        if (pRes.ok) setParliamentData(await pRes.json());
      }

      if (tab === 'elections' && !dictMode) {
        const res = await fetch("/api/elections");
        if (res.ok) setElectionData(await res.json());
      } else if (tab === 'laws') {
        const res = await fetch("/api/parliament/laws");
        if (res.ok) {
          const lData = await res.json();
          setLawsData(lData.laws || []);
          setRegistry(lData.registry || null);
        }
      }
    } catch { }
    setLoading(false);
  };

  // Initial load: fetch region data and set correct initial tab
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        if (user?.residenceId) {
          const rRes = await fetch(`/api/regions/${user.residenceId}`);
          if (rRes.ok) {
            const rData = await rRes.json();
            setRegionData(rData);
            if (rData?.dictatorship === 1) {
              setActiveTab('dictatorship');
            }
          }
        }
      } catch { }
      setInitialLoad(false);
    };
    init();
  }, []);

  // Load data when tab changes (but not on initial load)
  useEffect(() => {
    if (!initialLoad) {
      loadData(activeTab);
    }
  }, [activeTab, initialLoad]);

  // Dictatorship view: only show dictator + economic minister
  const DictatorshipTab = () => (
    <div className="space-y-6">
      <div className="bg-rose-500 text-white p-6 rounded-3xl shadow-xl border border-rose-400 flex items-center gap-4">
        <Crown className="w-12 h-12 text-rose-200 shrink-0" />
        <div>
          <h3 className="text-xl font-black uppercase tracking-widest">Regime Dittatoriale</h3>
          <p className="font-bold text-rose-100 text-sm mt-1">Il parlamento è sospeso. Il Dittatore ha potere esecutivo e legislativo assoluto.</p>
        </div>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
        <h3 className="text-xl font-black text-slate-900">Cariche dello Stato</h3>
        <div className="grid gap-3">
          <div className="flex items-center justify-between p-4 bg-rose-50 rounded-2xl border border-rose-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
                <Crown className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <p className="font-black text-slate-900 text-sm">Dittatore</p>
                <p className="text-[10px] font-bold text-rose-500 uppercase mt-0.5">Potere assoluto</p>
              </div>
            </div>
            <span className="text-sm font-black text-slate-700">{regionData?.leaderName || regionData?.leader?.username || '—'}</span>
          </div>
          <div className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="font-black text-slate-900 text-sm">Ministro Economico</p>
                <p className="text-[10px] font-bold text-amber-500 uppercase mt-0.5">Gestione economica</p>
              </div>
            </div>
            <span className="text-sm font-black text-slate-700">{regionData?.economicAdviserName || '—'}</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 p-6 rounded-3xl border border-dashed border-slate-200 text-center">
        <p className="text-slate-400 font-bold italic text-sm">Le elezioni parlamentari sono sospese durante il regime dittatoriale.</p>
        <p className="text-[10px] text-slate-300 font-bold mt-1">Il Dittatore può emanare editti dalla sezione Leggi.</p>
      </div>
    </div>
  );

  const availableTabs = isDictatorship
    ? [{ id: 'dictatorship', label: 'Regime' }, { id: 'laws', label: 'Editti' }]
    : [{ id: 'elections', label: 'Elezioni' }, { id: 'parliament', label: 'Parlamento' }, { id: 'laws', label: 'Leggi' }];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="bg-white rounded-[2.5rem] p-2 flex gap-2 shadow-sm border border-slate-100 overflow-x-auto hide-scrollbar">
        {availableTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 min-w-[120px] py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === tab.id ? (isDictatorship ? "bg-rose-600 text-white shadow-lg shadow-rose-200" : "bg-indigo-600 text-white shadow-lg shadow-indigo-200") : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
      ) : (
        <>
          {activeTab === 'dictatorship' && <DictatorshipTab />}
          {activeTab === 'elections' && !isDictatorship && <ElectionsTab data={electionData} user={user} reload={() => loadData('elections')} />}
          {activeTab === 'parliament' && !isDictatorship && <ParliamentTab members={parliamentData} />}
          {activeTab === 'laws' && <LawsTab laws={lawsData} registry={registry} region={regionData} user={user} reload={() => loadData('laws')} isMp={isDictatorship || parliamentData.some(m => m.userId === user.id)} />}
        </>
      )}
    </motion.div>
  );
};

const ElectionsTab = ({ data, user, reload }: any) => {
  const [voting, setVoting] = useState(false);
  if (!data?.election) return (
    <div className="bg-white p-12 rounded-[2.5rem] border border-slate-100 text-center shadow-sm">
      <Trophy className="w-12 h-12 text-slate-300 mx-auto mb-4" />
      <h3 className="text-xl font-black text-slate-900">Nessuna Elezione</h3>
      <p className="text-slate-500 font-bold mt-2">Non ci sono elezioni attive al momento in {user.residenceId}.</p>
    </div>
  );

  const totalVotes = data.parties.reduce((sum: number, p: any) => sum + p.votes, 0);

  const handleVote = async (partyId: string) => {
    if (!window.confirm("Confermi il tuo voto? Non potrai cambiarlo!")) return;
    setVoting(true);
    try {
      const res = await fetch("/api/elections/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ electionId: data.election.id, partyId })
      });
      const json = await res.json();
      if (json.error) alert(json.error);
      else reload();
    } catch { alert("Errore di connessione"); }
    setVoting(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute -right-8 -top-8 opacity-5 pointer-events-none"><Landmark className="w-48 h-48" /></div>
        <div className="relative z-10">
          <h3 className="text-2xl font-black text-slate-900 leading-tight">Elezioni Parlamentari ({user.residenceId})</h3>
          <p className="text-slate-500 font-bold mt-2">Si chiudono il: {new Date(data.election.closesAt).toLocaleString()}</p>
        </div>
      </div>

      <div className="grid gap-4">
        {data.parties.sort((a: any, b: any) => b.votes - a.votes).map((p: any) => {
          const perc = totalVotes > 0 ? ((p.votes / totalVotes) * 100).toFixed(1) : 0;
          return (
            <div key={p.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="flex items-center gap-4 flex-1 w-full">
                {p.logo ? <img src={p.logo} alt="logo" className="w-16 h-16 rounded-2xl object-cover shadow-sm bg-white shrink-0" /> : <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center font-black text-xl text-indigo-300 border border-indigo-100 shrink-0">{p.tag || "P"}</div>}
                <div className="flex-1 w-full">
                  <p className="font-black text-slate-900 text-lg">{p.name} {p.tag && <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-md ml-2 align-middle">{p.tag}</span>}</p>
                  <div className="mt-2 w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-indigo-500 h-full transition-all duration-1000" style={{ width: `${perc}%` }} />
                  </div>
                  <p className="text-xs font-bold text-slate-500 mt-1">{p.votes} voti ({perc}%)</p>
                </div>
              </div>
              <button
                disabled={voting || data.myVote}
                onClick={() => handleVote(p.id)}
                className={`w-full md:w-auto px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all shrink-0 ${data.myVote === p.id ? "bg-emerald-500 text-white shadow-emerald-200 shadow-lg" : data.myVote ? "bg-slate-100 text-slate-400" : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 shadow-lg"}`}
              >
                {data.myVote === p.id ? "Hai Votato" : data.myVote ? "Già Votato" : "Vota"}
              </button>
            </div>
          );
        })}
        {data.parties.length === 0 && (
          <div className="text-center p-8 bg-slate-50 rounded-3xl border border-dashed border-slate-200 text-slate-400 font-bold">
            Nessun partito registrato in questa nazione.
          </div>
        )}
      </div>
    </div>
  );
};

const ParliamentTab = ({ members }: { members: any[] }) => {
  const parties = members.reduce((acc: any, m: any) => {
    if (!acc[m.partyName]) acc[m.partyName] = { count: 0, tag: m.partyTag, members: [] };
    acc[m.partyName].count++;
    acc[m.partyName].members.push(m);
    return acc;
  }, {});

  const total = members.length;

  return (
    <div className="space-y-6">
      {total === 0 ? (
        <div className="bg-white p-12 rounded-[2.5rem] border border-slate-100 text-center shadow-sm">
          <Landmark className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-black text-slate-900">Parlamento Vuoto</h3>
          <p className="text-slate-500 font-bold mt-2">Nessun membro eletto ancora.</p>
        </div>
      ) : (
        <>
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <h3 className="text-xl font-black text-slate-900 mb-6">Composizione Parlamentare ({total} Seggi)</h3>
            <div className="flex h-6 rounded-full overflow-hidden gap-0.5">
              {Object.entries(parties).map(([name, data]: any, i) => {
                const colors = ['bg-indigo-500', 'bg-rose-500', 'bg-emerald-500', 'bg-amber-500', 'bg-cyan-500', 'bg-purple-500'];
                return (
                  <div key={name} className={`${colors[i % colors.length]} h-full transition-all`} style={{ width: `${(data.count / total) * 100}%` }} title={`${name}: ${data.count} seggi`} />
                );
              })}
            </div>
            <div className="flex flex-wrap gap-4 mt-4">
              {Object.entries(parties).map(([name, data]: any, i) => {
                const colorsText = ['text-indigo-500', 'text-rose-500', 'text-emerald-500', 'text-amber-500', 'text-cyan-500', 'text-purple-500'];
                return (
                  <div key={name} className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${colorsText[i % colorsText.length].replace('text-', 'bg-')}`} />
                    <span className="text-xs font-bold text-slate-700">{data.tag || name} ({data.count})</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-xl font-black text-slate-900">Membri Eletti</h3>
            <div className="grid gap-3">
              {members.map(m => (
                <div key={m.userId} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-black">{m.username.charAt(0).toUpperCase()}</div>
                    <div>
                      <p className="font-black text-slate-900 text-sm">{m.username} <span className="text-[10px] font-bold text-slate-400 ml-1">Lv {m.level}</span></p>
                      <p className="text-[10px] font-bold text-indigo-500 uppercase mt-0.5">{m.partyName}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const LawsTab = ({ laws, registry, user, reload, isMp, region }: any) => {
  const [showPropose, setShowPropose] = useState(false);
  const [selectedLaw, setSelectedLaw] = useState<string | null>(null);
  const [paramsForm, setParamsForm] = useState<any>({});
  const [acting, setActing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [allRegions, setAllRegions] = useState<{ id: string; name: string }[]>([]);
  const [activeOutgoingAgreements, setActiveOutgoingAgreements] = useState<any[]>([]);

  useEffect(() => { setParamsForm({}); }, [selectedLaw]);

  useEffect(() => {
    fetch('/api/regions')
      .then(r => r.ok ? r.json() : [])
      .then((data: any[]) => {
        const list = (data || [])
          .filter((r: any) => r.id && r.id !== region?.id)
          .map((r: any) => ({ id: r.id, name: r.name || r.id }))
          .sort((a: any, b: any) => a.name.localeCompare(b.name));
        setAllRegions(list);
      })
      .catch(() => {});
  }, [region?.id]);

  useEffect(() => {
    if (!region?.id) return;
    fetch(`/api/countries/${region.id}/agreements`)
      .then(r => r.ok ? r.json() : { outgoing: [] })
      .then((data: any) => setActiveOutgoingAgreements(data?.outgoing || []))
      .catch(() => {});
  }, [region?.id]);

  const activeLaws = (laws || []).filter((l: any) => l.status === 'pending');
  const historyLaws = (laws || []).filter((l: any) => l.status !== 'pending');
  const displayLaws = showHistory ? historyLaws : activeLaws;

  const handleWithdraw = async (lawId: string) => {
    if (!window.confirm("Sei sicuro di voler ritirare questa proposta di legge? Verrà spostata nell'archivio storico.")) return;
    setActing(true);
    try {
      const res = await fetch("/api/parliament/laws/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lawId })
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else {
        reload();
      }
    } catch { alert("Errore di connessione"); }
    setActing(false);
  };

  // Group laws by category
  const categories = registry ? Object.entries(registry).reduce((acc: any, [key, law]: any) => {
    if (!acc[law.category]) acc[law.category] = [];
    acc[law.category].push({ id: key, ...law });
    return acc;
  }, {}) : {};

  const handlePropose = async () => {
    if (!selectedLaw) return;
    setActing(true);
    try {
      const res = await fetch("/api/parliament/laws/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: selectedLaw, params: paramsForm })
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else {
        setShowPropose(false);
        setSelectedLaw(null);
        setParamsForm({});
        if (data.immediate) alert("Come Dittatore, la legge è stata approvata ed eseguita immediatamente!");
        reload();
      }
    } catch { alert("Errore di connessione"); }
    setActing(false);
  };

  const handleVote = async (lawId: string, vote: 'yes' | 'no') => {
    setActing(true);
    try {
      const res = await fetch("/api/parliament/laws/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lawId, vote })
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else reload();
    } catch { alert("Errore di connessione"); }
    setActing(false);
  };

  const handlePass = async (lawId: string) => {
    if (!window.confirm("Sei un Ministro: vuoi approvare questa legge immediatamente (Fast-Pass)?")) return;
    setActing(true);
    try {
      const res = await fetch("/api/parliament/laws/pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lawId })
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else {
        alert("Legge approvata via Fast-Pass!");
        reload();
      }
    } catch { alert("Errore di connessione"); }
    setActing(false);
  };

  const isLeader = region?.ownerUserId === user.id;
  const isEconomicMinister = region?.economicAdviserId === user.id;
  const isForeignMinister = region?.foreignMinisterId === user.id;
  const canPropose = isMp || isLeader;

  return (
    <div className="space-y-6">
      {region?.dictatorship === 1 && (
        <div className="bg-rose-500 text-white p-6 rounded-3xl shadow-xl border border-rose-400 flex items-center gap-4">
          <Crown className="w-12 h-12 text-rose-200 shrink-0" />
          <div>
            <h3 className="text-xl font-black uppercase tracking-widest">Regime Dittatoriale</h3>
            <p className="font-bold text-rose-100 text-sm mt-1">Il parlamento è sospeso. Il Dittatore ha potere esecutivo e legislativo assoluto. Le leggi passano senza essere votate.</p>
          </div>
        </div>
      )}

      {canPropose && !showPropose && (
        <div className="flex justify-end">
          <button onClick={() => setShowPropose(true)} className={`${region?.dictatorship ? "bg-rose-600 hover:bg-rose-700 shadow-rose-200" : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"} text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg transition-all flex items-center gap-2`}>
            {region?.dictatorship ? <Crown className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {region?.dictatorship ? "Emana Editto" : "Proponi Legge"}
          </button>
        </div>
      )}

      {showPropose && (
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-xl space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-500" />

          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-black text-slate-900">{region?.dictatorship ? "Emana Nuovo Editto" : "Seleziona Proposta di Legge"}</h3>
            <button onClick={() => { setShowPropose(false); setSelectedLaw(null); }} className="text-slate-400 hover:text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors">Annulla</button>
          </div>

          {!selectedLaw ? (
            <div className="space-y-8">
              {Object.entries(categories).map(([catName, catLaws]: any) => (
                <div key={catName}>
                  <h4 className="text-sm font-black text-indigo-500 uppercase tracking-widest mb-3">{catName}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {catLaws.map((law: any) => (
                      <div key={law.id} onClick={() => setSelectedLaw(law.id)} className="p-4 border border-slate-200 hover:border-indigo-400 rounded-2xl cursor-pointer transition-all hover:shadow-md bg-white hover:bg-indigo-50/50 group flex gap-4 items-start">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 flex items-center justify-center shrink-0 transition-colors">
                          <BookOpen className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-black text-slate-800 text-sm group-hover:text-indigo-900">{law.title}</p>
                          <p className="text-xs font-bold text-slate-500 leading-tight mt-1">{law.description}</p>
                          <p className="text-[10px] uppercase font-black text-indigo-400 mt-2 tracking-widest">Soglia: {law.threshold * 100}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-black text-indigo-900">{registry[selectedLaw].title}</h4>
                  <p className="text-sm text-indigo-600/80 font-bold">{registry[selectedLaw].description}</p>
                </div>
                <button onClick={() => setSelectedLaw(null)} className="ml-auto text-xs font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-600">Cambia</button>
              </div>

              <div className="space-y-4">
                {/* Dynamically render inputs based on the selected law. In a real app we'd have a schema to generate these automatically. For now we hardcode a switch. */}
                {selectedLaw === 'change_market_tax' && (
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Nuova Tassa Mercato (%)</label>
                    <input type="number" min="0" max="100" placeholder="Es: 10" value={paramsForm.tax || ''} onChange={e => setParamsForm({ ...paramsForm, tax: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500" />
                  </div>
                )}
                {selectedLaw === 'change_salary_tax' && (
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Nuova Tassa Salari (%)</label>
                    <input type="number" min="0" max="100" placeholder="Es: 15" value={paramsForm.tax || ''} onChange={e => setParamsForm({ ...paramsForm, tax: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500" />
                  </div>
                )}
                {selectedLaw === 'change_state_name' && (
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Nuovo Nome Stato</label>
                    <input type="text" maxLength={22} placeholder="Es: Antigravitia" value={paramsForm.name || ''} onChange={e => setParamsForm({ ...paramsForm, name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500" />
                  </div>
                )}
                {selectedLaw === 'change_parliament_size' && (
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Numero Seggi Parlamentari</label>
                    <input type="number" min="10" max="100" placeholder="Es: 20" value={paramsForm.size || ''} onChange={e => setParamsForm({ ...paramsForm, size: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500" />
                  </div>
                )}
                {selectedLaw === 'change_parliament_duration' && (
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Durata Mandato (Giorni)</label>
                    <input type="number" min="3" max="30" placeholder="Es: 5" value={paramsForm.days || ''} onChange={e => setParamsForm({ ...paramsForm, days: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500" />
                  </div>
                )}
                {(selectedLaw === 'declare_war' || selectedLaw === 'peace_treaty' || selectedLaw === 'apply_sanctions' || selectedLaw === 'revoke_sanctions') && (
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">ID Nazione Bersaglio</label>
                    <input type="text" placeholder="Es: FR, DE, US..." value={paramsForm.targetRegionId || ''} onChange={e => setParamsForm({ ...paramsForm, targetRegionId: e.target.value.toUpperCase() })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500 uppercase" />
                  </div>
                )}
                {selectedLaw === 'migration_agreement' && (
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Nazione Bersaglio</label>
                    {(() => {
                      const existingTargets = new Set(activeOutgoingAgreements.map((a: any) => a.partnerId));
                      const available = allRegions.filter(r => !existingTargets.has(r.id));
                      return (
                        <select
                          value={paramsForm.targetRegionId || ''}
                          onChange={e => setParamsForm({ ...paramsForm, targetRegionId: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500"
                        >
                          <option value="">— Seleziona nazione —</option>
                          {available.map(r => (
                            <option key={r.id} value={r.id}>{r.name} ({r.id})</option>
                          ))}
                        </select>
                      );
                    })()}
                  </div>
                )}
                {selectedLaw === 'revoke_migration_agreement' && (
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Accordo da Annullare</label>
                    {activeOutgoingAgreements.length === 0 ? (
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-sm font-bold text-slate-400">Nessun accordo attivo da revocare.</div>
                    ) : (
                      <select
                        value={paramsForm.targetRegionId || ''}
                        onChange={e => setParamsForm({ ...paramsForm, targetRegionId: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500"
                      >
                        <option value="">— Seleziona accordo —</option>
                        {activeOutgoingAgreements.map((a: any) => (
                          <option key={a.partnerId} value={a.partnerId}>
                            {a.partnerName || a.partnerId} ({a.partnerId}) — {a.agreementType === 'BILATERAL' ? 'Bilaterale' : 'Unilaterale'}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
                {selectedLaw === 'transfer_budget' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">ID Nazione Destinataria</label>
                      <input type="text" placeholder="Es: FR, DE, US..." value={paramsForm.targetRegionId || ''} onChange={e => setParamsForm({ ...paramsForm, targetRegionId: e.target.value.toUpperCase() })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500 uppercase" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Importo da Inviare ($)</label>
                      <input type="number" min="1" placeholder="Es: 5000" value={paramsForm.amount || ''} onChange={e => setParamsForm({ ...paramsForm, amount: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500" />
                    </div>
                  </div>
                )}
                {/* Autonomy Laws */}
                {(selectedLaw === 'grant_autonomy' || selectedLaw === 'revoke_autonomy') && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">ID Regione Bersaglio</label>
                      <input type="text" placeholder="Es: IT-LOM, IT-SIC..." value={paramsForm.targetRegionId || ''} onChange={e => setParamsForm({ ...paramsForm, targetRegionId: e.target.value.toUpperCase() })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500 uppercase" />
                    </div>
                    {selectedLaw === 'grant_autonomy' && (
                      <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Quota Profitto Regionale (%)</label>
                        <input type="number" min="0" max="100" placeholder="Es: 30" value={paramsForm.profitShare || ''} onChange={e => setParamsForm({ ...paramsForm, profitShare: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500" />
                        <p className="text-[10px] font-bold text-slate-400 mt-1">La regione tratterrà questa % degli utili, il resto andrà allo Stato.</p>
                      </div>
                    )}
                  </div>
                )}
                {selectedLaw === 'change_profit_share' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">ID Regione Autonoma</label>
                      <input type="text" placeholder="Es: IT-LOM..." value={paramsForm.targetRegionId || ''} onChange={e => setParamsForm({ ...paramsForm, targetRegionId: e.target.value.toUpperCase() })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500 uppercase" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Nuova Quota Profitto Regionale (%)</label>
                      <input type="number" min="0" max="100" placeholder="Es: 40" value={paramsForm.profitShare || ''} onChange={e => setParamsForm({ ...paramsForm, profitShare: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500" />
                    </div>
                  </div>
                )}
                {(selectedLaw === 'change_worker_tax' || selectedLaw === 'change_industry_tax') && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Nuova Aliquota (%)</label>
                      <input type="number" min="0" max="100" placeholder="Es: 15" value={paramsForm.tax || ''} onChange={e => setParamsForm({ ...paramsForm, tax: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">ID Regione (opzionale, default: la tua)</label>
                      <input type="text" placeholder="Es: IT-LOM..." value={paramsForm.targetRegionId || ''} onChange={e => setParamsForm({ ...paramsForm, targetRegionId: e.target.value.toUpperCase() })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500 uppercase" />
                    </div>
                  </div>
                )}
                {selectedLaw === 'build_regional_building' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Tipo Edificio</label>
                      <select value={paramsForm.buildingType || ''} onChange={e => setParamsForm({ ...paramsForm, buildingType: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500">
                        <option value="">Seleziona...</option>
                        <option value="hospital">🏥 Ospedale</option>
                        <option value="military_base">🏛️ Base Militare</option>
                        <option value="school">🏫 Scuola</option>
                        <option value="military_academy">🎖️ Accademia Militare</option>
                        <option value="missile_system">🚀 Sistema Missilistico</option>
                        <option value="airport">✈️ Aeroporto</option>
                        <option value="naval_port">⚓ Porto Navale</option>
                        <option value="space_port">🛸 Porto Spaziale</option>
                        <option value="real_estate_fund">🏘️ Fondo Immobiliare</option>
                        <option value="power_plant">⚡ Centrale Elettrica</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">ID Regione Bersaglio (opzionale)</label>
                      <input type="text" placeholder="Es: IT-LOM..." value={paramsForm.targetRegionId || ''} onChange={e => setParamsForm({ ...paramsForm, targetRegionId: e.target.value.toUpperCase() })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500 uppercase" />
                    </div>
                  </div>
                )}
                {selectedLaw === 'assign_governor' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">ID Regione Autonoma</label>
                      <input type="text" placeholder="Es: IT-LOM..." value={paramsForm.targetRegionId || ''} onChange={e => setParamsForm({ ...paramsForm, targetRegionId: e.target.value.toUpperCase() })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500 uppercase" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">ID Utente Governatore</label>
                      <input type="text" placeholder="UUID del giocatore" value={paramsForm.governorUserId || ''} onChange={e => setParamsForm({ ...paramsForm, governorUserId: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500" />
                    </div>
                  </div>
                )}
                {/* Fallback for laws with no params like proclaim_dictatorship */}
                {['change_market_tax', 'change_salary_tax', 'change_state_name', 'change_parliament_size', 'change_parliament_duration', 'transfer_budget', 'declare_war', 'peace_treaty', 'migration_agreement', 'revoke_migration_agreement', 'apply_sanctions', 'revoke_sanctions', 'grant_autonomy', 'revoke_autonomy', 'change_profit_share', 'change_worker_tax', 'change_industry_tax', 'build_regional_building', 'assign_governor'].indexOf(selectedLaw) === -1 && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-sm font-bold text-slate-500">
                    Questa legge non richiede parametri aggiuntivi.
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button onClick={() => setShowPropose(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-xl text-xs uppercase tracking-widest hover:bg-slate-200 transition-colors">Annulla</button>
                <button
                  disabled={acting || ((selectedLaw === 'migration_agreement' || selectedLaw === 'revoke_migration_agreement') && !paramsForm.targetRegionId)}
                  onClick={handlePropose}
                  className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {region?.dictatorship ? "Emanala Ora" : "Deposita in Parlamento"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4">
        <div className="flex items-center justify-between ml-2">
          <h3 className="text-xl font-black text-slate-900">{showHistory ? "Archivio Storico" : "Proposte in Votazione"}</h3>
          <button onClick={() => setShowHistory(!showHistory)} className="text-xs font-bold text-indigo-500 hover:text-indigo-700 uppercase tracking-widest bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors border border-indigo-100">
            {showHistory ? "Mostra Attive" : "Vai all'Archivio"}
          </button>
        </div>
        {displayLaws.length === 0 && (
          <div className="text-center p-8 bg-white rounded-3xl border border-slate-100 text-slate-400 font-bold shadow-sm">
            {showHistory ? "Nessuna legge in archivio." : "Nessuna proposta in votazione."}
          </div>
        )}
        {displayLaws.map((l: any) => {
          const lawDef = registry && registry[l.type];
          const defaultTitle = lawDef ? lawDef.title : l.type;

          let paramsDesc = "";
          try {
            const p = l.params ? JSON.parse(l.params) : { newValue: l.newValue };
            if (p.tax !== undefined) paramsDesc = `${p.tax}%`;
            if (p.name !== undefined) paramsDesc = `"${p.name}"`;
            if (p.newValue !== undefined && !l.params) paramsDesc = `${p.newValue}`; // fallback per vecchie leggi
          } catch { }

          // Minister fast-pass logic
          const canEconomicPass = isEconomicMinister && lawDef?.category === 'Economy';
          const canForeignPass = isForeignMinister && (lawDef?.category === 'Diplomacy' || lawDef?.category === 'Residency');
          const canFastPass = canEconomicPass || canForeignPass;

          return (
            <div key={l.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-6 hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 shrink-0 hidden md:flex">
                <BookOpen className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center flex-wrap gap-2 mb-2">
                  <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider ${l.status === 'pending' ? 'bg-amber-100 text-amber-700' : l.status === 'passed' ? 'bg-emerald-100 text-emerald-700' : l.status === 'withdrawn' ? 'bg-slate-100 text-slate-600' : 'bg-rose-100 text-rose-700'}`}>
                    {l.status === 'pending' ? 'In Votazione' : l.status === 'passed' ? 'Approvata' : l.status === 'withdrawn' ? 'Ritirata' : 'Respinta'}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">{new Date(l.createdAt).toLocaleString()}</span>
                </div>
                <h4 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  {defaultTitle} {paramsDesc && <span className="text-indigo-600 bg-indigo-50 px-2 rounded-md text-sm">{paramsDesc}</span>}
                </h4>
                <p className="text-sm font-bold text-slate-500 mt-1">Proposta da <span className="text-indigo-500">{l.proposerName}</span></p>

                <div className="flex items-center flex-wrap gap-4 mt-4 text-xs font-black w-full">
                  <span className="text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg flex items-center gap-1 border border-emerald-100"><CheckCircle2 className="w-4 h-4" /> {l.yesVotes}</span>
                  <span className="text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg flex items-center gap-1 border border-rose-100"><Trash2 className="w-4 h-4" /> {l.noVotes}</span>
                  {l.status === 'pending' && l.proposerId === user?.id && (
                    <button disabled={acting} onClick={() => handleWithdraw(l.id)} className="ml-auto text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100 transition-colors flex items-center gap-1 shrink-0"><Trash2 className="w-4 h-4" /> Ritira</button>
                  )}
                  {l.status === 'pending' && canFastPass && (
                    <button disabled={acting} onClick={() => handlePass(l.id)} className="ml-auto bg-amber-500 text-white px-3 py-1.5 rounded-lg font-black uppercase tracking-widest text-[10px] shadow-md shadow-amber-100 hover:bg-amber-600 transition-all flex items-center gap-1 shrink-0">
                      <Zap className="w-3 h-3" /> Fast-Pass
                    </button>
                  )}
                </div>
              </div>

              {l.status === 'pending' && isMp && !l.myVote && !region?.dictatorship && (
                <div className="flex flex-col gap-2 shrink-0 md:justify-center">
                  <button disabled={acting} onClick={() => handleVote(l.id, 'yes')} className="bg-emerald-500 text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all">SÌ</button>
                  <button disabled={acting} onClick={() => handleVote(l.id, 'no')} className="bg-rose-500 text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-200 hover:bg-rose-600 transition-all">NO</button>
                </div>
              )}
              {l.status === 'pending' && l.myVote && (
                <div className="flex items-center justify-center shrink-0">
                  <span className="text-sm font-black text-slate-400 bg-slate-50 px-4 py-2 border border-slate-100 rounded-xl">Hai votato '{l.myVote.vote}'</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

