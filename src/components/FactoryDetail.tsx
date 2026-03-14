/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, Warehouse, Users, Zap, DollarSign, ChevronUp, Loader2, ShoppingCart, BarChart3, Shield } from "lucide-react";
import { FACTORY_CONFIG, factoryYieldMultiplier, factoryStorageLimit } from "../types";

interface FactoryDetailProps {
  user: any;
  fetchData: () => void;
}

export default function FactoryDetail({ user, fetchData }: FactoryDetailProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [factory, setFactory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [upgradeTarget, setUpgradeTarget] = useState("");
  const [upgradeCost, setUpgradeCost] = useState<number | null>(null);
  const [salePrice, setSalePrice] = useState("");

  const load = async () => {
    try {
      const res = await fetch(`/api/factories/${id}`);
      if (res.ok) setFactory(await res.json());
      else navigate("/work");
    } catch { navigate("/work"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const fetchUpgradeCost = async (target: string) => {
    const targetNum = parseInt(target);
    if (!targetNum || !factory || targetNum <= factory.level || targetNum > FACTORY_CONFIG.MAX_LEVEL) {
      setUpgradeCost(null);
      return;
    }
    try {
      const res = await fetch(`/api/factories/upgrade-cost?currentLevel=${factory.level}&targetLevel=${targetNum}`);
      const data = await res.json();
      if (data.goldCost !== undefined) setUpgradeCost(data.goldCost);
      else setUpgradeCost(null);
    } catch { setUpgradeCost(null); }
  };

  const handleUpgrade = async () => {
    const target = parseInt(upgradeTarget || String((factory?.level || 1) + 1));
    if (!target || target <= factory.level || target > FACTORY_CONFIG.MAX_LEVEL) return;
    if (!window.confirm(`Vuoi potenziare al livello ${target}? Costo: 🪙 ${upgradeCost ?? '?'} Gold`)) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/factories/upgrade", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factoryId: id, targetLevel: target }),
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else { fetchData(); load(); setUpgradeTarget(""); setUpgradeCost(null); }
    } catch { alert("Errore"); } finally { setActionLoading(false); }
  };

  const handleListForSale = async () => {
    const price = parseInt(salePrice);
    if (!price || price <= 0) { alert("Inserisci un prezzo valido."); return; }
    if (!window.confirm(`Vuoi mettere in vendita la fabbrica per €${price.toLocaleString()}?`)) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/factory-market/list", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factoryId: id, askingPrice: price }),
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else { load(); setSalePrice(""); }
    } catch { alert("Errore"); } finally { setActionLoading(false); }
  };

  const handleCancelListing = async () => {
    if (!factory?.activeListing) return;
    if (!window.confirm("Vuoi rimuovere l'annuncio di vendita?")) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/factory-market/cancel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: factory.activeListing.id }),
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else load();
    } catch { alert("Errore"); } finally { setActionLoading(false); }
  };

  const handleWork = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/actions/work", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factoryId: id }),
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else {
        if (data.isGoldMine) {
          alert(`Hai lavorato! +€${data.earnings} +🪙${data.goldEarnings} Gold`);
        } else if (data.resourceOutput) {
          alert(`Hai lavorato! +${data.resourceOutput.player} risorse per te, ${data.resourceOutput.ownerCut} al proprietario`);
        } else {
          alert(`Hai lavorato! +€${data.earnings}`);
        }
        fetchData(); load();
      }
    } catch { alert("Errore"); } finally { setActionLoading(false); }
  };

  if (loading) return (
    <div className="flex justify-center items-center p-20">
      <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
    </div>
  );

  if (!factory) return null;

  const isOwner = factory.ownerUserId === user?.id;
  const typeDef = factory.typeDef || FACTORY_CONFIG.TYPES[factory.type] || {};
  const isGoldMine = typeDef.category === 'gold';
  const level = factory.level || 1;
  const yieldMult = factory.yieldMultiplier || factoryYieldMultiplier(level);
  const storageCap = factory.storageCapacity || factoryStorageLimit(factory.type, level);
  const storagePercent = factory.storagePercent || 0;
  const currentStorage = factory.currentStorage || 0;

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-24">
      {/* Back button */}
      <button onClick={() => navigate("/work")} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Torna alle Fabbriche
      </button>

      {/* ── Header ── */}
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-3xl flex items-center justify-center text-4xl shadow-inner ${isOwner ? 'bg-indigo-50' : 'bg-slate-50'}`}>
              {typeDef.icon || '🏭'}
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{factory.name}</h1>
              <p className="text-xs font-bold text-slate-400 uppercase mt-1">
                {typeDef.label || factory.type} • {factory.regionId}
              </p>
              <p className="text-xs font-bold text-slate-500 mt-1">
                CEO: <span className="text-indigo-600">{factory.ownerName}</span>
                {isOwner && <span className="ml-2 text-[9px] font-black uppercase text-white bg-indigo-500 px-2 py-0.5 rounded-lg">La Tua</span>}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-3xl font-black text-slate-900">Lv {level}</span>
            <div className="flex items-center gap-1 justify-end mt-1">
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ${factory.isActive !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {factory.isActive !== false ? '✅ Attiva' : '⛔ Inattiva'}
              </span>
            </div>
          </div>
        </div>
        {/* Badges */}
        <div className="flex flex-wrap gap-2 mt-4">
          <span className="text-[9px] font-black uppercase px-3 py-1 rounded-xl bg-amber-50 text-amber-700 border border-amber-100">
            {isGoldMine ? '🪙 Fabbrica d\'Oro (Valuta + Gold)' : `🪨 Fabbrica di ${typeDef.label || factory.type}`}
          </span>
          <span className="text-[9px] font-black uppercase px-3 py-1 rounded-xl bg-purple-50 text-purple-700 border border-purple-100">
            Rarità: {'⭐'.repeat(Math.min(typeDef.rarity || 1, 5))}{(typeDef.rarity || 1) > 5 ? `+${(typeDef.rarity || 1) - 5}` : ''}
          </span>
          <span className="text-[9px] font-black uppercase px-3 py-1 rounded-xl bg-blue-50 text-blue-700 border border-blue-100">
            Rendimento: x{yieldMult}
          </span>
        </div>
      </div>

      {/* ── Work Action ── */}
      <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-5 rounded-[2rem] shadow-lg text-white">
        <h3 className="text-sm font-black uppercase tracking-widest opacity-80 mb-3">
          <Zap className="w-4 h-4 inline mr-1" /> Lavora in questa fabbrica
        </h3>
        <div className="space-y-2 text-sm">
          {isGoldMine ? (
            <p className="font-bold">Guadagno: <span className="text-yellow-300">€{Math.floor(FACTORY_CONFIG.GOLD_MINE_MONEY_PER_WORK * yieldMult)}</span> + <span className="text-yellow-300">🪙 {Math.round(FACTORY_CONFIG.GOLD_MINE_GOLD_PER_WORK * yieldMult * 100) / 100} Gold</span></p>
          ) : factory.payMode === 'salary' ? (
            <p className="font-bold">Stipendio: <span className="text-yellow-300">€{factory.wage}</span> (dal budget aziendale)</p>
          ) : (
            <p className="font-bold">Ricompensa: <span className="text-yellow-300">{Math.floor(level * FACTORY_CONFIG.BASE_RESOURCE_OUTPUT)} {typeDef.label}</span></p>
          )}
          <p className="text-xs opacity-80">Costo energia: ⚡10 • Proprietario riceve: {Math.round(FACTORY_CONFIG.OWNER_PROFIT_RATE * 100)}% del lordo</p>
        </div>
        <button
          onClick={handleWork}
          disabled={actionLoading}
          className="mt-4 w-full py-3.5 bg-white text-indigo-700 rounded-2xl font-black uppercase text-sm shadow-md hover:bg-indigo-50 transition-all disabled:opacity-50"
        >
          {actionLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (isGoldMine ? '🪙 Lavora (€ + Gold)' : `💼 Lavora (-10⚡)`)}
        </button>
      </div>

      {/* ── Economy Section ── */}
      <div className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" /> Economia della Fabbrica
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Rendimento" value={`x${yieldMult}`} sub={`Lv ${level + 1} → x${factory.nextLevelYield}`} color="indigo" />
          <StatCard label="Valore Stimato" value={`€${(factory.estimatedValue || 0).toLocaleString()}`} color="amber" />
          <StatCard label="Lavoratori Totali" value={String(factory.totalWorkerCount || 0)} color="blue" />
          <StatCard label="Produzione Totale" value={(factory.totalProduction || 0).toLocaleString()} color="emerald" />
          <StatCard label="Profitto Proprietario" value={`€${(factory.totalOwnerProfit || 0).toLocaleString()}`} color="purple" />
          <StatCard label="Tasse Pagate" value={`€${(factory.totalTaxesPaid || 0).toLocaleString()}`} color="red" />
        </div>

        {/* Daily Economy Log */}
        {(factory.economyLogs || []).length > 0 && (
          <div className="mt-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Storico giornaliero (ultimi 7 giorni)</h4>
            <div className="space-y-1">
              {(factory.economyLogs || []).map((log: any, i: number) => (
                <div key={i} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl text-[10px] font-bold">
                  <span className="text-slate-500">{log.logDate}</span>
                  <span className="text-slate-600">👷 {log.workerCount}</span>
                  <span className="text-emerald-600">+€{(log.grossIncome || 0).toLocaleString()}</span>
                  <span className="text-red-500">-€{(log.taxesPaid || 0).toLocaleString()}</span>
                  <span className="text-purple-600">📦 {(log.production || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Storage Section ── */}
      {!isGoldMine && (
        <div className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
            <Warehouse className="w-4 h-4" /> Magazzino
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Capacità: {storageCap.toLocaleString()} unità</span>
            <span className="text-xs font-bold text-slate-500">Attuale: {currentStorage.toLocaleString()}</span>
          </div>
          <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${storagePercent > 90 ? 'bg-red-500' : storagePercent > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, storagePercent)}%` }}
            />
          </div>
          <div className="text-[10px] font-bold text-slate-400">
            {storagePercent}% pieno • +{(factory.storagePerLevel || 0).toLocaleString()} al prossimo livello (Lv {level + 1}: {(factory.nextLevelStorage || 0).toLocaleString()})
          </div>
          <div className="bg-slate-50 p-3 rounded-xl text-[10px] font-mono text-slate-500">
            Formula: storage = {(factory.storagePerLevel || 0).toLocaleString()} × livello = {(factory.storagePerLevel || 0).toLocaleString()} × {level} = {storageCap.toLocaleString()}
          </div>
        </div>
      )}

      {/* ── Recent Workers ── */}
      {(factory.recentWorkers || []).length > 0 && (
        <div className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-3">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
            <Users className="w-4 h-4" /> Lavoratori Recenti
          </h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {(factory.recentWorkers || []).map((w: any, i: number) => (
              <div key={i} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl text-[10px] font-bold">
                <span className="text-indigo-600">{w.workerName}</span>
                <span className="text-slate-400">{new Date(w.workedAt).toLocaleString('it-IT', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</span>
                {w.earningsMoney > 0 && <span className="text-emerald-600">+€{w.earningsMoney}</span>}
                {w.resourceAmount > 0 && <span className="text-blue-600">+{w.resourceAmount} {w.resourceType}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Upgrade Section (Owner only) ── */}
      {isOwner && (
        <div className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-amber-100 space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-amber-600 flex items-center gap-2">
            <ChevronUp className="w-4 h-4" /> Potenzia Fabbrica
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-amber-50 p-3 rounded-xl">
              <span className="font-black text-amber-800">Livello Attuale:</span>
              <span className="ml-2 font-black text-amber-600">{level}</span>
            </div>
            <div className="bg-indigo-50 p-3 rounded-xl">
              <span className="font-black text-indigo-800">Rendimento:</span>
              <span className="ml-2 font-black text-indigo-600">x{yieldMult} → x{factory.nextLevelYield}</span>
            </div>
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Livello Target (max {FACTORY_CONFIG.MAX_LEVEL})</label>
              <input
                type="number"
                min={level + 1}
                max={FACTORY_CONFIG.MAX_LEVEL}
                placeholder={`Lv ${level + 1}`}
                value={upgradeTarget}
                onChange={e => { setUpgradeTarget(e.target.value); fetchUpgradeCost(e.target.value); }}
                className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            {upgradeCost !== null && (
              <div className="text-sm font-black text-amber-600 pb-2.5">🪙 {upgradeCost} Gold</div>
            )}
          </div>
          <button
            onClick={handleUpgrade}
            disabled={actionLoading}
            className="w-full py-3.5 bg-amber-500 text-white rounded-2xl font-black uppercase text-sm shadow-lg shadow-amber-100 hover:bg-amber-600 transition-all disabled:opacity-50"
          >
            {actionLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : `⬆️ Potenzia ${upgradeTarget ? `al Lv ${upgradeTarget}` : `al Lv ${level + 1}`}`}
          </button>
        </div>
      )}

      {/* ── Market Section (Owner only) ── */}
      {isOwner && (
        <div className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-emerald-100 space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" /> Mercato
          </h3>
          <div className="bg-emerald-50 p-3 rounded-xl text-xs font-bold text-emerald-700">
            Valore stimato: €{(factory.estimatedValue || 0).toLocaleString()}
          </div>
          {factory.activeListing ? (
            <div className="space-y-3">
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                <p className="text-xs font-black text-amber-800">🏷️ In vendita a €{factory.activeListing.askingPrice?.toLocaleString()}</p>
                <p className="text-[10px] text-amber-600 mt-1">Pubblicato il {new Date(factory.activeListing.listedAt).toLocaleDateString('it-IT')}</p>
              </div>
              <button
                onClick={handleCancelListing}
                disabled={actionLoading}
                className="w-full py-3 bg-red-500 text-white rounded-2xl font-black uppercase text-xs hover:bg-red-600 transition-all disabled:opacity-50"
              >
                ❌ Rimuovi Annuncio
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <input
                type="number"
                min={1}
                placeholder="Prezzo di vendita..."
                value={salePrice}
                onChange={e => setSalePrice(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                onClick={handleListForSale}
                disabled={actionLoading || !salePrice}
                className="w-full py-3 bg-emerald-500 text-white rounded-2xl font-black uppercase text-xs shadow-md hover:bg-emerald-600 transition-all disabled:opacity-50"
              >
                🏷️ Metti in Vendita
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
    red: 'bg-red-50 text-red-700 border-red-100',
  };
  return (
    <div className={`p-3 rounded-2xl border ${colorMap[color] || colorMap.indigo}`}>
      <span className="text-[9px] font-black uppercase tracking-wider opacity-70">{label}</span>
      <p className="text-lg font-black">{value}</p>
      {sub && <p className="text-[9px] font-bold opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}
