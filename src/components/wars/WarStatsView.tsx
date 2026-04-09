import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Loader2,
  Swords,
  Shield,
  ShieldAlert,
  ArrowLeft,
} from "lucide-react";
import { WarFactionBadge } from "../war";
import { usePollingTask } from "../../hooks/usePollingTask";

const WarStatsView = ({ user, nations }: { user: any, nations: any[] }) => {
  const { warId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const resolveFactionName = useCallback((iso2?: string | null, displayName?: string | null) => {
    const rawIso = (iso2 || "").trim();
    const countryCode = rawIso.includes("-") ? rawIso.split("-")[0] : rawIso;
    const fromNations = nations?.find((n: any) => (n?.id || "").toLowerCase() === countryCode.toLowerCase())?.name;
    return fromNations || displayName || iso2 || "Sconosciuto";
  }, [nations]);

  const fetchStats = useCallback(async () => {
    if (!warId) return;
    try {
      const res = await fetch(`/api/wars/${warId}/stats`);
      if (res.ok) setData(await res.json());
    } catch (err) { }
    setLoading(false);
  }, [warId]);

  useEffect(() => {
    setLoading(true);
    setData(null);
  }, [warId]);

  usePollingTask(fetchStats, {
    enabled: Boolean(warId),
    intervalMs: 15_000,
    refreshOnVisible: true,
    refreshOnFocus: true,
  });

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-400 w-8 h-8" /></div>;
  if (!data) return <div className="text-center p-12 text-gray-400">Guerra non trovata.</div>;

  const { war, stats } = data;
  const totalScore = (war.attackerScore || 0) + (war.defenderScore || 0) || 1;
  const attackerPct = ((war.attackerScore || 0) / totalScore) * 100;
  const defenderPct = ((war.defenderScore || 0) / totalScore) * 100;

  return (
    <div className="space-y-6">
       <button onClick={() => navigate(-1)} className="px-5 py-2.5 bg-gray-900/60 border border-gray-800 rounded-2xl text-xs font-black text-gray-400 uppercase tracking-widest hover:text-indigo-400 hover:border-indigo-500/30 transition-all flex items-center gap-2 group">
         <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Indietro
       </button>

       <div className="bg-gray-900/60 p-8 rounded-2xl border border-gray-800 text-center relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500" />
          <h2 className="text-2xl font-black text-white uppercase">Riepilogo Battaglia</h2>
          <p className="text-gray-400 text-[10px] font-black mt-1 uppercase tracking-[0.2em]">{war.id}</p>
       </div>

       <div className="bg-slate-900 p-8 rounded-2xl shadow-2xl relative overflow-hidden border border-gray-700/50">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 to-rose-900/40 opacity-50" />
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
             <div className="text-center">
                <WarFactionBadge
                  name={resolveFactionName(war.attackerCountryIso2, war.attackerDisplayName)}
                  icon={war.attackerCountryIso2}
                  align="center"
                  iconSizeClass="w-10 h-10"
                  textClassName="text-4xl font-black text-white uppercase tracking-tighter"
                  className="mb-1"
                />
                <div className="inline-block px-3 py-1 bg-indigo-500/20 rounded-full border border-indigo-500/30">
                   <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Attaccante</p>
                </div>
                <p className="text-3xl font-black text-indigo-400 mt-6 font-mono tracking-tighter">{(war.attackerScore).toLocaleString()}</p>
             </div>

             <div className="flex flex-col items-center gap-5">
                <div className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center border border-white/10 backdrop-blur-xl shadow-inner">
                   <Swords className="w-10 h-10 text-white/40" />
                </div>
                <div className="w-full space-y-3">
                   <div className="flex justify-between text-[11px] font-black text-white/50 uppercase tracking-widest px-1">
                      <span>{Math.round(attackerPct)}%</span>
                      <span>{Math.round(defenderPct)}%</span>
                   </div>
                   <div className="w-full h-4 bg-white/5 rounded-full overflow-hidden flex border border-white/5 p-1 backdrop-blur-sm">
                      <div className="bg-indigo-500 h-full rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)] transition-all duration-1000" style={{ width: `${attackerPct}%` }} />
                      <div className="bg-rose-500 h-full rounded-full shadow-[0_0_15px_rgba(244,63,94,0.5)] transition-all duration-1000" style={{ width: `${defenderPct}%` }} />
                   </div>
                </div>
             </div>

             <div className="text-center">
                <WarFactionBadge
                  name={resolveFactionName(war.defenderCountryIso2, war.defenderDisplayName)}
                  icon={war.defenderCountryIso2}
                  align="center"
                  iconSizeClass="w-10 h-10"
                  textClassName="text-4xl font-black text-white uppercase tracking-tighter"
                  className="mb-1"
                />
                <div className="inline-block px-3 py-1 bg-rose-500/20 rounded-full border border-rose-500/30">
                   <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Difensore</p>
                </div>
                <p className="text-3xl font-black text-rose-400 mt-6 font-mono tracking-tighter">{(war.defenderScore).toLocaleString()}</p>
             </div>
          </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-gray-900/60 p-8 rounded-2xl border border-gray-800 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500" />
             <h3 className="text-xs font-black text-indigo-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20"><Shield className="w-4 h-4 text-indigo-400" /></div> Top Danni Attaccanti
             </h3>
             <div className="space-y-4">
                {stats.attacker.length === 0 ? (
                  <div className="text-center py-12 space-y-3 bg-gray-900/60 rounded-2xl border border-dashed border-gray-700/50">
                    <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Nessun danno registrato</p>
                    <p className="text-[9px] text-gray-500 font-bold px-8 leading-relaxed">I dati su chi ha inflitto i danni saranno popolati a partire dalle prossime battaglie.</p>
                  </div>
                ) : stats.attacker.map((s: any, i: number) => (
                    <div key={s.userId} className="flex justify-between items-center p-4 hover:bg-indigo-500/10 rounded-2xl transition-all border border-transparent hover:border-indigo-500/20 group cursor-pointer" onClick={() => { console.log('Navigating to profile:', s.userId); navigate(`/profile/${s.userId}`); }}>
                       <div className="flex items-center gap-4">
                          <div className="relative shrink-0">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-black text-sm overflow-hidden border border-indigo-500/20">
                              {s.avatarData ? (
                                <img src={s.avatarData} alt={s.username} className="w-full h-full object-cover" />
                              ) : (
                                s.username.slice(0, 2).toUpperCase()
                              )}
                            </div>
                            <div className="absolute -bottom-1 -right-1 bg-indigo-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md border border-indigo-400 shadow-sm">
                              LV.{s.level || 1}
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-black text-white group-hover:text-indigo-400 transition-colors tracking-tight">{s.username}</p>
                            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{(s.totalDamage || 0).toLocaleString()} danni inflitti</p>
                          </div>
                       </div>
                       <p className="text-base font-black text-indigo-400 font-mono tracking-tighter">{(s.totalDamage).toLocaleString()}</p>
                    </div>
                ))}
             </div>
          </div>

          <div className="bg-gray-900/60 p-8 rounded-2xl border border-gray-800 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500" />
             <h3 className="text-xs font-black text-rose-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                <div className="p-2 bg-rose-500/10 rounded-xl border border-rose-500/20"><ShieldAlert className="w-4 h-4 text-rose-400" /></div> Top Danni Difensori
             </h3>
             <div className="space-y-4">
                {stats.defender.length === 0 ? (
                  <div className="text-center py-12 space-y-3 bg-gray-900/60 rounded-2xl border border-dashed border-gray-700/50">
                    <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Nessun danno registrato</p>
                    <p className="text-[9px] text-gray-500 font-bold px-8 leading-relaxed">I dati su chi ha inflitto i danni saranno popolati a partire dalle prossime battaglie.</p>
                  </div>
                ) : stats.defender.map((s: any, i: number) => (
                    <div key={s.userId} className="flex justify-between items-center p-4 hover:bg-rose-500/10 rounded-2xl transition-all border border-transparent hover:border-rose-500/20 group cursor-pointer" onClick={() => { console.log('Navigating to profile:', s.userId); navigate(`/profile/${s.userId}`); }}>
                       <div className="flex items-center gap-4">
                          <div className="relative shrink-0">
                            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-400 font-black text-sm overflow-hidden border border-rose-500/20">
                              {s.avatarData ? (
                                <img src={s.avatarData} alt={s.username} className="w-full h-full object-cover" />
                              ) : (
                                s.username.slice(0, 2).toUpperCase()
                              )}
                            </div>
                            <div className="absolute -bottom-1 -right-1 bg-rose-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md border border-rose-400 shadow-sm">
                              LV.{s.level || 1}
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-black text-white group-hover:text-rose-400 transition-colors tracking-tight">{s.username}</p>
                            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{(s.totalDamage || 0).toLocaleString()} danni inflitti</p>
                          </div>
                       </div>
                       <p className="text-base font-black text-rose-400 font-mono tracking-tighter">{(s.totalDamage).toLocaleString()}</p>
                    </div>
                ))}
             </div>
          </div>
       </div>
    </div>
  );
};

export { WarStatsView };
