import React from "react";
import { Landmark } from "lucide-react";

export const ParliamentTab = ({ members }: { members: any[] }) => {
  const parties = members.reduce((acc: any, m: any) => {
    if (!acc[m.partyName]) acc[m.partyName] = { count: 0, tag: m.partyTag, members: [] };
    acc[m.partyName].count++;
    acc[m.partyName].members.push(m);
    return acc;
  }, {});

  const total = members.length;

  return (
    <div className="space-y-6">
      {total === 0 ? (
        <div className="bg-white p-12 rounded-[2.5rem] border border-slate-100 text-center shadow-sm">
          <Landmark className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-black text-slate-900">Parlamento Vuoto</h3>
          <p className="text-slate-500 font-bold mt-2">Nessun membro eletto ancora.</p>
        </div>
      ) : (
        <>
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <h3 className="text-xl font-black text-slate-900 mb-6">Composizione Parlamentare ({total} Seggi)</h3>
            <div className="flex h-6 rounded-full overflow-hidden gap-0.5">
              {Object.entries(parties).map(([name, data]: any, i) => {
                const colors = ['bg-indigo-500', 'bg-rose-500', 'bg-emerald-500', 'bg-amber-500', 'bg-cyan-500', 'bg-purple-500'];
                return (
                  <div key={name} className={`${colors[i % colors.length]} h-full transition-all`} style={{ width: `${(data.count / total) * 100}%` }} title={`${name}: ${data.count} seggi`} />
                );
              })}
            </div>
            <div className="flex flex-wrap gap-4 mt-4">
              {Object.entries(parties).map(([name, data]: any, i) => {
                const colorsText = ['text-indigo-500', 'text-rose-500', 'text-emerald-500', 'text-amber-500', 'text-cyan-500', 'text-purple-500'];
                return (
                  <div key={name} className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${colorsText[i % colorsText.length].replace('text-', 'bg-')}`} />
                    <span className="text-xs font-bold text-slate-700">{data.tag || name} ({data.count})</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-xl font-black text-slate-900">Membri Eletti</h3>
            <div className="grid gap-3">
              {members.map(m => (
                <div key={m.userId} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-black">{m.username.charAt(0).toUpperCase()}</div>
                    <div>
                      <p className="font-black text-slate-900 text-sm">{m.username} <span className="text-[10px] font-bold text-slate-400 ml-1">Lv {m.level}</span></p>
                      <p className="text-[10px] font-bold text-indigo-500 uppercase mt-0.5">{m.partyName}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
