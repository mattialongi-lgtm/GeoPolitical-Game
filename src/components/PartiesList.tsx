import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Users, Search, Shield } from "lucide-react";

type Party = {
  id: string;
  name: string;
  ideology?: string | null;
  tag?: string | null;
  regionId?: string | null;
  members?: number;
  logo?: string | null;
};

export default function PartiesList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get("search") || "";
  
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialSearch);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/parties");
      if (res.ok) {
        const data = await res.json();
        setParties(Array.isArray(data) ? data : (data.parties || []));
      }
    } catch {
      setParties([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return parties;
    return parties.filter(p =>
      (p.name || "").toLowerCase().includes(q) ||
      (p.tag || "").toLowerCase().includes(q) ||
      (p.regionId || "").toLowerCase().includes(q)
    );
  }, [parties, search]);

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-24">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="px-3 py-2 rounded-xl bg-gray-800 text-gray-200 border border-gray-700 hover:border-indigo-500/50 transition-colors">
          ←
        </button>
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">STATISTICHE MONDO</p>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" />
            Partiti
          </h1>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cerca partito per nome o tag..."
          className="w-full bg-gray-900 text-white border border-gray-700 rounded-2xl pl-11 pr-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">Caricamento partiti...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-12">Nessun partito trovato.</div>
      ) : (
        <div className="grid gap-2">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-2xl bg-gray-800 flex items-center justify-center text-lg overflow-hidden">
                {p.logo ? (
                  p.logo.startsWith("http") ? (
                    <img src={p.logo} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    p.logo
                  )
                ) : (
                  "🛡️"
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-white leading-tight">{p.name}</p>
                <div className="flex gap-3 text-[11px] text-gray-400 font-semibold mt-1 flex-wrap">
                  {p.tag && <span>[{p.tag}]</span>}
                  {p.regionId && <span>🌐 {p.regionId}</span>}
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {p.members || 0}</span>
                  {p.ideology && <span>{p.ideology}</span>}
                </div>
              </div>
              <button
                onClick={() => navigate("/party")}
                className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors"
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
