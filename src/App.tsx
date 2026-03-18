/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { User, Region, GAME_CONFIG, PERKS_DEFS, Article, Factory, War, BOOSTER_CONFIG, RESOURCE_TYPES, RESOURCE_LABELS, RESOURCE_ICONS_MAP, FACTORY_CONFIG } from "./types";
import type { ResourceType, DeepCostPreview } from "./types";
import type { WorldStats } from "./components/home/mockData";
import { DEFAULT_WORLD_STATS } from "./components/home/mockData";
import { supabase } from "./lib/supabase";
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
import { HomePage } from "./components/home";
import { DailyTasksPage } from "./components/daily";
import { StatePage } from "./components/state";
import territorialBrand from "./assets/branding/territorial-brand.svg";

// --- Utilities ---
const getTs = (val: any) => {
  if (!val) return 0;
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? (Number(val) || 0) : d.getTime();
  }
  if (val._seconds) return val._seconds * 1000;
  if (val.seconds) return val.seconds * 1000;
  if (val.toDate) return val.toDate().getTime();
  if (val instanceof Date) return val.getTime();
  return Number(val) || 0;
};

const formatDuration = (sec: number) => {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const formatRemaining = (ms: number): string => {
  if (ms <= 0) return "00:00";
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// Compute flag emoji from ISO2 code using Unicode Regional Indicator Symbols
const isoToFlag = (iso2: string): string => {
  if (!iso2 || iso2.length < 2) return "🌍";
  const code = iso2.toUpperCase();
  const offset = 127397; // Regional Indicator Symbol offset
  try {
    return String.fromCodePoint(code.charCodeAt(0) + offset, code.charCodeAt(1) + offset);
  } catch {
    return "🌍";
  }
};

const NationalFlag = ({ iso2, className = "w-[1.2em] h-[0.9em]", style }: { iso2: string; className?: string; style?: React.CSSProperties }) => {
  const [error, setError] = useState(false);
  const upper = (iso2 || '').toUpperCase();
  const countryCode = (upper.includes('-') ? upper.split('-')[0] : upper).toLowerCase();
  
  if (!countryCode || countryCode === 'st' || countryCode === 'world' || error) {
    return <span className={className} style={{...style, fontSize: '1em', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}}>🌍</span>;
  }

  return (
    <img
      src={`https://flagcdn.com/${countryCode}.svg`}
      className={`inline-block object-cover rounded-sm shadow-sm align-middle ${className}`}
      alt={iso2}
      style={style}
      onError={() => setError(true)}
    />
  );
};

const NationLogo = ({ iso2, logo, className = "w-10 h-6", style }: { iso2?: string; logo?: string | null; className?: string; style?: React.CSSProperties }) => {
  if (logo && logo.startsWith("http")) {
    return <img src={logo} alt={iso2 || "logo"} className={`object-cover rounded-none ${className}`} style={style} />;
  }
  if (logo && logo.length > 0 && logo.length <= 4) {
    return <span className={`flex items-center justify-center text-xl ${className}`} style={style}>{logo}</span>;
  }
  return <NationalFlag iso2={iso2 || "it"} className={className} style={style} />;
};

const COUNTRY_FLAGS: Record<string, string> = {
  IT: "🇮🇹", FR: "🇫🇷", DE: "🇩🇪", ES: "🇪🇸", GB: "🇬🇧", US: "🇺🇸", CA: "🇨🇦",
  BR: "🇧🇷", JP: "🇯🇵", CN: "🇨🇳", IN: "🇮🇳", RU: "🇷🇺", AU: "🇦🇺", ZA: "🇿🇦",
  MX: "🇲🇽", AR: "🇦🇷", EG: "🇪🇬", NG: "🇳🇬", TR: "🇹🇷", KR: "🇰🇷", SA: "🇸🇦",
  ID: "🇮🇩", PK: "🇵🇰", PL: "🇵🇱", UA: "🇺🇦", SE: "🇸🇪", NO: "🇳🇴", NL: "🇳🇱",
  BE: "🇧🇪", CH: "🇨🇭", PT: "🇵🇹", GR: "🇬🇷", AT: "🇦🇹", HU: "🇭🇺", CZ: "🇨🇿",
  RO: "🇷🇴", FI: "🇫🇮", DK: "🇩🇰", IE: "🇮🇪", TH: "🇹🇭", VN: "🇻🇳", PH: "🇵🇭",
  MY: "🇲🇾", SG: "🇸🇬", IR: "🇮🇷", IQ: "🇮🇶", IL: "🇮🇱", CO: "🇨🇴", CL: "🇨🇱",
  PE: "🇵🇪", ET: "🇪🇹", KE: "🇰🇪", GH: "🇬🇭", TZ: "🇹🇿", MA: "🇲🇦", DZ: "🇩🇿",
  NZ: "🇳🇿", AF: "🇦🇫",
};

// Get flag: try static map first, then compute from ISO2 code
const getFlag = (iso2: string): string => {
  const upper = (iso2 || '').toUpperCase();
  // Handle sub-region codes (e.g., "IT-RM" → "IT")
  const countryCode = upper.includes('-') ? upper.split('-')[0] : upper;
  return COUNTRY_FLAGS[countryCode] || isoToFlag(countryCode);
};

const WarTimer = ({ endsAt }: { endsAt: number | any }) => {
  const ts = getTs(endsAt);
  const [remaining, setRemaining] = useState(() => Math.max(0, ts - Date.now()));

  useEffect(() => {
    const tick = () => {
      const r = Math.max(0, ts - Date.now());
      setRemaining(r);
    };
    if (Math.max(0, ts - Date.now()) <= 0) return;
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [endsAt]);

  return (
    <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 text-white rounded-xl shadow-lg shadow-slate-200">
      <Clock className="w-3 h-3 text-indigo-400" />
      <span className="text-[10px] font-black tabular-nums tracking-wider uppercase">
        {remaining > 0 ? formatRemaining(remaining) : "Terminata"}
      </span>
    </div>
  );
};

// --- Components ---

const BottomNav = () => {
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
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-md border-t border-gray-700/50 px-4 py-2.5 flex justify-around items-center z-50 pb-safe">
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
            className={`flex flex-col items-center gap-0.5 min-w-[48px] py-1 rounded-xl transition-all ${isActive ? "text-indigo-400" : "text-gray-500 hover:text-gray-300"}`}
          >
            <Icon className={`w-5 h-5 ${isActive ? "drop-shadow-[0_0_6px_rgba(129,140,248,0.5)]" : ""}`} />
            <span className="text-[9px] font-black uppercase tracking-wider">{tab.label}</span>
            {isActive && <div className="w-1 h-1 rounded-full bg-indigo-400 mt-0.5" />}
          </button>
        );
      })}
    </nav>
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

// --- Reusable Components ---

const ResourceStrip = ({ user }: { user: any }) => (
  <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100">
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Magazzino Risorse</p>
    <div className="flex justify-between items-center gap-2 overflow-x-auto">
      {[
        { emoji: "🪙", label: "Oro", val: user.gold || 0, color: "text-amber-600" },
        { emoji: "🛢️", label: "Petrolio", val: user.oil || 0, color: "text-orange-600" },
        { emoji: "🪨", label: "Minerali", val: user.minerals || 0, color: "text-slate-600" },
        { emoji: "☢️", label: "Uranio", val: user.uranium || 0, color: "text-cyan-600" },
        { emoji: "💎", label: "Diamanti", val: user.diamonds || 0, color: "text-purple-600" },
      ].map(r => (
        <div key={r.label} className="flex flex-col items-center gap-1 min-w-[56px]">
          <span className="text-xl">{r.emoji}</span>
          <span className={`text-sm font-black ${r.color}`}>{r.val}</span>
          <span className="text-[8px] font-bold text-slate-400 uppercase">{r.label}</span>
        </div>
      ))}
    </div>
  </div>
);

const StatRow = ({ label, value, icon: Icon, onClick }: { label: string, value: string | number, icon?: any, onClick?: () => void }) => (
  <button
    onClick={onClick}
    className="w-full bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between hover:border-indigo-200 transition-all group"
  >
    <div className="flex items-center gap-3">
      {Icon && <Icon className="w-5 h-5 text-indigo-500" />}
      <span className="font-bold text-slate-700">{label}</span>
    </div>
    <div className="flex items-center gap-2">
      <span className="font-black text-slate-900">{value}</span>
      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
    </div>
  </button>
);

const DarkCard = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 ${className}`}>
    {children}
  </div>
);

const TerritorialBrandLogo = ({ className = "", alt = "Territorial" }: { className?: string; alt?: string }) => (
  <img src={territorialBrand} alt={alt} className={className} />
);

const Auth = ({ onLogin }: { onLogin: () => void }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState(""); // Still needed for profile registration
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      let session = null;
      if (isLogin) {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) throw authError;
        session = data.session;
      } else {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username }
          }
        });
        if (authError) throw authError;
        session = data.session;
      }
      // Explicitly set cookie before fetching data to avoid race conditions
      if (session) {
        document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=${604800}; SameSite=Lax`;
      }
      onLogin();
    } catch (err: any) {
      setError(err.message || "Authentication error");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (authError) throw authError;
    } catch (err: any) {
      setError(err.message || "Google login failed");
      console.error(err);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center bg-slate-950 p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(180,140,72,0.22),_transparent_42%),linear-gradient(180deg,_rgba(4,14,20,0.96),_rgba(2,10,16,0.98))]" />
      <div
        className="absolute inset-0 bg-center bg-no-repeat opacity-25"
        style={{ backgroundImage: `url(${territorialBrand})`, backgroundSize: "min(92vw, 58rem)" }}
      />
      <div className="absolute inset-0 bg-slate-950/45" />
      <div className="relative z-10 w-full max-w-sm">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/95 backdrop-blur-sm p-8 rounded-[2rem] shadow-2xl shadow-black/30 border border-white/40"
        >
          <div className="flex flex-col items-center mb-8">
            <TerritorialBrandLogo className="w-full max-w-[16rem] h-auto mb-5 drop-shadow-[0_16px_32px_rgba(2,10,16,0.28)]" />
            <p className="text-slate-400 text-sm font-medium mt-1">
              {isLogin ? "Bentornato, Comandante" : "Inizia la tua ascesa"}
            </p>
          </div>

          <div className="space-y-4">
            {true && (
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
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
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
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-300"
                    placeholder="tua@email.com"
                    required
                  />
                </div>
              </div>
              {!isLogin && (
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
              )}
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
              onClick={() => { setIsLogin(!isLogin); setError(""); }}
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

interface ChatMessage {
  id: number;
  userId: string;
  username: string;
  regionId: string;
  channel?: string;
  message: string;
  createdAt: number;
}

const GlobalChat = ({ currentUser }: { currentUser: any }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannel] = useState<'global' | 'local'>('global');
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/chat?channel=${channel}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (_) { }
  };

  useEffect(() => {
    fetchMessages();
    const iv = setInterval(fetchMessages, 4000);
    return () => clearInterval(iv);
  }, [channel]);

  // Auto-scroll to bottom only inside the container
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input.trim(), channel }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setInput("");
        await fetchMessages();
      }
    } catch (_) {
      setError("Errore di connessione");
    } finally {
      setSending(false);
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
      {/* Header with channel toggle */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-50">
        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
        <div className="flex gap-2">
          <button
            onClick={() => setChannel('global')}
            className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all ${channel === 'global' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
          >
            🌍 Globale
          </button>
          <button
            onClick={() => setChannel('local')}
            className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all ${channel === 'local' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
          >
            🏠 {currentUser.originalNation || 'IT'}
          </button>
        </div>
        <span className="ml-auto text-[10px] font-black text-slate-300 uppercase">{messages.length} messaggi</span>
      </div>

      {/* Messages */}
      <div
        ref={listRef}
        className="h-72 overflow-y-auto px-4 py-3 space-y-2"
        style={{ scrollbarWidth: "thin" }}
      >
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-300 text-sm font-bold">Nessun messaggio ancora. Sii il primo!</p>
          </div>
        )}
        {messages.map((msg) => {
          const isOwn = msg.userId === currentUser.id;
          return (
            <div key={msg.id} className={`flex gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"} items-end`}>
              {/* Avatar */}
              {!isOwn && (
                <div className="w-7 h-7 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0 text-[10px] font-black text-indigo-600">
                  {msg.username.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                {!isOwn && (
                  <div className="flex items-center gap-1.5 px-1">
                    <span className="text-[10px] font-black text-slate-600">{msg.username}</span>
                    <span className="text-[9px] font-bold text-slate-300 bg-slate-50 px-1.5 py-0.5 rounded-md">{msg.regionId}</span>
                  </div>
                )}
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm font-medium leading-relaxed ${isOwn
                    ? "bg-indigo-600 text-white rounded-br-md"
                    : "bg-slate-50 text-slate-700 rounded-bl-md"
                    }`}
                >
                  {msg.message}
                </div>
                <span className="text-[9px] text-slate-300 font-bold px-1">{formatTime(msg.createdAt)}</span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-slate-50">
        {error && (
          <p className="text-[10px] font-bold text-rose-500 mb-2 px-1">{error}</p>
        )}
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(null); }}
            placeholder="Scrivi un messaggio..."
            maxLength={280}
            className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
};

const HomeView = ({ user, regions, navigateToCountry }: { user: any, regions: Region[], navigateToCountry: (id: string) => void }) => {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard icon={DollarSign} label="Tesoro" value={`$${user.money.toLocaleString()}`} color="bg-emerald-500" />
        <StatCard icon={Zap} label="Energia" value={`${user.energy}/${user.maxEnergy}`} color="bg-amber-500" subValue={`Regen: +${GAME_CONFIG.ENERGY_REGEN_RATE + (user.perks?.['RESISTENZA'] || 0) * 5}/h`} />
        <StatCard icon={Star} label="Livello" value={user.level} color="bg-indigo-500" />
        <button 
          onClick={() => navigateToCountry(user.regionId)}
          className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-4 hover:border-indigo-200 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer text-left w-full"
        >
          <div className="p-3 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-100">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Regione</p>
            <p className="text-xl font-black text-slate-900 leading-none mt-1">{user.regionId}</p>
          </div>
        </button>
      </div>

      {/* CTA Cards */}
      <div className="space-y-3">
        <button onClick={() => navigate("/map")} className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 p-5 rounded-[2rem] shadow-lg shadow-indigo-200 flex items-center gap-4 text-left hover:scale-[1.01] active:scale-[0.99] transition-all">
          <div className="p-3 rounded-2xl bg-white/20">
            <Globe className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-white font-black text-base">Mappa Globale</p>
            <p className="text-indigo-200 text-xs font-medium">Esplora il mondo e le regioni</p>
          </div>
          <ChevronRight className="w-5 h-5 text-white/60" />
        </button>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => navigateToCountry(user.regionId)} className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100 text-left hover:border-indigo-200 transition-all group">
            <div className="p-2.5 rounded-xl bg-emerald-50 w-fit mb-3">
              <MapPin className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="font-black text-slate-900 text-sm">La Tua Regione</p>
            <p className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-1.5">
              <NationalFlag iso2={user.regionId || ""} className="w-4 h-3" /> {user.regionId}
            </p>
          </button>

          <button onClick={() => navigateToCountry(user.originalNation || user.regionId)} className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100 text-left hover:border-indigo-200 transition-all group">
            <div className="p-2.5 rounded-xl bg-rose-50 w-fit mb-3">
              <Flag className="w-5 h-5 text-rose-600" />
            </div>
            <p className="font-black text-slate-900 text-sm">Il Tuo Stato</p>
            <p className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-1.5">
              <NationalFlag iso2={user.originalNation || ""} className="w-4 h-3" /> {user.originalNation || 'N/A'}
            </p>
          </button>

          <button onClick={() => navigate("/parliament")} className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100 text-left hover:border-indigo-200 transition-all group">
            <div className="p-2.5 rounded-xl bg-blue-50 w-fit mb-3">
              <Landmark className="w-5 h-5 text-blue-600" />
            </div>
            <p className="font-black text-slate-900 text-sm">Parlamento</p>
            <p className="text-[10px] font-bold text-slate-400 mt-1">Proponi e vota leggi</p>
          </button>

          <button onClick={() => navigate("/party")} className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100 text-left hover:border-indigo-200 transition-all group">
            <div className="p-2.5 rounded-xl bg-purple-50 w-fit mb-3">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <p className="font-black text-slate-900 text-sm">Il Tuo Partito</p>
            <p className="text-[10px] font-bold text-slate-400 mt-1">Gestisci il partito</p>
          </button>
        </div>
      </div>

      {/* Resource Strip (Magazzino) */}
      <ResourceStrip user={user} />

      {/* World Map */}
      <WorldMap onRegionClick={navigateToCountry} regions={regions} />

      <GlobalChat currentUser={user} />
    </motion.div>
  );
};

const ArticlesView = ({ articles: _articles, setSelectedArticleId }: { articles: Article[], setSelectedArticleId: (id: string) => void }) => {
  const navigate = useNavigate();
  const [section, setSection] = useState<'global' | 'local'>('global');
  const [category, setCategory] = useState<'all' | 'best' | 'guides' | 'subscriptions'>('all');
  const [localArticles, setLocalArticles] = useState<Article[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    const fetchSectionArticles = async () => {
      setLoadingArticles(true);
      try {
        const res = await fetch(`/api/articles?section=${section}`);
        if (res.ok) setLocalArticles(await res.json());
      } catch { }
      setLoadingArticles(false);
    };
    fetchSectionArticles();
  }, [section]);

  const displayArticles = useMemo(() => {
    let result = localArticles;

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a =>
        a.title.toLowerCase().includes(q) || a.authorName.toLowerCase().includes(q)
      );
    }

    // Filter by category
    if (category === 'best') {
      result = [...result].sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
    } else if (category === 'guides') {
      result = result.filter(a => a.title.toLowerCase().includes('guida') || a.title.toLowerCase().includes('guide') || a.title.toLowerCase().includes('tutorial'));
    }

    return result;
  }, [localArticles, searchQuery, category]);

  const categories = [
    { id: 'all' as const, label: 'Tutti' },
    { id: 'best' as const, label: 'Migliori' },
    { id: 'guides' as const, label: 'Guide' },
    { id: 'subscriptions' as const, label: 'Iscrizioni' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Articoli</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-3 rounded-2xl bg-white border border-slate-100 shadow-sm hover:bg-slate-50 transition-all"
          >
            <Search className="w-5 h-5 text-slate-500" />
          </button>
          <button
            onClick={() => navigate(`/articles/new?section=${section}`)}
            className="bg-emerald-600 text-white p-3 rounded-2xl shadow-lg shadow-emerald-100 hover:scale-105 transition-all"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Search bar */}
      <AnimatePresence>
        {showSearch && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cerca per titolo o autore..."
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white border border-slate-100 focus:ring-4 focus:ring-indigo-50 outline-none text-sm font-bold text-slate-700"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Section tabs (global/local) */}
      <div className="bg-white rounded-[2.5rem] p-2 flex gap-2 shadow-sm border border-slate-100">
        <button onClick={() => setSection('global')} className={`flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${section === 'global' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "text-slate-400 hover:bg-slate-50"}`}>
          🌍 Globale
        </button>
        <button onClick={() => setSection('local')} className={`flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${section === 'local' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "text-slate-400 hover:bg-slate-50"}`}>
          🏠 Locale
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${category === cat.id ? "bg-indigo-600 text-white shadow-md" : "bg-white text-slate-400 border border-slate-100 hover:bg-slate-50"}`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {loadingArticles ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
      ) : (
        <div className="space-y-4">
          {displayArticles.map(article => (
            <button
              key={article.id}
              onClick={() => { navigate(`/articles/${article.id}`); }}
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
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-indigo-500 flex items-center gap-1">
                    <ThumbsUp className="w-3 h-3" /> {article.likeCount || 0}
                  </span>
                  <span className="text-[10px] font-bold text-slate-300 uppercase">{new Date(article.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </button>
          ))}
          {displayArticles.length === 0 && (
            <div className="bg-white p-12 rounded-[2.5rem] text-center text-slate-400 font-medium border border-dashed border-slate-200">
              {searchQuery ? 'Nessun risultato trovato.' : section === 'local' ? 'Nessun articolo locale pubblicato. Sii il primo!' : 'Nessun articolo pubblicato. Sii il primo!'}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

const ArticleDetailView = ({ articles, user, fetchData }: { articles: Article[], user: any, fetchData: () => void }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [actionLoading, setActionLoading] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(null);
  const [voteScore, setVoteScore] = useState(0);
  const [allArticles, setAllArticles] = useState<Article[]>([]);

  // Fetch all articles for prev/next navigation
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const res = await fetch('/api/articles?section=global');
        if (res.ok) setAllArticles(await res.json());
      } catch { }
    };
    fetchAll();
  }, []);

  const article = articles.find(a => a.id === id) || allArticles.find(a => a.id === id);

  // Fetch comments and vote status
  useEffect(() => {
    if (!id) return;
    const fetchComments = async () => {
      try {
        const res = await fetch(`/api/articles/${id}/comments`);
        if (res.ok) setComments(await res.json());
      } catch { }
    };
    const fetchVote = async () => {
      try {
        const res = await fetch(`/api/articles/${id}/vote`);
        if (res.ok) {
          const data = await res.json();
          setUserVote(data.vote || null);
          setVoteScore(data.score || 0);
        }
      } catch { }
    };
    fetchComments();
    fetchVote();
  }, [id]);

  // Find prev/next articles
  const articlesList = allArticles.length > 0 ? allArticles : articles;
  const currentIdx = articlesList.findIndex(a => a.id === id);
  const prevArticle = currentIdx > 0 ? articlesList[currentIdx - 1] : null;
  const nextArticle = currentIdx < articlesList.length - 1 ? articlesList[currentIdx + 1] : null;

  const handleVote = async (direction: 'up' | 'down') => {
    try {
      const res = await fetch(`/api/articles/${id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote: userVote === direction ? null : direction })
      });
      if (res.ok) {
        const data = await res.json();
        setUserVote(data.vote || null);
        setVoteScore(data.score || 0);
      }
    } catch { }
  };

  const handleComment = async () => {
    if (!newComment.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/articles/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment })
      });
      if (res.ok) {
        const data = await res.json();
        setComments(prev => [...prev, data]);
        setNewComment('');
      }
    } catch { }
    setActionLoading(false);
  };

  if (!article) return (
    <div className="bg-white p-12 rounded-[2.5rem] text-center border border-slate-100">
      <p className="text-slate-400 font-bold">Articolo non trovato</p>
      <button onClick={() => navigate("/articles")} className="mt-4 text-indigo-600 font-black text-sm">← Torna al Feed</button>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6"
    >
      <button
        onClick={() => navigate("/articles")}
        className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1"
      >
        ← Torna al Feed
      </button>
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 leading-tight">{article.title}</h2>
          <div className="flex items-center gap-3 mt-4">
            <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center">
              <UserIcon className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900">{article.authorName}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase">{new Date(article.createdAt).toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="text-slate-700 leading-loose font-medium whitespace-pre-wrap">
          {article.content}
        </div>

        {/* Vote section */}
        <div className="flex items-center gap-4 pt-4 border-t border-slate-50">
          <button
            onClick={() => handleVote('up')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border transition-all ${userVote === 'up' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-slate-200 text-slate-400 hover:text-emerald-500 hover:border-emerald-200'}`}
          >
            <ThumbsUp className="w-4 h-4" />
            <span className="text-xs font-black">Mi piace</span>
          </button>
          <span className="text-lg font-black text-slate-900">{voteScore || article.likeCount || 0}</span>
          <button
            onClick={() => handleVote('down')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border transition-all ${userVote === 'down' ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-white border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200'}`}
          >
            <ThumbsDown className="w-4 h-4" />
            <span className="text-xs font-black">Non mi piace</span>
          </button>
        </div>

        {/* Prev/Next navigation */}
        <div className="flex justify-between pt-4 border-t border-slate-50">
          {prevArticle ? (
            <button onClick={() => navigate(`/articles/${prevArticle.id}`)} className="text-xs font-black text-indigo-600 flex items-center gap-1 hover:underline">
              <ChevronLeft className="w-4 h-4" /> Articolo precedente
            </button>
          ) : <div />}
          {nextArticle ? (
            <button onClick={() => navigate(`/articles/${nextArticle.id}`)} className="text-xs font-black text-indigo-600 flex items-center gap-1 hover:underline">
              Prossimo articolo <ChevronRight className="w-4 h-4" />
            </button>
          ) : <div />}
        </div>

        {article.authorId === user.id && (
          <div className="pt-6 border-t border-slate-50 flex gap-3">
            <button
              onClick={async () => {
                if (!confirm("Sei sicuro di voler eliminare questo articolo?")) return;
                setActionLoading(true);
                try {
                  const res = await fetch(`/api/articles/${id}`, { method: "DELETE" });
                  if (res.ok) {
                    fetchData();
                    navigate("/articles");
                  }
                } catch (err) {
                  alert("Errore di eliminazione");
                } finally {
                  setActionLoading(false);
                }
              }}
              className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-rose-50 text-rose-600 font-black text-sm hover:bg-rose-100 transition-all"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Elimina
            </button>
          </div>
        )}
      </div>

      {/* Comments Section */}
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-4">
        <h3 className="font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-indigo-500" />
          Commenti ({comments.length})
        </h3>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {comments.map((c: any, i: number) => (
            <div key={c.id || i} className="bg-slate-50 p-4 rounded-2xl">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center">
                  <UserIcon className="w-3 h-3 text-indigo-600" />
                </div>
                <span className="text-xs font-black text-slate-700">{c.authorName || 'Utente'}</span>
                <span className="text-[9px] font-bold text-slate-400">{c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}</span>
              </div>
              <p className="text-sm text-slate-600 font-medium">{c.content}</p>
            </div>
          ))}
          {comments.length === 0 && (
            <p className="text-center text-slate-400 text-sm font-medium py-4">Nessun commento. Sii il primo!</p>
          )}
        </div>
        <div className="flex gap-2">
          <input
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleComment(); }}
            placeholder="Lascia un commento…"
            className="flex-1 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100"
          />
          <button
            onClick={handleComment}
            disabled={actionLoading || !newComment.trim()}
            className="px-4 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs disabled:opacity-50 hover:bg-indigo-700 transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const NewArticleView = ({ actionLoading, fetchData }: { actionLoading: boolean, fetchData: () => void }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const initialSection = params.get('section') === 'local' ? 'local' : 'global';
  const [articleSection, setArticleSection] = useState<'global' | 'local'>(initialSection);
  return (
    <motion.div
      key="article-new"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6"
    >
      <button
        onClick={() => navigate("/articles")}
        className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1"
      >
        ← Annulla
      </button>
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
        <h2 className="text-2xl font-black text-slate-900">Nuovo Articolo</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Sezione</label>
            <div className="flex gap-2">
              <button onClick={() => setArticleSection('global')} className={`flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${articleSection === 'global' ? "bg-indigo-600 text-white shadow-lg" : "bg-slate-50 text-slate-400 border border-slate-200"}`}>
                🌍 Globale
              </button>
              <button onClick={() => setArticleSection('local')} className={`flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${articleSection === 'local' ? "bg-indigo-600 text-white shadow-lg" : "bg-slate-50 text-slate-400 border border-slate-200"}`}>
                🏠 Locale
              </button>
            </div>
          </div>
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

              try {
                const res = await fetch("/api/articles", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ title, content, section: articleSection }),
                });
                if (res.ok) {
                  fetchData();
                  navigate("/articles");
                } else {
                  const data = await res.json();
                  alert(data.error);
                }
              } catch (err) {
                alert("Errore di connessione");
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
  );
};



const WarsView = ({ wars, user, fetchData, actionLoading }: { wars: any, user: any, fetchData: () => void, actionLoading: boolean }) => {
  const [training, setTraining] = useState(false);
  const [militaryExp, setMilitaryExp] = useState(user?.militaryExp || 0);

  // Auto-attack state: { warId, side, weaponId } or null
  const [autoAttack, setAutoAttack] = useState<{ warId: string, side: string, weaponId: string } | null>(null);
  const autoAttackRef = React.useRef(autoAttack);
  autoAttackRef.current = autoAttack;

  // Auto-training state
  const [autoTrain, setAutoTrain] = useState(false);
  const autoTrainRef = React.useRef(autoTrain);
  autoTrainRef.current = autoTrain;

  // Auto-attack interval
  useEffect(() => {
    if (!autoAttack) return;
    let stopped = false;
    const doAutoAttack = async () => {
      if (!autoAttackRef.current || stopped) return;
      try {
        const res = await fetch("/api/wars/deploy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ warId: autoAttackRef.current.warId, side: autoAttackRef.current.side, weaponId: autoAttackRef.current.weaponId })
        });
        const data = await res.json();
        if (data.error) {
          const errLower = (data.error || '').toLowerCase();
          // Stop on energy/resource errors, not on cooldown
          if (errLower.includes('energia') || errLower.includes('energy') || errLower.includes('insufficiente') || errLower.includes('not found')) {
            setAutoAttack(null);
          }
        }
        fetchData();
      } catch {
        // Network error - retry next interval
      }
    };
    // Execute immediately, then every 10 minutes
    doAutoAttack();
    const iv = setInterval(doAutoAttack, 10 * 60 * 1000);
    return () => { stopped = true; clearInterval(iv); };
  }, [autoAttack]);

  // Auto-training interval
  useEffect(() => {
    if (!autoTrain) return;
    let stopped = false;
    const doAutoTrain = async () => {
      if (!autoTrainRef.current || stopped) return;
      try {
        const res = await fetch("/api/actions/train", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json();
        if (data.error) {
          const errLower = (data.error || '').toLowerCase();
          if (errLower.includes('energia') || errLower.includes('energy') || errLower.includes('insufficiente')) {
            setAutoTrain(false);
          }
        } else {
          setMilitaryExp(data.militaryExp || militaryExp + 5);
        }
        fetchData();
      } catch {
        // Network error - retry next interval
      }
    };
    doAutoTrain();
    const iv = setInterval(doAutoTrain, 10 * 60 * 1000);
    return () => { stopped = true; clearInterval(iv); };
  }, [autoTrain]);

  const handleTrain = async () => {
    if (user.energy < 10) { alert("Energia insufficiente!"); return; }
    setTraining(true);
    try {
      const res = await fetch("/api/actions/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else {
        setMilitaryExp(data.militaryExp || militaryExp + 5);
        fetchData();
      }
    } catch {
      // Fallback: simulate training locally
      setMilitaryExp(prev => prev + 5);
      fetchData();
    } finally {
      setTraining(false);
    }
  };

  const handleJoinRevolution = () => {
    alert("Funzionalità in arrivo! La rivoluzione sarà disponibile presto. (Placeholder)");
  };

  return (
    <motion.div
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

      {/* Military Training Section */}
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-amber-50">
            <Dumbbell className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h3 className="font-black text-slate-900 uppercase tracking-tight">Addestramento Militare</h3>
            <p className="text-xs text-slate-400 font-medium">Allenati per aumentare la tua esperienza militare</p>
          </div>
        </div>
        <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Exp Militare</p>
            <p className="text-2xl font-black text-slate-900">{militaryExp}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Energia</p>
            <p className="text-lg font-black text-amber-600">{user.energy}⚡</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleTrain}
            disabled={training || user.energy < 10}
            className="flex-1 py-4 bg-amber-500 text-white rounded-2xl font-black uppercase text-sm shadow-lg shadow-amber-100 hover:bg-amber-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {training ? <Loader2 className="w-4 h-4 animate-spin" /> : <Dumbbell className="w-4 h-4" />}
            Allenati (-10⚡, +5 Exp)
          </button>
          {autoTrain ? (
            <button
              onClick={() => setAutoTrain(false)}
              className="py-4 px-4 bg-red-500 text-white rounded-2xl font-black uppercase text-xs shadow-lg hover:bg-red-600 transition-all flex items-center justify-center gap-1"
            >
              ⏹ Stop
            </button>
          ) : (
            <button
              onClick={() => setAutoTrain(true)}
              className="py-4 px-4 bg-amber-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg hover:bg-amber-700 transition-all flex items-center justify-center gap-1"
              title="Addestramento automatico ogni 10 minuti"
            >
              🤖 Auto
            </button>
          )}
        </div>
        {autoTrain && (
          <div className="bg-amber-100 rounded-xl p-3 flex items-center gap-2">
            <span className="animate-pulse text-lg">⚙️</span>
            <span className="text-xs font-black text-amber-800">Auto-addestramento attivo! Prossimo turno tra 10 minuti.</span>
          </div>
        )}
      </div>

      {/* Revolution / Coup CTA */}
      <div className="bg-gradient-to-r from-rose-600 to-rose-700 p-6 rounded-[2.5rem] shadow-lg shadow-rose-200 text-white space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-white/20">
            <Flag className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-black uppercase tracking-tight">Rivoluzione / Golpe</h3>
            <p className="text-rose-200 text-xs font-medium">Unisciti o organizza un colpo di stato</p>
          </div>
        </div>
        <button
          onClick={handleJoinRevolution}
          className="w-full py-3 bg-white/20 hover:bg-white/30 text-white rounded-2xl font-black uppercase text-xs tracking-widest transition-all border border-white/20"
        >
          🔥 Unisciti alla Rivoluzione (Placeholder)
        </button>
      </div>

      {wars.active.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-black uppercase tracking-tight">Guerre in Corso</h3>
          <div className="grid grid-cols-1 gap-4">
            {wars.active.map((war: any) => {
              const [expanded, setExpanded] = useState(false);
              const [deploying, setDeploying] = useState(false);

              const isAttackerPatriot = war.attackerCountryIso2 === user.originalNation;
              const isDefenderPatriot = war.defenderCountryIso2 === user.originalNation;

              const totalScore = war.attackerScore + war.defenderScore || 1;
              const attackerPct = (war.attackerScore / totalScore) * 100;
              const defenderPct = (war.defenderScore / totalScore) * 100;

              const handleDeploy = async (side: 'attacker' | 'defender', weaponId: string) => {
                setDeploying(true);
                try {
                  const res = await fetch("/api/wars/deploy", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ warId: war.id, side, weaponId })
                  });
                  const data = await res.json();
                  if (data.error) alert(data.error);
                  else {
                    fetchData(); // Refresh scores and user resources
                  }
                } catch {
                  alert("Errore durante lo schieramento.");
                } finally {
                  setDeploying(false);
                }
              };

              return (
                <div key={war.id}
                  className={`bg-white p-6 rounded-[2.5rem] shadow-sm border cursor-pointer transition-all ${isAttackerPatriot || isDefenderPatriot ? 'border-rose-400 shadow-rose-100/50 hover:shadow-rose-200' : 'border-slate-100 hover:shadow-md'}`}
                  onClick={(e) => {
                    // Prevent toggle if clicking buttons
                    if ((e.target as HTMLElement).closest('button')) return;
                    setExpanded(!expanded);
                  }}>

                  {(isAttackerPatriot || isDefenderPatriot) && (
                    <div className="flex justify-center mb-4">
                      <span className="bg-rose-100 text-rose-700 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-xl flex items-center gap-1">
                        <Swords className="w-3 h-3" /> Bonus Patriota Attivo (+10% Danni)
                      </span>
                    </div>
                  )}

                  <div className="flex justify-center mb-4">
                    <WarTimer endsAt={war.endsAt} />
                  </div>

                  <div className="flex justify-between items-center mb-4">
                    <div className="text-center flex-1">
                      <p className={`text-2xl font-black ${isAttackerPatriot ? 'text-rose-600' : ''}`}>{war.attackerCountryIso2}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Attaccante</p>
                      <p className="text-xs font-black text-indigo-500 mt-1">{war.attackerScore.toLocaleString()}</p>
                    </div>
                    <div className="px-4 font-black flex flex-col items-center gap-1">
                      <span className="text-slate-300">VS</span>
                      {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    </div>
                    <div className="text-center flex-1">
                      <p className={`text-2xl font-black ${isDefenderPatriot ? 'text-emerald-600' : ''}`}>{war.defenderCountryIso2}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Difensore</p>
                      <p className="text-xs font-black text-rose-500 mt-1">{war.defenderScore.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden flex mb-2 relative">
                    <div className="bg-indigo-500 h-full transition-all duration-500" style={{ width: `${attackerPct}%` }}></div>
                    <div className="bg-rose-500 h-full transition-all duration-500" style={{ width: `${defenderPct}%` }}></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-1 h-full bg-white/50"></div>
                    </div>
                  </div>

                  {/* Expanded Deploy Section */}
                  <AnimatePresence>
                    {expanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden mt-6 pt-6 border-t border-slate-50"
                      >
                        <h4 className="text-center text-sm font-black text-slate-800 uppercase tracking-widest mb-4">Schieramento Militare</h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {/* Attacker Side */}
                          <div className="space-y-3 bg-indigo-50 rounded-3xl p-4 border border-indigo-100/50">
                            <h5 className="text-center text-xs font-black text-indigo-700 uppercase mb-3">Supporta Attaccante</h5>
                            <button disabled={deploying} onClick={() => handleDeploy('attacker', 'infantry')} className="w-full bg-white hover:bg-indigo-100 text-slate-800 border border-indigo-200/50 p-3 rounded-2xl flex items-center justify-between transition-colors shadow-sm">
                              <span className="font-bold text-sm flex items-center gap-2">🪖 Fanteria</span>
                              <div className="flex flex-col items-end">
                                <span className="text-xs font-black text-indigo-600">+100 Danni</span>
                                <span className="text-[10px] font-bold text-slate-400">-10⚡ -$50</span>
                              </div>
                            </button>
                            <button disabled={deploying} onClick={() => handleDeploy('attacker', 'tank')} className="w-full bg-white hover:bg-indigo-100 text-slate-800 border border-indigo-200/50 p-3 rounded-2xl flex items-center justify-between transition-colors shadow-sm">
                              <span className="font-bold text-sm flex items-center gap-2">🛡️ Divisione Corazzata</span>
                              <div className="flex flex-col items-end">
                                <span className="text-xs font-black text-indigo-600">+1000 Danni</span>
                                <span className="text-[10px] font-bold text-slate-400">-30⚡ -$500</span>
                              </div>
                            </button>
                            <button disabled={deploying} onClick={() => handleDeploy('attacker', 'airstrike')} className="w-full bg-white hover:bg-indigo-100 text-slate-800 border border-indigo-200/50 p-3 rounded-2xl flex items-center justify-between transition-colors shadow-sm">
                              <span className="font-bold text-sm flex items-center gap-2">✈️ Supporto Aereo</span>
                              <div className="flex flex-col items-end">
                                <span className="text-xs font-black text-indigo-600">+5000 Danni</span>
                                <span className="text-[10px] font-bold text-slate-400">-50⚡ -$2000</span>
                              </div>
                            </button>
                          </div>

                          {/* Defender Side */}
                          <div className="space-y-3 bg-rose-50 rounded-3xl p-4 border border-rose-100/50">
                            <h5 className="text-center text-xs font-black text-rose-700 uppercase mb-3">Supporta Difensore</h5>
                            <button disabled={deploying} onClick={() => handleDeploy('defender', 'infantry')} className="w-full bg-white hover:bg-rose-100 text-slate-800 border border-rose-200/50 p-3 rounded-2xl flex items-center justify-between transition-colors shadow-sm">
                              <span className="font-bold text-sm flex items-center gap-2">🪖 Fanteria</span>
                              <div className="flex flex-col items-end">
                                <span className="text-xs font-black text-rose-600">+100 Danni</span>
                                <span className="text-[10px] font-bold text-slate-400">-10⚡ -$50</span>
                              </div>
                            </button>
                            <button disabled={deploying} onClick={() => handleDeploy('defender', 'tank')} className="w-full bg-white hover:bg-rose-100 text-slate-800 border border-rose-200/50 p-3 rounded-2xl flex items-center justify-between transition-colors shadow-sm">
                              <span className="font-bold text-sm flex items-center gap-2">🛡️ Divisione Corazzata</span>
                              <div className="flex flex-col items-end">
                                <span className="text-xs font-black text-rose-600">+1000 Danni</span>
                                <span className="text-[10px] font-bold text-slate-400">-30⚡ -$500</span>
                              </div>
                            </button>
                            <button disabled={deploying} onClick={() => handleDeploy('defender', 'airstrike')} className="w-full bg-white hover:bg-rose-100 text-slate-800 border border-rose-200/50 p-3 rounded-2xl flex items-center justify-between transition-colors shadow-sm">
                              <span className="font-bold text-sm flex items-center gap-2">✈️ Supporto Aereo</span>
                              <div className="flex flex-col items-end">
                                <span className="text-xs font-black text-rose-600">+5000 Danni</span>
                                <span className="text-[10px] font-bold text-slate-400">-50⚡ -$2000</span>
                              </div>
                            </button>
                          </div>
                        </div>

                        {/* Auto-Attack Toggle */}
                        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-black text-amber-800 text-sm uppercase">⚡ Modalità Automatica</p>
                              <p className="text-[10px] font-bold text-amber-600">Attacca ogni 10 min (consuma energia e cash)</p>
                            </div>
                            {autoAttack?.warId === war.id && (
                              <button onClick={() => setAutoAttack(null)} className="px-4 py-2 bg-red-500 text-white rounded-xl font-black text-xs uppercase hover:bg-red-600">
                                ⏹ Ferma
                              </button>
                            )}
                          </div>
                          {autoAttack?.warId === war.id ? (
                            <div className="bg-amber-100 rounded-xl p-3 flex items-center gap-2">
                              <span className="animate-pulse text-lg">⚔️</span>
                              <span className="text-xs font-black text-amber-800">
                                Auto-attacco attivo: {autoAttack.side === 'attacker' ? 'Attaccante' : 'Difensore'} con {autoAttack.weaponId === 'infantry' ? 'Fanteria' : autoAttack.weaponId === 'tank' ? 'Corazzata' : 'Aereo'}
                              </span>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              {(['attacker', 'defender'] as const).map(side => (
                                <div key={side} className="space-y-1">
                                  <p className="text-[9px] font-black text-center uppercase text-amber-700">{side === 'attacker' ? 'Attaccante' : 'Difensore'}</p>
                                  {(['infantry', 'tank', 'airstrike'] as const).map(wep => (
                                    <button key={wep} onClick={() => setAutoAttack({ warId: war.id, side, weaponId: wep })} className="w-full py-1.5 px-2 bg-white border border-amber-200 rounded-lg text-[10px] font-black text-amber-800 hover:bg-amber-100 transition-all">
                                      {wep === 'infantry' ? '🪖 Fanteria' : wep === 'tank' ? '🛡️ Corazzata' : '✈️ Aereo'}
                                    </button>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-black uppercase tracking-tight">Storico Recente</h3>
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
          {wars.ended.map((war: any, i: number) => (
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
                <p className="text-[10px] text-slate-400 font-bold">
                  {new Date(war.endsAt).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          {wars.ended.length === 0 && (
            <div className="p-8 text-center text-slate-400 font-medium">Nessuna guerra terminata di recente.</div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const PERK_ICONS: Record<string, string> = {
  FORZA: "⚔️",
  EDUCAZIONE: "📚",
  INDUSTRIA: "🏭",
  LOGISTICA: "🔋"
};

const formatTime = (ms: number) => {
  if (ms <= 0) return "Pronto!";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${String(m % 60).padStart(2, '0')}m ${String(s % 60).padStart(2, '0')}s`;
  if (m > 0) return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return `00:${String(s).padStart(2, '0')}`;
};

// Helper for live perk countdowns (mm:ss or hh:mm:ss)
const TravelTimer = ({ endsAt, onComplete }: { endsAt: number | any; onComplete?: () => void }) => {
  const ts = getTs(endsAt);
  const [remaining, setRemaining] = useState(() => Math.max(0, ts - Date.now()));

  useEffect(() => {
    const tick = () => {
      const r = Math.max(0, getTs(endsAt) - Date.now());
      setRemaining(r);
      if (r === 0) { onComplete?.(); }
    };
    if (Math.max(0, getTs(endsAt) - Date.now()) <= 0) { onComplete?.(); return; }
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [endsAt]);

  return <span className="tabular-nums">{remaining > 0 ? formatRemaining(remaining) : "Arrivato!"}</span>;
};

const PerkTimer = ({ willCompleteAt, onComplete }: { willCompleteAt: number | any; onComplete?: () => void }) => {
  const ts = getTs(willCompleteAt);
  const [remaining, setRemaining] = useState(() => Math.max(0, ts - Date.now()));

  useEffect(() => {
    const tick = () => {
      const r = Math.max(0, getTs(willCompleteAt) - Date.now());
      setRemaining(r);
      if (r === 0) { onComplete?.(); }
    };
    if (Math.max(0, getTs(willCompleteAt) - Date.now()) <= 0) { onComplete?.(); return; }
    const iv = setInterval(tick, 500);
    return () => clearInterval(iv);
  }, [willCompleteAt]);

  return <span className="text-amber-600 font-black text-xs tabular-nums">{formatRemaining(remaining)}</span>;
};

// Self-contained progress bar for perk upgrades
const PerkProgressBar = ({ startedAt, willCompleteAt }: { startedAt: number | any; willCompleteAt: number | any }) => {
  const start = getTs(startedAt);
  const end = getTs(willCompleteAt);
  const [pct, setPct] = useState(() => {
    if (end === start) return 0;
    return Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100));
  });

  useEffect(() => {
    const iv = setInterval(() => {
      const s = getTs(startedAt);
      const e = getTs(willCompleteAt);
      if (e === s) setPct(100);
      else setPct(Math.min(100, Math.max(0, ((Date.now() - s) / (e - s)) * 100)));
    }, 500);
    return () => clearInterval(iv);
  }, [startedAt, willCompleteAt]);

  return (
    <div className="bg-amber-400 h-full rounded-full transition-none" style={{ width: `${pct}%` }} />
  );
};



// Inline username editor
const UsernameEditor = ({ username, fetchData }: { username: string; fetchData: () => void }) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(username);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (value.trim() === username) { setEditing(false); return; }
    setSaving(true); setErr(null);
    try {
      const res = await fetch("/api/profile/username", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: value }),
      });
      const data = await res.json();
      if (data.error) setErr(data.error);
      else { setEditing(false); fetchData(); }
    } catch { setErr("Errore di rete"); }
    finally { setSaving(false); }
  };

  if (editing) return (
    <div className="flex flex-col items-center gap-2 mt-1">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={value}
          onChange={e => { setValue(e.target.value); setErr(null); }}
          onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          className="text-xl font-black text-slate-900 text-center border-b-2 border-indigo-400 bg-transparent outline-none w-40"
          maxLength={20}
        />
        <button onClick={save} disabled={saving} className="w-7 h-7 bg-indigo-600 rounded-xl flex items-center justify-center text-white disabled:opacity-50"><CheckCircle2 className="w-4 h-4" /></button>
        <button onClick={() => { setEditing(false); setValue(username); }} className="w-7 h-7 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500"><span className="text-sm font-black">✕</span></button>
      </div>
      {err && <p className="text-[10px] font-bold text-rose-500">{err}</p>}
    </div>
  );

  return (
    <div className="flex items-center justify-center gap-2 mt-1">
      <h2 className="text-2xl font-black text-slate-900">{username}</h2>
      <button onClick={() => setEditing(true)} className="w-6 h-6 bg-slate-100 hover:bg-indigo-50 rounded-lg flex items-center justify-center transition-colors" title="Cambia nickname">
        <Edit2 className="w-3 h-3 text-slate-400 hover:text-indigo-600" />
      </button>
    </div>
  );
};

// Player Factories View (New Resource System)
const RESOURCE_ICONS: Record<string, string> = {
  gold: "🪙",
  oil: "🛢️",
  minerals: "🪨",
  uranium: "☢️",
  diamonds: "💎",
  liquid_oxygen: "🧊",
  helium3: "⚗️",
  rivalium: "🔮",
};

const RESOURCE_NAMES: Record<string, string> = {
  gold: "Oro",
  oil: "Petrolio",
  minerals: "Minerali",
  uranium: "Uranio",
  diamonds: "Diamanti",
  liquid_oxygen: "Ossigeno Liquido",
  helium3: "Elio-3",
  rivalium: "Rivalium",
};

const FACTORY_CREATE_COST = FACTORY_CONFIG.CREATE_COST;

const PlayerFactoriesView = ({ user, fetchData, autoWorkFactoryId, setAutoWorkFactoryId }: { user: any; fetchData: () => void; autoWorkFactoryId?: string | null; setAutoWorkFactoryId?: (id: string | null) => void }) => {
  const { iso2 } = useParams();
  const navigate = useNavigate();
  const [factories, setFactories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("oil");
  const [actionLoading, setActionLoading] = useState(false);
  const [depositAmounts, setDepositAmounts] = useState<Record<string, string>>({});
  const [factorySearch, setFactorySearch] = useState("");
  const [showWorldFactories, setShowWorldFactories] = useState(false);
  const [upgradeTarget, setUpgradeTarget] = useState<Record<string, string>>({});
  const [upgradeCost, setUpgradeCost] = useState<Record<string, number | null>>({});

  const regionId = iso2 ? iso2.toUpperCase() : (user?.regionId || "IT");

  const load = async () => {
    try {
      const res = await fetch(`/api/factories?regionId=${regionId}`);
      if (res.ok) setFactories(await res.json());
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [regionId]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/factories/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, type: newType, regionId }),
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else { setCreating(false); setNewName(""); fetchData(); load(); }
    } catch { alert("Errore"); } finally { setActionLoading(false); }
  };

  const handleDeposit = async (id: string) => {
    const amount = depositAmounts[id];
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/factories/deposit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factoryId: id, amount: Number(amount) }),
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else {
        setDepositAmounts(prev => ({ ...prev, [id]: "" }));
        fetchData(); load();
      }
    } catch { alert("Errore"); } finally { setActionLoading(false); }
  };

  const handleWork = async (id: string) => {
    setActionLoading(true);
    const factory = factories.find((f: any) => f.id === id);
    try {
      const res = await fetch("/api/work", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factoryId: id }),
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else {
        if (data.payMode === 'resource') {
          alert(`Hai lavorato! +${data.output} ${factory?.type || 'risorse'} per te, ${data.ownerShare} al proprietario, ${data.stateShare} allo stato.`);
        } else {
          alert(`Hai lavorato! +$${data.earnings} salario.${data.output ? ` L'azienda ha prodotto ${data.output} risorse.` : ''}`);
        }
        fetchData(); load();
      }
    } catch { alert("Errore"); } finally { setActionLoading(false); }
  };

  const fetchUpgradeCost = async (factoryId: string, currentLevel: number, target: string) => {
    const targetNum = parseInt(target);
    if (!targetNum || targetNum <= currentLevel || targetNum > 800) {
      setUpgradeCost(prev => ({ ...prev, [factoryId]: null }));
      return;
    }
    try {
      const res = await fetch(`/api/factories/upgrade-cost?currentLevel=${currentLevel}&targetLevel=${targetNum}`);
      const data = await res.json();
      if (data.goldCost !== undefined) {
        setUpgradeCost(prev => ({ ...prev, [factoryId]: data.goldCost }));
      } else {
        setUpgradeCost(prev => ({ ...prev, [factoryId]: null }));
      }
    } catch {
      setUpgradeCost(prev => ({ ...prev, [factoryId]: null }));
    }
  };

  const handleUpgrade = async (id: string, currentLevel: number) => {
    const target = parseInt(upgradeTarget[id] || String(currentLevel + 1));
    if (!target || target <= currentLevel || target > 800) {
      alert("Livello target non valido.");
      return;
    }
    const cost = upgradeCost[id];
    const costDisplay = cost != null ? cost : '?';
    if (!window.confirm(`Vuoi potenziare la fabbrica dal livello ${currentLevel} al livello ${target}? Costo: 🪙 ${costDisplay} Gold`)) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/factories/upgrade", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factoryId: id, targetLevel: target }),
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else {
        alert(`Fabbrica potenziata al livello ${data.newLevel}! Costo: 🪙 ${data.goldCost} Gold`);
        setUpgradeTarget(prev => ({ ...prev, [id]: '' }));
        setUpgradeCost(prev => ({ ...prev, [id]: null }));
        fetchData(); load();
      }
    } catch { alert("Errore"); } finally { setActionLoading(false); }
  };

  const handlePayMode = async (id: string, payMode: string) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/factories/paymode", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factoryId: id, payMode }),
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else { load(); }
    } catch { alert("Errore"); } finally { setActionLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-black tracking-tight uppercase">Fabbriche Locali</h3>
        <button
          onClick={() => setCreating(!creating)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-indigo-100 hover:scale-105 transition-all"
        >
          {creating ? "Annulla" : <><Plus className="w-4 h-4" /> Fonda Azienda</>}
        </button>
      </div>

      {/* Factory search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={factorySearch}
          onChange={e => setFactorySearch(e.target.value)}
          placeholder="Cerca fabbrica..."
          className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white border border-slate-100 focus:ring-4 focus:ring-indigo-50 outline-none text-sm font-bold text-slate-700"
        />
      </div>

      {/* Scope buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowWorldFactories(false)}
          className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!showWorldFactories ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-100'}`}
        >
          Fabbriche in {user.regionId}
        </button>
        <button
          onClick={() => setShowWorldFactories(true)}
          className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${showWorldFactories ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-100'}`}
        >
          🌍 Fabbriche nel mondo
        </button>
      </div>

      {showWorldFactories && (
        <div className="bg-white p-8 rounded-[2rem] text-center border border-dashed border-slate-200 space-y-4">
          <Globe className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-bold text-sm">Esplora le fabbriche di tutto il mondo</p>
          <button
            onClick={() => navigate('/world-factories')}
            className="px-6 py-3 bg-emerald-500 text-white rounded-2xl font-black uppercase text-xs shadow-md hover:bg-emerald-600 transition-all"
          >
            🌍 Lista Fabbriche
          </button>
        </div>
      )}

      {creating && (
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-6 rounded-[2rem] shadow-lg text-white space-y-4">
          <h4 className="font-black">Nuova Azienda in {regionId}</h4>
          <div className="grid grid-cols-2 gap-2">
            {Object.keys(FACTORY_CREATE_COST).map(type => (
              <button key={type} onClick={() => setNewType(type)}
                className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-1 ${newType === type ? "bg-white text-indigo-900 border-white shadow-md" : "border-indigo-400 bg-indigo-600/50 hover:bg-indigo-500 text-indigo-100"}`}>
                <span className="text-2xl mb-1">{RESOURCE_ICONS[type]}</span>
                <span className="text-[10px] font-black uppercase">{RESOURCE_NAMES[type]}</span>
                <span className="text-[9px] font-bold opacity-80">${FACTORY_CREATE_COST[type as keyof typeof FACTORY_CREATE_COST].toLocaleString()}</span>
              </button>
            ))}
          </div>
          <input
            value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Nome dell'azienda..."
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-2xl font-bold text-white placeholder-indigo-200 outline-none focus:ring-2 focus:ring-white transition-all"
            maxLength={30}
          />
          <button onClick={handleCreate} disabled={actionLoading || !newName.trim()}
            className="w-full py-3 bg-white text-indigo-900 rounded-2xl font-black text-sm hover:bg-indigo-50 transition-all shadow-md disabled:opacity-50">
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : `Fonda per $${FACTORY_CREATE_COST[newType as keyof typeof FACTORY_CREATE_COST].toLocaleString()}`}
          </button>
        </div>
      )}

      {!showWorldFactories && loading ? (
        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-indigo-600 w-8 h-8" /></div>
      ) : !showWorldFactories && factories.length === 0 ? (
        <div className="bg-white p-10 rounded-[2rem] text-center border border-slate-100 shadow-sm">
          <span className="text-4xl">🏗️</span>
          <p className="text-slate-400 font-bold text-sm mt-3">Nessuna fabbrica in questa regione. Sii il primo ad investire qui!</p>
        </div>
      ) : !showWorldFactories ? (() => {
        const searchLower = factorySearch.trim().toLowerCase();
        const filteredFactories = searchLower
          ? factories.filter(f => f.name.toLowerCase().includes(searchLower) || (f.ownerName || '').toLowerCase().includes(searchLower))
          : factories;
        return (
        <div className="grid gap-4">
          {filteredFactories.map(f => {
            const isOwner = f.ownerUserId === user?.id;
            const isResourceMode = f.payMode === 'resource';
            const needsBudget = !isResourceMode && f.budget < f.wage;

            return (
              <div key={f.id} className={`bg-white p-5 rounded-[2.5rem] shadow-sm border ${isOwner ? "border-indigo-200" : "border-slate-100"} space-y-4`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-3xl flex items-center justify-center text-3xl shadow-inner ${isOwner ? "bg-indigo-50 text-indigo-600" : "bg-slate-50"}`}>
                      {RESOURCE_ICONS[f.type] || "🏭"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-slate-900 text-lg leading-none tracking-tight">{f.name}</h4>
                        {isOwner && <span className="text-[9px] font-black uppercase text-white bg-indigo-500 px-2 py-0.5 rounded-lg shadow-sm">La Tua Azienda</span>}
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                        Estrazione <span className="text-slate-600">{RESOURCE_NAMES[f.type]}</span> • CEO <span className="text-indigo-500">{f.ownerName}</span>
                        {isResourceMode ? <span className="ml-2 text-emerald-600">• Modalità Risorse</span> : <span className="ml-2 text-amber-600">• Stipendio Fisso</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-2xl font-black text-slate-900">Lv {f.level}</span>
                    <span className="text-[9px] font-black uppercase text-indigo-500 tracking-widest bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{f.exp} XP</span>
                  </div>
                </div>

                {isResourceMode ? (
                  <div className="bg-emerald-50 p-3 rounded-2xl flex items-center justify-between border border-emerald-100/50">
                    <span className="text-[10px] font-black uppercase text-emerald-700/70">Modalità</span>
                    <span className="text-xs font-black text-emerald-700">🪨 Scava {RESOURCE_NAMES[f.type]} (diviso tra player, proprietario e stato)</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 pb-4 border-b border-slate-50">
                    <div className="bg-emerald-50 p-3 rounded-2xl flex items-center justify-between border border-emerald-100/50">
                      <span className="text-[10px] font-black uppercase text-emerald-700/70">Salario Offerto</span>
                      <span className="text-sm font-black text-emerald-700">${f.wage}</span>
                    </div>
                    <div className={`${needsBudget ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'} p-3 rounded-2xl flex items-center justify-between border`}>
                      <span className={`text-[10px] font-black uppercase ${needsBudget ? 'text-rose-700/70' : 'text-slate-500'}`}>Budget Aziendale</span>
                      <span className={`text-sm font-black ${needsBudget ? 'text-rose-600' : 'text-slate-700'}`}>${f.budget}</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleWork(f.id)}
                    disabled={actionLoading || needsBudget}
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none"
                  >
                    {isResourceMode ? `🪨 Scava ${RESOURCE_NAMES[f.type]} (-10⚡)` : '💼 Lavora Qui (-10⚡)'}
                  </button>
                  <button
                    onClick={() => navigate(`/factory/${f.id}`)}
                    className="py-3 px-4 bg-slate-100 text-slate-700 rounded-2xl font-black uppercase text-xs hover:bg-slate-200 transition-all"
                    title="Dettagli fabbrica"
                  >
                    📋
                  </button>
                  {setAutoWorkFactoryId && (
                    autoWorkFactoryId === f.id ? (
                      <button
                        onClick={() => setAutoWorkFactoryId(null)}
                        className="py-3 px-4 bg-red-500 text-white rounded-2xl font-black uppercase text-xs shadow-lg hover:bg-red-600 transition-all"
                      >
                        ⏹ Stop
                      </button>
                    ) : (
                      <button
                        onClick={() => setAutoWorkFactoryId(f.id)}
                        disabled={!!autoWorkFactoryId}
                        className="py-3 px-4 bg-amber-500 text-white rounded-2xl font-black uppercase text-xs shadow-lg hover:bg-amber-600 transition-all disabled:opacity-50"
                        title="Attiva lavoro automatico ogni 10 minuti"
                      >
                        🤖 Auto
                      </button>
                    )
                  )}
                </div>

                {isOwner && (
                  <div className="pt-3 space-y-3">
                    {/* Pay mode toggle */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePayMode(f.id, 'salary')}
                        disabled={actionLoading || !isResourceMode}
                        className={`flex-1 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${!isResourceMode ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                      >
                        💰 Stipendio Fisso
                      </button>
                      <button
                        onClick={() => handlePayMode(f.id, 'resource')}
                        disabled={actionLoading || isResourceMode}
                        className={`flex-1 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${isResourceMode ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                      >
                        🪨 Modalità Risorse
                      </button>
                    </div>
                    {/* Deposit + Upgrade (only show deposit for salary mode) */}
                    <div className="flex gap-2">
                      {!isResourceMode && (
                        <div className="flex-[2] flex gap-2">
                          <input
                            type="number"
                            min="1"
                            placeholder="Importo..."
                            value={depositAmounts[f.id] || ""}
                            onChange={e => setDepositAmounts(prev => ({ ...prev, [f.id]: e.target.value }))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <button
                            onClick={() => handleDeposit(f.id)}
                            disabled={actionLoading || !depositAmounts[f.id]}
                            className="px-4 py-2 bg-emerald-500 text-white font-black text-[10px] uppercase rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-50 whitespace-nowrap"
                          >
                            Versa Budget
                          </button>
                        </div>
                      )}
                      <div className="space-y-2 mt-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">⬆️ Potenzia Fabbrica</label>
                        <div className="flex gap-2 items-center">
                          <span className="text-xs font-bold text-slate-600 whitespace-nowrap">Lv {f.level || 1} →</span>
                          <input
                            type="number"
                            min={(f.level || 1) + 1}
                            max={800}
                            placeholder={`Lv ${(f.level || 1) + 1}`}
                            value={upgradeTarget[f.id] || ""}
                            onChange={e => {
                              const val = e.target.value;
                              setUpgradeTarget(prev => ({ ...prev, [f.id]: val }));
                              fetchUpgradeCost(f.id, f.level || 1, val);
                            }}
                            className="w-24 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                          />
                          {upgradeCost[f.id] != null && (
                            <span className="text-xs font-bold text-amber-600">🪙 {upgradeCost[f.id]} Gold</span>
                          )}
                        </div>
                        <button
                          onClick={() => handleUpgrade(f.id, f.level || 1)}
                          disabled={actionLoading}
                          className="w-full py-3 bg-amber-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-md shadow-amber-100 hover:bg-amber-600 hover:scale-[1.02] transition-all disabled:opacity-50"
                        >
                          ⬆️ Potenzia {upgradeTarget[f.id] ? `al Lv ${upgradeTarget[f.id]}` : `al Lv ${(f.level || 1) + 1}`} {upgradeCost[f.id] != null ? `(🪙 ${upgradeCost[f.id]} Gold)` : ''}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        );
      })() : null}
    </div>
  );
};

// Toast notification component
const Toast = ({ message, onDismiss }: { key?: React.Key; message: string; onDismiss: () => void }) => (
  <motion.div
    initial={{ opacity: 0, y: 40, scale: 0.9 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 40, scale: 0.9 }}
    className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[999] bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl shadow-emerald-200 flex items-center gap-3 max-w-[90vw]"
  >
    <CheckCircle2 className="w-5 h-5 shrink-0" />
    <span className="font-black text-sm">{message}</span>
    <button onClick={onDismiss} className="ml-2 text-emerald-200 hover:text-white text-xs font-black">✕</button>
  </motion.div>
);

const ProfileView = ({ user, handleUpgradePerk, handleActivateBooster, actionLoading, fetchData, regions, nations }: { user: any, handleUpgradePerk: (id: string, useGold: boolean) => void, handleActivateBooster: (id: string, useGold: boolean) => void, actionLoading: boolean, fetchData: () => void, regions: any[], nations: any[] }) => {
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now());
  const [toasts, setToasts] = useState<{ id: string; message: string }[]>([]);
  const [expandedStats, setExpandedStats] = useState<Set<string>>(new Set());

  // Messages state
  const [showMessages, setShowMessages] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Settings state
  const [showSettings, setShowSettings] = useState(false);

  const addToast = (message: string, id: string) => {
    setToasts(prev => prev.some(t => t.id === id) ? prev : [...prev, { id, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const dismissToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    fetch("/api/messages/unread-count").then(r => r.json()).then(d => setUnreadCount(d.count || 0)).catch(() => {});
  }, []);

  const handleDevCheat = async () => {
    try {
      const res = await fetch("/api/dev/add-currency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cash: 10000, gold: 10000 })
      });
      if (res.ok) {
        addToast("💰 Cheat attivato!", "cheat");
        fetchData();
      }
    } catch (err) { console.error(err); }
  };

  const toggleStat = (id: string) => {
    setExpandedStats(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const levelProgress = useMemo(() => {
    const nextLevelXp = Math.floor(GAME_CONFIG.LEVEL_UP_BASE_XP * Math.pow(GAME_CONFIG.LEVEL_UP_FACTOR, (user.level || 1) - 1));
    return Math.min(100, (user.xp / nextLevelXp) * 100);
  }, [user.level, user.xp]);

  const activeUpgrade = PERKS_DEFS.find(p => {
    const u = user.perkUpgrades?.[p.id];
    return u && getTs(u.willCompleteAt) > now;
  });

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans pb-32 -mx-4 -mt-4">
      <AnimatePresence>
        {toasts.map(({ id, message }) => <Toast key={id} message={message} onDismiss={() => { dismissToast(id); }} />)}
      </AnimatePresence>

      <header className="bg-gray-900/95 backdrop-blur-md sticky top-0 z-40 h-16 flex items-center justify-between px-6 border-b border-gray-800/50">
        <button onClick={() => setShowMessages(true)} className="p-2 hover:bg-gray-800/80 rounded-lg relative">
          <Mail className="w-8 h-8 text-[#76ff03]" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-[10px] min-w-[20px] h-5 flex items-center justify-center rounded-sm font-black px-1 border border-black shadow-lg">
              {unreadCount}
            </span>
          )}
        </button>
        <h1 className="text-2xl font-black text-gray-50 uppercase tracking-tight military-font">IL MIO PROFILO</h1>
        <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-gray-800/80 rounded-lg">
          <Settings className="w-8 h-8 text-white" />
        </button>
      </header>

      <main className="p-6 space-y-6">
        <div className="flex gap-6 items-start">
          <div 
            className="w-32 h-32 bg-gray-800 rounded-sm relative overflow-hidden shrink-0 cursor-pointer border-4 border-gray-700/50 shadow-2xl"
            onClick={() => (document.getElementById("avatar-file-input") as HTMLInputElement)?.click()}
          >
             {user.avatarData ? (
                <img src={user.avatarData} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-6xl font-black text-white/20">
                    {user.username ? user.username[0].toUpperCase() : "?"}
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-8 h-8 text-white" />
              </div>
              <input id="avatar-file-input" type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const img = new Image();
                    img.onload = async () => {
                        const SIZE = 256;
                        const canvas = document.createElement("canvas");
                        canvas.width = SIZE; canvas.height = SIZE;
                        const ctx = canvas.getContext("2d")!;
                        const scale = Math.max(SIZE / img.width, SIZE / img.height);
                        const sw = img.width * scale; const sh = img.height * scale;
                        ctx.drawImage(img, (SIZE - sw) / 2, (SIZE - sh) / 2, sw, sh);
                        const base64 = canvas.toDataURL("image/jpeg", 0.85);
                        try {
                            const res = await fetch("/api/profile/avatar", {
                                method: "POST", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ avatarData: base64 }),
                            });
                            if (res.ok) fetchData();
                        } catch (_) { alert("Errore caricamento"); }
                    };
                    img.src = URL.createObjectURL(file);
                    e.target.value = "";
                }}
              />
          </div>

          <div className="flex-1 space-y-2 pt-1">
            <div className="flex items-center gap-3">
              <NationLogo iso2={user.displayedNation || "it"} logo={nations.find(n => n.id === user.displayedNation)?.logo} className="w-10 h-6 rounded-none" />
              <span className="text-xl font-black text-gray-50 uppercase tracking-tight">{user.username}</span>
            </div>
            <p className="text-xs text-gray-400 font-bold">In-game ID: {user.id.slice(0, 8)}...</p>
            <div className="pt-4">
                <p className="text-sm font-black text-gray-50 mb-2">Livello: {user.level || 1}</p>
                <div className="w-full bg-black/40 h-2 rounded-none overflow-hidden border border-white/5">
                    <div className="bg-[#4caf50] h-full transition-all" style={{ width: `${levelProgress}%` }} />
                </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 py-4 px-6 flex justify-between items-center shadow-inner border border-gray-800/50">
            <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-gray-50 military-font tracking-wider">{(user.money || 0).toLocaleString()}</span>
                <span className="text-2xl font-black text-gray-50 military-font">€</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-amber-400 military-font tracking-wider">{(user.gold || 0).toLocaleString()}</span>
                <span className="text-2xl font-black text-amber-400 military-font">G</span>
            </div>
        </div>

        <div className="space-y-3 pt-2">
            <button className="w-full bg-[#4caf50] hover:bg-[#43a047] text-white py-4 rounded-none font-black text-base shadow-xl transition-all active:scale-[0.99] uppercase tracking-widest military-font">
                Compra Account Premium
            </button>
            <button className="w-full bg-transparent hover:bg-white/5 text-gray-400 py-4 rounded-none font-bold text-sm uppercase border border-gray-800/50 transition-all tracking-tight military-font">
                Compra Gold
            </button>
        </div>

        <div className="space-y-1">
            <div className="bg-gray-800 p-4 flex justify-between items-center border-y border-gray-700/50">
                <span className="text-sm font-black text-gray-300 uppercase tracking-widest text-[11px] military-font">Informazioni Unità Operativa</span>
            </div>
            <div className="bg-gray-900/50 p-5 space-y-6">
                <button onClick={() => navigate(`/regions/${user.regionId}`)} className="flex gap-4 items-center w-full text-left hover:bg-white/5 rounded-lg p-1 -m-1 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center border border-gray-600/30 overflow-hidden shadow-lg">
                        {(() => {
                            const rData = regions.find(r => r.id === user.regionId);
                            const nId = rData?.nation_id || rData?.id; 
                            return <NationLogo iso2={nId || "it"} logo={nations.find(n => n.id === nId)?.logo} className="w-8 h-5" />;
                        })()}
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-black text-gray-50 uppercase tracking-tight military-font">Posizione: {regions.find(r => r.id === user.regionId)?.name || user.regionId}</p>
                        <p className="text-[11px] text-emerald-400 font-black uppercase tracking-widest opacity-80 military-font">Settore Operativo</p>
                    </div>
                </button>
                <button onClick={() => navigate(`/regions/${user.residenceId}`)} className="flex gap-4 items-center w-full text-left hover:bg-white/5 rounded-lg p-1 -m-1 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-slate-950 flex items-center justify-center border border-gray-600/30 overflow-hidden shadow-lg">
                        {(() => {
                            const rData = regions.find(r => r.id === user.residenceId);
                            const nId = rData?.nation_id || rData?.id; 
                            return <NationLogo iso2={nId || "it"} logo={nations.find(n => n.id === nId)?.logo} className="w-8 h-5" />;
                        })()}
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-black text-gray-50 uppercase tracking-tight military-font">Residenza: {regions.find(r => r.id === user.residenceId)?.name || user.residenceId}</p>
                        <p className="text-[11px] text-gray-400 font-black uppercase military-font">Registrato il: {new Date(user.createdAt || Date.now()).toLocaleDateString()}</p>
                    </div>
                </button>
                <button onClick={() => navigate("/party")} className="flex gap-4 items-center w-full text-left hover:bg-white/5 rounded-lg p-1 -m-1 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-slate-950 flex items-center justify-center border border-gray-600/50 overflow-hidden shadow-lg">
                        {user.partyLogo ? (
                            user.partyLogo.startsWith("http") ? (
                                <img src={user.partyLogo} alt="party" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-xl">{user.partyLogo}</span>
                            )
                        ) : (
                            <Landmark className="w-6 h-6 text-amber-500" />
                        )}
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-black text-gray-50 uppercase tracking-tight military-font">Partito: {user.partyName || "Nessuna Divisione"}</p>
                        <span className="text-[11px] text-indigo-400 font-black uppercase tracking-wider military-font">Visualizza Dati</span>
                    </div>
                </button>
            </div>
        </div>

        <div className="space-y-1 pt-4">
            {PERKS_DEFS.map(perk => {
                const isExpanded = expandedStats.has(perk.id);
                const currentLevel = (user.perks || {})[perk.id] || 0;
                const cashCost = Math.round(perk.baseCashCost * Math.pow(1.5, currentLevel));
                const goldCost = Math.ceil(perk.baseGoldCost * Math.pow(1.4, currentLevel));
                const upgrade = user.perkUpgrades?.[perk.id];
                const isUpgrading = !!upgrade && getTs(upgrade.willCompleteAt) > now;
                const canAffordCash = (user.money || 0) >= cashCost;
                const canAffordGold = (user.gold || 0) >= goldCost;

                return (
                    <div key={perk.id} className="bg-gray-900 overflow-hidden border-b border-gray-800/50">
                        <button onClick={() => toggleStat(perk.id)} className="w-full p-5 flex items-center justify-between hover:bg-gray-800/80 transition-colors">
                            <div className="flex items-center gap-5">
                                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-lg shadow-white/5">
                                    {perk.id === 'FORZA' && <Swords className="w-6 h-6 text-black" />}
                                    {perk.id === 'ISTRUZIONE' && <BookOpen className="w-6 h-6 text-black" />}
                                    {perk.id === 'RESISTENZA' && <Activity className="w-6 h-6 text-black" />}
                                    {!['FORZA', 'ISTRUZIONE', 'RESISTENZA'].includes(perk.id) && <span className="text-xl filter invert">{perk.icon}</span>}
                                </div>
                                <span className="text-lg font-black uppercase tracking-tight text-gray-50 military-font">{perk.name}</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-2xl font-black text-gray-50 military-font leading-none">{currentLevel}</span>
                                <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                        </button>
                        <AnimatePresence>
                            {isExpanded && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-6 pb-8 pt-2 space-y-6 bg-black/40">
                                    <p className="text-sm text-gray-300 font-medium leading-relaxed">{perk.description}</p>
                                    {isUpgrading ? (
                                        <div className="p-5 bg-indigo-900/20 border border-indigo-500/30 rounded-none">
                                            <p className="text-[11px] font-black uppercase text-indigo-400 mb-3 tracking-widest">Potenziamento Tecnico in corso...</p>
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs font-bold text-indigo-300">Tempo stimato:</span>
                                                <span className="text-sm font-black text-indigo-200"><PerkTimer willCompleteAt={upgrade.willCompleteAt} onComplete={fetchData} /></span>
                                            </div>
                                            <div className="w-full bg-black h-2 rounded-none overflow-hidden">
                                                <div className="bg-indigo-500 h-full animate-pulse transition-all" style={{ width: `${(1 - (getTs(upgrade.willCompleteAt) - now) / (getTs(upgrade.willCompleteAt) - getTs(upgrade.startedAt))) * 100}%` }} />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-4">
                                            <button onClick={() => handleUpgradePerk(perk.id, false)} disabled={actionLoading || !!activeUpgrade || !canAffordCash} className={`p-4 rounded-none border transition-all flex flex-col items-center gap-1 ${canAffordCash && !activeUpgrade ? 'bg-gray-800 border-gray-700 hover:bg-gray-700' : 'bg-black/20 border-transparent opacity-40 cursor-not-allowed'}`}>
                                                <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Valuta Cash</span>
                                                <span className={`text-base font-black ${canAffordCash ? 'text-white' : 'text-red-500'}`}>€{cashCost.toLocaleString()}</span>
                                                <span className="text-[10px] font-bold text-gray-500">{formatDuration(Math.round(perk.baseTimeCashSec * Math.pow(1.3, currentLevel)))}</span>
                                            </button>
                                            <button onClick={() => handleUpgradePerk(perk.id, true)} disabled={actionLoading || !!activeUpgrade || !canAffordGold} className={`p-4 rounded-none border transition-all flex flex-col items-center gap-1 ${canAffordGold && !activeUpgrade ? 'bg-gray-800 border-yellow-900/20 hover:bg-gray-700' : 'bg-black/20 border-transparent opacity-40 cursor-not-allowed'}`}>
                                                <span className="text-[10px] font-black uppercase text-yellow-600 tracking-widest">Valuta Gold</span>
                                                <span className={`text-base font-black ${canAffordGold ? 'text-[#fbc02d]' : 'text-red-500'}`}>G{goldCost}</span>
                                                <span className="text-[10px] font-bold text-gray-500">{formatDuration(Math.round(perk.baseTimeGoldSec * Math.pow(1.3, currentLevel)))}</span>
                                            </button>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                );
            })}
        </div>

        <div className="flex justify-center p-12 opacity-0 hover:opacity-100 transition-opacity">
            <button onClick={handleDevCheat} className="px-6 py-3 bg-red-900/20 text-red-500 text-xs font-black uppercase rounded-none border border-red-900/30 tracking-[0.3em]">
                ADMIN: ADD RESOURCES
            </button>
        </div>
      </main>

      <AnimatePresence>
        {showSettings && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-6">
                <motion.div initial={{ scale: 0.9, y: 40 }} animate={{ scale: 1, y: 0 }} className="bg-gray-900 w-full max-w-md rounded-none border border-gray-800 overflow-hidden shadow-2xl">
                    <div className="p-5 bg-black/40 flex justify-between items-center border-b border-gray-800">
                        <h3 className="text-base font-black text-gray-50 uppercase tracking-[0.2em] military-font">SISTEMA DI CONTROLLO</h3>
                        <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-white p-2">✕</button>
                    </div>
                    <div className="p-8 space-y-6">
                        <button onClick={() => {
                                const newName = prompt("Inserire nuovo identificativo:");
                                if (newName) fetch("/api/profile/username", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: newName }) }).then(r => r.json()).then(d => { if(d.error) alert(d.error); else fetchData(); });
                            }} className="w-full p-5 bg-[#333] hover:bg-[#3d3d3d] rounded-none flex justify-between items-center transition-all border border-gray-700/30">
                            <span className="text-xs font-black text-gray-50 uppercase tracking-wider military-font">Identificativo Unico (5 G)</span>
                            <ChevronRight className="w-5 h-5 text-gray-600" />
                        </button>
                        <div className="p-5 bg-black/20 rounded-none border border-gray-800 flex justify-between items-center">
                            <span className="text-xs font-black text-gray-50 uppercase tracking-widest military-font">Logo Nazione (URL)</span>
                            <input 
                                type="text"
                                placeholder="https://..."
                                className="bg-transparent border-b border-gray-700 text-[10px] text-white focus:outline-none focus:border-indigo-500 w-32"
                                defaultValue={nations.find(n => n.id === user.displayedNation)?.logo || ""}
                                onBlur={async (e) => {
                                    const logo = e.target.value;
                                    if (!logo || !user.displayedNation) return;
                                    try {
                                        const res = await fetch("/api/leader/nation/branding", {
                                            method: "POST", headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ nationId: user.displayedNation, logo })
                                        });
                                        if (res.ok) fetchData();
                                    } catch (_) {}
                                }}
                            />
                        </div>
                        <div className="pt-8 text-center space-y-2">
                           <p className="text-[10px] text-gray-600 font-black uppercase tracking-[0.3em]">Protocollo v2.4.1</p>
                           <p className="text-[10px] text-indigo-500/40 font-bold">{user.email}</p>
                           <button onClick={() => { localStorage.removeItem('token'); window.location.reload(); }} className="mt-4 text-red-500/60 hover:text-red-500 text-[10px] font-black uppercase tracking-widest transition-colors">Disconnetti Unità</button>
                        </div>
                    </div>
                </motion.div>
             </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMessages && (
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="fixed inset-0 z-[200] bg-[#2e2e2e] flex flex-col shadow-2xl">
                <header className="bg-[#212121] h-16 flex items-center px-6 border-b border-[#1a1a1a]">
                    <button onClick={() => setShowMessages(false)} className="p-2 hover:bg-[#333] rounded-lg"><ChevronLeft /></button>
                    <h1 className="flex-1 text-center font-black tracking-[0.3em] text-[#76ff03] military-font">COMUNICAZIONI</h1>
                    <div className="w-10"></div>
                </header>
                <div className="flex-1 p-8 flex flex-col items-center justify-center space-y-6">
                    <div className="w-20 h-20 rounded-full bg-slate-900 flex items-center justify-center border border-slate-700 shadow-2xl">
                        <Mail className="w-10 h-10 text-slate-500" />
                    </div>
                    <div className="text-center space-y-2">
                        <p className="text-sm font-black text-white uppercase tracking-[0.2em] military-font">Frequenza Criptata</p>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Nessun segnale in arrivo</p>
                    </div>
                    <button onClick={() => setShowMessages(false)} className="px-10 py-4 bg-[#76ff03]/10 text-[#76ff03] border border-[#76ff03]/30 rounded-none font-black uppercase text-xs tracking-[0.3em] hover:bg-[#76ff03]/20 transition-all">
                        Chiudi Canale
                    </button>
                </div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const BudgetView = ({ regionId, user, isLeader }: { regionId: string, user: any, isLeader: boolean }) => {
  const [budgetData, setBudgetData] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [donateAmount, setDonateAmount] = useState("");
  const [donateCurrency, setDonateCurrency] = useState("EUR");

  const fetchBudget = async () => {
    try {
      const res = await fetch(`/api/budget/REGION/${regionId}`);
      const data = await res.json();
      if (!data.error) {
        setBudgetData(data.budget);
        setTransactions(data.transactions || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBudget(); }, [regionId]);

  const handleDonate = async () => {
    if (!donateAmount) return;
    try {
      const res = await fetch("/api/budget/donate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId: regionId, amount: donateAmount, currency: donateCurrency })
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else { alert("Donazione effettuata!"); fetchBudget(); setDonateAmount(""); }
    } catch { alert("Errore"); }
  };

  const handleAction = async (endpoint: string, body: any) => {
    if (!confirm("Sei sicuro?")) return;
    try {
      const res = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else { alert(data.message || "Azione completata"); fetchBudget(); }
    } catch { alert("Errore"); }
  }

  if (loading) return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500" /></div>;
  if (!budgetData) return null;

  // Check if budgetData.resources is already an object or needs parsing
  const resources = typeof budgetData.resources === 'string'
    ? JSON.parse(budgetData.resources || '{}')
    : (budgetData.resources || {});

  return (
    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
      <div className="flex items-center justify-between border-b border-indigo-50 pb-4">
        <h3 className="text-lg font-black uppercase tracking-tight text-indigo-900 flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-indigo-600" /> Bilancio di Stato
        </h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-emerald-50 p-5 rounded-3xl border border-emerald-100 flex flex-col justify-center items-center text-center">
          <p className="text-[10px] uppercase font-black tracking-widest text-emerald-600 mb-1">Fondi in €</p>
          <p className="text-xl font-black text-emerald-800">${budgetData.moneyEUR.toLocaleString()}</p>
        </div>
        {Object.entries(resources).map(([res, val]: any) => (
          <div key={res} className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex flex-col justify-center items-center text-center">
            <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-1">{res}</p>
            <p className="text-xl font-black text-slate-800">{val}</p>
          </div>
        ))}
      </div>

      {user?.level >= 60 && (
        <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100">
          <p className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2"><ArrowUpRight className="w-4 h-4 text-emerald-500" /> Dona allo Stato</p>
          <div className="flex flex-col md:flex-row gap-3">
            <input type="number" min="1" value={donateAmount} onChange={e => setDonateAmount(e.target.value)} placeholder="0" className="flex-1 px-4 py-3 bg-white rounded-xl border border-slate-200 font-bold focus:ring-2 focus:ring-emerald-500 outline-none" />
            <select value={donateCurrency} onChange={e => setDonateCurrency(e.target.value)} className="px-4 py-3 bg-white rounded-xl border border-slate-200 font-bold outline-none">
              <option value="EUR">Euro (€)</option>
              <option value="GOLD">Gold</option>
            </select>
            <button onClick={handleDonate} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-colors">Dona</button>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 font-bold">Tasso di cambio: 1 Gold = 500.000 €</p>
        </div>
      )}

      {isLeader && (
        <div className="p-5 bg-amber-50 rounded-3xl border border-amber-100">
          <p className="text-sm font-black text-amber-900 mb-4 flex items-center gap-2"><MapPin className="w-4 h-4 text-amber-600" /> Controlli Budgettari</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button onClick={() => handleAction("/api/budget/explore", { regionId, type: 'normal' })} className="px-4 py-3 bg-amber-600 text-white rounded-xl font-black text-[10px] uppercase tracking-wider shadow-sm hover:bg-amber-700 flex flex-col items-center">
              <span>Esplora (Normale)</span>
              <span className="text-amber-200 mt-1">-$15.000</span>
            </button>
            <button onClick={() => handleAction("/api/budget/explore", { regionId, type: 'deep' })} className="px-4 py-3 bg-rose-600 text-white rounded-xl font-black text-[10px] uppercase tracking-wider shadow-sm hover:bg-rose-700 flex flex-col items-center">
              <span>Esplora (Profonda)</span>
              <span className="text-rose-200 mt-1">-$50.000</span>
            </button>
            <button onClick={() => handleAction("/api/budget/clean-radiation", { regionId })} className="px-4 py-3 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-wider shadow-sm hover:bg-emerald-700 flex flex-col items-center">
              <span>Pulisci Radiazioni</span>
              <span className="text-emerald-200 mt-1">-$10.000</span>
            </button>
          </div>
        </div>
      )}

      <div>
        <h4 className="text-sm font-black tracking-tight text-slate-800 mb-4">Registro Transazioni</h4>
        {transactions.length === 0 ? (
          <p className="text-xs text-slate-400 font-bold text-center py-4">Nessuna transazione recente.</p>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
            {transactions.map(t => (
              <div key={t.id} className="flex justify-between items-center p-4 border border-slate-100 rounded-2xl bg-white hover:bg-slate-50 transition-colors shadow-sm">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] px-2 py-0.5 rounded-md bg-slate-100 font-black uppercase text-slate-500 tracking-widest">{t.type}</span>
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{t.subtype}</span>
                  </div>
                  <p className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <UserIcon className="w-3 h-3 text-slate-400" /> {t.createdBy || 'Sistema'}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-black ${t.moneyDelta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {t.moneyDelta > 0 ? '+' : ''}{t.moneyDelta.toLocaleString()} €
                  </p>
                  <p className="text-[9px] text-slate-400 font-bold mt-1">{new Date(t.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const CountryDetailView = ({ user, handleAction, actionLoading, fetchData }: { user: any, handleAction: (a: string, b: any) => void, actionLoading: boolean, fetchData: () => void }) => {
  const { iso2 } = useParams();
  const navigate = useNavigate();
  const [region, setRegion] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [apps, setApps] = useState<any[]>([]);
  const [agreements, setAgreements] = useState<{ outgoing: any[]; incoming: any[] }>({ outgoing: [], incoming: [] });
  const [agreementTargetId, setAgreementTargetId] = useState("");
  const [sanctions, setSanctions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'info' | 'government' | 'leader' | 'resources' | 'autonomy'>('info');
  const [regionFactories, setRegionFactories] = useState<any[]>([]);
  const [autonomyData, setAutonomyData] = useState<any>(null);

  const fetchCountryDetail = async () => {
    try {
      const res = await fetch(`/api/countries/${iso2}`);
      if (!res.ok) throw new Error("Country not found");
      const data = await res.json();
      setRegion(data);
      if (data.ownerUserId === user?.id) {
        const appsRes = await fetch(`/api/applications/${data.id}`);
        if (appsRes.ok) setApps(await appsRes.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgreements = async () => {
    try {
      const res = await fetch(`/api/countries/${iso2}/agreements`);
      if (res.ok) {
        const data = await res.json();
        setAgreements({
          outgoing: data?.outgoing || [],
          incoming: data?.incoming || []
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSanctions = async () => {
    try {
      const res = await fetch(`/api/countries/${iso2}/sanctions`);
      if (res.ok) {
        setSanctions(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchRegionFactories = async () => {
    try {
      const res = await fetch(`/api/factories?regionId=${iso2?.toUpperCase()}`);
      if (res.ok) {
        setRegionFactories(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAutonomyData = async () => {
    if (!iso2) return;
    try {
      const res = await fetch(`/api/regions/${iso2.toUpperCase()}/autonomy`);
      if (res.ok) setAutonomyData(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchCountryDetail();
    fetchAgreements();
    fetchSanctions();
    fetchRegionFactories();
    fetchAutonomyData();
  }, [iso2]);

  if (loading) return (
    <div className="min-h-[400px] flex items-center justify-center bg-white rounded-[2.5rem] border border-slate-100">
      <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
    </div>
  );

  if (!region) return (
    <div className="bg-white p-12 rounded-[2.5rem] text-center border border-slate-100">
      <Globe className="w-16 h-16 text-slate-200 mx-auto mb-4" />
      <h2 className="text-2xl font-black text-slate-900">Paese non trovato</h2>
      <p className="text-slate-400 mt-2">"{iso2}" non corrisponde a nessuna regione.</p>
      <button onClick={() => navigate("/")} className="mt-6 text-indigo-600 font-black uppercase text-xs">← Torna alla Mappa</button>
    </div>
  );

  const handleActionWithRefresh = async (action: string, body: any) => {
    await handleAction(action, body);
    fetchCountryDetail();
  };

  const handleImmigrationAction = async (endpoint: string, body: any) => {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else {
        if (data.autoAccepted) alert("Richiesta accettata automaticamente (Regione Neutrale)!");
        else if (endpoint.includes("apply")) alert("Richiesta inviata con successo all'ufficio immigrazione.");
        else if (data.travelMinutes) alert(`✈️ Viaggio iniziato verso ${data.regionId}! Tempo stimato: ${data.travelMinutes} minuti.`);
        fetchCountryDetail();
      }
    } catch (err) {
      alert("Errore nell'operazione.");
    }
  };

  const handleProposeMigrationLaw = async (type: 'migration_agreement' | 'revoke_migration_agreement', partnerId?: string) => {
    const targetRegionId = (partnerId || agreementTargetId).toUpperCase().trim();
    if (!targetRegionId) return alert("Seleziona uno Stato target.");
    try {
      const res = await fetch('/api/parliament/laws/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, params: { targetRegionId } })
      });
      const data = await res.json();
      if (data.error) return alert(data.error);
      alert(type === 'migration_agreement' ? 'Proposta legge inviata.' : 'Proposta revoca inviata.');
      setAgreementTargetId('');
      fetchAgreements();
    } catch {
      alert('Errore di connessione.');
    }
  };

  const resources = Array.isArray(region.resources) ? region.resources : [];
  const health = region.health || 1;
  const education = region.education || 1;
  const military = region.military || 1;
  const canManageMigration = user?.id === region.ownerUserId || user?.id === region.foreignMinisterId;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6"
    >
      <button onClick={() => navigate("/")} className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1">
        ← Mappa Mondiale
      </button>

      {/* Header Card */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className={`h-3 w-full ${region.ownerUserId ? "bg-indigo-500" : "bg-emerald-400"}`} />
        <div className="p-8">
          <div className="flex items-center gap-5 mb-6">
            <NationalFlag iso2={iso2 || ""} className="w-16 h-12 shadow-md rounded-lg" />
            <div className="flex-1">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">{region.name || iso2}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-400 px-2 py-1 rounded-lg">ISO: {region.id || iso2}</span>
                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${region.ownerUserId ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"}`}>
                  {region.ownerName ? `🟣 ${region.ownerName}` : "🟢 Territorio Neutrale"}
                </span>
                {region.isCapital && <span className="text-[10px] font-black uppercase bg-yellow-50 text-yellow-700 px-2 py-1 rounded-lg">👑 Capitale</span>}
                {region.isAutonomous && <span className="text-[10px] font-black uppercase bg-purple-50 text-purple-700 px-2 py-1 rounded-lg">🏛️ Autonomia</span>}
                {region.isBorderRegion && <span className="text-[10px] font-black uppercase bg-red-50 text-red-600 px-2 py-1 rounded-lg">⚔️ Frontaliera</span>}
                {region.governorName && <span className="text-[10px] font-black uppercase bg-blue-50 text-blue-600 px-2 py-1 rounded-lg">👤 Gov: {region.governorName}</span>}
                <span className="text-[10px] font-black uppercase bg-amber-50 text-amber-600 px-2 py-1 rounded-lg ml-auto">
                  Tassa Mercato: {region.marketTaxRate || 10}%
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-6 pb-2">
            <button
              onClick={() => setActiveTab('info')}
              className={`flex-1 min-w-[120px] py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'info' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "bg-slate-50 text-slate-400 hover:text-slate-600"}`}
            >
              Info & Economia
            </button>
            <button
              onClick={() => setActiveTab('government')}
              className={`flex-1 min-w-[120px] py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'government' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "bg-slate-50 text-slate-400 hover:text-slate-600"}`}
            >
              Governo
            </button>
            {region.ownerUserId && (
              <button
                onClick={() => setActiveTab('leader')}
                className={`flex-1 min-w-[120px] py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'leader' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "bg-slate-50 text-slate-400 hover:text-slate-600"}`}
              >
                Leader
              </button>
            )}
            <button
              onClick={() => setActiveTab('resources')}
              className={`flex-1 min-w-[120px] py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'resources' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "bg-slate-50 text-slate-400 hover:text-slate-600"}`}
            >
              ⛏️ Risorse
            </button>
            <button
              onClick={() => setActiveTab('autonomy')}
              className={`flex-1 min-w-[120px] py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'autonomy' ? "bg-purple-600 text-white shadow-lg shadow-purple-200" : "bg-slate-50 text-slate-400 hover:text-slate-600"}`}
            >
              🏛️ Autonomia
            </button>
          </div>

          {activeTab === 'info' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 p-4 rounded-3xl text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cittadini</p>
                <p className="text-xl font-black">{region.citizenCount ?? 0}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-3xl text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Stabilità</p>
                <p className="text-xl font-black">{region.stability || 5}/10</p>
              </div>
              <div className="bg-emerald-50 p-4 rounded-3xl text-center">
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Tesoro</p>
                <p className="text-xl font-black text-emerald-700">${(region.treasury || 0).toLocaleString()}</p>
              </div>
              <div className="bg-amber-50 p-4 rounded-3xl text-center">
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Economia</p>
                <p className="text-xl font-black text-amber-700">{region.economyLevel || 1}/10</p>
              </div>

              {/* Sanctions List */}
              {sanctions.length > 0 && (
                <div className="col-span-2 mt-4 text-left">
                  <h4 className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <AlertCircle className="w-3 h-3" /> Stati sanzionati da {region.name}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {sanctions.map((s: any) => (
                      <div key={s.id} className="flex items-center gap-2 p-3 bg-rose-50 rounded-2xl border border-rose-100">
                        <NationalFlag iso2={s.targetStateId || ""} className="w-8 h-6 shadow-sm rounded-sm" />
                        <div className="flex-1">
                          <p className="text-xs font-black text-rose-900 leading-none">{s.targetStateName || s.targetStateId}</p>
                          <p className="text-[9px] font-bold text-rose-400 uppercase mt-0.5">Sanzioni Commerciali Attive</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'leader' && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <h3 className="text-lg font-black uppercase text-indigo-900 mb-4 flex items-center gap-2">
                  <Crown className="w-5 h-5 text-indigo-600" /> Capo di Stato
                </h3>
                {region.leaderUserId ? (
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center">
                      <UserIcon className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900">{region.leaderName || 'Leader dello Stato'}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">ID: {region.leaderUserId}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm font-bold text-slate-400">Nessun leader attivo in questo Stato.</p>
                )}

                <div className="mt-6 flex flex-col gap-2">
                  <button
                    onClick={() => navigate(`/leader/${(iso2 || '').toUpperCase()}`)}
                    className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                  >
                    <Crown className="w-4 h-4" /> Pagina Leader & Elezioni
                  </button>
                  <button
                    onClick={() => navigate(`/ministers/${(iso2 || '').toUpperCase()}`)}
                    className="w-full py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <Briefcase className="w-4 h-4" /> Ministri & Incarichi
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {activeTab === 'government' ? (
        <GovernmentView region={region} currentUser={user} onUpdate={fetchCountryDetail} />
      ) : activeTab === 'resources' ? (
        <div className="space-y-4">
          {/* Link to Advanced Extraction Dashboard */}
          <div className="bg-emerald-50 p-4 rounded-[2rem] border border-emerald-100">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-emerald-800">⛏️ Dashboard Estrazione Avanzata</h4>
                <p className="text-[10px] font-bold text-emerald-600 mt-1">Visualizza cap, analytics 24h, leaderboard, esperienza lavorativa e distribuzione risorse.</p>
              </div>
              <button
                onClick={() => navigate(`/extraction/${region.id}`)}
                className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-black text-xs uppercase hover:bg-emerald-600 transition-all"
              >
                Apri →
              </button>
            </div>
          </div>
          <RegionResourcesTab regionId={region.id} user={user} />
          {/* Show recharge panel for leader/economy minister */}
          {(region.ownerUserId === user?.id || region.economicAdviserId === user?.id) && (
            <RechargeResourcePanel regionId={region.id} user={user} />
          )}
          {/* Show Deep Exploration panel for leader/economy minister */}
          {region.nation_id && (region.ownerUserId === user?.id || region.economicAdviserId === user?.id) && (
            <DeepExplorationPanel user={user} nationId={region.nation_id} />
          )}
        </div>
      ) : activeTab === 'autonomy' ? (
        <div className="space-y-4">
          {!autonomyData ? (
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 text-center">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
            </div>
          ) : (
            <>
              {/* Autonomy Status */}
              <div className={`bg-white p-6 rounded-[2.5rem] shadow-sm border ${autonomyData.region.isAutonomous ? 'border-purple-200' : 'border-slate-100'}`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-black uppercase tracking-tight">🏛️ Stato Autonomia</h3>
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-black ${autonomyData.region.isAutonomous ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-500'}`}>
                    {autonomyData.region.isAutonomous ? '✅ Attiva' : '❌ Non Attiva'}
                  </span>
                </div>
                {autonomyData.region.isAutonomous && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-purple-50 p-4 rounded-3xl text-center">
                      <p className="text-[9px] font-black text-purple-400 uppercase">Governatore</p>
                      <p className="text-sm font-black text-purple-700">{autonomyData.region.governorName || '— Vacante —'}</p>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-3xl text-center">
                      <p className="text-[9px] font-black text-emerald-400 uppercase">Budget Regionale</p>
                      <p className="text-sm font-black text-emerald-700">€{(autonomyData.region.regionalBudget || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-3xl text-center">
                      <p className="text-[9px] font-black text-blue-400 uppercase">Quota Regionale</p>
                      <p className="text-lg font-black text-blue-700">{autonomyData.region.regionalProfitSharePercent}%</p>
                    </div>
                    <div className="bg-indigo-50 p-4 rounded-3xl text-center">
                      <p className="text-[9px] font-black text-indigo-400 uppercase">Quota Stato</p>
                      <p className="text-lg font-black text-indigo-700">{autonomyData.region.nationalProfitSharePercent}%</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-3xl text-center">
                      <p className="text-[9px] font-black text-slate-400 uppercase">Parlamento</p>
                      <p className="text-sm font-black">{autonomyData.region.regionalParliamentEnabled ? '✅ Attivo' : '❌ Disattivo'}</p>
                    </div>
                    {autonomyData.region.autonomyGrantedAt && (
                      <div className="bg-slate-50 p-4 rounded-3xl text-center">
                        <p className="text-[9px] font-black text-slate-400 uppercase">Istituita il</p>
                        <p className="text-xs font-black text-slate-600">{new Date(autonomyData.region.autonomyGrantedAt).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>
                )}
                {!autonomyData.region.isAutonomous && !autonomyData.region.isCapital && (
                  <p className="text-xs font-bold text-slate-400 mt-2">Questa regione può essere resa autonoma tramite legge parlamentare.</p>
                )}
                {autonomyData.region.isCapital && (
                  <p className="text-xs font-bold text-amber-600 mt-2">👑 La capitale non può diventare un'autonomia.</p>
                )}
              </div>

              {/* Taxes */}
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                <h3 className="text-lg font-black uppercase tracking-tight mb-4">💰 Tasse Regionali</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-amber-50 p-4 rounded-3xl text-center">
                    <p className="text-[9px] font-black text-amber-500 uppercase">Lavoratori</p>
                    <p className="text-2xl font-black text-amber-700">{autonomyData.region.workerTaxPercent}%</p>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-3xl text-center">
                    <p className="text-[9px] font-black text-orange-500 uppercase">Mercato</p>
                    <p className="text-2xl font-black text-orange-700">{autonomyData.region.marketTaxRate}%</p>
                  </div>
                  <div className="bg-rose-50 p-4 rounded-3xl text-center">
                    <p className="text-[9px] font-black text-rose-500 uppercase">Industria</p>
                    <p className="text-2xl font-black text-rose-700">{autonomyData.region.industryTaxPercent}%</p>
                  </div>
                </div>
              </div>

              {/* Regional Indices */}
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-black uppercase tracking-tight">📊 Indici Regionali</h3>
                  {/* Regional Classification Badge */}
                  {(() => {
                    const cls = autonomyData.indices.regionalClassification;
                    const clsLabel = cls === 'developed' ? '🟢 Sviluppata' : cls === 'developing' ? '🟡 In Via di Sviluppo' : '🔴 Arretrata';
                    const clsColor = cls === 'developed' ? 'bg-emerald-100 text-emerald-800' : cls === 'developing' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
                    return (
                      <span className={`px-3 py-1 rounded-xl text-[10px] font-black ${clsColor}`}>{clsLabel}</span>
                    );
                  })()}
                </div>
                {/* Crisis risk warning for underdeveloped regions */}
                {autonomyData.indices.regionalClassification === 'underdeveloped' && (
                  <div className="mb-4 p-3 bg-red-50 rounded-2xl border border-red-200">
                    <p className="text-xs font-black text-red-700">⚠️ Regione Arretrata — rischio di instabilità politica attivo</p>
                    <p className="text-[10px] font-bold text-red-600">Aumenta lo Sviluppo costruendo Fondi Immobiliari per stabilizzare la regione.</p>
                  </div>
                )}
                <div className="space-y-5">
                  {[
                    {
                      label: "Salute",
                      val: autonomyData.indices.healthIndex,
                      effective: autonomyData.indices.effectiveHealthIndex,
                      progress: autonomyData.indices.healthProgress,
                      icon: "❤️",
                      color: "#ef4444",
                      colorClass: "bg-red-50",
                      source: "Ospedali 🏥",
                      buildingKey: "hospital",
                      effect: `Riduce costo energetico delle azioni (-${((autonomyData.indices.healthIndex || 0) * 1).toFixed(0)}% attuale)`,
                      nextThreshold: autonomyData.indices.nextThresholds?.health,
                      primaryCount: autonomyData.indices.primaryCounts?.health ?? (autonomyData.buildings?.hospital || 0),
                    },
                    {
                      label: "Militare",
                      val: autonomyData.indices.militaryIndex,
                      progress: autonomyData.indices.militaryProgress,
                      icon: "🛡️",
                      color: "#f97316",
                      colorClass: "bg-orange-50",
                      source: "Basi Militari 🏛️ (+ Accademie, Missili, Aeroporti, Porti)",
                      buildingKey: "military_base",
                      effect: `Bonus danno guerra (+${((autonomyData.indices.militaryIndex || 0) * 3).toFixed(0)}% attacco, +${((autonomyData.indices.militaryIndex || 0) * 2).toFixed(0)}% difesa)`,
                      nextThreshold: autonomyData.indices.nextThresholds?.military,
                      // For military, display the weighted score (accounts for all contributing buildings)
                      primaryCount: autonomyData.indices.rawScores?.military ?? (autonomyData.indices.primaryCounts?.military ?? (autonomyData.buildings?.military_base || 0)),
                    },
                    {
                      label: "Istruzione",
                      val: autonomyData.indices.educationIndex,
                      progress: autonomyData.indices.educationProgress,
                      icon: "📚",
                      color: "#6366f1",
                      colorClass: "bg-indigo-50",
                      source: "Scuole 🏫",
                      buildingKey: "school",
                      effect: `Aumenta XP guadagnata (+${((autonomyData.indices.educationIndex || 0) * 2).toFixed(0)}% per azione)`,
                      nextThreshold: autonomyData.indices.nextThresholds?.education,
                      primaryCount: autonomyData.indices.primaryCounts?.education ?? (autonomyData.buildings?.school || 0),
                    },
                    {
                      label: "Sviluppo",
                      val: autonomyData.indices.developmentIndex,
                      progress: autonomyData.indices.developmentProgress,
                      icon: "🏘️",
                      color: "#10b981",
                      colorClass: "bg-emerald-50",
                      source: "Fondi Immobiliari 🏘️",
                      buildingKey: "real_estate_fund",
                      effect: `Stabilità politica e stipendi (+${((autonomyData.indices.developmentIndex || 0) * 5).toFixed(0)}% stipendi, -${((autonomyData.indices.developmentIndex || 0) * 8).toFixed(0)}% rischio crisi)`,
                      nextThreshold: autonomyData.indices.nextThresholds?.development,
                      primaryCount: autonomyData.indices.primaryCounts?.development ?? (autonomyData.buildings?.real_estate_fund || 0),
                    },
                  ].map(ind => {
                    const level = typeof ind.val === 'number' ? Math.floor(ind.val) : 0;
                    const MAX_LEVEL = 10;
                    const progressVal = typeof ind.progress === 'number' ? ind.progress : Math.min(100, (level / MAX_LEVEL) * 100);
                    const isMaxed = level >= MAX_LEVEL;
                    return (
                      <div key={ind.label} className={`p-4 rounded-3xl border border-slate-100 ${ind.colorClass}`}>
                        {/* Header row */}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{ind.icon}</span>
                            <div>
                              <p className="text-sm font-black text-slate-800">{ind.label}</p>
                              <p className="text-[9px] font-bold text-slate-500">Fonte: {ind.source}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-black text-slate-800">{level}</span>
                            <span className="text-xs font-bold text-slate-400">/{MAX_LEVEL}</span>
                            {ind.effective !== undefined && ind.effective < level && (
                              <p className="text-[9px] font-bold text-rose-500">eff: {typeof ind.effective === 'number' ? ind.effective.toFixed(1) : ind.effective}</p>
                            )}
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div className="w-full bg-white/60 h-2 rounded-full overflow-hidden mb-2">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${isMaxed ? 100 : progressVal}%`, backgroundColor: ind.color }}
                          />
                        </div>
                        {/* Progress label */}
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[9px] font-bold text-slate-500">
                            {isMaxed
                              ? '✅ Livello massimo raggiunto'
                              : `Score: ${typeof ind.primaryCount === 'number' ? (Number.isInteger(ind.primaryCount) ? ind.primaryCount : ind.primaryCount.toFixed(1)) : '—'}${ind.nextThreshold != null ? ` / ${ind.nextThreshold} per lv.${level + 1}` : ''}`
                            }
                          </p>
                          <p className="text-[9px] font-black" style={{ color: ind.color }}>{isMaxed ? '🏆' : `${Math.round(progressVal)}%`}</p>
                        </div>
                        {/* Effect description */}
                        <p className="text-[9px] font-bold text-slate-600 italic">⚡ {ind.effect}</p>
                      </div>
                    );
                  })}
                </div>
                {autonomyData.region.pollution > 0 && (
                  <div className="mt-4 p-3 bg-yellow-50 rounded-2xl border border-yellow-200">
                    <p className="text-xs font-black text-yellow-700">⚠️ Inquinamento: livello {autonomyData.region.pollution}</p>
                    <p className="text-[10px] font-bold text-yellow-600">Malus efficacia salute: -{autonomyData.pollutionMalus.toFixed(1)}%</p>
                  </div>
                )}
              </div>

              {/* Energy Dashboard */}
              <div className={`bg-white p-6 rounded-[2.5rem] shadow-sm border ${autonomyData.energy.isDeficit ? 'border-red-200' : 'border-emerald-200'}`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-black uppercase tracking-tight">⚡ Energia Regionale</h3>
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-black ${autonomyData.energy.isDeficit ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {autonomyData.energy.isDeficit ? '🔴 Deficit' : '🟢 Surplus'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-emerald-50 p-4 rounded-3xl text-center">
                    <p className="text-[9px] font-black text-emerald-500 uppercase">Generazione</p>
                    <p className="text-xl font-black text-emerald-700">{autonomyData.energy.generation}</p>
                    <p className="text-[9px] font-bold text-emerald-400">mW</p>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-3xl text-center">
                    <p className="text-[9px] font-black text-orange-500 uppercase">Consumo</p>
                    <p className="text-xl font-black text-orange-700">{autonomyData.energy.consumption}</p>
                    <p className="text-[9px] font-bold text-orange-400">mW</p>
                  </div>
                  <div className={`p-4 rounded-3xl text-center ${autonomyData.energy.efficiency >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    <p className="text-[9px] font-black uppercase" style={{ color: autonomyData.energy.efficiency >= 0 ? '#059669' : '#dc2626' }}>Efficienza</p>
                    <p className="text-xl font-black" style={{ color: autonomyData.energy.efficiency >= 0 ? '#059669' : '#dc2626' }}>
                      {autonomyData.energy.efficiency >= 0 ? '+' : ''}{autonomyData.energy.efficiency}
                    </p>
                    <p className="text-[9px] font-bold" style={{ color: autonomyData.energy.efficiency >= 0 ? '#10b981' : '#ef4444' }}>mW</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-3 rounded-2xl text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Centrali {autonomyData.energy.surplusPowerPlants >= 0 ? 'in eccesso' : 'mancanti'}</p>
                    <p className="text-lg font-black" style={{ color: autonomyData.energy.surplusPowerPlants >= 0 ? '#059669' : '#dc2626' }}>{Math.abs(autonomyData.energy.surplusPowerPlants)}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase">{autonomyData.energy.isDeficit ? 'Edifici in eccesso' : 'Edifici supportabili'}</p>
                    <p className="text-lg font-black text-slate-700">{autonomyData.energy.isDeficit ? autonomyData.energy.excessBuildings : autonomyData.energy.supportableBuildings}</p>
                  </div>
                </div>
                {autonomyData.energy.stateCompensation > 0 && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-2xl border border-blue-200">
                    <p className="text-xs font-black text-blue-700">🔄 Compensazione statale: +{autonomyData.energy.stateCompensation} mW</p>
                    <p className="text-[10px] font-bold text-blue-600">Efficienza netta (dopo compensazione): {autonomyData.energy.netEfficiency} mW</p>
                  </div>
                )}
                {autonomyData.energyDeficitMalus > 0 && (
                  <div className="mt-3 p-3 bg-red-50 rounded-2xl border border-red-200">
                    <p className="text-xs font-black text-red-700">⚠️ Deficit energetico attivo!</p>
                    <p className="text-[10px] font-bold text-red-600">Malus efficienza economica: -{autonomyData.energyDeficitMalus.toFixed(1)}%</p>
                  </div>
                )}
              </div>

              {/* Military Stats */}
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                <h3 className="text-lg font-black uppercase tracking-tight mb-4">⚔️ Capacità Militare Regionale</h3>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-red-50 p-4 rounded-3xl text-center">
                    <p className="text-[9px] font-black text-red-500 uppercase">Danno Iniziale Attacco</p>
                    <p className="text-xl font-black text-red-700">{(autonomyData.militaryStats.initialAttackDamage || 0).toLocaleString()}</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-3xl text-center">
                    <p className="text-[9px] font-black text-blue-500 uppercase">Punti Difesa Iniziali</p>
                    <p className="text-xl font-black text-blue-700">{(autonomyData.militaryStats.initialDefensePoints || 0).toLocaleString()}</p>
                  </div>
                </div>
                {autonomyData.region.isBorderRegion && (
                  <div className="p-3 bg-red-50 rounded-2xl border border-red-200">
                    <p className="text-[10px] font-black text-red-700">⚔️ Regione Frontaliera — le strutture militari sono particolarmente rilevanti!</p>
                  </div>
                )}
              </div>

              {/* Buildings */}
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                <h3 className="text-lg font-black uppercase tracking-tight mb-4">🏗️ Edifici Regionali</h3>
                <div className="space-y-2">
                  {Object.entries(autonomyData.buildings).filter(([_, qty]) => (qty as number) > 0).length > 0 ? (
                    Object.entries(autonomyData.buildings)
                      .sort(([, a], [, b]) => (b as number) - (a as number))
                      .map(([bt, qty]) => {
                        const icons: Record<string, string> = { hospital: '🏥', military_base: '🏛️', school: '🏫', military_academy: '🎖️', missile_system: '🚀', airport: '✈️', naval_port: '⚓', space_port: '🛸', real_estate_fund: '🏘️', power_plant: '⚡' };
                        const labels: Record<string, string> = { hospital: 'Ospedali', military_base: 'Basi Militari', school: 'Scuole', military_academy: 'Accademie Militari', missile_system: 'Sistemi Missilistici', airport: 'Aeroporti', naval_port: 'Porti Navali', space_port: 'Porti Spaziali', real_estate_fund: 'Fondi Immobiliari', power_plant: 'Centrali Elettriche' };
                        if ((qty as number) === 0) return null;
                        return (
                          <div key={bt} className="flex items-center justify-between p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{icons[bt] || '🏢'}</span>
                              <span className="text-xs font-black text-indigo-900">{labels[bt] || bt}</span>
                            </div>
                            <span className="text-lg font-black text-indigo-700">{qty as number}</span>
                          </div>
                        );
                      })
                  ) : (
                    <div className="p-8 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                      <p className="text-slate-400 font-bold italic">Nessun edificio regionale costruito</p>
                      <p className="text-[10px] font-bold text-slate-300 mt-1">Costruisci edifici tramite legge parlamentare</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Daily Extraction Limits */}
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                <h3 className="text-lg font-black uppercase tracking-tight mb-4">⛏️ Limiti Estrazione Giornalieri</h3>
                <div className="space-y-3">
                  {[
                    { key: 'gold', label: 'Oro', icon: '🥇', data: autonomyData.extraction.gold, color: '#d97706' },
                    { key: 'oil', label: 'Petrolio', icon: '🛢️', data: autonomyData.extraction.oil, color: '#ea580c' },
                    { key: 'minerals', label: 'Minerali', icon: '🪨', data: autonomyData.extraction.minerals, color: '#64748b' },
                    { key: 'uranium', label: 'Uranio', icon: '☢️', data: autonomyData.extraction.uranium, color: '#0891b2' },
                    { key: 'diamonds', label: 'Diamanti', icon: '💎', data: autonomyData.extraction.diamonds, color: '#7c3aed' },
                  ].map(res => (
                    <div key={res.key} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-700">{res.icon} {res.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-500">{res.data.extracted} / {res.data.limit}</span>
                          <span className="text-[10px] font-black text-emerald-600">({res.data.remaining} 🔄)</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, res.data.limit > 0 ? (res.data.extracted / res.data.limit) * 100 : 0)}%`, backgroundColor: res.color }} />
                      </div>
                    </div>
                  ))}
                  {autonomyData.extraction.nextResetAt && (
                    <p className="text-[10px] font-bold text-slate-400 text-center pt-2">
                      ⏰ Prossimo reset: {new Date(autonomyData.extraction.nextResetAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              {/* Budget Transactions (for autonomous regions) */}
              {autonomyData.region.isAutonomous && autonomyData.transactions.length > 0 && (
                <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                  <h3 className="text-lg font-black uppercase tracking-tight mb-4">📜 Storico Budget Regionale</h3>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {autonomyData.transactions.slice(0, 30).map((tx: any) => (
                      <div key={tx.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                        <div>
                          <p className="text-[10px] font-black text-slate-700">{tx.description || tx.subtype || tx.type}</p>
                          <p className="text-[9px] font-bold text-slate-400">{new Date(tx.createdAt).toLocaleString()}</p>
                        </div>
                        <span className={`text-sm font-black ${(tx.moneyDelta || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {(tx.moneyDelta || 0) >= 0 ? '+' : ''}€{Math.abs(tx.moneyDelta || 0).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Autonomy History */}
              {autonomyData.history.length > 0 && (
                <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                  <h3 className="text-lg font-black uppercase tracking-tight mb-4">📋 Storico Decisioni Autonomia</h3>
                  <div className="space-y-2">
                    {autonomyData.history.map((h: any) => (
                      <div key={h.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl">
                        <span className="text-2xl">{h.action === 'granted' ? '✅' : '❌'}</span>
                        <div>
                          <p className="text-xs font-black text-slate-700">{h.action === 'granted' ? 'Autonomia istituita' : 'Autonomia revocata'}</p>
                          <p className="text-[9px] font-bold text-slate-400">{new Date(h.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <>
          {/* Region Production Bonuses */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-5">
            <div className="flex justify-between items-end">
              <h3 className="text-lg font-black uppercase tracking-tight">Bonus Produzione Regionale</h3>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Moltiplicatore di Fabbrica</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { id: 'oil', label: 'Petrolio', icon: '🛢️', val: region.oilBonus || 1.0, color: 'text-slate-800', bg: 'bg-slate-50' },
                { id: 'minerals', label: 'Minerali', icon: '🪨', val: region.mineralsBonus || 1.0, color: 'text-stone-700', bg: 'bg-stone-50' },
                { id: 'uranium', label: 'Uranio', icon: '☢️', val: region.uraniumBonus || 1.0, color: 'text-emerald-700', bg: 'bg-emerald-50' },
                { id: 'diamonds', label: 'Diamanti', icon: '💎', val: region.diamondsBonus || 1.0, color: 'text-sky-700', bg: 'bg-sky-50' },
              ].map(res => {
                const percentage = Math.round((res.val - 1) * 100);
                return (
                  <div key={res.id} className={`${res.bg} p-4 rounded-3xl flex flex-col items-center justify-center border border-white/50 text-center`}>
                    <span className="text-2xl mb-2 drop-shadow-sm">{res.icon}</span>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${res.color}`}>{res.label}</span>
                    <span className={`text-base font-black mt-1 ${percentage > 0 ? "text-emerald-600" : "text-slate-400"}`}>
                      {percentage > 0 ? `+${percentage}%` : "Base"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* National Development */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
            <div className="flex justify-between items-end">
              <h3 className="text-lg font-black uppercase tracking-tight">Sviluppo Nazionale</h3>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Obiettivo: 10/10</span>
            </div>
            <div className="space-y-5">
              {[
                { label: "Infrastruttura Sanitaria", desc: "Efficienza dei servizi medici", val: health, icon: "❤️", color: "#ef4444" },
                { label: "Indice di Sviluppo", desc: "Progresso tecnologico e culturale", val: education, icon: "📚", color: "#6366f1" },
                { label: "Potenziale Bellico", desc: "Capacità difensiva e riserve armate", val: military, icon: "🛡️", color: "#f97316" },
              ].map(ind => (
                <div key={ind.label} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{ind.icon}</span>
                      <div>
                        <p className="text-[11px] font-black text-slate-700 uppercase tracking-widest">{ind.label}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">{ind.desc}</p>
                      </div>
                    </div>
                    <span className="text-sm font-black text-slate-700">{ind.val}/10</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${(ind.val / 10) * 100}%`, backgroundColor: ind.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ufficio Immigrazione */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
            <h3 className="text-lg font-black uppercase tracking-tight text-indigo-900 border-b border-indigo-50 pb-2">Ufficio Immigrazione</h3>

            {/* Accordi di Migrazione */}
            <div className="space-y-3 mb-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Accordi di migrazione in uscita</p>
              {agreements.outgoing.length > 0 ? agreements.outgoing.map((ag: any) => (
                <div key={ag.id} className="flex items-center justify-between p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                  <div>
                    <p className="text-xs font-black text-indigo-900 uppercase">Verso {ag.partnerName}</p>
                    <p className="text-[10px] font-bold text-indigo-500 uppercase">Attivato: {new Date(ag.activatedAt || ag.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${ag.agreementType === 'BILATERAL' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{ag.agreementType === 'BILATERAL' ? 'Bilateral' : 'Unilateral'}</span>
                    {canManageMigration && (
                      <button onClick={() => handleProposeMigrationLaw('revoke_migration_agreement', ag.partnerId)} className="px-2 py-1 rounded-lg text-[10px] font-black bg-rose-100 text-rose-700">Revoca</button>
                    )}
                  </div>
                </div>
              )) : <div className="p-3 bg-slate-50 rounded-xl text-[11px] font-bold text-slate-400">Nessun accordo attivo in uscita.</div>}

              <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 pt-1">Accordi di migrazione in entrata</p>
              {agreements.incoming.length > 0 ? agreements.incoming.map((ag: any) => (
                <div key={ag.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-xs font-black text-slate-700">{ag.partnerName} apre l'ingresso ai tuoi cittadini</p>
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${ag.agreementType === 'BILATERAL' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{ag.agreementType === 'BILATERAL' ? 'Bilateral' : 'Unilateral'}</span>
                </div>
              )) : <div className="p-3 bg-slate-50 rounded-xl text-[11px] font-bold text-slate-400">Nessun accordo in entrata.</div>}
            </div>

            {canManageMigration && (
              <div className="flex gap-2 items-center">
                <input value={agreementTargetId} onChange={(e) => setAgreementTargetId(e.target.value.toUpperCase())} placeholder="Stato target (ISO)" className="flex-1 bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-black uppercase" />
                <button onClick={() => handleProposeMigrationLaw('migration_agreement')} className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase">Proponi accordo</button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                disabled={user.regionId === region.id || !!(user.travelingUntil && Date.now() < user.travelingUntil)}
                onClick={() => handleImmigrationAction("/api/actions/travel", { regionId: region.id })}
                className="flex flex-col items-center justify-center p-4 bg-sky-50 rounded-2xl hover:bg-sky-100 transition-colors disabled:opacity-50 border border-sky-100"
              >
                <span className="text-2xl mb-2">✈️</span>
                <span className="text-[11px] font-black uppercase tracking-widest text-sky-700">
                  {user.travelingUntil && Date.now() < user.travelingUntil ? "In Viaggio..." : "Viaggia Qui"}
                </span>
                <span className="text-[9px] font-bold text-sky-500 mt-1">
                  {user.travelingUntil && Date.now() < user.travelingUntil
                    ? <span>Arrivo tra <TravelTimer endsAt={user.travelingUntil} onComplete={fetchData} /></span>
                    : "Sposta la tua pedina fisica"}
                </span>
              </button>

              <button
                disabled={user.residenceId === region.id}
                onClick={() => handleImmigrationAction("/api/actions/apply", { regionId: region.id, type: "residence" })}
                className="flex flex-col items-center justify-center p-4 bg-emerald-50 rounded-2xl hover:bg-emerald-100 transition-colors disabled:opacity-50 border border-emerald-100"
              >
                <span className="text-2xl mb-2">🏠</span>
                <span className="text-[11px] font-black uppercase tracking-widest text-emerald-700">Residenza</span>
                <span className="text-[9px] font-bold text-emerald-500 mt-1">Diventa cittadino</span>
              </button>

              <button
                disabled={user.workPermitId === region.id || user.residenceId === region.id}
                onClick={() => handleImmigrationAction("/api/actions/apply", { regionId: region.id, type: "work_permit" })}
                className="flex flex-col items-center justify-center p-4 bg-amber-50 rounded-2xl hover:bg-amber-100 transition-colors disabled:opacity-50 border border-amber-100"
              >
                <span className="text-2xl mb-2">📄</span>
                <span className="text-[11px] font-black uppercase tracking-widest text-amber-700">Visto Lavorativo</span>
                <span className="text-[9px] font-bold text-amber-500 mt-1">Permesso di lavoro estero</span>
              </button>
            </div>
          </div>

          {/* Amministrazione (Solo per il Leader) */}
          {region.ownerUserId === user.id && (
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
              <h3 className="text-lg font-black uppercase tracking-tight text-rose-900 border-b border-rose-50 pb-2">Amministrazione Doganale</h3>

              <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div>
                  <p className="text-sm font-black text-slate-800">Protezionismo / Visti</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">Richiedi un permesso per lavorare in questa regione</p>
                </div>
                <button
                  onClick={() => handleImmigrationAction("/api/actions/toggle-borders", { regionId: region.id, state: !region.workRestrictions })}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${region.workRestrictions ? "bg-rose-500 text-white" : "bg-emerald-500 text-white"}`}
                >
                  {region.workRestrictions ? "Rimuovi Limitazioni" : "Attiva Limitazioni"}
                </button>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-black text-slate-700">Richieste in Sospeso ({apps.length})</h4>
                {apps.length === 0 ? (
                  <p className="text-xs text-slate-400 font-medium">Nessuna pratica da smaltire.</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {apps.map(app => (
                      <div key={app.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                        <div>
                          <p className="text-xs font-black text-slate-800">{app.username}</p>
                          <p className="text-[10px] uppercase font-bold text-indigo-500">{app.type === 'residence' ? 'Residenza' : 'Permesso Lavoro'}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleImmigrationAction("/api/actions/resolve-application", { applicationId: app.id, action: 'accept' })} className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleImmigrationAction("/api/actions/resolve-application", { applicationId: app.id, action: 'reject' })} className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center hover:bg-rose-100">
                            <AlertCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Factories */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-4">
            <h3 className="text-lg font-black uppercase tracking-tight">Strutture Presenti</h3>
            {regionFactories.length > 0 ? (
              <div className="space-y-3">
                {regionFactories.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <div className="p-3 bg-white rounded-xl text-xl">
                      {RESOURCE_ICONS[f.type] || "🏭"}
                    </div>
                    <div className="flex-1">
                      <p className="font-black text-indigo-900 leading-tight">{f.name}</p>
                      <p className="text-[10px] font-bold text-indigo-400 uppercase">
                        {RESOURCE_NAMES[f.type] || f.type} • Livello {f.level}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase">Proprietario</p>
                      <p className="text-xs font-bold text-slate-700">{f.ownerName || 'Unknown'}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                <p className="text-slate-400 font-bold italic">Nessuna fabbrica costruita</p>
              </div>
            )}
          </div>

          {/* Resources (if any) */}
          {resources.length > 0 && (
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-4">
              <h3 className="text-lg font-black uppercase tracking-tight">Risorse Naturali</h3>
              <div className="flex flex-wrap gap-2">
                {resources.map((res: any) => (
                  <div key={res.type} className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2">
                    <span className="text-sm font-black text-slate-700">{res.type}</span>
                    <span className="text-xs font-bold text-slate-400">{res.base || res.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Budget e Finanze di Stato */}
          <BudgetView regionId={region.id} user={user} isLeader={region.ownerUserId === user?.id} />

          {/* Actions */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-4">
            <h3 className="text-lg font-black uppercase tracking-tight">Azioni Regionali</h3>
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => handleActionWithRefresh("invest", { regionId: region.id })}
                disabled={actionLoading || (user?.money || 0) < GAME_CONFIG.INVEST_MONEY_COST}
                className="flex items-center justify-between p-5 rounded-3xl bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition-all disabled:opacity-50"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white rounded-2xl shadow-sm"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
                  <div className="text-left">
                    <p className="font-black text-emerald-900 leading-none">Investi</p>
                    <p className="text-[10px] font-bold text-emerald-600 mt-1 uppercase">Sviluppa Economia & Stabilità</p>
                  </div>
                </div>
                <span className="font-black text-emerald-700">-${GAME_CONFIG.INVEST_MONEY_COST}</span>
              </button>

              <button
                onClick={() => handleActionWithRefresh("propaganda", { regionId: region.id })}
                disabled={actionLoading || (user?.energy || 0) < GAME_CONFIG.PROPAGANDA_ENERGY_COST}
                className="flex items-center justify-between p-5 rounded-3xl bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition-all disabled:opacity-50"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white rounded-2xl shadow-sm"><LogOut className="w-5 h-5 text-indigo-600 rotate-180" /></div>
                  <div className="text-left">
                    <p className="font-black text-indigo-900 leading-none">Propaganda</p>
                    <p className="text-[10px] font-bold text-indigo-600 mt-1 uppercase">Aumenta Stabilità</p>
                  </div>
                </div>
                <span className="font-black text-indigo-700">-{GAME_CONFIG.PROPAGANDA_ENERGY_COST}⚡</span>
              </button>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
};

const NationView = ({ user, fetchData }: { user: any, fetchData: () => void }) => {
  const [displayedNation, setDisplayedNation] = useState(user.displayedNation || 'ST');
  const [originalNation, setOriginalNation] = useState(user.originalNation || 'ST');
  const [submitting, setSubmitting] = useState(false);

  const NATION_OPTS = [
    { id: "ST", name: "São Tomé" },
    { id: "IT", name: "Italy" }, { id: "FR", name: "France" }, { id: "DE", name: "Germany" },
    { id: "ES", name: "Spain" }, { id: "GB", name: "UK" }, { id: "US", name: "USA" },
    { id: "CA", name: "Canada" }, { id: "BR", name: "Brazil" }, { id: "JP", name: "Japan" },
    { id: "CN", name: "China" }, { id: "IN", name: "India" }, { id: "RU", name: "Russia" },
  ];

  const handleUpdateDisplayed = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/actions/change-displayed-nation", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nationId: displayedNation })
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else { alert("Nazione mostrata aggiornata!"); fetchData(); }
    } catch { alert("Errore"); }
    finally { setSubmitting(false); }
  };

  const handleUpdateOriginal = async () => {
    if (!confirm("Sei sicuro? Potrai cambiarla di nuovo solo tra 30 giorni!")) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/actions/change-original-nation", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nationId: originalNation })
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else { alert("Nazione Originale aggiornata con successo! +10% Danni applicato nelle guerre patriottiche."); fetchData(); }
    } catch { alert("Errore"); }
    finally { setSubmitting(false); }
  };

  const now = Date.now();
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  const canChangeOriginal = now - (user.lastOriginalNationChange || 0) >= THIRTY_DAYS || (user.lastOriginalNationChange === 0);
  const nextAvailDate = new Date((user.lastOriginalNationChange || 0) + THIRTY_DAYS).toLocaleDateString();

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
          <Shield className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Gestione Nazione</h2>
          <p className="text-sm font-bold text-slate-400">Personalizza la tua identità e i tuoi bonus di guerra</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-6">
        <div>
          <h3 className="text-lg font-black text-slate-900 uppercase">Nazione Mostrata (Estetica)</h3>
          <p className="text-xs text-slate-400 font-bold mb-4">Questa nazione viene mostrata nel tuo profilo per scopi di Roleplay. Puoi cambiarla in qualsiasi momento senza limiti.</p>
          <div className="flex gap-4">
            <select value={displayedNation} onChange={e => setDisplayedNation(e.target.value)} className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 font-bold focus:ring-2 focus:ring-indigo-500">
              {NATION_OPTS.map(n => <option key={n.id} value={n.id}>{n.id} - {n.name}</option>)}
            </select>
            <button onClick={handleUpdateDisplayed} disabled={submitting || displayedNation === user.displayedNation} className="px-6 py-3 bg-indigo-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-lg shadow-indigo-100 disabled:opacity-50">
              Aggiorna
            </button>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-6">
          <h3 className="text-lg font-black text-rose-900 uppercase flex items-center gap-2">
            <Swords className="w-5 h-5" /> Nazione Originale (Bonus +10% Danni)
          </h3>
          <p className="text-xs text-rose-500 font-bold mb-4">La tua vera fedeltà. Riceverai un bonus del +10% ai danni se combatti a favore di questa nazione. Puoi cambiarla solo <b className="font-black">una volta ogni 30 giorni</b>.</p>

          <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl mb-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
            <p className="text-xs font-bold text-rose-900">
              {canChangeOriginal ? "Puoi cambiare la tua Nazione Originale ora." : `Hai già cambiato nazione di recente. Prossimo cambio disponibile il: ${nextAvailDate}`}
            </p>
          </div>

          <div className="flex gap-4">
            <select disabled={!canChangeOriginal} value={originalNation} onChange={e => setOriginalNation(e.target.value)} className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 font-bold focus:ring-2 focus:ring-rose-500 disabled:opacity-50">
              {NATION_OPTS.map(n => <option key={n.id} value={n.id}>{n.id} - {n.name}</option>)}
            </select>
            <button onClick={handleUpdateOriginal} disabled={submitting || !canChangeOriginal || originalNation === user.originalNation} className="px-6 py-3 bg-rose-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-lg shadow-rose-100 disabled:opacity-50">
              Giura Fedeltà
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// --- Storage & Market Views ---

const StorageView = ({ user }: { user: any }) => {
  const [activeTab, setActiveTab] = useState<"private" | "state">("private");
  const [stateInventory, setStateInventory] = useState<any[]>([]);
  const [loadingState, setLoadingState] = useState(false);

  const isLeader = user?.residenceId && user?.originalNation && user?.originalNation === user?.residenceId; // Simplified check for demonstration, ideally pass regions and check `region.ownerUserId === user.id`

  useEffect(() => {
    if (activeTab === "state") {
      setLoadingState(true);
      fetch("/api/market/state-inventory")
        .then(r => r.json())
        .then(data => setStateInventory(data))
        .finally(() => setLoadingState(false));
    }
  }, [activeTab]);

  const privateVolume = user?.inventoryVolume || 0;
  const privateMax = user?.maxInventoryVolume || GAME_CONFIG.STORAGE_BASE_CAPACITY;
  const pct = Math.min(100, (privateVolume / privateMax) * 100);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
          <Archive className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-xl flex flex-col font-black text-slate-900 tracking-tight uppercase leading-none mt-1">
            Magazzini
          </h2>
          <p className="text-sm font-bold text-slate-400">Gestisci le tue scorte personali o statali</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setActiveTab("private")} className={`px-4 py-2 font-black uppercase tracking-wider text-xs rounded-xl transition-all ${activeTab === 'private' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>Privato</button>
        {isLeader && <button onClick={() => setActiveTab("state")} className={`px-4 py-2 font-black uppercase tracking-wider text-xs rounded-xl transition-all ${activeTab === 'state' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>Stato</button>}
      </div>

      {activeTab === "private" && (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
          <div>
            <div className="flex justify-between items-end mb-2">
              <h3 className="font-black text-slate-800 uppercase">Spazio Occupato</h3>
              <span className="text-xs font-bold text-slate-500">{privateVolume} / {privateMax} unità</span>
            </div>
            <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden">
              <div className={`h-full transition-all duration-500 ${pct > 90 ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
            </div>
            {pct > 90 && <p className="text-[10px] text-rose-500 font-bold mt-2">Attenzione: magazzino quasi pieno!</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {(() => {
              const inventoryEntries = Object.entries(user.inventory || {}).filter(([_, qty]) => (qty as number) > 0);
              if (inventoryEntries.length === 0) {
                return <div className="col-span-2 text-center p-6 text-slate-400 font-bold">Magazzino vuoto</div>;
              }
              return inventoryEntries.map(([itemId, qty]) => {
                const weapon = WEAPONS_CATALOG.find(w => w.id === itemId);
                return (
                  <div key={itemId} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{weapon?.emoji || "📦"}</span>
                      <span className="font-black text-slate-800 capitalize">{weapon?.name || itemId}</span>
                    </div>
                    <span className="font-bold text-indigo-600">x{qty as number}</span>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {activeTab === "state" && (
        <div className="bg-emerald-50 p-8 rounded-[2.5rem] shadow-sm border border-emerald-100 space-y-6">
          <h3 className="font-black text-emerald-900 uppercase">Magazzino di Stato ({user.residenceId})</h3>
          <p className="text-xs font-bold text-emerald-700">Questo magazzino non ha limiti di volume. I beni sono acquistati con fondi statali.</p>
          {loadingState ? <Loader2 className="animate-spin w-6 h-6 text-emerald-600 mx-auto" /> : (
            <div className="grid grid-cols-2 gap-4">
              {stateInventory.map((item: any) => {
                const weapon = WEAPONS_CATALOG.find(w => w.id === item.itemId);
                return (
                  <div key={item.id} className="p-4 bg-white rounded-2xl border border-emerald-200 flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{weapon?.emoji || "📦"}</span>
                      <span className="font-black text-emerald-900 capitalize">{weapon?.name || item.itemId}</span>
                    </div>
                    <span className="font-bold text-emerald-600">x{item.quantity}</span>
                  </div>
                )
              })}
              {stateInventory.length === 0 && (
                <div className="col-span-2 text-center p-6 text-emerald-600/50 font-bold">Magazzino Statale vuoto</div>
              )}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

const MarketView = () => {
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [buyQty, setBuyQty] = useState<Record<string, number>>({});
  const [isStateBuy, setIsStateBuy] = useState(false);

  // Publish state
  const ITEMS_CATALOG = [
    { id: 'oil', name: 'Petrolio', emoji: '🛢️' },
    { id: 'minerals', name: 'Minerali', emoji: '🪨' },
    { id: 'uranium', name: 'Uranio', emoji: '☢️' },
    { id: 'diamonds', name: 'Diamanti', emoji: '💎' },
    ...WEAPONS_CATALOG
  ];

  const [selectedItem, setSelectedItem] = useState("oil");
  const [postQty, setPostQty] = useState(1);
  const [postPrice, setPostPrice] = useState(10);
  const [posting, setPosting] = useState(false);

  const fetchOffers = () => {
    setLoading(true);
    fetch("/api/market/offers")
      .then(r => r.json())
      .then(data => setOffers(Array.isArray(data) ? data : []))
      .catch(() => setOffers([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => { fetchOffers(); }, []);

  const handleBuy = async (offer: any) => {
    const q = buyQty[offer.id] || 1;
    if (q <= 0 || q > offer.quantity) return alert("Quantità non valida");
    setPurchasingId(offer.id);
    try {
      const res = await fetch("/api/market/buy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId: offer.id, quantity: q, isStateBuy })
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else {
        alert(`Acquisto completato! Pagato: $${data.totalPrice}`);
        fetchOffers();
      }
    } catch { alert("Errore del server"); }
    finally { setPurchasingId(null); }
  };

  const handlePostOffer = async () => {
    setPosting(true);
    try {
      const res = await fetch("/api/market/offer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: selectedItem, quantity: postQty, price: postPrice })
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else {
        alert("Offerta pubblicata sul mercato!");
        fetchOffers();
      }
    } catch { alert("Errore"); }
    finally { setPosting(false); }
  };

  const filtered = filterType === "all" ? offers : offers.filter(o => o.itemId === filterType);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
          <ShoppingCart className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-2xl flex flex-col font-black text-slate-900 tracking-tight uppercase leading-none">
            Mercato Globale
          </h2>
          <p className="text-sm font-bold text-slate-400">Scambia beni con altri giocatori</p>
        </div>
      </div>

      {/* Pubblica Offerta */}
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
        <h3 className="text-md font-black uppercase text-slate-800 mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-emerald-500" /> Vendi sul Mercato
        </h3>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[120px]">
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Oggetto</label>
            <select value={selectedItem} onChange={e => setSelectedItem(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 font-bold focus:ring-2 focus:ring-indigo-500">
              {ITEMS_CATALOG.map(w => <option key={w.id} value={w.id}>{w.emoji} {w.name}</option>)}
            </select>
          </div>
          <div className="w-24">
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Quantità</label>
            <input type="number" min="1" value={postQty} onChange={e => setPostQty(parseInt(e.target.value) || 1)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 font-bold" />
          </div>
          <div className="w-24">
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Prezzo/Unità</label>
            <input type="number" min="1" value={postPrice} onChange={e => setPostPrice(parseInt(e.target.value) || 1)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 font-bold" />
          </div>
          <button onClick={handlePostOffer} disabled={posting} className="px-6 py-2.5 bg-indigo-600 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-lg shadow-indigo-100 hover:scale-105 transition-all h-full">
            {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Pubblica"}
          </button>
        </div>
      </div>

      {/* Lista Offerte */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="bg-white border border-slate-100 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 shadow-sm outline-none">
            <option value="all">Filtra per Oggetto (Tutti)</option>
            {ITEMS_CATALOG.map(w => <option key={w.id} value={w.id}>{w.emoji} {w.name}</option>)}
          </select>

          <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm">
            <input type="checkbox" checked={isStateBuy} onChange={(e) => setIsStateBuy(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500 bg-slate-100 border-slate-300" />
            <span className="text-sm font-black text-slate-700 uppercase">Acquista come Stato</span>
          </label>
        </div>

        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-600 w-8 h-8" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center bg-white p-12 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <span className="text-4xl mb-3 block">🏜️</span>
            <p className="text-slate-400 font-bold">Nessuna offerta trovata sul mercato per questo filtro.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map(offer => {
              const item = ITEMS_CATALOG.find(w => w.id === offer.itemId);
              const isAbusive = offer.minPrice && offer.price > offer.minPrice * GAME_CONFIG.MARKET_ANTI_ABUSE_PERCENTAGE;

              return (
                <div key={offer.id} className={`bg-white p-5 rounded-3xl shadow-sm border ${isAbusive ? 'border-rose-200 bg-rose-50/30' : 'border-slate-100'} flex flex-wrap gap-4 items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-50 flex flex-col items-center justify-center rounded-xl font-bold text-lg shadow-inner">
                      {item?.emoji || "📦"}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-800 capitalize leading-none tracking-tight">{item?.name || offer.itemId}</p>
                      <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Venditore: <span className="text-indigo-500 font-black">{offer.sellerName}</span></p>
                    </div>
                  </div>

                  <div className="text-center px-4 border-l border-r border-slate-100">
                    <p className="text-xs font-black text-slate-400 uppercase">Prezzo Unit.</p>
                    <p className="text-lg font-black text-emerald-600">${offer.price}</p>
                  </div>

                  <div className="text-center px-2">
                    <p className="text-xs font-black text-slate-400 uppercase">Disponibili</p>
                    <p className="text-md font-bold text-slate-700">{offer.quantity}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number" min="1" max={offer.quantity}
                      value={buyQty[offer.id] || 1}
                      onChange={e => setBuyQty(prev => ({ ...prev, [offer.id]: parseInt(e.target.value) || 1 }))}
                      className="w-16 px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-bold outline-none"
                    />
                    <button
                      disabled={purchasingId === offer.id || isAbusive}
                      onClick={() => handleBuy(offer)}
                      className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl shadow-md transition-all disabled:opacity-50"
                    >
                      {purchasingId === offer.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Acquista"}
                    </button>
                    {isAbusive && <span className="text-[10px] text-rose-500 font-bold block ml-1 absolute right-2 -bottom-2">+110% Anti-Abuso</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
};

// --- Main App ---

export default function App() {
  const navigate = useNavigate();
  const [user, setUser] = useState<(User & { perks: Record<string, number>, maxEnergy: number }) | null>(null);
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

  // Auto-work state
  const [autoWorkFactoryId, setAutoWorkFactoryId] = useState<string | null>(null);
  const autoWorkFactoryIdRef = React.useRef(autoWorkFactoryId);
  autoWorkFactoryIdRef.current = autoWorkFactoryId;

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

  const fetchData = async () => {
    try {
      const [userRes, regionsRes, nationsRes, articlesRes, warsRes, worldStatsRes] = await Promise.all([
        fetch("/api/me"),
        fetch("/api/regions"),
        fetch("/api/nations"),
        fetch("/api/articles"),
        fetch("/api/wars"),
        fetch("/api/world-stats")
      ]);
      if (userRes.ok) {
        const userData = await userRes.json();
        setUser(userData);
      } else {
        setUser(null);
      }
      let regionsData: any[] = [];
      if (regionsRes.ok) {
        regionsData = await regionsRes.json();
        setRegions(regionsData);
      }
      if (nationsRes.ok) {
        setNations(await nationsRes.json());
      }
      if (articlesRes.ok) setArticles(await articlesRes.json());
      if (warsRes.ok) setWars(await warsRes.json());

      let ws = worldStats;
      if (worldStatsRes.ok) ws = await worldStatsRes.json();
      if (regionsData.length > 0) {
        const independentCount = regionsData.filter((r: any) => !r.nation_id).length;
        const uniqueStates = new Set(regionsData.map((r: any) => r.nation_id).filter(Boolean)).size;
        ws = {
          ...ws,
          totalRegions: regionsData.length,
          independentRegions: independentCount,
          totalStates: uniqueStates,
        };
      }
      setWorldStats(ws);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const pollIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Check for existing session before initial data fetch to avoid race conditions
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=${604800}; SameSite=Lax`;
      }
      fetchData();
    });

    pollIntervalRef.current = setInterval(fetchData, 10000); // Polling every 10s

    // Pause polling when tab is hidden, resume when visible
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      } else {
        fetchData(); // Refresh immediately on return
        pollIntervalRef.current = setInterval(fetchData, 10000);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        // Set cookie for backend authentication
        document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=${604800}; SameSite=Lax`;
        fetchData();
      } else {
        // Clear cookie on logout
        document.cookie = "sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const updateTimer = () => {
      // Assuming MAX energy is 100 for now. Can be retrieved from user.maxEnergy
      const maxE = user.maxEnergy || 100;
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

  // Auto-work interval
  useEffect(() => {
    if (!autoWorkFactoryId) return;
    let stopped = false;
    const doAutoWork = async () => {
      if (!autoWorkFactoryIdRef.current || stopped) return;
      try {
        const res = await fetch("/api/work", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ factoryId: autoWorkFactoryIdRef.current })
        });
        const data = await res.json();
        if (data.error) {
          // Only stop on critical errors (energy, inactive, not found), not cooldown
          const errLower = (data.error || '').toLowerCase();
          if (errLower.includes('energia') || errLower.includes('energy') || errLower.includes('non trovata') || errLower.includes('not found') || errLower.includes('non attiva')) {
            setAutoWorkFactoryId(null);
          }
          // Cooldown errors are expected - just wait for next interval
        }
        fetchData();
      } catch {
        // Network error - don't stop, retry next interval
      }
    };
    doAutoWork();
    const iv = setInterval(doAutoWork, 10 * 60 * 1000);
    return () => { stopped = true; clearInterval(iv); };
  }, [autoWorkFactoryId]);

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
  const isDashboardRoute = location.pathname.startsWith("/leader") || location.pathname.startsWith("/ministers");

  return (
    <div className={`min-h-screen bg-gray-950 text-gray-100 font-sans pb-24`}>
      {/* Header - Hidden on Dashboards */}
      {!isDashboardRoute && (
        <header className="bg-gray-900/95 backdrop-blur-md border-b border-gray-800/50 sticky top-0 z-40 px-4 py-2.5 flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 shrink-0">
            <TerritorialBrandLogo className="h-10 w-auto max-w-[14rem] object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.45)]" />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto flex-1 justify-end">
            <div className="bg-emerald-900/30 px-2.5 py-1.5 rounded-xl border border-emerald-700/30 flex items-center gap-1 shrink-0">
              <span className="text-[10px] font-black text-emerald-400">${(user.money || 0).toLocaleString()}</span>
            </div>
            <div className="bg-amber-900/30 px-2.5 py-1.5 rounded-xl border border-amber-700/30 flex items-center gap-1 shrink-0">
              <span className="text-[10px] font-black text-amber-400">🪙{user.gold || 0}</span>
            </div>
            <div className="bg-gray-800/60 px-2.5 py-1.5 rounded-xl border border-gray-700/40 flex items-center gap-1 shrink-0">
              <Zap className="w-3 h-3 text-indigo-400" />
              <span className="text-[10px] font-black text-gray-300">{user.energy}</span>
              <span className="text-[8px] font-bold text-gray-500 ml-1">{energyTimer}</span>
            </div>
            <button
              onClick={handleUseDrink}
              disabled={actionLoading}
              title="Usa Drink Energetico"
              className="bg-sky-900/30 px-2.5 py-1.5 rounded-xl border border-sky-700/30 flex items-center gap-1 shrink-0 hover:bg-sky-800/40 transition-colors disabled:opacity-50"
            >
              <span className="text-xs leading-none mt-0.5">🥤</span>
              <span className="text-[10px] font-black text-sky-400">{user.energyDrinks || 0}</span>
            </button>
            <button
              onClick={() => navigate("/profile")}
              className="w-8 h-8 rounded-xl overflow-hidden bg-indigo-900/30 flex items-center justify-center shrink-0 border border-indigo-700/30"
              title="Profilo"
            >
              {user.avatarData ? (
                <img src={user.avatarData} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-4 h-4 text-indigo-400" />
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
          <Route path="/market" element={<MarketView />} />
          <Route path="/storage" element={<StorageView user={user} />} />
          <Route path="/produce" element={<ProduceView user={user} />} />
          <Route path="/states" element={<NationsList />} />
          <Route path="/state/:id" element={<StatePage user={user} />} />
          <Route path="/players" element={<PlayersList />} />
          <Route path="/parties" element={<PartiesList />} />
          <Route path="/world-factories" element={<WorldFactoriesList />} />
          <Route path="/independent-regions" element={<IndependentRegionsList />} />
          <Route path="/articles" element={<ArticlesView articles={articles} setSelectedArticleId={setSelectedArticleId} />} />
          <Route path="/articles/:id" element={<ArticleDetailView articles={articles} user={user} fetchData={fetchData} />} />
          <Route path="/articles/new" element={<NewArticleView actionLoading={actionLoading} fetchData={fetchData} />} />
          <Route path="/work" element={
            user ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Mercato del Lavoro</h2>
                  <div className="bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span className="font-black text-slate-700">{user.energy}/{user.maxEnergy}</span>
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

                {/* Risorse estraibili nella regione (panoramica) */}
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

                {/* Limiti giornalieri */}
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

                {/* Esperienza sulle risorse */}
                <div className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-3">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Esperienza Lavorativa</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { emoji: "🛢️", label: "Petrolio", exp: user.oilExp || 0 },
                      { emoji: "🪨", label: "Minerali", exp: user.mineralsExp || 0 },
                      { emoji: "☢️", label: "Uranio", exp: user.uraniumExp || 0 },
                      { emoji: "💎", label: "Diamanti", exp: user.diamondsExp || 0 },
                    ].map(r => (
                      <div key={r.label} className="bg-slate-50 p-3 rounded-xl flex items-center gap-2">
                        <span className="text-lg">{r.emoji}</span>
                        <div>
                          <span className="text-[9px] font-black text-slate-400 uppercase">{r.label}</span>
                          <p className="text-sm font-black text-slate-800">{r.exp} XP</p>
                        </div>
                      </div>
                    ))}
                  </div>
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
                        <p className="text-[10px] text-slate-400 font-medium">Lavora ogni 10 min automaticamente (consuma energia)</p>
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
                      <span className="text-xs font-black text-amber-800">Auto-lavoro attivo! Prossimo turno tra 10 minuti.</span>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-600 font-medium">Seleziona una fabbrica qui sotto e clicca "🤖 Auto" per attivare il lavoro automatico.</p>
                  )}
                </div>

                <PlayerFactoriesView user={user} fetchData={fetchData} autoWorkFactoryId={autoWorkFactoryId} setAutoWorkFactoryId={setAutoWorkFactoryId} />
              </motion.div>
            ) : <Navigate to="/" />
          } />
          <Route path="/wars" element={<WarsView wars={wars} user={user} fetchData={fetchData} actionLoading={actionLoading} />} />
          <Route path="/party" element={<PartyHub user={user} fetchData={fetchData} />} />
          <Route path="/profile" element={<ProfileView user={user} regions={regions} nations={nations} handleUpgradePerk={handleUpgradePerk} handleActivateBooster={handleActivateBooster} actionLoading={actionLoading} fetchData={fetchData} />} />
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

const WEAPONS_CATALOG = [
  { id: "rifle", name: "Fucile", emoji: "🔫", timeMin: 1, costCash: 100, reqOil: 2, reqMinerals: 5, reqUranium: 0, reqDiamonds: 0, power: 2 },
  { id: "drone", name: "Drone", emoji: "🚁", timeMin: 8, costCash: 800, reqOil: 10, reqMinerals: 20, reqUranium: 2, reqDiamonds: 1, power: 20 },
  { id: "artillery", name: "Artiglieria", emoji: "💣", timeMin: 5, costCash: 500, reqOil: 15, reqMinerals: 30, reqUranium: 0, reqDiamonds: 0, power: 12 },
  { id: "tank", name: "Carro Armato", emoji: "🛡️", timeMin: 15, costCash: 1500, reqOil: 50, reqMinerals: 100, reqUranium: 5, reqDiamonds: 2, power: 40 },
  { id: "missile", name: "Missile", emoji: "🚀", timeMin: 30, costCash: 5000, reqOil: 100, reqMinerals: 50, reqUranium: 50, reqDiamonds: 10, power: 150 },
];

const ProduceView = ({ user }: { user: any }) => {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const fetchQueue = async () => {
    try {
      const res = await fetch("/api/produce/list");
      if (res.ok) setQueue(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const iv = setInterval(fetchQueue, 5000);
    return () => clearInterval(iv);
  }, []);

  const handleProduce = async (weaponId: string) => {
    const amount = qty[weaponId] || 1;
    setSubmitting(true);
    try {
      const res = await fetch("/api/produce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weaponType: weaponId, qty: amount }),
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else { fetchQueue(); alert(`✅ ${amount}x ${weaponId} in coda!`); }
    } catch { alert("Errore nella produzione"); }
    finally { setSubmitting(false); }
  };

  // Remove handleClaim as it's now automated the backend

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6"
    >
      <button onClick={() => navigate(-1)} className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1">
        ← Indietro
      </button>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
        <h2 className="text-2xl font-black tracking-tight">🔨 Produci Armi</h2>
        <div className="grid grid-cols-1 gap-4">
          {WEAPONS_CATALOG.map(w => {
            const amount = qty[w.id] || 1;
            const totalCost = amount * w.costCash;
            const canAfford =
              (user?.money || 0) >= totalCost &&
              (user?.oil || 0) >= amount * w.reqOil &&
              (user?.minerals || 0) >= amount * w.reqMinerals &&
              (user?.uranium || 0) >= amount * w.reqUranium &&
              (user?.diamonds || 0) >= amount * w.reqDiamonds;

            return (
              <div key={w.id} className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-slate-50 rounded-3xl border border-slate-100">
                <div className="flex items-center gap-4">
                  <span className="text-4xl">{w.emoji}</span>
                  <div>
                    <p className="font-black text-slate-900 text-lg leading-tight">{w.name}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm">💵 ${w.costCash.toLocaleString()}/u</span>
                      {w.reqOil > 0 && <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm">🛢️ {w.reqOil}</span>}
                      {w.reqMinerals > 0 && <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm">🪨 {w.reqMinerals}</span>}
                      {w.reqUranium > 0 && <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm">☢️ {w.reqUranium}</span>}
                      {w.reqDiamonds > 0 && <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm">💎 {w.reqDiamonds}</span>}
                      <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-1 rounded-lg border border-slate-100 italic">⏱ {w.timeMin}m</span>
                      <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">+{w.power} pw</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={qty[w.id] || 1}
                    onChange={e => setQty(q => ({ ...q, [w.id]: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="w-14 bg-white border border-slate-100 rounded-xl px-2 py-2 text-xs font-black text-center focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  <button
                    onClick={() => handleProduce(w.id)}
                    disabled={submitting || !canAfford}
                    className={`px-3 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${canAfford ? "bg-orange-500 text-white shadow-lg shadow-orange-100 hover:scale-105" : "bg-slate-100 text-slate-400"}`}
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Produci"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-black uppercase tracking-tight">Coda di Produzione</h3>
        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="animate-spin text-indigo-600 w-8 h-8" /></div>
        ) : queue.length === 0 ? (
          <div className="bg-white p-10 rounded-[2rem] text-center border border-slate-100">
            <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 font-bold text-sm">Nessuna produzione in corso</p>
          </div>
        ) : (
          queue.map((item: any) => {
            const isReady = item.status === "claimed" || item.status === "ready" || (item.willCompleteAt && item.willCompleteAt <= Date.now());
            return (
              <div key={item.id} className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-black text-slate-900 capitalize">{item.weaponType}</span>
                    <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg">x{item.qty}</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${isReady ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                      {isReady ? "✅ Pronto in magazzino" : "🔄 In coda"}
                    </span>
                  </div>
                  {!isReady && item.willCompleteAt && (
                    <div className="flex items-center gap-1 text-amber-500 text-xs font-bold">
                      <Timer className="w-3 h-3" />
                      <PerkTimer willCompleteAt={item.willCompleteAt} />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
};

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
            <th className="pb-4 font-bold text-slate-400 uppercase text-xs">Livello</th>
            <th className="pb-4 font-bold text-slate-400 uppercase text-xs">Wealth</th>
          </tr>
        </thead>
        <tbody>
          {leaders.map((leader, i) => (
            <tr key={leader.username} className="border-b border-slate-50 last:border-0">
              <td className="py-4 font-bold text-slate-400">#{i + 1}</td>
              <td className="py-4 font-bold text-slate-900">{leader.username}</td>
              <td className="py-4 font-bold text-indigo-600">Lv {leader.level}</td>
              <td className="py-4 font-bold text-emerald-600">${leader.money.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

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
                    <option value="rifle">🔫 Fucili</option>
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
// ██ REGIONAL RESOURCES UI COMPONENTS
// ══════════════════════════════════════════════════════════════════

// ── Region Resources Tab ────────────────────────────────────────
const RegionResourcesTab = ({ regionId, user }: { regionId: string; user: any }) => {
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResources = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/regions/${regionId}/resources`, { credentials: 'include' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResources(data.resources || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [regionId]);

  useEffect(() => { fetchResources(); }, [fetchResources]);

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (error) return <div className="p-4 bg-red-50 rounded-xl text-red-600 text-sm font-bold">{error}</div>;
  if (resources.length === 0) return <div className="p-6 text-center text-slate-400 text-sm">Nessuna risorsa configurata per questa regione.</div>;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
        <Pickaxe className="w-4 h-4" /> Risorse Regionali
      </h3>
      {resources.map((r: any) => {
        const icon = RESOURCE_ICONS_MAP[r.resourceType as ResourceType] || '📦';
        const label = RESOURCE_LABELS[r.resourceType as ResourceType] || r.resourceType;
        const pctDaily = r.dailyAvailable > 0 ? Math.min(100, (r.dailyExtracted / r.dailyAvailable) * 100) : 0;
        return (
          <div key={r.resourceType} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{icon}</span>
                <span className="font-black text-slate-800 text-sm">{label}</span>
                {r.deepActive && (
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[9px] font-black uppercase">🔮 Deep</span>
                )}
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400">Cap effettivo</span>
                <p className="text-sm font-black text-indigo-600">{r.effectiveCapPerRecharge}
                  {r.effectiveCapPerRecharge > r.baseCapPerRecharge && (
                    <span className="text-[9px] text-purple-500 ml-1">(base {r.baseCapPerRecharge})</span>
                  )}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-50 p-2 rounded-lg">
                <p className="text-[9px] font-bold text-slate-400 uppercase">Disponibile</p>
                <p className="text-sm font-black text-slate-800">{r.dailyAvailable.toLocaleString()}</p>
              </div>
              <div className="bg-amber-50 p-2 rounded-lg">
                <p className="text-[9px] font-bold text-amber-500 uppercase">Estratto</p>
                <p className="text-sm font-black text-amber-700">{r.dailyExtracted.toLocaleString()}</p>
              </div>
              <div className="bg-emerald-50 p-2 rounded-lg">
                <p className="text-[9px] font-bold text-emerald-500 uppercase">Rimanente</p>
                <p className="text-sm font-black text-emerald-700">{r.remainingDaily.toLocaleString()}</p>
              </div>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div className="bg-indigo-500 h-full rounded-full transition-all" style={{ width: `${pctDaily}%` }} />
            </div>
            {r.deepActive && r.deepEndsAt && (
              <p className="text-[9px] text-purple-500 font-medium">
                🔮 Deep attiva fino al {new Date(r.deepEndsAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Resource Work / Extract UI ──────────────────────────────────
const ResourceExtractView = ({ user, fetchData }: { user: any; fetchData: () => void }) => {
  const [regionId, setRegionId] = useState(user?.regionId || '');
  const [resources, setResources] = useState<any[]>([]);
  const [playerStates, setPlayerStates] = useState<any[]>([]);
  const [selectedResource, setSelectedResource] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchAll = useCallback(async () => {
    if (!regionId) return;
    setLoading(true);
    try {
      const [resRes, stateRes] = await Promise.all([
        fetch(`/api/regions/${regionId}/resources`, { credentials: 'include' }).then(r => r.json()),
        fetch(`/api/resources/player-state?regionId=${regionId}`, { credentials: 'include' }).then(r => r.json()),
      ]);
      setResources(resRes.resources || []);
      setPlayerStates(stateRes.states || []);
      if (!selectedResource && resRes.resources?.length > 0) {
        setSelectedResource(resRes.resources[0].resourceType);
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [regionId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleWork = async () => {
    if (!selectedResource || !regionId) return;
    setWorking(true);
    setMessage(null);
    try {
      const res = await fetch('/api/resources/work-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ regionId, resourceType: selectedResource }),
      });
      const data = await res.json();
      if (data.error) {
        setMessage({ text: data.error, type: 'error' });
      } else {
        const icon = RESOURCE_ICONS_MAP[selectedResource as ResourceType] || '📦';
        setMessage({ text: `+${data.amount} ${icon} ${RESOURCE_LABELS[selectedResource as ResourceType] || selectedResource} estratti! (+${data.xpGain} XP)`, type: 'success' });
        fetchAll();
        fetchData();
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setWorking(false);
    }
  };

  const selectedRes = resources.find((r: any) => r.resourceType === selectedResource);
  const playerState = playerStates.find((s: any) => s.resourceType === selectedResource);
  const extractedCycle = playerState?.extractedSinceLastRecharge || 0;
  const effectiveCap = selectedRes?.effectiveCapPerRecharge || 0;
  const remainingCycle = Math.max(0, effectiveCap - extractedCycle);
  const remainingDaily = selectedRes ? Math.max(0, selectedRes.dailyAvailable - selectedRes.dailyExtracted) : 0;
  const canWork = remainingCycle > 0 && remainingDaily > 0 && (user?.energy || 0) >= 10;
  const blockReason = remainingCycle <= 0 ? "Cap del ciclo raggiunto. Serve una ricarica!" : remainingDaily <= 0 ? "Risorsa giornaliera esaurita!" : (user?.energy || 0) < 10 ? "Energia insufficiente!" : null;

  return (
    <div className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-4">
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
        <Pickaxe className="w-4 h-4 text-amber-500" /> Estrazione Risorse
      </h3>

      {/* Resource selector */}
      {resources.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {resources.map((r: any) => {
            const icon = RESOURCE_ICONS_MAP[r.resourceType as ResourceType] || '📦';
            const label = RESOURCE_LABELS[r.resourceType as ResourceType] || r.resourceType;
            const isSelected = selectedResource === r.resourceType;
            return (
              <button
                key={r.resourceType}
                onClick={() => setSelectedResource(r.resourceType)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  isSelected ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-300' : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>{icon}</span> {label}
                {r.deepActive && <span className="text-purple-500">🔮</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-slate-400">Nessuna risorsa disponibile in questa regione.</p>
      )}

      {/* Selected resource details */}
      {selectedRes && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-blue-50 p-3 rounded-xl">
              <p className="text-[9px] font-bold text-blue-400 uppercase">Ciclo personale</p>
              <p className="text-sm font-black text-blue-700">{extractedCycle} / {effectiveCap}</p>
              <div className="w-full bg-blue-100 h-1 rounded-full mt-1 overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full" style={{ width: `${effectiveCap > 0 ? (extractedCycle / effectiveCap) * 100 : 0}%` }} />
              </div>
            </div>
            <div className="bg-emerald-50 p-3 rounded-xl">
              <p className="text-[9px] font-bold text-emerald-400 uppercase">Giornaliero regione</p>
              <p className="text-sm font-black text-emerald-700">{selectedRes.dailyExtracted} / {selectedRes.dailyAvailable}</p>
              <div className="w-full bg-emerald-100 h-1 rounded-full mt-1 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${selectedRes.dailyAvailable > 0 ? (selectedRes.dailyExtracted / selectedRes.dailyAvailable) * 100 : 0}%` }} />
              </div>
            </div>
          </div>

          {/* Work button */}
          <button
            onClick={handleWork}
            disabled={!canWork || working || loading}
            className={`w-full py-3 rounded-xl font-black text-sm uppercase tracking-wide transition-all flex items-center justify-center gap-2 ${
              canWork && !working ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {working ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Estraendo...</>
            ) : (
              <><Pickaxe className="w-4 h-4" /> Lavora / Estrai</>
            )}
          </button>

          {blockReason && (
            <div className="bg-amber-50 p-3 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-xs font-bold text-amber-700">{blockReason}</span>
            </div>
          )}
        </div>
      )}

      {/* Feedback message */}
      {message && (
        <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}
    </div>
  );
};

// ── Government Recharge Panel ───────────────────────────────────
const RechargeResourcePanel = ({ regionId, user }: { regionId: string; user: any }) => {
  const [resources, setResources] = useState<any[]>([]);
  const [selectedResource, setSelectedResource] = useState<string>('');
  const [rechargeInfo, setRechargeInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/regions/${regionId}/resources`, { credentials: 'include' });
        const data = await res.json();
        setResources(data.resources || []);
        if (data.resources?.length > 0) setSelectedResource(data.resources[0].resourceType);
      } catch (err: any) {
        setMessage({ text: err.message, type: 'error' });
      } finally {
        setLoading(false);
      }
    })();
  }, [regionId]);

  useEffect(() => {
    if (!selectedResource) return;
    (async () => {
      try {
        const res = await fetch(`/api/resources/recharge-info?regionId=${regionId}&resourceType=${selectedResource}`, { credentials: 'include' });
        const data = await res.json();
        setRechargeInfo(data);
      } catch (err: any) {
        console.error(err);
      }
    })();
  }, [selectedResource, regionId]);

  const handleRecharge = async () => {
    if (!selectedResource) return;
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/resources/recharge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ regionId, resourceType: selectedResource }),
      });
      const data = await res.json();
      if (data.error) {
        setMessage({ text: data.error, type: 'error' });
      } else {
        setMessage({ text: data.message || 'Ricarica completata!', type: 'success' });
        // Refresh info
        const infoRes = await fetch(`/api/resources/recharge-info?regionId=${regionId}&resourceType=${selectedResource}`, { credentials: 'include' });
        setRechargeInfo(await infoRes.json());
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center p-4"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;

  const cooldownActive = (rechargeInfo?.cooldownRemaining || 0) > 0;
  const canAfford = rechargeInfo?.canAfford !== false;
  const canRecharge = !cooldownActive && canAfford && !actionLoading;

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
        <RefreshCcw className="w-4 h-4 text-emerald-500" /> Ricarica Risorse
      </h3>
      <p className="text-[10px] text-slate-400">Resetta i contatori di estrazione per tutti i giocatori su questa risorsa+regione.</p>

      {resources.length > 0 ? (
        <>
          {/* Resource selector */}
          <div className="flex gap-2 flex-wrap">
            {resources.map((r: any) => {
              const icon = RESOURCE_ICONS_MAP[r.resourceType as ResourceType] || '📦';
              return (
                <button
                  key={r.resourceType}
                  onClick={() => setSelectedResource(r.resourceType)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold ${
                    selectedResource === r.resourceType ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300' : 'bg-slate-50 text-slate-500 border border-slate-200'
                  }`}
                >
                  {icon} {RESOURCE_LABELS[r.resourceType as ResourceType] || r.resourceType}
                </button>
              );
            })}
          </div>

          {rechargeInfo && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 p-2 rounded-lg">
                  <span className="text-slate-400 font-bold">Costo ricarica</span>
                  <p className="font-black text-slate-800">€{(rechargeInfo.costEur || 0).toLocaleString()}</p>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg">
                  <span className="text-slate-400 font-bold">Tesoro</span>
                  <p className={`font-black ${canAfford ? 'text-emerald-600' : 'text-red-500'}`}>€{(rechargeInfo.treasuryEur || 0).toLocaleString()}</p>
                </div>
              </div>

              {cooldownActive && (
                <div className="bg-amber-50 p-2 rounded-lg flex items-center gap-2">
                  <Timer className="w-3 h-3 text-amber-500" />
                  <span className="text-xs font-bold text-amber-700">
                    Cooldown: {Math.ceil((rechargeInfo.cooldownRemaining || 0) / 60)} minuti rimanenti
                  </span>
                </div>
              )}

              <button
                onClick={handleRecharge}
                disabled={!canRecharge}
                className={`w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wide transition-all flex items-center justify-center gap-2 ${
                  canRecharge ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                Ricarica {RESOURCE_LABELS[selectedResource as ResourceType] || selectedResource}
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-slate-400">Nessuna risorsa configurata.</p>
      )}

      {message && (
        <div className={`p-2 rounded-lg text-xs font-bold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
          {message.text}
        </div>
      )}
    </div>
  );
};

// ── Deep Exploration Panel ──────────────────────────────────────
const DeepExplorationPanel = ({ user, nationId }: { user: any; nationId: string }) => {
  const [levels, setLevels] = useState<any[]>([]);
  const [active, setActive] = useState<any>(null);
  const [selectedResource, setSelectedResource] = useState<string>('oil');
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [costPreview, setCostPreview] = useState<DeepCostPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [activating, setActivating] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/resources/deep-exploration/status?nationId=${nationId}`, { credentials: 'include' });
        const data = await res.json();
        setActive(data.active);
        setLevels(data.levels || []);
        if (data.levels?.length > 0) setSelectedLevel(data.levels[0].level);
      } catch (err: any) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [nationId]);

  const computeCost = useCallback(async () => {
    if (!selectedResource || !selectedLevel || !nationId) return;
    setComputing(true);
    setCostPreview(null);
    try {
      const res = await fetch('/api/resources/deep-exploration/cost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nationId, resourceType: selectedResource, level: selectedLevel }),
      });
      const data = await res.json();
      if (data.error) {
        setMessage({ text: data.error, type: 'error' });
      } else {
        setCostPreview(data);
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setComputing(false);
    }
  }, [nationId, selectedResource, selectedLevel]);

  useEffect(() => { computeCost(); }, [computeCost]);

  const handleActivate = async () => {
    if (!costPreview) return;
    const resLabel = RESOURCE_LABELS[selectedResource as ResourceType];
    const goldPart = costPreview.costGold > 0 ? ` + ${costPreview.costGold.toLocaleString()} gold` : '';
    const confirmMsg = `Confermi l'attivazione di Deep Exploration Lv${selectedLevel} per ${resLabel}?\n\nCosto: 💎${costPreview.costDiamonds.toLocaleString()} + €${costPreview.costEur.toLocaleString()}${goldPart}`;
    if (!window.confirm(confirmMsg)) return;

    setActivating(true);
    setMessage(null);
    try {
      const res = await fetch('/api/resources/deep-exploration/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nationId, resourceType: selectedResource, level: selectedLevel }),
      });
      const data = await res.json();
      if (data.error) {
        setMessage({ text: data.error, type: 'error' });
      } else {
        setMessage({ text: data.message || 'Deep Exploration attivata!', type: 'success' });
        setActive({ ...data, resourceType: selectedResource, targetCap: costPreview.targetCap, endsAt: data.endsAt });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setActivating(false);
    }
  };

  if (loading) return <div className="flex justify-center p-6"><Loader2 className="w-6 h-6 animate-spin text-purple-400" /></div>;

  return (
    <div className="bg-white p-5 rounded-2xl border border-purple-100 shadow-sm space-y-4">
      <h3 className="text-sm font-black uppercase tracking-widest text-purple-600 flex items-center gap-2">
        🔮 Deep Exploration
      </h3>
      <p className="text-[10px] text-slate-400">
        Attiva una legge temporanea (7 giorni) che aumenta i cap di ricarica per una risorsa in tutte le regioni della nazione.
        Il costo dipende da quanto devi alzare i cap (somma dei delta).
      </p>

      {/* Active Deep indicator */}
      {active && (
        <div className="bg-purple-50 p-3 rounded-xl border border-purple-200 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔮</span>
            <span className="font-black text-purple-700 text-sm">Deep Exploration ATTIVA</span>
          </div>
          <p className="text-xs text-purple-600">
            Risorsa: <span className="font-bold">{RESOURCE_ICONS_MAP[active.resourceType as ResourceType]} {RESOURCE_LABELS[active.resourceType as ResourceType]}</span>
            {' '} | Target Cap: <span className="font-bold">{active.targetCap}</span>
          </p>
          <p className="text-xs text-purple-500">
            Scade: {new Date(active.endsAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}

      {!active && (
        <>
          {/* Resource selector */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Risorsa Target</label>
            <div className="flex gap-2 flex-wrap">
              {RESOURCE_TYPES.map(rt => (
                <button
                  key={rt}
                  onClick={() => setSelectedResource(rt)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedResource === rt ? 'bg-purple-100 text-purple-700 border-2 border-purple-300' : 'bg-slate-50 text-slate-500 border border-slate-200'
                  }`}
                >
                  {RESOURCE_ICONS_MAP[rt]} {RESOURCE_LABELS[rt]}
                </button>
              ))}
            </div>
          </div>

          {/* Level selector */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Livello Deep</label>
            <div className="flex gap-2">
              {levels.map((l: any) => (
                <button
                  key={l.level}
                  onClick={() => setSelectedLevel(l.level)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    selectedLevel === l.level ? 'bg-purple-600 text-white shadow-lg shadow-purple-200' : 'bg-slate-50 text-slate-600 border border-slate-200'
                  }`}
                >
                  Lv {l.level} — Cap {l.targetCap}
                </button>
              ))}
            </div>
          </div>

          {/* Cost preview */}
          {computing && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-3 h-3 animate-spin" /> Calcolo costi...
            </div>
          )}

          {costPreview && !computing && (
            <div className="bg-slate-50 p-3 rounded-xl space-y-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Anteprima Costi</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white p-2 rounded-lg border border-slate-100">
                  <p className="text-[9px] text-slate-400">Target Cap</p>
                  <p className="text-sm font-black text-purple-700">{costPreview.targetCap}</p>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-100">
                  <p className="text-[9px] text-slate-400">Regioni</p>
                  <p className="text-sm font-black text-slate-700">{costPreview.numRegions}</p>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-100">
                  <p className="text-[9px] text-slate-400">ΣDelta</p>
                  <p className="text-sm font-black text-amber-700">{costPreview.sumDelta.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex gap-2 text-xs font-bold">
                {costPreview.costDiamonds > 0 && (
                  <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded">💎 {costPreview.costDiamonds.toLocaleString()}</span>
                )}
                {costPreview.costEur > 0 && (
                  <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded">€{costPreview.costEur.toLocaleString()}</span>
                )}
                {costPreview.costGold > 0 && (
                  <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded">🪙 {costPreview.costGold.toLocaleString()}</span>
                )}
              </div>
            </div>
          )}

          {/* Activate button */}
          <button
            onClick={handleActivate}
            disabled={!costPreview || activating || computing}
            className={`w-full py-3 rounded-xl font-black text-sm uppercase tracking-wide transition-all flex items-center justify-center gap-2 ${
              costPreview && !activating ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-200' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {activating ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>🔮</span>}
            Attiva Deep Exploration Lv{selectedLevel}
          </button>
        </>
      )}

      {message && (
        <div className={`p-3 rounded-xl text-xs font-bold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
          {message.text}
        </div>
      )}
    </div>
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

  useEffect(() => { setParamsForm({}); }, [selectedLaw]);

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
                {(selectedLaw === 'declare_war' || selectedLaw === 'peace_treaty' || selectedLaw === 'migration_agreement' || selectedLaw === 'revoke_migration_agreement' || selectedLaw === 'apply_sanctions' || selectedLaw === 'revoke_sanctions') && (
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">ID Nazione Bersaglio</label>
                    <input type="text" placeholder="Es: FR, DE, US..." value={paramsForm.targetRegionId || ''} onChange={e => setParamsForm({ ...paramsForm, targetRegionId: e.target.value.toUpperCase() })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500 uppercase" />
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
                <button disabled={acting} onClick={handlePropose} className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors">
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
