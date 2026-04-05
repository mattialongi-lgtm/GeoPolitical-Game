import React from "react";

export const StatCard = ({ icon: Icon, label, value, color, subValue }: { icon: any, label: string, value: string | number, color: string, subValue?: string }) => (
  <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-4">
    <div className={`p-3 rounded-2xl ${color} shadow-lg shadow-current/10`}>
      <Icon className="w-5 h-5 text-white" />
    </div>
    <div>
      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{label}</p>
      <p className="text-xl font-black text-slate-900 leading-none mt-1">{value}</p>
      {subValue && <p className="text-[10px] font-bold text-slate-400 mt-1">{subValue}</p>}
    </div>
  </div>
);
