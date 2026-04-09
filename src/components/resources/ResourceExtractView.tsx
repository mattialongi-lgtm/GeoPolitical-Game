import React, { useState, useCallback, useEffect } from "react";
import { Loader2, Pickaxe, AlertCircle, CheckCircle2 } from "lucide-react";
import { RESOURCE_LABELS, RESOURCE_ICONS_MAP } from "../../types";
import type { ResourceType } from "../../types";

type ResourceExtractViewProps = {
  user: any;
  fetchData: () => void;
  autoWorkFactoryName?: string | null;
  autoWorkResourceType?: string | null;
  autoWorkRegionId?: string | null;
  autoWorkExpiresAt?: string | null;
  setAutoWorkResource?: (resourceType: string | null, regionId?: string | null) => Promise<void> | void;
};

export const ResourceExtractView = ({
  user,
  fetchData,
  autoWorkFactoryName,
  autoWorkResourceType,
  autoWorkRegionId,
  autoWorkExpiresAt,
  setAutoWorkResource,
}: ResourceExtractViewProps) => {
  const regionId = user?.regionId || '';
  const [resources, setResources] = useState<any[]>([]);
  const [selectedResource, setSelectedResource] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [autoSubmitting, setAutoSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchAll = useCallback(async () => {
    if (!regionId) {
      setResources([]);
      setSelectedResource('');
      return;
    }

    setLoading(true);
    try {
      const resRes = await fetch(`/api/regions/${regionId}/resources`, { credentials: 'include' }).then(r => r.json());
      const nextResources = resRes.resources || [];
      setResources(nextResources);
      setSelectedResource((prev) => (
        nextResources.some((resource: any) => resource.resourceType === prev)
          ? prev
          : (nextResources[0]?.resourceType || '')
      ));
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [regionId]);

  useEffect(() => {
    setMessage(null);
  }, [regionId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

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

  const handleAutoWork = async () => {
    if (!selectedResource || !setAutoWorkResource) return;
    setAutoSubmitting(true);
    setMessage(null);
    try {
      const isStopping = autoWorkResourceType === selectedResource && autoWorkRegionId === regionId;
      await setAutoWorkResource(isStopping ? null : selectedResource, regionId);
      const label = RESOURCE_LABELS[selectedResource as ResourceType] || selectedResource;
      setMessage({
        text: isStopping
          ? "Auto-lavoro disattivato."
          : `Auto-lavoro attivato su ${label}. Ogni 10 minuti scalerà 300 energia; se sei sotto soglia berrà una bibita e poi rieseguirà lo scavo reale.`,
        type: 'success',
      });
    } catch (err: any) {
      setMessage({ text: err?.message || "Errore durante l'auto-lavoro.", type: 'error' });
    } finally {
      setAutoSubmitting(false);
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
  const hasBackingFactory = !!selectedRes?.backingFactoryId;
  const canWork = hasBackingFactory && currentAvailableCap > 0 && (user?.energy || 0) >= 10;
  const blockReason = !hasBackingFactory
    ? (selectedRes?.workDisabledReason || "Nessuna fabbrica attiva in Modalita Risorse collegata a questa risorsa in questa regione.")
    : currentAvailableCap <= 0
      ? "Risorsa giornaliera esaurita!"
      : (user?.energy || 0) < 10
        ? "Energia insufficiente!"
        : null;
  const autoWorkActiveOnSelectedResource = !!selectedResource && autoWorkResourceType === selectedResource && autoWorkRegionId === regionId;
  const autoWorkActiveElsewhere = !!autoWorkResourceType && !!autoWorkRegionId && !autoWorkActiveOnSelectedResource;
  const autoWorkElsewhereLabel = autoWorkActiveElsewhere
    ? (RESOURCE_LABELS[autoWorkResourceType as ResourceType] || autoWorkResourceType)
    : null;

  return (
    <div className="bg-gray-900/60 p-5 rounded-2xl border border-gray-800 space-y-4">
      <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
        <Pickaxe className="w-4 h-4 text-amber-500" /> Estrazione Risorse
      </h3>

      {resources.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {resources.map((r: any) => {
            const icon = RESOURCE_ICONS_MAP[r.resourceType as ResourceType] || '📦';
            const label = RESOURCE_LABELS[r.resourceType as ResourceType] || r.resourceType;
            const isSelected = selectedResource === r.resourceType;
            const isAutoActive = autoWorkResourceType === r.resourceType && autoWorkRegionId === regionId;
            return (
              <button
                key={r.resourceType}
                onClick={() => setSelectedResource(r.resourceType)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  isSelected ? 'bg-indigo-600 text-white border-2 border-indigo-500' : 'bg-gray-800/50 text-gray-400 border border-gray-700/40 hover:bg-gray-700/50'
                }`}
              >
                <span>{icon}</span> {label}
                {r.deepActive && <span className="text-purple-500">🔮</span>}
                {isAutoActive && <span className="text-amber-500">⚙️</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-gray-400">Nessuna risorsa disponibile in questa regione.</p>
      )}

      {selectedRes && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className={`p-2 rounded-lg ${currentAvailableCap <= 0 ? 'bg-red-500/15 border border-red-400/30' : 'bg-emerald-500/10'}`}>
              <p className="text-[9px] font-bold uppercase text-gray-400">Disponibile ora</p>
              <p className={`text-sm font-black ${currentAvailableCap <= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {currentAvailableCap.toLocaleString()}
              </p>
            </div>
            <div className="bg-gray-800/50 p-2 rounded-lg">
              <p className="text-[9px] font-bold uppercase text-gray-400">Max giornaliero</p>
              <p className="text-sm font-black text-gray-200">{dailyMaxCap.toLocaleString()}</p>
            </div>
            <div className="bg-amber-500/15 border border-amber-400/30 p-2 rounded-lg">
              <p className="text-[9px] font-bold uppercase text-amber-500">Estratto oggi</p>
              <p className="text-sm font-black text-amber-300">{dailyExtracted.toLocaleString()}</p>
            </div>
            <div className={`p-2 rounded-lg ${canUnlockMore > 0 ? 'bg-blue-500/10' : 'bg-gray-700/50'}`}>
              <p className="text-[9px] font-bold uppercase text-gray-400">Residuo sbloccabile</p>
              <p className={`text-sm font-black ${canUnlockMore > 0 ? 'text-blue-400' : 'text-gray-400'}`}>
                {canUnlockMore.toLocaleString()}
              </p>
            </div>
          </div>

          <div className={`rounded-xl border px-3 py-2 ${hasBackingFactory ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-rose-500/15 border border-rose-400/30'}`}>
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Collegamento Backend</p>
            {hasBackingFactory ? (
              <p className="text-xs font-black text-indigo-400">
                Fabbrica attiva: {selectedRes.backingFactoryName || 'Sconosciuta'} • Lv {Number(selectedRes.backingFactoryLevel || 0).toLocaleString()}
              </p>
            ) : (
              <p className="text-xs font-black text-rose-400">
                Nessuna fabbrica attiva collegata: il lavoro resta disabilitato finché il backend non ha un target reale.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <span className="text-[8px] text-gray-400 w-16 shrink-0">Sbloccato</span>
              <div className="flex-1 bg-gray-700 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-400 h-full rounded-full transition-all" style={{ width: `${pctUnlocked}%` }} />
              </div>
              <span className="text-[8px] text-gray-400 w-8 text-right">{Math.round(pctUnlocked)}%</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[8px] text-gray-400 w-16 shrink-0">Estratto</span>
              <div className="flex-1 bg-gray-700 h-1.5 rounded-full overflow-hidden">
                <div className="bg-amber-400 h-full rounded-full transition-all" style={{ width: `${pctExtracted}%` }} />
              </div>
              <span className="text-[8px] text-gray-400 w-8 text-right">{Math.round(pctExtracted)}%</span>
            </div>
          </div>

          {selectedResource === 'gold_ore' ? (
            <p className="text-[11px] font-bold text-amber-300 bg-amber-500/15 px-3 py-2 rounded-xl border border-amber-400/30">
              L'oro è l'unica risorsa che restituisce cash + gold premium. Gold base per scavata: 30 (aumenta con la salute della regione).
            </p>
          ) : (
            ['oil', 'minerals', 'uranium', 'diamonds'].includes(selectedResource) ? (
              <p className="text-[11px] font-bold text-gray-300 bg-gray-800/50 px-3 py-2 rounded-xl border border-gray-700/40">
                Questa risorsa è puramente estrattiva: consuma energia ma non restituisce gold premium.
              </p>
            ) : null
          )}

          <div className="rounded-xl border border-amber-400/30 bg-amber-500/15 px-3 py-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-amber-300">Auto-Lavoro Estrattivo</p>
                {autoWorkFactoryName && (
                  <p className="text-[10px] font-bold text-amber-200">Fabbrica target: {autoWorkFactoryName}</p>
                )}
                {autoWorkActiveOnSelectedResource ? (
                  <p className="text-xs font-black text-amber-300">
                    Attivo su questa risorsa. Ogni 10 minuti scalerà 300 energia; se necessario consumerà una bibita, si ricaricherà a 300 e poi applicherà estrazione e ricompense del backend reale
                    {autoWorkExpiresAt ? ` • Scade: ${new Date(autoWorkExpiresAt).toLocaleString('it-IT')}` : ''}.
                  </p>
                ) : autoWorkActiveElsewhere ? (
                  <p className="text-xs font-black text-amber-300">
                    Attualmente attivo su {autoWorkElsewhereLabel}. Avviandolo qui sposterai l'automazione su questa risorsa.
                  </p>
                ) : (
                  <p className="text-xs font-black text-amber-300">
                    Attiva 24h di auto-lavoro collegato all'estrazione reale. Compatibile solo con il Danno Orario.
                  </p>
                )}
              </div>
              <button
                onClick={handleAutoWork}
                disabled={autoSubmitting || (!hasBackingFactory && !autoWorkActiveOnSelectedResource)}
                className={`shrink-0 px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                  autoWorkActiveOnSelectedResource
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 disabled:hover:bg-amber-500'
                }`}
              >
                {autoSubmitting ? "..." : autoWorkActiveOnSelectedResource ? "Ferma" : autoWorkActiveElsewhere ? "Sposta Qui" : "Avvia"}
              </button>
            </div>
          </div>

          <button
            onClick={handleWork}
            disabled={!canWork || working || loading}
            className={`w-full py-3 rounded-xl font-black text-sm uppercase tracking-wide transition-all flex items-center justify-center gap-2 ${
              canWork && !working ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200' : 'bg-gray-800/50 text-gray-400 cursor-not-allowed'
            }`}
          >
            {working ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Estraendo...</>
            ) : (
              <><Pickaxe className="w-4 h-4" /> Lavora / Estrai</>
            )}
          </button>

          {blockReason && (
            <div className="bg-amber-500/15 border border-amber-400/30 p-3 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs font-bold text-amber-300">{blockReason}</span>
            </div>
          )}
        </div>
      )}

      {message && (
        <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/15 text-rose-400'}`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}
    </div>
  );
};
