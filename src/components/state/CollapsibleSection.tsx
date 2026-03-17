/**
 * CollapsibleSection – Reusable expandable/collapsible section container.
 * Used throughout the State page for organizing information into togglable blocks.
 * Supports custom icons, titles, default open/closed state, and optional badge count.
 */
import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
  children: React.ReactNode;
  emptyMessage?: string;
  isEmpty?: boolean;
}

export default function CollapsibleSection({
  title,
  icon,
  defaultOpen = false,
  badge,
  children,
  emptyMessage,
  isEmpty = false,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          {icon && <span className="text-gray-400">{icon}</span>}
          <span className="text-sm font-bold text-gray-300">{title}</span>
          {badge !== undefined && (
            <span className="px-2 py-0.5 bg-indigo-600/20 text-indigo-400 text-[10px] font-black rounded-full">
              {badge}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>
      {isOpen && (
        <div className="border-t border-gray-800/50">
          {isEmpty && emptyMessage ? (
            <div className="p-4 text-center">
              <p className="text-xs text-gray-500 italic">{emptyMessage}</p>
            </div>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  );
}
