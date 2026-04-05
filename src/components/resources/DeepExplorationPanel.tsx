import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { RESOURCE_TYPES, RESOURCE_LABELS, RESOURCE_ICONS_MAP } from "../../types";
import type { ResourceType, DeepCostPreview } from "../../types";
import { ResourceIcon } from "../ResourceIcon";

export const DeepExplorationPanel = ({ user, nationId }: { user: any; nationId: string }) => {
  const deepResourceTypes = useMemo(
    () => RESOURCE_TYPES.filter(rt => !['liquid_oxygen', 'helium3', 'energy_drink', 'energy', 'food', 'steel', 'gas'].includes(rt)),
    []
  );
  const [levels, setLevels] = useState<any[]>([]);
  const [active, setActive] = useState<any>(null);
  const [selectedResource, setSelectedResource] = useState<string>('oil');
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [costPreview, setCostPreview] = useState<DeepCostPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [activating, setActivating] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/resources/deep-exploration/status?nationId=${nationId}`, { credentials: 'include' });
        const data = await res.json();
        setActive(data.active);
        setLevels(data.levels || []);
        if (data.levels?.length > 0) setSelectedLevel(data.levels[0].level);
        if (!deepResourceTypes.includes(selectedResource as any)) {
          setSelectedResource(deepResourceTypes[0] || 'oil');
        }
      } catch (err: any) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [nationId, deepResourceTypes, selectedResource]);

  const computeCost = useCallback(async () => {
    if (!selectedResource || !selectedLevel || !nationId) return;
    setComputing(true);
    setCostPreview(null);
    try {
      const res = await fetch('/api/resources/deep-exploration/cost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nationId, resourceType: selectedResource, level: selectedLevel }),
      });
      const data = await res.json();
      if (data.error) {
        setMessage({ text: data.error, type: 'error' });
      } else {
        setCostPreview(data);
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setComputing(false);
    }
  }, [nationId, selectedResource, selectedLevel]);

  useEffect(() => { computeCost(); }, [computeCost]);

  const handleActivate = async () => {
    if (!costPreview) return;
    const resLabel = RESOURCE_LABELS[selectedResource as ResourceType];
    const goldPart = costPreview.costGold > 0 ? ` + ${costPreview.costGold.toLocaleString()} gold` : '';
    const confirmMsg = `Confermi l'attivazione di Deep Exploration Lv${selectedLevel} per ${resLabel}?\n\nCosto: 💎${costPreview.costDiamonds.toLocaleString()} + €${costPreview.costEur.toLocaleString()}${goldPart}`;
    if (!window.confirm(confirmMsg)) return;

    setActivating(true);
    setMessage(null);
    try {
      const res = await fetch('/api/resources/deep-exploration/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nationId, resourceType: selectedResource, level: selectedLevel }),
      });
      const data = await res.json();
      if (data.error) {
        setMessage({ text: data.error, type: 'error' });
      } else {
        setMessage({ text: data.message || 'Deep Exploration attivata!', type: 'success' });
        setActive({ ...data, resourceType: selectedResource, targetCap: costPreview.targetCap, endsAt: data.endsAt });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setActivating(false);
    }
  };

  if (loading) return <div className="flex justify-center p-6"><Loader2 className="w-6 h-6 animate-spin text-purple-400" /></div>;

  return (
    <div className="bg-white p-5 rounded-2xl border border-purple-100 shadow-sm space-y-4">
      <h3 className="text-sm font-black uppercase tracking-widest text-purple-600 flex items-center gap-2">
        🔮 Deep Exploration
      </h3>
      <p className="text-[10px] text-slate-400">
        Attiva una legge temporanea (7 giorni) che aumenta i cap di ricarica per una risorsa in tutte le regioni della nazione.
        Il costo dipende da quanto devi alzare i cap (somma dei delta).
      </p>

      {/* Active Deep indicator */}
      {active && (
        <div className="bg-purple-50 p-3 rounded-xl border border-purple-200 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔮</span>
            <span className="font-black text-purple-700 text-sm">Deep Exploration ATTIVA</span>
          </div>
          <p className="text-xs text-purple-600">
            Risorsa: <span className="font-bold">{RESOURCE_ICONS_MAP[active.resourceType as ResourceType]} {RESOURCE_LABELS[active.resourceType as ResourceType]}</span>
            {' '} | Target Cap: <span className="font-bold">{active.targetCap}</span>
          </p>
          <p className="text-xs text-purple-500">
            Scade: {new Date(active.endsAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}

      {!active && (
        <>
          {/* Resource selector */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Risorsa Target</label>
            <div className="flex gap-2 flex-wrap">
              {deepResourceTypes.map(rt => (
                <button
                  key={rt}
                  onClick={() => setSelectedResource(rt)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedResource === rt ? 'bg-purple-100 text-purple-700 border-2 border-purple-300' : 'bg-slate-50 text-slate-500 border border-slate-200'
                  }`}
                >
                  <ResourceIcon id={rt} size={14} />
                  <span>{RESOURCE_LABELS[rt] || rt}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Level selector */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Livello Deep</label>
            <div className="flex gap-2">
              {levels.map((l: any) => (
                <button
                  key={l.level}
                  onClick={() => setSelectedLevel(l.level)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    selectedLevel === l.level ? 'bg-purple-600 text-white shadow-lg shadow-purple-200' : 'bg-slate-50 text-slate-600 border border-slate-200'
                  }`}
                >
                  Lv {l.level} — Cap {l.targetCap}
                </button>
              ))}
            </div>
          </div>

          {/* Cost preview */}
          {computing && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-3 h-3 animate-spin" /> Calcolo costi...
            </div>
          )}

          {costPreview && !computing && (
            <div className="bg-slate-50 p-3 rounded-xl space-y-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Anteprima Costi</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white p-2 rounded-lg border border-slate-100">
                  <p className="text-[9px] text-slate-400">Target Cap</p>
                  <p className="text-sm font-black text-purple-700">{costPreview.targetCap}</p>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-100">
                  <p className="text-[9px] text-slate-400">Regioni</p>
                  <p className="text-sm font-black text-slate-700">{costPreview.numRegions}</p>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-100">
                  <p className="text-[9px] text-slate-400">ΣDelta</p>
                  <p className="text-sm font-black text-amber-700">{costPreview.sumDelta.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex gap-2 text-xs font-bold">
                {costPreview.costDiamonds > 0 && (
                  <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded">💎 {costPreview.costDiamonds.toLocaleString()}</span>
                )}
                {costPreview.costEur > 0 && (
                  <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded">€{costPreview.costEur.toLocaleString()}</span>
                )}
                {costPreview.costGold > 0 && (
                  <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded">🪙 {costPreview.costGold.toLocaleString()}</span>
                )}
              </div>
            </div>
          )}

          {/* Activate button */}
          <button
            onClick={handleActivate}
            disabled={!costPreview || activating || computing}
            className={`w-full py-3 rounded-xl font-black text-sm uppercase tracking-wide transition-all flex items-center justify-center gap-2 ${
              costPreview && !activating ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-200' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {activating ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>🔮</span>}
            Attiva Deep Exploration Lv{selectedLevel}
          </button>
        </>
      )}

      {message && (
        <div className={`p-3 rounded-xl text-xs font-bold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
          {message.text}
        </div>
      )}
    </div>
  );
};
