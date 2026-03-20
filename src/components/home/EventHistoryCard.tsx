/**
 * EventHistoryCard – Chronological event feed for global game events.
 * Shows recent events with icons, timestamps, and click-to-detail.
 */
import React, { useState } from "react";
import { History, ChevronRight, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { GameEvent } from "./mockData";

interface EventHistoryCardProps {
  events: GameEvent[];
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  war_started: 'text-red-400 bg-red-900/20 border-red-800/30',
  war_ended: 'text-blue-400 bg-blue-900/20 border-blue-800/30',
  law_proposed: 'text-amber-400 bg-amber-900/20 border-amber-800/30',
  law_approved: 'text-emerald-400 bg-emerald-900/20 border-emerald-800/30',
  law_rejected: 'text-red-400 bg-red-900/20 border-red-800/30',
  conquest: 'text-purple-400 bg-purple-900/20 border-purple-800/30',
  treasury_transfer: 'text-yellow-400 bg-yellow-900/20 border-yellow-800/30',
  revolution: 'text-orange-400 bg-orange-900/20 border-orange-800/30',
  government_change: 'text-sky-400 bg-sky-900/20 border-sky-800/30',
  election: 'text-indigo-400 bg-indigo-900/20 border-indigo-800/30',
};

const formatEventTime = (ts: number): string => {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'ora';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m fa`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h fa`;
  return `${Math.floor(diff / 86400000)}g fa`;
};

export default function EventHistoryCard({ events }: EventHistoryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const visibleEvents = expanded ? events : events.slice(0, 4);

  const handleEventClick = (evt: GameEvent) => {
    switch (evt.type) {
      case 'war_started':
      case 'war_ended':
      case 'conquest':
        navigate(evt.targetId ? `/war/${evt.targetId}/summary` : '/wars');
        break;
      case 'law_proposed':
      case 'law_approved':
      case 'law_rejected':
      case 'election':
        navigate('/parliament');
        break;
      case 'government_change':
      case 'revolution':
        navigate('/nation');
        break;
      case 'treasury_transfer':
        navigate('/nation');
        break;
      default:
        break;
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">📋 Storico Eventi</h3>
        {events.length > 4 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {expanded ? 'Chiudi' : `Tutti (${events.length})`}
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {visibleEvents.length === 0 ? (
          <div className="bg-gray-800/40 border border-gray-700/30 rounded-xl p-4 text-center">
            <History className="w-5 h-5 text-gray-600 mx-auto mb-1" />
            <p className="text-[10px] text-gray-500 font-medium">Nessun evento recente</p>
          </div>
        ) : (
          visibleEvents.map((evt) => {
            const colors = EVENT_TYPE_COLORS[evt.type] || 'text-gray-400 bg-gray-800/40 border-gray-700/30';
            return (
              <button
                key={evt.id}
                onClick={() => handleEventClick(evt)}
                className={`w-full flex items-start gap-2.5 p-2.5 rounded-xl border transition-all hover:scale-[1.01] active:scale-[0.99] group ${colors}`}
              >
                <div className="flex-1 text-left min-w-0 flex gap-2.5">
                  <span className="text-base shrink-0 mt-0.5">{evt.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white group-hover:text-indigo-200 transition-colors truncate">
                      {evt.title}
                    </p>
                    {evt.values && (
                      <span className="text-[10px] font-bold text-yellow-400">{evt.values}</span>
                    )}
                    <p className="text-[10px] text-gray-400 group-hover:text-gray-300 transition-colors truncate mt-0.5">
                      {evt.description}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end shrink-0 gap-1 mt-0.5">
                  <span className="text-[9px] font-bold text-gray-500">{formatEventTime(evt.timestamp)}</span>
                  <ChevronRight className="w-3 h-3 text-gray-600 group-hover:text-indigo-400 transition-colors" />
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

