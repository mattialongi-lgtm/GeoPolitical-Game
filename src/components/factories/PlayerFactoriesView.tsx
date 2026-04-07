import React, { useState, useEffect } from "react";
import { Globe, Plus, Loader2, Search } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { FACTORY_CONFIG } from "../../types";
import { RESOURCE_ICONS, RESOURCE_NAMES } from "../../constants";

const FACTORY_CREATE_COST = FACTORY_CONFIG.CREATE_COST;

export const PlayerFactoriesView = ({
  user,
  fetchData,
  autoWorkFactoryId,
  setAutoWorkFactoryId
}: {
  user: any;
  fetchData: () => void;
  autoWorkFactoryId?: string | null;
  setAutoWorkFactoryId?: (id: string | null) => void;
}) => {
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
        if (data.payMode === 'gold') {
          const healthInfo = Number.isFinite(Number(data.regionHealthIndex))
            ? ` Salute regione: ${Number(data.regionHealthIndex).toFixed(1)} (x${Number(data.goldHealthMultiplier || 1).toFixed(2)}).`
            : '';
          alert(`Hai lavorato! +$${data.earnings} e +${data.goldEarnings} Gold. Tasse: $${data.taxes || 0}.${healthInfo}`);
        } else if (data.payMode === 'resource') {
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
        <h3 className="text-xl font-black tracking-tight uppercase text-white">Fabbriche Locali</h3>
        <button
          onClick={() => setCreating(!creating)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-indigo-900/30 hover:scale-105 transition-all"
        >
          {creating ? "Annulla" : <><Plus className="w-4 h-4" /> Fonda Azienda</>}
        </button>
      </div>

      {/* Factory search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={factorySearch}
          onChange={e => setFactorySearch(e.target.value)}
          placeholder="Cerca fabbrica..."
          className="w-full pl-11 pr-4 py-3 rounded-2xl bg-gray-800/60 border border-gray-700/40 text-gray-100 focus:ring-4 focus:ring-indigo-500/20 outline-none text-sm font-bold"
        />
      </div>

      {/* Scope buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowWorldFactories(false)}
          className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!showWorldFactories ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-800/50 text-gray-400 border border-gray-700/40'}`}
        >
          Fabbriche in {user.regionId}
        </button>
        <button
          onClick={() => setShowWorldFactories(true)}
          className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${showWorldFactories ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-800/50 text-gray-400 border border-gray-700/40'}`}
        >
          🌍 Fabbriche nel mondo
        </button>
      </div>

      {showWorldFactories && (
        <div className="bg-gray-900/60 p-8 rounded-2xl text-center border border-dashed border-gray-700/50 space-y-4">
          <Globe className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 font-bold text-sm">Esplora le fabbriche di tutto il mondo</p>
          <button
            onClick={() => navigate('/world-factories')}
            className="px-6 py-3 bg-emerald-500 text-white rounded-2xl font-black uppercase text-xs shadow-md hover:bg-emerald-600 transition-all"
          >
            🌍 Lista Fabbriche
          </button>
        </div>
      )}

      {creating && (
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-6 rounded-2xl shadow-lg text-white space-y-4">
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
        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-indigo-400 w-8 h-8" /></div>
      ) : !showWorldFactories && factories.length === 0 ? (
        <div className="bg-gray-900/60 p-10 rounded-2xl text-center border border-dashed border-gray-700/50">
          <span className="text-4xl">🏗️</span>
          <p className="text-gray-400 font-bold text-sm mt-3">Nessuna fabbrica in questa regione. Sii il primo ad investire qui!</p>
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
            const isGoldFactory = f.type === 'gold';
            const needsBudget = !isResourceMode && f.budget < f.wage;

            return (
              <div key={f.id} className={`bg-gray-900/60 p-5 rounded-2xl border ${isOwner ? "border-indigo-500/30" : "border-gray-800"} space-y-4`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-3xl flex items-center justify-center text-3xl ${isOwner ? "bg-indigo-500/10 border border-indigo-500/20" : "bg-gray-800/60 border border-gray-700/40"}`}>
                      {RESOURCE_ICONS[f.type] || "🏭"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-white text-lg leading-none tracking-tight">{f.name}</h4>
                        {isOwner && <span className="text-[9px] font-black uppercase text-white bg-indigo-500 px-2 py-0.5 rounded-lg shadow-sm">La Tua Azienda</span>}
                      </div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">
                        Estrazione <span className="text-gray-300">{RESOURCE_NAMES[f.type]}</span> • CEO <span className="text-indigo-400">{f.ownerName}</span>
                        {isResourceMode ? <span className="ml-2 text-emerald-400">• Modalità Risorse</span> : <span className="ml-2 text-amber-400">• Stipendio Fisso</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-2xl font-black text-white">Lv {f.level}</span>
                    <span className="text-[9px] font-black uppercase text-indigo-400 tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">{f.exp} XP</span>
                  </div>
                </div>

                {isResourceMode ? (
                  <div className="bg-emerald-500/10 p-3 rounded-2xl flex items-center justify-between border border-emerald-400/30">
                    <span className="text-[10px] font-black uppercase text-emerald-400">Modalità</span>
                    {isGoldFactory ? (
                      <span className="text-xs font-black text-emerald-400">🪙 Scava Oro: cash + gold (gold aumenta con la salute regione)</span>
                    ) : (
                      <span className="text-xs font-black text-emerald-400">🪨 Scava {RESOURCE_NAMES[f.type]} (nessun gold premium)</span>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 pb-4 border-b border-gray-700/40">
                    <div className="bg-emerald-500/10 p-3 rounded-2xl flex items-center justify-between border border-emerald-400/30">
                      <span className="text-[10px] font-black uppercase text-emerald-400">Salario Offerto</span>
                      <span className="text-sm font-black text-emerald-400">${f.wage}</span>
                    </div>
                    <div className={`${needsBudget ? 'bg-rose-500/10 border-rose-400/30' : 'bg-gray-800/50 border-gray-700/30'} p-3 rounded-2xl flex items-center justify-between border`}>
                      <span className={`text-[10px] font-black uppercase ${needsBudget ? 'text-rose-400' : 'text-gray-400'}`}>Budget Aziendale</span>
                      <span className={`text-sm font-black ${needsBudget ? 'text-rose-400' : 'text-gray-200'}`}>${f.budget}</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleWork(f.id)}
                    disabled={actionLoading || needsBudget}
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg shadow-indigo-900/30 hover:bg-indigo-700 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none"
                  >
                    {isResourceMode
                      ? (isGoldFactory ? `🪙 Scava Oro (+cash +gold, -300⚡)` : `🪨 Scava ${RESOURCE_NAMES[f.type]} (-300⚡, no gold)`)
                      : '💼 Lavora Qui (-300⚡)'}
                  </button>
                  <button
                    onClick={() => navigate(`/factory/${f.id}`)}
                    className="py-3 px-4 bg-gray-800/50 text-gray-300 rounded-2xl font-black uppercase text-xs hover:bg-gray-700/50 transition-all border border-gray-700/40"
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
                        title="Attiva lavoro automatico per 24 ore"
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
                        className={`flex-1 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${!isResourceMode ? 'bg-amber-500 text-white' : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 border border-gray-700/40'}`}
                      >
                        💰 Stipendio Fisso
                      </button>
                      <button
                        onClick={() => handlePayMode(f.id, 'resource')}
                        disabled={actionLoading || isResourceMode}
                        className={`flex-1 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${isResourceMode ? 'bg-emerald-500 text-white' : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 border border-gray-700/40'}`}
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
                            className="w-full bg-gray-800/60 border border-gray-700/40 text-gray-100 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
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
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">⬆️ Potenzia Fabbrica</label>
                        <div className="flex gap-2 items-center">
                          <span className="text-xs font-bold text-gray-300 whitespace-nowrap">Lv {f.level || 1} →</span>
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
                            className="w-24 bg-gray-800/60 border border-gray-700/40 text-gray-100 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                          />
                          {upgradeCost[f.id] != null && (
                            <span className="text-xs font-bold text-amber-400">🪙 {upgradeCost[f.id]} Gold</span>
                          )}
                        </div>
                        <button
                          onClick={() => handleUpgrade(f.id, f.level || 1)}
                          disabled={actionLoading}
                          className="w-full py-3 bg-amber-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-md shadow-amber-900/30 hover:bg-amber-600 hover:scale-[1.02] transition-all disabled:opacity-50"
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
