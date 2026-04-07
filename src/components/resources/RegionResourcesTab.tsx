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

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  if (error) return <div className="p-4 bg-rose-500/15 border border-rose-400/30 rounded-xl text-rose-400 text-sm font-bold">{error}</div>;
  if (resources.length === 0) return <div className="p-6 text-center text-gray-400 text-sm">Nessuna risorsa configurata per questa regione.</div>;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
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
          <div key={r.resourceType} className="bg-gray-900/60 p-4 rounded-2xl border border-gray-800 space-y-2">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{icon}</span>
                <span className="font-black text-gray-100 text-sm">{label}</span>
                {r.deepActive && (
                  <span className="px-2 py-0.5 bg-purple-500/15 border border-purple-400/30 text-purple-400 rounded-full text-[9px] font-black uppercase">🔮 Deep</span>
                )}
                {isExhausted && (
                  <span className="px-2 py-0.5 bg-rose-500/15 border border-rose-400/30 text-rose-400 rounded-full text-[9px] font-black uppercase">Esaurita</span>
                )}
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-400">Cap ciclo</span>
                <p className="text-sm font-black text-indigo-400">{r.effectiveCapPerRecharge}
                  {r.effectiveCapPerRecharge > r.baseCapPerRecharge && (
                    <span className="text-[9px] text-purple-400 ml-1">(base {r.baseCapPerRecharge})</span>
                  )}
                </p>
              </div>
            </div>

            {/* Four-cell grid: disponibile / massimo giornaliero / estratto oggi / residuo sbloccabile */}
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className={`p-2 rounded-lg ${isExhausted ? 'bg-rose-500/15 border border-rose-400/30' : 'bg-emerald-500/10'}`}>
                <p className="text-[9px] font-bold uppercase text-gray-400">Disponibile ora</p>
                <p className={`text-sm font-black ${isExhausted ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {currentAvailableCap.toLocaleString()}
                </p>
              </div>
              <div className="bg-gray-800/50 p-2 rounded-lg">
                <p className="text-[9px] font-bold uppercase text-gray-400">Max giornaliero</p>
                <p className="text-sm font-black text-gray-200">{dailyMaxCap.toLocaleString()}</p>
              </div>
              <div className="bg-amber-500/15 border border-amber-400/30 p-2 rounded-lg">
                <p className="text-[9px] font-bold uppercase text-amber-400">Estratto oggi</p>
                <p className="text-sm font-black text-amber-300">{dailyExtracted.toLocaleString()}</p>
              </div>
              <div className={`p-2 rounded-lg ${canUnlockMore > 0 ? 'bg-blue-500/10' : 'bg-gray-700/50'}`}>
                <p className="text-[9px] font-bold uppercase text-gray-400">Residuo sbloccabile</p>
                <p className={`text-sm font-black ${canUnlockMore > 0 ? 'text-blue-400' : 'text-gray-400'}`}>
                  {canUnlockMore.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Progress bars */}
            <div className="space-y-1">
              {/* Unlocked today vs max */}
              <div className="flex items-center gap-1">
                <span className="text-[8px] text-gray-400 w-16 shrink-0">Sbloccato</span>
                <div className="flex-1 bg-gray-700 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-blue-400 h-full rounded-full transition-all" style={{ width: `${pctUnlocked}%` }} />
                </div>
                <span className="text-[8px] text-gray-400 w-8 text-right">{Math.round(pctUnlocked)}%</span>
              </div>
              {/* Extracted vs max */}
              <div className="flex items-center gap-1">
                <span className="text-[8px] text-gray-400 w-16 shrink-0">Estratto</span>
                <div className="flex-1 bg-gray-700 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-400 h-full rounded-full transition-all" style={{ width: `${pctExtracted}%` }} />
                </div>
                <span className="text-[8px] text-gray-400 w-8 text-right">{Math.round(pctExtracted)}%</span>
              </div>
            </div>

            {/* Deep exploration info */}
            {r.deepActive && r.deepEndsAt && (
              <p className="text-[9px] text-purple-400 font-medium">
                🔮 Deep attiva fino al {new Date(r.deepEndsAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}

            {/* Recharge button (Ministro dell'Economia) */}
            <div className="pt-1 border-t border-gray-700/40">
              <button
                onClick={() => handleRecharge(r.resourceType)}
                disabled={recharging === r.resourceType || canUnlockMore <= 0}
                className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all
                  ${canUnlockMore > 0
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    : 'bg-gray-700/50 text-gray-400 cursor-not-allowed'
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
                <p className={`text-[10px] font-bold mt-1 text-center ${msg.startsWith('+') ? 'text-emerald-400' : 'text-rose-400'}`}>
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
