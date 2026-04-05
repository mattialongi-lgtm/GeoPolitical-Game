/**
 * PerksUpgradeCard – Perks improvement section.
 * Shows available perks with current levels, upgrade costs, bonuses,
 * and recommendation badges. Integrates with daily routine suggestions.
 */
import React from 'react';
import { TrendingUp, Coins, Sparkles } from 'lucide-react';
import type { PerkUpgradeEntry } from '../../types';

interface PerksUpgradeCardProps {
  perks: PerkUpgradeEntry[];
  playerMoney: number;
  playerGold: number;
  onUpgrade?: (perkId: string) => void;
}

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  consigliata: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  economica: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  strategica: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  militare: { bg: 'bg-red-500/20', text: 'text-red-400' },
  farming: { bg: 'bg-sky-500/20', text: 'text-sky-400' },
};

export default function PerksUpgradeCard({ perks, playerMoney, playerGold, onUpgrade }: PerksUpgradeCardProps) {
  const upgradablePerks = perks.filter(p => p.canUpgrade);
  const hasUpgradeSuggestion = upgradablePerks.some(p =>
    playerMoney >= p.upgradeCost.money || playerGold >= p.upgradeCost.gold
  );

  return (
    <div id="perks" className="bg-gray-900/80 border border-gray-700/50 rounded-2xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-white uppercase tracking-wider">📈 Perks</h3>
        {hasUpgradeSuggestion && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Upgrade disponibile!
          </span>
        )}
      </div>

      {/* Daily suggestion */}
      {hasUpgradeSuggestion && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <p className="text-[10px] text-amber-300">
            <span className="font-bold">Suggerimento:</span> Puoi migliorare una perk oggi! Investi nella tua crescita.
          </p>
        </div>
      )}

      {/* Perks list */}
      <div className="space-y-3">
        {perks.map((perk) => {
          const canAffordMoney = playerMoney >= perk.upgradeCost.money;
          const canAffordGold = playerGold >= perk.upgradeCost.gold;
          const canAfford = canAffordMoney || canAffordGold;
          const tagStyle = perk.tag ? TAG_COLORS[perk.tag] : null;

          return (
            <div key={perk.perkId} className="p-3 rounded-xl bg-gray-800/50 border border-gray-700/30 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{perk.icon}</span>
                  <div>
                    <p className="text-xs font-bold text-white">{perk.name}</p>
                    <p className="text-[10px] text-gray-500">{perk.bonusDescription}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-white">Lv. {perk.currentLevel}</p>
                  {tagStyle && perk.tag && (
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${tagStyle.bg} ${tagStyle.text} uppercase`}>
                      {perk.tag}
                    </span>
                  )}
                </div>
              </div>

              {/* Progress bar visual */}
              <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                  style={{ width: `${Math.min((perk.currentLevel / 100) * 100, 100)}%` }}
                />
              </div>

              {/* Cost and upgrade */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-[10px] text-gray-500">
                  <span className="flex items-center gap-1">
                    <Coins className="w-3 h-3" />
                    €{perk.upgradeCost.money.toLocaleString()}
                  </span>
                  <span className="text-gray-700">o</span>
                  <span className="flex items-center gap-1">
                    🪙 {perk.upgradeCost.gold}
                  </span>
                </div>
                <button
                  onClick={() => onUpgrade?.(perk.perkId)}
                  disabled={!perk.canUpgrade || !canAfford}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all
                    ${perk.canUpgrade && canAfford
                      ? 'bg-indigo-600 text-white active:scale-[0.95]'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                >
                  <TrendingUp className="w-3 h-3 inline mr-1" />
                  Migliora
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
