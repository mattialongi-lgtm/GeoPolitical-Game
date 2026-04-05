import { useState, useCallback, useEffect } from "react";
import type { User } from "../types";

export function useAppActions(
  fetchData: () => void,
  user: User | null,
  setUser: React.Dispatch<React.SetStateAction<User | null>>
) {
  const [actionLoading, setActionLoading] = useState(false);

  // Work experience transfer states
  const [workExpTransferSource, setWorkExpTransferSource] = useState<string>('oil');
  const [workExpTransferTarget, setWorkExpTransferTarget] = useState<string>('minerals');
  const [workExpTransferXp, setWorkExpTransferXp] = useState<number>(0);
  const [workExpTransferBusy, setWorkExpTransferBusy] = useState(false);
  const [workExpTransferError, setWorkExpTransferError] = useState<string | null>(null);
  const [workExpTransferOk, setWorkExpTransferOk] = useState<string | null>(null);

  // Auto-work state
  const [autoWorkFactoryId, setAutoWorkFactoryIdState] = useState<string | null>(null);
  const [autoWorkExpiresAt, setAutoWorkExpiresAt] = useState<string | null>(null);

  const refreshAutoWorkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/automation/work");
      const data = await res.json();
      setAutoWorkFactoryIdState(data.autoWork?.factoryId || null);
      setAutoWorkExpiresAt(data.autoWork?.expiresAt || null);
    } catch {
      setAutoWorkFactoryIdState(null);
      setAutoWorkExpiresAt(null);
    }
  }, []);

  const setAutoWorkFactoryId = useCallback(async (factoryId: string | null) => {
    try {
      if (factoryId) {
        const warRes = await fetch("/api/automation/war-attacks");
        const warData = await warRes.json();
        const hasIncompatibleAutoAttack = (warData.autoAttacks || []).some((entry: any) => entry?.autoType !== 'hourly');
        if (hasIncompatibleAutoAttack) {
          alert("Auto-Work è compatibile solo con il Danno Orario, non con l'Auto-War standard.");
          return;
        }
      }

      const res = await fetch("/api/automation/work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(factoryId ? { factoryId } : { enabled: false }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      }
    } finally {
      await refreshAutoWorkStatus();
      fetchData();
    }
  }, [fetchData, refreshAutoWorkStatus]);

  // Auto-work polling
  useEffect(() => {
    if (!user) return;
    refreshAutoWorkStatus();
    const iv = setInterval(refreshAutoWorkStatus, 30000);
    return () => clearInterval(iv);
  }, [user, refreshAutoWorkStatus]);

  const handleUseDrink = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/actions/use-drink", { method: "POST" });
      const data = await res.json();
      if (data.error) alert(data.error);
      else fetchData();
    } catch { alert("Errore nell'uso del drink"); }
    finally { setActionLoading(false); }
  };

  const handleAction = async (action: string, body: any = {}) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/actions/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else fetchData();
    } catch (err) {
      alert("Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpgradePerk = async (perkId: string, useGold: boolean = false) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/perks/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perkId, useGold }),
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else {
        // Optimistic update — show the timer immediately
        if (data.queued && user) {
          setUser({
            ...user,
            perkUpgrades: {
              ...(user.perkUpgrades || {}),
              [perkId]: {
                startedAt: Date.now(),
                willCompleteAt: data.willCompleteAt,
                targetLevel: (user.perks?.[perkId] || 0) + 1
              }
            }
          });
        }
        fetchData();
      }
    } catch (err) {
      alert("Upgrade failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivateBooster = async (perkId: string, useGold: boolean) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/perks/booster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perkId, useGold }),
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else {
        fetchData();
      }
    } catch (err) {
      alert("Booster activation failed");
    } finally {
      setActionLoading(false);
    }
  };

  return {
    actionLoading,
    autoWorkFactoryId,
    setAutoWorkFactoryId,
    autoWorkExpiresAt,
    workExpTransferSource, setWorkExpTransferSource,
    workExpTransferTarget, setWorkExpTransferTarget,
    workExpTransferXp, setWorkExpTransferXp,
    workExpTransferBusy, setWorkExpTransferBusy,
    workExpTransferError, setWorkExpTransferError,
    workExpTransferOk, setWorkExpTransferOk,
    refreshAutoWorkStatus,
    handleUseDrink,
    handleAction,
    handleUpgradePerk,
    handleActivateBooster,
  };
}
