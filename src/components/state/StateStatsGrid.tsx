import React from 'react';
import { Users, UserCheck, Flag, Factory } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface StateStatsGridProps {
  nationId: string;
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
  onClick,
}: {
  icon: React.ElementType;
  value: number;
  label: string;
  color: string;
  accent: string;
  onClick: () => void;
}) => (
  <button 
    onClick={onClick}
    className="flex flex-col items-center gap-1 p-3 rounded-xl bg-gray-800/50 border border-gray-700/40 hover:border-indigo-500/50 hover:bg-gray-800/80 transition-all flex-1 min-w-0 group"
  >
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 ${color}`}>
      <Icon className="w-4 h-4 text-white" />
    </div>
    <span className={`text-lg font-black ${accent} tabular-nums`}>
      {value.toLocaleString('it-IT')}
    </span>
    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider text-center group-hover:text-gray-300">
      {label}
    </span>
  </button>
);

export default function StateStatsGrid({ nationId, citizens, residents, parties, factories }: StateStatsGridProps) {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-4 gap-2">
      <StatBox 
        icon={Users} 
        value={citizens} 
        label="Cittadini" 
        color="bg-sky-600" 
        accent="text-sky-400" 
        onClick={() => navigate(`/players?search=${nationId}`)} 
      />
      <StatBox 
        icon={UserCheck} 
        value={residents} 
        label="Residenti" 
        color="bg-emerald-600" 
        accent="text-emerald-400" 
        onClick={() => navigate(`/players?search=${nationId}`)} 
      />
      <StatBox 
        icon={Flag} 
        value={parties} 
        label="Partiti" 
        color="bg-purple-600" 
        accent="text-purple-400" 
        onClick={() => navigate(`/parties?search=${nationId}`)} 
      />
      <StatBox 
        icon={Factory} 
        value={factories} 
        label="Fabbriche" 
        color="bg-amber-600" 
        accent="text-amber-400" 
        onClick={() => navigate(`/world-factories?search=${nationId}`)} 
      />
    </div>
  );
}
