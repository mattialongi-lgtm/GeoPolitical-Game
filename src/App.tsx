/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Globe, 
  User as UserIcon, 
  TrendingUp, 
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
  Info,
  Plus,
  Trash2,
  Edit2,
  Clock,
  Heart
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ComposableMap, 
  Geographies, 
  Geography, 
  ZoomableGroup 
} from "react-simple-maps";
import { User, Region, GAME_CONFIG, PERKS_DEFS, Article, Factory, War } from "./types";
import { auth, googleProvider, isFirebaseConfigured } from "./lib/firebase";
import { signInWithPopup } from "firebase/auth";

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// --- Components ---

const BottomNav = ({ currentView, setView }: { currentView: string, setView: (v: any) => void }) => {
  const tabs = [
    { id: "home", label: "Home", icon: Home },
    { id: "articles", label: "Articoli", icon: FileText },
    { id: "work", label: "Lavoro", icon: Briefcase },
    { id: "wars", label: "Guerre", icon: Swords },
    { id: "profile", label: "Profilo", icon: UserIcon },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-6 py-3 flex justify-between items-center z-50 pb-safe">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentView === tab.id || 
                         (tab.id === "articles" && (currentView === "article-new" || currentView === "article-detail")) ||
                         (tab.id === "home" && currentView === "country-detail");
        return (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            className={`flex flex-col items-center gap-1 transition-all ${isActive ? "text-indigo-600 scale-110" : "text-slate-400 hover:text-slate-600"}`}
          >
            <Icon className={`w-6 h-6 ${isActive ? "fill-indigo-50" : ""}`} />
            <span className="text-[10px] font-black uppercase tracking-tighter">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

const WorldMap = ({ onRegionClick, regions }: { onRegionClick: (id: string) => void, regions: Region[] }) => {
  return (
    <div className="bg-slate-900 rounded-[2.5rem] p-4 shadow-xl border border-slate-800 overflow-hidden relative min-h-[300px]">
      <div className="flex justify-between items-center mb-4 px-2">
        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Mappa Geopolitica</h4>
        <div className="flex gap-2">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
            <span className="text-[8px] font-bold text-slate-500 uppercase">Occupato</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-slate-700 rounded-full"></div>
            <span className="text-[8px] font-bold text-slate-500 uppercase">Neutrale</span>
          </div>
        </div>
      </div>
      
      <div className="w-full h-full">
        <ComposableMap projectionConfig={{ scale: 140 }}>
          <ZoomableGroup center={[0, 20]} zoom={1}>
            <Geographies geography={geoUrl}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const iso2 = geo.properties.ISO_A2;
                  const region = regions.find(r => r.id === iso2);
                  const isOwned = region && region.ownerId;
                  
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onClick={() => iso2 && onRegionClick(iso2)}
                      style={{
                        default: {
                          fill: isOwned ? "#6366f1" : "#334155",
                          outline: "none",
                          stroke: "#1e293b",
                          strokeWidth: 0.5
                        },
                        hover: {
                          fill: "#4f46e5",
                          outline: "none",
                          cursor: "pointer",
                          stroke: "#6366f1",
                          strokeWidth: 1
                        },
                        pressed: {
                          fill: "#4338ca",
                          outline: "none"
                        }
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>
      </div>
      
      <div className="absolute bottom-4 right-6 pointer-events-none">
        <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Mappa Interattiva • ISO-A2</p>
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, color, subValue }: { icon: any, label: string, value: string | number, color: string, subValue?: string }) => (
  <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-4">
    <div className={`p-3 rounded-2xl ${color} shadow-lg shadow-current/10`}>
      <Icon className="w-5 h-5 text-white" />
    </div>
    <div>
      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{label}</p>
      <p className="text-xl font-black text-slate-900 leading-none mt-1">{value}</p>
      {subValue && <p className="text-[10px] font-bold text-slate-400 mt-1">{subValue}</p>}
    </div>
  </div>
);

const Auth = ({ onLogin }: { onLogin: () => void }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const endpoint = isLogin ? "/api/login" : "/api/register";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success) onLogin();
      else setError(data.error || "Something went wrong");
    } catch (err) {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!auth || !isFirebaseConfigured) {
      setError("Firebase non configurato. Imposta le chiavi nei segreti.");
      return;
    }
    setError("");
    setGoogleLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      
      const res = await fetch("/api/auth/firebase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      
      const data = await res.json();
      if (data.success) onLogin();
      else setError(data.error || "Authentication failed");
    } catch (err: any) {
      if (err.code === "auth/popup-closed-by-user") {
        setError("Login cancelled");
      } else {
        setError("Google login failed. Try again.");
      }
      console.error(err);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-[2rem] shadow-2xl shadow-slate-200/50 border border-slate-100"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-200 mb-4">
              <Globe className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Territorial</h1>
            <p className="text-slate-400 text-sm font-medium mt-1">
              {isLogin ? "Bentornato, Comandante" : "Inizia la tua ascesa"}
            </p>
          </div>
          
          <div className="space-y-4">
            {isFirebaseConfigured && (
              <>
                <button 
                  onClick={handleGoogleLogin}
                  disabled={googleLoading || loading}
                  className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 py-3 rounded-2xl font-bold text-slate-700 hover:bg-slate-50 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {googleLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                  ) : (
                    <>
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      Continua con Google
                    </>
                  )}
                </button>

                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-slate-100"></div>
                  <span className="flex-shrink mx-4 text-slate-300 text-[10px] font-black uppercase tracking-widest">Oppure</span>
                  <div className="flex-grow border-t border-slate-100"></div>
                </div>
              </>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Username</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input 
                    type="text" 
                    value={username} 
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-300"
                    placeholder="Il tuo nome"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input 
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-300"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
              
              {error && (
                <motion.p 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-rose-500 text-xs font-bold ml-1"
                >
                  {error}
                </motion.p>
              )}

              <button 
                type="submit" 
                disabled={loading || googleLoading}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-[0.98] flex items-center justify-center gap-2 group disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {isLogin ? "Accedi" : "Crea Account"}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>
          
          <div className="mt-8 text-center">
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors"
            >
              {isLogin ? "Non hai un account? Registrati" : "Hai già un account? Accedi"}
            </button>
          </div>
        </motion.div>
        
        <p className="mt-8 text-center text-[10px] text-slate-300 font-bold uppercase tracking-[0.2em]">
          Territorial &copy; 2026 • Geopolitical MVP
        </p>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<(User & { perks: Record<string, number>, maxEnergy: number }) | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [factories, setFactories] = useState<(Factory & { remainingCooldown: number })[]>([]);
  const [wars, setWars] = useState<{ active: War[], ended: War[] }>({ active: [], ended: [] });
  const [currentView, setCurrentView] = useState<"home" | "articles" | "work" | "wars" | "profile" | "article-new" | "article-detail" | "country-detail">("home");
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = async () => {
    try {
      const [userRes, regionsRes, articlesRes, factoriesRes, warsRes] = await Promise.all([
        fetch("/api/me"),
        fetch("/api/regions"),
        fetch("/api/articles"),
        fetch("/api/factories"),
        fetch("/api/wars")
      ]);
      if (userRes.ok) {
        const userData = await userRes.json();
        setUser(userData);
      } else {
        setUser(null);
      }
      if (regionsRes.ok) setRegions(await regionsRes.json());
      if (articlesRes.ok) setArticles(await articlesRes.json());
      if (factoriesRes.ok) setFactories(await factoriesRes.json());
      if (warsRes.ok) setWars(await warsRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Polling every 10s
    return () => clearInterval(interval);
  }, []);

  const navigateToCountry = (iso2: string) => {
    setSelectedRegionId(iso2);
    setCurrentView("country-detail");
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
    await fetch("/api/logout", { method: "POST" });
    setUser(null);
  };

  const handleUpgradePerk = async (perkId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/profile/upgrade-perk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perkId }),
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else fetchData();
    } catch (err) {
      alert("Upgrade failed");
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <span className="font-black text-xl tracking-tight">Territorial</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-slate-50 px-3 py-1.5 rounded-2xl border border-slate-100 flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-black text-slate-600 uppercase tracking-tighter">Lvl {user.level}</span>
          </div>
          <button onClick={handleLogout} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto p-6">
        <AnimatePresence mode="wait">
          {currentView === "country-detail" ? (
            <motion.div 
              key="country-detail"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              <button 
                onClick={() => setCurrentView("home")}
                className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1"
              >
                ← Torna alla Mappa
              </button>

              {!selectedRegion ? (
                <div className="bg-white p-12 rounded-[2.5rem] text-center border border-slate-100">
                  <Globe className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                  <h2 className="text-2xl font-black text-slate-900">Paese non trovato</h2>
                  <p className="text-slate-400 mt-2">L'ISO2 "{selectedRegionId}" non corrisponde a nessuna regione registrata.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                    <div className="flex justify-between items-start mb-8">
                      <div>
                        <h2 className="text-4xl font-black text-slate-900 tracking-tight">{selectedRegion.name}</h2>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-400 px-2 py-1 rounded-lg">ISO: {selectedRegion.id}</span>
                          <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${selectedRegion.ownerId ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-400"}`}>
                            {selectedRegion.ownerName ? `Occupato da ${selectedRegion.ownerName}` : "Territorio Neutrale"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-4 rounded-3xl">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Popolazione</p>
                        <p className="text-xl font-black">{(selectedRegion.population / 1000000).toFixed(1)}M</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-3xl">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Stabilità</p>
                        <p className="text-xl font-black">{selectedRegion.stability}%</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-4">
                    <h3 className="text-lg font-black uppercase tracking-tight">Statistiche</h3>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="flex justify-between items-center py-2 border-b border-slate-50">
                        <span className="text-xs font-bold text-slate-400 uppercase">Risorse</span>
                        <span className="font-black text-slate-900">{selectedRegion.resources}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-50">
                        <span className="text-xs font-bold text-slate-400 uppercase">Tasse</span>
                        <span className="font-black text-slate-900">{selectedRegion.taxes || 5}%</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-xs font-bold text-slate-400 uppercase">Livello Sviluppo</span>
                        <span className="font-black text-slate-900">Tier {Math.floor(selectedRegion.population / 50000000) + 1}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-4">
                    <h3 className="text-lg font-black uppercase tracking-tight">Azioni Regionali</h3>
                    <div className="grid grid-cols-1 gap-3">
                      <button 
                        onClick={() => handleAction("invest", { regionId: selectedRegion.id })}
                        disabled={actionLoading || user.money < GAME_CONFIG.INVEST_MONEY_COST}
                        className="flex items-center justify-between p-5 rounded-3xl bg-emerald-50 border border-emerald-100 group hover:bg-emerald-100 transition-all disabled:opacity-50"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-white rounded-2xl shadow-sm">
                            <TrendingUp className="w-5 h-5 text-emerald-600" />
                          </div>
                          <div className="text-left">
                            <p className="font-black text-emerald-900 leading-none">Investi</p>
                            <p className="text-[10px] font-bold text-emerald-600 mt-1 uppercase">Sviluppa l'economia</p>
                          </div>
                        </div>
                        <span className="font-black text-emerald-700">-${GAME_CONFIG.INVEST_MONEY_COST}</span>
                      </button>

                      <button 
                        onClick={() => handleAction("attack", { regionId: selectedRegion.id })}
                        disabled={actionLoading || user.energy < GAME_CONFIG.ATTACK_ENERGY_COST}
                        className="flex items-center justify-between p-5 rounded-3xl bg-rose-50 border border-rose-100 group hover:bg-rose-100 transition-all disabled:opacity-50"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-white rounded-2xl shadow-sm">
                            <Shield className="w-5 h-5 text-rose-600" />
                          </div>
                          <div className="text-left">
                            <p className="font-black text-rose-900 leading-none">Attacca</p>
                            <p className="text-[10px] font-bold text-rose-600 mt-1 uppercase">Tenta la conquista</p>
                          </div>
                        </div>
                        <span className="font-black text-rose-700">-{GAME_CONFIG.ATTACK_ENERGY_COST}⚡</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ) : currentView === "home" ? (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-2 gap-4">
                <StatCard icon={DollarSign} label="Tesoro" value={`$${user.money.toLocaleString()}`} color="bg-emerald-500" />
                <StatCard icon={Zap} label="Energia" value={`${user.energy}/${user.maxEnergy}`} color="bg-amber-500" subValue={`Regen: +${GAME_CONFIG.ENERGY_REGEN_RATE + (user.perks['regen_boost'] || 0) * 5}/h`} />
                <StatCard icon={TrendingUp} label="Influenza" value={user.influence} color="bg-indigo-500" />
                <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-100">
                    <Globe className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Regione</p>
                    <p className="text-xl font-black text-slate-900 leading-none mt-1">{user.regionId}</p>
                  </div>
                </div>
              </div>

              <WorldMap onRegionClick={navigateToCountry} regions={regions} />

              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-black tracking-tight uppercase">Regioni nel Mondo</h3>
                  <div className="flex gap-2">
                    <button className="p-2 bg-white rounded-xl border border-slate-100 shadow-sm"><Trophy className="w-4 h-4 text-amber-500" /></button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {regions.slice(0, 10).map(region => (
                    <button 
                      key={region.id} 
                      onClick={() => navigateToCountry(region.id)}
                      className="flex items-center justify-between p-5 bg-white rounded-3xl border border-slate-100 shadow-sm hover:border-indigo-600 transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center font-black text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                          {region.id}
                        </div>
                        <div className="text-left">
                          <p className="font-black text-slate-900 leading-none">{region.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Stabilità: {region.stability}% • Pop: {(region.population / 1000000).toFixed(1)}M</p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : currentView === "profile" ? (
            <motion.div 
              key="profile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 text-center">
                <div className="w-24 h-24 bg-indigo-100 rounded-[2rem] mx-auto flex items-center justify-center mb-4 relative">
                  <UserIcon className="w-12 h-12 text-indigo-600" />
                  <div className="absolute -bottom-2 -right-2 bg-indigo-600 text-white w-10 h-10 rounded-2xl flex items-center justify-center font-black border-4 border-white">
                    {user.level}
                  </div>
                </div>
                <h2 className="text-2xl font-black text-slate-900">{user.username}</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Comandante di Livello {user.level}</p>
                
                <div className="mt-6 space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 px-1">
                    <span>Esperienza (XP)</span>
                    <span>{user.xp} / {Math.floor(GAME_CONFIG.LEVEL_UP_BASE_XP * Math.pow(GAME_CONFIG.LEVEL_UP_FACTOR, user.level - 1))}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full transition-all duration-1000" 
                      style={{ width: `${(user.xp / Math.floor(GAME_CONFIG.LEVEL_UP_BASE_XP * Math.pow(GAME_CONFIG.LEVEL_UP_FACTOR, user.level - 1))) * 100}%` }}
                    ></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-8">
                  <div className="p-4 bg-indigo-50 rounded-3xl">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Perk Points</p>
                    <p className="text-2xl font-black text-indigo-600">{user.perkPoints}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-3xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Regione</p>
                    <p className="text-2xl font-black text-slate-900">{user.regionId}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                <h3 className="text-xl font-black tracking-tight uppercase mb-6">Classifica Mondiale</h3>
                <Leaderboard />
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-black tracking-tight uppercase">Perks & Potenziamenti</h3>
                <div className="grid grid-cols-1 gap-4">
                  {PERKS_DEFS.map(perk => {
                    const currentLevel = user.perks[perk.id] || 0;
                    const cost = 1 + currentLevel;
                    const canAfford = user.perkPoints >= cost;
                    return (
                      <div key={perk.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-black text-slate-900">{perk.name}</h4>
                            <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg">Lv {currentLevel}</span>
                          </div>
                          <p className="text-xs text-slate-400 font-medium leading-tight">{perk.description}</p>
                        </div>
                        <button 
                          onClick={() => handleUpgradePerk(perk.id)}
                          disabled={actionLoading || !canAfford}
                          className={`px-4 py-3 rounded-2xl transition-all flex flex-col items-center gap-1 ${canAfford ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100 hover:scale-105" : "bg-slate-100 text-slate-400"}`}
                        >
                          <ChevronUp className="w-5 h-5" />
                          <span className="text-[10px] font-black">{cost} Punti</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          ) : currentView === "work" ? (
            <motion.div 
              key="work"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Mercato del Lavoro</h2>
                <div className="bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span className="font-black text-slate-700">{user.energy}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                {factories.map(factory => {
                  const isLocked = user.level < factory.minLevel;
                  const onCooldown = factory.remainingCooldown > 0;
                  const energyEfficiency = (user.perks['energy_efficiency'] || 0) * 0.05;
                  const actualEnergyCost = Math.ceil(factory.energyCost * (1 - energyEfficiency));

                  return (
                    <div key={factory.id} className={`bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-6 ${isLocked ? "opacity-60 grayscale" : ""}`}>
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center">
                          <Briefcase className="w-8 h-8 text-slate-400" />
                        </div>
                        <div className="text-left">
                          <h3 className="text-lg font-black text-slate-900">{factory.name}</h3>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{factory.type} • Livello Min: {factory.minLevel}</p>
                          <div className="flex gap-3 mt-2">
                            <span className="text-xs font-black text-emerald-600">+${factory.payoutMoney}</span>
                            <span className="text-xs font-black text-amber-600">-{actualEnergyCost}⚡</span>
                          </div>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => !isLocked && !onCooldown && handleAction("work", { factoryId: factory.id })}
                        disabled={actionLoading || isLocked || onCooldown || user.energy < actualEnergyCost}
                        className={`w-full sm:w-auto px-8 py-4 rounded-2xl font-black text-sm transition-all active:scale-95 disabled:opacity-50 ${onCooldown ? "bg-slate-100 text-slate-400" : "bg-indigo-600 text-white shadow-xl shadow-indigo-100 hover:bg-indigo-700"}`}
                      >
                        {onCooldown ? (
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            {Math.ceil(factory.remainingCooldown / 1000)}s
                          </div>
                        ) : isLocked ? (
                          "Bloccato"
                        ) : (
                          "Lavora"
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ) : currentView === "wars" ? (
            <motion.div 
              key="wars"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 text-center">
                <div className="w-20 h-20 bg-rose-100 rounded-3xl mx-auto flex items-center justify-center mb-4">
                  <Swords className="w-10 h-10 text-rose-600" />
                </div>
                <h2 className="text-2xl font-black text-slate-900">Ministero della Guerra</h2>
                <p className="text-slate-400 text-sm font-medium mt-1">Conflitti globali e conquiste territoriali.</p>
              </div>

              {wars.active.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-black uppercase tracking-tight">Guerre in Corso</h3>
                  <div className="grid grid-cols-1 gap-4">
                    {wars.active.map(war => (
                      <div key={war.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-rose-100">
                        <div className="flex justify-between items-center mb-4">
                          <div className="text-center flex-1">
                            <p className="text-2xl font-black">{war.attackerCountryIso2}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Attaccante</p>
                          </div>
                          <div className="px-4 font-black text-rose-600">VS</div>
                          <div className="text-center flex-1">
                            <p className="text-2xl font-black">{war.defenderCountryIso2}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Difensore</p>
                          </div>
                        </div>
                        <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden flex">
                          <div className="bg-indigo-500 h-full transition-all duration-500" style={{ width: `${(war.attackerScore / (war.attackerScore + war.defenderScore || 1)) * 100}%` }}></div>
                          <div className="bg-rose-500 h-full transition-all duration-500" style={{ width: `${(war.defenderScore / (war.attackerScore + war.defenderScore || 1)) * 100}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-lg font-black uppercase tracking-tight">Storico Recente</h3>
                <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                  {wars.ended.map((war, i) => (
                    <div key={war.id} className={`p-4 flex justify-between items-center ${i !== wars.ended.length - 1 ? "border-b border-slate-50" : ""}`}>
                      <div className="flex items-center gap-3">
                        <span className="font-black text-slate-900">{war.attackerCountryIso2}</span>
                        <ArrowRight className="w-3 h-3 text-slate-300" />
                        <span className="font-black text-slate-900">{war.defenderCountryIso2}</span>
                      </div>
                      <div className="text-right">
                        <p className={`text-xs font-black uppercase ${war.attackerScore > war.defenderScore ? "text-emerald-600" : "text-rose-600"}`}>
                          {war.attackerScore > war.defenderScore ? "Vittoria" : "Sconfitta"}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold">{new Date(war.endsAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                  {wars.ended.length === 0 && (
                    <div className="p-8 text-center text-slate-400 font-medium">Nessuna guerra terminata di recente.</div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : currentView === "articles" ? (
            <motion.div 
              key="articles"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Notiziario Globale</h2>
                <button 
                  onClick={() => setCurrentView("article-new")}
                  className="bg-indigo-600 text-white p-3 rounded-2xl shadow-lg shadow-indigo-100 hover:scale-105 transition-all"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                {articles.map(article => (
                  <button 
                    key={article.id}
                    onClick={() => { setSelectedArticleId(article.id); setCurrentView("article-detail"); }}
                    className="w-full bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 text-left hover:border-indigo-600 transition-all group"
                  >
                    <h3 className="text-lg font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{article.title}</h3>
                    <p className="text-slate-500 text-sm mt-2 line-clamp-2 leading-relaxed">{article.content}</p>
                    <div className="flex justify-between items-center mt-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center">
                          <UserIcon className="w-3 h-3 text-slate-400" />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase">{article.authorName}</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-300 uppercase">{new Date(article.createdAt).toLocaleDateString()}</span>
                    </div>
                  </button>
                ))}
                {articles.length === 0 && (
                  <div className="bg-white p-12 rounded-[2.5rem] text-center text-slate-400 font-medium border border-dashed border-slate-200">
                    Nessun articolo pubblicato. Sii il primo!
                  </div>
                )}
              </div>
            </motion.div>
          ) : currentView === "article-new" ? (
            <motion.div 
              key="article-new"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <button 
                onClick={() => setCurrentView("articles")}
                className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1"
              >
                ← Annulla
              </button>
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
                <h2 className="text-2xl font-black text-slate-900">Nuovo Articolo</h2>
                <div className="space-y-4">
                  <input 
                    type="text" 
                    placeholder="Titolo dell'articolo"
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all font-black text-slate-900"
                    id="article-title"
                  />
                  <textarea 
                    placeholder="Contenuto dell'articolo..."
                    rows={8}
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all font-medium text-slate-700 leading-relaxed"
                    id="article-content"
                  />
                  <button 
                    onClick={async () => {
                      const title = (document.getElementById("article-title") as HTMLInputElement).value;
                      const content = (document.getElementById("article-content") as HTMLTextAreaElement).value;
                      if (!title || !content) return alert("Compila tutti i campi");
                      
                      setActionLoading(true);
                      try {
                        const res = await fetch("/api/articles", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ title, content }),
                        });
                        if (res.ok) {
                          fetchData();
                          setCurrentView("articles");
                        } else {
                          const data = await res.json();
                          alert(data.error);
                        }
                      } catch (err) {
                        alert("Errore di connessione");
                      } finally {
                        setActionLoading(false);
                      }
                    }}
                    disabled={actionLoading}
                    className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : "Pubblica Articolo"}
                  </button>
                </div>
              </div>
            </motion.div>
          ) : currentView === "article-detail" ? (
            <motion.div 
              key="article-detail"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <button 
                onClick={() => setCurrentView("articles")}
                className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1"
              >
                ← Torna al Feed
              </button>
              {articles.find(a => a.id === selectedArticleId) && (
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 leading-tight">{articles.find(a => a.id === selectedArticleId)?.title}</h2>
                    <div className="flex items-center gap-3 mt-4">
                      <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center">
                        <UserIcon className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900">{articles.find(a => a.id === selectedArticleId)?.authorName}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">{new Date(articles.find(a => a.id === selectedArticleId)!.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-slate-700 leading-loose font-medium whitespace-pre-wrap">
                    {articles.find(a => a.id === selectedArticleId)?.content}
                  </div>
                  
                  {articles.find(a => a.id === selectedArticleId)?.authorId === user.id && (
                    <div className="pt-6 border-t border-slate-50 flex gap-3">
                      <button 
                        onClick={async () => {
                          if (!confirm("Sei sicuro di voler eliminare questo articolo?")) return;
                          setActionLoading(true);
                          try {
                            const res = await fetch(`/api/articles/${selectedArticleId}`, { method: "DELETE" });
                            if (res.ok) {
                              fetchData();
                              setCurrentView("articles");
                            }
                          } catch (err) {
                            alert("Errore di eliminazione");
                          } finally {
                            setActionLoading(false);
                          }
                        }}
                        className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-rose-50 text-rose-600 font-black text-sm hover:bg-rose-100 transition-all"
                      >
                        <Trash2 className="w-4 h-4" /> Elimina
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <BottomNav currentView={currentView} setView={setCurrentView} />
    </div>
  );
}

const Leaderboard = () => {
  const [leaders, setLeaders] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/leaderboard").then(res => res.json()).then(setLeaders);
  }, []);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="pb-4 font-bold text-slate-400 uppercase text-xs">Rank</th>
            <th className="pb-4 font-bold text-slate-400 uppercase text-xs">Player</th>
            <th className="pb-4 font-bold text-slate-400 uppercase text-xs">Influence</th>
            <th className="pb-4 font-bold text-slate-400 uppercase text-xs">Wealth</th>
          </tr>
        </thead>
        <tbody>
          {leaders.map((leader, i) => (
            <tr key={leader.username} className="border-b border-slate-50 last:border-0">
              <td className="py-4 font-bold text-slate-400">#{i + 1}</td>
              <td className="py-4 font-bold text-slate-900">{leader.username}</td>
              <td className="py-4 font-bold text-indigo-600">{leader.influence}</td>
              <td className="py-4 font-bold text-emerald-600">${leader.money.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
