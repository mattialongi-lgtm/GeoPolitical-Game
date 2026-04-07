import { useState, useCallback, useEffect } from "react";
import type { User } from "../types";

export function useAppActions(
  fetchData: () => void,
  user: User | null,
  setUser: React.Dispatch<React.SetStateAction<User | null>>
) {
  const [actionLoading, setActionLoading] = useState(false);

  const [workExpTransferSource, setWorkExpTransferSource] = useState<string>('oil');
  const [workExpTransferTarget, setWorkExpTransferTarget] = useState<string>('minerals');
  const [workExpTransferXp, setWorkExpTransferXp] = useState<number>(0);
  const [workExpTransferBusy, setWorkExpTransferBusy] = useState(false);
  const [workExpTransferError, setWorkExpTransferError] = useState<string | null>(null);
  const [workExpTransferOk, setWorkExpTransferOk] = useState<string | null>(null);

  const [autoWorkFactoryId, setAutoWorkFactoryIdState] = useState<string | null>(null);
  const [autoWorkResourceType, setAutoWorkResourceType] = useState<string | null>(null);
  const [autoWorkRegionId, setAutoWorkRegionId] = useState<string | null>(null);
  const [autoWorkExpiresAt, setAutoWorkExpiresAt] = useState<string | null>(null);

  const refreshAutoWorkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/automation/work");
      const data = await res.json();
      setAutoWorkFactoryIdState(data.autoWork?.factoryId || null);
      setAutoWorkResourceType(data.autoWork?.resourceType || null);
      setAutoWorkRegionId(data.autoWork?.regionId || null);
      setAutoWorkExpiresAt(data.autoWork?.expiresAt || null);
    } catch {
      setAutoWorkFactoryIdState(null);
      setAutoWorkResourceType(null);
      setAutoWorkRegionId(null);
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
          alert("Auto-Work e compatibile solo con il Danno Orario, non con l'Auto-War standard.");
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
        throw new Error(data.error);
      }
    } finally {
      await refreshAutoWorkStatus();
      fetchData();
    }
  }, [fetchData, refreshAutoWorkStatus]);

  const setAutoWorkResource = useCallback(async (resourceType: string | null, regionId?: string | null) => {
    try {
      if (resourceType) {
        const warRes = await fetch("/api/automation/war-attacks");
        const warData = await warRes.json();
        const hasIncompatibleAutoAttack = (warData.autoAttacks || []).some((entry: any) => entry?.autoType !== 'hourly');
        if (hasIncompatibleAutoAttack) {
          const message = "Auto-Work e compatibile solo con il Danno Orario, non con l'Auto-War standard.";
          alert(message);
          throw new Error(message);
        }
      }

      const res = await fetch("/api/automation/work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resourceType ? { resourceType, regionId } : { enabled: false }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        throw new Error(data.error);
      }
    } finally {
      await refreshAutoWorkStatus();
      fetchData();
    }
  }, [fetchData, refreshAutoWorkStatus]);

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
    } catch {
      alert("Errore nell'uso del drink");
    } finally {
      setActionLoading(false);
    }
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
      else {
        const isTravelMutation = action === "travel" || action === "cancel-travel";

        if (action === "travel" && user) {
          const nextTravelingTo = typeof data.returningTo === "string" ? data.returningTo : data.regionId;
          const nextTravelingFrom = typeof data.travelingFrom === "string"
            ? data.travelingFrom
            : (action === "travel" ? user.regionId : user.travelingFrom);
          const nextTravelDurationMs =
            typeof data.travelDurationMs === "number"
              ? data.travelDurationMs
              : (typeof data.travelMinutes === "number" ? data.travelMinutes * 60 * 1000 : user.travelDurationMs);

          setUser({
            ...user,
            travelingTo: nextTravelingTo || null,
            travelingUntil: data.travelingUntil ?? user.travelingUntil,
            travelingFrom: nextTravelingFrom || null,
            travelDurationMs: nextTravelDurationMs ?? null,
          });
        } else if (action === "cancel-travel" && user) {
          setUser({
            ...user,
            travelingTo: data.returningTo ?? user.travelingFrom ?? user.regionId,
            travelingUntil: data.travelingUntil ?? user.travelingUntil,
            travelingFrom: data.travelingFrom ?? user.travelingTo ?? null,
            travelDurationMs: data.travelDurationMs ?? user.travelDurationMs ?? null,
          });
          const returnTarget = data.returningTo ?? user.travelingFrom ?? user.regionId;
          alert(`Ritorno iniziato verso ${returnTarget}.`);
        }

        if (isTravelMutation) {
          window.setTimeout(() => {
            fetchData();
          }, 800);
        } else {
          fetchData();
        }
      }
    } catch {
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
    } catch {
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
    } catch {
      alert("Booster activation failed");
    } finally {
      setActionLoading(false);
    }
  };

  return {
    actionLoading,
    autoWorkFactoryId,
    autoWorkResourceType,
    autoWorkRegionId,
    setAutoWorkFactoryId,
    setAutoWorkResource,
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
