import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Search, Landmark } from "lucide-react";

type Region = {
  id: string;
  name: string;
  population?: number;
  playerCount?: number;
  nation_id?: string | null;
  ownerName?: string;
};

const REGION_IMAGES: Record<string, string> = {
  'US': 'https://images.unsplash.com/photo-1485738422979-f5c462d49f74', // NYC
  'AU': 'https://images.unsplash.com/photo-1523482580672-f109ba8cb9be', // Outback
  'ZW': 'https://images.unsplash.com/photo-1549410183-999370b4ba79', // Safari
  'AQ': 'https://images.unsplash.com/photo-1516762689617-e1cff9323381', // Ice
  'ZM': 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e', // Savanna
  'IT': 'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9', // Venice
  'FR': 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34', // Paris
  'DE': 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b', // Germany
  'GB': 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad', // London
  'ES': 'https://images.unsplash.com/photo-1543783207-ec64e4d95325', // Spain
  'CA': 'https://images.unsplash.com/photo-1503614472-8c93d56e92ce', // Canada
  'JP': 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e', // Japan
  'CN': 'https://images.unsplash.com/photo-1508197149814-0cc02e8b7f74', // China
  'RU': 'https://images.unsplash.com/photo-1512495039889-52a3b799c9bc', // Russia
  'BR': 'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5', // Brazil
  'IN': 'https://images.unsplash.com/photo-1514222139-b576bb55365f', // India
  'EG': 'https://images.unsplash.com/photo-1503177119275-0aa32b3a9368', // Egypt
  'CH': 'https://images.unsplash.com/photo-1506901437159-2bc3dbe4396b', // Switzerland
  'AT': 'https://images.unsplash.com/photo-1527004013197-933c4bb611b3', // Austria
};

const GENERIC_LANDSCAPES = [
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b',
  'https://images.unsplash.com/photo-1472214103451-9374bd1c798e',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470',
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e',
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb',
  'https://images.unsplash.com/photo-1532274402911-5a3b027c55b9',
  'https://images.unsplash.com/photo-1500382017468-9049fed747ef',
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05',
];

export default function IndependentRegionsList({
  regions,
  refreshRegionsAndNations,
}: {
  regions: Region[];
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
            <div key={r.id} className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 flex items-center gap-3 transition-all hover:bg-gray-800/40 group">
              <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden shrink-0 border border-gray-700/30">
                <img 
                  src={(REGION_IMAGES[r.id.split('-')[0]] || REGION_IMAGES[r.id.split('-')[1]] || REGION_IMAGES[r.id]) 
                       ? `${REGION_IMAGES[r.id.split('-')[0]] || REGION_IMAGES[r.id.split('-')[1]] || REGION_IMAGES[r.id]}?auto=format&fit=crop&w=160&q=80` 
                       : `${GENERIC_LANDSCAPES[Math.abs(r.id.split('').reduce((a,b)=>a+b.charCodeAt(0),0)) % GENERIC_LANDSCAPES.length]}?auto=format&fit=crop&w=160&q=80`}
                  alt={r.name}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=160&q=80";
                  }}
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-white leading-tight">{r.name}</p>
                <div className="flex gap-3 text-[11px] text-gray-400 font-semibold mt-1 flex-wrap">
                  <span>{r.id}</span>
                  <span>{r.playerCount || 0} utenti</span>
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
