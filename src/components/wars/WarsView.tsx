import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Swords,
  Loader2,
  Dumbbell,
  ChevronUp,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { WarType } from "../../types";
import { WarCreatePanel, RevolutionPanel, WarDamageBar, WarFactionBadge } from "../war";
import { WarTimer } from '../ui';

const WarsView = ({ 
  wars, 
  user, 
  nations,
  fetchData, 
  actionLoading, 
  autoWorkFactoryId, 
  setAutoWorkFactoryId 
}: { 
  wars: any, 
  user: any, 
  nations: any[],
  fetchData: () => void, 
  actionLoading: boolean, 
  autoWorkFactoryId: string | null, 
  setAutoWorkFactoryId: (val: string | null) => void 
}) => { 
  const { warId } = useParams();
  const navigate = useNavigate();
  const [training, setTraining] = useState(false);
  const [militaryExp, setMilitaryExp] = useState(user?.militaryExp || 0);
  const [activeAutoAttacks, setActiveAutoAttacks] = useState<any[]>([]);
  const [autoAttack, setAutoAttack] = useState<any | null>(null);
  const [autoTraining, setAutoTraining] = useState<any | null>(null);
  const [regionDevelopmentIndex, setRegionDevelopmentIndex] = useState<number>(0);

  useEffect(() => {
    if (!user?.regionId) return;
    fetch(`/api/regions/${user.regionId}/autonomy`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.indices?.developmentIndex !== undefined) {
          setRegionDevelopmentIndex(data.indices.developmentIndex);
        }
      })
      .catch(() => {});
  }, [user?.regionId]);
 
  const resolveFactionName = useCallback((iso2?: string | null, displayName?: string | null) => { 
    const rawIso = (iso2 || "").trim(); 
    const countryCode = rawIso.includes("-") ? rawIso.split("-")[0] : rawIso; 
    const fromNations = nations?.find((n: any) => (n?.id || "").toLowerCase() === countryCode.toLowerCase())?.name; 
    return fromNations || displayName || iso2 || "Sconosciuto"; 
  }, [nations]); 

  const refreshAutomationStatus = useCallback(async () => {
    try {
      const [warRes, trainingRes] = await Promise.all([
        fetch("/api/automation/war-attacks"),
        fetch("/api/automation/training"),
      ]);
      const warData = await warRes.json();
      const trainingData = await trainingRes.json();

      const allAutoAttacks = warData.autoAttacks || [];
      const matchedWar = allAutoAttacks.find((entry: any) => !warId || entry.warId === warId) || null;
      setActiveAutoAttacks(allAutoAttacks);
      setAutoAttack(matchedWar);
      setAutoTraining(trainingData.autoTraining || null);
    } catch {
      setActiveAutoAttacks([]);
      setAutoAttack(null);
      setAutoTraining(null);
    }
  }, [warId]);

  useEffect(() => {
    refreshAutomationStatus();
    const iv = setInterval(refreshAutomationStatus, 30000);
    return () => clearInterval(iv);
  }, [refreshAutomationStatus]);

  const hasIncompatibleAutoAttackWithAutoWork = activeAutoAttacks.some((entry: any) => entry?.autoType !== 'hourly');

  const handleTrain = async () => {
    if (user.energy < 10) {
      alert("Energia insufficiente (servono 10 energia)!");
      return;
    }
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

  const handleSetWarAutomation = async (warIdValue: string, side: 'attacker' | 'defender', weaponId: string, mode: 'maximum' | 'hourly') => {
    if (mode !== 'hourly' && autoWorkFactoryId) {
      alert("Non puoi attivare questa modalità di auto-attacco mentre Auto-Work è attivo.");
      return;
    }

    const res = await fetch(`/api/wars/${warIdValue}/auto-attack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ side, weaponId, autoType: mode }),
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
      return;
    }
    await refreshAutomationStatus();
  };

  const handleStopWarAutomation = async (warIdValue: string) => {
    await fetch(`/api/wars/${warIdValue}/auto-attack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });
    await refreshAutomationStatus();
  };

  const handleSetHourlyTraining = async (enabled: boolean) => {
    const res = await fetch("/api/automation/training", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(enabled ? { mode: 'hourly' } : { enabled: false }),
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
      return;
    }
    await refreshAutomationStatus();
  };

  const [warCreating, setWarCreating] = useState(false);
  const [revLoading, setRevLoading] = useState(false);

  const handleCreateWar = async (attackerRegionId: string, defenderRegionId: string, warType: WarType) => {
    setWarCreating(true);
    try {
      const res = await fetch("/api/wars/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attackerRegionId, defenderRegionId, warType }),
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else {
        fetchData();
        if (data.warId) navigate(`/wars/${data.warId}`);
      }
    } catch { alert("Errore nella dichiarazione di guerra."); }
    finally { setWarCreating(false); }
  };

  const handleStartRevolution = async (regionId: string) => {
    setRevLoading(true);
    try {
      const res = await fetch("/api/wars/revolution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regionId }),
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else { alert(data.message || "Rivoluzione iniziata!"); fetchData(); }
    } catch { alert("Errore nell'avvio della rivoluzione."); }
    finally { setRevLoading(false); }
  };

  const handleStartCoup = async (regionId: string) => {
    setRevLoading(true);
    try {
      const res = await fetch("/api/wars/coup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regionId }),
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else { alert(data.message || "Colpo di stato iniziato!"); fetchData(); }
    } catch { alert("Errore nell'avvio del colpo di stato."); }
    finally { setRevLoading(false); }
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
        {warId && (
          <button onClick={() => navigate('/wars')} className="mt-4 text-xs font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700 transition-colors">
            ← Mostra tutte le guerre
          </button>
        )}
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
            Allenati (-10 energia, +5 Exp)
          </button>
          {autoTraining ? (
            <button
              onClick={() => handleSetHourlyTraining(false)}
              className="py-4 px-4 bg-red-500 text-white rounded-2xl font-black uppercase text-xs shadow-lg hover:bg-red-600 transition-all flex items-center justify-center gap-1"
            >
              ⏹ Stop
            </button>
          ) : (
            <button
              onClick={() => handleSetHourlyTraining(true)}
              className="py-4 px-4 bg-amber-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg hover:bg-amber-700 transition-all flex items-center justify-center gap-1"
              title="Danno orario per 24 ore"
            >
              🤖 Auto
            </button>
          )}
        </div>
        {autoTraining && (
          <div className="bg-amber-100 rounded-xl p-3 flex items-center gap-2">
            <span className="animate-pulse text-lg">⚙️</span>
            <span className="text-xs font-black text-amber-800">Danno orario attivo per 24h. Applica un tick ogni 1 ora senza consumare energia o bibite{autoTraining.expiresAt ? ` • Scade: ${new Date(autoTraining.expiresAt).toLocaleString('it-IT')}` : ''}.</span>
          </div>
        )}
      </div>

      {/* Declare War Panel */}
      <WarCreatePanel
        userRegionId={user.regionId || ''}
        onCreateWar={handleCreateWar}
        loading={warCreating}
      />

      {/* Revolution / Coup Panel */}
      <RevolutionPanel
        regionId={user.regionId || ''}
        userId={user.id}
        userGold={user.gold || 0}
        regionDevelopment={regionDevelopmentIndex}
        onStartRevolution={handleStartRevolution}
        onStartCoup={handleStartCoup}
        loading={revLoading}
      />

      {wars.active.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-black uppercase tracking-tight">Guerre in Corso</h3>
          <div className="grid grid-cols-1 gap-4">
            {(warId ? wars.active.filter((w: any) => w.id === warId) : wars.active).map((war: any) => {
              const [expanded, setExpanded] = useState(war.id === warId);
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
                      <WarFactionBadge 
                        name={resolveFactionName(war.attackerCountryIso2, war.attackerDisplayName)} 
                        icon={war.attackerCountryIso2} 
                        align="center" 
                        iconSizeClass="w-7 h-7" 
                        textClassName={`text-2xl font-black ${isAttackerPatriot ? 'text-rose-600' : 'text-slate-900'}`} 
                      /> 
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Attaccante</p>
                      <p className="text-xs font-black text-indigo-500 mt-1">{war.attackerScore.toLocaleString()}</p>
                    </div>
                    <div className="px-4 font-black flex flex-col items-center gap-1">
                      <span className="text-slate-300">VS</span>
                      {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    </div>
                    <div className="text-center flex-1">
                      <WarFactionBadge 
                        name={resolveFactionName(war.defenderCountryIso2, war.defenderDisplayName)} 
                        icon={war.defenderCountryIso2} 
                        align="center" 
                        iconSizeClass="w-7 h-7" 
                        textClassName={`text-2xl font-black ${isDefenderPatriot ? 'text-emerald-600' : 'text-slate-900'}`} 
                      /> 
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Difensore</p>
                      <p className="text-xs font-black text-rose-500 mt-1">{war.defenderScore.toLocaleString()}</p>
                    </div>
                  </div>

                  <WarDamageBar
                    attackerScore={war.attackerScore}
                    defenderScore={war.defenderScore}
                    height="h-4"
                    showPercentages={false}
                  />

                  {/* War Type Badge */}
                  {war.warType && war.warType !== 'land' && (
                    <div className="flex justify-center mt-2">
                      <span className="bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg">
                        {war.warType === 'naval' ? '🚢 Navale' : war.warType === 'space' ? '🚀 Spaziale' : war.warType === 'lunar' ? '🌙 Lunare' : war.warType === 'revolution' ? '🔥 Rivoluzione' : war.warType === 'coup' ? '⚡ Golpe' : war.warType === 'training' ? '🎯 Addestramento' : war.warType}
                        {war.warType === 'naval' && war.navalPhase ? ` (Fase ${war.navalPhase})` : ''}
                      </span>
                    </div>
                  )}

                  {/* Expanded Deploy Section */}
                  <AnimatePresence>
                    {expanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden mt-6 pt-6 border-t border-slate-50"
                      >
                        {/* View Stats Button */}
                        <div className="flex justify-center mb-4">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/war/${war.id}/summary`); }}
                            className="px-6 py-2 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-slate-800 hover:scale-105 transition-all flex items-center gap-2"
                          >
                            📊 Visualizza Statistiche e Top Danni
                          </button>
                        </div>

                        <h4 className="text-center text-sm font-black text-slate-800 uppercase tracking-widest mb-4">Schieramento Militare</h4>

                        {/* Naval Phase 1 Warning */}
                        {war.warType === 'naval' && war.navalPhase === 1 && (
                          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-2xl p-3 flex items-center gap-2">
                            <span className="text-lg">🚢</span>
                            <span className="text-xs font-black text-blue-800">Fase 1 Navale: solo corazzate navali disponibili (prime 24h)</span>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {/* Attacker Side */}
                          <div className="space-y-3 bg-indigo-50 rounded-3xl p-4 border border-indigo-100/50">
                            <h5 className="text-center text-xs font-black text-indigo-700 uppercase mb-3">Supporta Attaccante</h5>
                            {!(war.warType === 'naval' && war.navalPhase === 1) && (
                              <>
                                <button disabled={deploying} onClick={() => handleDeploy('attacker', 'tank')} className="w-full bg-white hover:bg-indigo-100 text-slate-800 border border-indigo-200/50 p-3 rounded-2xl flex items-center justify-between transition-colors shadow-sm">
                                  <span className="font-bold text-sm flex items-center gap-2">🛡️ Carri armati</span>
                                  <div className="flex flex-col items-end">
                                    <span className="text-xs font-black text-indigo-600">+20 Danni base</span>
                                    <span className="text-[10px] font-bold text-slate-400">-{300}⚡</span>
                                  </div>
                                </button>
                                <button disabled={deploying} onClick={() => handleDeploy('attacker', 'aircraft')} className="w-full bg-white hover:bg-indigo-100 text-slate-800 border border-indigo-200/50 p-3 rounded-2xl flex items-center justify-between transition-colors shadow-sm">
                                  <span className="font-bold text-sm flex items-center gap-2">✈️ Aerei</span>
                                  <div className="flex flex-col items-end">
                                    <span className="text-xs font-black text-indigo-600">+120 Danni base</span>
                                    <span className="text-[10px] font-bold text-slate-400">-{300}⚡</span>
                                  </div>
                                </button>
                              </>
                            )}
                            {war.warType === 'naval' && war.navalPhase === 1 && (
                              <button disabled={deploying} onClick={() => handleDeploy('attacker', 'battleship')} className="w-full bg-white hover:bg-indigo-100 text-slate-800 border border-indigo-200/50 p-3 rounded-2xl flex items-center justify-between transition-colors shadow-sm">
                                <span className="font-bold text-sm flex items-center gap-2">🚢 Corazzata Navale</span>
                                <div className="flex flex-col items-end">
                                  <span className="text-xs font-black text-indigo-600">+2000 Danni</span>
                                  <span className="text-[10px] font-bold text-slate-400">-{300}⚡</span>
                                </div>
                              </button>
                            )}
                          </div>

                          {/* Defender Side */}
                          <div className="space-y-3 bg-rose-50 rounded-3xl p-4 border border-rose-100/50">
                            <h5 className="text-center text-xs font-black text-rose-700 uppercase mb-3">Supporta Difensore</h5>
                            {!(war.warType === 'naval' && war.navalPhase === 1) && (
                              <>
                                <button disabled={deploying} onClick={() => handleDeploy('defender', 'tank')} className="w-full bg-white hover:bg-rose-100 text-slate-800 border border-rose-200/50 p-3 rounded-2xl flex items-center justify-between transition-colors shadow-sm">
                                  <span className="font-bold text-sm flex items-center gap-2">🛡️ Carri armati</span>
                                  <div className="flex flex-col items-end">
                                    <span className="text-xs font-black text-rose-600">+20 Danni base</span>
                                    <span className="text-[10px] font-bold text-slate-400">-{300}⚡</span>
                                  </div>
                                </button>
                                <button disabled={deploying} onClick={() => handleDeploy('defender', 'aircraft')} className="w-full bg-white hover:bg-rose-100 text-slate-800 border border-rose-200/50 p-3 rounded-2xl flex items-center justify-between transition-colors shadow-sm">
                                  <span className="font-bold text-sm flex items-center gap-2">✈️ Aerei</span>
                                  <div className="flex flex-col items-end">
                                    <span className="text-xs font-black text-rose-600">+120 Danni base</span>
                                    <span className="text-[10px] font-bold text-slate-400">-{300}⚡</span>
                                  </div>
                                </button>
                              </>
                            )}
                            {war.warType === 'naval' && war.navalPhase === 1 && (
                              <button disabled={deploying} onClick={() => handleDeploy('defender', 'battleship')} className="w-full bg-white hover:bg-rose-100 text-slate-800 border border-rose-200/50 p-3 rounded-2xl flex items-center justify-between transition-colors shadow-sm">
                                <span className="font-bold text-sm flex items-center gap-2">🚢 Corazzata Navale</span>
                                <div className="flex flex-col items-end">
                                  <span className="text-xs font-black text-rose-600">+2000 Danni</span>
                                  <span className="text-[10px] font-bold text-slate-400">-{300}⚡</span>
                                </div>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Auto-Attack Toggle */}
                        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-black text-amber-800 text-sm uppercase">⚡ Modalità Automatica</p>
                              <p className="text-[10px] font-bold text-amber-600">Auto-War standard: ogni 10 minuti per 24h. Danno Orario: ogni 1 ora senza energia o bibite. Solo il Danno Orario è compatibile con Auto-Work.</p>
                            </div>
                            {autoAttack?.warId === war.id && (
                              <button onClick={() => handleStopWarAutomation(war.id)} className="px-4 py-2 bg-red-500 text-white rounded-xl font-black text-xs uppercase hover:bg-red-600">
                                ⏹ Ferma
                              </button>
                            )}
                          </div>
                          {autoWorkFactoryId && hasIncompatibleAutoAttackWithAutoWork && (
                            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-bold text-red-700">
                              Auto-Work non può coesistere con l'Auto-War standard o con altre modalità di auto-attacco frequente.
                            </div>
                          )}
                          {autoAttack?.warId === war.id ? (
                            <div className="bg-amber-100 rounded-xl p-3 flex items-center gap-2">
                              <span className="animate-pulse text-lg">⚔️</span>
                              <span className="text-xs font-black text-amber-800">
                                {autoAttack.autoType === 'hourly' ? 'Danno orario' : 'Automatico standard'} attivo: {autoAttack.side === 'attacker' ? 'Attaccante' : 'Difensore'} con {autoAttack.troopType === 'tank' ? 'Carri armati' : autoAttack.troopType === 'battleship' ? 'Corazzata navale' : 'Aerei'}{autoAttack.expiresAt ? ` • Scade: ${new Date(autoAttack.expiresAt).toLocaleString('it-IT')}` : ''}
                              </span>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              {(['attacker', 'defender'] as const).map(side => (
                                <div key={side} className="space-y-1">
                                  <p className="text-[9px] font-black text-center uppercase text-amber-700">{side === 'attacker' ? 'Attaccante' : 'Difensore'}</p>
                                  {!(war.warType === 'naval' && war.navalPhase === 1) && (['tank', 'aircraft'] as const).map(wep => (
                                    <button key={wep} onClick={() => {
                                      handleSetWarAutomation(war.id, side, wep, 'maximum');
                                    }} className="w-full py-1.5 px-2 bg-white border border-amber-200 rounded-lg text-[10px] font-black text-amber-800 hover:bg-amber-100 transition-all">
                                      {wep === 'tank' ? '🛡️ Carri armati' : '✈️ Aerei'}
                                    </button>
                                  ))}
                                  {war.warType === 'naval' && war.navalPhase === 1 && (
                                    <button onClick={() => {
                                      handleSetWarAutomation(war.id, side, 'battleship', 'maximum');
                                    }} className="w-full py-1.5 px-2 bg-white border border-amber-200 rounded-lg text-[10px] font-black text-amber-800 hover:bg-amber-100 transition-all">
                                      🚢 Corazzata Navale
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      handleSetWarAutomation(
                                        war.id,
                                        side,
                                        (war.warType === 'naval' && war.navalPhase === 1) ? 'battleship' : 'aircraft',
                                        'hourly'
                                      );
                                    }}
                                    className="w-full py-1.5 px-2 bg-amber-100 border border-amber-300 rounded-lg text-[10px] font-black text-amber-900 hover:bg-amber-200 transition-all"
                                    title="Danno ogni 1 ora per 24h senza consumo di energia o bibite. Compatibile con Auto-Work."
                                  >
                                    ⚡ Danno orario
                                  </button>
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
          {(warId ? wars.ended.filter((w: any) => w.id === warId) : wars.ended).map((war: any, i: number) => {
            const list = warId ? wars.ended.filter((w: any) => w.id === warId) : wars.ended;
            return (
              <div 
                key={war.id} 
                onClick={() => navigate(`/war/${war.id}/summary`)} 
                className={`p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors ${i !== list.length - 1 ? "border-b border-slate-50" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <WarFactionBadge 
                    name={resolveFactionName(war.attackerCountryIso2, war.attackerDisplayName)} 
                    icon={war.attackerCountryIso2} 
                    iconSizeClass="w-4 h-4" 
                    textClassName="text-sm font-black text-slate-900" 
                  /> 
                  <ArrowRight className="w-3 h-3 text-slate-300" />
                  <WarFactionBadge 
                    name={resolveFactionName(war.defenderCountryIso2, war.defenderDisplayName)} 
                    icon={war.defenderCountryIso2} 
                    iconSizeClass="w-4 h-4" 
                    textClassName="text-sm font-black text-slate-900" 
                  /> 
                </div>
                <div className="text-right flex items-center gap-3">
                  <div>
                    <p className={`text-[10px] font-black uppercase ${war.attackerScore > war.defenderScore ? "text-emerald-600" : "text-rose-600"}`}>
                      {war.attackerScore > war.defenderScore ? "Vittoria" : "Sconfitta"}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 mt-0.5">{new Date(war.endsAt).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </div>
              </div>
            );
          })}
          {(warId ? wars.ended.filter((w: any) => w.id === warId) : wars.ended).length === 0 && (
            <div className="p-8 text-center text-slate-400 font-medium">Nessuna guerra terminata di recente.</div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export { WarsView };
