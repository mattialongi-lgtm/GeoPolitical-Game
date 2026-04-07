import React, { useState } from "react";
import {
  Users,
  Edit2,
  Crown,
  ArrowRight,
  Trash2,
  DollarSign,
  Loader2,
  Trophy,
  Check,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export const PartyDashboard = ({ party, members, activeMembersCount, myRole, user, reload, fetchData, primariesVoteCounts, hasVotedPrimaries }: any) => {
  const [activeTab, setActiveTab] = useState('info');
  const [loading, setLoading] = useState(false);
  const [targetUser, setTargetUser] = useState<any>(null);

  // Modals
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ name: party.name, ideology: party.ideology, tag: party.tag, description: party.description, logo: party.logo });
  const [showInvite, setShowInvite] = useState(false);
  const [inviteId, setInviteId] = useState("");

  // Economy
  const [wageForm, setWageForm] = useState({ targetUserId: '', salaryCash: 0, salaryGold: 0 });
  const [contributeForm, setContributeForm] = useState({ targetUserId: '', itemType: 'cash', amount: 0 });

  const maxGoldTotal = Math.min(5000, activeMembersCount * 100);
  const maxGoldPerUser = Math.min(200, 50 + (activeMembersCount * 5));

  const isLeader = myRole === 'leader';
  const isSecretary = myRole === 'secretary' || isLeader;

  const handleEdit = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/parties/edit", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ partyId: party.id, ...editForm }) });
      if ((await res.json()).error) alert("Errore modifica");
      else { setShowEdit(false); reload(); }
    } finally { setLoading(false); }
  };

  const handleInvite = async () => {
    if (!inviteId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/parties/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetUserId: inviteId }) });
      const data = await res.json();
      if (data.error) alert(data.error);
      else { alert("Invito inviato!"); setShowInvite(false); setInviteId(""); }
    } finally { setLoading(false); }
  };

  const handleRole = async (targetUserId: string, newRole: string) => {
    try {
      const res = await fetch("/api/parties/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ partyId: party.id, targetUserId, newRole }) });
      if (!(await res.json()).error) reload();
    } catch { alert("Errore"); }
  };

  const handleKick = async (targetUserId: string) => {
    if (!window.confirm("Sei sicuro di voler espellere questo membro?")) return;
    try {
      const res = await fetch("/api/parties/kick", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ partyId: party.id, targetUserId }) });
      if (!(await res.json()).error) reload();
    } catch { alert("Errore"); }
  };

  const handleSetWage = async () => {
    try {
      const res = await fetch("/api/parties/set-wage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ partyId: party.id, ...wageForm }) });
      const data = await res.json();
      if (data.error) alert(data.error);
      else reload();
    } catch { alert("Errore"); }
  };

  const handlePayWages = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/parties/pay-wages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ partyId: party.id }) });
      const data = await res.json();
      if (data.error) alert(data.error);
      else { alert(`Pagati ${data.totalCash}$ e ${data.totalGold}G a ${data.paidMembers} membri.`); fetchData(); }
    } catch { alert("Errore"); }
    finally { setLoading(false); }
  };

  const handleContribute = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/parties/contribute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(contributeForm) });
      const data = await res.json();
      if (data.error) alert(data.error);
      else { alert("Inviato!"); setTargetUser(null); fetchData(); }
    } catch { alert("Errore"); }
    finally { setLoading(false); }
  };

  const handleVote = async (candidateId: string) => {
    try {
      const res = await fetch("/api/parties/primaries-vote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateId }) });
      const data = await res.json();
      if (data.error) alert(data.error);
      else { alert("Voto registrato!"); reload(); }
    } catch { alert("Errore"); }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-900/60 p-6 md:p-8 rounded-2xl border border-gray-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          {party.logo ? <img src={party.logo} className="w-32 h-32 rounded-3xl" /> : <Users className="w-32 h-32" />}
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6">
          {party.logo ? <img src={party.logo} className="w-24 h-24 rounded-2xl shadow-md object-cover" /> : <div className="w-24 h-24 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center"><Users className="w-10 h-10 text-indigo-400" /></div>}
          <div className="flex-1">
            <h1 className="text-3xl font-black text-gray-100 leading-tight">{party.name} {party.tag && <span className="text-indigo-400">[{party.tag}]</span>}</h1>
            <p className="text-gray-400 font-bold mt-1 max-w-xl">{party.description || "Nessuna descrizione."}</p>
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="bg-gray-800/50 text-gray-400 border border-gray-700/40 px-3 py-1 rounded-lg text-xs font-bold uppercase">Ideologia: {party.ideology || "Non definita"}</span>
              <span className="bg-gray-800/50 text-gray-400 border border-gray-700/40 px-3 py-1 rounded-lg text-xs font-bold uppercase">Regione: {party.regionId}</span>
              <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-3 py-1 rounded-lg text-xs font-black uppercase">Membri Attivi: {activeMembersCount}</span>
            </div>
          </div>
          {isLeader && (
            <button onClick={() => setShowEdit(true)} className="bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/40 text-gray-300 p-3 rounded-xl transition-colors shrink-0">
              <Edit2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex overflow-x-auto gap-2 pb-2">
        <button onClick={() => setActiveTab('info')} className={`px-5 py-2.5 rounded-xl font-black text-sm uppercase tracking-wider whitespace-nowrap transition-colors ${activeTab === 'info' ? 'bg-indigo-600 text-white' : 'bg-gray-800/50 border border-gray-700/40 text-gray-400 hover:bg-gray-700/50'}`}>Membri</button>
        <button onClick={() => setActiveTab('economy')} className={`px-5 py-2.5 rounded-xl font-black text-sm uppercase tracking-wider whitespace-nowrap transition-colors ${activeTab === 'economy' ? 'bg-indigo-600 text-white' : 'bg-gray-800/50 border border-gray-700/40 text-gray-400 hover:bg-gray-700/50'}`}>Economia & Salari</button>
        <button onClick={() => setActiveTab('primaries')} className={`px-5 py-2.5 rounded-xl font-black text-sm uppercase tracking-wider whitespace-nowrap transition-colors ${activeTab === 'primaries' ? 'bg-indigo-600 text-white' : 'bg-gray-800/50 border border-gray-700/40 text-gray-400 hover:bg-gray-700/50'}`}>Primarie</button>
      </div>

      {activeTab === 'info' && (
        <div className="bg-gray-900/60 rounded-2xl border border-gray-800 p-6 overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-gray-100">Iscritti ({members.length})</h3>
            {isSecretary && (
              <button onClick={() => setShowInvite(true)} className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 px-4 py-2 font-black text-xs uppercase tracking-widest rounded-xl transition-colors shrink-0">
                + Invita Membro
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="pb-3 px-2 text-xs font-black text-gray-400 uppercase tracking-widest">Player</th>
                  <th className="pb-3 px-2 text-xs font-black text-gray-400 uppercase tracking-widest">Ruolo</th>
                  <th className="pb-3 px-2 text-xs font-black text-gray-400 uppercase tracking-widest">Attività</th>
                  <th className="pb-3 px-2 text-xs font-black text-gray-400 uppercase tracking-widest">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {members.map((m: any) => {
                  const lastLoginTs = typeof m.lastLogin === 'string' ? new Date(m.lastLogin).getTime() : (m.lastLogin || 0);
                  const isActive = Date.now() - lastLoginTs <= 48 * 60 * 60 * 1000;
                  return (
                    <tr key={m.userId} className="hover:bg-gray-800/30 transition-colors">
                      <td className="py-4 px-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gray-800/60 border border-gray-700/40 flex items-center justify-center font-bold text-gray-400">{m.level}</div>
                          <span className="font-bold text-gray-100">{m.username}</span>
                          {m.userId === party.leaderUserId && <Crown className="w-4 h-4 text-amber-400" />}
                        </div>
                      </td>
                      <td className="py-4 px-2 font-bold capitalize">
                        {m.role === 'leader' ? <span className="text-amber-400">Leader</span> : m.role === 'secretary' ? <span className="text-indigo-400">Segretario</span> : <span className="text-gray-400">Membro</span>}
                      </td>
                      <td className="py-4 px-2">
                        {isActive ? <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-1 rounded text-[10px] font-black uppercase">Attivo</span> : <span className="bg-gray-800/50 border border-gray-700/40 text-gray-500 px-2 py-1 rounded text-[10px] font-black uppercase">Inattivo</span>}
                      </td>
                      <td className="py-4 px-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {m.userId !== user.id && (
                            <button onClick={() => setTargetUser(m)} className="bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 p-2 rounded-lg" title="Invia Contributo"><ArrowRight className="w-4 h-4" /></button>
                          )}
                          {isLeader && m.userId !== user.id && m.role !== 'leader' && (
                            <>
                              {m.role === 'secretary' ?
                                <button onClick={() => handleRole(m.userId, 'member')} className="bg-gray-800/50 border border-gray-700/40 text-gray-400 p-2 rounded-lg text-[10px] uppercase font-black tracking-wider hover:bg-gray-700/50" title="Rimuovi Segretario">Demansiona</button>
                                :
                                <button onClick={() => handleRole(m.userId, 'secretary')} className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-2 rounded-lg text-[10px] uppercase font-black tracking-wider hover:bg-emerald-500/20" title="Promuovi a Segretario">Promuovi</button>
                              }
                            </>
                          )}
                          {isSecretary && m.role !== 'leader' && m.userId !== user.id && (
                            <button onClick={() => handleKick(m.userId)} className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 p-2 rounded-lg" title="Espelli"><Trash2 className="w-4 h-4" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'economy' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 border-l-4 border-l-amber-400">
              <h4 className="text-gray-400 font-bold uppercase tracking-widest text-xs mb-1">Cap. Gold Distribuibile</h4>
              <p className="text-3xl font-black text-gray-100">{maxGoldTotal} <span className="text-sm text-gray-400">/ ciclo</span></p>
              <p className="text-xs text-gray-400 mt-2">Corrisponde a {activeMembersCount} membri attivi x 100 G.</p>
            </div>
            <div className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 border-l-4 border-l-sky-400">
              <h4 className="text-gray-400 font-bold uppercase tracking-widest text-xs mb-1">Max Gold per Utente</h4>
              <p className="text-3xl font-black text-gray-100">{maxGoldPerUser}</p>
              <p className="text-xs text-gray-400 mt-2">Limite personale per busta paga.</p>
            </div>
          </div>

          {isLeader && (
            <div className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 space-y-4 overflow-x-auto min-w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-black text-gray-100">Impostazione Salari</h3>
                <button onClick={handlePayWages} disabled={loading} className="bg-emerald-600 text-white px-6 py-3 font-black text-sm uppercase rounded-xl hover:bg-emerald-700 transition-all flex items-center gap-2 shrink-0">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />} Paga
                </button>
              </div>

              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="border-b border-gray-800 text-xs font-black text-gray-400 uppercase tracking-widest">
                    <th className="pb-3 px-2">Player</th>
                    <th className="pb-3 px-2 text-center">Cash ($)</th>
                    <th className="pb-3 px-2 text-center">Gold</th>
                    <th className="pb-3 px-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {members.map((m: any) => (
                    <tr key={m.userId} className="hover:bg-gray-800/30 transition-colors">
                      <td className="py-3 px-2 font-bold text-gray-200">{m.username} {m.userId === wageForm.targetUserId && <span className="ml-2 w-2 h-2 rounded-full bg-indigo-500 inline-block animate-pulse"></span>}</td>
                      <td className="py-3 px-2 text-center">
                        <input type="number" min={0} defaultValue={m.salaryCash} onChange={e => { setWageForm({ targetUserId: m.userId, salaryCash: parseInt(e.target.value) || 0, salaryGold: wageForm.targetUserId === m.userId ? wageForm.salaryGold : m.salaryGold }) }} className="w-20 md:w-24 bg-gray-800/60 border border-gray-700/40 rounded-lg p-1 text-sm font-bold text-gray-200 focus:border-indigo-500/50 outline-none text-center" />
                      </td>
                      <td className="py-3 px-2 text-center">
                        <input type="number" min={0} max={maxGoldPerUser} defaultValue={m.salaryGold} onChange={e => { setWageForm({ targetUserId: m.userId, salaryGold: parseInt(e.target.value) || 0, salaryCash: wageForm.targetUserId === m.userId ? wageForm.salaryCash : m.salaryCash }) }} className="w-16 md:w-20 bg-amber-500/10 border border-amber-400/30 rounded-lg p-1 text-sm font-bold text-amber-300 outline-none text-center focus:border-amber-400/50" />
                      </td>
                      <td className="py-3 px-2 text-right">
                        <button onClick={handleSetWage} className="bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 px-4 py-2 rounded-lg text-[10px] font-black uppercase disabled:opacity-50" disabled={wageForm.targetUserId !== m.userId}>Salva</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'primaries' && (
        <div className="bg-gray-900/60 p-6 md:p-10 rounded-2xl border border-gray-800 text-center">
          <Trophy className="w-16 h-16 text-gray-700 mx-auto mb-4" />
          <h3 className="text-2xl font-black text-gray-100 mb-2">Elezioni Primarie</h3>
          <p className="text-gray-400 font-bold mb-8 max-w-md mx-auto">Vota un membro del tuo partito! I vincitori avranno la possibilità di candidarsi al Parlamento per le Elezioni Nazionali. Ciclo ogni 5 giorni.</p>

          {hasVotedPrimaries && (
            <div className="flex items-center justify-center gap-2 mb-6 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-black text-emerald-400 uppercase">Hai già votato in questo ciclo</span>
            </div>
          )}

          <div className="grid gap-3 max-w-lg mx-auto text-left">
            {members.map((m: any) => (
              <div key={m.userId} className="flex justify-between items-center bg-gray-800/50 border border-gray-700/40 p-4 rounded-xl hover:border-indigo-500/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center font-black text-indigo-400">{m.level}</div>
                  <div>
                    <p className="font-black text-gray-100 leading-tight">{m.username}</p>
                    <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">{m.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-black text-indigo-400">{primariesVoteCounts[m.userId] || 0} voti</span>
                  {hasVotedPrimaries ? (
                    <span className="bg-gray-800/50 border border-gray-700/40 text-gray-500 px-5 py-2 font-black tracking-widest uppercase text-xs rounded-xl">
                      Votato
                    </span>
                  ) : (
                    <button onClick={() => handleVote(m.userId)} className="bg-indigo-600 text-white hover:bg-indigo-700 px-5 py-2 font-black tracking-widest uppercase text-xs rounded-xl transition-all">
                      Vota
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Target User Contribute Modal */}
      <AnimatePresence>
        {targetUser && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setTargetUser(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-gray-900 p-8 rounded-2xl shadow-2xl overflow-hidden relative z-10 w-full max-w-md border border-gray-700/50 space-y-6">
              <h3 className="text-2xl font-black text-gray-100 leading-tight">Invia a {targetUser.username}</h3>
              <p className="text-sm text-gray-400 font-bold px-4 py-2 bg-gray-800/50 border border-gray-700/40 rounded-xl mt-2 line-clamp-3">I trasferimenti di fondi di partito sono tracciati nel log.</p>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1 mb-1 block">Risorsa</label>
                  <select value={contributeForm.itemType} onChange={e => setContributeForm({ ...contributeForm, targetUserId: targetUser.userId, itemType: e.target.value })} className="w-full bg-gray-800/60 border border-gray-700/40 p-3 rounded-xl font-bold outline-none text-gray-200 focus:border-indigo-500/50">
                    <option value="cash">💵 Cash ($)</option>
                    <option value="gold">🪙 Gold</option>
                    <option value="oil">🛢️ Petrolio</option>
                    <option value="minerals">🪨 Minerali</option>
                    <option value="uranium">☢️ Uranio</option>
                    <option value="diamonds">💎 Diamanti</option>
                    <option value="tank">🛡️ Carri armati</option>
                    <option value="aircraft">✈️ Aerei</option>
                    <option value="battleship">🚢 Corazzate navali</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1 mb-1 block">Quantità</label>
                  <input type="number" min={1} value={contributeForm.amount || ''} onChange={e => setContributeForm({ ...contributeForm, targetUserId: targetUser.userId, amount: parseInt(e.target.value) || 0 })} className="w-full bg-gray-800/60 border border-gray-700/40 p-3 rounded-xl font-bold outline-none text-gray-200 focus:border-indigo-500/50 focus:ring-2 ring-indigo-500/20" placeholder="0" />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={() => setTargetUser(null)} className="flex-1 px-4 py-3 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/40 text-gray-400 font-black rounded-xl uppercase tracking-widest text-xs transition-colors">Annulla</button>
                <button onClick={handleContribute} disabled={loading || !contributeForm.amount} className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl uppercase tracking-widest text-xs transition-colors disabled:opacity-50">Invia</button>
              </div>
            </motion.div>
          </div>
        )}

        {showEdit && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowEdit(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-gray-900 p-8 rounded-2xl shadow-2xl overflow-hidden relative z-10 w-full max-w-md border border-gray-700/50 space-y-6">
              <h3 className="text-2xl font-black text-gray-100 leading-tight">Modifica Partito</h3>
              <div className="space-y-3">
                <input placeholder="Nome" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="w-full bg-gray-800/60 border border-gray-700/40 p-3 rounded-xl font-bold text-gray-200 focus:border-indigo-500/50 outline-none placeholder:text-gray-500" />
                <input placeholder="Tag" value={editForm.tag} onChange={e => setEditForm({ ...editForm, tag: e.target.value })} className="w-full bg-gray-800/60 border border-gray-700/40 p-3 rounded-xl font-bold text-gray-200 focus:border-indigo-500/50 outline-none placeholder:text-gray-500" />
                <input placeholder="Ideologia" value={editForm.ideology} onChange={e => setEditForm({ ...editForm, ideology: e.target.value })} className="w-full bg-gray-800/60 border border-gray-700/40 p-3 rounded-xl font-bold text-gray-200 focus:border-indigo-500/50 outline-none placeholder:text-gray-500" />
                <textarea placeholder="Descrizione" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} className="w-full bg-gray-800/60 border border-gray-700/40 p-3 rounded-xl font-bold text-gray-200 focus:border-indigo-500/50 outline-none resize-none h-24 placeholder:text-gray-500" />
                <input placeholder="URL Logo" value={editForm.logo} onChange={e => setEditForm({ ...editForm, logo: e.target.value })} className="w-full bg-gray-800/60 border border-gray-700/40 p-3 rounded-xl font-bold text-gray-200 focus:border-indigo-500/50 outline-none placeholder:text-gray-500" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowEdit(false)} className="flex-1 px-4 py-3 bg-gray-800/50 border border-gray-700/40 text-gray-400 font-black rounded-xl uppercase tracking-widest text-xs transition-colors">Annulla</button>
                <button onClick={handleEdit} disabled={loading} className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl uppercase tracking-widest text-xs transition-colors">Salva</button>
              </div>
            </motion.div>
          </div>
        )}

        {showInvite && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowInvite(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-gray-900 p-8 rounded-2xl shadow-2xl relative z-10 w-full max-w-sm border border-gray-700/50 space-y-4">
              <h3 className="text-xl font-black text-gray-100 leading-tight">Invita Membro</h3>
              <p className="text-sm font-bold text-gray-400">Inserisci l'ID dell'utente da invitare:</p>
              <input placeholder="User ID" value={inviteId} onChange={e => setInviteId(e.target.value)} className="w-full bg-gray-800/60 border border-gray-700/40 p-3 rounded-xl font-bold text-gray-200 focus:border-indigo-500/50 outline-none placeholder:text-gray-500" />
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowInvite(false)} className="flex-1 px-4 py-3 bg-gray-800/50 border border-gray-700/40 text-gray-400 font-black rounded-xl uppercase tracking-widest text-xs">Annulla</button>
                <button onClick={handleInvite} className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl uppercase tracking-widest text-xs">Invia</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
