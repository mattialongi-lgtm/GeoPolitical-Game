import React, { useState, useEffect } from 'react';
import { History } from 'lucide-react';

interface WarHistoryEntry {
  id: string;
  warId: string;
  eventType: string;
  eventData: Record<string, unknown>;
  createdAt: string;
}

const EVENT_LABELS: Record<string, { emoji: string; label: string }> = {
  war_started: { emoji: '⚔️', label: 'Guerra iniziata' },
  war_ended: { emoji: '🏁', label: 'Guerra terminata' },
  phase_change: { emoji: '🔄', label: 'Cambio fase' },
  deployment: { emoji: '🎯', label: 'Schieramento' },
  resolution: { emoji: '🏆', label: 'Risoluzione' },
  building_destroyed: { emoji: '💥', label: 'Edificio distrutto' },
  territory_transferred: { emoji: '🗺️', label: 'Territorio trasferito' },
  loot: { emoji: '💰', label: 'Bottino' },
};

interface WarHistoryListProps {
  warId: string;
}

export const WarHistoryList: React.FC<WarHistoryListProps> = ({ warId }) => {
  const [history, setHistory] = useState<WarHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/wars/${encodeURIComponent(warId)}/history`);
        const data = await res.json();
        setHistory(data.history || []);
      } catch {
        // Ignore fetch errors
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [warId]);

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 text-center">
        <div className="animate-spin w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full mx-auto" />
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-slate-50">
          <History className="w-6 h-6 text-slate-600" />
        </div>
        <div>
          <h3 className="font-black text-slate-900 uppercase tracking-tight">Cronologia Guerra</h3>
          <p className="text-xs text-slate-400 font-medium">{history.length} eventi registrati</p>
        </div>
      </div>

      {history.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-4">Nessun evento registrato.</p>
      ) : (
        <div className="space-y-2">
          {history.map((entry) => {
            const eventConfig = EVENT_LABELS[entry.eventType] || { emoji: '📋', label: entry.eventType };
            return (
              <div key={entry.id} className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors">
                <span className="text-lg flex-shrink-0">{eventConfig.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-slate-800">{eventConfig.label}</p>
                  <p className="text-[10px] text-slate-400 font-medium truncate">
                    {new Date(entry.createdAt).toLocaleString()}
                  </p>
                  {entry.eventData && Object.keys(entry.eventData).length > 0 && (
                    <div className="mt-1 text-[9px] text-slate-500 font-medium">
                      {Object.entries(entry.eventData).slice(0, 3).map(([k, v]) => (
                        <span key={k} className="mr-2">{k}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
