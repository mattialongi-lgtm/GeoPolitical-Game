import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "motion/react";
import { Globe, Loader2, AlertCircle, Info, Crown, Briefcase, Pickaxe, Zap, Users, UserCheck, Flag, Factory } from "lucide-react";
import CollapsibleSection from '../state/CollapsibleSection';
import { NationalFlag } from "../ui";
import { RESOURCE_ICONS, RESOURCE_NAMES } from "../../constants";
import { RegionResourcesTab } from "../resources/RegionResourcesTab";
import { DeepExplorationPanel } from "../resources/DeepExplorationPanel";
import { GovernmentView } from "../GovernmentView";
import { usePollingTask } from "../../hooks/usePollingTask";

const CountryDetailView = ({ user, handleAction, actionLoading, fetchData }: { user: any, handleAction: (a: string, b: any) => void, actionLoading: boolean, fetchData: () => void }) => {
  const { iso2 } = useParams();
  const navigate = useNavigate();
  const [region, setRegion] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [apps, setApps] = useState<any[]>([]);
  const [agreements, setAgreements] = useState<{ outgoing: any[]; incoming: any[] }>({ outgoing: [], incoming: [] });
  const [agreementTargetId, setAgreementTargetId] = useState("");
  const [allRegions, setAllRegions] = useState<{ id: string; name: string }[]>([]);
  const [sanctions, setSanctions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'info' | 'government' | 'resources' | 'autonomy'>('info');
  const [regionFactories, setRegionFactories] = useState<any[]>([]);
  const [autonomyData, setAutonomyData] = useState<any>(null);
  const [regionParties, setRegionParties] = useState<any[]>([]);

  const regionalBuildingsForDisplay = useMemo(() => {
    const base = (autonomyData?.buildings && typeof autonomyData.buildings === 'object')
      ? autonomyData.buildings
      : {};
    const factoryCount = regionFactories.length;
    if (factoryCount > 0) {
      return { ...base, factory: factoryCount };
    }
    return base;
  }, [autonomyData, regionFactories.length]);

  const isTraveling = Boolean(user?.travelingUntil && user.travelingUntil > Date.now());
  const travelDestinationName = useMemo(() => {
    const destinationId = typeof user?.travelingTo === "string" ? user.travelingTo.toUpperCase() : null;
    if (!destinationId) return null;
    if (destinationId === region?.id) return region?.name || destinationId;
    return allRegions.find((entry) => entry.id === destinationId)?.name || destinationId;
  }, [allRegions, region?.id, region?.name, user?.travelingTo]);

  const fetchCountryDetail = useCallback(async () => {
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
  }, [iso2, user?.id]);

  const fetchCountryAvatars = useCallback(async () => {
    if (!iso2) return;
    try {
      const res = await fetch(`/api/countries/${iso2}?includeAvatar=true`);
      if (!res.ok) return;
      const data = await res.json();
      setRegion((prev: any) => {
        if (!prev) return data;
        return {
          ...prev,
          ownerAvatarData: data.ownerAvatarData || null,
          leaderAvatarData: data.leaderAvatarData || null,
          economicAdviserAvatarData: data.economicAdviserAvatarData || null,
          foreignMinisterAvatarData: data.foreignMinisterAvatarData || null,
        };
      });
    } catch (e) {
      console.error(e);
    }
  }, [iso2]);

  const fetchAgreements = useCallback(async () => {
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
  }, [iso2]);

  const fetchSanctions = useCallback(async () => {
    try {
      const res = await fetch(`/api/countries/${iso2}/sanctions`);
      if (res.ok) {
        setSanctions(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  }, [iso2]);

  const fetchRegionFactories = useCallback(async () => {
    try {
      const res = await fetch(`/api/factories?regionId=${iso2?.toUpperCase()}`);
      if (res.ok) {
        setRegionFactories(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  }, [iso2]);

  const fetchRegionParties = useCallback(async () => {
    try {
      const res = await fetch(`/api/parties?regionId=${iso2?.toUpperCase()}`);
      if (res.ok) {
        setRegionParties(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  }, [iso2]);

  const fetchAutonomyData = useCallback(async () => {
    if (!iso2) return;
    try {
      const res = await fetch(`/api/regions/${iso2.toUpperCase()}/autonomy`);
      if (res.ok) setAutonomyData(await res.json());
    } catch (e) {
      console.error(e);
    }
  }, [iso2]);

  const fetchAllRegions = useCallback(async () => {
    try {
      const res = await fetch('/api/regions');
      if (!res.ok) return;
      const data = await res.json();
      setAllRegions(data.map((entry: any) => ({ id: entry.id, name: entry.name })));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const refreshCountryScreen = useCallback(async () => {
    await Promise.all([
      fetchCountryDetail(),
      fetchAgreements(),
      fetchSanctions(),
      fetchRegionFactories(),
      fetchRegionParties(),
      fetchAutonomyData(),
    ]);
  }, [
    fetchAgreements,
    fetchAutonomyData,
    fetchCountryDetail,
    fetchRegionFactories,
    fetchRegionParties,
    fetchSanctions,
  ]);

  useEffect(() => {
    setLoading(true);
    void fetchAllRegions();
    void fetchCountryAvatars();
  }, [fetchAllRegions, fetchCountryAvatars, iso2]);

  usePollingTask(refreshCountryScreen, {
    enabled: Boolean(iso2),
    intervalMs: 90_000,
    refreshOnVisible: true,
    refreshOnFocus: true,
  });

  if (loading) return (
    <div className="min-h-[400px] flex items-center justify-center bg-gray-900/60 border border-gray-800 rounded-2xl">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-gray-500 font-semibold">Caricamento regione...</p>
      </div>
    </div>
  );

  if (!region) return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-12 text-center">
      <Globe className="w-16 h-16 text-gray-700 mx-auto mb-4" />
      <h2 className="text-2xl font-black text-gray-200">Paese non trovato</h2>
      <p className="text-gray-500 mt-2">"{iso2}" non corrisponde a nessuna regione.</p>
      <button onClick={() => navigate("/")} className="mt-6 text-indigo-400 font-black uppercase text-xs hover:text-indigo-300 transition-colors">← Torna alla Mappa</button>
    </div>
  );

  const leaderAvatar = region.leaderAvatarData || region.leader?.avatarData || null;
  const leaderInitial = (region.leaderName || 'L').trim().charAt(0).toUpperCase();

  const handleActionWithRefresh = async (action: string, body: any) => {
    await handleAction(action, body);
    await Promise.all([
      fetchData(),
      refreshCountryScreen(),
    ]);
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
        await Promise.all([
          fetchData(),
          refreshCountryScreen(),
        ]);
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
      await refreshCountryScreen();
    } catch {
      alert('Errore di connessione.');
    }
  };

  const resources = Array.isArray(region.resources) ? region.resources : [];
  const canManageMigration = user?.id === region.ownerUserId || user?.id === region.foreignMinisterId;

  const regionalIndicesCard = autonomyData?.indices ? (
    <div className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-black uppercase tracking-tight text-slate-100">Indici Regionali</h3>
        {(() => {
          const cls = autonomyData.indices.regionalClassification;
          const clsLabel = cls === 'developed' ? 'Sviluppata' : cls === 'developing' ? 'In Via di Sviluppo' : 'Arretrata';
          const clsColor = cls === 'developed' ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-400/40' : cls === 'developing' ? 'bg-amber-500/20 text-amber-100 border border-amber-400/40' : 'bg-rose-500/20 text-rose-100 border border-rose-400/40';
          return (
            <span className={`px-3 py-1 rounded-xl text-[10px] font-black ${clsColor}`}>{clsLabel}</span>
          );
        })()}
      </div>
      {autonomyData.indices.regionalClassification === 'underdeveloped' && (
        <div className="mb-4 p-3 bg-rose-500/15 rounded-2xl border border-rose-400/40">
          <p className="text-xs font-black text-rose-100">Regione arretrata: rischio di instabilita politica attivo</p>
          <p className="text-[10px] font-bold text-rose-200">Aumenta lo Sviluppo costruendo Fondi Immobiliari per stabilizzare la regione.</p>
        </div>
      )}
      <div className="space-y-5">
        {[
          {
            label: "Salute",
            val: autonomyData.indices.healthIndex,
            effective: autonomyData.indices.effectiveHealthIndex,
            progress: autonomyData.indices.healthProgress,
            icon: "H",
            color: "#ef4444",
            colorClass: "bg-slate-800",
            source: "Ospedali",
            effect: `Riduce costo energetico delle azioni (-${((autonomyData.indices.healthIndex || 0) * 1).toFixed(0)}% attuale)`,
            nextThreshold: autonomyData.indices.nextThresholds?.health,
            primaryCount: autonomyData.indices.primaryCounts?.health ?? (autonomyData.buildings?.hospital || 0),
          },
          {
            label: "Militare",
            val: autonomyData.indices.militaryIndex,
            progress: autonomyData.indices.militaryProgress,
            icon: "M",
            color: "#f97316",
            colorClass: "bg-slate-800",
            source: "Basi Militari (+ Accademie, Missili, Aeroporti, Porti)",
            effect: `Bonus danno guerra (+${((autonomyData.indices.militaryIndex || 0) * 3).toFixed(0)}% attacco, +${((autonomyData.indices.militaryIndex || 0) * 2).toFixed(0)}% difesa)`,
            nextThreshold: autonomyData.indices.nextThresholds?.military,
            primaryCount: autonomyData.indices.rawScores?.military ?? (autonomyData.indices.primaryCounts?.military ?? (autonomyData.buildings?.military_base || 0)),
          },
          {
            label: "Istruzione",
            val: autonomyData.indices.educationIndex,
            progress: autonomyData.indices.educationProgress,
            icon: "I",
            color: "#6366f1",
            colorClass: "bg-slate-800",
            source: "Scuole",
            effect: `Aumenta XP guadagnata (+${((autonomyData.indices.educationIndex || 0) * 2).toFixed(0)}% per azione)`,
            nextThreshold: autonomyData.indices.nextThresholds?.education,
            primaryCount: autonomyData.indices.primaryCounts?.education ?? (autonomyData.buildings?.school || 0),
          },
          {
            label: "Sviluppo",
            val: autonomyData.indices.developmentIndex,
            progress: autonomyData.indices.developmentProgress,
            icon: "S",
            color: "#10b981",
            colorClass: "bg-slate-800",
            source: "Fondi Immobiliari",
            effect: `Stabilita politica e stipendi (+${((autonomyData.indices.developmentIndex || 0) * 5).toFixed(0)}% stipendi, -${((autonomyData.indices.developmentIndex || 0) * 8).toFixed(0)}% rischio crisi)`,
            nextThreshold: autonomyData.indices.nextThresholds?.development,
            primaryCount: autonomyData.indices.primaryCounts?.development ?? (autonomyData.buildings?.real_estate_fund || 0),
          },
        ].map(ind => {
          const level = typeof ind.val === 'number' ? Math.floor(ind.val) : 0;
          const MAX_LEVEL = 10;
          const progressVal = typeof ind.progress === 'number' ? ind.progress : Math.min(100, (level / MAX_LEVEL) * 100);
          const isMaxed = level >= MAX_LEVEL;
          return (
            <div key={ind.label} className={`p-4 rounded-3xl border border-slate-700 ${ind.colorClass}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black text-slate-100">{ind.icon}</span>
                  <div>
                    <p className="text-sm font-black text-slate-100">{ind.label}</p>
                    <p className="text-[9px] font-bold text-slate-300">Fonte: {ind.source}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-slate-100">{level}</span>
                  <span className="text-xs font-bold text-slate-300">/{MAX_LEVEL}</span>
                  {ind.effective !== undefined && ind.effective < level && (
                    <p className="text-[9px] font-bold text-rose-300">eff: {typeof ind.effective === 'number' ? ind.effective.toFixed(1) : ind.effective}</p>
                  )}
                </div>
              </div>
              <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${isMaxed ? 100 : progressVal}%`, backgroundColor: ind.color }}
                />
              </div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-bold text-slate-300">
                  {isMaxed
                    ? 'Livello massimo raggiunto'
                    : `Score: ${typeof ind.primaryCount === 'number' ? (Number.isInteger(ind.primaryCount) ? ind.primaryCount : ind.primaryCount.toFixed(1)) : '-'}${ind.nextThreshold != null ? ` / ${ind.nextThreshold} per lv.${level + 1}` : ''}`
                  }
                </p>
                <p className="text-[9px] font-black" style={{ color: ind.color }}>{isMaxed ? 'MAX' : `${Math.round(progressVal)}%`}</p>
              </div>
              <p className="text-[9px] font-bold text-slate-200 italic">Effetto: {ind.effect}</p>
            </div>
          );
        })}
      </div>
      {autonomyData.region.pollution > 0 && (
        <div className="mt-4 p-3 bg-amber-500/15 rounded-2xl border border-amber-400/40">
          <p className="text-xs font-black text-amber-100">Inquinamento: livello {autonomyData.region.pollution}</p>
          <p className="text-[10px] font-bold text-amber-200">Malus efficacia salute: -{autonomyData.pollutionMalus.toFixed(1)}%</p>
        </div>
      )}
    </div>
  ) : null;


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
      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden">
        <div className={`h-1.5 w-full ${region.ownerUserId ? "bg-indigo-500" : "bg-emerald-500"}`} />
        <div className="p-6">
          <div className="flex items-center gap-4 mb-5">
            <NationalFlag iso2={iso2 || ""} className="w-14 h-10 shadow-md rounded-lg" />
            <div className="flex-1">
              <h2 className="text-2xl font-black text-white tracking-tight leading-tight">{region.name || iso2}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="text-[10px] font-black uppercase bg-gray-800 text-gray-400 px-2 py-1 rounded-lg">ISO: {region.id || iso2}</span>
                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${region.ownerUserId ? "bg-indigo-600/20 text-indigo-400" : "bg-emerald-600/20 text-emerald-400"}`}>
                  {region.ownerName ? `🟣 ${region.ownerName}` : "🟢 Territorio Neutrale"}
                </span>
                {region.isCapital && <span className="text-[10px] font-black uppercase bg-yellow-600/20 text-yellow-400 px-2 py-1 rounded-lg">👑 Capitale</span>}
                {region.isAutonomous && <span className="text-[10px] font-black uppercase bg-purple-600/20 text-purple-400 px-2 py-1 rounded-lg">🏛️ Autonomia</span>}
                {region.isBorderRegion && <span className="text-[10px] font-black uppercase bg-red-600/20 text-red-400 px-2 py-1 rounded-lg">⚔️ Frontaliera</span>}
                {region.governorName && <span className="text-[10px] font-black uppercase bg-blue-600/20 text-blue-400 px-2 py-1 rounded-lg">👤 Gov: {region.governorName}</span>}
                <span className="text-[10px] font-black uppercase bg-amber-600/20 text-amber-400 px-2 py-1 rounded-lg ml-auto">
                  Tassa Mercato: {region.marketTaxRate || 10}%
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-5 pb-1">
            <button
              onClick={() => setActiveTab('info')}
              className={`flex-1 min-w-[100px] py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'info' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/30" : "bg-gray-800/50 text-gray-400 hover:text-gray-200"}`}
            >
              Info & Economia
            </button>
            <button
              onClick={() => setActiveTab('government')}
              className={`flex-1 min-w-[100px] py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'government' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/30" : "bg-gray-800/50 text-gray-400 hover:text-gray-200"}`}
            >
              Governo
            </button>
            <button
              onClick={() => setActiveTab('resources')}
              className={`flex-1 min-w-[100px] py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'resources' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/30" : "bg-gray-800/50 text-gray-400 hover:text-gray-200"}`}
            >
              ⛏️ Risorse
            </button>
            <button
              onClick={() => setActiveTab('autonomy')}
              className={`flex-1 min-w-[100px] py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'autonomy' ? "bg-purple-600 text-white shadow-lg shadow-purple-900/30" : "bg-gray-800/50 text-gray-400 hover:text-gray-200"}`}
            >
              🏛️ Autonomia
            </button>
          </div>

          {activeTab === 'info' && (
            <div className="space-y-3">
              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { icon: Users, value: region.citizenCount ?? 0, label: 'Cittadini', color: 'bg-sky-600', accent: 'text-sky-400', to: `/players?search=${iso2}` },
                  { icon: UserCheck, value: region.residentCount ?? 0, label: 'Residenti', color: 'bg-emerald-600', accent: 'text-emerald-400', to: `/players?search=${iso2}` },
                  { icon: Flag, value: regionParties.length, label: 'Partiti', color: 'bg-purple-600', accent: 'text-purple-400', to: `/parties?search=${iso2}` },
                  { icon: Factory, value: regionFactories.length, label: 'Fabbriche', color: 'bg-amber-600', accent: 'text-amber-400', to: `/world-factories?search=${iso2}` },
                ].map((s, i) => (
                  <button
                    key={i}
                    onClick={() => navigate(s.to)}
                    className="flex flex-col items-center gap-1 p-3 rounded-xl bg-gray-800/50 border border-gray-700/40 hover:border-indigo-500/50 hover:bg-gray-800/80 transition-all group"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 ${s.color}`}>
                      <s.icon className="w-4 h-4 text-white" />
                    </div>
                    <span className={`text-lg font-black ${s.accent} tabular-nums`}>{s.value.toLocaleString('it-IT')}</span>
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider text-center group-hover:text-gray-300">{s.label}</span>
                  </button>
                ))}
              </div>

              {regionParties.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Lista Partiti</p>
                  <div className="flex flex-wrap gap-1.5">
                    {regionParties.map((p: any) => (
                      <span
                        key={p.id}
                        className="text-[10px] font-black px-2 py-1 bg-indigo-600/20 text-indigo-300 border border-indigo-700/30 rounded-lg"
                      >
                        {p.tag ? `[${p.tag}] ` : ''}{p.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Sanctions List */}
              {sanctions.length > 0 && (
                <div className="text-left">
                  <h4 className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <AlertCircle className="w-3 h-3" /> Stati sanzionati da {region.name}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {sanctions.map((s: any) => (
                      <div key={s.id} className="flex items-center gap-2 p-3 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                        <NationalFlag iso2={s.targetStateId || ""} className="w-8 h-6 shadow-sm rounded-sm" />
                        <div className="flex-1">
                          <p className="text-xs font-black text-rose-200 leading-none">{s.targetStateName || s.targetStateId}</p>
                          <p className="text-[9px] font-bold text-rose-400 uppercase mt-0.5">Sanzioni Commerciali Attive</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {activeTab === 'government' ? (
        <div className="space-y-4">
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-gray-300 mb-4 flex items-center gap-2">
                <Crown className="w-4 h-4 text-gray-400" /> Capo di Stato
              </h3>
              {region.leaderUserId ? (
                <div className="flex items-center gap-4">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/profile/${region.leaderUserId}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") navigate(`/profile/${region.leaderUserId}`);
                    }}
                    className="w-12 h-12 bg-indigo-600/20 rounded-2xl flex items-center justify-center overflow-hidden cursor-pointer"
                    title="Apri profilo"
                    aria-label="Apri profilo"
                  >
                    {leaderAvatar ? (
                      <img src={leaderAvatar} alt={region.leaderName || 'Leader'} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-black text-indigo-400">{leaderInitial}</span>
                    )}
                  </div>
                  <div>
                    <p
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/profile/${region.leaderUserId}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") navigate(`/profile/${region.leaderUserId}`);
                      }}
                      className="text-sm font-black text-gray-200 cursor-pointer hover:text-indigo-300 transition-colors"
                      title="Apri profilo"
                      aria-label="Apri profilo"
                    >
                      {region.leaderName || 'Leader dello Stato'}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm font-bold text-gray-500">Nessun leader attivo in questo Stato.</p>
              )}

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  onClick={() => navigate(`/leader/${(iso2 || '').toUpperCase()}`)}
                  className="py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2"
                >
                  <Crown className="w-4 h-4" /> Leader & Elezioni
                </button>
                <button
                  onClick={() => navigate(`/ministers/${(iso2 || '').toUpperCase()}`)}
                  className="py-3 bg-gray-800/50 border border-gray-700/40 text-gray-300 rounded-xl font-black text-xs uppercase tracking-widest hover:border-indigo-500/40 transition-colors flex items-center justify-center gap-2"
                >
                  <Briefcase className="w-4 h-4" /> Ministri
                </button>
              </div>
            </div>
          <GovernmentView region={region} currentUser={user} onUpdate={fetchCountryDetail} />
        </div>
      ) : activeTab === 'resources' ? (
        <div className="space-y-4">
          {/* Link to Advanced Extraction Dashboard */}
          <div className="bg-gray-900/60 p-4 rounded-2xl border border-emerald-800/40">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-emerald-300">⛏️ Dashboard Estrazione Avanzata</h4>
                <p className="text-[10px] font-bold text-emerald-400 mt-1">Visualizza cap, analytics 24h, leaderboard, esperienza lavorativa e distribuzione risorse.</p>
              </div>
              <button
                onClick={() => navigate(`/extraction/${region.id}`)}
                className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-black text-xs uppercase hover:bg-emerald-600 transition-all"
              >
                Apri →
              </button>
            </div>
          </div>
          <RegionResourcesTab regionId={iso2?.toUpperCase() || ""} user={user} />
          {/* Show Deep Exploration panel for leader/economy minister */}
          {region.nation_id && (region.ownerUserId === user?.id || region.economicAdviserId === user?.id) && (
            <DeepExplorationPanel user={user} nationId={region.nation_id} />
          )}
        </div>
      ) : activeTab === 'autonomy' ? (
        <div className="space-y-4">
          {!autonomyData ? (
            <div className="bg-gray-900/60 p-8 rounded-2xl border border-gray-800 text-center">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : (
            <>
              {/* Autonomy Status */}
              <div className={`bg-gray-900/60 p-6 rounded-2xl border ${autonomyData.region.isAutonomous ? 'border-purple-700/40' : 'border-gray-800'}`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-black uppercase tracking-tight text-white">🏛️ Stato Autonomia</h3>
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-black ${autonomyData.region.isAutonomous ? 'bg-purple-900/40 text-purple-300' : 'bg-gray-800/50 text-gray-400'}`}>
                    {autonomyData.region.isAutonomous ? '✅ Attiva' : '❌ Non Attiva'}
                  </span>
                </div>
                {autonomyData.region.isAutonomous && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-purple-900/20 border border-purple-700/30 p-4 rounded-xl text-center">
                      <p className="text-[9px] font-black text-purple-400 uppercase">Governatore</p>
                      <p className="text-sm font-black text-purple-300">{autonomyData.region.governorName || '— Vacante —'}</p>
                    </div>
                    <div className="bg-emerald-900/20 border border-emerald-700/30 p-4 rounded-xl text-center">
                      <p className="text-[9px] font-black text-emerald-400 uppercase">Budget Regionale</p>
                      <p className="text-sm font-black text-emerald-300">€{(autonomyData.region.regionalBudget || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-blue-900/20 border border-blue-700/30 p-4 rounded-xl text-center">
                      <p className="text-[9px] font-black text-blue-400 uppercase">Quota Regionale</p>
                      <p className="text-lg font-black text-blue-300">{autonomyData.region.regionalProfitSharePercent}%</p>
                    </div>
                    <div className="bg-indigo-900/20 border border-indigo-700/30 p-4 rounded-xl text-center">
                      <p className="text-[9px] font-black text-indigo-400 uppercase">Quota Stato</p>
                      <p className="text-lg font-black text-indigo-300">{autonomyData.region.nationalProfitSharePercent}%</p>
                    </div>
                    <div className="bg-gray-800/50 border border-gray-700/40 p-4 rounded-xl text-center">
                      <p className="text-[9px] font-black text-gray-400 uppercase">Parlamento</p>
                      <p className="text-sm font-black text-gray-200">{autonomyData.region.regionalParliamentEnabled ? '✅ Attivo' : '❌ Disattivo'}</p>
                    </div>
                    {autonomyData.region.autonomyGrantedAt && (
                      <div className="bg-gray-800/50 border border-gray-700/40 p-4 rounded-xl text-center">
                        <p className="text-[9px] font-black text-gray-400 uppercase">Istituita il</p>
                        <p className="text-xs font-black text-gray-300">{new Date(autonomyData.region.autonomyGrantedAt).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>
                )}
                {!autonomyData.region.isAutonomous && !autonomyData.region.isCapital && (
                  <p className="text-xs font-bold text-gray-500 mt-2">Questa regione può essere resa autonoma tramite legge parlamentare.</p>
                )}
                {autonomyData.region.isCapital && (
                  <p className="text-xs font-bold text-amber-400 mt-2">👑 La capitale non può diventare un'autonomia.</p>
                )}
              </div>

              {/* Taxes */}
              <div className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800">
                <h3 className="text-lg font-black uppercase tracking-tight mb-4 text-white">💰 Tasse Regionali</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-amber-900/20 border border-amber-700/30 p-4 rounded-xl text-center">
                    <p className="text-[9px] font-black text-amber-400 uppercase">Lavoratori</p>
                    <p className="text-2xl font-black text-amber-300">{autonomyData.region.workerTaxPercent}%</p>
                  </div>
                  <div className="bg-orange-900/20 border border-orange-700/30 p-4 rounded-xl text-center">
                    <p className="text-[9px] font-black text-orange-400 uppercase">Mercato</p>
                    <p className="text-2xl font-black text-orange-300">{autonomyData.region.marketTaxRate}%</p>
                  </div>
                  <div className="bg-rose-900/20 border border-rose-700/30 p-4 rounded-xl text-center">
                    <p className="text-[9px] font-black text-rose-400 uppercase">Industria</p>
                    <p className="text-2xl font-black text-rose-300">{autonomyData.region.industryTaxPercent}%</p>
                  </div>
                </div>
              </div>

              {/* Energy Dashboard */}
              <div className={`bg-gray-900/60 p-6 rounded-2xl border ${autonomyData.energy.isDeficit ? 'border-red-700/40' : 'border-emerald-700/40'}`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-black uppercase tracking-tight text-white">⚡ Energia Regionale</h3>
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-black ${autonomyData.energy.isDeficit ? 'bg-red-900/40 text-red-300' : 'bg-emerald-900/40 text-emerald-300'}`}>
                    {autonomyData.energy.isDeficit ? '🔴 Deficit' : '🟢 Surplus'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-emerald-900/20 border border-emerald-700/30 p-4 rounded-xl text-center">
                    <p className="text-[9px] font-black text-emerald-400 uppercase">Generazione</p>
                    <p className="text-xl font-black text-emerald-300">{autonomyData.energy.generation}</p>
                    <p className="text-[9px] font-bold text-emerald-400">mW</p>
                  </div>
                  <div className="bg-orange-900/20 border border-orange-700/30 p-4 rounded-xl text-center">
                    <p className="text-[9px] font-black text-orange-400 uppercase">Consumo</p>
                    <p className="text-xl font-black text-orange-300">{autonomyData.energy.consumption}</p>
                    <p className="text-[9px] font-bold text-orange-400">mW</p>
                  </div>
                  <div className={`p-4 rounded-xl border text-center ${autonomyData.energy.efficiency >= 0 ? 'bg-emerald-900/20 border-emerald-700/30' : 'bg-red-900/20 border-red-700/30'}`}>
                    <p className="text-[9px] font-black uppercase" style={{ color: autonomyData.energy.efficiency >= 0 ? '#34d399' : '#f87171' }}>Efficienza</p>
                    <p className="text-xl font-black" style={{ color: autonomyData.energy.efficiency >= 0 ? '#34d399' : '#f87171' }}>
                      {autonomyData.energy.efficiency >= 0 ? '+' : ''}{autonomyData.energy.efficiency}
                    </p>
                    <p className="text-[9px] font-bold" style={{ color: autonomyData.energy.efficiency >= 0 ? '#34d399' : '#f87171' }}>mW</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-800/50 border border-gray-700/40 p-3 rounded-xl text-center">
                    <p className="text-[9px] font-black text-gray-400 uppercase">Centrali {autonomyData.energy.surplusPowerPlants >= 0 ? 'in eccesso' : 'mancanti'}</p>
                    <p className="text-lg font-black" style={{ color: autonomyData.energy.surplusPowerPlants >= 0 ? '#34d399' : '#f87171' }}>{Math.abs(autonomyData.energy.surplusPowerPlants)}</p>
                  </div>
                  <div className="bg-gray-800/50 border border-gray-700/40 p-3 rounded-xl text-center">
                    <p className="text-[9px] font-black text-gray-400 uppercase">{autonomyData.energy.isDeficit ? 'Edifici in eccesso' : 'Edifici supportabili'}</p>
                    <p className="text-lg font-black text-gray-200">{autonomyData.energy.isDeficit ? autonomyData.energy.excessBuildings : autonomyData.energy.supportableBuildings}</p>
                  </div>
                </div>
                {autonomyData.energy.stateCompensation > 0 && (
                  <div className="mt-3 p-3 bg-blue-900/20 rounded-xl border border-blue-700/40">
                    <p className="text-xs font-black text-blue-300">🔄 Compensazione statale: +{autonomyData.energy.stateCompensation} mW</p>
                    <p className="text-[10px] font-bold text-blue-400">Efficienza netta (dopo compensazione): {autonomyData.energy.netEfficiency} mW</p>
                  </div>
                )}
                {autonomyData.energyDeficitMalus > 0 && (
                  <div className="mt-3 p-3 bg-red-900/20 rounded-xl border border-red-700/40">
                    <p className="text-xs font-black text-red-300">⚠️ Deficit energetico attivo!</p>
                    <p className="text-[10px] font-bold text-red-400">Malus efficienza economica: -{autonomyData.energyDeficitMalus.toFixed(1)}%</p>
                  </div>
                )}
              </div>

              {/* Military Stats */}
              <div className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800">
                <h3 className="text-lg font-black uppercase tracking-tight mb-4 text-white">⚔️ Capacità Militare Regionale</h3>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-red-900/20 border border-red-700/30 p-4 rounded-xl text-center">
                    <p className="text-[9px] font-black text-red-400 uppercase">Danno Iniziale Attacco</p>
                    <p className="text-xl font-black text-red-300">{(autonomyData.militaryStats.initialAttackDamage || 0).toLocaleString()}</p>
                  </div>
                  <div className="bg-blue-900/20 border border-blue-700/30 p-4 rounded-xl text-center">
                    <p className="text-[9px] font-black text-blue-400 uppercase">Punti Difesa Iniziali</p>
                    <p className="text-xl font-black text-blue-300">{(autonomyData.militaryStats.initialDefensePoints || 0).toLocaleString()}</p>
                  </div>
                </div>
                {autonomyData.region.isBorderRegion && (
                  <div className="p-3 bg-red-900/20 rounded-xl border border-red-700/40">
                    <p className="text-[10px] font-black text-red-300">⚔️ Regione Frontaliera — le strutture militari sono particolarmente rilevanti!</p>
                  </div>
                )}
              </div>


              {/* Regional Buildings section removed by request */}

                            {/* Daily Extraction Limits - Premium Redesign */}
              <div className="bg-[#1e2a3a] p-8 rounded-[2.5rem] shadow-2xl border border-slate-700/50">
                <h3 className="text-xl font-black uppercase tracking-tight mb-6 text-white flex items-center gap-3">
                  <Pickaxe className="w-6 h-6 text-indigo-400" />
                  LIMITI ESTRAZIONE GIORNALIERI
                </h3>
                <div className="space-y-6">
                  {[
                    { key: 'gold', label: 'Oro', icon: '🥇', data: autonomyData.extraction.gold, color: 'from-amber-400 to-amber-600' },
                    { key: 'oil', label: 'Petrolio', icon: '🛢️', data: autonomyData.extraction.oil, color: 'from-blue-400 to-blue-600' },
                    { key: 'minerals', label: 'Minerali', icon: '🪨', data: autonomyData.extraction.minerals, color: 'from-slate-300 to-slate-500' },
                    { key: 'uranium', label: 'Uranio', icon: '☢️', data: autonomyData.extraction.uranium, color: 'from-yellow-400 to-yellow-600 text-black' },
                    { key: 'diamonds', label: 'Diamanti', icon: '💎', data: autonomyData.extraction.diamonds, color: 'from-cyan-400 to-cyan-600' },
                  ].map(res => (
                    <div key={res.key} className="group">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl drop-shadow-md">{res.icon}</span>
                          <span className="text-sm font-black text-slate-100 tracking-wide uppercase">{res.label}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-bold text-slate-400 tabular-nums">
                            {res.data.extracted.toLocaleString()} / {res.data.limit.toLocaleString()}
                          </span>
                          <span className="px-2.5 py-1.5 rounded-xl bg-indigo-500/10 text-emerald-400 text-[11px] font-black tabular-nums">
                            {res.data.remaining.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-800/50 h-3 rounded-full overflow-hidden border border-slate-700/30">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, res.data.limit > 0 ? (res.data.extracted / res.data.limit) * 100 : 0)}%` }}
                          className={`h-full rounded-full bg-gradient-to-r shadow-[0_0_10px_rgba(0,0,0,0.5)] ${res.color}`}
                        />
                      </div>
                    </div>
                  ))}
                  {autonomyData.extraction.nextResetAt && (
                    <div className="flex items-center justify-center gap-2 pt-4 border-t border-slate-800/50">
                      <span className="text-lg">⏰</span>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Prossimo reset automatico: {new Date(autonomyData.extraction.nextResetAt).toLocaleString('it-IT', { timeZone: 'Europe/London' })} ora di Londra
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Budget Transactions (for autonomous regions) */}
              {autonomyData.region.isAutonomous && autonomyData.transactions.length > 0 && (
                <div className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800">
                  <h3 className="text-lg font-black uppercase tracking-tight mb-4 text-white">📜 Storico Budget Regionale</h3>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {autonomyData.transactions.slice(0, 30).map((tx: any) => (
                      <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-800/50 border border-gray-700/40 rounded-xl">
                        <div>
                          <p className="text-[10px] font-black text-gray-200">{tx.description || tx.subtype || tx.type}</p>
                          <p className="text-[9px] font-bold text-gray-500">{new Date(tx.createdAt).toLocaleString()}</p>
                        </div>
                        <span className={`text-sm font-black ${(tx.moneyDelta || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {(tx.moneyDelta || 0) >= 0 ? '+' : ''}€{Math.abs(tx.moneyDelta || 0).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Autonomy History */}
              {autonomyData.history.length > 0 && (
                <div className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800">
                  <h3 className="text-lg font-black uppercase tracking-tight mb-4 text-white">📋 Storico Decisioni Autonomia</h3>
                  <div className="space-y-2">
                    {autonomyData.history.map((h: any) => (
                      <div key={h.id} className="flex items-center gap-3 p-3 bg-gray-800/50 border border-gray-700/40 rounded-xl">
                        <span className="text-2xl">{h.action === 'granted' ? '✅' : '❌'}</span>
                        <div>
                          <p className="text-xs font-black text-gray-200">{h.action === 'granted' ? 'Autonomia istituita' : 'Autonomia revocata'}</p>
                          <p className="text-[9px] font-bold text-gray-500">{new Date(h.createdAt).toLocaleString()}</p>
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
          {/* Azioni */}
          {user && (
            <CollapsibleSection title="Azioni" icon={<Zap className="w-4 h-4" />} defaultOpen>
              <div className="p-4 grid grid-cols-2 gap-2">
                {isTraveling ? (
                  <div className="flex items-center gap-2 p-3 rounded-xl border border-indigo-500/30 bg-indigo-950/30 cursor-default col-span-1">
                    <span className="text-base">✈️</span>
                    <span className="text-[11px] font-bold text-indigo-200">
                      In viaggio verso {travelDestinationName || user.travelingTo}
                    </span>
                  </div>
                ) : user.regionId === region.id ? (
                  <div className="flex items-center gap-2 p-3 rounded-xl border border-gray-700/40 bg-gray-800/30 cursor-default col-span-1">
                    <span className="text-base">✈️</span>
                    <span className="text-[11px] font-bold text-gray-500">Sei già qui</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleImmigrationAction('/api/actions/travel', { regionId: region.id })}
                    disabled={actionLoading}
                    className="flex items-center gap-2 p-3 rounded-xl border border-gray-700/40 bg-gray-800/50 hover:border-indigo-500/40 hover:bg-gray-800/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="text-base">✈️</span>
                    <span className="text-[11px] font-bold text-gray-300">Spostati qui</span>
                  </button>
                )}
                {user.residenceId === region.id ? (
                  <div className="flex items-center gap-2 p-3 rounded-xl border border-gray-700/40 bg-gray-800/30 cursor-default col-span-1">
                    <span className="text-base">🏠</span>
                    <span className="text-[11px] font-bold text-gray-500">Già residente</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleImmigrationAction('/api/actions/apply', { regionId: region.id, type: 'residence' })}
                    disabled={actionLoading}
                    className="flex items-center gap-2 p-3 rounded-xl border border-gray-700/40 bg-gray-800/50 hover:border-indigo-500/40 hover:bg-gray-800/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="text-base">🏠</span>
                    <span className="text-[11px] font-bold text-gray-300">Richiedi residenza</span>
                  </button>
                )}
              </div>
            </CollapsibleSection>
          )}

          {regionalIndicesCard}

          {/* Actions removed by request */}
        </>
      )}
    </motion.div>
  );
};

export { CountryDetailView };
