import React, { useState, useCallback, useEffect } from "react";
import { Loader2, Pickaxe, AlertCircle, CheckCircle2 } from "lucide-react";
import { RESOURCE_LABELS, RESOURCE_ICONS_MAP } from "../../types";
import type { ResourceType } from "../../types";

export const ResourceExtractView = ({ user, fetchData }: { user: any; fetchData: () => void }) => {
  const [regionId, setRegionId] = useState(user?.regionId || '');
  const [resources, setResources] = useState<any[]>([]);
  const [playerStates, setPlayerStates] = useState<any[]>([]);
  const [selectedResource, setSelectedResource] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchAll = useCallback(async () => {
    if (!regionId) return;
    setLoading(true);
    try {
      const [resRes, stateRes] = await Promise.all([
        fetch(`/api/regions/${regionId}/resources`, { credentials: 'include' }).then(r => r.json()),
        fetch(`/api/resources/player-state?regionId=${regionId}`, { credentials: 'include' }).then(r => r.json()),
      ]);
      setResources(resRes.resources || []);
      setPlayerStates(stateRes.states || []);
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
  const playerState = playerStates.find((s: any) => s.resourceType === selectedResource);
  const extractedCycle = playerState?.extractedSinceLastRecharge || 0;
  const effectiveCap = selectedRes?.effectiveCapPerRecharge || 0;
  const remainingCycle = Math.max(0, effectiveCap - extractedCycle);
  const remainingDaily = selectedRes ? Math.max(0, selectedRes.dailyAvailable - selectedRes.dailyExtracted) : 0;
  const canWork = remainingCycle > 0 && remainingDaily > 0 && (user?.energy || 0) >= 10;
  const blockReason = remainingCycle <= 0 ? "Cap di estrazione raggiunto. Attendi il reset automatico delle 19:00 (ora di Londra)." : remainingDaily <= 0 ? "Risorsa giornaliera esaurita!" : (user?.energy || 0) < 10 ? "Energia insufficiente!" : null;

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
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-blue-50 p-3 rounded-xl">
              <p className="text-[9px] font-bold text-blue-400 uppercase">Ciclo personale</p>
              <p className="text-sm font-black text-blue-700">{extractedCycle} / {effectiveCap}</p>
              <div className="w-full bg-blue-100 h-1 rounded-full mt-1 overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full" style={{ width: `${effectiveCap > 0 ? (extractedCycle / effectiveCap) * 100 : 0}%` }} />
              </div>
            </div>
            <div className="bg-emerald-50 p-3 rounded-xl">
              <p className="text-[9px] font-bold text-emerald-400 uppercase">Giornaliero regione</p>
              <p className="text-sm font-black text-emerald-700">{selectedRes.dailyExtracted} / {selectedRes.dailyAvailable}</p>
              <div className="w-full bg-emerald-100 h-1 rounded-full mt-1 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${selectedRes.dailyAvailable > 0 ? (selectedRes.dailyExtracted / selectedRes.dailyAvailable) * 100 : 0}%` }} />
              </div>
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
