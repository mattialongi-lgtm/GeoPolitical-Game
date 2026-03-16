import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Users, Zap, MapPin, Clock, Search } from "lucide-react";

type Player = {
  id: string;
  username: string;
  regionId?: string | null;
  originalNation?: string | null;
  level?: number | null;
  lastLogin?: number | string | null;
};

interface PlayersResponse {
  players: Player[];
  total: number;
  onlineOnly?: boolean;
}

const formatTimeAgo = (ts?: number | string | null) => {
  if (!ts) return "mai";
  const ms = typeof ts === "string" ? new Date(ts).getTime() : ts;
  const diff = Date.now() - ms;
  if (diff < 60 * 1000) return "ora";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m fa`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h fa`;
  const days = Math.floor(hours / 24);
  return `${days}g fa`;
};

export default function PlayersList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const onlineOnly = searchParams.get("filter") === "online";

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/players${onlineOnly ? "?online=true" : ""}`);
      if (res.ok) {
        const data: PlayersResponse = await res.json();
        setPlayers(data.players || []);
      }
    } catch {
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [onlineOnly]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return players;
    return players.filter(p =>
      (p.username || "").toLowerCase().includes(q) ||
      (p.regionId || "").toLowerCase().includes(q) ||
      (p.originalNation || "").toLowerCase().includes(q)
    );
  }, [players, search]);

  const setFilter = (online: boolean) => {
    setSearchParams(online ? { filter: "online" } : {});
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-24">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="px-3 py-2 rounded-xl bg-gray-800 text-gray-200 border border-gray-700 hover:border-indigo-500/50 transition-colors">
          ←
        </button>
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">STATISTICHE MONDO</p>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            Giocatori
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setFilter(false)}
          className={`py-2 rounded-xl text-[11px] font-black uppercase tracking-widest ${!onlineOnly ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 border border-gray-700'}`}
        >
          Tutti
        </button>
        <button
          onClick={() => setFilter(true)}
          className={`py-2 rounded-xl text-[11px] font-black uppercase tracking-widest ${onlineOnly ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 border border-gray-700'}`}
        >
          Online
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cerca per nome, regione o stato..."
          className="w-full bg-gray-900 text-white border border-gray-700 rounded-2xl pl-11 pr-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">Caricamento giocatori...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-12">Nessun giocatore trovato.</div>
      ) : (
        <div className="grid gap-2">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-2xl bg-gray-800 flex items-center justify-center text-sm font-black text-white">
                {(p.username || "?").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-white leading-tight">{p.username}</p>
                <div className="flex gap-3 text-[11px] text-gray-400 font-semibold mt-1 flex-wrap">
                  <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Lv {p.level || 1}</span>
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {p.regionId || "N/D"}</span>
                  <span className="flex items-center gap-1">🌐 {p.originalNation || "N/D"}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatTimeAgo(p.lastLogin)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
