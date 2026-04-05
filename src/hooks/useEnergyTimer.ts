import { useState, useEffect } from "react";
import type { User } from "../types";

export function useEnergyTimer(user: User | null) {
  const [energyTimer, setEnergyTimer] = useState("");

  useEffect(() => {
    if (!user) return;
    const updateTimer = () => {
      // Max energy is now 300
      const maxE = 300;
      if (user.energy >= maxE) {
        setEnergyTimer("MAX");
        return;
      }
      const now = Date.now();
      const passed = now - user.lastEnergyUpdate;
      // 10 minutes ticks
      const TICK_MS = 10 * 60 * 1000;
      const msToNext = TICK_MS - (passed % TICK_MS);
      const m = Math.floor(msToNext / 60000);
      const s = Math.floor((msToNext % 60000) / 1000);
      setEnergyTimer(`${m}:${s.toString().padStart(2, '0')}`);
    };
    updateTimer();
    const iv = setInterval(updateTimer, 1000);
    return () => clearInterval(iv);
  }, [user]);

  return energyTimer;
}
