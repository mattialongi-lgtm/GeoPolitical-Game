import React from 'react';
import { RESOURCE_ICONS_MAP } from '../types';

type ResourceId = 
  | 'oil' | 'minerals' | 'uranium' | 'diamonds' | 'gold_ore' 
  | 'energy'
  | 'food' | 'steel' | 'gas'
  | 'money' | 'gold_currency'
  | string;

interface ResourceIconProps {
  id: ResourceId;
  size?: number;
  className?: string;
  color?: string;
}

// Fallback emoji mapping for items not in RESOURCE_ICONS_MAP (e.g. weapons)
const ITEM_EMOJIS: Record<string, string> = {
  tank: "🛡️",
  missile: "🚀",
  aircraft: "✈️",
  bomber: "🛩️",
  battleship: "🚢",
  money: "💵",
  gold_currency: "🪙",
};

/**
 * ResourceIcon - Renders a simple, clean icon for game resources using system emojis.
 * Aligns with the "barra magazzino" style as requested by the user.
 */
export const ResourceIcon: React.FC<ResourceIconProps> = ({ id, size = 24, className = "" }) => {
  const normalizedId = id.toLowerCase();
  
  // Try RESOURCE_ICONS_MAP first, then ITEM_EMOJIS, then default package
  const emoji = RESOURCE_ICONS_MAP[normalizedId] || ITEM_EMOJIS[normalizedId] || "📦";

  return (
    <div 
      style={{ fontSize: `${size * 0.8}px`, width: size, height: size }}
      className={`flex items-center justify-center select-none ${className}`}
      title={id}
    >
      {emoji}
    </div>
  );
};
