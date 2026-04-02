/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, BarChart3, TrendingUp, Pickaxe, Info, ChevronDown, ChevronUp, Users } from "lucide-react";
import { RESOURCE_LABELS, EXTRACTION_CONFIG } from "../types";
import { ResourceIcon } from "./ResourceIcon";
import type { ResourceType } from "../types";

interface ExtractionDashboardProps {
  user: any;
}

export default function ExtractionDashboard({ user }: ExtractionDashboardProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<any>(null);
  const [playerExperience, setPlayerExperience] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const loadDashboard = async (showLoader = false) => {
    if (!id) return;
    if (showLoader) setLoading(true);
    Promise.all([
      fetch(`/api/extraction/region-dashboard/${id}`, { cache: "no-store" }).then(r => r.ok ? r.json() : null),
      fetch(`/api/extraction/player-experience`, { cache: "no-store" }).then(r => r.ok ? r.json() : null),
      fetch(`/api/extraction/leaderboard?regionId=${id}`, { cache: "no-store" }).then(r => r.ok ? r.json() : null),
    ]).then(([dash, exp, lb]) => {
      if (dash) setDashboard(dash);
      if (exp?.experience) setPlayerExperience(exp.experience);
      else setPlayerExperience([]);
      if (lb?.leaderboard) setLeaderboard(lb.leaderboard);
      else setLeaderboard([]);
    }).catch(() => {})
      .finally(() => {
        if (showLoader) setLoading(false);
      });
  };

  useEffect(() => {
    loadDashboard(true);
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const refresh = () => { loadDashboard(false); };
    const intervalId = window.setInterval(refresh, 30000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [id]);

  if (loading) return (
    <div className="flex justify-center items-center p-20">
      <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
    </div>
  );

  if (!dashboard) return (
    <div className="text-center p-10 text-slate-400 font-bold">
      Dashboard risorse non disponibile per questa regione.
    </div>
  );

  const expMap: Record<string, number> = {};
  for (const e of playerExperience) {
    expMap[e.resourceType] = e.experience || 0;
  }

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-24">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-emerald-600 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Torna alla Regione
      </button>

      {/* Header */}
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-emerald-100">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-3xl flex items-center justify-center bg-emerald-50 shadow-inner border border-emerald-100">
            <ResourceIcon id="minerals" size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Dashboard Risorse</h1>
            <p className="text-xs font-bold text-slate-400 uppercase mt-1">
              {dashboard.regionName} ({dashboard.regionId})
              {dashboard.isAutonomous && <span className="ml-2 text-[9px] font-black text-purple-600 bg-purple-50 px-2 py-0.5 rounded-lg">🏛️ Autonoma</span>}
            </p>
            <p className="text-xs font-bold text-slate-500 mt-1">
              Tassa: {dashboard.taxRate}% • Quota Autonomia: {dashboard.autonomySharePercent}%
            </p>
          </div>
        </div>
      </div>

      {/* Resources Grid */}
      <div className="space-y-3">
        {(dashboard.resources || []).map((r: any) => {
          const rt = r.resourceType as ResourceType;
          const label = RESOURCE_LABELS[rt] || r.resourceType;
          const usagePercent = r.dailyAvailable > 0 ? Math.round((r.dailyExtracted / r.dailyAvailable) * 100) : 0;
          const analytics = dashboard.analytics24h?.[r.resourceType] || {};
          const myExp = expMap[r.resourceType] || 0;

          return (
            <div key={r.resourceType} className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100/50">
                    <ResourceIcon id={rt} size={24} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">{label}</h3>
                    <p className="text-[10px] font-bold text-slate-400">
                      Cap: {r.baseCap}{r.deepBonus > 0 ? ` + ${r.deepBonus} deep` : ''} = {r.effectiveCap}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {r.deepActive && (
                    <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-lg bg-purple-100 text-purple-700">
                      🔬 Deep Attiva
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold text-slate-500">
                  <span>Estratto oggi: {r.dailyExtracted.toLocaleString()}</span>
                  <span>Disponibile: {r.remainingDaily.toLocaleString()} / {r.dailyAvailable.toLocaleString()}</span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${usagePercent > 90 ? 'bg-red-500' : usagePercent > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, usagePercent)}%` }}
                  />
                </div>
                <p className="text-[9px] font-bold text-right text-slate-400">{usagePercent}% consumato</p>
              </div>

              {/* Analytics 24h */}
              {analytics.extractionCount > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  <MiniStat label="Estrazioni 24h" value={analytics.extractionCount} color="blue" />
                  <MiniStat label="Ai Giocatori" value={Math.round(analytics.totalPlayerAmount)} color="emerald" />
                  <MiniStat label="Tasse" value={Math.round(analytics.totalTaxAmount)} color="red" />
                  {analytics.totalStateAmount > 0 && (
                    <MiniStat label="Allo Stato" value={Math.round(analytics.totalStateAmount)} color="purple" />
                  )}
                  {analytics.totalAutonomyAmount > 0 && (
                    <MiniStat label="All'Autonomia" value={Math.round(analytics.totalAutonomyAmount)} color="orange" />
                  )}
                  {analytics.totalMoneyGenerated > 0 && (
                    <MiniStat label="Valuta Generata" value={`€${Math.round(analytics.totalMoneyGenerated)}`} color="amber" />
                  )}
                </div>
              )}

              {/* Player Experience */}
              {myExp > 0 && (
                <div className="bg-indigo-50 px-3 py-2 rounded-xl flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase text-indigo-500">La tua EXP {label}</span>
                  <span className="text-xs font-black text-indigo-700">📊 {myExp}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Department Bonuses */}
      {(dashboard.departmentBonuses || []).length > 0 && (
        <div className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-3">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Bonus Dipartimento Risorse
          </h3>
          <div className="space-y-1">
            {(dashboard.departmentBonuses || []).map((b: any) => (
              <div key={b.resourceType} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl text-[10px] font-bold">
                <div className="flex items-center gap-2">
                  <ResourceIcon id={b.resourceType} size={14} />
                  <span className="text-slate-600">{RESOURCE_LABELS[b.resourceType as ResourceType] || b.resourceType}</span>
                </div>
                <span className="text-emerald-600">+{b.bonusLevel}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Player Experience Summary */}
      {playerExperience.length > 0 && (
        <div className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-indigo-100 space-y-3">
          <h3 className="text-sm font-black uppercase tracking-widest text-indigo-500 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> La Tua Esperienza Lavorativa
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {playerExperience.map((exp: any) => {
              const rt = exp.resourceType as ResourceType;
              return (
                <div key={exp.resourceType} className="bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                      <ResourceIcon id={rt} size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-indigo-700">{RESOURCE_LABELS[rt] || exp.resourceType}</p>
                      <p className="text-xs font-black text-indigo-900">EXP: {exp.experience}</p>
                      <p className="text-[9px] text-indigo-400">Estrazioni: {exp.totalExtractions}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-3">
        <button
          onClick={() => setShowLeaderboard(!showLeaderboard)}
          className="w-full flex items-center justify-between"
        >
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
            <Users className="w-4 h-4" /> Top Estrattori (24h)
          </h3>
          {showLeaderboard ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
        {showLeaderboard && (
          <div className="space-y-1">
            {leaderboard.length === 0 ? (
              <p className="text-[10px] font-bold text-slate-400 text-center py-4">Nessuna estrazione nelle ultime 24h</p>
            ) : leaderboard.map((entry: any, i: number) => (
              <div key={entry.playerId} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl text-[10px] font-bold">
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-white' : i === 2 ? 'bg-orange-400 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {i + 1}
                  </span>
                  <span className="text-indigo-600">{entry.username}</span>
                  <span className="text-slate-400">Lv {entry.level}</span>
                </div>
                <span className="text-emerald-600 font-black">{entry.totalExtracted.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
    purple: 'bg-purple-50 text-purple-700',
    orange: 'bg-orange-50 text-orange-700',
    amber: 'bg-amber-50 text-amber-700',
  };
  return (
    <div className={`p-2 rounded-xl text-center ${colorMap[color] || colorMap.blue}`}>
      <p className="text-[9px] font-bold opacity-70">{label}</p>
      <p className="text-xs font-black">{value}</p>
    </div>
  );
}
