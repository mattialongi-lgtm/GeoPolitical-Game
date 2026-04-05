/**
 * DepartmentsSection — Sezione Dipartimenti nella pagina Stato
 *
 * Mostra i punteggi dipartimento dello Stato con rank globale e bonus.
 * Permette ai player idonei di distribuire i 10 punti giornalieri.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { BarChart2, Star, Zap, Lock, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import WorkDepartmentModal from './WorkDepartmentModal';

interface DepartmentEntry {
  id: string;
  label: string;
  icon: string;
  category: 'resource' | 'military';
  score: number;
  rank: number;
  bonusMultiplier: number;
}

interface AllDept {
  id: string;
  label: string;
  icon: string;
  category: 'resource' | 'military';
}

interface DepartmentsData {
  nationId: string;
  departments: DepartmentEntry[];
  canContributeToday: boolean;
  todayContribution: Record<string, number> | null;
  allDepartments: AllDept[];
}

interface Props {
  nationId: string;
  user?: any;
}

function getRankColor(rank: number): string {
  if (rank === 1) return 'text-amber-400';
  if (rank === 2) return 'text-slate-300';
  if (rank === 3) return 'text-amber-600';
  return 'text-gray-500';
}

function getRankLabel(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

export default function DepartmentsSection({ nationId, user }: Props) {
  const [data, setData] = useState<DepartmentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/state/${nationId}/departments`);
      if (res.ok) setData(await res.json());
    } catch { /* non-critical */ } finally {
      setLoading(false);
    }
  }, [nationId]);

  useEffect(() => { load(); }, [load]);

  // Dipartimenti delle due categorie separati
  const resourceDepts = data?.departments.filter(d => d.category === 'resource') || [];
  const militaryDepts = data?.departments.filter(d => d.category === 'military') || [];

  return (
    <div id="departments-section" className="rounded-2xl border border-gray-800 bg-gray-900/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-indigo-400" />
          <span className="text-[11px] font-black text-white uppercase tracking-widest">Dipartimenti</span>
        </div>
        {/* Pulsante lavora oggi */}
        {user && (
          <button
            onClick={() => setShowModal(true)}
            disabled={loading || data?.canContributeToday === false}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              data?.canContributeToday
                ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-900/30'
                : data?.todayContribution
                ? 'bg-emerald-900/30 border border-emerald-700/40 text-emerald-400 cursor-default'
                : 'bg-gray-800 text-gray-500 cursor-default'
            }`}
          >
            {data?.todayContribution ? (
              <>
                <CheckCircle className="w-3 h-3" />
                Contribuito
              </>
            ) : data?.canContributeToday ? (
              <>
                <Zap className="w-3 h-3" />
                Lavora oggi
              </>
            ) : (
              <>
                <Lock className="w-3 h-3" />
                Non idoneo
              </>
            )}
          </button>
        )}
      </div>

      {/* Corpo */}
      <div className="p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !data || data.departments.length === 0 ? (
          <div className="text-center py-6 space-y-2">
            <BarChart2 className="w-8 h-8 text-gray-700 mx-auto" />
            <p className="text-[11px] text-gray-500 font-semibold">Nessun punteggio ancora accumulato.</p>
            <p className="text-[10px] text-gray-600">I residenti con Istruzione ≥ 100 possono contribuire ogni giorno.</p>
          </div>
        ) : (
          <>
            {/* Dipartimenti Risorse */}
            {resourceDepts.length > 0 && (
              <div className="space-y-2">
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Risorse</p>
                <div className="space-y-1.5">
                  {resourceDepts.map(dept => (
                    <DeptRow key={dept.id} dept={dept} />
                  ))}
                </div>
              </div>
            )}

            {/* Dipartimenti Militari */}
            {militaryDepts.length > 0 && (
              <div className="space-y-2">
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Militari</p>
                <div className="space-y-1.5">
                  {militaryDepts.map(dept => (
                    <DeptRow key={dept.id} dept={dept} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Contributo di oggi (se già fatto) */}
        {data?.todayContribution && (
          <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-xl p-3">
            <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-2">Il tuo contributo di oggi</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(data.todayContribution).map(([dept, pts]) => (
                <span key={dept} className="px-2 py-1 bg-emerald-900/40 rounded-lg text-[10px] font-bold text-emerald-300">
                  +{pts} {dept}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal distribuzione punti */}
      <AnimatePresence>
        {showModal && data && (
          <WorkDepartmentModal
            nationId={nationId}
            allDepartments={data.allDepartments}
            onClose={() => setShowModal(false)}
            onSuccess={() => {
              setShowModal(false);
              load(); // ricarica per aggiornare canContributeToday e scores
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** Singola riga dipartimento con rank badge e barra score */
function DeptRow({ dept }: { dept: DepartmentEntry }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 p-2 rounded-xl bg-gray-800/40 border border-gray-700/30"
    >
      <span className="text-lg w-7 shrink-0 text-center">{dept.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-white truncate">{dept.label}</span>
          <span className={`text-[10px] font-black shrink-0 ${getRankColor(dept.rank)}`}>
            {getRankLabel(dept.rank)}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1 bg-gray-700/60 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-500/80 transition-all"
              style={{ width: `${Math.min(100, (dept.score / Math.max(dept.score, 100)) * 100)}%` }}
            />
          </div>
          <span className="text-[9px] text-gray-400 font-bold shrink-0">
            {dept.score.toLocaleString('it-IT')} pt
          </span>
        </div>
      </div>
      {/* Badge bonus preparato */}
      {dept.bonusMultiplier > 0 && (
        <div className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-900/30 border border-amber-700/30">
          <Star className="w-2.5 h-2.5 text-amber-400" />
          <span className="text-[8px] font-black text-amber-400">+{Math.round(dept.bonusMultiplier * 100)}%</span>
        </div>
      )}
    </motion.div>
  );
}
