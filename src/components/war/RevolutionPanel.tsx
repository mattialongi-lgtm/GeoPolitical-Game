import React, { useState, useEffect } from 'react';
import { Flag, Users, AlertTriangle, Loader2, Zap } from 'lucide-react';
import { GAME_CONFIG } from '../../types';
import { usePollingTask } from '../../hooks/usePollingTask';

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
  onStartRevolution: (regionId: string) => Promise<{ ok: boolean; error?: string }>;
  onStartCoup: (regionId: string) => Promise<{ ok: boolean; error?: string }>;
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
  const [joinedOverride, setJoinedOverride] = useState<{ revolution?: boolean; coup?: boolean }>({});

  const canRevolution = userGold >= GAME_CONFIG.WAR_REVOLUTION_GOLD_COST;
  const canCoup = regionDevelopment === GAME_CONFIG.WAR_COUP_MAX_DEVELOPMENT
    && userGold >= GAME_CONFIG.WAR_COUP_GOLD_COST;

  const fetchLobbies = React.useCallback(async () => {
    if (!regionId) return;
    setLoadingLobbies(true);
    try {
      const res = await fetch(`/api/lobbies/${regionId}`);
      if (res.ok) {
        const data = await res.json();
        setLobbies(data.lobbies || []);
      }
    } catch (err) { console.error("[lobbies] Fetch error:", err); }
    setLoadingLobbies(false);
  }, [regionId]);

  usePollingTask(fetchLobbies, {
    enabled: Boolean(regionId),
    intervalMs: 15_000,
    refreshOnVisible: true,
    refreshOnFocus: true,
  });
  useEffect(() => {
    setJoinedOverride({});
  }, [regionId]);

  const handleJoinOrCreate = async (type: 'revolution' | 'coup') => {
    try {
      const result = type === 'revolution'
        ? await onStartRevolution(regionId)
        : await onStartCoup(regionId);
      const normalizedError = result?.error?.toLowerCase() ?? '';
      if (normalizedError.includes('gia')) {
        setJoinedOverride(prev => ({ ...prev, [type]: true }));
      }
    } finally {
      fetchLobbies();
    }
  };

  const revLobby = lobbies.find(l => l.lobbyType === 'revolution');
  const coupLobby = lobbies.find(l => l.lobbyType === 'coup');
  const revJoined = revLobby ? revLobby.isJoined : !!joinedOverride.revolution;
  const coupJoined = coupLobby ? coupLobby.isJoined : !!joinedOverride.coup;
  const revCurrent = revLobby?.current ?? 1;
  const revRequired = revLobby?.required ?? GAME_CONFIG.WAR_REVOLUTION_MIN_PLAYERS;
  const coupCurrent = coupLobby?.current ?? 1;
  const coupRequired = coupLobby?.required ?? GAME_CONFIG.WAR_COUP_MIN_PLAYERS;
  const showRevLobby = !!revLobby || revJoined;
  const showCoupLobby = !!coupLobby || coupJoined;

  return (
    <div className="bg-gradient-to-br from-rose-600 to-rose-700 p-6 rounded-2xl shadow-lg shadow-rose-900/40 text-white space-y-4">
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

          {showRevLobby ? (
            <div className="space-y-2">
              {!revJoined && revLobby && (
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
              )}
              {!revJoined ? (
                <button
                  onClick={() => handleJoinOrCreate('revolution')}
                  disabled={loading || !canRevolution}
                  className="w-full py-3 bg-white/30 hover:bg-white/40 rounded-2xl font-black uppercase text-xs tracking-widest transition-all border border-white/30 flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                  Unisciti alla Rivoluzione ({GAME_CONFIG.WAR_REVOLUTION_GOLD_COST} 🪙)
                </button>
              ) : (
                <button
                  disabled
                  className="w-full py-3 bg-white/10 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-white/20 opacity-60 cursor-not-allowed"
                >
                  Rivoluzionari {revCurrent}/{revRequired}, ti sei gia' unito a questa rivoluzione
                </button>
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
              Se vinci: regione indipendente, -50% edifici, cambio governo. Cooldown: 5 giorni.
            </span>
          </div>
        </div>

        {/* Coup Section */}
        <div className="bg-white/10 rounded-2xl p-4 border border-white/20 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-black text-sm uppercase">⚡ Colpo di Stato</p>
              <p className="text-[9px] font-medium text-rose-200">
                Costo: {GAME_CONFIG.WAR_COUP_GOLD_COST} Gold per giocatore • Solo se sviluppo = {GAME_CONFIG.WAR_COUP_MAX_DEVELOPMENT} • Min. {GAME_CONFIG.WAR_COUP_MIN_PLAYERS} giocatori
              </p>
            </div>
            {coupLobby && (
              <div className="bg-white/20 px-3 py-1.5 rounded-xl">
                <span className="text-sm font-black">{coupLobby.current}/{coupLobby.required}</span>
              </div>
            )}
          </div>

          {showCoupLobby ? (
            <div className="space-y-2">
              {!coupJoined && coupLobby && (
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
              )}
              {!coupJoined ? (
                <button
                  onClick={() => handleJoinOrCreate('coup')}
                  disabled={loading || !canCoup}
                  className="w-full py-3 bg-white/30 hover:bg-white/40 rounded-2xl font-black uppercase text-xs tracking-widest transition-all border border-white/30 flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                  Unisciti al Golpe ({GAME_CONFIG.WAR_COUP_GOLD_COST} 🪙)
                </button>
              ) : (
                <button
                  disabled
                  className="w-full py-3 bg-white/10 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-white/20 opacity-60 cursor-not-allowed"
                >
                  Golpisti {coupCurrent}/{coupRequired}, ti sei gia' unito a questo colpo di stato
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => handleJoinOrCreate('coup')}
              disabled={loading || !canCoup}
              className="w-full py-3 bg-white/20 hover:bg-white/30 rounded-2xl font-black uppercase text-xs tracking-widest transition-all border border-white/20 flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              ⚡ Crea Lobby Golpe ({GAME_CONFIG.WAR_COUP_GOLD_COST} 🪙)
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
