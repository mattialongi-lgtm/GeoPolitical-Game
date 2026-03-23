import React, { useState, useEffect } from 'react';
import { Flag, Users, AlertTriangle, Loader2, Zap } from 'lucide-react';
import { GAME_CONFIG } from '../../types';

interface LobbyInfo {
  id: string;
  lobbyType: 'revolution' | 'coup';
  regionId: string;
  participants: { id: string; username: string }[];
  required: number;
  current: number;
  goldCostPerPlayer: number;
  isJoined: boolean;
  expiresAt: string;
}

interface RevolutionPanelProps {
  regionId: string;
  userId: string;
  userGold: number;
  regionDevelopment: number;
  onStartRevolution: (regionId: string) => Promise<void>;
  onStartCoup: (regionId: string) => Promise<void>;
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
  const [lobbies, setLobbies] = useState<LobbyInfo[]>([]);
  const [loadingLobbies, setLoadingLobbies] = useState(false);

  const canRevolution = userGold >= GAME_CONFIG.WAR_REVOLUTION_GOLD_COST;
  const canCoup = regionDevelopment <= GAME_CONFIG.WAR_COUP_MAX_DEVELOPMENT;

  const fetchLobbies = async () => {
    if (!regionId) return;
    setLoadingLobbies(true);
    try {
      const res = await fetch(`/api/lobbies/${regionId}`);
      if (res.ok) {
        const data = await res.json();
        setLobbies(data.lobbies || []);
      }
    } catch { }
    setLoadingLobbies(false);
  };

  useEffect(() => {
    fetchLobbies();
    const iv = setInterval(fetchLobbies, 30000); // Refresh every 30s
    return () => clearInterval(iv);
  }, [regionId]);

  const handleJoinOrCreate = async (type: 'revolution' | 'coup') => {
    if (type === 'revolution') {
      await onStartRevolution(regionId);
    } else {
      await onStartCoup(regionId);
    }
    fetchLobbies();
  };

  const revLobby = lobbies.find(l => l.lobbyType === 'revolution');
  const coupLobby = lobbies.find(l => l.lobbyType === 'coup');

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

      <div className="grid grid-cols-1 gap-3">
        {/* Revolution Section */}
        <div className="bg-white/10 rounded-2xl p-4 border border-white/20 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-black text-sm uppercase">🔥 Rivoluzione</p>
              <p className="text-[9px] font-medium text-rose-200">
                Costo: {GAME_CONFIG.WAR_REVOLUTION_GOLD_COST} Gold per giocatore • Min. {GAME_CONFIG.WAR_REVOLUTION_MIN_PLAYERS} giocatori
              </p>
            </div>
            {revLobby && (
              <div className="bg-white/20 px-3 py-1.5 rounded-xl">
                <span className="text-sm font-black">{revLobby.current}/{revLobby.required}</span>
              </div>
            )}
          </div>

          {revLobby ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {revLobby.participants.map((p, i) => (
                  <span key={p.id} className="bg-white/20 px-2 py-1 rounded-lg text-[10px] font-black">
                    {i + 1}. {p.username || p.id.slice(0, 8)}
                  </span>
                ))}
                {Array.from({ length: revLobby.required - revLobby.current }).map((_, i) => (
                  <span key={`empty-${i}`} className="bg-white/10 px-2 py-1 rounded-lg text-[10px] font-bold text-rose-300 border border-dashed border-white/20">
                    ? In attesa...
                  </span>
                ))}
              </div>
              {!revLobby.isJoined ? (
                <button
                  onClick={() => handleJoinOrCreate('revolution')}
                  disabled={loading || !canRevolution}
                  className="w-full py-3 bg-white/30 hover:bg-white/40 rounded-2xl font-black uppercase text-xs tracking-widest transition-all border border-white/30 flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                  Unisciti alla Rivoluzione ({GAME_CONFIG.WAR_REVOLUTION_GOLD_COST} 🪙)
                </button>
              ) : (
                <div className="bg-emerald-500/30 rounded-xl p-2 text-center">
                  <span className="text-[10px] font-black text-emerald-100">✓ Ti sei unito! In attesa di altri giocatori...</span>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => handleJoinOrCreate('revolution')}
              disabled={loading || !canRevolution}
              className="w-full py-3 bg-white/20 hover:bg-white/30 rounded-2xl font-black uppercase text-xs tracking-widest transition-all border border-white/20 flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              🔥 Crea Lobby Rivoluzione ({GAME_CONFIG.WAR_REVOLUTION_GOLD_COST} 🪙)
            </button>
          )}

          <div className="flex items-center gap-2 bg-amber-500/30 rounded-xl p-2">
            <AlertTriangle className="w-4 h-4 text-amber-200 flex-shrink-0" />
            <span className="text-[10px] font-bold text-amber-100">
              Se vinci: regione indipendente, -50% edifici, cambio governo. Cooldown: 4 giorni.
            </span>
          </div>
        </div>

        {/* Coup Section */}
        <div className="bg-white/10 rounded-2xl p-4 border border-white/20 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-black text-sm uppercase">⚡ Colpo di Stato</p>
              <p className="text-[9px] font-medium text-rose-200">
                Solo se sviluppo ≤ {GAME_CONFIG.WAR_COUP_MAX_DEVELOPMENT} • Min. {GAME_CONFIG.WAR_COUP_MIN_PLAYERS} giocatori
              </p>
            </div>
            {coupLobby && (
              <div className="bg-white/20 px-3 py-1.5 rounded-xl">
                <span className="text-sm font-black">{coupLobby.current}/{coupLobby.required}</span>
              </div>
            )}
          </div>

          {coupLobby ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {coupLobby.participants.map((p, i) => (
                  <span key={p.id} className="bg-white/20 px-2 py-1 rounded-lg text-[10px] font-black">
                    {i + 1}. {p.username || p.id.slice(0, 8)}
                  </span>
                ))}
                {Array.from({ length: coupLobby.required - coupLobby.current }).map((_, i) => (
                  <span key={`empty-${i}`} className="bg-white/10 px-2 py-1 rounded-lg text-[10px] font-bold text-rose-300 border border-dashed border-white/20">
                    ? In attesa...
                  </span>
                ))}
              </div>
              {!coupLobby.isJoined ? (
                <button
                  onClick={() => handleJoinOrCreate('coup')}
                  disabled={loading || !canCoup}
                  className="w-full py-3 bg-white/30 hover:bg-white/40 rounded-2xl font-black uppercase text-xs tracking-widest transition-all border border-white/30 flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                  Unisciti al Golpe
                </button>
              ) : (
                <div className="bg-emerald-500/30 rounded-xl p-2 text-center">
                  <span className="text-[10px] font-black text-emerald-100">✓ Ti sei unito! In attesa di altri giocatori...</span>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => handleJoinOrCreate('coup')}
              disabled={loading || !canCoup}
              className="w-full py-3 bg-white/20 hover:bg-white/30 rounded-2xl font-black uppercase text-xs tracking-widest transition-all border border-white/20 flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              ⚡ Crea Lobby Golpe
            </button>
          )}

          <div className="flex items-center gap-2 bg-amber-500/30 rounded-xl p-2">
            <Zap className="w-4 h-4 text-amber-200 flex-shrink-0" />
            <span className="text-[10px] font-bold text-amber-100">
              Se vinci: indipendenza, nessuna perdita edifici.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
