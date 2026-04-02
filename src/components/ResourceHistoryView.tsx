import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  History, 
  Pickaxe, 
  ShoppingCart, 
  Package, 
  Clock, 
  Loader2,
  Box,
  Plus,
} from "lucide-react";
import { motion } from "motion/react";
import { ResourceIcon } from "./ResourceIcon";
import { RESOURCE_LABELS } from "../types";

const ResourceHistoryView = ({ fetchData }: { fetchData: () => void }) => {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const [history, setHistory] = useState<any[]>([]);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!itemId) return;
    setLoading(true);
    fetch(`/api/inventory/history/${itemId}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setHistory(data.history);
          setCurrentBalance(data.currentBalance);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [itemId]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'scavo': return <Pickaxe className="w-5 h-5 text-emerald-400" />;
      case 'acquisto': return <ShoppingCart className="w-5 h-5 text-indigo-400" />;
      case 'ritiro': return <Package className="w-5 h-5 text-amber-400" />;
      default: return <History className="w-5 h-5 text-slate-400" />;
    }
  };

  const getEventLabel = (type: string) => {
    switch (type) {
      case 'scavo': return 'Lavoro / Estrazione';
      case 'acquisto': return 'Acquisto Mercato';
      case 'ritiro': return 'Prelievo Fabbrica';
      default: return 'Transazione';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  const label = RESOURCE_LABELS[itemId as any] || itemId;

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} 
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="min-h-screen bg-gray-950 pb-32 -mx-4 -mt-4"
    >
      {/* Header */}
      <header className="bg-gray-900/95 backdrop-blur-md sticky top-0 z-40 h-16 flex items-center px-6 border-b border-gray-800/50">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-800/80 rounded-lg transition-colors">
          <ArrowLeft className="w-8 h-8 text-white" />
        </button>
        <div className="ml-4">
          <h1 className="text-xl font-black text-gray-50 uppercase tracking-tight military-font">Gestione Scorte</h1>
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">{label}</p>
        </div>
      </header>

      <main className="p-6 space-y-8">
        {/* Resource Hero Card */}
        <div className="bg-gray-900 p-8 rounded-sm border-4 border-gray-800 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-1/2 -translate-y-1/2 right-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <ResourceIcon id={itemId || ""} size={160} />
          </div>
          
          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-black/40 flex items-center justify-center border border-white/5 shadow-inner">
                <ResourceIcon id={itemId || ""} size={48} />
              </div>
              <div>
                <h2 className="text-5xl font-black text-white military-font tracking-tighter">{(currentBalance || 0).toLocaleString()}</h2>
                <p className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mt-1">Unità Attive in Inventario</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
               <div className="bg-black/20 p-4 border border-white/5">
                  <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Stato Logistico</p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                    <span className="text-[11px] font-black text-emerald-400 uppercase tracking-wider">Disponibile</span>
                  </div>
               </div>
               <div className="bg-black/20 p-4 border border-white/5">
                  <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Classe Risorsa</p>
                  <span className="text-[11px] font-black text-indigo-400 uppercase tracking-wider">Strategica</span>
               </div>
            </div>
          </div>
        </div>

        {/* History List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1 border-b border-gray-800 pb-2">
            <h3 className="text-sm font-black text-gray-200 uppercase tracking-widest military-font flex items-center gap-2">
              <History className="w-4 h-4 text-[#76ff03]" /> Registro Operativo
            </h3>
            <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">{history.length} Voci</span>
          </div>

          <div className="space-y-2">
            {history.length === 0 ? (
              <div className="bg-gray-900/30 p-12 text-center border-2 border-gray-800 border-dashed">
                <Box className="w-10 h-10 text-gray-800 mx-auto mb-3" />
                <p className="text-xs text-gray-600 font-bold uppercase tracking-widest">Nessun dato registrato</p>
              </div>
            ) : (
              history.map((event, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  key={i}
                  className="bg-gray-900/80 p-4 border border-gray-800/50 flex items-center justify-between hover:bg-gray-800 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-black/40 flex items-center justify-center border border-gray-800 group-hover:border-[#76ff03]/30 transition-colors shadow-lg">
                      {getEventIcon(event.type)}
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black text-gray-100 uppercase tracking-wider">{getEventLabel(event.type)}</h4>
                      <div className="flex items-center gap-2 text-[9px] font-bold text-gray-600">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(event.timestamp).toLocaleTimeString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="text-gray-800 ml-1">[{event.source}]</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end text-[#76ff03]">
                      <Plus className="w-3 h-3" />
                      <span className="text-xl font-black military-font tracking-tighter">{event.amount.toLocaleString()}</span>
                    </div>
                    <p className="text-[8px] font-black text-gray-700 uppercase tracking-widest leading-none">Aggregato</p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </main>
    </motion.div>
  );
};

export default ResourceHistoryView;
