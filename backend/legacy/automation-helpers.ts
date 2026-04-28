import { TROOP_BASE_DAMAGE } from "../../src/types";

export const createAutomationError = (statusCode: number, message: string) => {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  return err;
};

export const AUTOMATION_STANDARD_INTERVAL_MS = 10 * 60 * 1000;
export const AUTOMATION_HOURLY_INTERVAL_MS = 60 * 60 * 1000;
export const AUTOMATION_EXPIRE_MS = 24 * 60 * 60 * 1000;

export const WAR_WEAPON_CONFIG: Record<string, { energy: number; cash: number; damage: number }> = {
  tank: { energy: 30, cash: 0, damage: TROOP_BASE_DAMAGE.tank },
  aircraft: { energy: 50, cash: 0, damage: TROOP_BASE_DAMAGE.aircraft },
  battleship: { energy: 40, cash: 0, damage: TROOP_BASE_DAMAGE.battleship },
};

export const LEGACY_WAR_WEAPON_ALIASES: Record<string, string> = {
  infantry: "tank",
  airstrike: "aircraft",
};

export const normalizeWarWeaponId = (weaponId: string): string => {
  const normalized = (weaponId || "").trim().toLowerCase();
  return LEGACY_WAR_WEAPON_ALIASES[normalized] || normalized;
};

export const getAllowedWeaponsForWar = (warType: string, navalPhase: number): string[] => {
  if (warType === "naval" && navalPhase === 1) return ["battleship"];
  return ["tank", "aircraft"];
};

export const isAutomationExpired = (activatedAt?: string | null, expiresAt?: string | null, now = Date.now()) => {
  if (expiresAt) return new Date(expiresAt).getTime() <= now;
  if (!activatedAt) return false;
  return now - new Date(activatedAt).getTime() >= AUTOMATION_EXPIRE_MS;
};

export const shouldRecurringAutomationFire = (
  mode: "standard" | "hourly" | "maximum",
  lastFiredAt: string | null,
  activatedAt: string,
  now = Date.now()
) => {
  const interval = mode === "hourly" ? AUTOMATION_HOURLY_INTERVAL_MS : AUTOMATION_STANDARD_INTERVAL_MS;
  if (isAutomationExpired(activatedAt, null, now)) return false;
  if (!lastFiredAt) return true;
  return now - new Date(lastFiredAt).getTime() >= interval;
};

export const normalizeWarAutoType = (value: any): "hourly" | "maximum" => {
  return value === "hourly" ? "hourly" : "maximum";
};

export const isAutoAttackCompatibleWithAutoWork = (autoType: any): boolean => autoType === "hourly";

export const autoWorkIncompatibleMessage =
  "Auto-Work è compatibile solo con il Danno Orario, non con l'Auto-War standard.";

export const missingAutomationTablesWarned = {
  work: false,
  training: false,
} as { work: boolean; training: boolean };

export const parseAutomationTimestamp = (value: string | number | null | undefined, fallback: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) return numericValue;
    const parsed = new Date(value).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

export const shouldTreatAutoWorkAsNeverFired = (lastFiredAt: string | null, activatedAt: string | null): boolean => {
  if (!lastFiredAt || !activatedAt) return false;
  const lastFiredMs = new Date(lastFiredAt).getTime();
  const activatedMs = new Date(activatedAt).getTime();
  if (!Number.isFinite(lastFiredMs) || !Number.isFinite(activatedMs)) return false;
  return Math.abs(lastFiredMs - activatedMs) <= 1000;
};
