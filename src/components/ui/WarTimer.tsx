import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { getTs, formatRemaining } from "../../utils/time";

export const WarTimer = ({ endsAt }: { endsAt: number | any }) => {
  const ts = getTs(endsAt);
  const [remaining, setRemaining] = useState(() => Math.max(0, ts - Date.now()));

  useEffect(() => {
    const tick = () => {
      const r = Math.max(0, ts - Date.now());
      setRemaining(r);
    };
    if (Math.max(0, ts - Date.now()) <= 0) return;
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [endsAt]);

  return (
    <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 text-white rounded-xl shadow-lg shadow-slate-200">
      <Clock className="w-3 h-3 text-indigo-400" />
      <span className="text-[10px] font-black tabular-nums tracking-wider uppercase">
        {remaining > 0 ? formatRemaining(remaining) : "Terminata"}
      </span>
    </div>
  );
};
