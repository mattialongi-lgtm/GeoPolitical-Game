import React, { useState, useEffect } from "react";
import { getTs } from "../../utils/time";

export const PerkProgressBar = ({ startedAt, willCompleteAt }: { startedAt: number | any; willCompleteAt: number | any }) => {
  const start = getTs(startedAt);
  const end = getTs(willCompleteAt);
  const [pct, setPct] = useState(() => {
    if (end === start) return 0;
    return Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100));
  });

  useEffect(() => {
    const iv = setInterval(() => {
      const s = getTs(startedAt);
      const e = getTs(willCompleteAt);
      if (e === s) setPct(100);
      else setPct(Math.min(100, Math.max(0, ((Date.now() - s) / (e - s)) * 100)));
    }, 500);
    return () => clearInterval(iv);
  }, [startedAt, willCompleteAt]);

  return (
    <div className="bg-amber-400 h-full rounded-full transition-none" style={{ width: `${pct}%` }} />
  );
};
