import React, { useState, useEffect } from "react";
import { getTs, formatRemaining } from "../../utils/time";

export const TravelTimer = ({ endsAt, onComplete }: { endsAt: number | any; onComplete?: () => void }) => {
  const ts = getTs(endsAt);
  const [remaining, setRemaining] = useState(() => Math.max(0, ts - Date.now()));

  useEffect(() => {
    const tick = () => {
      const r = Math.max(0, getTs(endsAt) - Date.now());
      setRemaining(r);
      if (r === 0) { onComplete?.(); }
    };
    if (Math.max(0, getTs(endsAt) - Date.now()) <= 0) { onComplete?.(); return; }
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [endsAt]);

  return <span className="tabular-nums">{remaining > 0 ? formatRemaining(remaining) : "Arrivato!"}</span>;
};
