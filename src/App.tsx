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
import { PartyHub } from './components/party';
import { ParliamentView } from './components/parliament';

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

