import React, { useState } from "react";
import {
  Trophy,
  Landmark,
} from "lucide-react";

export const ElectionsTab = ({ data, user, reload }: any) => {
  const [voting, setVoting] = useState(false);
  if (!data?.election) return (
    <div className="bg-gray-900/60 p-12 rounded-2xl border border-gray-800 text-center">
      <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-4" />
      <h3 className="text-xl font-black text-white">Nessuna Elezione</h3>
      <p className="text-gray-400 font-bold mt-2">Non ci sono elezioni attive al momento in {user.residenceId}.</p>
    </div>
  );

  const totalVotes = data.parties.reduce((sum: number, p: any) => sum + p.votes, 0);

  const handleVote = async (partyId: string) => {
    if (!window.confirm("Confermi il tuo voto? Non potrai cambiarlo!")) return;
    setVoting(true);
    try {
      const res = await fetch("/api/elections/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ electionId: data.election.id, partyId })
      });
      const json = await res.json();
      if (json.error) alert(json.error);
      else reload();
    } catch { alert("Errore di connessione"); }
    setVoting(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-900/60 p-6 md:p-8 rounded-2xl border border-gray-800 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 opacity-5 pointer-events-none"><Landmark className="w-48 h-48" /></div>
        <div className="relative z-10">
          <h3 className="text-2xl font-black text-white leading-tight">Elezioni Parlamentari ({user.residenceId})</h3>
          <p className="text-gray-400 font-bold mt-2">Si chiudono il: {new Date(data.election.closesAt).toLocaleString()}</p>
        </div>
      </div>

      <div className="grid gap-4">
        {data.parties.sort((a: any, b: any) => b.votes - a.votes).map((p: any) => {
          const perc = totalVotes > 0 ? ((p.votes / totalVotes) * 100).toFixed(1) : 0;
          return (
            <div key={p.id} className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="flex items-center gap-4 flex-1 w-full">
                {p.logo ? <img src={p.logo} alt="logo" className="w-16 h-16 rounded-2xl object-cover bg-gray-800 shrink-0" /> : <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center font-black text-xl text-indigo-400 border border-indigo-500/20 shrink-0">{p.tag || "P"}</div>}
                <div className="flex-1 w-full">
                  <p className="font-black text-white text-lg">{p.name} {p.tag && <span className="text-[10px] bg-gray-800/50 text-gray-400 px-2 py-1 rounded-md ml-2 align-middle border border-gray-700/40">{p.tag}</span>}</p>
                  <div className="mt-2 w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-indigo-500 h-full transition-all duration-1000" style={{ width: `${perc}%` }} />
                  </div>
                  <p className="text-xs font-black text-gray-400 mt-1">{p.votes} voti ({perc}%)</p>
                </div>
              </div>
              {!data.hasVoted ? (
                <button
                  disabled={voting}
                  onClick={() => handleVote(p.id)}
                  className="bg-indigo-600 text-white hover:bg-indigo-700 px-8 py-3 font-black tracking-widest uppercase text-xs rounded-xl shadow-lg shadow-indigo-900/30 transition-all w-full md:w-auto shrink-0 disabled:opacity-50"
                >
                  Vota
                </button>
              ) : (
                <span className="bg-gray-800/50 text-gray-400 px-6 py-3 font-black tracking-widest uppercase text-xs rounded-xl w-full md:w-auto text-center shrink-0 border border-gray-700/40">
                  Hai votato
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
