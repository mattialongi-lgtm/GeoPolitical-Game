/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from "react";
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
  Heart,
  Gem,
  Hammer,
  Package,
  CheckCircle2,
  Timer,
  Send,
  Camera,
  BookOpen
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps";
import { User, Region, GAME_CONFIG, PERKS_DEFS, Article, Factory, War, BOOSTER_CONFIG } from "./types";
import { auth, googleProvider, isFirebaseConfigured } from "./lib/firebase";
import { signInWithPopup } from "firebase/auth";
import { useNavigate, useLocation, Routes, Route, Link, useParams } from "react-router-dom";
import { MoreVertical, Settings } from "lucide-react";

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// --- Utilities ---
const getTs = (val: any) => {
  if (!val) return 0;
  if (typeof val === "number") return val;
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

// --- Components ---

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const tabs = [
    { id: "/", label: "Home", icon: Home },
    { id: "/articles", label: "Articoli", icon: FileText },
    { id: "/work", label: "Lavoro", icon: Briefcase },
    { id: "/wars", label: "Guerre", icon: Swords },
    { id: "/profile", label: "Profilo", icon: UserIcon },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-6 py-3 flex justify-between items-center z-50 pb-safe">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = location.pathname === tab.id ||
          (tab.id === "/articles" && (location.pathname.startsWith("/articles"))) ||
          (tab.id === "/" && location.pathname.startsWith("/countries"));
        return (
          <button
            key={tab.id}
            onClick={() => navigate(tab.id)}
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

const MAP_COUNTRIES = [
  { iso2: "AF", name: "Afghanistan", flag: "🇦🇫" }, { iso2: "DZ", name: "Algeria", flag: "🇩🇿" },
  { iso2: "AR", name: "Argentina", flag: "🇦🇷" }, { iso2: "AU", name: "Australia", flag: "🇦🇺" },
  { iso2: "AT", name: "Austria", flag: "🇦🇹" }, { iso2: "BE", name: "Belgium", flag: "🇧🇪" },
  { iso2: "BR", name: "Brazil", flag: "🇧🇷" }, { iso2: "CA", name: "Canada", flag: "🇨🇦" },
  { iso2: "CL", name: "Chile", flag: "🇨🇱" }, { iso2: "CN", name: "China", flag: "🇨🇳" },
  { iso2: "CO", name: "Colombia", flag: "🇨🇴" }, { iso2: "CZ", name: "Czech Republic", flag: "🇨🇿" },
  { iso2: "DK", name: "Denmark", flag: "🇩🇰" }, { iso2: "EG", name: "Egypt", flag: "🇪🇬" },
  { iso2: "ET", name: "Ethiopia", flag: "🇪🇹" }, { iso2: "FI", name: "Finland", flag: "🇫🇮" },
  { iso2: "FR", name: "France", flag: "🇫🇷" }, { iso2: "DE", name: "Germany", flag: "🇩🇪" },
  { iso2: "GH", name: "Ghana", flag: "🇬🇭" }, { iso2: "GR", name: "Greece", flag: "🇬🇷" },
  { iso2: "HU", name: "Hungary", flag: "🇭🇺" }, { iso2: "IN", name: "India", flag: "🇮🇳" },
  { iso2: "ID", name: "Indonesia", flag: "🇮🇩" }, { iso2: "IR", name: "Iran", flag: "🇮🇷" },
  { iso2: "IQ", name: "Iraq", flag: "🇮🇶" }, { iso2: "IE", name: "Ireland", flag: "🇮🇪" },
  { iso2: "IL", name: "Israel", flag: "🇮🇱" }, { iso2: "IT", name: "Italy", flag: "🇮🇹" },
  { iso2: "JP", name: "Japan", flag: "🇯🇵" }, { iso2: "KE", name: "Kenya", flag: "🇰🇪" },
  { iso2: "KR", name: "South Korea", flag: "🇰🇷" }, { iso2: "MA", name: "Morocco", flag: "🇲🇦" },
  { iso2: "MX", name: "Mexico", flag: "🇲🇽" }, { iso2: "MY", name: "Malaysia", flag: "🇲🇾" },
  { iso2: "NL", name: "Netherlands", flag: "🇳🇱" }, { iso2: "NZ", name: "New Zealand", flag: "🇳🇿" },
  { iso2: "NG", name: "Nigeria", flag: "🇳🇬" }, { iso2: "NO", name: "Norway", flag: "🇳🇴" },
  { iso2: "PK", name: "Pakistan", flag: "🇵🇰" }, { iso2: "PE", name: "Peru", flag: "🇵🇪" },
  { iso2: "PH", name: "Philippines", flag: "🇵🇭" }, { iso2: "PL", name: "Poland", flag: "🇵🇱" },
  { iso2: "PT", name: "Portugal", flag: "🇵🇹" }, { iso2: "RO", name: "Romania", flag: "🇷🇴" },
  { iso2: "RU", name: "Russia", flag: "🇷🇺" }, { iso2: "SA", name: "Saudi Arabia", flag: "🇸🇦" },
  { iso2: "SG", name: "Singapore", flag: "🇸🇬" }, { iso2: "ZA", name: "South Africa", flag: "🇿🇦" },
  { iso2: "ES", name: "Spain", flag: "🇪🇸" }, { iso2: "SE", name: "Sweden", flag: "🇸🇪" },
  { iso2: "CH", name: "Switzerland", flag: "🇨🇭" }, { iso2: "TZ", name: "Tanzania", flag: "🇹🇿" },
  { iso2: "TH", name: "Thailand", flag: "🇹🇭" }, { iso2: "TR", name: "Turkey", flag: "🇹🇷" },
  { iso2: "UA", name: "Ukraine", flag: "🇺🇦" }, { iso2: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { iso2: "US", name: "United States", flag: "🇺🇸" }, { iso2: "VN", name: "Vietnam", flag: "🇻🇳" },
];

const WorldMap = ({ onRegionClick, regions }: { onRegionClick: (id: string) => void, regions: Region[] }) => {
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const filtered = search.length >= 1
    ? MAP_COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.iso2.toLowerCase().startsWith(search.toLowerCase())
    ).slice(0, 6)
    : [];

  const pick = (iso2: string) => {
    setSearch("");
    setOpen(false);
    onRegionClick(iso2);
  };

  return (
    <div className="bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-xl border border-slate-800">
      {/* Map visual */}
      <ComposableMap projectionConfig={{ scale: 140 }} style={{ width: "100%", height: "auto", display: "block" }}>
        <Geographies geography={geoUrl}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const iso2 = (
                geo.properties.ISO_A2_EH || geo.properties.ISO_A2 || geo.properties.iso_a2 || ""
              ).replace(/^-99$/, "").trim().toUpperCase();
              const region = iso2 ? regions.find(r => r.id === iso2) : null;
              const isOwned = region && region.ownerUserId;
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  style={{
                    default: { fill: isOwned ? "#6366f1" : "#334155", outline: "none", stroke: "#1e293b", strokeWidth: 0.5 },
                    hover: { fill: isOwned ? "#6366f1" : "#334155", outline: "none" },
                    pressed: { fill: isOwned ? "#6366f1" : "#334155", outline: "none" },
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>

      {/* Search overlay — always works */}
      <div className="p-4 pt-0 relative">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            placeholder="🔍  Cerca e clicca un paese..."
            value={search}
            onChange={e => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            className="w-full bg-slate-800 text-white placeholder:text-slate-500 border border-slate-700 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
          {open && filtered.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-50">
              {filtered.map(c => {
                const regionData = regions.find(r => r.id === c.iso2);
                const isOwned = regionData?.ownerUserId;
                return (
                  <button
                    key={c.iso2}
                    onMouseDown={() => pick(c.iso2)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-0"
                  >
                    <span className="text-xl shrink-0">{c.flag}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-white truncate">{c.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{c.iso2}{isOwned ? " • 🟣 Occupato" : " • Neutrale"}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-2">
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-indigo-500 rounded-full" /><span className="text-[8px] font-bold text-slate-500 uppercase">Occupato</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-slate-700 rounded-full" /><span className="text-[8px] font-bold text-slate-500 uppercase">Neutrale</span></div>
        </div>
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

interface ChatMessage {
  id: number;
  userId: string;
  username: string;
  regionId: string;
  message: string;
  createdAt: number;
}

const GlobalChat = ({ currentUser }: { currentUser: any }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    try {
      const res = await fetch("/api/chat");
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
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input.trim() }),
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
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-50">
        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Chat Globale</h3>
        <span className="ml-auto text-[10px] font-black text-slate-300 uppercase">{messages.length} messaggi</span>
      </div>

      {/* Messages */}
      <div
        ref={listRef}
        className="h-72 overflow-y-auto px-4 py-3 space-y-2 scroll-smooth"
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

const HomeView = ({ user, regions, navigateToCountry }: { user: any, regions: Region[], navigateToCountry: (id: string) => void }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    className="space-y-8"
  >
    <div className="grid grid-cols-2 gap-4">
      <StatCard icon={DollarSign} label="Tesoro" value={`$${user.money.toLocaleString()}`} color="bg-emerald-500" />
      <StatCard icon={Zap} label="Energia" value={`${user.energy}/${user.maxEnergy}`} color="bg-amber-500" subValue={`Regen: +${GAME_CONFIG.ENERGY_REGEN_RATE + (user.perks?.['RESISTENZA'] || 0) * 5}/h`} />
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

    <GlobalChat currentUser={user} />
  </motion.div>
);

const ArticlesView = ({ articles, setSelectedArticleId }: { articles: Article[], setSelectedArticleId: (id: string) => void }) => {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Notiziario Globale</h2>
        <button
          onClick={() => navigate("/articles/new")}
          className="bg-indigo-600 text-white p-3 rounded-2xl shadow-lg shadow-indigo-100 hover:scale-105 transition-all"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      <div className="space-y-4">
        {articles.map(article => (
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
  );
};

const ArticleDetailView = ({ articles, user, fetchData }: { articles: Article[], user: any, fetchData: () => void }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [actionLoading, setActionLoading] = useState(false);
  const article = articles.find(a => a.id === id);

  if (!article) return <div>Articolo non trovato</div>;

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
    </motion.div>
  );
};

const NewArticleView = ({ actionLoading, fetchData }: { actionLoading: boolean, fetchData: () => void }) => {
  const navigate = useNavigate();
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
                  body: JSON.stringify({ title, content }),
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

const WorkView = ({ user, factories, actionLoading, handleAction }: { user: any, factories: any[], actionLoading: boolean, handleAction: (a: string, b: any) => void }) => (
  <motion.div
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
        const energyEfficiency = (user.perks['INDUSTRIA'] || 0) * 0.05;
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
);

const WarsView = ({ wars }: { wars: any }) => (
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

    {wars.active.length > 0 && (
      <div className="space-y-4">
        <h3 className="text-lg font-black uppercase tracking-tight">Guerre in Corso</h3>
        <div className="grid grid-cols-1 gap-4">
          {wars.active.map((war: any) => (
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
);

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

// Self-contained perk countdown — converts willCompleteAt to number explicitly
// to handle both plain numbers and Firestore-returned values
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

// Player Factories View
const FACTORY_ICON_LIST = ["🏭", "⚙️", "🔧", "🏗️", "🔩", "💎", "🚀", "⚡", "🌐", "🛡️"];
const CREATE_COST_GOLD = 50;

const PlayerFactoriesView = ({ user, fetchData }: { user: any; fetchData: () => void }) => {
  const [factories, setFactories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("🏭");
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/player-factories");
      if (res.ok) setFactories(await res.json());
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/player-factories", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, icon: newIcon }),
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else { setCreating(false); setNewName(""); fetchData(); load(); }
    } catch { alert("Errore"); } finally { setActionLoading(false); }
  };

  const handleUpgrade = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/player-factories/${id}/upgrade`, { method: "POST" });
      const data = await res.json();
      if (data.error) alert(data.error);
      else { fetchData(); load(); }
    } catch { alert("Errore"); } finally { setActionLoading(false); }
  };

  const handleWork = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/actions/work-factory", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factoryId: id }),
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else { alert(`+$${data.earnings} guadagnati!`); fetchData(); load(); }
    } catch { alert("Errore"); } finally { setActionLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-black tracking-tight uppercase">Fabbriche del Giocatore</h3>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-amber-100 hover:scale-105 transition-all"
        >
          <Plus className="w-4 h-4" /> Crea ({CREATE_COST_GOLD}🏅)
        </button>
      </div>

      {creating && (
        <div className="bg-white p-6 rounded-[2rem] border border-amber-100 shadow-sm space-y-4">
          <h4 className="font-black text-slate-900">Nuova Fabbrica</h4>
          <div className="flex gap-2 flex-wrap">
            {FACTORY_ICON_LIST.map(icon => (
              <button key={icon} onClick={() => setNewIcon(icon)}
                className={`w-10 h-10 text-xl rounded-xl transition-all ${newIcon === icon ? "bg-indigo-100 ring-2 ring-indigo-400" : "bg-slate-50 hover:bg-slate-100"}`}>
                {icon}
              </button>
            ))}
          </div>
          <input
            value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Nome della fabbrica..."
            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-amber-200 transition-all"
            maxLength={30}
          />
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={actionLoading || !newName.trim()}
              className="flex-1 py-3 bg-amber-500 text-white rounded-2xl font-black text-sm hover:bg-amber-600 transition-all disabled:opacity-50">
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : `Crea per ${CREATE_COST_GOLD}🏅`}
            </button>
            <button onClick={() => setCreating(false)}
              className="px-4 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all">
              Annulla
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-indigo-600 w-8 h-8" /></div>
      ) : factories.length === 0 ? (
        <div className="bg-white p-10 rounded-[2rem] text-center border border-slate-100">
          <span className="text-4xl">🏭</span>
          <p className="text-slate-400 font-bold text-sm mt-3">Nessuna fabbrica ancora. Sii il primo!</p>
        </div>
      ) : (
        factories.map(f => (
          <div key={f.id} className={`bg-white p-5 rounded-[2rem] shadow-sm border ${f.isOwner ? "border-amber-100" : "border-slate-100"} space-y-4`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${f.isOwner ? "bg-amber-50" : "bg-slate-50"}`}>{f.icon}</div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-black text-slate-900">{f.name}</h4>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${f.isOwner ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-500"}`}>Lv {f.level}</span>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">di {f.ownerName}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-emerald-600">+${f.payout}</p>
                <p className="text-[10px] font-bold text-slate-400">{f.energyCost}⚡ • {Math.ceil(f.cooldownSec / 60)}m</p>
              </div>
            </div>

            <div className="flex gap-2">
              {f.isOwner && (
                <button
                  onClick={() => handleUpgrade(f.id)}
                  disabled={actionLoading || user.gold < f.upgradeCost}
                  className={`flex-1 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all ${user.gold >= f.upgradeCost ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-slate-100 text-slate-400"
                    }`}
                >
                  ⬆️ Upgrade ({f.upgradeCost}🏅)
                </button>
              )}
              <button
                onClick={() => handleWork(f.id)}
                disabled={actionLoading || f.remainingCooldown > 0 || user.energy < f.energyCost}
                className={`flex-1 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all ${f.remainingCooldown > 0 ? "bg-slate-100 text-slate-400" :
                  user.energy < f.energyCost ? "bg-slate-100 text-slate-400" :
                    "bg-indigo-600 text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700"
                  }`}
              >
                {f.remainingCooldown > 0 ? (
                  <span className="flex items-center justify-center gap-1"><Clock className="w-3 h-3" />{Math.ceil(f.remainingCooldown / 1000)}s</span>
                ) : "💼 Lavora"}
              </button>
            </div>
          </div>
        ))
      )}
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

const ProfileView = ({ user, handleUpgradePerk, handleActivateBooster, actionLoading, fetchData }: { user: any, handleUpgradePerk: (id: string, useGold: boolean) => void, handleActivateBooster: (id: string, useGold: boolean) => void, actionLoading: boolean, fetchData: () => void }) => {
  const [now, setNow] = useState(Date.now());
  const [toasts, setToasts] = useState<{ id: string; message: string }[]>([]);
  // Track which perk IDs we already fired completion for (avoids repeated fetchData)
  const notifiedRef = React.useRef<Set<string>>(new Set());

  const addToast = (message: string, id: string) => {
    setToasts(prev => prev.some(t => t.id === id) ? prev : [...prev, { id, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const dismissToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  // Single stable interval — always running while ProfileView is mounted
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Reset notifiedRef when perkUpgrades changes (new upgrade started)
  useEffect(() => {
    const currentUpgradeKeys = Object.keys(user.perkUpgrades || {});
    // Remove from notified set any perk that is no longer upgrading (was cleared by server)
    notifiedRef.current.forEach(id => {
      if (!currentUpgradeKeys.includes(id)) notifiedRef.current.delete(id);
    });
  }, [user.perkUpgrades]);

  // Detect completions — fire once per perk using notifiedRef
  useEffect(() => {
    PERKS_DEFS.forEach(p => {
      const u = user.perkUpgrades?.[p.id];
      if (u && u.willCompleteAt > 0 && u.willCompleteAt <= now && !notifiedRef.current.has(p.id)) {
        notifiedRef.current.add(p.id);
        addToast(`✅ Upgrade completato: ${p.name}!`, p.id);
        fetchData();
      }
    });
  }, [now]);

  const handleDevCheat = async () => {
    try {
      const res = await fetch("/api/dev/add-currency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cash: 10000, gold: 10000 })
      });
      if (res.ok) {
        addToast("💰 Cheat attivato: +10k Cash, +10k Gold!", "cheat");
        fetchData();
      }
    } catch (err) {
      console.error("Cheat failed", err);
    }
  };

  return (
    <>
      <AnimatePresence>
        {toasts.map(({ id, message }) => <Toast key={id} message={message} onDismiss={() => { dismissToast(id); }} />)}
      </AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="space-y-8"
      >
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 text-center">
          {/* Clickable avatar with upload */}
          <div className="relative mx-auto w-24 h-24 mb-4">
            <div
              className="w-24 h-24 bg-indigo-100 rounded-[2rem] overflow-hidden flex items-center justify-center cursor-pointer group"
              onClick={() => (document.getElementById("avatar-file-input") as HTMLInputElement)?.click()}
              title="Cambia foto profilo"
            >
              {user.avatarData ? (
                <img src={user.avatarData} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-12 h-12 text-indigo-600" />
              )}
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/30 rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </div>
            {/* Level badge */}
            <div className="absolute -bottom-2 -right-2 bg-indigo-600 text-white w-10 h-10 rounded-2xl flex items-center justify-center font-black border-4 border-white text-sm">
              {user.level}
            </div>
            {/* Hidden file input */}
            <input
              id="avatar-file-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                // Resize to 128x128 via canvas (center crop)
                const img = new Image();
                img.onload = async () => {
                  const SIZE = 128;
                  const canvas = document.createElement("canvas");
                  canvas.width = SIZE;
                  canvas.height = SIZE;
                  const ctx = canvas.getContext("2d")!;
                  const scale = Math.max(SIZE / img.width, SIZE / img.height);
                  const sw = img.width * scale;
                  const sh = img.height * scale;
                  ctx.drawImage(img, (SIZE - sw) / 2, (SIZE - sh) / 2, sw, sh);
                  const base64 = canvas.toDataURL("image/jpeg", 0.85);
                  try {
                    const res = await fetch("/api/profile/avatar", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ avatarData: base64 }),
                    });
                    const data = await res.json();
                    if (data.error) alert(data.error);
                    else fetchData();
                  } catch (_) {
                    alert("Errore nel caricamento dell'immagine");
                  }
                };
                img.src = URL.createObjectURL(file);
                // Reset input so same file can be re-selected
                e.target.value = "";
              }}
            />
          </div>
          <UsernameEditor username={user.username} fetchData={fetchData} />
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

          <div className="grid grid-cols-3 gap-3 mt-8">
            <div className="p-4 bg-emerald-50 rounded-3xl">
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Cash</p>
              <p className="text-xl font-black text-emerald-700">${(user.money || 0).toLocaleString()}</p>
            </div>
            <div className="p-4 bg-amber-50 rounded-3xl">
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Gold</p>
              <p className="text-xl font-black text-amber-700">🏅{user.gold || 0}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-3xl">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Regione</p>
              <p className="text-xl font-black text-slate-900">{user.regionId}</p>
            </div>
          </div>

          <button
            onClick={handleDevCheat}
            className="mt-6 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-400 text-[10px] font-black uppercase rounded-xl transition-all"
          >
            Dev: Aggiungi 10k Cash/Gold
          </button>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
          <h3 className="text-xl font-black tracking-tight uppercase mb-6">Classifica Mondiale</h3>
          <Leaderboard />
        </div>

        <PlayerFactoriesView user={user} fetchData={fetchData} />

        {/* Perks Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black tracking-tight uppercase">Abilità del Comandante</h3>
          </div>

          {/* Slot occupato banner */}
          {(() => {
            const activeUpgrade = PERKS_DEFS.find(p => {
              const u = user.perkUpgrades?.[p.id];
              return u && getTs(u.willCompleteAt) > now;
            });
            return activeUpgrade ? (
              <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                <Timer className="w-4 h-4 text-amber-500 shrink-0" />
                <p className="text-xs font-black text-amber-700">
                  Slot di apprendimento occupato — stai potenziando {activeUpgrade.icon} {activeUpgrade.name}.
                  <span className="font-medium text-amber-500"> Una sola abilità alla volta.</span>
                </p>
              </div>
            ) : null;
          })()}

          <div className="grid grid-cols-1 gap-5">
            {PERKS_DEFS.map(perk => {
              const currentLevel = (user.perks || {})[perk.id] || 0;
              const upgrade = user.perkUpgrades?.[perk.id];
              const isThisUpgrading = !!upgrade && getTs(upgrade.willCompleteAt) > now;
              const anyUpgrading = PERKS_DEFS.some(p => {
                const u = user.perkUpgrades?.[p.id];
                return u && getTs(u.willCompleteAt) > now;
              });
              const blocked = anyUpgrading && !isThisUpgrading;

              // Costs scale with level (1.5x per level)
              const cashCost = Math.round(perk.baseCashCost * Math.pow(1.5, currentLevel));
              const goldCost = Math.ceil(perk.baseGoldCost * Math.pow(1.4, currentLevel));
              const cashTimeSec = Math.round(perk.baseTimeCashSec * Math.pow(1.3, currentLevel));
              const goldTimeSec = Math.round(perk.baseTimeGoldSec * Math.pow(1.3, currentLevel));

              const canAffordCash = (user.money || 0) >= cashCost;
              const canAffordGold = (user.gold || 0) >= goldCost;

              return (
                <div key={perk.id} className={`bg-white rounded-[2.5rem] border transition-all overflow-hidden ${isThisUpgrading ? "border-amber-200 shadow-amber-50 shadow-md" : blocked ? "border-slate-100 opacity-60" : "border-slate-100 shadow-sm"}`}>
                  {/* Header */}
                  <div className="p-6 pb-4">
                    <div className="flex items-start justify-between mb-3 gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl shrink-0">{perk.icon}</span>
                        <div>
                          <h4 className="font-black text-slate-900 text-base uppercase tracking-tight">{perk.name}</h4>
                          <p className="text-[10px] text-slate-500 font-medium leading-snug mt-0.5">{perk.description}</p>
                          {(perk as any).effects && (
                            <ul className="mt-2 space-y-0.5">
                              {((perk as any).effects as string[]).map((e, i) => (
                                <li key={i} className="text-[9px] font-bold text-indigo-500 flex items-center gap-1">
                                  <span className="w-1 h-1 bg-indigo-400 rounded-full shrink-0" />
                                  {e}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-2xl font-black text-slate-900">Lv {currentLevel}</span>
                      </div>
                    </div>

                    {/* Level bar — shows relative progress within the current upgrade cycle */}
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-700 rounded-full"
                        style={{ width: `${isThisUpgrading && upgrade?.startedAt ? (1 - (getTs(upgrade.willCompleteAt) - Date.now()) / (getTs(upgrade.willCompleteAt) - getTs(upgrade.startedAt))) * 100 : currentLevel > 0 ? 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Action area */}
                  <div className="px-6 pb-6 space-y-4">
                    {/* Booster Section */}
                    <div className="pt-2 border-t border-slate-50">
                      {(() => {
                        const booster = user.boosters?.[perk.id];
                        const isActive = booster && getTs(booster.expiresAt) > now;
                        const inCooldown = booster && now < getTs(booster.lastActivatedAt) + BOOSTER_CONFIG.COOLDOWN_MS;

                        // Active booster view
                        if (isActive) {
                          return (
                            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3 flex flex-col gap-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Zap className="w-4 h-4 text-indigo-500 fill-indigo-500" />
                                  <span className="text-[10px] font-black uppercase text-indigo-700">Booster Attivo (+100)</span>
                                </div>
                                <div className="text-[10px] font-black text-indigo-600 bg-white px-2 py-0.5 rounded-lg border border-indigo-100">
                                  <PerkTimer willCompleteAt={booster.expiresAt} onComplete={fetchData} />
                                </div>
                              </div>
                              <div className="w-full bg-indigo-100 h-1.5 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(1 - (getTs(booster.expiresAt) - now) / (getTs(booster.expiresAt) - getTs(booster.lastActivatedAt))) * 100}%` }}
                                  className="h-full bg-indigo-500"
                                />
                              </div>
                            </div>
                          );
                        }

                        // Activation buttons or cooldown
                        return (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between px-1">
                              <span className="text-[10px] font-black uppercase text-slate-400">Boosters (+100 Lv)</span>
                              {inCooldown && (
                                <span className="text-[9px] font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded-lg">
                                  In ricarica: <PerkTimer willCompleteAt={getTs(booster.lastActivatedAt) + BOOSTER_CONFIG.COOLDOWN_MS} onComplete={fetchData} />
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <button
                                onClick={() => handleActivateBooster(perk.id, false)}
                                disabled={actionLoading || inCooldown || user.money < BOOSTER_CONFIG.CASH_PRICE}
                                className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${!inCooldown && user.money >= BOOSTER_CONFIG.CASH_PRICE ? "bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-700" : "bg-slate-50 border-slate-100 text-slate-300"}`}
                              >
                                <div className="flex flex-col items-start leading-none">
                                  <span className="text-[10px] font-black uppercase border-b-2 border-emerald-400/30">Standard</span>
                                  <span className="text-[9px] font-bold opacity-60 mt-1">${BOOSTER_CONFIG.CASH_PRICE.toLocaleString()}</span>
                                </div>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleActivateBooster(perk.id, true)}
                                disabled={actionLoading || inCooldown || user.gold < BOOSTER_CONFIG.GOLD_PRICE}
                                className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${!inCooldown && user.gold >= BOOSTER_CONFIG.GOLD_PRICE ? "bg-white border-slate-200 hover:border-amber-300 hover:bg-slate-50 text-slate-700" : "bg-slate-50 border-slate-100 text-slate-300"}`}
                              >
                                <div className="flex flex-col items-start leading-none">
                                  <span className="text-[10px] font-black uppercase border-b-2 border-amber-400/30">Extended</span>
                                  <span className="text-[9px] font-bold opacity-60 mt-1">🏅 {BOOSTER_CONFIG.GOLD_PRICE}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                  <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                                  <span className="text-[8px] font-black text-amber-600">10x</span>
                                </div>
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Upgrade Section */}
                    {isThisUpgrading ? (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Timer className="w-4 h-4 text-amber-500" />
                            <span className="text-xs font-black text-amber-700 uppercase">In apprendimento → Lv {upgrade!.targetLevel}</span>
                          </div>
                          <PerkTimer willCompleteAt={upgrade!.willCompleteAt} onComplete={fetchData} />
                        </div>
                        {upgrade!.startedAt && (
                          <div className="w-full bg-amber-100 h-2 rounded-full overflow-hidden">
                            <PerkProgressBar startedAt={upgrade!.startedAt} willCompleteAt={upgrade!.willCompleteAt} />
                          </div>
                        )}
                      </div>
                    ) : blocked ? (
                      <div className="flex items-center justify-center gap-2 py-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <Lock className="w-4 h-4 text-slate-300" />
                        <span className="text-xs font-bold text-slate-400">Slot occupato da un altro potenziamento</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        {/* Cash button — slow */}
                        <button
                          onClick={() => handleUpgradePerk(perk.id, false)}
                          disabled={actionLoading || !canAffordCash}
                          className={`flex flex-col items-center gap-1.5 py-4 px-3 rounded-[1.5rem] border transition-all ${canAffordCash ? "bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100" : "bg-slate-50 border-slate-100 text-slate-300"}`}
                        >
                          <TrendingUp className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase">Apprendi (Cash)</span>
                          <span className="text-[10px] font-bold opacity-80">${cashCost.toLocaleString()}</span>
                          <span className="text-[9px] opacity-60">⏱ {formatDuration(cashTimeSec)}</span>
                        </button>

                        {/* Gold button — faster (not instant) */}
                        <button
                          onClick={() => handleUpgradePerk(perk.id, true)}
                          disabled={actionLoading || !canAffordGold || !canAffordCash}
                          className={`flex flex-col items-center gap-1.5 py-4 px-3 rounded-[1.5rem] border transition-all ${canAffordGold && canAffordCash ? "bg-amber-400 border-amber-400 text-white hover:bg-amber-500 shadow-lg shadow-amber-100" : "bg-slate-50 border-slate-100 text-slate-300"}`}
                        >
                          <Gem className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase">Apprendi (Gold)</span>
                          <span className="text-[10px] font-bold opacity-80">🏅 {goldCost}</span>
                          <span className="text-[9px] opacity-60">⚡ {formatDuration(goldTimeSec)}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </>
  );
};

const MarketView = () => {
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemName, setItemName] = useState("Fucili");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchListings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/market/listings");
      if (res.ok) setListings(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "buy") fetchListings();
  }, [activeTab]);

  const handleSell = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quantity || !price) return alert("Inserisci tutti i campi");
    setSubmitting(true);
    try {
      const res = await fetch("/api/market/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemName, quantity: Number(quantity), price: Number(price) })
      });
      if (res.ok) {
        alert("Annuncio pubblicato!");
        setQuantity("");
        setPrice("");
        setActiveTab("buy");
      }
    } catch (err) {
      alert("Errore nella pubblicazione");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-center bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
        <button
          onClick={() => setActiveTab("buy")}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === "buy" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-slate-400"}`}
        >
          Compra
        </button>
        <button
          onClick={() => setActiveTab("sell")}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === "sell" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-slate-400"}`}
        >
          Vendi
        </button>
      </div>

      {activeTab === "buy" ? (
        <div className="space-y-4">
          <h3 className="text-xl font-black tracking-tight uppercase">Annunci Recenti</h3>
          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-600" /></div>
          ) : listings.length === 0 ? (
            <div className="bg-white p-12 rounded-[2rem] text-center border border-slate-100">
              <Activity className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400 font-bold">Nessun annuncio disponibile</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {listings.map((l: any) => (
                <div key={l.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black uppercase bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg">{l.itemName}</span>
                      <span className="text-[10px] font-bold text-slate-400">{new Date(l.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-lg font-black text-slate-900">{l.quantity} Unità</p>
                    <p className="text-xs text-slate-400 font-bold">Venditore: <span className="text-indigo-600">{l.sellerName}</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-emerald-600">${l.price}</p>
                    <button className="mt-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-colors">Compra</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
          <h3 className="text-xl font-black tracking-tight uppercase">Pubblica Annuncio</h3>
          <form onSubmit={handleSell} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cosa vuoi vendere?</label>
              <select
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none"
              >
                <option>Fucili</option>
                <option>Munizioni</option>
                <option>Carri</option>
                <option>Droni</option>
                <option>Uranio</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantità</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Es: 100"
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Prezzo Totale</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Es: 500"
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
            >
              {submitting ? "Pubblicazione..." : "Pubblica Annuncio"}
            </button>
          </form>
        </div>
      )}
    </motion.div>
  );
};

const CountryDetailView = ({ user, handleAction, actionLoading }: { user: any, handleAction: (a: string, b: any) => void, actionLoading: boolean }) => {
  const { iso2 } = useParams();
  const navigate = useNavigate();
  const [region, setRegion] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCountryDetail = async () => {
    try {
      const res = await fetch(`/api/countries/${iso2}`);
      if (!res.ok) throw new Error("Country not found");
      const data = await res.json();
      setRegion(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCountryDetail(); }, [iso2]);

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

  const flag = COUNTRY_FLAGS[iso2?.toUpperCase() || ""] || "🌍";
  const resources = Array.isArray(region.resources) ? region.resources : [];
  const health = region.health || 1;
  const education = region.education || 1;
  const military = region.military || 1;

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
            <span className="text-6xl">{flag}</span>
            <div className="flex-1">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">{region.name || iso2}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-400 px-2 py-1 rounded-lg">ISO: {region.id || iso2}</span>
                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${region.ownerUserId ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"}`}>
                  {region.ownerName ? `🟣 ${region.ownerName}` : "🟢 Territorio Neutrale"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 p-4 rounded-3xl text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Popolazione</p>
              <p className="text-xl font-black">{((region.population || 1000000) / 1000000).toFixed(1)}M</p>
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
          </div>
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

      {/* Factories */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-4">
        <h3 className="text-lg font-black uppercase tracking-tight">Strutture Presenti</h3>
        {(region.factoriesCount || 0) > 0 ? (
          <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-3xl border border-indigo-100">
            <div className="p-3 bg-white rounded-2xl"><Hammer className="w-5 h-5 text-indigo-600" /></div>
            <div>
              <p className="font-black text-indigo-900">{region.factoriesCount} Fabbriche</p>
              <p className="text-[10px] font-bold text-indigo-600 uppercase">Operative sul territorio</p>
            </div>
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
    </motion.div>
  );
};

// --- Main App ---

export default function App() {
  const navigate = useNavigate();
  const [user, setUser] = useState<(User & { perks: Record<string, number>, maxEnergy: number }) | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [factories, setFactories] = useState<(Factory & { remainingCooldown: number })[]>([]);
  const [wars, setWars] = useState<{ active: War[], ended: War[] }>({ active: [], ended: [] });
  const [currentView, setCurrentView] = useState<"home" | "articles" | "work" | "wars" | "profile" | "article-new" | "article-detail" | "country-detail">("home");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
    await fetch("/api/logout", { method: "POST" });
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40 px-4 py-3 flex justify-between items-center gap-2">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <span className="font-black text-lg tracking-tight">Territorial</span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto flex-1 justify-end">
          <div className="bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-100 flex items-center gap-1 shrink-0">
            <span className="text-[10px] font-black text-emerald-600">${(user.money || 0).toLocaleString()}</span>
          </div>
          <div className="bg-amber-50 px-2.5 py-1.5 rounded-xl border border-amber-100 flex items-center gap-1 shrink-0">
            <span className="text-[10px] font-black text-amber-600">🏅{user.gold || 0}</span>
          </div>
          <div className="bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100 flex items-center gap-1 shrink-0">
            <Zap className="w-3 h-3 text-indigo-500" />
            <span className="text-[10px] font-black text-slate-600">{user.energy}</span>
          </div>
          <button
            onClick={() => navigate("/profile")}
            className="w-8 h-8 rounded-xl overflow-hidden bg-indigo-100 flex items-center justify-center shrink-0 border border-indigo-100"
            title="Profilo"
          >
            {user.avatarData ? (
              <img src={user.avatarData} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <UserIcon className="w-4 h-4 text-indigo-600" />
            )}
          </button>
          <div className="relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 text-slate-400 hover:text-indigo-600 transition-colors bg-slate-50 rounded-xl border border-slate-100"
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
                    className="fixed right-4 top-16 w-52 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-[999] overflow-hidden"
                  >
                    <button onClick={() => { navigate("/"); setIsMenuOpen(false); }} className="w-full px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors">
                      <Globe className="w-4 h-4 text-indigo-500" /> MAPPA
                    </button>
                    <button onClick={() => { navigate("/market"); setIsMenuOpen(false); }} className="w-full px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors">
                      <TrendingUp className="w-4 h-4 text-emerald-500" /> MERCATO
                    </button>
                    <button onClick={() => { navigate("/produce"); setIsMenuOpen(false); }} className="w-full px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors">
                      <Hammer className="w-4 h-4 text-orange-500" /> PRODUCI ARMI
                    </button>
                    <div className="h-px bg-slate-100 my-1" />
                    <button onClick={handleLogout} className="w-full px-4 py-3 text-left text-sm font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-3 transition-colors">
                      <LogOut className="w-4 h-4" /> LOGOUT
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto p-6">
        <Routes>
          <Route path="/" element={<HomeView user={user} regions={regions} navigateToCountry={navigateToCountry} />} />
          <Route path="/market" element={<MarketView />} />
          <Route path="/produce" element={<ProduceView user={user} />} />
          <Route path="/articles" element={<ArticlesView articles={articles} setSelectedArticleId={setSelectedArticleId} />} />
          <Route path="/articles/:id" element={<ArticleDetailView articles={articles} user={user} fetchData={fetchData} />} />
          <Route path="/articles/new" element={<NewArticleView actionLoading={actionLoading} fetchData={fetchData} />} />
          <Route path="/work" element={<WorkView user={user} factories={factories} actionLoading={actionLoading} handleAction={handleAction} />} />
          <Route path="/wars" element={<WarsView wars={wars} />} />
          <Route path="/profile" element={<ProfileView user={user} handleUpgradePerk={handleUpgradePerk} handleActivateBooster={handleActivateBooster} actionLoading={actionLoading} fetchData={fetchData} />} />
          <Route path="/countries/:iso2" element={<CountryDetailView user={user} handleAction={handleAction} actionLoading={actionLoading} />} />
        </Routes>
      </main>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}

const WEAPONS_CATALOG = [
  { id: "rifle", name: "Fucile", emoji: "🔫", timeMin: 1, costCash: 100, power: 2 },
  { id: "drone", name: "Drone", emoji: "🚁", timeMin: 8, costCash: 800, power: 20 },
  { id: "artillery", name: "Artiglieria", emoji: "💣", timeMin: 5, costCash: 500, power: 12 },
  { id: "tank", name: "Carro Armato", emoji: "🛡️", timeMin: 15, costCash: 1500, power: 40 },
  { id: "missile", name: "Missile", emoji: "🚀", timeMin: 30, costCash: 5000, power: 150 },
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

  const handleClaim = async (id: string) => {
    const res = await fetch("/api/produce/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (data.error) alert(data.error);
    else fetchQueue();
  };

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
            const totalCost = (qty[w.id] || 1) * w.costCash;
            const canAfford = (user?.money || 0) >= totalCost;
            return (
              <div key={w.id} className="flex items-center justify-between gap-4 p-4 bg-slate-50 rounded-3xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{w.emoji}</span>
                  <div>
                    <p className="font-black text-slate-900">{w.name}</p>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-lg border border-slate-100">💵 ${w.costCash.toLocaleString()}/u</span>
                      <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-lg border border-slate-100">⏱ {w.timeMin}m</span>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">+{w.power} pw</span>
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
            const isReady = item.status === "ready" || (item.willCompleteAt && item.willCompleteAt <= Date.now());
            return (
              <div key={item.id} className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-black text-slate-900 capitalize">{item.weaponType}</span>
                    <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg">x{item.qty}</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${isReady ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                      {isReady ? "✅ Pronto" : "🔄 In coda"}
                    </span>
                  </div>
                  {!isReady && item.willCompleteAt && (
                    <div className="flex items-center gap-1 text-amber-500 text-xs font-bold">
                      <Timer className="w-3 h-3" />
                      <PerkTimer willCompleteAt={item.willCompleteAt} />
                    </div>
                  )}
                </div>
                {isReady && (
                  <button
                    onClick={() => handleClaim(item.id)}
                    className="px-4 py-2 bg-emerald-600 text-white text-[10px] font-black uppercase rounded-2xl hover:scale-105 transition-all shadow-lg shadow-emerald-100"
                  >
                    Ritira
                  </button>
                )}
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
