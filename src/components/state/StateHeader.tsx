/**
 * StateHeader – Top header bar for the State page.
 * Shows back arrow, state name centered, region count subtitle, and help icon.
 */
import React from 'react';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface StateHeaderProps {
  name: string;
  regionCount: number;
  onHelpClick?: () => void;
}

export default function StateHeader({ name, regionCount, onHelpClick }: StateHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between px-1 py-2">
      <button
        onClick={() => navigate(-1)}
        className="p-2 rounded-xl bg-gray-800 text-gray-200 border border-gray-700 hover:border-indigo-500/50 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
      <div className="text-center flex-1">
        <h1 className="text-xl font-black text-white uppercase tracking-wide">{name}</h1>
        <p className="text-[11px] text-gray-500 font-semibold">
          Stato, regioni: {regionCount}
        </p>
      </div>
      <button
        onClick={onHelpClick}
        className="p-2 rounded-xl bg-gray-800 text-gray-200 border border-gray-700 hover:border-indigo-500/50 transition-colors"
      >
        <HelpCircle className="w-5 h-5" />
      </button>
    </div>
  );
}
