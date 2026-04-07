import React, { useState, useEffect } from "react";
import { Loader2, Zap, DollarSign } from "lucide-react";
import { ShoppingCart } from "lucide-react";
import { motion } from "motion/react";
import { User, GAME_CONFIG, RESOURCE_LABELS } from "../../types";
import { WEAPONS_CATALOG, LEGACY_MILITARY_UNITS } from "../../constants";
import { ResourceIcon } from "../ResourceIcon";

export const MarketView = ({ user, fetchData }: { user: User | null, fetchData: () => void }) => {
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [buyQty, setBuyQty] = useState<Record<string, number>>({});
  const [isStateBuy, setIsStateBuy] = useState(false);
  const [drinkQty, setDrinkQty] = useState<number>(1);
  const [buyingDrinks, setBuyingDrinks] = useState(false);

  // Publish state
  const ITEMS_CATALOG = [
    { id: 'oil', name: 'Petrolio', emoji: '🛢️' },
    { id: 'minerals', name: 'Minerali', emoji: '🪨' },
    { id: 'uranium', name: 'Uranio', emoji: '☢️' },
    { id: 'diamonds', name: 'Diamanti', emoji: '💎' },
    ...WEAPONS_CATALOG
  ];

  const [selectedItem, setSelectedItem] = useState("oil");
  const [postQty, setPostQty] = useState(1);
  const [postPrice, setPostPrice] = useState(10);
  const [posting, setPosting] = useState(false);

  const fetchOffers = () => {
    setLoading(true);
    fetch("/api/market/offers")
      .then(r => r.json())
      .then(data => setOffers(Array.isArray(data) ? data : []))
      .catch(() => setOffers([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => { fetchOffers(); }, []);

  const handleBuy = async (offer: any) => {
    const q = buyQty[offer.id] || 1;
    if (q <= 0 || q > offer.quantity) return alert("Quantità non valida");
    setPurchasingId(offer.id);
    try {
      const res = await fetch("/api/market/buy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId: offer.id, quantity: q, isStateBuy })
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else {
        alert(`Acquisto completato! Pagato: $${data.totalPrice}`);
        fetchOffers();
      }
    } catch { alert("Errore del server"); }
    finally { setPurchasingId(null); }
  };

  const handlePostOffer = async () => {
    setPosting(true);
    try {
      const res = await fetch("/api/market/offer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: selectedItem, quantity: postQty, price: postPrice })
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else {
        alert("Offerta pubblicata sul mercato!");
        fetchOffers();
      }
    } catch { alert("Errore"); }
    finally { setPosting(false); }
  };

  const sanitizedOffers = offers.filter((o: any) => !LEGACY_MILITARY_UNITS.has(String(o.itemId || '')));
  const filtered = filterType === "all" ? sanitizedOffers : sanitizedOffers.filter(o => o.itemId === filterType);
  const drinkUnitCost = GAME_CONFIG.ENERGY_DRINK_COST_GOLD;
  const safeDrinkQty = Math.max(1, Math.floor(Number(drinkQty) || 1));
  const drinkTotalCost = safeDrinkQty * drinkUnitCost;
  const userGold = Math.max(0, Math.floor(Number(user?.gold) || 0));

  const handleBuyEnergyDrinks = async () => {
    setBuyingDrinks(true);
    try {
      const res = await fetch("/api/actions/craft-drink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: safeDrinkQty })
      });
      const raw = await res.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { error: raw || `HTTP ${res.status}` };
      }
      if (data.error) {
        alert(data.error);
      } else {
        alert(`Acquisto completato: +${data.quantity} drink per ${data.totalCost} gold.`);
        fetchData();
      }
    } catch (err: any) {
      alert(err?.message || "Errore durante l'acquisto dei drink energetici.");
    } finally {
      setBuyingDrinks(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-gray-800/60 rounded-2xl flex items-center justify-center border border-gray-700/40">
          <ShoppingCart className="w-6 h-6 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-2xl flex flex-col font-black text-white tracking-tight uppercase leading-none">
            Mercato Globale
          </h2>
          <p className="text-sm font-bold text-gray-400">Scambia beni con altri giocatori</p>
        </div>
      </div>

      {/* Acquisto Drink Energetici */}
      <div className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800">
        <h3 className="text-md font-black uppercase text-white mb-1 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" /> Drink Energetici
        </h3>
        <p className="text-xs font-bold text-gray-400 mb-4">
          Prezzo fisso: {drinkUnitCost} gold per unità.
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-28">
            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Quantità</label>
            <input
              type="number"
              min="1"
              value={safeDrinkQty}
              onChange={e => setDrinkQty(parseInt(e.target.value) || 1)}
              className="w-full bg-gray-800/60 border border-gray-700/40 rounded-xl px-4 py-2 font-bold text-gray-100"
            />
          </div>
          <div className="px-4 py-2 rounded-xl bg-amber-500/15 border border-amber-400/30">
            <p className="text-[10px] font-black text-amber-300 uppercase">Costo Totale</p>
            <p className="text-lg font-black text-amber-300">{drinkTotalCost} gold</p>
          </div>
          <div className="px-4 py-2 rounded-xl bg-gray-800/50 border border-gray-700/40">
            <p className="text-[10px] font-black text-gray-400 uppercase">Il tuo Gold</p>
            <p className={`text-lg font-black ${userGold >= drinkTotalCost ? 'text-emerald-400' : 'text-rose-400'}`}>{userGold}</p>
          </div>
          <button
            onClick={handleBuyEnergyDrinks}
            disabled={buyingDrinks || userGold < drinkTotalCost}
            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-lg shadow-amber-100 transition-all disabled:opacity-50"
          >
            {buyingDrinks ? <Loader2 className="w-4 h-4 animate-spin" /> : "Compra Drink"}
          </button>
        </div>
      </div>

      {/* Pubblica Offerta */}
      <div className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800">
        <h3 className="text-md font-black uppercase text-white mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-emerald-400" /> Vendi sul Mercato
        </h3>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[120px]">
            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Oggetto</label>
            <select value={selectedItem} onChange={e => setSelectedItem(e.target.value)} className="w-full bg-gray-800/60 border border-gray-700/40 rounded-xl px-4 py-3 font-bold text-gray-100 focus:ring-2 focus:ring-indigo-500 transition-all outline-none">
              {ITEMS_CATALOG.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div className="w-24">
            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Quantità</label>
            <input type="number" min="1" value={postQty} onChange={e => setPostQty(parseInt(e.target.value) || 1)} className="w-full bg-gray-800/60 border border-gray-700/40 rounded-xl px-4 py-2 font-bold text-gray-100" />
          </div>
          <div className="w-24">
            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Prezzo/Unità</label>
            <input type="number" min="1" value={postPrice} onChange={e => setPostPrice(parseInt(e.target.value) || 1)} className="w-full bg-gray-800/60 border border-gray-700/40 rounded-xl px-4 py-2 font-bold text-gray-100" />
          </div>
          <button onClick={handlePostOffer} disabled={posting} className="px-6 py-2.5 bg-indigo-600 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-lg shadow-indigo-100 hover:scale-105 transition-all h-full">
            {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Pubblica"}
          </button>
        </div>
      </div>

      {/* Lista Offerte */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="bg-gray-800/60 border border-gray-700/40 rounded-xl px-4 py-2 text-sm font-bold text-gray-200 outline-none transition-all focus:ring-2 focus:ring-indigo-500">
            <option value="all">Filtra per Oggetto (Tutti)</option>
            {ITEMS_CATALOG.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>

          <label className="flex items-center gap-2 cursor-pointer bg-gray-800/60 px-4 py-2 rounded-xl border border-gray-700/40">
            <input type="checkbox" checked={isStateBuy} onChange={(e) => setIsStateBuy(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500 bg-gray-700 border-gray-600" />
            <span className="text-sm font-black text-gray-200 uppercase">Acquista come Stato</span>
          </label>
        </div>

        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-400 w-8 h-8" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center bg-gray-900/60 p-12 rounded-2xl border border-gray-800">
            <span className="text-4xl mb-3 block">🏜️</span>
            <p className="text-gray-400 font-bold">Nessuna offerta trovata sul mercato per questo filtro.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map(offer => {
              const item = ITEMS_CATALOG.find(w => w.id === offer.itemId);
              const isAbusive = offer.minPrice && offer.price > offer.minPrice * GAME_CONFIG.MARKET_ANTI_ABUSE_PERCENTAGE;

              return (
                <div key={offer.id} className={`bg-gray-900/60 p-5 rounded-2xl border ${isAbusive ? 'border-rose-500/40 bg-rose-500/5' : 'border-gray-800'} flex flex-wrap gap-4 items-center justify-between`}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-800/60 flex flex-col items-center justify-center rounded-2xl border border-gray-700/40">
                      <ResourceIcon id={offer.itemId} size={28} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-100 capitalize leading-none tracking-tight">{RESOURCE_LABELS[offer.itemId] || item?.name || offer.itemId}</p>
                      <p className="text-[10px] font-bold text-gray-400 mt-1.5 uppercase tracking-wider">Venditore: <span className="text-indigo-400 font-black">{offer.sellerName}</span></p>
                    </div>
                  </div>

                  <div className="text-center px-4 border-l border-r border-gray-700/40">
                    <p className="text-xs font-black text-gray-400 uppercase">Prezzo Unit.</p>
                    <p className="text-lg font-black text-emerald-400">${offer.price}</p>
                  </div>

                  <div className="text-center px-2">
                    <p className="text-xs font-black text-gray-400 uppercase">Disponibili</p>
                    <p className="text-md font-bold text-gray-200">{offer.quantity}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number" min="1" max={offer.quantity}
                      value={buyQty[offer.id] || 1}
                      onChange={e => setBuyQty(prev => ({ ...prev, [offer.id]: parseInt(e.target.value) || 1 }))}
                      className="w-16 px-2 py-2 bg-gray-800/60 border border-gray-700/40 rounded-xl text-center font-bold text-gray-100 outline-none"
                    />
                    <button
                      disabled={purchasingId === offer.id || isAbusive}
                      onClick={() => handleBuy(offer)}
                      className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl shadow-md transition-all disabled:opacity-50"
                    >
                      {purchasingId === offer.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Acquista"}
                    </button>
                    {isAbusive && <span className="text-[10px] text-rose-400 font-bold block ml-1 absolute right-2 -bottom-2">+110% Anti-Abuso</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
};
