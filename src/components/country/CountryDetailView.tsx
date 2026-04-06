import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "motion/react";
import { Globe, Loader2, AlertCircle, Info, Crown, Briefcase, Pickaxe, RefreshCcw } from "lucide-react";
import { NationalFlag } from "../ui";
import { RESOURCE_ICONS, RESOURCE_NAMES } from "../../constants";
import { RegionResourcesTab } from "../resources/RegionResourcesTab";
import { RechargeResourcePanel } from "../resources/RechargeResourcePanel";
import { DeepExplorationPanel } from "../resources/DeepExplorationPanel";
import { GovernmentView } from "../GovernmentView";

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

  const fetchRegionParties = async () => {
    try {
      const res = await fetch(`/api/parties?regionId=${iso2?.toUpperCase()}`);
      if (res.ok) {
        setRegionParties(await res.json());
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
  const handleRefillExtraction = async (resourceType: string) => {
    if (!iso2) return;
    if (!confirm(`Vuoi ripristinare il limite di ${resourceType}? Costo: 100 Gold.`)) return;
    try {
      const res = await fetch(`/api/regions/${iso2.toUpperCase()}/refill-extraction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceType }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Errore durante il ripristino");
      } else {
        fetchAutonomyData();
        fetchData();
      }
    } catch (e) {
      console.error(e);
      alert("Errore di connessione");
    }
  };


  useEffect(() => {
    fetchCountryDetail();
    fetchAgreements();
    fetchSanctions();
    fetchRegionFactories();
    fetchRegionParties();
    fetchAutonomyData();
    fetch('/api/regions')
      .then(r => r.json())
      .then((data: any[]) => setAllRegions(data.map((r: any) => ({ id: r.id, name: r.name }))));
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

  const leaderAvatar = region.leaderAvatarData || region.leader?.avatarData || null;
  const leaderInitial = (region.leaderName || 'L').trim().charAt(0).toUpperCase();

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
  const canManageMigration = user?.id === region.ownerUserId || user?.id === region.foreignMinisterId;

  const regionalIndicesCard = autonomyData?.indices ? (
    <div className="bg-slate-900 p-6 rounded-[2.5rem] shadow-sm border border-slate-700">
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
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Residenti</p>
                <p className="text-xl font-black">{region.residentCount ?? 0}</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-3xl text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Partiti</p>
                <p className="text-xl font-black">{regionParties.length}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-3xl text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fabbriche</p>
                <p className="text-xl font-black">{regionFactories.length}</p>
              </div>

              {regionParties.length > 0 && (
                <div className="col-span-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Lista Partiti</p>
                  <div className="flex flex-wrap gap-1.5">
                    {regionParties.map((p: any) => (
                      <span
                        key={p.id}
                        className="text-[10px] font-black px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg"
                      >
                        {p.tag ? `[${p.tag}] ` : ''}{p.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

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

        </div>
      </div>

      {activeTab === 'government' ? (
        <div className="space-y-4 px-4">
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
              <h3 className="text-lg font-black uppercase text-indigo-900 mb-4 flex items-center gap-2">
                <Crown className="w-5 h-5 text-indigo-600" /> Capo di Stato
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
                    className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center overflow-hidden cursor-pointer"
                    title="Apri profilo"
                    aria-label="Apri profilo"
                  >
                    {leaderAvatar ? (
                      <img src={leaderAvatar} alt={region.leaderName || 'Leader'} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-black text-indigo-700">{leaderInitial}</span>
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
                      className="text-sm font-black text-slate-900 cursor-pointer"
                      title="Apri profilo"
                      aria-label="Apri profilo"
                    >
                      {region.leaderName || 'Leader dello Stato'}
                    </p>
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
          <GovernmentView region={region} currentUser={user} onUpdate={fetchCountryDetail} />
        </div>
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
                  {Object.entries(regionalBuildingsForDisplay).filter(([_, qty]) => (qty as number) > 0).length > 0 ? (
                    Object.entries(regionalBuildingsForDisplay)
                      .sort(([, a], [, b]) => (b as number) - (a as number))
                      .map(([bt, qty]) => {
                        const icons: Record<string, string> = { hospital: '🏥', military_base: '🏛️', school: '🏫', military_academy: '🎖️', missile_system: '🚀', airport: '✈️', naval_port: '⚓', space_port: '🛸', real_estate_fund: '🏘️', power_plant: '⚡', factory: '🏭' };
                        const labels: Record<string, string> = { hospital: 'Ospedali', military_base: 'Basi Militari', school: 'Scuole', military_academy: 'Accademie Militari', missile_system: 'Sistemi Missilistici', airport: 'Aeroporti', naval_port: 'Porti Navali', space_port: 'Porti Spaziali', real_estate_fund: 'Fondi Immobiliari', power_plant: 'Centrali Elettriche', factory: 'Fabbriche' };
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
                          <button
                            onClick={() => handleRefillExtraction(res.key)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-emerald-400 transition-all active:scale-95 group/btn"
                            title="Ripristina limite (100 Gold)"
                          >
                            <span className="text-[11px] font-black tabular-nums">{res.data.remaining.toLocaleString()}</span>
                            <RefreshCcw className="w-3 h-3 transition-transform group-hover/btn:rotate-180 duration-500" />
                          </button>
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
                        Prossimo reset: {new Date(autonomyData.extraction.nextResetAt).toLocaleString('it-IT')}
                      </p>
                    </div>
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
          {/* Azioni */}
          {user && (
            <div className="bg-slate-900 p-6 rounded-[2.5rem] shadow-sm border border-slate-700">
              <h3 className="text-lg font-black uppercase tracking-tight text-slate-100 mb-4">Azioni</h3>
              <div className="flex flex-col gap-3">
                {user.regionId === region.id ? (
                  <div className="w-full py-3 bg-slate-800 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 border border-slate-700 cursor-default">
                    ✈️ Sei già in questa regione
                  </div>
                ) : (
                  <button
                    onClick={() => handleImmigrationAction('/api/actions/travel', { regionId: region.id })}
                    disabled={actionLoading}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ✈️ Spostati in questa regione
                  </button>
                )}
                {user.residenceId === region.id ? (
                  <div className="w-full py-3 bg-slate-800 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 border border-slate-700 cursor-default">
                    🏠 Sei già residente in questa regione
                  </div>
                ) : (
                  <button
                    onClick={() => handleImmigrationAction('/api/actions/apply', { regionId: region.id, type: 'residence' })}
                    disabled={actionLoading}
                    className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    🏠 Richiedi la residenza in questa regione
                  </button>
                )}
              </div>
            </div>
          )}

          {regionalIndicesCard}

          {/* Factories */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-4">
            <h3 className="text-lg font-black uppercase tracking-tight">Strutture Presenti</h3>
            {regionFactories.length > 0 ? (
              <div className="space-y-3">
                {regionFactories.map((f) => {
                  const factoryIdentifier = f.id || f.slug || f.factoryId;
                  const openFactoryDetail = () => {
                    if (!factoryIdentifier) return;
                    navigate(`/factory/${factoryIdentifier}`);
                  };
                  return (
                  <div
                    key={factoryIdentifier || f.name}
                    role="button"
                    tabIndex={factoryIdentifier ? 0 : -1}
                    onClick={openFactoryDetail}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openFactoryDetail();
                      }
                    }}
                    className="flex items-center gap-3 p-4 bg-indigo-50 rounded-2xl border border-indigo-100 cursor-pointer"
                    aria-label={factoryIdentifier ? `Apri fabbrica ${f.name}` : undefined}
                    title={factoryIdentifier ? "Apri dettagli fabbrica" : undefined}
                  >
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
                )})}
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                <p className="text-slate-400 font-bold italic">Nessuna fabbrica costruita</p>
              </div>
            )}
          </div>

          {/* Actions removed by request */}
        </>
      )}
    </motion.div>
  );
};

export { CountryDetailView };
