import React, { useState, useEffect } from "react";
import { getTs, formatRemaining } from "../../utils/time";

export const PerkTimer = ({ willCompleteAt, onComplete }: { willCompleteAt: number | any; onComplete?: () => void }) => {
  const ts = getTs(willCompleteAt);
  const [remaining, setRemaining] = useState(() => Math.max(0, ts - Date.now()));

  useEffect(() => {
    const tick = () => {
      const r = Math.max(0, getTs(willCompleteAt) - Date.now());
      setRemaining(r);
      if (r === 0) { onComplete?.(); }
    };
    if (Math.max(0, getTs(willCompleteAt) - Date.now()) <= 0) { onComplete?.(); return; }
    const iv = setInterval(tick, 500);
    return () => clearInterval(iv);
  }, [willCompleteAt]);

  return <span className="text-amber-600 font-black text-xs tabular-nums">{formatRemaining(remaining)}</span>;
};
