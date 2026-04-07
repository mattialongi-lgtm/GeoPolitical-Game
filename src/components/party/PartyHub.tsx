import React, { useState, useEffect } from "react";
import {
  Trophy,
  Loader2,
  ChevronRight,
  Users,
} from "lucide-react";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { PartyDashboard } from "./PartyDashboard";

export const PartyHub = ({ user, fetchData }: any) => {
  const navigate = useNavigate();
  const [partyData, setPartyData] = useState<any>(null);
  const [globalParties, setGlobalParties] = useState<any[]>([]);
  const [myInvites, setMyInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', ideology: '', tag: '', description: '', logo: '' });

  const loadContent = async () => {
    setLoading(true);
    try {
      const myRes = await fetch("/api/parties/my");
      if (myRes.ok) {
        setPartyData(await myRes.json());
      } else {
        const gp = await fetch("/api/parties");
        if (gp.ok) setGlobalParties(await gp.json());

        const inv = await fetch("/api/parties/my-invites");
        if (inv.ok) setMyInvites(await inv.json());
      }
    } catch {
      // no party
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadContent(); }, []);

  const handleCreate = async () => {
    if (!createForm.name) return alert("Nome obbligatorio");
    if (!window.confirm("Costicchia 100 Gold. Sei sicuro?")) return;
    try {
      const res = await fetch("/api/parties/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(createForm) });
      const data = await res.json();
      if (data.error) alert(data.error);
      else { alert("Partito creato!"); setShowCreate(false); fetchData(); loadContent(); }
    } catch { alert("Errore creazione"); }
  };

  const handleAcceptInvite = async (inviteId: string) => {
    try {
      const res = await fetch("/api/parties/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inviteId }) });
      const data = await res.json();
      if (data.error) alert(data.error);
      else { fetchData(); loadContent(); }
    } catch { alert("Errore"); }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>;

  if (partyData && partyData.party) {
    const { party, members, activeMembersCount, primariesVoteCounts, hasVotedPrimaries } = partyData;
    const myRole = members.find((m: any) => m.userId === user.id)?.role;
    return <PartyDashboard party={party} members={members} activeMembersCount={activeMembersCount} myRole={myRole} user={user} reload={loadContent} fetchData={fetchData} primariesVoteCounts={primariesVoteCounts || {}} hasVotedPrimaries={!!hasVotedPrimaries} />;
  }

  if (showCreate) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-900/60 p-6 md:p-8 rounded-2xl border border-gray-800 space-y-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-gray-100">Fonda un Partito</h2>
          <button onClick={() => setShowCreate(false)} className="text-gray-400 font-bold hover:text-gray-200 transition-colors bg-gray-800/50 border border-gray-700/40 px-3 py-1.5 rounded-lg text-sm">Annulla</button>
        </div>
        <p className="text-sm font-bold text-amber-300 bg-amber-500/15 border border-amber-400/30 p-4 rounded-xl leading-tight">Costo fondazione: 100 Gold. Sede Ufficiale: <span className="font-black">{user.residenceId || 'IT'}</span></p>

        <div className="grid gap-3">
          <input placeholder="Nome Partito *" value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} className="w-full bg-gray-800/60 border border-gray-700/40 focus:border-indigo-500/50 focus:ring-2 ring-indigo-500/20 outline-none p-3 block rounded-xl font-bold text-gray-200 transition-all placeholder:text-gray-500" />
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Tag (es. PLI)" value={createForm.tag} onChange={e => setCreateForm({ ...createForm, tag: e.target.value })} className="w-full bg-gray-800/60 border border-gray-700/40 focus:border-indigo-500/50 focus:ring-2 ring-indigo-500/20 outline-none p-3 block rounded-xl font-bold text-gray-200 transition-all placeholder:text-gray-500" />
            <input placeholder="Ideologia" value={createForm.ideology} onChange={e => setCreateForm({ ...createForm, ideology: e.target.value })} className="w-full bg-gray-800/60 border border-gray-700/40 focus:border-indigo-500/50 focus:ring-2 ring-indigo-500/20 outline-none p-3 block rounded-xl font-bold text-gray-200 transition-all placeholder:text-gray-500" />
          </div>
          <textarea placeholder="Descrizione del partito..." value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })} className="w-full bg-gray-800/60 border border-gray-700/40 focus:border-indigo-500/50 focus:ring-2 ring-indigo-500/20 outline-none p-3 block rounded-xl font-bold text-gray-200 transition-all h-24 resize-none placeholder:text-gray-500" />
          <input placeholder="URL Logo (Opzionale)" value={createForm.logo} onChange={e => setCreateForm({ ...createForm, logo: e.target.value })} className="w-full bg-gray-800/60 border border-gray-700/40 focus:border-indigo-500/50 focus:ring-2 ring-indigo-500/20 outline-none p-3 block rounded-xl font-bold text-gray-200 transition-all placeholder:text-gray-500" />
        </div>

        <button onClick={handleCreate} disabled={user.gold < 100} className="w-full py-4 text-white font-black tracking-widest uppercase rounded-2xl transition-all bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 mt-2">
          Fonda il Partito
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/20 p-8 rounded-2xl text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6 overflow-hidden relative">
        <div className="absolute -right-8 -top-8 opacity-10 pointer-events-none"><Trophy className="w-48 h-48" /></div>
        <div className="relative z-10">
          <h2 className="text-3xl font-black tracking-tight leading-none mb-2 text-gray-100">Politica Nazionale</h2>
          <p className="text-gray-400 font-bold text-sm max-w-sm">Unisciti a un partito per partecipare alle elezioni parlamentari o fondane uno nuovo per guidare il tuo paese.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="relative z-10 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-black transition-all w-full md:w-auto uppercase tracking-widest text-[10px] shrink-0">Fonda Partito</button>
      </div>

      {myInvites.length > 0 && (
        <div className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 space-y-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
          <h3 className="text-xl font-black tracking-tight text-gray-100 relative z-10">Inviti Pendenti</h3>
          <div className="grid gap-3 relative z-10">
            {myInvites.map(inv => (
              <div key={inv.id} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 p-4 bg-gray-800/50 border border-gray-700/40 rounded-xl">
                <div>
                  <p className="font-black text-gray-100 leading-tight">{inv.partyName}</p>
                  <p className="text-xs font-bold text-gray-400 mt-0.5">Invitato da <span className="text-indigo-400">{inv.inviterName}</span></p>
                </div>
                <button onClick={() => handleAcceptInvite(inv.id)} className="w-full md:w-auto bg-emerald-600 text-white px-5 py-2.5 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-emerald-700 transition-all shrink-0">Accetta</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-gray-900/60 p-6 md:p-8 rounded-2xl border border-gray-800 space-y-6">
        <h3 className="text-xl font-black tracking-tight text-gray-100">Partiti Esistenti ({globalParties.length})</h3>
        <div className="grid gap-3">
          {globalParties.map((p, i) => (
            <div key={p.id} className="flex flex-col md:flex-row md:items-center gap-4 p-4 border border-gray-800 hover:border-indigo-500/30 bg-gray-800/30 hover:bg-gray-800/50 rounded-xl transition-all cursor-pointer group">
              <div className="flex items-center gap-4 flex-1">
                <span className="text-xl font-black text-gray-600 w-8 text-center group-hover:text-indigo-400 transition-colors">#{i + 1}</span>
                {p.logo ? <img src={p.logo} alt="logo" className="w-14 h-14 rounded-xl object-cover bg-gray-800 shrink-0" /> : <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center font-black text-indigo-400 shrink-0">{p.tag || "P"}</div>}
                <div>
                  <p className="font-black text-gray-100 text-[15px] leading-tight transition-colors group-hover:text-indigo-300">{p.name} {p.tag && <span className="bg-gray-700/50 text-gray-400 px-1.5 py-0.5 rounded text-[10px] ml-1.5 align-middle select-none">{p.tag}</span>}</p>
                  <p className="text-[10px] font-bold text-gray-500 uppercase mt-1 tracking-wider"><span className="text-indigo-400">{p.memberCount} Membri</span> <span className="mx-1.5 text-gray-600">•</span> Leader: <span className="text-gray-300">{p.leaderName}</span></p>
                </div>
              </div>
              <div className="hidden md:flex shrink-0">
                <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-indigo-400 transition-colors" />
              </div>
            </div>
          ))}
          {globalParties.length === 0 && (
            <div className="p-10 text-center border border-dashed border-gray-700/50 rounded-xl bg-gray-800/20">
              <p className="text-gray-400 font-bold mb-1">Nessun partito fondato finora.</p>
              <p className="text-sm text-gray-500 font-bold">Sii il primo a scendere in politica!</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
