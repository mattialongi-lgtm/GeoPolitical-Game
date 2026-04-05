/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, Warehouse, Users, Zap, DollarSign, ChevronUp, Loader2, ShoppingCart, BarChart3, Shield, Info, Pickaxe, ChevronDown, Download } from "lucide-react";
import { FACTORY_CONFIG, EXTRACTION_CONFIG, RESOURCE_LABELS, RESOURCE_ICONS_MAP, factoryYieldMultiplier, factoryStorageLimit } from "../types";
import type { ResourceType } from "../types";

/** Round to 2 decimal places for display */
const r2 = (n: number) => Math.round(n * 100) / 100;

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
  const [extractionBreakdown, setExtractionBreakdown] = useState<any>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [extractionLoading, setExtractionLoading] = useState(false);

  const load = async () => {
    try {
      const res = await fetch(`/api/factories/${id}`);
      if (res.ok) setFactory(await res.json());
      else navigate("/work");
    } catch { navigate("/work"); }
    finally { setLoading(false); }
  };

  const loadExtractionBreakdown = async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/extraction/breakdown?factoryId=${id}`, { cache: "no-store" });
      const data = res.ok ? await res.json() : null;
      if (data) setExtractionBreakdown(data);
    } catch { }
  };

  useEffect(() => { load(); }, [id]);

  // Load extraction breakdown preview when factory data is available
  useEffect(() => {
    if (!factory || !id) return;
    const typeDef = FACTORY_CONFIG.TYPES[factory.type];
    if (!typeDef?.resource) {
      setExtractionBreakdown(null);
      return;
    }
    loadExtractionBreakdown();
  }, [factory?.id, factory?.level, id]);

  useEffect(() => {
    if (!factory || !id) return;
    const typeDef = FACTORY_CONFIG.TYPES[factory.type];
    if (!typeDef?.resource) return;

    const refresh = () => { loadExtractionBreakdown(); };
    const intervalId = window.setInterval(refresh, 30000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [factory?.id, id]);

  const handleExtract = async () => {
    setExtractionLoading(true);
    try {
      const res = await fetch("/api/extraction/work", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factoryId: id }),
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else {
        const rt = data.resourceType as ResourceType;
        const label = RESOURCE_LABELS[rt] || data.resourceType;
        const icon = RESOURCE_ICONS_MAP[rt] || '📦';
        let msg = `${icon} Estratto: +${data.amount} ${label}`;
        if (data.moneyGenerated > 0) msg += ` (+€${data.moneyGenerated} valuta)`;
        msg += `\n⚡ Energia: -${data.energyCost}`;
        msg += `\n📊 EXP lavoro: ${data.workExperience}`;
        if (data.goldGenerated > 0) msg += ` (+${data.goldGenerated} Gold premium)`;
        alert(msg);
        fetchData();
        await load();
        await loadExtractionBreakdown();
      }
    } catch { alert("Errore durante l'estrazione."); }
    finally { setExtractionLoading(false); }
  };

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

  const [withdrawing, setWithdrawing] = useState(false);
  const handleWithdraw = async () => {
    if (currentStorage <= 0) return;
    setWithdrawing(true);
    try {
      const res = await fetch(`/api/factories/${id}/withdraw`, {
        method: "POST", headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else {
        alert(`${RESOURCE_ICONS_MAP[data.item as ResourceType] || '📦'} Hai ritirato ${data.amount} ${RESOURCE_LABELS[data.item as ResourceType] || data.item} dal magazzino.`);
        fetchData(); load();
      }
    } catch { alert("Errore durante il ritiro."); }
    finally { setWithdrawing(false); }
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
        const expMsg = data.workExpGain ? `\n📊 EXP lavoro: +${data.workExpGain}` : '';
        if (data.isGoldMine) {
          alert(`Hai lavorato! +€${data.earnings} +🪙${data.goldEarnings} Gold${expMsg}`);
        } else if (data.resourceOutput) {
          alert(`Hai lavorato! +${data.resourceOutput.player} risorse per te, ${data.resourceOutput.ownerCut} al proprietario${expMsg}`);
        } else {
          alert(`Hai lavorato! +€${data.earnings}${expMsg}`);
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
  const goldBaseReward = Math.max(1, Math.floor(Number(extractionBreakdown?.breakdown?.goldBaseReward ?? EXTRACTION_CONFIG.GOLD_BASE_REWARD_PER_DIG ?? 30)));
  const goldHealthMultiplier = Math.max(1, Number(extractionBreakdown?.breakdown?.goldHealthMultiplier ?? 1));
  const goldHealthIndex = Math.max(1, Number(extractionBreakdown?.breakdown?.regionHealthIndex ?? 1));
  const goldRewardPreview = Math.max(goldBaseReward, Math.floor(Number(extractionBreakdown?.breakdown?.goldGenerated ?? Math.round(goldBaseReward * goldHealthMultiplier))));

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
            <p className="font-bold">Guadagno: <span className="text-yellow-300">€{Math.floor(FACTORY_CONFIG.GOLD_MINE_MONEY_PER_WORK * yieldMult)}</span> + <span className="text-yellow-300">🪙 {goldRewardPreview} Gold</span></p>
          ) : factory.payMode === 'salary' ? (
            <p className="font-bold">Stipendio: <span className="text-yellow-300">€{factory.wage}</span> (dal budget aziendale)</p>
          ) : (
            <p className="font-bold">Ricompensa: <span className="text-yellow-300">{Math.floor(level * FACTORY_CONFIG.BASE_RESOURCE_OUTPUT)} {typeDef.label}</span></p>
          )}
          {isGoldMine ? (
            <p className="text-xs opacity-80">Salute regione: {goldHealthIndex.toFixed(1)} • Gold base: {goldBaseReward} • Moltiplicatore salute: x{r2(goldHealthMultiplier)}</p>
          ) : (
            <p className="text-xs opacity-80">Questa estrazione consuma energia e non restituisce gold premium.</p>
          )}
          <p className="text-xs opacity-80">Costo energia: ⚡300 • Proprietario riceve: {Math.round(FACTORY_CONFIG.OWNER_PROFIT_RATE * 100)}% del lordo</p>
        </div>
        <button
          onClick={handleWork}
          disabled={actionLoading}
          className="mt-4 w-full py-3.5 bg-white text-indigo-700 rounded-2xl font-black uppercase text-sm shadow-md hover:bg-indigo-50 transition-all disabled:opacity-50"
        >
          {actionLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (isGoldMine ? '🪙 Lavora (€ + Gold)' : `💼 Lavora (-300⚡)`)}
        </button>
      </div>

      {/* ── Extraction System Section ── */}
      {extractionBreakdown && (
        <div className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-emerald-100 space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2">
            <Pickaxe className="w-4 h-4" /> Sistema di Estrazione Avanzato
          </h3>

          {/* Quick Preview */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
              <span className="text-[9px] font-black uppercase tracking-wider text-emerald-500">Produttività Stimata</span>
              <p className="text-lg font-black text-emerald-700">
                {RESOURCE_ICONS_MAP[extractionBreakdown.breakdown?.resourceType as ResourceType] || '📦'} {r2(extractionBreakdown.breakdown?.playerAmount || 0)}
              </p>
              <p className="text-[9px] font-bold text-emerald-500">{RESOURCE_LABELS[extractionBreakdown.breakdown?.resourceType as ResourceType] || extractionBreakdown.factoryType}</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100">
              <span className="text-[9px] font-black uppercase tracking-wider text-blue-500">Costo Energia</span>
              <p className="text-lg font-black text-blue-700">⚡ {extractionBreakdown.energyCost}</p>
              <p className="text-[9px] font-bold text-blue-500">Energia disponibile: {user?.energy || 0}</p>
            </div>
            {extractionBreakdown.breakdown?.moneyGenerated > 0 && (
              <div className="bg-amber-50 p-3 rounded-2xl border border-amber-100">
                <span className="text-[9px] font-black uppercase tracking-wider text-amber-500">Valuta Generata</span>
                <p className="text-lg font-black text-amber-700">€{Math.round(extractionBreakdown.breakdown.moneyGenerated)}</p>
                <p className="text-[9px] font-bold text-amber-500">Dall'oro estratto</p>
              </div>
            )}
            {extractionBreakdown.breakdown?.goldGenerated > 0 && (
              <div className="bg-yellow-50 p-3 rounded-2xl border border-yellow-100">
                <span className="text-[9px] font-black uppercase tracking-wider text-yellow-600">Gold da Scavata</span>
                <p className="text-lg font-black text-yellow-700">🪙 {Math.round(extractionBreakdown.breakdown.goldGenerated)}</p>
                <p className="text-[9px] font-bold text-yellow-600">Base {Math.round(extractionBreakdown.breakdown.goldBaseReward || 0)} • Salute x{r2(extractionBreakdown.breakdown.goldHealthMultiplier || 1)}</p>
              </div>
            )}
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">EXP Lavorativa</span>
              <p className="text-lg font-black text-slate-700">📊 {extractionBreakdown.workExperience || 0}</p>
              <p className="text-[9px] font-bold text-slate-400">{RESOURCE_LABELS[extractionBreakdown.breakdown?.resourceType as ResourceType] || ''}</p>
            </div>
          </div>

          {/* Region Resource Status */}
          <div className="bg-slate-50 p-3 rounded-xl space-y-2">
            <div className="flex justify-between text-[10px] font-bold text-slate-500">
              <span>Cap Regionale</span>
              <span>{extractionBreakdown.breakdown?.regionCapTotal || 0} (base: {extractionBreakdown.breakdown?.regionCapMax || 0}{extractionBreakdown.breakdown?.regionDeepBonus > 0 ? ` + ${extractionBreakdown.breakdown.regionDeepBonus} deep` : ''})</span>
            </div>
            <div className="flex justify-between text-[10px] font-bold text-slate-500">
              <span>Residuo disponibile oggi</span>
              <span className={extractionBreakdown.breakdown?.regionResidualToday <= 0 ? 'text-red-500' : 'text-emerald-600'}>
                {extractionBreakdown.breakdown?.regionResidualToday || 0}
              </span>
            </div>
            <div className="flex justify-between text-[10px] font-bold text-slate-500">
              <span>Consumo regionale previsto</span>
              <span>{r2(extractionBreakdown.breakdown?.withdrawnPoints || 0)} punti</span>
            </div>
          </div>

          {/* Payout Distribution */}
          <div className="bg-slate-50 p-3 rounded-xl space-y-1">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Distribuzione Payout</p>
            <div className="flex justify-between text-[10px] font-bold">
              <span className="text-slate-500">Lordo estratto</span>
              <span className="text-slate-700">{r2(extractionBreakdown.breakdown?.grossAmount || 0)}</span>
            </div>
            <div className="flex justify-between text-[10px] font-bold">
              <span className="text-emerald-600">→ Al giocatore</span>
              <span className="text-emerald-700">{r2(extractionBreakdown.breakdown?.playerAmount || 0)}</span>
            </div>
            <div className="flex justify-between text-[10px] font-bold">
              <span className="text-purple-600">→ Al proprietario</span>
              <span className="text-purple-700">{r2(extractionBreakdown.breakdown?.ownerAmount || 0)}</span>
            </div>
            <div className="flex justify-between text-[10px] font-bold">
              <span className="text-red-500">→ Tasse</span>
              <span className="text-red-600">{r2(extractionBreakdown.breakdown?.taxAmount || 0)}</span>
            </div>
            {(extractionBreakdown.breakdown?.autonomyAmount || 0) > 0 && (
              <div className="flex justify-between text-[10px] font-bold">
                <span className="text-orange-500">→ Autonomia</span>
                <span className="text-orange-600">{r2(extractionBreakdown.breakdown.autonomyAmount)}</span>
              </div>
            )}
          </div>

          {/* Breakdown Toggle */}
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="w-full flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <Info className="w-3 h-3" />
            {showBreakdown ? 'Nascondi Dettagli Formula' : 'Mostra Dettagli Formula'}
            {showBreakdown ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {showBreakdown && extractionBreakdown.breakdown && (
            <div className="bg-indigo-50 p-4 rounded-xl space-y-2 border border-indigo-100">
              <p className="text-[10px] font-black uppercase text-indigo-500 mb-2">📐 Breakdown Formula Produttività</p>
              <div className="space-y-1 text-[10px] font-mono text-indigo-800">
                <p>Produttività = {EXTRACTION_CONFIG.BASE_COEFFICIENT} × (LvGiocatore^{EXTRACTION_CONFIG.PLAYER_LEVEL_EXPONENT}) × (CoeffRisorsa/{EXTRACTION_CONFIG.RESOURCE_COEFF_DIVISOR})^{EXTRACTION_CONFIG.RESOURCE_COEFF_EXPONENT} × (LvFabbrica^{EXTRACTION_CONFIG.FACTORY_LEVEL_EXPONENT}) × (1 + EXP/{EXTRACTION_CONFIG.WORK_EXPERIENCE_MULTIPLIER_DIVISOR})</p>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <BreakdownRow label="Livello Giocatore" value={extractionBreakdown.breakdown.playerLevel} />
                <BreakdownRow label="Livello Fabbrica" value={extractionBreakdown.breakdown.factoryLevel} />
                <BreakdownRow label="Esperienza Lavoro" value={extractionBreakdown.breakdown.workExperience} />
                <BreakdownRow label="Moltiplicatore EXP" value={`×${r2(extractionBreakdown.breakdown.experienceMultiplier || 1)}`} />
                <BreakdownRow label="Coeff. Risorsa" value={r2(extractionBreakdown.breakdown.resourceCoefficient)} />
                <BreakdownRow label="Produttività Base" value={r2(extractionBreakdown.breakdown.baseProductivity)} />
                <BreakdownRow label="Bonus Nazione" value={`×${extractionBreakdown.breakdown.nationBonus}`} />
                <BreakdownRow label="Bonus Dipartimento" value={`×${extractionBreakdown.breakdown.departmentBonus}`} />
                <BreakdownRow label="Moltiplicatore Bilanciamento" value={`×${extractionBreakdown.breakdown.balancingMultiplier}`} />
              </div>
              <div className="mt-3 p-2 bg-white rounded-lg">
                <p className="text-[11px] font-black text-indigo-700">
                  Produttività Finale: {r2(extractionBreakdown.breakdown.finalProductivity)}
                </p>
              </div>
              <div className="mt-2 text-[9px] text-indigo-500 space-y-1">
                <p>💡 Livello più alto = più risorse estratte</p>
                <p>🏭 Fabbrica di livello superiore = maggiore produttività per lavoro</p>
                <p>📊 Più esperienza sulla risorsa = rendimento crescente</p>
                <p>🌍 Il coeff. risorsa dipende dal potenziale della regione</p>
              </div>
            </div>
          )}

          {/* Extract Button */}
          <button
            onClick={handleExtract}
            disabled={extractionLoading || !extractionBreakdown.canWork}
            className="w-full py-3.5 bg-emerald-500 text-white rounded-2xl font-black uppercase text-sm shadow-lg shadow-emerald-100 hover:bg-emerald-600 transition-all disabled:opacity-50"
          >
            {extractionLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : `⛏️ Estrai Risorse (-${extractionBreakdown.energyCost}⚡)`}
          </button>
          {!extractionBreakdown.canWork && (
            <p className="text-[10px] font-bold text-red-500 text-center">
              {(user?.energy || 0) < extractionBreakdown.energyCost ? 'Energia insufficiente' : 'Risorsa esaurita per oggi'}
            </p>
          )}
        </div>
      )}

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

          {isOwner && currentStorage > 0 && (
            <button
              onClick={handleWithdraw}
              disabled={withdrawing}
              className="w-full mt-2 py-3 bg-indigo-50 text-indigo-700 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-indigo-100 transition-all disabled:opacity-50"
            >
              {withdrawing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Ritira Risorse nel Magazzino Personale
            </button>
          )}

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

function BreakdownRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white p-2 rounded-lg flex justify-between items-center">
      <span className="text-[9px] font-bold text-indigo-500">{label}</span>
      <span className="text-[10px] font-black text-indigo-800">{value}</span>
    </div>
  );
}
