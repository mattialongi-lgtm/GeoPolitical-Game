import React, { useState } from 'react';
import { Flag, Users, AlertTriangle, Loader2, Zap } from 'lucide-react';
import { GAME_CONFIG } from '../../types';

interface RevolutionPanelProps {
  regionId: string;
  userId: string;
  userGold: number;
  regionDevelopment: number;
  onStartRevolution: (regionId: string, initiatorIds: string[]) => Promise<void>;
  onStartCoup: (regionId: string, initiatorIds: string[]) => Promise<void>;
  loading: boolean;
}

export const RevolutionPanel: React.FC<RevolutionPanelProps> = ({
  regionId,
  userId,
  userGold,
  regionDevelopment,
  onStartRevolution,
  onStartCoup,
  loading,
}) => {
  const [mode, setMode] = useState<'revolution' | 'coup' | null>(null);
  const [collaboratorIds, setCollaboratorIds] = useState<string>('');

  const canRevolution = userGold >= GAME_CONFIG.WAR_REVOLUTION_GOLD_COST;
  const canCoup = regionDevelopment <= GAME_CONFIG.WAR_COUP_MAX_DEVELOPMENT;

  const handleStart = async () => {
    const ids = [userId, ...collaboratorIds.split(',').map(s => s.trim()).filter(Boolean)];
    if (ids.length < (mode === 'revolution' ? GAME_CONFIG.WAR_REVOLUTION_MIN_PLAYERS : GAME_CONFIG.WAR_COUP_MIN_PLAYERS)) {
      alert(`Servono almeno ${mode === 'revolution' ? GAME_CONFIG.WAR_REVOLUTION_MIN_PLAYERS : GAME_CONFIG.WAR_COUP_MIN_PLAYERS} giocatori.`);
      return;
    }

    if (mode === 'revolution') {
      await onStartRevolution(regionId, ids);
    } else if (mode === 'coup') {
      await onStartCoup(regionId, ids);
    }
    setMode(null);
    setCollaboratorIds('');
  };

  return (
    <div className="bg-gradient-to-br from-rose-600 to-rose-700 p-6 rounded-[2.5rem] shadow-lg shadow-rose-200 text-white space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-white/20">
          <Flag className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="font-black uppercase tracking-tight">Rivoluzione / Colpo di Stato</h3>
          <p className="text-rose-200 text-xs font-medium">Organizza un cambio di potere nella regione</p>
        </div>
      </div>

      {!mode ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setMode('revolution')}
            disabled={!canRevolution}
            className="py-4 bg-white/20 hover:bg-white/30 rounded-2xl font-black uppercase text-xs tracking-widest transition-all border border-white/20 disabled:opacity-40 space-y-1"
          >
            <div className="text-lg">🔥</div>
            <div>Rivoluzione</div>
            <div className="text-[9px] font-medium text-rose-200">
              Costo: {GAME_CONFIG.WAR_REVOLUTION_GOLD_COST} Gold × {GAME_CONFIG.WAR_REVOLUTION_MIN_PLAYERS} giocatori
            </div>
          </button>
          <button
            onClick={() => setMode('coup')}
            disabled={!canCoup}
            className="py-4 bg-white/20 hover:bg-white/30 rounded-2xl font-black uppercase text-xs tracking-widest transition-all border border-white/20 disabled:opacity-40 space-y-1"
          >
            <div className="text-lg">⚡</div>
            <div>Colpo di Stato</div>
            <div className="text-[9px] font-medium text-rose-200">
              Solo se sviluppo = {GAME_CONFIG.WAR_COUP_MAX_DEVELOPMENT}
            </div>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-200 mb-2">
              {mode === 'revolution' ? '🔥 Nuova Rivoluzione' : '⚡ Colpo di Stato'}
            </p>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-rose-200" />
              <span className="text-xs font-medium text-rose-100">
                Inserisci gli ID dei collaboratori (separati da virgola):
              </span>
            </div>
            <input
              type="text"
              value={collaboratorIds}
              onChange={(e) => setCollaboratorIds(e.target.value)}
              placeholder="ID giocatore 2, ID giocatore 3..."
              className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-rose-300 text-xs focus:outline-none focus:ring-2 focus:ring-white/30"
            />
          </div>

          {mode === 'revolution' && (
            <div className="flex items-center gap-2 bg-amber-500/30 rounded-xl p-2">
              <AlertTriangle className="w-4 h-4 text-amber-200 flex-shrink-0" />
              <span className="text-[10px] font-bold text-amber-100">
                Se vinci: regione indipendente, -50% edifici, cambio governo. Cooldown: 4 giorni.
              </span>
            </div>
          )}

          {mode === 'coup' && (
            <div className="flex items-center gap-2 bg-amber-500/30 rounded-xl p-2">
              <Zap className="w-4 h-4 text-amber-200 flex-shrink-0" />
              <span className="text-[10px] font-bold text-amber-100">
                Se vinci: indipendenza, nessuna perdita edifici.
              </span>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => { setMode(null); setCollaboratorIds(''); }}
              className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-2xl font-black uppercase text-xs tracking-widest transition-all border border-white/20"
            >
              Annulla
            </button>
            <button
              onClick={handleStart}
              disabled={loading}
              className="flex-1 py-3 bg-white/30 hover:bg-white/40 rounded-2xl font-black uppercase text-xs tracking-widest transition-all border border-white/30 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {mode === 'revolution' ? '🔥 Inizia Rivoluzione' : '⚡ Inizia Golpe'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
