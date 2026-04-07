import { useState, useEffect } from "react";
import { Archive, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { GAME_CONFIG, RESOURCE_LABELS } from "../../types";
import { WEAPONS_CATALOG, LEGACY_MILITARY_UNITS } from "../../constants";
import { ResourceIcon } from "../ResourceIcon";

const StorageView = ({ user }: { user: any }) => {
  const [activeTab, setActiveTab] = useState<"private" | "state">("private");
  const [stateInventory, setStateInventory] = useState<any[]>([]);
  const [loadingState, setLoadingState] = useState(false);

  const isLeader = user?.residenceId && user?.originalNation && user?.residenceId.startsWith(user.originalNation);

  useEffect(() => {
    if (activeTab === "state") {
      setLoadingState(true);
      fetch("/api/market/state-inventory")
        .then(r => r.json())
        .then(data => setStateInventory(data))
        .finally(() => setLoadingState(false));
    }
  }, [activeTab]);

  const privateVolume = user?.inventoryVolume || 0;
  const privateMax = user?.maxInventoryVolume || GAME_CONFIG.STORAGE_BASE_CAPACITY;
  const pct = Math.min(100, (privateVolume / privateMax) * 100);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-gray-800/60 rounded-2xl flex items-center justify-center border border-gray-700/40">
          <Archive className="w-6 h-6 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-xl flex flex-col font-black text-white tracking-tight uppercase leading-none mt-1">
            Magazzini
          </h2>
          <p className="text-sm font-bold text-gray-400">Gestisci le tue scorte personali o statali</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setActiveTab("private")} className={`px-4 py-2 font-black uppercase tracking-wider text-xs rounded-xl transition-all ${activeTab === 'private' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'}`}>Privato</button>
        {isLeader && <button onClick={() => setActiveTab("state")} className={`px-4 py-2 font-black uppercase tracking-wider text-xs rounded-xl transition-all ${activeTab === 'state' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'}`}>Stato</button>}
      </div>

      {activeTab === "private" && (
        <div className="bg-gray-900/60 p-8 rounded-2xl border border-gray-800 space-y-6">
          <div>
            <div className="flex justify-between items-end mb-2">
              <h3 className="font-black text-white uppercase">Spazio Occupato</h3>
              <span className="text-xs font-bold text-gray-400">{privateVolume} / {privateMax} unità</span>
            </div>
            <div className="w-full bg-gray-700 h-4 rounded-full overflow-hidden">
              <div className={`h-full transition-all duration-500 ${pct > 90 ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
            </div>
            {pct > 90 && <p className="text-[10px] text-rose-400 font-bold mt-2">Attenzione: magazzino quasi pieno!</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {(() => {
              const inventoryEntries = Object.entries(user.inventory || {}).filter(([itemId, qty]) => (qty as number) > 0 && !LEGACY_MILITARY_UNITS.has(itemId));
              if (inventoryEntries.length === 0) {
                return <div className="col-span-2 text-center p-6 text-gray-400 font-bold">Magazzino vuoto</div>;
              }
              return inventoryEntries.map(([itemId, qty]) => {
                const weapon = WEAPONS_CATALOG.find(w => w.id === itemId);
                return (
                  <Link key={itemId} to={`/inventory/history/${itemId}`} className="p-4 bg-gray-800/50 rounded-2xl border border-gray-700/40 flex justify-between items-center transition-all hover:border-indigo-500/50 hover:bg-gray-800/80 group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gray-700/60 flex items-center justify-center border border-gray-600/40 group-hover:scale-110 transition-transform">
                        <ResourceIcon id={itemId} size={24} />
                      </div>
                      <span className="font-black text-gray-100 capitalize">{RESOURCE_LABELS[itemId] || weapon?.name || itemId}</span>
                    </div>
                    <span className="font-black text-indigo-400 bg-indigo-500/15 px-3 py-1 rounded-lg text-sm">x{qty as number}</span>
                  </Link>
                );
              });
            })()}
          </div>
        </div>
      )}

      {activeTab === "state" && (
        <div className="bg-gray-900/60 p-8 rounded-2xl border border-emerald-500/20 space-y-6">
          <h3 className="font-black text-white uppercase">Magazzino di Stato ({user.residenceId})</h3>
          <p className="text-xs font-bold text-emerald-400">Questo magazzino non ha limiti di volume. I beni sono acquistati con fondi statali.</p>
          {loadingState ? <Loader2 className="animate-spin w-6 h-6 text-emerald-400 mx-auto" /> : (
            <div className="grid grid-cols-2 gap-4">
            {Array.isArray(stateInventory) ? (
              stateInventory
                .filter((item: any) => !LEGACY_MILITARY_UNITS.has(String(item.itemId || '')))
                .map((item: any) => {
                const weapon = WEAPONS_CATALOG.find(w => w.id === item.itemId);
                return (
                  <div key={item.itemId} className="p-4 bg-gray-800/50 rounded-2xl border border-emerald-500/20 flex justify-between items-center transition-all hover:border-emerald-400/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                        <ResourceIcon id={item.itemId} size={24} />
                      </div>
                      <span className="font-black text-gray-100 capitalize">{RESOURCE_LABELS[item.itemId] || weapon?.name || item.itemId}</span>
                    </div>
                    <span className="font-black text-emerald-400 bg-emerald-500/15 px-3 py-1 rounded-lg text-sm">x{item.quantity}</span>
                  </div>
                )
              })
            ) : (
              <div className="col-span-2 text-center p-6 text-emerald-400 font-bold">
                Caricamento inventario o errore...
              </div>
            )}
            {Array.isArray(stateInventory) && stateInventory.length === 0 && (
              <div className="col-span-2 text-center p-6 text-emerald-400/50 font-bold">Magazzino Statale vuoto</div>
            )}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default StorageView;
