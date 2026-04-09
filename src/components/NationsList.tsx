import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Globe, MapPin, Users, Search, Crown } from "lucide-react";

type Nation = {
  id: string;
  name?: string | null;
  logo?: string | null;
  leaderUserId?: string | null;
  leaderName?: string | null;
  regionCount?: number;
  population?: number;
  playerCount?: number;
};

export default function NationsList({
  nations,
  refreshRegionsAndNations,
}: {
  nations: Nation[];
  refreshRegionsAndNations: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        await refreshRegionsAndNations();
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void refresh();
    return () => {
      mounted = false;
    };
  }, [refreshRegionsAndNations]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return nations;
    return nations.filter(n =>
      (n.name || "").toLowerCase().includes(q) ||
      (n.id || "").toLowerCase().includes(q)
    );
  }, [nations, search]);

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-24">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="px-3 py-2 rounded-xl bg-gray-800 text-gray-200 border border-gray-700 hover:border-indigo-500/50 transition-colors">
          ←
        </button>
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">STATISTICHE MONDO</p>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-400" />
            Stati
          </h1>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cerca stato per nome o codice..."
          className="w-full bg-gray-900 text-white border border-gray-700 rounded-2xl pl-11 pr-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">Caricamento stati...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-12">Nessuno stato trovato.</div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((n) => (
            <div
              key={n.id}
              className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 flex items-center gap-3 hover:border-indigo-500/40 transition-colors"
            >
              <div className="w-12 h-12 rounded-2xl bg-gray-800 flex items-center justify-center text-2xl overflow-hidden">
                {n.logo ? (
                  n.logo.startsWith("http") ? (
                    <img src={n.logo} alt={n.name || n.id} className="w-full h-full object-cover" />
                  ) : (
                    n.logo
                  )
                ) : (
                  "🏛️"
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-white leading-tight">{n.name || n.id}</p>
                <p className="text-[11px] text-gray-400 uppercase font-bold">{n.id}</p>
                <div className="flex gap-3 text-[11px] text-gray-400 font-semibold mt-1">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {n.regionCount || 0} regioni</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {n.playerCount || 0} utenti</span>
                  {n.leaderName && (
                    <span className="flex items-center gap-1"><Crown className="w-3 h-3" /> {n.leaderName}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => navigate(`/state/${n.id}`)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors"
              >
                Dettagli
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
