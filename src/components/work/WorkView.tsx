import React from "react";
import { Zap, AlertCircle } from "lucide-react";
import { motion } from "motion/react";
import { ResourceExtractView } from "../resources/ResourceExtractView";
import { PlayerFactoriesView } from "../factories/PlayerFactoriesView";

export function WorkView(props: any) {
  const {
    user, fetchData, autoWorkFactoryId, autoWorkResourceType, autoWorkRegionId, setAutoWorkFactoryId, setAutoWorkResource, autoWorkExpiresAt,
    workExpTransferSource, setWorkExpTransferSource,
    workExpTransferTarget, setWorkExpTransferTarget,
    workExpTransferXp, setWorkExpTransferXp,
    workExpTransferBusy, setWorkExpTransferBusy,
    workExpTransferError, setWorkExpTransferError,
    workExpTransferOk, setWorkExpTransferOk,
  } = props;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-white tracking-tight uppercase">Mercato del Lavoro</h2>
        <div className="bg-gray-800/60 px-4 py-2 rounded-2xl border border-gray-700/40 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          <span className="font-black text-gray-200">{user.energy}/300</span>
        </div>
      </div>

      {user.regionId !== user.residenceId && user.workPermitId !== user.regionId && (
        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-xs font-bold text-amber-800 leading-tight">
            Sei all'estero come Turista in <span className="font-black">{user.regionId}</span>. Se questa nazione ha attivato le restrizioni, i tuoi turni di lavoro potrebbero essere bloccati senza Visto.
          </p>
        </div>
      )}

      <ResourceExtractView
        user={user}
        fetchData={fetchData}
        autoWorkResourceType={autoWorkResourceType}
        autoWorkRegionId={autoWorkRegionId}
        autoWorkExpiresAt={autoWorkExpiresAt}
        setAutoWorkResource={setAutoWorkResource}
      />

      {false && (
      <div className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-3">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Panoramica risorse in {user.regionId}</h3>
        <div className="grid grid-cols-5 gap-2">
          {[
            { emoji: "🪙", label: "Oro", color: "bg-amber-50" },
            { emoji: "🛢️", label: "Petrolio", color: "bg-orange-50" },
            { emoji: "🪨", label: "Minerali", color: "bg-slate-50" },
            { emoji: "☢️", label: "Uranio", color: "bg-cyan-50" },
            { emoji: "💎", label: "Diamanti", color: "bg-purple-50" },
          ].map(r => (
            <div key={r.label} className={`${r.color} p-2 rounded-xl flex flex-col items-center gap-1`}>
              <span className="text-lg">{r.emoji}</span>
              <span className="text-[8px] font-black text-slate-500 uppercase">{r.label}</span>
            </div>
          ))}
        </div>
      </div>
      )}

      {false && (
      <div className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-3">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Limite risorse giornaliero</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-amber-50 p-3 rounded-xl flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700">Estratte oggi</span>
            <span className="text-sm font-black text-amber-800">{user.dailyExtracted || 0}</span>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Limite</span>
            <span className="text-sm font-black text-slate-800">{user.dailyLimit || 100}</span>
          </div>
        </div>
        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
          <div className="bg-indigo-500 h-full rounded-full transition-all" style={{ width: `${Math.min(100, ((user.dailyExtracted || 0) / (user.dailyLimit || 100)) * 100)}%` }} />
        </div>
      </div>
      )}

      <div className="bg-gray-900/60 p-5 rounded-2xl border border-gray-800 space-y-3">
        <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Esperienza Lavorativa</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { emoji: "🪙", label: "Oro", exp: user.goldOreExp || 0 },
            { emoji: "🛢️", label: "Petrolio", exp: user.oilExp || 0 },
            { emoji: "🪨", label: "Minerali", exp: user.mineralsExp || 0 },
            { emoji: "☢️", label: "Uranio", exp: user.uraniumExp || 0 },
            { emoji: "💎", label: "Diamanti", exp: user.diamondsExp || 0 },
          ].map(r => (
            <div key={r.label} className="bg-gray-800/50 p-3 rounded-xl flex items-center gap-2 border border-gray-700/30">
              <span className="text-lg">{r.emoji}</span>
              <div>
                <span className="text-[9px] font-black text-gray-400 uppercase">{r.label}</span>
                {(() => {
                  const edu = Math.max(0, Math.floor(Number(user?.perks?.['ISTRUZIONE'] || 0)));
                  const maxWorkXp = 2000 + (edu * 1000);
                  const current = Math.max(0, Math.floor(Number(r.exp) || 0));
                  const effective = Math.min(current, maxWorkXp);
                  const pct = maxWorkXp > 0 ? Math.min(100, (effective / maxWorkXp) * 100) : 0;
                  return (
                    <>
                      <p className="text-sm font-black text-gray-100">{effective.toLocaleString()} / {maxWorkXp.toLocaleString()} XP</p>
                      <div className="w-full bg-gray-700 h-1.5 rounded-full overflow-hidden mt-1">
                        <div className="bg-indigo-500 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>

        {(() => {
          const edu = Math.max(0, Math.floor(Number(user?.perks?.['ISTRUZIONE'] || 0)));
          const maxWorkXp = 2000 + (edu * 1000);
          const expByResource: Record<string, number> = {
            oil: Math.max(0, Math.floor(Number(user?.oilExp) || 0)),
            minerals: Math.max(0, Math.floor(Number(user?.mineralsExp) || 0)),
            uranium: Math.max(0, Math.floor(Number(user?.uraniumExp) || 0)),
            diamonds: Math.max(0, Math.floor(Number(user?.diamondsExp) || 0)),
            gold_ore: Math.max(0, Math.floor(Number(user?.goldOreExp) || 0)),
          };
          const goldAvailable = Math.max(0, Math.floor(Number(user?.gold) || 0));
          const xp = Math.max(0, Math.floor(Number(workExpTransferXp) || 0));
          const goldCost = Math.max(1, Math.ceil(xp / 100));
          const srcXp = expByResource[workExpTransferSource] ?? 0;
          const dstXp = expByResource[workExpTransferTarget] ?? 0;
          const canSubmit =
            !workExpTransferBusy &&
            workExpTransferSource !== workExpTransferTarget &&
            xp > 0 &&
            xp <= srcXp &&
            dstXp < maxWorkXp &&
            (dstXp + xp) <= maxWorkXp &&
            goldAvailable >= goldCost;

          return (
            <div className="bg-gray-800/50 p-3 rounded-xl border border-gray-700/40">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-black text-gray-400 uppercase">Trasferisci EXP</p>
                <p className="text-[9px] font-black text-gray-400">Costo: {goldCost}G</p>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase">Sorgente</p>
                  <select
                    className="w-full mt-1 bg-gray-900/60 border border-gray-700/40 rounded-lg px-2 py-1 text-xs font-black text-gray-200"
                    value={workExpTransferSource}
                    onChange={(e) => setWorkExpTransferSource(e.target.value)}
                  >
                    <option value="oil">Petrolio ({expByResource.oil.toLocaleString()} XP)</option>
                    <option value="minerals">Minerali ({expByResource.minerals.toLocaleString()} XP)</option>
                    <option value="uranium">Uranio ({expByResource.uranium.toLocaleString()} XP)</option>
                    <option value="diamonds">Diamanti ({expByResource.diamonds.toLocaleString()} XP)</option>
                    <option value="gold_ore">Oro ({expByResource.gold_ore.toLocaleString()} XP)</option>
                  </select>
                </div>
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase">Destinazione</p>
                  <select
                    className="w-full mt-1 bg-gray-900/60 border border-gray-700/40 rounded-lg px-2 py-1 text-xs font-black text-gray-200"
                    value={workExpTransferTarget}
                    onChange={(e) => setWorkExpTransferTarget(e.target.value)}
                  >
                    <option value="oil">Petrolio ({expByResource.oil.toLocaleString()} XP)</option>
                    <option value="minerals">Minerali ({expByResource.minerals.toLocaleString()} XP)</option>
                    <option value="uranium">Uranio ({expByResource.uranium.toLocaleString()} XP)</option>
                    <option value="diamonds">Diamanti ({expByResource.diamonds.toLocaleString()} XP)</option>
                    <option value="gold_ore">Oro ({expByResource.gold_ore.toLocaleString()} XP)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-2">
                <input
                  type="number"
                  min={0}
                  className="w-full bg-gray-900/60 border border-gray-700/40 rounded-lg px-2 py-1 text-xs font-black text-gray-200"
                  value={Number.isFinite(workExpTransferXp) ? workExpTransferXp : 0}
                  onChange={(e) => setWorkExpTransferXp(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                />
                <button
                  disabled={!canSubmit}
                  onClick={async () => {
                    setWorkExpTransferError(null);
                    setWorkExpTransferOk(null);
                    const src = String(workExpTransferSource || '').trim();
                    const dst = String(workExpTransferTarget || '').trim();
                    const transferXp = Math.max(0, Math.floor(Number(workExpTransferXp) || 0));
                    setWorkExpTransferBusy(true);
                    try {
                      const res = await fetch(`/api/extraction/transfer-work-exp`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ sourceResource: src, targetResource: dst, xpToTransfer: transferXp }),
                      });
                      const data = await res.json().catch(() => null);
                      if (!res.ok) throw new Error(data?.error || "Errore trasferimento.");
                      setWorkExpTransferOk(`Trasferite ${transferXp.toLocaleString()} XP (${goldCost}G).`);
                      fetchData();
                    } catch (e: any) {
                      setWorkExpTransferError(e?.message || "Errore trasferimento.");
                    } finally {
                      setWorkExpTransferBusy(false);
                    }
                  }}
                  className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black disabled:opacity-50"
                >
                  {workExpTransferBusy ? "..." : "Trasferisci"}
                </button>
              </div>

              <p className="text-[9px] text-gray-500 font-bold mt-2">
                Cap: {maxWorkXp.toLocaleString()} XP (Istruzione {edu}) • Gold: {goldAvailable.toLocaleString()}G
              </p>
              {workExpTransferError && <p className="text-[10px] font-black text-red-400 mt-1">{workExpTransferError}</p>}
              {workExpTransferOk && <p className="text-[10px] font-black text-emerald-400 mt-1">{workExpTransferOk}</p>}
            </div>
          );
        })()}
      </div>

      <PlayerFactoriesView
        user={user}
        fetchData={fetchData}
        autoWorkFactoryId={autoWorkFactoryId}
        setAutoWorkFactoryId={setAutoWorkFactoryId}
      />
    </motion.div>
  );
}
