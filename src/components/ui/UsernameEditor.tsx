import React, { useState } from "react";
import { CheckCircle2, Edit2 } from "lucide-react";

export const UsernameEditor = ({ username, fetchData }: { username: string; fetchData: () => void }) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(username);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (value.trim() === username) { setEditing(false); return; }
    setSaving(true); setErr(null);
    try {
      const res = await fetch("/api/profile/username", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: value }),
      });
      const data = await res.json();
      if (data.error) setErr(data.error);
      else { setEditing(false); fetchData(); }
    } catch { setErr("Errore di rete"); }
    finally { setSaving(false); }
  };

  if (editing) return (
    <div className="flex flex-col items-center gap-2 mt-1">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={value}
          onChange={e => { setValue(e.target.value); setErr(null); }}
          onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          className="text-xl font-black text-slate-900 text-center border-b-2 border-indigo-400 bg-transparent outline-none w-40"
          maxLength={20}
        />
        <button onClick={save} disabled={saving} className="w-7 h-7 bg-indigo-600 rounded-xl flex items-center justify-center text-white disabled:opacity-50"><CheckCircle2 className="w-4 h-4" /></button>
        <button onClick={() => { setEditing(false); setValue(username); }} className="w-7 h-7 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500"><span className="text-sm font-black">✕</span></button>
      </div>
      {err && <p className="text-[10px] font-bold text-rose-500">{err}</p>}
    </div>
  );

  return (
    <div className="flex items-center justify-center gap-2 mt-1">
      <h2 className="text-2xl font-black text-slate-900">{username}</h2>
      <button onClick={() => setEditing(true)} className="w-6 h-6 bg-slate-100 hover:bg-indigo-50 rounded-lg flex items-center justify-center transition-colors" title="Cambia nickname">
        <Edit2 className="w-3 h-3 text-slate-400 hover:text-indigo-600" />
      </button>
    </div>
  );
};
