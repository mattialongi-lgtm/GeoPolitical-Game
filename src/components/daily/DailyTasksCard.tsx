/**
 * DailyTasksCard – Checklist of daily tasks with status badges.
 * Shows all daily gameplay tasks the player should complete, with states:
 * completed, available, blocked, cooldown.
 */
import React from 'react';
import { CheckCircle2, Clock, Lock, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { DailyTask, DailyTaskStatus } from '../../types';

interface DailyTasksCardProps {
  tasks: DailyTask[];
  onTaskClick?: (task: DailyTask) => void;
}

const STATUS_CONFIG: Record<DailyTaskStatus, { bg: string; text: string; border: string; icon: React.ElementType; label: string }> = {
  completed: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: CheckCircle2, label: 'Completato' },
  available: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', icon: ChevronRight, label: 'Disponibile' },
  blocked: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30', icon: Lock, label: 'Bloccato' },
  cooldown: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/30', icon: Clock, label: 'In attesa' },
};

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Disponibile';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

export default function DailyTasksCard({ tasks, onTaskClick }: DailyTasksCardProps) {
  const navigate = useNavigate();
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleClick = (task: DailyTask) => {
    if (onTaskClick) {
      onTaskClick(task);
    } else if (task.route) {
      navigate(task.route);
    }
  };

  return (
    <div className="bg-gray-900/80 border border-gray-700/50 rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-white uppercase tracking-wider">📋 Task Quotidiane</h3>
        <span className="text-xs font-bold text-emerald-400">{completedCount}/{totalCount}</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Tasks list */}
      <div className="space-y-2">
        {tasks.map((task) => {
          const config = STATUS_CONFIG[task.status];
          const StatusIcon = config.icon;
          const isInteractive = task.status === 'available' && task.route;

          return (
            <button
              key={task.id}
              onClick={() => handleClick(task)}
              disabled={task.status === 'blocked'}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${config.bg} ${config.border}
                ${isInteractive ? 'hover:border-amber-400/50 active:scale-[0.98]' : ''}
                ${task.status === 'blocked' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span className="text-lg shrink-0">{task.icon}</span>
              <div className="flex-1 text-left min-w-0">
                <p className={`text-xs font-bold ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-white'}`}>
                  {task.title}
                </p>
                <p className="text-[10px] text-gray-500 truncate">{task.description}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {task.status === 'cooldown' && task.cooldownEndsAt && (
                  <span className="text-[10px] font-mono text-sky-400">
                    {formatCountdown(task.cooldownEndsAt - Date.now())}
                  </span>
                )}
                <StatusIcon className={`w-4 h-4 ${config.text}`} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Motivational footer */}
      {progressPercent < 100 && (
        <p className="text-[10px] text-gray-500 text-center italic">
          Completa tutte le task per massimizzare la tua crescita! 🚀
        </p>
      )}
      {progressPercent === 100 && (
        <p className="text-[10px] text-emerald-400 text-center font-bold">
          ✅ Tutte le task giornaliere completate! Ottimo lavoro!
        </p>
      )}
    </div>
  );
}
