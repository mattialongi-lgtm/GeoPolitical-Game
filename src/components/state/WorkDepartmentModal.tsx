/**
 * WorkDepartmentModal — Modal distribuzione 10 punti giornalieri nei dipartimenti
 *
 * Validazioni frontend (il server le replica tutte indipendentemente):
 *  - Somma deve essere esattamente 10
 *  - Solo valori interi >= 0
 *  - Almeno un dipartimento con punti > 0
 */
import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { X, BarChart2, Plus, Minus, AlertCircle, CheckCircle } from 'lucide-react';

interface Dept {
  id: string;
  label: string;
  icon: string;
  category: 'resource' | 'military';
}

interface Props {
  nationId: string;
  allDepartments: Dept[];
  onClose: () => void;
  onSuccess: () => void;
}

const MAX_POINTS = 10;

export default function WorkDepartmentModal({ nationId, allDepartments, onClose, onSuccess }: Props) {
  const [points, setPoints] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalAssigned = useMemo(() => Object.values(points).reduce((s, v) => s + v, 0), [points]);
  const remaining = MAX_POINTS - totalAssigned;

  const resourceDepts = allDepartments.filter(d => d.category === 'resource');
  const militaryDepts = allDepartments.filter(d => d.category === 'military');

  function setDept(id: string, value: number) {
    const clamped = Math.max(0, Math.floor(value)); // niente negativi né decimali
    setPoints(prev => {
      const newPts = { ...prev, [id]: clamped };
      const newTotal = Object.values(newPts).reduce((s, v) => s + v, 0);
      // Impedisce di andare sopra MAX_POINTS lato UI
      if (newTotal > MAX_POINTS) return prev;
      return newPts;
    });
    setError(null);
  }

  function increment(id: string) {
    if (remaining <= 0) return;
    setDept(id, (points[id] || 0) + 1);
  }

  function decrement(id: string) {
    const current = points[id] || 0;
    if (current <= 0) return;
    setDept(id, current - 1);
  }

  async function handleSubmit() {
    setError(null);

    // Validazione frontend (il server la replica server-side)
    const filteredContributions: Record<string, number> = {};
    for (const [id, pts] of Object.entries(points)) {
      if (pts > 0) filteredContributions[id] = pts;
    }

    if (totalAssigned !== MAX_POINTS) {
      setError(`Devi assegnare esattamente ${MAX_POINTS} punti. Hai assegnato ${totalAssigned}.`);
      return;
    }
    if (Object.keys(filteredContributions).length === 0) {
      setError('Seleziona almeno un dipartimento.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/state/${nationId}/departments/contribute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contributions: filteredContributions }),
      });

      const data = await res.json();
      if (res.ok) {
        onSuccess();
      } else {
        setError(data.error || 'Errore durante il salvataggio.');
      }
    } catch {
      setError('Errore di connessione. Riprova.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-[2rem] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-indigo-600/20 flex items-center justify-center">
              <BarChart2 className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-tight">Lavora nei Dipartimenti</h3>
              <p className="text-[9px] font-bold text-gray-500 tracking-widest">DISTRIBUZIONE GIORNALIERA</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-xl transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Contatore punti rimanenti */}
        <div className="px-5 pt-4 pb-2">
          <div className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
            remaining === 0 ? 'bg-emerald-900/20 border-emerald-700/40' : 'bg-gray-800/40 border-gray-700/30'
          }`}>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Punti rimanenti</span>
            <span className={`text-lg font-black tabular-nums ${remaining === 0 ? 'text-emerald-400' : remaining < 0 ? 'text-red-400' : 'text-white'}`}>
              {remaining}
            </span>
          </div>
        </div>

        {/* Lista dipartimenti */}
        <div className="px-5 pb-4 overflow-y-auto max-h-[55vh] space-y-4">
          {/* Risorse */}
          <DeptGroup
            title="Risorse"
            depts={resourceDepts}
            points={points}
            remaining={remaining}
            onIncrement={increment}
            onDecrement={decrement}
          />
          {/* Militari */}
          <DeptGroup
            title="Militari"
            depts={militaryDepts}
            points={points}
            remaining={remaining}
            onIncrement={increment}
            onDecrement={decrement}
          />
        </div>

        {/* Errore */}
        {error && (
          <div className="mx-5 mb-3 flex items-start gap-2 p-3 rounded-xl bg-red-900/20 border border-red-700/30">
            <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-[10px] font-bold text-red-300">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="p-5 border-t border-gray-800/60 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest text-gray-400 bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || totalAssigned !== MAX_POINTS}
            className="flex-[2] py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20"
          >
            {loading ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle className="w-3.5 h-3.5" />
                Conferma Contributo
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/** Gruppo di dipartimenti (risorse o militari) */
function DeptGroup({
  title, depts, points, remaining, onIncrement, onDecrement,
}: {
  title: string;
  depts: Dept[];
  points: Record<string, number>;
  remaining: number;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest pt-1">{title}</p>
      {depts.map(d => {
        const pts = points[d.id] || 0;
        return (
          <div
            key={d.id}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
              pts > 0
                ? 'bg-indigo-900/20 border-indigo-700/40'
                : 'bg-gray-800/30 border-gray-700/20'
            }`}
          >
            <span className="w-6 text-center text-base">{d.icon}</span>
            <span className="flex-1 text-[11px] font-bold text-gray-200 truncate">{d.label}</span>
            {/* Controlli quantità */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onDecrement(d.id)}
                disabled={pts <= 0}
                className="w-7 h-7 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-30 flex items-center justify-center transition-colors"
              >
                <Minus className="w-3 h-3 text-gray-300" />
              </button>
              <span className={`w-6 text-center tabular-nums text-sm font-black ${pts > 0 ? 'text-indigo-300' : 'text-gray-600'}`}>
                {pts}
              </span>
              <button
                onClick={() => onIncrement(d.id)}
                disabled={remaining <= 0}
                className="w-7 h-7 rounded-lg bg-gray-700 hover:bg-indigo-700 disabled:opacity-30 flex items-center justify-center transition-colors"
              >
                <Plus className="w-3 h-3 text-gray-300" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
