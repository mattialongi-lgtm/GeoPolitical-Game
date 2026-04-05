import React, { useState, useEffect } from "react";
import { Loader2, Package, Timer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { WEAPONS_CATALOG } from "../../constants";
import { ResourceIcon } from "../ResourceIcon";
import { PerkTimer } from "../ui";

export const ProduceView = ({ user }: { user: any }) => {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const fetchQueue = async () => {
    try {
      const res = await fetch("/api/produce/list");
      if (res.ok) setQueue(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const iv = setInterval(fetchQueue, 5000);
    return () => clearInterval(iv);
  }, []);

  const handleProduce = async (weaponId: string) => {
    const amount = qty[weaponId] || 1;
    setSubmitting(true);
    try {
      const res = await fetch("/api/produce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weaponType: weaponId, qty: amount }),
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else { fetchQueue(); alert(`✅ ${amount}x ${weaponId} in coda!`); }
    } catch { alert("Errore nella produzione"); }
    finally { setSubmitting(false); }
  };

  // Remove handleClaim as it's now automated the backend

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6"
    >
      <button onClick={() => navigate(-1)} className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1">
        ← Indietro
      </button>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
        <h2 className="text-2xl font-black tracking-tight">🔨 Produci Armi</h2>
        <div className="grid grid-cols-1 gap-4">
          {WEAPONS_CATALOG.map(w => {
            const amount = qty[w.id] || 1;
            const totalCost = amount * w.costCash;
            const canAfford =
              (user?.money || 0) >= totalCost &&
              (user?.oil || 0) >= amount * w.reqOil &&
              (user?.minerals || 0) >= amount * w.reqMinerals &&
              (user?.uranium || 0) >= amount * w.reqUranium &&
              (user?.diamonds || 0) >= amount * w.reqDiamonds;

            return (
              <div key={w.id} className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-slate-50 rounded-3xl border border-slate-100">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-md border border-slate-100 flex-shrink-0">
                    <ResourceIcon id={w.id} size={40} />
                  </div>
                  <div>
                    <p className="font-black text-slate-900 text-lg leading-tight tracking-tight uppercase">{w.name}</p>
                    <div className="flex flex-wrap gap-2 mt-2.5">
                      <div className="flex items-center gap-1 text-[10px] font-black text-slate-500 bg-white px-2 py-1.5 rounded-xl border border-slate-200/60 shadow-sm uppercase tracking-wider">
                        <ResourceIcon id="money" size={12} /> ${w.costCash.toLocaleString()}
                      </div>
                      {w.reqOil > 0 && <div className="flex items-center gap-1 text-[10px] font-black text-slate-600 bg-white px-2 py-1.5 rounded-xl border border-slate-200/60 shadow-sm uppercase tracking-wider">
                        <ResourceIcon id="oil" size={12} /> {w.reqOil}
                      </div>}
                      {w.reqMinerals > 0 && <div className="flex items-center gap-1 text-[10px] font-black text-slate-600 bg-white px-2 py-1.5 rounded-xl border border-slate-200/60 shadow-sm uppercase tracking-wider">
                        <ResourceIcon id="minerals" size={12} /> {w.reqMinerals}
                      </div>}
                      {w.reqUranium > 0 && <div className="flex items-center gap-1 text-[10px] font-black text-slate-600 bg-white px-2 py-1.5 rounded-xl border border-slate-200/60 shadow-sm uppercase tracking-wider">
                        <ResourceIcon id="uranium" size={12} /> {w.reqUranium}
                      </div>}
                      {w.reqDiamonds > 0 && <div className="flex items-center gap-1 text-[10px] font-black text-slate-600 bg-white px-2 py-1.5 rounded-xl border border-slate-200/60 shadow-sm uppercase tracking-wider">
                        <ResourceIcon id="diamonds" size={12} /> {w.reqDiamonds}
                      </div>}
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1.5 rounded-xl border border-slate-100 italic">⏱ {w.timeMin}m</span>
                      <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1.5 rounded-xl border border-emerald-100 uppercase tracking-widest">+{w.power} pw</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={qty[w.id] || 1}
                    onChange={e => setQty(q => ({ ...q, [w.id]: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="w-14 bg-white border border-slate-100 rounded-xl px-2 py-2 text-xs font-black text-center focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  <button
                    onClick={() => handleProduce(w.id)}
                    disabled={submitting || !canAfford}
                    className={`px-3 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${canAfford ? "bg-orange-500 text-white shadow-lg shadow-orange-100 hover:scale-105" : "bg-slate-100 text-slate-400"}`}
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Produci"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-black uppercase tracking-tight">Coda di Produzione</h3>
        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="animate-spin text-indigo-600 w-8 h-8" /></div>
        ) : queue.length === 0 ? (
          <div className="bg-white p-10 rounded-[2rem] text-center border border-slate-100">
            <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 font-bold text-sm">Nessuna produzione in corso</p>
          </div>
        ) : (
          queue.map((item: any) => {
            const isReady = item.status === "claimed" || item.status === "ready" || (item.willCompleteAt && item.willCompleteAt <= Date.now());
            return (
              <div key={item.id} className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-black text-slate-900 capitalize">{item.weaponType}</span>
                    <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg">x{item.qty}</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${isReady ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                      {isReady ? "✅ Pronto in magazzino" : "🔄 In coda"}
                    </span>
                  </div>
                  {!isReady && item.willCompleteAt && (
                    <div className="flex items-center gap-1 text-amber-500 text-xs font-bold">
                      <Timer className="w-3 h-3" />
                      <PerkTimer willCompleteAt={item.willCompleteAt} />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
};
