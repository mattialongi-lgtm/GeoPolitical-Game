import React, { useState, useEffect } from "react";
import {
  Loader2,
  DollarSign,
  MapPin,
  ArrowUpRight,
  User as UserIcon,
} from "lucide-react";

export const BudgetView = ({ regionId, user, isLeader }: { regionId: string, user: any, isLeader: boolean }) => {
  const [budgetData, setBudgetData] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [donateAmount, setDonateAmount] = useState("");
  const [donateCurrency, setDonateCurrency] = useState("EUR");

  const fetchBudget = async () => {
    try {
      const res = await fetch(`/api/budget/REGION/${regionId}`);
      const data = await res.json();
      if (!data.error) {
        setBudgetData(data.budget);
        setTransactions(data.transactions || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBudget(); }, [regionId]);

  const handleDonate = async () => {
    if (!donateAmount) return;
    try {
      const res = await fetch("/api/budget/donate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId: regionId, amount: donateAmount, currency: donateCurrency })
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else { alert("Donazione effettuata!"); fetchBudget(); setDonateAmount(""); }
    } catch { alert("Errore"); }
  };

  const handleAction = async (endpoint: string, body: any) => {
    if (!confirm("Sei sicuro?")) return;
    try {
      const res = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else { alert(data.message || "Azione completata"); fetchBudget(); }
    } catch { alert("Errore"); }
  }

  if (loading) return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500" /></div>;
  if (!budgetData) return null;

  // Check if budgetData.resources is already an object or needs parsing
  const resources = typeof budgetData.resources === 'string'
    ? JSON.parse(budgetData.resources || '{}')
    : (budgetData.resources || {});

  return (
    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
      <div className="flex items-center justify-between border-b border-indigo-50 pb-4">
        <h3 className="text-lg font-black uppercase tracking-tight text-indigo-900 flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-indigo-600" /> Bilancio di Stato
        </h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-emerald-50 p-5 rounded-3xl border border-emerald-100 flex flex-col justify-center items-center text-center">
          <p className="text-[10px] uppercase font-black tracking-widest text-emerald-600 mb-1">Fondi in €</p>
          <p className="text-xl font-black text-emerald-800">${budgetData.moneyEUR.toLocaleString()}</p>
        </div>
        {Object.entries(resources).map(([res, val]: any) => (
          <div key={res} className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex flex-col justify-center items-center text-center">
            <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-1">{res}</p>
            <p className="text-xl font-black text-slate-800">{val}</p>
          </div>
        ))}
      </div>

      {user?.level >= 60 && (
        <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100">
          <p className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2"><ArrowUpRight className="w-4 h-4 text-emerald-500" /> Dona allo Stato</p>
          <div className="flex flex-col md:flex-row gap-3">
            <input type="number" min="1" value={donateAmount} onChange={e => setDonateAmount(e.target.value)} placeholder="0" className="flex-1 px-4 py-3 bg-white rounded-xl border border-slate-200 font-bold focus:ring-2 focus:ring-emerald-500 outline-none" />
            <select value={donateCurrency} onChange={e => setDonateCurrency(e.target.value)} className="px-4 py-3 bg-white rounded-xl border border-slate-200 font-bold outline-none">
              <option value="EUR">Euro (€)</option>
              <option value="GOLD">Gold</option>
            </select>
            <button onClick={handleDonate} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-colors">Dona</button>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 font-bold">Tasso di cambio: 1 Gold = 500.000 €</p>
        </div>
      )}

      {isLeader && (
        <div className="p-5 bg-amber-50 rounded-3xl border border-amber-100">
          <p className="text-sm font-black text-amber-900 mb-4 flex items-center gap-2"><MapPin className="w-4 h-4 text-amber-600" /> Controlli Budgettari</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button onClick={() => handleAction("/api/budget/explore", { regionId, type: 'normal' })} className="px-4 py-3 bg-amber-600 text-white rounded-xl font-black text-[10px] uppercase tracking-wider shadow-sm hover:bg-amber-700 flex flex-col items-center">
              <span>Esplora (Normale)</span>
              <span className="text-amber-200 mt-1">-$15.000</span>
            </button>
            <button onClick={() => handleAction("/api/budget/explore", { regionId, type: 'deep' })} className="px-4 py-3 bg-rose-600 text-white rounded-xl font-black text-[10px] uppercase tracking-wider shadow-sm hover:bg-rose-700 flex flex-col items-center">
              <span>Esplora (Profonda)</span>
              <span className="text-rose-200 mt-1">-$50.000</span>
            </button>
            <button onClick={() => handleAction("/api/budget/clean-radiation", { regionId })} className="px-4 py-3 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-wider shadow-sm hover:bg-emerald-700 flex flex-col items-center">
              <span>Pulisci Radiazioni</span>
              <span className="text-emerald-200 mt-1">-$10.000</span>
            </button>
          </div>
        </div>
      )}

      <div>
        <h4 className="text-sm font-black tracking-tight text-slate-800 mb-4">Registro Transazioni</h4>
        {transactions.length === 0 ? (
          <p className="text-xs text-slate-400 font-bold text-center py-4">Nessuna transazione recente.</p>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
            {transactions.map(t => (
              <div key={t.id} className="flex justify-between items-center p-4 border border-slate-100 rounded-2xl bg-white hover:bg-slate-50 transition-colors shadow-sm">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] px-2 py-0.5 rounded-md bg-slate-100 font-black uppercase text-slate-500 tracking-widest">{t.type}</span>
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{t.subtype}</span>
                  </div>
                  <p className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <UserIcon className="w-3 h-3 text-slate-400" /> {t.createdBy || 'Sistema'}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-black ${t.moneyDelta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {t.moneyDelta > 0 ? '+' : ''}{t.moneyDelta.toLocaleString()} €
                  </p>
                  <p className="text-[9px] text-slate-400 font-bold mt-1">{new Date(t.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
