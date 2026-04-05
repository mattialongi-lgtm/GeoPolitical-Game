import React, { useState } from "react";
import { Shield, Swords, AlertCircle } from "lucide-react";
import { motion } from "motion/react";

export const NationView = ({ user, fetchData }: { user: any, fetchData: () => void }) => {
  const [displayedNation, setDisplayedNation] = useState(user.displayedNation || 'ST');
  const [originalNation, setOriginalNation] = useState(user.originalNation || 'ST');
  const [submitting, setSubmitting] = useState(false);

  const NATION_OPTS = [
    { id: "ST", name: "São Tomé" },
    { id: "IT", name: "Italy" }, { id: "FR", name: "France" }, { id: "DE", name: "Germany" },
    { id: "ES", name: "Spain" }, { id: "GB", name: "UK" }, { id: "US", name: "USA" },
    { id: "CA", name: "Canada" }, { id: "BR", name: "Brazil" }, { id: "JP", name: "Japan" },
    { id: "CN", name: "China" }, { id: "IN", name: "India" }, { id: "RU", name: "Russia" },
  ];

  const handleUpdateDisplayed = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/actions/change-displayed-nation", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nationId: displayedNation })
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else { alert("Nazione mostrata aggiornata!"); fetchData(); }
    } catch { alert("Errore"); }
    finally { setSubmitting(false); }
  };

  const handleUpdateOriginal = async () => {
    if (!confirm("Sei sicuro? Potrai cambiarla di nuovo solo tra 30 giorni!")) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/actions/change-original-nation", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nationId: originalNation })
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else { alert("Nazione Originale aggiornata con successo! +10% Danni applicato nelle guerre patriottiche."); fetchData(); }
    } catch { alert("Errore"); }
    finally { setSubmitting(false); }
  };

  const now = Date.now();
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  const canChangeOriginal = now - (user.lastOriginalNationChange || 0) >= THIRTY_DAYS || (user.lastOriginalNationChange === 0);
  const nextAvailDate = new Date((user.lastOriginalNationChange || 0) + THIRTY_DAYS).toLocaleDateString();

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
          <Shield className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Gestione Nazione</h2>
          <p className="text-sm font-bold text-slate-400">Personalizza la tua identità e i tuoi bonus di guerra</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-6">
        <div>
          <h3 className="text-lg font-black text-slate-900 uppercase">Nazione Mostrata (Estetica)</h3>
          <p className="text-xs text-slate-400 font-bold mb-4">Questa nazione viene mostrata nel tuo profilo per scopi di Roleplay. Puoi cambiarla in qualsiasi momento senza limiti.</p>
          <div className="flex gap-4">
            <select value={displayedNation} onChange={e => setDisplayedNation(e.target.value)} className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 font-bold focus:ring-2 focus:ring-indigo-500">
              {NATION_OPTS.map(n => <option key={n.id} value={n.id}>{n.id} - {n.name}</option>)}
            </select>
            <button onClick={handleUpdateDisplayed} disabled={submitting || displayedNation === user.displayedNation} className="px-6 py-3 bg-indigo-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-lg shadow-indigo-100 disabled:opacity-50">
              Aggiorna
            </button>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-6">
          <h3 className="text-lg font-black text-rose-900 uppercase flex items-center gap-2">
            <Swords className="w-5 h-5" /> Nazione Originale (Bonus +10% Danni)
          </h3>
          <p className="text-xs text-rose-500 font-bold mb-4">La tua vera fedeltà. Riceverai un bonus del +10% ai danni se combatti a favore di questa nazione. Puoi cambiarla solo <b className="font-black">una volta ogni 30 giorni</b>.</p>

          <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl mb-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
            <p className="text-xs font-bold text-rose-900">
              {canChangeOriginal ? "Puoi cambiare la tua Nazione Originale ora." : `Hai già cambiato nazione di recente. Prossimo cambio disponibile il: ${nextAvailDate}`}
            </p>
          </div>

          <div className="flex gap-4">
            <select disabled={!canChangeOriginal} value={originalNation} onChange={e => setOriginalNation(e.target.value)} className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 font-bold focus:ring-2 focus:ring-rose-500 disabled:opacity-50">
              {NATION_OPTS.map(n => <option key={n.id} value={n.id}>{n.id} - {n.name}</option>)}
            </select>
            <button onClick={handleUpdateOriginal} disabled={submitting || !canChangeOriginal || originalNation === user.originalNation} className="px-6 py-3 bg-rose-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-lg shadow-rose-100 disabled:opacity-50">
              Giura Fedeltà
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
