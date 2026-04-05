import React, { useState, useEffect } from "react";
import {
  Crown,
  Plus,
  BookOpen,
  CheckCircle2,
  Trash2,
  Zap,
} from "lucide-react";

export const LawsTab = ({ laws, registry, user, reload, isMp, region }: any) => {
  const [showPropose, setShowPropose] = useState(false);
  const [selectedLaw, setSelectedLaw] = useState<string | null>(null);
  const [paramsForm, setParamsForm] = useState<any>({});
  const [acting, setActing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [allRegions, setAllRegions] = useState<{ id: string; name: string }[]>([]);
  const [activeOutgoingAgreements, setActiveOutgoingAgreements] = useState<any[]>([]);

  useEffect(() => { setParamsForm({}); }, [selectedLaw]);

  useEffect(() => {
    fetch('/api/regions')
      .then(r => r.ok ? r.json() : [])
      .then((data: any[]) => {
        const list = (data || [])
          .filter((r: any) => r.id && r.id !== region?.id)
          .map((r: any) => ({ id: r.id, name: r.name || r.id }))
          .sort((a: any, b: any) => a.name.localeCompare(b.name));
        setAllRegions(list);
      })
      .catch(() => {});
  }, [region?.id]);

  useEffect(() => {
    if (!region?.id) return;
    fetch(`/api/countries/${region.id}/agreements`)
      .then(r => r.ok ? r.json() : { outgoing: [] })
      .then((data: any) => setActiveOutgoingAgreements(data?.outgoing || []))
      .catch(() => {});
  }, [region?.id]);

  const activeLaws = (laws || []).filter((l: any) => l.status === 'pending');
  const historyLaws = (laws || []).filter((l: any) => l.status !== 'pending');
  const displayLaws = showHistory ? historyLaws : activeLaws;

  const handleWithdraw = async (lawId: string) => {
    if (!window.confirm("Sei sicuro di voler ritirare questa proposta di legge? Verrà spostata nell'archivio storico.")) return;
    setActing(true);
    try {
      const res = await fetch("/api/parliament/laws/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lawId })
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else {
        reload();
      }
    } catch { alert("Errore di connessione"); }
    setActing(false);
  };

  // Group laws by category
  const categories = registry ? Object.entries(registry).reduce((acc: any, [key, law]: any) => {
    if (!acc[law.category]) acc[law.category] = [];
    acc[law.category].push({ id: key, ...law });
    return acc;
  }, {}) : {};

  const handlePropose = async () => {
    if (!selectedLaw) return;
    setActing(true);
    try {
      const res = await fetch("/api/parliament/laws/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: selectedLaw, params: paramsForm })
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else {
        setShowPropose(false);
        setSelectedLaw(null);
        setParamsForm({});
        if (data.immediate) alert("Come Dittatore, la legge è stata approvata ed eseguita immediatamente!");
        reload();
      }
    } catch { alert("Errore di connessione"); }
    setActing(false);
  };

  const handleVote = async (lawId: string, vote: 'yes' | 'no') => {
    setActing(true);
    try {
      const res = await fetch("/api/parliament/laws/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lawId, vote })
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else reload();
    } catch { alert("Errore di connessione"); }
    setActing(false);
  };

  const handlePass = async (lawId: string) => {
    if (!window.confirm("Sei un Ministro: vuoi approvare questa legge immediatamente (Fast-Pass)?")) return;
    setActing(true);
    try {
      const res = await fetch("/api/parliament/laws/pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lawId })
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else {
        alert("Legge approvata via Fast-Pass!");
        reload();
      }
    } catch { alert("Errore di connessione"); }
    setActing(false);
  };

  const isLeader = region?.ownerUserId === user.id;
  const isEconomicMinister = region?.economicAdviserId === user.id;
  const isForeignMinister = region?.foreignMinisterId === user.id;
  const canPropose = isMp || isLeader;

  return (
    <div className="space-y-6">
      {region?.dictatorship === 1 && (
        <div className="bg-rose-500 text-white p-6 rounded-3xl shadow-xl border border-rose-400 flex items-center gap-4">
          <Crown className="w-12 h-12 text-rose-200 shrink-0" />
          <div>
            <h3 className="text-xl font-black uppercase tracking-widest">Regime Dittatoriale</h3>
            <p className="font-bold text-rose-100 text-sm mt-1">Il parlamento è sospeso. Il Dittatore ha potere esecutivo e legislativo assoluto. Le leggi passano senza essere votate.</p>
          </div>
        </div>
      )}

      {canPropose && !showPropose && (
        <div className="flex justify-end">
          <button onClick={() => setShowPropose(true)} className={`${region?.dictatorship ? "bg-rose-600 hover:bg-rose-700 shadow-rose-200" : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"} text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg transition-all flex items-center gap-2`}>
            {region?.dictatorship ? <Crown className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {region?.dictatorship ? "Emana Editto" : "Proponi Legge"}
          </button>
        </div>
      )}

      {showPropose && (
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-xl space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-500" />

          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-black text-slate-900">{region?.dictatorship ? "Emana Nuovo Editto" : "Seleziona Proposta di Legge"}</h3>
            <button onClick={() => { setShowPropose(false); setSelectedLaw(null); }} className="text-slate-400 hover:text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors">Annulla</button>
          </div>

          {!selectedLaw ? (
            <div className="space-y-8">
              {Object.entries(categories).map(([catName, catLaws]: any) => (
                <div key={catName}>
                  <h4 className="text-sm font-black text-indigo-500 uppercase tracking-widest mb-3">{catName}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {catLaws.map((law: any) => (
                      <div key={law.id} onClick={() => setSelectedLaw(law.id)} className="p-4 border border-slate-200 hover:border-indigo-400 rounded-2xl cursor-pointer transition-all hover:shadow-md bg-white hover:bg-indigo-50/50 group flex gap-4 items-start">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 flex items-center justify-center shrink-0 transition-colors">
                          <BookOpen className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-black text-slate-800 text-sm group-hover:text-indigo-900">{law.title}</p>
                          <p className="text-xs font-bold text-slate-500 leading-tight mt-1">{law.description}</p>
                          <p className="text-[10px] uppercase font-black text-indigo-400 mt-2 tracking-widest">Soglia: {law.threshold * 100}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-black text-indigo-900">{registry[selectedLaw].title}</h4>
                  <p className="text-sm text-indigo-600/80 font-bold">{registry[selectedLaw].description}</p>
                </div>
                <button onClick={() => setSelectedLaw(null)} className="ml-auto text-xs font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-600">Cambia</button>
              </div>

              <div className="space-y-4">
                {selectedLaw === 'change_market_tax' && (
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Nuova Tassa Mercato (%)</label>
                    <input type="number" min="0" max="100" placeholder="Es: 10" value={paramsForm.tax || ''} onChange={e => setParamsForm({ ...paramsForm, tax: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500" />
                  </div>
                )}
                {selectedLaw === 'change_salary_tax' && (
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Nuova Tassa Salari (%)</label>
                    <input type="number" min="0" max="100" placeholder="Es: 15" value={paramsForm.tax || ''} onChange={e => setParamsForm({ ...paramsForm, tax: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500" />
                  </div>
                )}
                {selectedLaw === 'change_state_name' && (
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Nuovo Nome Stato</label>
                    <input type="text" maxLength={22} placeholder="Es: Antigravitia" value={paramsForm.name || ''} onChange={e => setParamsForm({ ...paramsForm, name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500" />
                  </div>
                )}
                {selectedLaw === 'change_parliament_size' && (
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Numero Seggi Parlamentari</label>
                    <input type="number" min="10" max="100" placeholder="Es: 20" value={paramsForm.size || ''} onChange={e => setParamsForm({ ...paramsForm, size: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500" />
                  </div>
                )}
                {selectedLaw === 'change_parliament_duration' && (
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Durata Mandato (Giorni)</label>
                    <input type="number" min="3" max="30" placeholder="Es: 5" value={paramsForm.days || ''} onChange={e => setParamsForm({ ...paramsForm, days: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500" />
                  </div>
                )}
                {(selectedLaw === 'declare_war' || selectedLaw === 'peace_treaty' || selectedLaw === 'apply_sanctions' || selectedLaw === 'revoke_sanctions') && (
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">ID Nazione Bersaglio</label>
                    <input type="text" placeholder="Es: FR, DE, US..." value={paramsForm.targetRegionId || ''} onChange={e => setParamsForm({ ...paramsForm, targetRegionId: e.target.value.toUpperCase() })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500 uppercase" />
                  </div>
                )}
                {selectedLaw === 'migration_agreement' && (
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Nazione Bersaglio</label>
                    {(() => {
                      const existingTargets = new Set(activeOutgoingAgreements.map((a: any) => a.partnerId));
                      const available = allRegions.filter(r => !existingTargets.has(r.id));
                      return (
                        <select
                          value={paramsForm.targetRegionId || ''}
                          onChange={e => setParamsForm({ ...paramsForm, targetRegionId: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500"
                        >
                          <option value="">— Seleziona nazione —</option>
                          {available.map(r => (
                            <option key={r.id} value={r.id}>{r.name} ({r.id})</option>
                          ))}
                        </select>
                      );
                    })()}
                  </div>
                )}
                {selectedLaw === 'revoke_migration_agreement' && (
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Accordo da Annullare</label>
                    {activeOutgoingAgreements.length === 0 ? (
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-sm font-bold text-slate-400">Nessun accordo attivo da revocare.</div>
                    ) : (
                      <select
                        value={paramsForm.targetRegionId || ''}
                        onChange={e => setParamsForm({ ...paramsForm, targetRegionId: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500"
                      >
                        <option value="">— Seleziona accordo —</option>
                        {activeOutgoingAgreements.map((a: any) => (
                          <option key={a.partnerId} value={a.partnerId}>
                            {a.partnerName || a.partnerId} ({a.partnerId}) — {a.agreementType === 'BILATERAL' ? 'Bilaterale' : 'Unilaterale'}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
                {selectedLaw === 'transfer_budget' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">ID Nazione Destinataria</label>
                      <input type="text" placeholder="Es: FR, DE, US..." value={paramsForm.targetRegionId || ''} onChange={e => setParamsForm({ ...paramsForm, targetRegionId: e.target.value.toUpperCase() })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500 uppercase" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Importo da Inviare ($)</label>
                      <input type="number" min="1" placeholder="Es: 5000" value={paramsForm.amount || ''} onChange={e => setParamsForm({ ...paramsForm, amount: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500" />
                    </div>
                  </div>
                )}
                {/* Autonomy Laws */}
                {(selectedLaw === 'grant_autonomy' || selectedLaw === 'revoke_autonomy') && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">ID Regione Bersaglio</label>
                      <input type="text" placeholder="Es: IT-LOM, IT-SIC..." value={paramsForm.targetRegionId || ''} onChange={e => setParamsForm({ ...paramsForm, targetRegionId: e.target.value.toUpperCase() })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500 uppercase" />
                    </div>
                    {selectedLaw === 'grant_autonomy' && (
                      <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Quota Profitto Regionale (%)</label>
                        <input type="number" min="0" max="100" placeholder="Es: 30" value={paramsForm.profitShare || ''} onChange={e => setParamsForm({ ...paramsForm, profitShare: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500" />
                        <p className="text-[10px] font-bold text-slate-400 mt-1">La regione tratterrà questa % degli utili, il resto andrà allo Stato.</p>
                      </div>
                    )}
                  </div>
                )}
                {selectedLaw === 'change_profit_share' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">ID Regione Autonoma</label>
                      <input type="text" placeholder="Es: IT-LOM..." value={paramsForm.targetRegionId || ''} onChange={e => setParamsForm({ ...paramsForm, targetRegionId: e.target.value.toUpperCase() })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500 uppercase" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Nuova Quota Profitto Regionale (%)</label>
                      <input type="number" min="0" max="100" placeholder="Es: 40" value={paramsForm.profitShare || ''} onChange={e => setParamsForm({ ...paramsForm, profitShare: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500" />
                    </div>
                  </div>
                )}
                {(selectedLaw === 'change_worker_tax' || selectedLaw === 'change_industry_tax') && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Nuova Aliquota (%)</label>
                      <input type="number" min="0" max="100" placeholder="Es: 15" value={paramsForm.tax || ''} onChange={e => setParamsForm({ ...paramsForm, tax: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">ID Regione (opzionale, default: la tua)</label>
                      <input type="text" placeholder="Es: IT-LOM..." value={paramsForm.targetRegionId || ''} onChange={e => setParamsForm({ ...paramsForm, targetRegionId: e.target.value.toUpperCase() })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500 uppercase" />
                    </div>
                  </div>
                )}
                {selectedLaw === 'build_regional_building' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Tipo Edificio</label>
                      <select value={paramsForm.buildingType || ''} onChange={e => setParamsForm({ ...paramsForm, buildingType: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500">
                        <option value="">Seleziona...</option>
                        <option value="hospital">🏥 Ospedale</option>
                        <option value="military_base">🏛️ Base Militare</option>
                        <option value="school">🏫 Scuola</option>
                        <option value="military_academy">🎖️ Accademia Militare</option>
                        <option value="missile_system">🚀 Sistema Missilistico</option>
                        <option value="airport">✈️ Aeroporto</option>
                        <option value="naval_port">⚓ Porto Navale</option>
                        <option value="space_port">🛸 Porto Spaziale</option>
                        <option value="real_estate_fund">🏘️ Fondo Immobiliare</option>
                        <option value="power_plant">⚡ Centrale Elettrica</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">ID Regione Bersaglio (opzionale)</label>
                      <input type="text" placeholder="Es: IT-LOM..." value={paramsForm.targetRegionId || ''} onChange={e => setParamsForm({ ...paramsForm, targetRegionId: e.target.value.toUpperCase() })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500 uppercase" />
                    </div>
                  </div>
                )}
                {selectedLaw === 'assign_governor' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">ID Regione Autonoma</label>
                      <input type="text" placeholder="Es: IT-LOM..." value={paramsForm.targetRegionId || ''} onChange={e => setParamsForm({ ...paramsForm, targetRegionId: e.target.value.toUpperCase() })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500 uppercase" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">ID Utente Governatore</label>
                      <input type="text" placeholder="UUID del giocatore" value={paramsForm.governorUserId || ''} onChange={e => setParamsForm({ ...paramsForm, governorUserId: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-indigo-500" />
                    </div>
                  </div>
                )}
                {/* Fallback for laws with no params like proclaim_dictatorship */}
                {['change_market_tax', 'change_salary_tax', 'change_state_name', 'change_parliament_size', 'change_parliament_duration', 'transfer_budget', 'declare_war', 'peace_treaty', 'migration_agreement', 'revoke_migration_agreement', 'apply_sanctions', 'revoke_sanctions', 'grant_autonomy', 'revoke_autonomy', 'change_profit_share', 'change_worker_tax', 'change_industry_tax', 'build_regional_building', 'assign_governor'].indexOf(selectedLaw) === -1 && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-sm font-bold text-slate-500">
                    Questa legge non richiede parametri aggiuntivi.
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button onClick={() => setShowPropose(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-xl text-xs uppercase tracking-widest hover:bg-slate-200 transition-colors">Annulla</button>
                <button
                  disabled={acting || ((selectedLaw === 'migration_agreement' || selectedLaw === 'revoke_migration_agreement') && !paramsForm.targetRegionId)}
                  onClick={handlePropose}
                  className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {region?.dictatorship ? "Emanala Ora" : "Deposita in Parlamento"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4">
        <div className="flex items-center justify-between ml-2">
          <h3 className="text-xl font-black text-slate-900">{showHistory ? "Archivio Storico" : "Proposte in Votazione"}</h3>
          <button onClick={() => setShowHistory(!showHistory)} className="text-xs font-bold text-indigo-500 hover:text-indigo-700 uppercase tracking-widest bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors border border-indigo-100">
            {showHistory ? "Mostra Attive" : "Vai all'Archivio"}
          </button>
        </div>
        {displayLaws.length === 0 && (
          <div className="text-center p-8 bg-white rounded-3xl border border-slate-100 text-slate-400 font-bold shadow-sm">
            {showHistory ? "Nessuna legge in archivio." : "Nessuna proposta in votazione."}
          </div>
        )}
        {displayLaws.map((l: any) => {
          const lawDef = registry && registry[l.type];
          const defaultTitle = lawDef ? lawDef.title : l.type;

          let paramsDesc = "";
          try {
            const p = l.params ? JSON.parse(l.params) : { newValue: l.newValue };
            if (p.tax !== undefined) paramsDesc = `${p.tax}%`;
            if (p.name !== undefined) paramsDesc = `"${p.name}"`;
            if (p.newValue !== undefined && !l.params) paramsDesc = `${p.newValue}`; // fallback per vecchie leggi
          } catch { }

          // Minister fast-pass logic
          const canEconomicPass = isEconomicMinister && lawDef?.category === 'Economy';
          const canForeignPass = isForeignMinister && (lawDef?.category === 'Diplomacy' || lawDef?.category === 'Residency');
          const canFastPass = canEconomicPass || canForeignPass;

          return (
            <div key={l.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-6 hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 shrink-0 hidden md:flex">
                <BookOpen className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center flex-wrap gap-2 mb-2">
                  <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider ${l.status === 'pending' ? 'bg-amber-100 text-amber-700' : l.status === 'passed' ? 'bg-emerald-100 text-emerald-700' : l.status === 'withdrawn' ? 'bg-slate-100 text-slate-600' : 'bg-rose-100 text-rose-700'}`}>
                    {l.status === 'pending' ? 'In Votazione' : l.status === 'passed' ? 'Approvata' : l.status === 'withdrawn' ? 'Ritirata' : 'Respinta'}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">{new Date(l.createdAt).toLocaleString()}</span>
                </div>
                <h4 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  {defaultTitle} {paramsDesc && <span className="text-indigo-600 bg-indigo-50 px-2 rounded-md text-sm">{paramsDesc}</span>}
                </h4>
                <p className="text-sm font-bold text-slate-500 mt-1">Proposta da <span className="text-indigo-500">{l.proposerName}</span></p>

                <div className="flex items-center flex-wrap gap-4 mt-4 text-xs font-black w-full">
                  <span className="text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg flex items-center gap-1 border border-emerald-100"><CheckCircle2 className="w-4 h-4" /> {l.yesVotes}</span>
                  <span className="text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg flex items-center gap-1 border border-rose-100"><Trash2 className="w-4 h-4" /> {l.noVotes}</span>
                  {l.status === 'pending' && l.proposerId === user?.id && (
                    <button disabled={acting} onClick={() => handleWithdraw(l.id)} className="ml-auto text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100 transition-colors flex items-center gap-1 shrink-0"><Trash2 className="w-4 h-4" /> Ritira</button>
                  )}
                  {l.status === 'pending' && canFastPass && (
                    <button disabled={acting} onClick={() => handlePass(l.id)} className="ml-auto bg-amber-500 text-white px-3 py-1.5 rounded-lg font-black uppercase tracking-widest text-[10px] shadow-md shadow-amber-100 hover:bg-amber-600 transition-all flex items-center gap-1 shrink-0">
                      <Zap className="w-3 h-3" /> Fast-Pass
                    </button>
                  )}
                </div>
              </div>

              {l.status === 'pending' && isMp && !l.myVote && !region?.dictatorship && (
                <div className="flex flex-col gap-2 shrink-0 md:justify-center">
                  <button disabled={acting} onClick={() => handleVote(l.id, 'yes')} className="bg-emerald-500 text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all">SÌ</button>
                  <button disabled={acting} onClick={() => handleVote(l.id, 'no')} className="bg-rose-500 text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-200 hover:bg-rose-600 transition-all">NO</button>
                </div>
              )}
              {l.status === 'pending' && l.myVote && (
                <div className="flex items-center justify-center shrink-0">
                  <span className="text-sm font-black text-slate-400 bg-slate-50 px-4 py-2 border border-slate-100 rounded-xl">Hai votato '{l.myVote.vote}'</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
