/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Crown, Gem, Zap, Shield, Star, TrendingUp, Clock, ChevronRight } from "lucide-react";

interface ShopPageProps {
  user: any;
}

const COMING_SOON_MSG = "Il sistema di pagamento sarà disponibile a breve. Resta sintonizzato!";

const GOLD_PACKAGES = [
  { id: "gold_100", amount: 100, price: "€1,99", highlight: false, bonus: "" },
  { id: "gold_500", amount: 500, price: "€7,99", highlight: false, bonus: "+50 bonus" },
  { id: "gold_1200", amount: 1200, price: "€14,99", highlight: true, bonus: "+200 bonus" },
  { id: "gold_3000", amount: 3000, price: "€29,99", highlight: false, bonus: "+600 bonus" },
  { id: "gold_6500", amount: 6500, price: "€54,99", highlight: false, bonus: "+1500 bonus" },
];

const PREMIUM_BENEFITS = [
  { icon: <Zap className="w-4 h-4" />, text: "+50% energia massima" },
  { icon: <TrendingUp className="w-4 h-4" />, text: "+50% XP da ogni azione" },
  { icon: <Shield className="w-4 h-4" />, text: "+50% cap danni in guerra" },
  { icon: <Clock className="w-4 h-4" />, text: "Cooldown lavoro ridotto del 25%" },
  { icon: <Star className="w-4 h-4" />, text: "Badge Premium esclusivo" },
  { icon: <Gem className="w-4 h-4" />, text: "100 Gold bonus al mese" },
];

export default function ShopPage({ user }: ShopPageProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"premium" | "gold">("premium");

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-24">
      {/* Back button */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Indietro
      </button>

      {/* Header */}
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-amber-600 rounded-3xl flex items-center justify-center shadow-lg shadow-amber-100">
            <Crown className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Negozio</h1>
            <p className="text-xs font-bold text-slate-400">Potenzia il tuo account e domina il gioco</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("premium")}
          className={`flex-1 py-3 font-black uppercase tracking-wider text-xs rounded-2xl transition-all flex items-center justify-center gap-2 ${
            activeTab === "premium"
              ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-100"
              : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-100"
          }`}
        >
          <Crown className="w-4 h-4" /> Premium
        </button>
        <button
          onClick={() => setActiveTab("gold")}
          className={`flex-1 py-3 font-black uppercase tracking-wider text-xs rounded-2xl transition-all flex items-center justify-center gap-2 ${
            activeTab === "gold"
              ? "bg-gradient-to-r from-yellow-400 to-yellow-500 text-white shadow-lg shadow-yellow-100"
              : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-100"
          }`}
        >
          <Gem className="w-4 h-4" /> Compra Gold
        </button>
      </div>

      {/* Premium Tab */}
      {activeTab === "premium" && (
        <div className="space-y-4">
          {/* Premium Card */}
          <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 p-6 rounded-[2.5rem] border-2 border-amber-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-200/20 rounded-full -mr-10 -mt-10" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center shadow-md">
                  <Crown className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-amber-900 uppercase tracking-tight">Account Premium</h2>
                  <p className="text-xs font-bold text-amber-600">Vantaggi esclusivi per i veri leader</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {PREMIUM_BENEFITS.map((benefit, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 bg-white/60 rounded-xl">
                    <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
                      {benefit.icon}
                    </div>
                    <span className="text-sm font-bold text-amber-900">{benefit.text}</span>
                  </div>
                ))}
              </div>

              {/* Price Options */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-white p-4 rounded-2xl border border-amber-200 text-center">
                  <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Mensile</p>
                  <p className="text-2xl font-black text-amber-900">€4,99</p>
                  <p className="text-[10px] font-bold text-amber-400">/mese</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border-2 border-amber-400 text-center relative">
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase">Risparmia 40%</div>
                  <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Annuale</p>
                  <p className="text-2xl font-black text-amber-900">€2,99</p>
                  <p className="text-[10px] font-bold text-amber-400">/mese</p>
                </div>
              </div>

              <button
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-2xl font-black uppercase tracking-wider text-sm shadow-lg shadow-amber-200 hover:shadow-xl hover:from-amber-600 hover:to-amber-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                onClick={() => alert(COMING_SOON_MSG)}
              >
                <Crown className="w-5 h-5" /> Diventa Premium
                <ChevronRight className="w-4 h-4" />
              </button>
              <p className="text-center text-[9px] font-bold text-amber-400 mt-2">Pagamento sicuro • Cancella quando vuoi</p>
            </div>
          </div>
        </div>
      )}

      {/* Gold Tab */}
      {activeTab === "gold" && (
        <div className="space-y-4">
          {/* Current Gold Balance */}
          <div className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center">
                <span className="text-xl">🪙</span>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Il tuo Gold</p>
                <p className="text-xl font-black text-slate-900">{(user?.gold || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Gold Description */}
          <div className="bg-yellow-50/50 p-4 rounded-2xl border border-yellow-100">
            <p className="text-xs font-bold text-yellow-800">
              Il Gold è la valuta premium del gioco. Usalo per potenziare i perk più velocemente, acquistare energy drink e sbloccare vantaggi esclusivi.
            </p>
          </div>

          {/* Gold Packages */}
          <div className="space-y-3">
            {GOLD_PACKAGES.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => alert(COMING_SOON_MSG)}
                className={`w-full p-4 rounded-2xl border-2 transition-all active:scale-[0.98] flex items-center justify-between ${
                  pkg.highlight
                    ? "bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-400 shadow-lg shadow-yellow-100"
                    : "bg-white border-slate-100 hover:border-yellow-200 hover:shadow-md"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    pkg.highlight ? "bg-gradient-to-br from-yellow-400 to-amber-500" : "bg-yellow-50"
                  }`}>
                    <span className={`text-lg font-black ${pkg.highlight ? "text-white" : "text-yellow-600"}`}>🪙</span>
                  </div>
                  <div className="text-left">
                    <p className="font-black text-slate-900">{pkg.amount.toLocaleString()} Gold</p>
                    {pkg.bonus && (
                      <p className="text-[10px] font-black text-emerald-500 uppercase">{pkg.bonus}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-black text-lg ${pkg.highlight ? "text-amber-600" : "text-slate-700"}`}>{pkg.price}</p>
                </div>
              </button>
            ))}
          </div>

          <p className="text-center text-[9px] font-bold text-slate-400 mt-2">I prezzi includono IVA dove applicabile</p>
        </div>
      )}
    </div>
  );
}
