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
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { User, Region, GAME_CONFIG } from "./types";
import { auth, googleProvider, isFirebaseConfigured } from "./lib/firebase";
import { signInWithPopup } from "firebase/auth";

// --- Components ---

const StatCard = ({ icon: Icon, label, value, color }: { icon: any, label: string, value: string | number, color: string }) => (
  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
    <div className={`p-3 rounded-xl ${color}`}>
      <Icon className="w-5 h-5 text-white" />
    </div>
    <div>
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold text-slate-900">{value}</p>
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
  const [user, setUser] = useState<User | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [currentView, setCurrentView] = useState<"dashboard" | "regions" | "leaderboard">("dashboard");
  const [selectedRegionId, setSelectedRegionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = async () => {
    try {
      const [userRes, regionsRes] = await Promise.all([
        fetch("/api/me"),
        fetch("/api/regions")
      ]);
      if (userRes.ok) {
        const userData = await userRes.json();
        setUser(userData);
      } else {
        setUser(null);
      }
      if (regionsRes.ok) {
        const regionsData = await regionsRes.json();
        setRegions(regionsData);
      }
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

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
    </div>
  );

  if (!user) return <Auth onLogin={fetchData} />;

  const selectedRegion = regions.find(r => r.id === selectedRegionId);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setCurrentView("dashboard"); setSelectedRegionId(null); }}>
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">Territorial</span>
          </div>
          
          <div className="hidden md:flex items-center gap-6">
            <button 
              onClick={() => { setCurrentView("dashboard"); setSelectedRegionId(null); }}
              className={`text-sm font-semibold transition-colors ${currentView === "dashboard" ? "text-indigo-600" : "text-slate-500 hover:text-slate-900"}`}
            >
              Dashboard
            </button>
            <button 
              onClick={() => { setCurrentView("regions"); setSelectedRegionId(null); }}
              className={`text-sm font-semibold transition-colors ${currentView === "regions" ? "text-indigo-600" : "text-slate-500 hover:text-slate-900"}`}
            >
              Regions
            </button>
            <button 
              onClick={() => { setCurrentView("leaderboard"); setSelectedRegionId(null); }}
              className={`text-sm font-semibold transition-colors ${currentView === "leaderboard" ? "text-indigo-600" : "text-slate-500 hover:text-slate-900"}`}
            >
              Leaderboard
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full">
              <UserIcon className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-bold">{user.username}</span>
            </div>
            <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {selectedRegionId ? (
            <motion.div 
              key="region-detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <button 
                onClick={() => setSelectedRegionId(null)}
                className="text-sm font-bold text-indigo-600 flex items-center gap-1 hover:underline"
              >
                ← Back to {currentView}
              </button>

              {selectedRegion && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <h2 className="text-4xl font-black text-slate-900">{selectedRegion.name}</h2>
                          <p className="text-slate-500 flex items-center gap-1 mt-1">
                            <MapPin className="w-4 h-4" /> Region #{selectedRegion.id}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-slate-400 uppercase">Owner</p>
                          <p className="text-lg font-bold text-indigo-600">{selectedRegion.ownerName || "No Owner"}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-slate-50 rounded-2xl">
                          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Population</p>
                          <p className="text-xl font-bold">{(selectedRegion.population / 1000).toFixed(1)}k</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl">
                          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Resources</p>
                          <p className="text-xl font-bold">{selectedRegion.resources}%</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl">
                          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Stability</p>
                          <p className="text-xl font-bold">{selectedRegion.stability}%</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl">
                          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Taxes</p>
                          <p className="text-xl font-bold">{selectedRegion.taxes}%</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                      <h3 className="text-xl font-bold mb-6">Regional Actions</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button 
                          onClick={() => handleAction("invest", { regionId: selectedRegion.id })}
                          disabled={actionLoading || user.money < GAME_CONFIG.INVEST_MONEY_COST}
                          className="p-6 rounded-2xl border-2 border-slate-100 hover:border-indigo-600 transition-all text-left group"
                        >
                          <div className="flex justify-between items-center mb-2">
                            <div className="p-2 bg-emerald-100 rounded-lg group-hover:bg-emerald-600 transition-colors">
                              <TrendingUp className="w-5 h-5 text-emerald-600 group-hover:text-white" />
                            </div>
                            <span className="text-sm font-bold text-emerald-600">-${GAME_CONFIG.INVEST_MONEY_COST}</span>
                          </div>
                          <h4 className="font-bold text-lg">Invest</h4>
                          <p className="text-sm text-slate-500 mt-1">Boost stability and population growth.</p>
                        </button>

                        <button 
                          onClick={() => handleAction("attack", { regionId: selectedRegion.id })}
                          disabled={actionLoading || user.energy < GAME_CONFIG.ATTACK_ENERGY_COST}
                          className="p-6 rounded-2xl border-2 border-slate-100 hover:border-red-600 transition-all text-left group"
                        >
                          <div className="flex justify-between items-center mb-2">
                            <div className="p-2 bg-red-100 rounded-lg group-hover:bg-red-600 transition-colors">
                              <Shield className="w-5 h-5 text-red-600 group-hover:text-white" />
                            </div>
                            <span className="text-sm font-bold text-red-600">-{GAME_CONFIG.ATTACK_ENERGY_COST} Energy</span>
                          </div>
                          <h4 className="font-bold text-lg">Attack / Capture</h4>
                          <p className="text-sm text-slate-500 mt-1">Attempt to seize control of this region.</p>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-indigo-600 p-6 rounded-3xl text-white shadow-lg shadow-indigo-100">
                      <h3 className="font-bold text-lg mb-4">Your Stats</h3>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-indigo-100 text-sm">Energy</span>
                          <span className="font-bold">{user.energy} / {GAME_CONFIG.ENERGY_MAX}</span>
                        </div>
                        <div className="w-full bg-indigo-800 h-2 rounded-full overflow-hidden">
                          <div className="bg-white h-full transition-all duration-500" style={{ width: `${(user.energy / GAME_CONFIG.ENERGY_MAX) * 100}%` }}></div>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                          <span className="text-indigo-100 text-sm">Money</span>
                          <span className="font-bold">${user.money.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-indigo-100 text-sm">Influence</span>
                          <span className="font-bold">{user.influence}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ) : currentView === "dashboard" ? (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={DollarSign} label="Money" value={`$${user.money.toLocaleString()}`} color="bg-emerald-500" />
                <StatCard icon={Zap} label="Energy" value={`${user.energy}/${GAME_CONFIG.ENERGY_MAX}`} color="bg-amber-500" />
                <StatCard icon={TrendingUp} label="Influence" value={user.influence} color="bg-indigo-500" />
                <StatCard icon={Shield} label="Reputation" value={user.reputation} color="bg-rose-500" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-indigo-600" /> Quick Actions
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <button 
                        onClick={() => handleAction("work")}
                        disabled={actionLoading || user.energy < GAME_CONFIG.WORK_ENERGY_COST}
                        className="p-6 rounded-2xl bg-slate-50 hover:bg-white border-2 border-transparent hover:border-indigo-600 transition-all text-left group shadow-sm"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <div className="p-2 bg-indigo-100 rounded-lg group-hover:bg-indigo-600 transition-colors">
                            <DollarSign className="w-5 h-5 text-indigo-600 group-hover:text-white" />
                          </div>
                          <span className="text-xs font-bold text-slate-400 uppercase">-{GAME_CONFIG.WORK_ENERGY_COST} Energy</span>
                        </div>
                        <h4 className="font-bold text-lg">Work</h4>
                        <p className="text-sm text-slate-500 mt-1">Generate immediate income for your treasury.</p>
                      </button>

                      <button 
                        onClick={() => handleAction("propaganda")}
                        disabled={actionLoading || user.energy < GAME_CONFIG.PROPAGANDA_ENERGY_COST}
                        className="p-6 rounded-2xl bg-slate-50 hover:bg-white border-2 border-transparent hover:border-indigo-600 transition-all text-left group shadow-sm"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <div className="p-2 bg-indigo-100 rounded-lg group-hover:bg-indigo-600 transition-colors">
                            <TrendingUp className="w-5 h-5 text-indigo-600 group-hover:text-white" />
                          </div>
                          <span className="text-xs font-bold text-slate-400 uppercase">-{GAME_CONFIG.PROPAGANDA_ENERGY_COST} Energy</span>
                        </div>
                        <h4 className="font-bold text-lg">Propaganda</h4>
                        <p className="text-sm text-slate-500 mt-1">Increase your political influence globally.</p>
                      </button>
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold">Nearby Regions</h3>
                      <button onClick={() => setCurrentView("regions")} className="text-sm font-bold text-indigo-600 hover:underline">View All</button>
                    </div>
                    <div className="space-y-3">
                      {regions.slice(0, 3).map(region => (
                        <div 
                          key={region.id} 
                          onClick={() => setSelectedRegionId(region.id)}
                          className="flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 border border-slate-100 cursor-pointer transition-colors group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                              {region.name[0]}
                            </div>
                            <div>
                              <p className="font-bold">{region.name}</p>
                              <p className="text-xs text-slate-500">Stability: {region.stability}% • Pop: {(region.population / 1000).toFixed(1)}k</p>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-slate-900 p-8 rounded-3xl text-white">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-amber-400" /> Top Players
                    </h3>
                    <div className="space-y-4">
                      {/* This would ideally be fetched from /api/leaderboard */}
                      <p className="text-slate-400 text-sm italic">Visit the Leaderboard tab for full rankings.</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : currentView === "regions" ? (
            <motion.div 
              key="regions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <h2 className="text-3xl font-black text-slate-900">World Regions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {regions.map(region => (
                  <div 
                    key={region.id} 
                    onClick={() => setSelectedRegionId(region.id)}
                    className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:border-indigo-600 cursor-pointer transition-all group"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="text-xl font-bold group-hover:text-indigo-600 transition-colors">{region.name}</h4>
                      <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${region.ownerName ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400"}`}>
                        {region.ownerName ? "Occupied" : "Neutral"}
                      </span>
                    </div>
                    <div className="space-y-2 mb-6">
                      <div className="flex justify-between text-xs font-bold text-slate-400">
                        <span>Stability</span>
                        <span>{region.stability}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-indigo-500 h-full" style={{ width: `${region.stability}%` }}></div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                      <div className="text-xs">
                        <p className="text-slate-400 font-bold uppercase">Resources</p>
                        <p className="font-bold text-slate-900">{region.resources}%</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-600" />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="leaderboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100"
            >
              <h2 className="text-3xl font-black text-slate-900 mb-8">Global Rankings</h2>
              <Leaderboard />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
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
            <th className="pb-4 font-bold text-slate-400 uppercase text-xs">Reputation</th>
            <th className="pb-4 font-bold text-slate-400 uppercase text-xs">Wealth</th>
          </tr>
        </thead>
        <tbody>
          {leaders.map((leader, i) => (
            <tr key={leader.username} className="border-b border-slate-50 last:border-0">
              <td className="py-4 font-bold text-slate-400">#{i + 1}</td>
              <td className="py-4 font-bold text-slate-900">{leader.username}</td>
              <td className="py-4 font-bold text-indigo-600">{leader.influence}</td>
              <td className="py-4 font-bold text-rose-500">{leader.reputation}</td>
              <td className="py-4 font-bold text-emerald-600">${leader.money.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
