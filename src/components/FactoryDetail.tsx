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
      <button onClick={() => navigate("/work")} className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-indigo-400 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Torna alle Fabbriche
      </button>

      {/* ── Header ── */}
      <div className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-4xl border border-gray-700/40 ${isOwner ? 'bg-indigo-500/10' : 'bg-gray-800/60'}`}>
              {typeDef.icon || '🏭'}
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">{factory.name}</h1>
              <p className="text-xs font-bold text-gray-400 uppercase mt-1">
                {typeDef.label || factory.type} • {factory.regionId}
              </p>
              <p className="text-xs font-bold text-gray-400 mt-1">
                CEO: <span className="text-indigo-400">{factory.ownerName}</span>
                {isOwner && <span className="ml-2 text-[9px] font-black uppercase text-white bg-indigo-500 px-2 py-0.5 rounded-lg">La Tua</span>}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-3xl font-black text-white">Lv {level}</span>
            <div className="flex items-center gap-1 justify-end mt-1">
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ${factory.isActive !== false ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                {factory.isActive !== false ? '✅ Attiva' : '⛔ Inattiva'}
              </span>
            </div>
          </div>
        </div>
        {/* Badges */}
        <div className="flex flex-wrap gap-2 mt-4">
          <span className="text-[9px] font-black uppercase px-3 py-1 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-400/30">
            {isGoldMine ? '🪙 Fabbrica d\'Oro (Valuta + Gold)' : `🪨 Fabbrica di ${typeDef.label || factory.type}`}
          </span>
          <span className="text-[9px] font-black uppercase px-3 py-1 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            Rarità: {'⭐'.repeat(Math.min(typeDef.rarity || 1, 5))}{(typeDef.rarity || 1) > 5 ? `+${(typeDef.rarity || 1) - 5}` : ''}
          </span>
          <span className="text-[9px] font-black uppercase px-3 py-1 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Rendimento: x{yieldMult}
          </span>
        </div>
      </div>

      {/* ── Work Action ── */}
      <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-5 rounded-2xl shadow-lg text-white">
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
          className="mt-4 w-full py-3.5 bg-white/10 text-white rounded-2xl font-black uppercase text-sm hover:bg-white/20 transition-all disabled:opacity-50"
        >
          {actionLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (isGoldMine ? '🪙 Lavora (€ + Gold)' : `💼 Lavora (-300⚡)`)}
        </button>
      </div>

      {/* ── Extraction System Section ── */}
      {extractionBreakdown && (
        <div className="bg-gray-900/60 p-5 rounded-2xl border border-gray-800 space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
            <Pickaxe className="w-4 h-4" /> Sistema di Estrazione Avanzato
          </h3>

          {/* Quick Preview */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20">
              <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400">Produttività Stimata</span>
              <p className="text-lg font-black text-emerald-400">
                {RESOURCE_ICONS_MAP[extractionBreakdown.breakdown?.resourceType as ResourceType] || '📦'} {r2(extractionBreakdown.breakdown?.playerAmount || 0)}
              </p>
              <p className="text-[9px] font-bold text-emerald-400">{RESOURCE_LABELS[extractionBreakdown.breakdown?.resourceType as ResourceType] || extractionBreakdown.factoryType}</p>
            </div>
            <div className="bg-blue-500/10 p-3 rounded-2xl border border-blue-500/20">
              <span className="text-[9px] font-black uppercase tracking-wider text-blue-400">Costo Energia</span>
              <p className="text-lg font-black text-blue-400">⚡ {extractionBreakdown.energyCost}</p>
              <p className="text-[9px] font-bold text-blue-400">Energia disponibile: {user?.energy || 0}</p>
            </div>
            {extractionBreakdown.breakdown?.moneyGenerated > 0 && (
              <div className="bg-amber-500/15 p-3 rounded-2xl border border-amber-400/30">
                <span className="text-[9px] font-black uppercase tracking-wider text-amber-400">Valuta Generata</span>
                <p className="text-lg font-black text-amber-300">€{Math.round(extractionBreakdown.breakdown.moneyGenerated)}</p>
                <p className="text-[9px] font-bold text-amber-400">Dall'oro estratto</p>
              </div>
            )}
            {extractionBreakdown.breakdown?.goldGenerated > 0 && (
              <div className="bg-yellow-500/10 p-3 rounded-2xl border border-yellow-500/20">
                <span className="text-[9px] font-black uppercase tracking-wider text-yellow-500">Gold da Scavata</span>
                <p className="text-lg font-black text-yellow-400">🪙 {Math.round(extractionBreakdown.breakdown.goldGenerated)}</p>
                <p className="text-[9px] font-bold text-yellow-500">Base {Math.round(extractionBreakdown.breakdown.goldBaseReward || 0)} • Salute x{r2(extractionBreakdown.breakdown.goldHealthMultiplier || 1)}</p>
              </div>
            )}
            <div className="bg-gray-800/50 p-3 rounded-2xl border border-gray-700/40">
              <span className="text-[9px] font-black uppercase tracking-wider text-gray-400">EXP Lavorativa</span>
              <p className="text-lg font-black text-gray-200">📊 {extractionBreakdown.workExperience || 0}</p>
              <p className="text-[9px] font-bold text-gray-400">{RESOURCE_LABELS[extractionBreakdown.breakdown?.resourceType as ResourceType] || ''}</p>
            </div>
          </div>

          {/* Region Resource Status */}
          <div className="bg-gray-800/50 p-3 rounded-xl space-y-2">
            <div className="flex justify-between text-[10px] font-bold text-gray-400">
              <span>Cap Regionale</span>
              <span>{extractionBreakdown.breakdown?.regionCapTotal || 0} (base: {extractionBreakdown.breakdown?.regionCapMax || 0}{extractionBreakdown.breakdown?.regionDeepBonus > 0 ? ` + ${extractionBreakdown.breakdown.regionDeepBonus} deep` : ''})</span>
            </div>
            <div className="flex justify-between text-[10px] font-bold text-gray-400">
              <span>Residuo disponibile oggi</span>
              <span className={extractionBreakdown.breakdown?.regionResidualToday <= 0 ? 'text-rose-400' : 'text-emerald-400'}>
                {extractionBreakdown.breakdown?.regionResidualToday || 0}
              </span>
            </div>
            <div className="flex justify-between text-[10px] font-bold text-gray-400">
              <span>Consumo regionale previsto</span>
              <span>{r2(extractionBreakdown.breakdown?.withdrawnPoints || 0)} punti</span>
            </div>
          </div>

          {/* Payout Distribution */}
          <div className="bg-gray-800/50 p-3 rounded-xl space-y-1">
            <p className="text-[10px] font-black uppercase text-gray-400 mb-2">Distribuzione Payout</p>
            <div className="flex justify-between text-[10px] font-bold">
              <span className="text-gray-400">Lordo estratto</span>
              <span className="text-gray-200">{r2(extractionBreakdown.breakdown?.grossAmount || 0)}</span>
            </div>
            <div className="flex justify-between text-[10px] font-bold">
              <span className="text-emerald-400">→ Al giocatore</span>
              <span className="text-emerald-400">{r2(extractionBreakdown.breakdown?.playerAmount || 0)}</span>
            </div>
            <div className="flex justify-between text-[10px] font-bold">
              <span className="text-purple-400">→ Al proprietario</span>
              <span className="text-purple-400">{r2(extractionBreakdown.breakdown?.ownerAmount || 0)}</span>
            </div>
            <div className="flex justify-between text-[10px] font-bold">
              <span className="text-rose-400">→ Tasse</span>
              <span className="text-rose-400">{r2(extractionBreakdown.breakdown?.taxAmount || 0)}</span>
            </div>
            {(extractionBreakdown.breakdown?.autonomyAmount || 0) > 0 && (
              <div className="flex justify-between text-[10px] font-bold">
                <span className="text-orange-400">→ Autonomia</span>
                <span className="text-orange-400">{r2(extractionBreakdown.breakdown.autonomyAmount)}</span>
              </div>
            )}
          </div>

          {/* Breakdown Toggle */}
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="w-full flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <Info className="w-3 h-3" />
            {showBreakdown ? 'Nascondi Dettagli Formula' : 'Mostra Dettagli Formula'}
            {showBreakdown ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {showBreakdown && extractionBreakdown.breakdown && (
            <div className="bg-indigo-500/10 p-4 rounded-xl space-y-2 border border-indigo-500/20">
              <p className="text-[10px] font-black uppercase text-indigo-400 mb-2">📐 Breakdown Formula Produttività</p>
              <div className="space-y-1 text-[10px] font-mono text-indigo-300">
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
              <div className="mt-3 p-2 bg-gray-800/60 rounded-lg border border-gray-700/40">
                <p className="text-[11px] font-black text-indigo-400">
                  Produttività Finale: {r2(extractionBreakdown.breakdown.finalProductivity)}
                </p>
              </div>
              <div className="mt-2 text-[9px] text-indigo-400 space-y-1">
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
            <p className="text-[10px] font-bold text-rose-400 text-center">
              {(user?.energy || 0) < extractionBreakdown.energyCost ? 'Energia insufficiente' : 'Risorsa esaurita per oggi'}
            </p>
          )}
        </div>
      )}

      {/* ── Economy Section ── */}
      <div className="bg-gray-900/60 p-5 rounded-2xl border border-gray-800 space-y-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
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
            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Storico giornaliero (ultimi 7 giorni)</h4>
            <div className="space-y-1">
              {(factory.economyLogs || []).map((log: any, i: number) => (
                <div key={i} className="flex items-center justify-between bg-gray-800/50 px-3 py-2 rounded-xl text-[10px] font-bold">
                  <span className="text-gray-400">{log.logDate}</span>
                  <span className="text-gray-300">👷 {log.workerCount}</span>
                  <span className="text-emerald-400">+€{(log.grossIncome || 0).toLocaleString()}</span>
                  <span className="text-rose-400">-€{(log.taxesPaid || 0).toLocaleString()}</span>
                  <span className="text-purple-400">📦 {(log.production || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Storage Section ── */}
      {!isGoldMine && (
        <div className="bg-gray-900/60 p-5 rounded-2xl border border-gray-800 space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
            <Warehouse className="w-4 h-4" /> Magazzino
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400">Capacità: {storageCap.toLocaleString()} unità</span>
            <span className="text-xs font-bold text-gray-400">Attuale: {currentStorage.toLocaleString()}</span>
          </div>
          <div className="w-full bg-gray-700 h-4 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${storagePercent > 90 ? 'bg-red-500' : storagePercent > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, storagePercent)}%` }}
            />
          </div>
          <div className="text-[10px] font-bold text-gray-400">
            {storagePercent}% pieno • +{(factory.storagePerLevel || 0).toLocaleString()} al prossimo livello (Lv {level + 1}: {(factory.nextLevelStorage || 0).toLocaleString()})
          </div>

          {isOwner && currentStorage > 0 && (
            <button
              onClick={handleWithdraw}
              disabled={withdrawing}
              className="w-full mt-2 py-3 bg-indigo-500/10 text-indigo-400 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-indigo-500/20 transition-all disabled:opacity-50"
            >
              {withdrawing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Ritira Risorse nel Magazzino Personale
            </button>
          )}

          <div className="bg-gray-800/50 p-3 rounded-xl text-[10px] font-mono text-gray-400">
            Formula: storage = {(factory.storagePerLevel || 0).toLocaleString()} × livello = {(factory.storagePerLevel || 0).toLocaleString()} × {level} = {storageCap.toLocaleString()}
          </div>
        </div>
      )}

      {/* ── Recent Workers ── */}
      {(factory.recentWorkers || []).length > 0 && (
        <div className="bg-gray-900/60 p-5 rounded-2xl border border-gray-800 space-y-3">
          <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
            <Users className="w-4 h-4" /> Lavoratori Recenti
          </h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {(factory.recentWorkers || []).map((w: any, i: number) => (
              <div key={i} className="flex items-center justify-between bg-gray-800/50 px-3 py-2 rounded-xl text-[10px] font-bold">
                <span className="text-indigo-400">{w.workerName}</span>
                <span className="text-gray-400">{new Date(w.workedAt).toLocaleString('it-IT', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</span>
                {w.earningsMoney > 0 && <span className="text-emerald-400">+€{w.earningsMoney}</span>}
                {w.resourceAmount > 0 && <span className="text-blue-400">+{w.resourceAmount} {w.resourceType}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Upgrade Section (Owner only) ── */}
      {isOwner && (
        <div className="bg-gray-900/60 p-5 rounded-2xl border border-amber-400/30 space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-amber-400 flex items-center gap-2">
            <ChevronUp className="w-4 h-4" /> Potenzia Fabbrica
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-amber-500/15 border border-amber-400/30 p-3 rounded-xl">
              <span className="font-black text-amber-300">Livello Attuale:</span>
              <span className="ml-2 font-black text-amber-300">{level}</span>
            </div>
            <div className="bg-indigo-500/10 p-3 rounded-xl">
              <span className="font-black text-indigo-400">Rendimento:</span>
              <span className="ml-2 font-black text-indigo-400">x{yieldMult} → x{factory.nextLevelYield}</span>
            </div>
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-[10px] font-black uppercase text-gray-400">Livello Target (max {FACTORY_CONFIG.MAX_LEVEL})</label>
              <input
                type="number"
                min={level + 1}
                max={FACTORY_CONFIG.MAX_LEVEL}
                placeholder={`Lv ${level + 1}`}
                value={upgradeTarget}
                onChange={e => { setUpgradeTarget(e.target.value); fetchUpgradeCost(e.target.value); }}
                className="w-full mt-1 bg-gray-800/60 border border-gray-700/40 text-gray-100 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>
            {upgradeCost !== null && (
              <div className="text-sm font-black text-amber-300 pb-2.5">🪙 {upgradeCost} Gold</div>
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
        <div className="bg-gray-900/60 p-5 rounded-2xl border border-emerald-500/20 space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" /> Mercato
          </h3>
          <div className="bg-emerald-500/10 p-3 rounded-xl text-xs font-bold text-emerald-400">
            Valore stimato: €{(factory.estimatedValue || 0).toLocaleString()}
          </div>
          {factory.activeListing ? (
            <div className="space-y-3">
              <div className="bg-amber-500/15 border border-amber-400/30 p-4 rounded-xl">
                <p className="text-xs font-black text-amber-300">🏷️ In vendita a €{factory.activeListing.askingPrice?.toLocaleString()}</p>
                <p className="text-[10px] text-amber-400 mt-1">Pubblicato il {new Date(factory.activeListing.listedAt).toLocaleDateString('it-IT')}</p>
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
                className="w-full bg-gray-800/60 border border-gray-700/40 text-gray-100 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500/40"
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
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    amber: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    red: 'bg-rose-500/15 text-rose-400 border-rose-400/30',
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
    <div className="bg-gray-800/60 px-2 py-1.5 rounded-lg border border-gray-700/40">
      <p className="text-[8px] font-bold text-gray-400 uppercase">{label}</p>
      <p className="text-[10px] font-black text-indigo-300">{value}</p>
    </div>
  );
}
