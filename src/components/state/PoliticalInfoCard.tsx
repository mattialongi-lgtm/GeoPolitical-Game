/**
 * PoliticalInfoCard – Political information card showing government form, leaders, and ministers.
 * Each row has an avatar/icon, name, role subtitle, and optional salary highlight.
 */
import React from 'react';
import { Crown, Shield, Briefcase, Globe2, Users } from 'lucide-react';

interface PoliticalFigure {
  name: string;
  role: string;
  avatar?: string;
  salaryGold?: number;
}

interface PoliticalInfoCardProps {
  governmentForm: string;
  headOfState?: PoliticalFigure;
  economyMinister?: PoliticalFigure;
  foreignMinister?: PoliticalFigure;
  geopoliticalBloc?: string;
}

const PoliticalRow = ({
  icon: Icon,
  iconColor,
  figure,
  fallbackLabel,
}: {
  icon: React.ElementType;
  iconColor: string;
  figure?: PoliticalFigure;
  fallbackLabel: string;
}) => (
  <div className="flex items-center gap-3 py-2.5 border-b border-gray-800/40 last:border-b-0">
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconColor}`}>
      {figure?.avatar ? (
        <img src={figure.avatar} alt={figure.name} className="w-full h-full rounded-xl object-cover" />
      ) : (
        <Icon className="w-4 h-4 text-white" />
      )}
    </div>
    <div className="flex-1 min-w-0">
      {figure ? (
        <>
          <p className="text-sm font-bold text-white truncate">{figure.name}</p>
          <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">{figure.role}</p>
        </>
      ) : (
        <p className="text-xs text-gray-500 italic">{fallbackLabel}</p>
      )}
    </div>
    {figure?.salaryGold !== undefined && (
      <span className="text-xs font-bold text-amber-400 tabular-nums whitespace-nowrap">
        🪙 {figure.salaryGold.toLocaleString('it-IT')} /g
      </span>
    )}
  </div>
);

export default function PoliticalInfoCard({
  governmentForm,
  headOfState,
  economyMinister,
  foreignMinister,
  geopoliticalBloc,
}: PoliticalInfoCardProps) {
  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 space-y-1">
      {/* Government Form Header */}
      <div className="flex items-center gap-2 pb-2 border-b border-gray-700/50 mb-1">
        <Shield className="w-4 h-4 text-indigo-400" />
        <span className="text-xs font-black text-indigo-400 uppercase tracking-wider">
          {governmentForm}
        </span>
      </div>

      {/* Head of State */}
      <PoliticalRow
        icon={Crown}
        iconColor="bg-amber-600"
        figure={headOfState}
        fallbackLabel="Nessun Capo di Stato"
      />

      {/* Economy Minister */}
      <PoliticalRow
        icon={Briefcase}
        iconColor="bg-emerald-600"
        figure={economyMinister}
        fallbackLabel="Nessun Ministro dell'Economia"
      />

      {/* Foreign Minister */}
      <PoliticalRow
        icon={Globe2}
        iconColor="bg-sky-600"
        figure={foreignMinister}
        fallbackLabel="Nessun Ministro degli Esteri"
      />

      {/* Geopolitical Bloc */}
      {geopoliticalBloc && (
        <div className="flex items-center gap-3 pt-2 border-t border-gray-700/50 mt-1">
          <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center">
            <Users className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-white">{geopoliticalBloc}</p>
            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Blocco Geopolitico</p>
          </div>
        </div>
      )}
    </div>
  );
}
