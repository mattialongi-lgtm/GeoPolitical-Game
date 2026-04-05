import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Factory, MapPin, Search, TrendingUp, UserCircle } from "lucide-react";
import { FACTORY_CONFIG } from "../types";

interface FactoryItem {
  id: string;
  name: string;
  type: string;
  level: number;
  regionId: string;
  ownerName?: string;
  yieldMultiplier?: number;
  storageCapacity?: number;
  estimatedValue?: number;
}

export default function WorldFactoriesList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get("search") || "";
  
  const [factories, setFactories] = useState<FactoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialSearch);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/factories/all");
      if (res.ok) {
        const data = await res.json();
        setFactories(Array.isArray(data) ? data : []);
      }
    } catch {
      setFactories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = [...factories];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(f =>
        (f.name || "").toLowerCase().includes(q) ||
        (f.ownerName || "").toLowerCase().includes(q) ||
        (f.regionId || "").toLowerCase().includes(q)
      );
    }
    if (typeFilter !== "all") {
      list = list.filter(f => f.type === typeFilter);
    }
    return list;
  }, [factories, search, typeFilter]);

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-24">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="px-3 py-2 rounded-xl bg-gray-800 text-gray-200 border border-gray-700 hover:border-indigo-500/50 transition-colors">
          ←
        </button>
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">STATISTICHE MONDO</p>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Factory className="w-5 h-5 text-amber-400" />
            Fabbriche nel mondo
          </h1>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cerca per nome, proprietario o regione..."
            className="w-full bg-gray-900 text-white border border-gray-700 rounded-2xl pl-11 pr-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="w-full bg-gray-900 text-white border border-gray-700 rounded-2xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">Tutti i tipi</option>
          {Object.entries(FACTORY_CONFIG.TYPES).map(([key, def]) => (
            <option key={key} value={key}>{def.icon} {def.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">Caricamento fabbriche...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-12">Nessuna fabbrica trovata.</div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((f) => {
            const typeDef = (FACTORY_CONFIG.TYPES as any)[f.type] || { icon: "🏭", label: "Fabbrica" };
            return (
              <div key={f.id} className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gray-800 flex items-center justify-center text-2xl">
                      {typeDef.icon}
                    </div>
                    <div>
                      <p className="text-sm font-black text-white leading-tight">{f.name || "Fabbrica"}</p>
                      <p className="text-[11px] text-gray-400 uppercase font-bold">
                        {typeDef.label} • Lv {f.level || 1}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-amber-400">Yield x{f.yieldMultiplier || 1}</span>
                </div>
                <div className="flex flex-wrap gap-3 text-[11px] text-gray-400 font-semibold">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {f.regionId}</span>
                  <span className="flex items-center gap-1"><UserCircle className="w-3 h-3" /> {f.ownerName || "Sconosciuto"}</span>
                  <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Valore €{(f.estimatedValue || 0).toLocaleString()}</span>
                  {f.storageCapacity != null && <span>📦 {(f.storageCapacity || 0).toLocaleString()}</span>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/factory/${f.id}`)}
                    className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors"
                  >
                    Dettagli
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
