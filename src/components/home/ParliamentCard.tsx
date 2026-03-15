/**
 * ParliamentCard – Quick-access parliament section for the Home dashboard.
 * Shows pending laws with vote counts, timer, and quick vote buttons.
 */
import React, { useState, useEffect } from "react";
import { Landmark, ThumbsUp, ThumbsDown, Minus, Clock, ChevronRight, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { PendingLaw } from "./mockData";

interface ParliamentCardProps {
  laws: PendingLaw[];
  governmentForm?: string;
}

const formatTimeRemaining = (endsAt: number): string => {
  const ms = Math.max(0, endsAt - Date.now());
  if (ms <= 0) return "Scaduto";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const VoteBar = ({ votesFor, votesAgainst, abstentions, totalVoters }: {
  votesFor: number;
  votesAgainst: number;
  abstentions: number;
  totalVoters: number;
}) => {
  const forPct = totalVoters > 0 ? (votesFor / totalVoters) * 100 : 0;
  const againstPct = totalVoters > 0 ? (votesAgainst / totalVoters) * 100 : 0;
  const abstainPct = totalVoters > 0 ? (abstentions / totalVoters) * 100 : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex h-2 rounded-full overflow-hidden bg-gray-700/50">
        {forPct > 0 && <div className="bg-emerald-500 transition-all" style={{ width: `${forPct}%` }} />}
        {abstainPct > 0 && <div className="bg-sky-500 transition-all" style={{ width: `${abstainPct}%` }} />}
        {againstPct > 0 && <div className="bg-red-500 transition-all" style={{ width: `${againstPct}%` }} />}
      </div>
      <div className="flex justify-between text-[9px] font-bold">
        <span className="text-emerald-400">✓ {votesFor} ({forPct.toFixed(0)}%)</span>
        <span className="text-sky-400">— {abstentions}</span>
        <span className="text-red-400">✗ {votesAgainst} ({againstPct.toFixed(0)}%)</span>
      </div>
    </div>
  );
};

export default function ParliamentCard({ laws, governmentForm }: ParliamentCardProps) {
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now());
  const isDictatorship = governmentForm === 'DICTATORSHIP' || governmentForm === 'EXECUTIVE_MONARCHY';

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(iv);
  }, []);

  const pendingLaws = laws.filter(l => l.status === 'pending');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">⚖️ Parlamento</h3>
        <button
          onClick={() => navigate("/parliament")}
          className="flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Apri <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {isDictatorship && (
        <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-3 flex items-center gap-2">
          <Crown className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-[10px] text-red-300 font-medium">
            {governmentForm === 'EXECUTIVE_MONARCHY'
              ? 'Monarchia Esecutiva – Il sovrano ha potere legislativo diretto.'
              : 'Dittatura – Le leggi sono decretate dal Leader senza voto parlamentare.'}
          </p>
        </div>
      )}

      {pendingLaws.length === 0 ? (
        <div className="bg-gray-800/40 border border-gray-700/30 rounded-xl p-4 text-center">
          <Landmark className="w-6 h-6 text-gray-600 mx-auto mb-2" />
          <p className="text-xs text-gray-500 font-medium">Nessuna legge in sospeso</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pendingLaws.slice(0, 2).map((law) => (
            <div key={law.id} className="bg-gray-800/60 border border-gray-700/40 rounded-xl p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{law.title}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{law.target} • Proposta da {law.proposedBy}</p>
                </div>
                <div className="flex items-center gap-1 bg-gray-700/50 px-2 py-1 rounded-lg shrink-0">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] font-bold text-amber-400 tabular-nums">{formatTimeRemaining(law.endsAt)}</span>
                </div>
              </div>
              {law.cost > 0 && (
                <p className="text-[10px] text-yellow-400/80 font-medium">💰 Costo: €{law.cost.toLocaleString()}</p>
              )}
              <VoteBar
                votesFor={law.votesFor}
                votesAgainst={law.votesAgainst}
                abstentions={law.abstentions}
                totalVoters={law.totalVoters}
              />
              {!isDictatorship && (
                <div className="flex gap-2 pt-1">
                  <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-all text-white text-xs font-bold">
                    <ThumbsUp className="w-3.5 h-3.5" /> A Favore
                  </button>
                  <button className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 active:scale-95 transition-all text-white text-xs font-bold">
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-600 hover:bg-red-500 active:scale-95 transition-all text-white text-xs font-bold">
                    <ThumbsDown className="w-3.5 h-3.5" /> Contro
                  </button>
                </div>
              )}
            </div>
          ))}
          {pendingLaws.length > 2 && (
            <button
              onClick={() => navigate("/parliament")}
              className="w-full py-2 text-center text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              + Altre {pendingLaws.length - 2} leggi in sospeso
            </button>
          )}
        </div>
      )}
    </div>
  );
}
