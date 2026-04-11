import React, { useState, useEffect, useMemo } from "react";
import {
  Mail,
  ArrowLeft,
  Settings,
  Swords,
  BookOpen,
  Activity,
  ChevronDown,
  ChevronRight,
  Camera,
  ChevronLeft,
  Bomb,
  Loader2,
  Landmark,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { GAME_CONFIG, PERKS_DEFS } from "../../types";
import { getTs, formatDuration } from "../../utils";
import { NationalFlag, NationLogo, Toast, PerkTimer } from "../ui";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { clearBackendAuthCookie } from "../../api/authClient";
import { fetchMyPlayerDamageSummary, type PlayerDamageSummary } from "../../api/profileClient";

export const ProfileView = ({ user, handleUpgradePerk, handleActivateBooster, actionLoading, fetchData, regions, nations, isPublic }: { user: any, handleUpgradePerk?: (id: string, useGold: boolean) => void, handleActivateBooster?: (id: string, useGold: boolean) => void, actionLoading?: boolean, fetchData?: () => void, regions: any[], nations: any[], isPublic?: boolean }) => {
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now());
  const [toasts, setToasts] = useState<{ id: string; message: string }[]>([]);
  const [expandedStats, setExpandedStats] = useState<Set<string>>(new Set());
  const [damageSummary, setDamageSummary] = useState<PlayerDamageSummary | null>(null);
  const [damageSummaryLoading, setDamageSummaryLoading] = useState(false);
  const [damageSummaryError, setDamageSummaryError] = useState<string | null>(null);

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

  useEffect(() => {
    if (isPublic) return;

    let cancelled = false;

    const loadDamageSummary = async () => {
      setDamageSummaryLoading(true);
      setDamageSummaryError(null);
      try {
        const summary = await fetchMyPlayerDamageSummary();
        if (!cancelled) setDamageSummary(summary);
      } catch (err) {
        console.error(err);
        if (!cancelled) setDamageSummaryError("Dati non disponibili");
      } finally {
        if (!cancelled) setDamageSummaryLoading(false);
      }
    };

    loadDamageSummary();
    return () => { cancelled = true; };
  }, [isPublic]);

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
        {!isPublic ? (
          <button onClick={() => setShowMessages(true)} className="p-2 hover:bg-gray-800/80 rounded-lg relative">
            <Mail className="w-8 h-8 text-[#76ff03]" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-[10px] min-w-[20px] h-5 flex items-center justify-center rounded-sm font-black px-1 border border-black shadow-lg">
                {unreadCount}
              </span>
            )}
          </button>
        ) : (
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-800/80 rounded-lg">
            <ArrowLeft className="w-8 h-8 text-white" />
          </button>
        )}
        <h1 className="text-2xl font-black text-gray-50 uppercase tracking-tight military-font">{isPublic ? "PROFILO PLAYER" : "IL MIO PROFILO"}</h1>
        {!isPublic ? (
          <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-gray-800/80 rounded-lg">
            <Settings className="w-8 h-8 text-white" />
          </button>
        ) : <div className="w-12 h-12" />}
      </header>

      <main className="p-6 space-y-6">
        <div className="flex gap-6 items-start">
          <div 
            className={`w-32 h-32 bg-gray-800 rounded-sm relative overflow-hidden shrink-0 border-4 border-gray-700/50 shadow-2xl ${!isPublic ? 'cursor-pointer' : ''}`}
            onClick={() => !isPublic && (document.getElementById("avatar-file-input") as HTMLInputElement)?.click()}
          >
             {user.avatarData ? (
                <img src={user.avatarData} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-6xl font-black text-white/20">
                    {user.username ? user.username[0].toUpperCase() : "?"}
                </div>
              )}
              {!isPublic && (
                <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-8 h-8 text-white" />
                </div>
              )}
              <input id="avatar-file-input" type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const img = new Image();
                    img.onload = async () => {
                        const SIZE = 192;
                        const canvas = document.createElement("canvas");
                        canvas.width = SIZE; canvas.height = SIZE;
                        const ctx = canvas.getContext("2d")!;
                        const scale = Math.max(SIZE / img.width, SIZE / img.height);
                        const sw = img.width * scale; const sh = img.height * scale;
                        ctx.drawImage(img, (SIZE - sw) / 2, (SIZE - sh) / 2, sw, sh);
                        const base64 = canvas.toDataURL("image/jpeg", 0.72);
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
                            // Profile should show the *region's* national flag (e.g. IT) next to "Posizione".
                            // Do NOT use NationLogo here because nations may override with custom state emblems.
                            const regionId = rData?.id || user.regionId; 
                            return <NationalFlag iso2={regionId || "it"} className="w-8 h-5" />; 
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
                            // Profile should show the *region's* national flag (e.g. IT) next to "Residenza".
                            // Do NOT use NationLogo here because nations may override with custom state emblems.
                            const regionId = rData?.id || user.residenceId; 
                            return <NationalFlag iso2={regionId || "it"} className="w-8 h-5" />; 
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

        {!isPublic && (
          <div className="pt-6">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-600 mb-3 px-1">Statistiche</p>
            <div className="bg-gray-900 overflow-hidden border-b border-gray-800/50">
              <button onClick={() => navigate("/profile/total-damage")} className="w-full p-5 flex items-center justify-between hover:bg-gray-800/80 transition-colors text-left">
                <div className="flex items-center gap-5">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-lg shadow-white/5">
                    <Bomb className="w-6 h-6 text-black" />
                  </div>
                  <div>
                    <span className="block text-lg font-black uppercase tracking-tight text-gray-50 military-font">Danni totali</span>
                    <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                      {damageSummaryLoading ? 'Caricamento...' : damageSummaryError || `${(damageSummary?.wars.length || 0).toLocaleString()} guerre registrate`}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {damageSummaryLoading ? (
                    <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
                  ) : (
                    <span className="text-2xl font-black text-gray-50 military-font leading-none">
                      {(damageSummary?.totalDamage || 0).toLocaleString()}
                    </span>
                  )}
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                </div>
              </button>
            </div>
          </div>
        )}

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
                           <button onClick={async () => { await supabase.auth.signOut(); clearBackendAuthCookie(); window.location.reload(); }} className="mt-4 text-red-500/60 hover:text-red-500 text-[10px] font-black uppercase tracking-widest transition-colors">Disconnetti Unità</button>
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
