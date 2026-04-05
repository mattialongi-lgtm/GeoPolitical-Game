import React, { useState, useCallback, useEffect } from "react";
import { Loader2, Pickaxe } from "lucide-react";
import { RESOURCE_LABELS, RESOURCE_ICONS_MAP } from "../../types";
import type { ResourceType } from "../../types";

export const RegionResourcesTab = ({ regionId, user }: { regionId: string; user: any }) => {
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResources = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/regions/${regionId}/resources`, { credentials: 'include' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResources(data.resources || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [regionId]);

  useEffect(() => { fetchResources(); }, [fetchResources]);

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (error) return <div className="p-4 bg-red-50 rounded-xl text-red-600 text-sm font-bold">{error}</div>;
  if (resources.length === 0) return <div className="p-6 text-center text-slate-400 text-sm">Nessuna risorsa configurata per questa regione.</div>;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
        <Pickaxe className="w-4 h-4" /> Risorse Regionali
      </h3>
      {resources.map((r: any) => {
        const icon = RESOURCE_ICONS_MAP[r.resourceType as ResourceType] || '📦';
        const label = RESOURCE_LABELS[r.resourceType as ResourceType] || r.resourceType;
        const pctDaily = r.dailyAvailable > 0 ? Math.min(100, (r.dailyExtracted / r.dailyAvailable) * 100) : 0;
        return (
          <div key={r.resourceType} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{icon}</span>
                <span className="font-black text-slate-800 text-sm">{label}</span>
                {r.deepActive && (
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[9px] font-black uppercase">🔮 Deep</span>
                )}
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400">Cap effettivo</span>
                <p className="text-sm font-black text-indigo-600">{r.effectiveCapPerRecharge}
                  {r.effectiveCapPerRecharge > r.baseCapPerRecharge && (
                    <span className="text-[9px] text-purple-500 ml-1">(base {r.baseCapPerRecharge})</span>
                  )}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-50 p-2 rounded-lg">
                <p className="text-[9px] font-bold text-slate-400 uppercase">Disponibile</p>
                <p className="text-sm font-black text-slate-800">{r.dailyAvailable.toLocaleString()}</p>
              </div>
              <div className="bg-amber-50 p-2 rounded-lg">
                <p className="text-[9px] font-bold text-amber-500 uppercase">Estratto</p>
                <p className="text-sm font-black text-amber-700">{r.dailyExtracted.toLocaleString()}</p>
              </div>
              <div className="bg-emerald-50 p-2 rounded-lg">
                <p className="text-[9px] font-bold text-emerald-500 uppercase">Rimanente</p>
                <p className="text-sm font-black text-emerald-700">{r.remainingDaily.toLocaleString()}</p>
              </div>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div className="bg-indigo-500 h-full rounded-full transition-all" style={{ width: `${pctDaily}%` }} />
            </div>
            {r.deepActive && r.deepEndsAt && (
              <p className="text-[9px] text-purple-500 font-medium">
                🔮 Deep attiva fino al {new Date(r.deepEndsAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};
