import React, { useState, useCallback, useEffect } from "react";
import { Loader2, Pickaxe, RefreshCw } from "lucide-react";
import { RESOURCE_LABELS, RESOURCE_ICONS_MAP } from "../../types";
import type { ResourceType } from "../../types";

export const RegionResourcesTab = ({ regionId, user }: { regionId: string; user: any }) => {
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rechargeInfo, setRechargeInfo] = useState<Record<string, any>>({});
  const [recharging, setRecharging] = useState<string | null>(null);
  const [rechargeMsg, setRechargeMsg] = useState<Record<string, string>>({});

  const fetchResources = useCallback(async () => {
    if (!regionId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/regions/${regionId}/resources`, { credentials: 'include' });

      const contentType = res.headers.get("content-type");
      if (!res.ok) {
        let errorMsg = `Errore HTTP ${res.status}`;
        try {
          const errorData = await res.json();
          errorMsg = errorData.error || errorMsg;
        } catch {
          const text = await res.text();
          errorMsg = `HTTP ${res.status}: ${text.substring(0, 50)}...`;
        }
        throw new Error(errorMsg);
      }

      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        throw new Error(`Risposta non valida dal server (${contentType}). Body: ${text.substring(0, 50)}...`);
      }

      const data = await res.json();

      const sorted = (data.resources || []).sort((a: any, b: any) => {
        const order: Record<string, number> = {
          gold_ore: 1, oil: 2, minerals: 3, uranium: 4, diamonds: 5, liquid_oxygen: 6, helium3: 7
        };
        return (order[a.resourceType] || 99) - (order[b.resourceType] || 99);
      });

      setResources(sorted);
    } catch (err: any) {
      console.error("Resource fetch error:", err);
      setError(err.message || "Errore durante il caricamento delle risorse.");
    } finally {
      setLoading(false);
    }
  }, [regionId]);

  useEffect(() => { fetchResources(); }, [fetchResources]);

  const handleRecharge = async (resourceType: string) => {
    setRecharging(resourceType);
    setRechargeMsg(prev => ({ ...prev, [resourceType]: '' }));
    try {
      const res = await fetch('/api/resources/recharge', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regionId, resourceType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRechargeMsg(prev => ({ ...prev, [resourceType]: data.error || 'Errore ricarica.' }));
      } else {
        setRechargeMsg(prev => ({ ...prev, [resourceType]: `+${data.rechargedAmount} sbloccati` }));
        await fetchResources();
      }
    } catch {
      setRechargeMsg(prev => ({ ...prev, [resourceType]: 'Errore di rete.' }));
    } finally {
      setRecharging(null);
    }
  };

  // Check if current user is leader or economy minister of this region
  const canRecharge = (r: any) => {
    if (!user) return false;
    // We rely on the region's ownerUserId and economicAdviserId being available via the resource object
    // or we just show the button for now and let the server validate (403 if not authorized)
    return true;
  };

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
        const dailyMaxCap: number = r.dailyMaxCap ?? r.dailyAvailable ?? 0;
        const currentAvailableCap: number = r.currentAvailableCap ?? r.remainingDaily ?? 0;
        const dailyExtracted: number = r.dailyExtracted ?? 0;
        const totalUnlockedToday: number = r.totalUnlockedToday ?? 0;
        const canUnlockMore: number = r.canUnlockMore ?? Math.max(0, dailyMaxCap - totalUnlockedToday);

        const pctExtracted = dailyMaxCap > 0
          ? Math.min(100, (dailyExtracted / dailyMaxCap) * 100)
          : 0;
        const pctUnlocked = dailyMaxCap > 0
          ? Math.min(100, (totalUnlockedToday / dailyMaxCap) * 100)
          : 0;

        const isExhausted = currentAvailableCap <= 0;
        const msg = rechargeMsg[r.resourceType];

        return (
          <div key={r.resourceType} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{icon}</span>
                <span className="font-black text-slate-800 text-sm">{label}</span>
                {r.deepActive && (
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[9px] font-black uppercase">🔮 Deep</span>
                )}
                {isExhausted && (
                  <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-[9px] font-black uppercase">Esaurita</span>
                )}
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400">Cap ciclo</span>
                <p className="text-sm font-black text-indigo-600">{r.effectiveCapPerRecharge}
                  {r.effectiveCapPerRecharge > r.baseCapPerRecharge && (
                    <span className="text-[9px] text-purple-500 ml-1">(base {r.baseCapPerRecharge})</span>
                  )}
                </p>
              </div>
            </div>

            {/* Four-cell grid: disponibile / massimo giornaliero / estratto oggi / residuo sbloccabile */}
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className={`p-2 rounded-lg ${isExhausted ? 'bg-red-50' : 'bg-emerald-50'}`}>
                <p className="text-[9px] font-bold uppercase text-slate-500">Disponibile ora</p>
                <p className={`text-sm font-black ${isExhausted ? 'text-red-600' : 'text-emerald-700'}`}>
                  {currentAvailableCap.toLocaleString()}
                </p>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg">
                <p className="text-[9px] font-bold uppercase text-slate-400">Max giornaliero</p>
                <p className="text-sm font-black text-slate-700">{dailyMaxCap.toLocaleString()}</p>
              </div>
              <div className="bg-amber-50 p-2 rounded-lg">
                <p className="text-[9px] font-bold uppercase text-amber-500">Estratto oggi</p>
                <p className="text-sm font-black text-amber-700">{dailyExtracted.toLocaleString()}</p>
              </div>
              <div className={`p-2 rounded-lg ${canUnlockMore > 0 ? 'bg-blue-50' : 'bg-slate-100'}`}>
                <p className="text-[9px] font-bold uppercase text-slate-500">Residuo sbloccabile</p>
                <p className={`text-sm font-black ${canUnlockMore > 0 ? 'text-blue-700' : 'text-slate-400'}`}>
                  {canUnlockMore.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Progress bars */}
            <div className="space-y-1">
              {/* Unlocked today vs max */}
              <div className="flex items-center gap-1">
                <span className="text-[8px] text-slate-400 w-16 shrink-0">Sbloccato</span>
                <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-blue-400 h-full rounded-full transition-all" style={{ width: `${pctUnlocked}%` }} />
                </div>
                <span className="text-[8px] text-slate-400 w-8 text-right">{Math.round(pctUnlocked)}%</span>
              </div>
              {/* Extracted vs max */}
              <div className="flex items-center gap-1">
                <span className="text-[8px] text-slate-400 w-16 shrink-0">Estratto</span>
                <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-400 h-full rounded-full transition-all" style={{ width: `${pctExtracted}%` }} />
                </div>
                <span className="text-[8px] text-slate-400 w-8 text-right">{Math.round(pctExtracted)}%</span>
              </div>
            </div>

            {/* Deep exploration info */}
            {r.deepActive && r.deepEndsAt && (
              <p className="text-[9px] text-purple-500 font-medium">
                🔮 Deep attiva fino al {new Date(r.deepEndsAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}

            {/* Recharge button (Ministro dell'Economia) */}
            <div className="pt-1 border-t border-slate-100">
              <button
                onClick={() => handleRecharge(r.resourceType)}
                disabled={recharging === r.resourceType || canUnlockMore <= 0}
                className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all
                  ${canUnlockMore > 0
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
              >
                {recharging === r.resourceType
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <RefreshCw className="w-3 h-3" />
                }
                {canUnlockMore > 0
                  ? `Ricarica disponibilità (+${Math.min(r.initialAvailableCap ?? 200, canUnlockMore).toLocaleString()} max)`
                  : 'Max giornaliero raggiunto'
                }
              </button>
              {msg && (
                <p className={`text-[10px] font-bold mt-1 text-center ${msg.startsWith('+') ? 'text-emerald-600' : 'text-red-500'}`}>
                  {msg}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
