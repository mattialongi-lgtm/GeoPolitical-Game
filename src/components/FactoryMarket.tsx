/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Filter, Loader2, TrendingUp, ShoppingCart, Warehouse } from "lucide-react";
import { FACTORY_CONFIG, factoryYieldMultiplier, factoryStorageLimit } from "../types";

interface FactoryMarketProps {
  user: any;
  fetchData: () => void;
}

export default function FactoryMarket({ user, fetchData }: FactoryMarketProps) {
  const navigate = useNavigate();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("price_asc");
  const [selectedListing, setSelectedListing] = useState<any>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/factory-market");
      if (res.ok) setListings(await res.json());
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleBuy = async (listingId: string) => {
    const listing = listings.find(l => l.id === listingId);
    if (!listing) return;
    if (!window.confirm(`Acquistare ${listing.factory?.name || 'fabbrica'} per €${listing.askingPrice?.toLocaleString()}?`)) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/factory-market/buy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else {
        alert("Acquisto completato! La fabbrica è ora tua.");
        fetchData(); load();
        setSelectedListing(null);
      }
    } catch { alert("Errore nell'acquisto"); } finally { setActionLoading(false); }
  };

  const filteredListings = useMemo(() => {
    let result = [...listings];

    // Filter by type
    if (filterType !== 'all') {
      result = result.filter(l => l.factory?.type === filterType);
    }

    // Filter by search
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(l =>
        (l.factory?.name || '').toLowerCase().includes(s) ||
        (l.sellerName || '').toLowerCase().includes(s) ||
        (l.factory?.regionId || '').toLowerCase().includes(s)
      );
    }

    // Sort
    switch (sortBy) {
      case 'price_asc': result.sort((a, b) => a.askingPrice - b.askingPrice); break;
      case 'price_desc': result.sort((a, b) => b.askingPrice - a.askingPrice); break;
      case 'level_desc': result.sort((a, b) => (b.factory?.level || 0) - (a.factory?.level || 0)); break;
      case 'yield_desc': result.sort((a, b) => (b.factory?.yieldMultiplier || 0) - (a.factory?.yieldMultiplier || 0)); break;
    }

    return result;
  }, [listings, filterType, search, sortBy]);

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-24">
      {/* Back button */}
      <button onClick={() => navigate("/work")} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Torna alle Fabbriche
      </button>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
          <ShoppingCart className="w-6 h-6 inline mr-2 text-indigo-600" />
          Mercato Fabbriche
        </h2>
        <span className="text-xs font-black text-slate-400 uppercase">{filteredListings.length} annunci</span>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100 space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cerca per nome, venditore, regione..."
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 focus:ring-4 focus:ring-indigo-50 outline-none text-sm font-bold text-slate-700"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[10px] font-black uppercase text-slate-600 outline-none"
          >
            <option value="all">Tutti i tipi</option>
            {Object.entries(FACTORY_CONFIG.TYPES).map(([key, def]) => (
              <option key={key} value={key}>{def.icon} {def.label}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[10px] font-black uppercase text-slate-600 outline-none"
          >
            <option value="price_asc">Prezzo ↑</option>
            <option value="price_desc">Prezzo ↓</option>
            <option value="level_desc">Livello ↓</option>
            <option value="yield_desc">Rendimento ↓</option>
          </select>
        </div>
      </div>

      {/* Listings */}
      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : filteredListings.length === 0 ? (
        <div className="bg-white p-10 rounded-[2rem] text-center border border-slate-100">
          <ShoppingCart className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 font-bold text-sm">Nessuna fabbrica in vendita al momento.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredListings.map((listing) => {
            const factory = listing.factory || {};
            const typeDef = factory.typeDef || FACTORY_CONFIG.TYPES[factory.type] || {};
            const isGoldMine = typeDef.category === 'gold';
            const isSelected = selectedListing?.id === listing.id;
            const isSeller = listing.sellerId === user?.id;

            return (
              <div
                key={listing.id}
                className={`bg-white p-5 rounded-[2.5rem] shadow-sm border transition-all ${isSelected ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-100 hover:border-indigo-200'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl bg-slate-50 shadow-inner">
                      {typeDef.icon || '🏭'}
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-base leading-tight">{factory.name || 'Fabbrica'}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">
                        {typeDef.label} • {factory.regionId} • Lv {factory.level || 1}
                      </p>
                      <p className="text-[10px] font-bold text-slate-500">
                        Venditore: <span className="text-indigo-500">{listing.sellerName}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-emerald-600">€{listing.askingPrice?.toLocaleString()}</p>
                    <p className="text-[9px] font-bold text-slate-400">Valore: €{(factory.estimatedValue || 0).toLocaleString()}</p>
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex gap-2 mt-3 flex-wrap">
                  <span className="text-[9px] font-black uppercase px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600">
                    Yield: x{factory.yieldMultiplier || 1}
                  </span>
                  {!isGoldMine && (
                    <span className="text-[9px] font-black uppercase px-2 py-1 rounded-lg bg-blue-50 text-blue-600">
                      <Warehouse className="w-3 h-3 inline mr-0.5" /> {(factory.storageCapacity || 0).toLocaleString()}
                    </span>
                  )}
                  <span className="text-[9px] font-black uppercase px-2 py-1 rounded-lg bg-purple-50 text-purple-600">
                    Rarità: {'⭐'.repeat(Math.min(typeDef.rarity || 1, 5))}
                  </span>
                  <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${isGoldMine ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    {isGoldMine ? '🪙 Oro (€+Gold)' : `🪨 ${typeDef.label}`}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => navigate(`/factory/${factory.id}`)}
                    className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-black text-[10px] uppercase hover:bg-slate-200 transition-all"
                  >
                    📋 Dettagli
                  </button>
                  {!isSeller && (
                    <button
                      onClick={() => handleBuy(listing.id)}
                      disabled={actionLoading}
                      className="flex-1 py-2.5 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase shadow-md hover:bg-emerald-600 transition-all disabled:opacity-50"
                    >
                      {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : `🛒 Compra €${listing.askingPrice?.toLocaleString()}`}
                    </button>
                  )}
                  {isSeller && (
                    <span className="flex-1 py-2.5 bg-amber-100 text-amber-700 rounded-xl font-black text-[10px] uppercase text-center">
                      📤 Il tuo annuncio
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
