import React from "react";
import { ChevronRight } from "lucide-react";

export const StatRow = ({ label, value, icon: Icon, onClick }: { label: string, value: string | number, icon?: any, onClick?: () => void }) => (
  <button
    onClick={onClick}
    className="w-full bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between hover:border-indigo-200 transition-all group"
  >
    <div className="flex items-center gap-3">
      {Icon && <Icon className="w-5 h-5 text-indigo-500" />}
      <span className="font-bold text-slate-700">{label}</span>
    </div>
    <div className="flex items-center gap-2">
      <span className="font-black text-slate-900">{value}</span>
      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
    </div>
  </button>
);
