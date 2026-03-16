import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Search, Landmark } from "lucide-react";

type Region = {
  id: string;
  name: string;
  population?: number;
  nation_id?: string | null;
  ownerName?: string;
};

export default function IndependentRegionsList() {
  const navigate = useNavigate();
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/regions");
      if (res.ok) {
        const data = await res.json();
        setRegions(Array.isArray(data) ? data : []);
      }
    } catch {
      setRegions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return regions
      .filter(r => !r.nation_id)
      .filter(r =>
        !q ||
        (r.name || "").toLowerCase().includes(q) ||
        (r.id || "").toLowerCase().includes(q)
      );
  }, [regions, search]);

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-24">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="px-3 py-2 rounded-xl bg-gray-800 text-gray-200 border border-gray-700 hover:border-indigo-500/50 transition-colors">
          ←
        </button>
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">STATISTICHE MONDO</p>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Landmark className="w-5 h-5 text-orange-400" />
            Regioni Indipendenti
          </h1>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cerca regione..."
          className="w-full bg-gray-900 text-white border border-gray-700 rounded-2xl pl-11 pr-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">Caricamento regioni...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-12">Nessuna regione indipendente trovata.</div>
      ) : (
        <div className="grid gap-2">
          {filtered.map((r) => (
            <div key={r.id} className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gray-800 flex items-center justify-center text-lg">
                <MapPin className="w-5 h-5 text-orange-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-white leading-tight">{r.name}</p>
                <div className="flex gap-3 text-[11px] text-gray-400 font-semibold mt-1 flex-wrap">
                  <span>{r.id}</span>
                  <span>Pop. {(r.population || 0).toLocaleString()}</span>
                  {r.ownerName && <span>CEO {r.ownerName}</span>}
                </div>
              </div>
              <button
                onClick={() => navigate(`/countries/${r.id}`)}
                className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors"
              >
                Apri
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
