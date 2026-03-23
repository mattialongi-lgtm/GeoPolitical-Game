import React, { useState } from 'react';
import { Swords, Globe, Anchor, Rocket, Moon, Loader2 } from 'lucide-react';
import type { WarType } from '../../types';

const WAR_TYPE_CONFIG: Record<WarType, { emoji: string; label: string; desc: string; icon: typeof Swords }> = {
  training: { emoji: '🎯', label: 'Addestramento', desc: 'Sempre disponibile, per esperienza', icon: Swords },
  land: { emoji: '⚔️', label: 'Guerra Terrestre', desc: 'Solo regioni confinanti, 24h', icon: Globe },
  naval: { emoji: '🚢', label: 'Guerra Navale', desc: 'Accesso al mare, 2 fasi', icon: Anchor },
  space: { emoji: '🚀', label: 'Guerra Spaziale', desc: 'Terra → Luna, spazioporti', icon: Rocket },
  lunar: { emoji: '🌙', label: 'Guerra Lunare', desc: 'Regioni lunari confinanti', icon: Moon },
  revolution: { emoji: '🔥', label: 'Rivoluzione', desc: '3 giocatori, costo gold', icon: Swords },
  coup: { emoji: '⚡', label: 'Colpo di Stato', desc: 'Solo se sviluppo = 1', icon: Swords },
};

interface WarCreatePanelProps {
  userRegionId: string;
  onCreateWar: (attackerRegionId: string, defenderRegionId: string, warType: WarType) => Promise<void>;
  loading: boolean;
}

export const WarCreatePanel: React.FC<WarCreatePanelProps> = ({
  userRegionId,
  onCreateWar,
  loading,
}) => {
  const [selectedType, setSelectedType] = useState<WarType>('land');
  const [targetRegion, setTargetRegion] = useState('');
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = async () => {
    if (!targetRegion.trim()) {
      alert('Inserisci l\'ID della regione bersaglio.');
      return;
    }
    await onCreateWar(userRegionId, targetRegion.trim(), selectedType);
    setTargetRegion('');
    setShowForm(false);
  };

  const allowedTypes: WarType[] = ['land', 'naval', 'space', 'lunar'];

  return (
    <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-rose-50">
          <Swords className="w-6 h-6 text-rose-600" />
        </div>
        <div>
          <h3 className="font-black text-slate-900 uppercase tracking-tight">Dichiara Guerra</h3>
          <p className="text-xs text-slate-400 font-medium">Attacca una regione nemica</p>
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
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Tipo di Guerra</label>
            <div className="grid grid-cols-2 gap-2">
              {allowedTypes.map((type) => {
                const config = WAR_TYPE_CONFIG[type];
                return (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      selectedType === type
                        ? 'border-rose-400 bg-rose-50 shadow-sm'
                        : 'border-slate-100 bg-white hover:border-slate-200'
                    }`}
                  >
                    <div className="text-lg">{config.emoji}</div>
                    <div className="text-xs font-black text-slate-800">{config.label}</div>
                    <div className="text-[9px] text-slate-400 font-medium">{config.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Regione Bersaglio</label>
            <input
              type="text"
              value={targetRegion}
              onChange={(e) => setTargetRegion(e.target.value)}
              placeholder="Es: IT-MI, US-CA..."
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-bold text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => { setShowForm(false); setTargetRegion(''); }}
              className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-xs hover:bg-slate-200 transition-all"
            >
              Annulla
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !targetRegion.trim()}
              className="flex-1 py-3 bg-rose-500 text-white rounded-2xl font-black uppercase text-xs shadow-lg shadow-rose-100 hover:bg-rose-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}
              Attacca!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
