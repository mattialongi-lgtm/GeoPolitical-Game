/**
 * StateStatsGrid – Dashboard-style grid showing 4 key state statistics.
 * Citizens, Residents, Parties, Factories with large numbers and icons.
 */
import React from 'react';
import { Users, UserCheck, Flag, Factory } from 'lucide-react';

interface StateStatsGridProps {
  citizens: number;
  residents: number;
  parties: number;
  factories: number;
}

const StatBox = ({
  icon: Icon,
  value,
  label,
  color,
  accent,
}: {
  icon: React.ElementType;
  value: number;
  label: string;
  color: string;
  accent: string;
}) => (
  <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-gray-800/50 border border-gray-700/40 flex-1 min-w-0">
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
      <Icon className="w-4 h-4 text-white" />
    </div>
    <span className={`text-lg font-black ${accent} tabular-nums`}>
      {value.toLocaleString('it-IT')}
    </span>
    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider text-center">
      {label}
    </span>
  </div>
);

export default function StateStatsGrid({ citizens, residents, parties, factories }: StateStatsGridProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      <StatBox icon={Users} value={citizens} label="Cittadini" color="bg-sky-600" accent="text-sky-400" />
      <StatBox icon={UserCheck} value={residents} label="Residenti" color="bg-emerald-600" accent="text-emerald-400" />
      <StatBox icon={Flag} value={parties} label="Partiti" color="bg-purple-600" accent="text-purple-400" />
      <StatBox icon={Factory} value={factories} label="Fabbriche" color="bg-amber-600" accent="text-amber-400" />
    </div>
  );
}
