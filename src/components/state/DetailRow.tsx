/**
 * DetailRow – A single label + value row for displaying state information.
 * Left-aligned label, right-aligned value with proper wrapping for long content.
 * Supports optional highlighting and unit suffixes.
 */
import React from 'react';

interface DetailRowProps {
  label: string;
  value: string | number;
  highlight?: boolean;
  unit?: string;
}

export default function DetailRow({ label, value, highlight = false, unit }: DetailRowProps) {
  const formattedValue = typeof value === 'number' ? value.toLocaleString('it-IT') : value;

  return (
    <div className="flex items-start justify-between gap-4 py-2.5 px-4 border-b border-gray-800/40 last:border-b-0">
      <span className="text-xs text-gray-400 font-semibold shrink-0">{label}</span>
      <span
        className={`text-xs font-bold text-right ${
          highlight ? 'text-indigo-400' : 'text-gray-200'
        }`}
      >
        {formattedValue}
        {unit && <span className="text-gray-500 ml-1">{unit}</span>}
      </span>
    </div>
  );
}
