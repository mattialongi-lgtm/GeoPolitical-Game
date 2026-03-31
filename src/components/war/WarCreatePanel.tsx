import React, { useState, useEffect } from 'react';
import { Swords, Globe, Anchor, Loader2 } from 'lucide-react';
import type { WarType } from '../../types';

const WAR_TYPE_CONFIG: Record<string, { emoji: string; label: string; desc: string; icon: typeof Swords }> = {
  training: { emoji: '🎯', label: 'Addestramento', desc: 'Sempre disponibile, per esperienza', icon: Swords },
  land: { emoji: '⚔️', label: 'Guerra Terrestre', desc: 'Solo regioni confinanti, 24h', icon: Globe },
  naval: { emoji: '🚢', label: 'Guerra Navale', desc: 'Entro 1500km, 2 fasi', icon: Anchor },
  revolution: { emoji: '🔥', label: 'Rivoluzione', desc: '3 giocatori, costo gold', icon: Swords },
  coup: { emoji: '⚡', label: 'Colpo di Stato', desc: 'Solo se sviluppo = 1', icon: Swords },
};

interface TargetRegion {
  id: string;
  name: string;
  nation_id: string;
  allowedTypes: string[];
}

interface WarCreatePanelProps {
  userRegionId: string;
  onCreateWar: (attackerRegionId: string, defenderRegionId: string, warType: WarType) => Promise<void>;
  loading: boolean;
}

export const WarCreatePanel: React.FC<WarCreatePanelProps> = ({
  userRegionId,
  onCreateWar,
  loading: creating,
}) => {
  const [attackerRegion, setAttackerRegion] = useState<string>('');
  const [targetRegion, setTargetRegion] = useState('');
  const [selectedType, setSelectedType] = useState<WarType | null>(null);
  const [showForm, setShowForm] = useState(false);
  
  const [myRegions, setMyRegions] = useState<{ id: string, name: string }[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(false);
  
  const [validTargets, setValidTargets] = useState<TargetRegion[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [targetsError, setTargetsError] = useState<string | null>(null);

  // Load user's managed regions when form opens
  useEffect(() => {
    if (showForm) {
      const fetchRegions = async () => {
        setRegionsLoading(true);
        try {
          const res = await fetch('/api/users/me/managed-regions');
          if (res.ok) {
            const data = await res.json();
            setMyRegions(data);
            if (data.length > 0 && !attackerRegion) {
              setAttackerRegion(data[0].id);
            }
          }
        } catch (e) {
          console.error("Errore recupero regioni", e);
        } finally {
          setRegionsLoading(false);
        }
      };
      // Fetch only if we haven't already
      if (myRegions.length === 0) fetchRegions();
    }
  }, [showForm, attackerRegion, myRegions.length]);

  // Load valid targets when attackerRegion changes
  useEffect(() => {
    if (!showForm || !attackerRegion) {
      setValidTargets([]);
      setTargetRegion('');
      setSelectedType(null);
      return;
    }

    const fetchTargets = async () => {
      setTargetsLoading(true);
      setTargetsError(null);
      try {
        const res = await fetch(`/api/wars/targets/${encodeURIComponent(attackerRegion)}`);
        const data = await res.json();
        
        if (res.ok) {
          setValidTargets(data || []);
          if (data && data.length > 0) {
            const firstTarget = data[0];
            setTargetRegion(firstTarget.id);
            if (firstTarget.allowedTypes.length > 0) {
              setSelectedType(firstTarget.allowedTypes[0] as WarType);
            }
          } else {
            setTargetRegion('');
            setSelectedType(null);
          }
        } else {
          setValidTargets([]);
          setTargetsError(data.error || "Impossibile caricare i bersagli validi.");
          setTargetRegion('');
          setSelectedType(null);
        }
      } catch (err) {
         setTargetsError("Errore di connessione.");
      } finally {
        setTargetsLoading(false);
      }
    };

    fetchTargets();
  }, [attackerRegion, showForm]);

  // Handle target change to auto-select type
  useEffect(() => {
    if (targetRegion) {
      const target = validTargets.find(t => t.id === targetRegion);
      if (target && target.allowedTypes && target.allowedTypes.length > 0) {
        if (!target.allowedTypes.includes(selectedType as string)) {
          setSelectedType(target.allowedTypes[0] as WarType);
        }
      } else {
        setSelectedType(null);
      }
    }
  }, [targetRegion, validTargets]);


  const handleSubmit = async () => {
    if (!targetRegion) {
      alert('Seleziona una regione bersaglio.');
      return;
    }
    if (!selectedType) {
      alert('Seleziona un tipo di guerra valido.');
      return;
    }
    await onCreateWar(attackerRegion, targetRegion, selectedType);
    setTargetRegion('');
    setShowForm(false);
  };

  const currentTarget = validTargets.find(t => t.id === targetRegion);
  const allowedTypes = currentTarget?.allowedTypes || [];

  return (
    <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-rose-50">
          <Swords className="w-6 h-6 text-rose-600" />
        </div>
        <div>
          <h3 className="font-black text-slate-900 uppercase tracking-tight">Dichiara Guerra</h3>
          <p className="text-xs text-slate-400 font-medium">Scegli tra i bersagli geograficamente raggiungibili</p>
        </div>
      </div>

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-4 bg-rose-500 text-white rounded-2xl font-black uppercase text-sm shadow-lg shadow-rose-100 hover:bg-rose-600 transition-all flex items-center justify-center gap-2"
        >
          <Swords className="w-5 h-5" /> Apri Fronte di Guerra
        </button>
      ) : (
        <div className="space-y-5">
          {/* Attacker Selection */}
          <div className="bg-rose-50 p-4 rounded-3xl border border-rose-100 space-y-4">
             <div>
                <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest block mb-1">Passo 1: Regione di Partenza</label>
                <p className="text-[10px] text-slate-500 mb-2 leading-tight">Da quale costa/confine lancerai le tue armate?</p>
                {regionsLoading ? (
                   <div className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin"/> Caricamento regioni...</div>
                ) : (
                   <select 
                     value={attackerRegion}
                     onChange={(e) => setAttackerRegion(e.target.value)}
                     className="w-full px-4 py-3 rounded-2xl border border-rose-200 bg-white text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-200"
                   >
                     {myRegions.length === 0 && <option value="">Nessuna regione gestita</option>}
                     {myRegions.map(reg => (
                        <option key={reg.id} value={reg.id}>{reg.name} ({reg.id})</option>
                     ))}
                   </select>
                )}
             </div>

             {/* Target Selection */}
             <div>
               <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest block mb-1">Passo 2: Regione Bersaglio</label>
               {targetsLoading ? (
                 <div className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin"/> Ricalcolo mappe satellitari...</div>
               ) : targetsError ? (
                 <p className="text-xs text-red-500">{targetsError}</p>
               ) : (
                 <select
                   value={targetRegion}
                   onChange={(e) => setTargetRegion(e.target.value)}
                   disabled={validTargets.length === 0}
                   className="w-full px-4 py-3 rounded-2xl border border-rose-200 bg-white text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-200 disabled:opacity-50"
                 >
                   {validTargets.length === 0 ? (
                     <option value="">Nessun bersaglio raggiungibile</option>
                   ) : (
                     validTargets.map(target => {
                       let typesLabel = target.allowedTypes.includes('land') && target.allowedTypes.includes('naval') ? 'Terrestre / Navale' :
                                        target.allowedTypes.includes('land') ? 'Solo terrestre' :
                                        target.allowedTypes.includes('naval') ? 'Solo navale' : '';
                       return (
                         <option key={target.id} value={target.id}>
                           {target.name} ({target.id}) - {typesLabel}
                         </option>
                       );
                     })
                   )}
                 </select>
               )}
             </div>
          </div>

          {/* Validation Status & Type Selection */}
          <div className="min-h-[100px]">
             {(!attackerRegion || validTargets.length === 0) ? (
               <div className="h-full flex flex-col justify-center p-4 border border-dashed border-slate-200 rounded-2xl text-center">
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Nessun attacco possibile al momento.<br/>Devi possedere confini o coste utili.</p>
               </div>
             ) : (
               <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Opzioni Militari Disponibili</label>
                    <div className="grid grid-cols-2 gap-2">
                       {['land', 'naval'].map((typeKey) => {
                         const type = typeKey as WarType;
                         const isAllowed = allowedTypes.includes(type);
                         const config = WAR_TYPE_CONFIG[type];
                         
                         return (
                           <button
                             key={type}
                             disabled={!isAllowed}
                             onClick={() => setSelectedType(type)}
                             className={`p-3 rounded-2xl border text-left transition-all ${
                               !isAllowed 
                                 ? 'bg-slate-50 border-slate-100 opacity-50 cursor-not-allowed hidden'
                                 : selectedType === type
                                   ? 'border-indigo-400 bg-indigo-50 shadow-sm'
                                   : 'border-slate-200 bg-white hover:border-indigo-200'
                             }`}
                           >
                             <div className="text-lg">{config.emoji}</div>
                             <div className="text-xs font-black text-slate-800">{config.label}</div>
                             {isAllowed && (
                                <div className="text-[9px] text-slate-400 font-medium">{config.desc}</div>
                             )}
                           </button>
                         );
                       })}
                    </div>
                  </div>
               </div>
             )}
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => { setShowForm(false); setTargetRegion(''); setValidTargets([]); setSelectedType(null); }}
              className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-xs hover:bg-slate-200 transition-all"
            >
              Annulla
            </button>
            <button
              onClick={handleSubmit}
              disabled={creating || !targetRegion || allowedTypes.length === 0 || !selectedType}
              className="flex-1 py-3 bg-rose-500 text-white rounded-2xl font-black uppercase text-xs shadow-lg shadow-rose-100 hover:bg-rose-600 transition-all disabled:opacity-50 disabled:shadow-none disabled:bg-slate-300 disabled:text-slate-500 flex items-center justify-center gap-2"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}
              Chiama alle Armi!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
