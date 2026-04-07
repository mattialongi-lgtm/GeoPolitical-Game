import React, { useState, useCallback, useEffect } from "react";
import { Loader2, Pickaxe, AlertCircle, CheckCircle2 } from "lucide-react";
import { RESOURCE_LABELS, RESOURCE_ICONS_MAP } from "../../types";
import type { ResourceType } from "../../types";

export const ResourceExtractView = ({ user, fetchData }: { user: any; fetchData: () => void }) => {
  const [regionId, setRegionId] = useState(user?.regionId || '');
  const [resources, setResources] = useState<any[]>([]);
  const [selectedResource, setSelectedResource] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchAll = useCallback(async () => {
    if (!regionId) return;
    setLoading(true);
    try {
      const resRes = await fetch(`/api/regions/${regionId}/resources`, { credentials: 'include' }).then(r => r.json());
      setResources(resRes.resources || []);
      if (!selectedResource && resRes.resources?.length > 0) {
        setSelectedResource(resRes.resources[0].resourceType);
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [regionId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleWork = async () => {
    if (!selectedResource || !regionId) return;
    setWorking(true);
    setMessage(null);
    try {
      const res = await fetch('/api/resources/work-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ regionId, resourceType: selectedResource }),
      });
      const data = await res.json();
      if (data.error) {
        setMessage({ text: data.error, type: 'error' });
      } else {
        const icon = RESOURCE_ICONS_MAP[selectedResource as ResourceType] || '📦';
        const label = RESOURCE_LABELS[selectedResource as ResourceType] || selectedResource;
        const isGoldOre = selectedResource === 'gold_ore';
        const moneyPart = data.moneyGenerated > 0 ? ` +€${data.moneyGenerated}` : '';
        const goldPart = data.goldGenerated > 0 ? ` +🪙${data.goldGenerated}` : '';
        const resultMsg = isGoldOre
          ? `+${data.amount} ${icon} ${label} estratti!${moneyPart}${goldPart} (+${data.xpGain} XP)`
          : `+${data.amount} ${icon} ${label} estratti! (+${data.xpGain} XP, nessun gold premium)`;
        setMessage({ text: resultMsg, type: 'success' });
        fetchAll();
        fetchData();
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setWorking(false);
    }
  };

  const selectedRes = resources.find((r: any) => r.resourceType === selectedResource);
  const dailyMaxCap: number = selectedRes?.dailyMaxCap ?? selectedRes?.dailyAvailable ?? 0;
  const currentAvailableCap: number = selectedRes?.currentAvailableCap ?? selectedRes?.remainingDaily ?? 0;
  const dailyExtracted: number = selectedRes?.dailyExtracted ?? 0;
  const totalUnlockedToday: number = selectedRes?.totalUnlockedToday ?? 0;
  const canUnlockMore: number = selectedRes?.canUnlockMore ?? Math.max(0, dailyMaxCap - totalUnlockedToday);
  const pctExtracted = dailyMaxCap > 0 ? Math.min(100, (dailyExtracted / dailyMaxCap) * 100) : 0;
  const pctUnlocked = dailyMaxCap > 0 ? Math.min(100, (totalUnlockedToday / dailyMaxCap) * 100) : 0;
  const canWork = currentAvailableCap > 0 && (user?.energy || 0) >= 10;
  const blockReason = currentAvailableCap <= 0 ? "Risorsa giornaliera esaurita!" : (user?.energy || 0) < 10 ? "Energia insufficiente!" : null;

  return (
    <div className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-4">
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
        <Pickaxe className="w-4 h-4 text-amber-500" /> Estrazione Risorse
      </h3>

      {/* Resource selector */}
      {resources.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {resources.map((r: any) => {
            const icon = RESOURCE_ICONS_MAP[r.resourceType as ResourceType] || '📦';
            const label = RESOURCE_LABELS[r.resourceType as ResourceType] || r.resourceType;
            const isSelected = selectedResource === r.resourceType;
            return (
              <button
                key={r.resourceType}
                onClick={() => setSelectedResource(r.resourceType)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  isSelected ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-300' : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>{icon}</span> {label}
                {r.deepActive && <span className="text-purple-500">🔮</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-slate-400">Nessuna risorsa disponibile in questa regione.</p>
      )}

      {/* Selected resource details */}
      {selectedRes && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className={`p-2 rounded-lg ${currentAvailableCap <= 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
              <p className="text-[9px] font-bold uppercase text-slate-500">Disponibile ora</p>
              <p className={`text-sm font-black ${currentAvailableCap <= 0 ? 'text-red-600' : 'text-emerald-700'}`}>
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
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <span className="text-[8px] text-slate-400 w-16 shrink-0">Sbloccato</span>
              <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-400 h-full rounded-full transition-all" style={{ width: `${pctUnlocked}%` }} />
              </div>
              <span className="text-[8px] text-slate-400 w-8 text-right">{Math.round(pctUnlocked)}%</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[8px] text-slate-400 w-16 shrink-0">Estratto</span>
              <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-amber-400 h-full rounded-full transition-all" style={{ width: `${pctExtracted}%` }} />
              </div>
              <span className="text-[8px] text-slate-400 w-8 text-right">{Math.round(pctExtracted)}%</span>
            </div>
          </div>
          {selectedResource === 'gold_ore' ? (
            <p className="text-[11px] font-bold text-amber-700 bg-amber-50 px-3 py-2 rounded-xl border border-amber-100">
              L'oro è l'unica risorsa che restituisce cash + gold premium. Gold base per scavata: 30 (aumenta con la salute della regione).
            </p>
          ) : (
            ['oil', 'minerals', 'uranium', 'diamonds'].includes(selectedResource) ? (
              <p className="text-[11px] font-bold text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                Questa risorsa è puramente estrattiva: consuma energia ma non restituisce gold premium.
              </p>
            ) : null
          )}

          {/* Work button */}
          <button
            onClick={handleWork}
            disabled={!canWork || working || loading}
            className={`w-full py-3 rounded-xl font-black text-sm uppercase tracking-wide transition-all flex items-center justify-center gap-2 ${
              canWork && !working ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {working ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Estraendo...</>
            ) : (
              <><Pickaxe className="w-4 h-4" /> Lavora / Estrai</>
            )}
          </button>

          {blockReason && (
            <div className="bg-amber-50 p-3 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-xs font-bold text-amber-700">{blockReason}</span>
            </div>
          )}
        </div>
      )}

      {/* Feedback message */}
      {message && (
        <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}
    </div>
  );
};
