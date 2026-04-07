import React, { useState, useEffect } from "react";
import { Loader2, Timer } from "lucide-react";
import { RefreshCcw } from "lucide-react";
import { RESOURCE_LABELS, RESOURCE_ICONS_MAP } from "../../types";
import type { ResourceType } from "../../types";

export const RechargeResourcePanel = ({ regionId, user }: { regionId: string; user: any }) => {
  const [resources, setResources] = useState<any[]>([]);
  const [selectedResource, setSelectedResource] = useState<string>('');
  const [rechargeInfo, setRechargeInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/regions/${regionId}/resources`, { credentials: 'include' });
        const data = await res.json();
        setResources(data.resources || []);
        if (data.resources?.length > 0) setSelectedResource(data.resources[0].resourceType);
      } catch (err: any) {
        setMessage({ text: err.message, type: 'error' });
      } finally {
        setLoading(false);
      }
    })();
  }, [regionId]);

  useEffect(() => {
    if (!selectedResource) return;
    (async () => {
      try {
        const res = await fetch(`/api/resources/recharge-info?regionId=${regionId}&resourceType=${selectedResource}`, { credentials: 'include' });
        const data = await res.json();
        setRechargeInfo(data);
      } catch (err: any) {
        console.error(err);
      }
    })();
  }, [selectedResource, regionId]);

  const handleRecharge = async () => {
    if (!selectedResource) return;
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/resources/recharge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ regionId, resourceType: selectedResource }),
      });
      const data = await res.json();
      if (data.error) {
        setMessage({ text: data.error, type: 'error' });
      } else {
        setMessage({ text: data.message || 'Ricarica completata!', type: 'success' });
        // Refresh info
        const infoRes = await fetch(`/api/resources/recharge-info?regionId=${regionId}&resourceType=${selectedResource}`, { credentials: 'include' });
        setRechargeInfo(await infoRes.json());
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center p-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>;

  const cooldownActive = (rechargeInfo?.cooldownRemaining || 0) > 0;
  const canAfford = rechargeInfo?.canAfford !== false;
  const canRecharge = !cooldownActive && canAfford && !actionLoading;

  return (
    <div className="bg-gray-900/60 p-5 rounded-2xl border border-gray-800 space-y-4">
      <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
        <RefreshCcw className="w-4 h-4 text-emerald-500" /> Ricarica Risorse
      </h3>
      <p className="text-[10px] text-gray-400">Resetta i contatori di estrazione per tutti i giocatori su questa risorsa+regione.</p>

      {resources.length > 0 ? (
        <>
          {/* Resource selector */}
          <div className="flex gap-2 flex-wrap">
            {resources.map((r: any) => {
              const icon = RESOURCE_ICONS_MAP[r.resourceType as ResourceType] || '📦';
              return (
                <button
                  key={r.resourceType}
                  onClick={() => setSelectedResource(r.resourceType)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold ${
                    selectedResource === r.resourceType ? 'bg-indigo-600 text-white border-2 border-indigo-500' : 'bg-gray-800/50 text-gray-400 border border-gray-700/40 hover:bg-gray-700/50'
                  }`}
                >
                  {icon} {RESOURCE_LABELS[r.resourceType as ResourceType] || r.resourceType}
                </button>
              );
            })}
          </div>

          {rechargeInfo && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-800/50 p-2 rounded-lg">
                  <span className="text-gray-400 font-bold">Costo ricarica</span>
                  <p className="font-black text-gray-100">€{(rechargeInfo.costEur || 0).toLocaleString()}</p>
                </div>
                <div className="bg-gray-800/50 p-2 rounded-lg">
                  <span className="text-gray-400 font-bold">Tesoro</span>
                  <p className={`font-black ${canAfford ? 'text-emerald-400' : 'text-rose-400'}`}>€{(rechargeInfo.treasuryEur || 0).toLocaleString()}</p>
                </div>
              </div>

              {cooldownActive && (
                <div className="bg-amber-500/15 border border-amber-400/30 p-2 rounded-lg flex items-center gap-2">
                  <Timer className="w-3 h-3 text-amber-400" />
                  <span className="text-xs font-bold text-amber-300">
                    Cooldown: {Math.ceil((rechargeInfo.cooldownRemaining || 0) / 60)} minuti rimanenti
                  </span>
                </div>
              )}

              <button
                onClick={handleRecharge}
                disabled={!canRecharge}
                className={`w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wide transition-all flex items-center justify-center gap-2 ${
                  canRecharge ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-gray-800/50 text-gray-400 cursor-not-allowed'
                }`}
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                Ricarica {RESOURCE_LABELS[selectedResource as ResourceType] || selectedResource}
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-gray-400">Nessuna risorsa configurata.</p>
      )}

      {message && (
        <div className={`p-2 rounded-lg text-xs font-bold ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
          {message.text}
        </div>
      )}
    </div>
  );
};
