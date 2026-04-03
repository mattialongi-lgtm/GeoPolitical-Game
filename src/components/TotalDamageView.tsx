import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bomb, Loader2, ShieldAlert, Swords } from "lucide-react";
import { motion } from "motion/react";
import { fetchMyPlayerDamageSummary, type PlayerDamageSummary } from "../api/profileClient";

const TotalDamageView = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<PlayerDamageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const summary = await fetchMyPlayerDamageSummary();
        if (!cancelled) setData(summary);
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setError("Impossibile caricare i danni totali.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-rose-500 animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="min-h-screen bg-gray-950 pb-32 -mx-4 -mt-4"
    >
      <header className="bg-gray-900/95 backdrop-blur-md sticky top-0 z-40 h-16 flex items-center px-6 border-b border-gray-800/50">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-800/80 rounded-lg transition-colors">
          <ArrowLeft className="w-8 h-8 text-white" />
        </button>
        <div className="ml-4">
          <h1 className="text-xl font-black text-gray-50 uppercase tracking-tight military-font">Danni totali</h1>
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Storico lifetime guerre</p>
        </div>
      </header>

      <main className="p-6 space-y-8">
        <div className="bg-gray-900 p-8 rounded-sm border-4 border-gray-800 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-1/2 -translate-y-1/2 right-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Bomb className="w-36 h-36 text-rose-500" />
          </div>

          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-black/40 flex items-center justify-center border border-white/5 shadow-inner">
                <Swords className="w-10 h-10 text-rose-400" />
              </div>
              <div>
                <h2 className="text-5xl font-black text-white military-font tracking-tighter">
                  {(data?.totalDamage || 0).toLocaleString()}
                </h2>
                <p className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mt-1">Danni complessivi inflitti</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-black/20 p-4 border border-white/5">
                <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Guerre con danni</p>
                <span className="text-[11px] font-black text-rose-400 uppercase tracking-wider">{data?.wars.length || 0} registrate</span>
              </div>
              <div className="bg-black/20 p-4 border border-white/5">
                <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Archivio</p>
                <span className="text-[11px] font-black text-emerald-400 uppercase tracking-wider">Completo</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-1 border-b border-gray-800 pb-2">
            <h3 className="text-sm font-black text-gray-200 uppercase tracking-widest military-font flex items-center gap-2">
              <Bomb className="w-4 h-4 text-rose-400" /> Guerre con danni inflitti
            </h3>
            <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">{data?.wars.length || 0} Voci</span>
          </div>

          {error ? (
            <div className="bg-red-950/30 border border-red-900/40 p-6 text-center">
              <p className="text-sm font-black text-red-400 uppercase tracking-wider">{error}</p>
            </div>
          ) : data && data.wars.length === 0 ? (
            <div className="bg-gray-900/30 p-12 text-center border-2 border-gray-800 border-dashed">
              <ShieldAlert className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Non hai ancora inflitto danni in nessuna guerra</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(data?.wars || []).map((war, index) => (
                <button
                  key={war.warId}
                  onClick={() => navigate(`/war/${war.warId}/summary`)}
                  className="w-full bg-gray-900/80 p-4 border border-gray-800/50 flex items-center justify-between hover:bg-gray-800 transition-all group text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-black/40 flex items-center justify-center border border-gray-800 group-hover:border-rose-500/30 transition-colors shadow-lg text-rose-400 font-black">
                      #{index + 1}
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black text-gray-100 uppercase tracking-wider">{war.warLabel || war.warId}</h4>
                      <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{war.warId}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-rose-400 military-font tracking-tighter">
                      {war.totalDamage.toLocaleString()}
                    </span>
                    <p className="text-[8px] font-black text-gray-700 uppercase tracking-widest leading-none">Danni inflitti</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </motion.div>
  );
};

export default TotalDamageView;
