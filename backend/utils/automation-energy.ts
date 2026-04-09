export function parseEnergyTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) return numericValue;
    const parsed = new Date(value).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function hasEnergyDrinkCooldownExpired(
  lastEnergyDrink: unknown,
  now: number,
  cooldownMs: number
): boolean {
  const lastDrinkAt = parseEnergyTimestamp(lastEnergyDrink);
  if (lastDrinkAt == null) return true;
  return (now - lastDrinkAt) >= cooldownMs;
}

export function resolveExtractionEnergyCost(
  baseEnergyCost: unknown,
  resistanceLevel: unknown,
  exactEnergyCost?: unknown
): number {
  const overrideCost = Number(exactEnergyCost);
  if (Number.isFinite(overrideCost) && overrideCost > 0) {
    return Math.max(1, Math.floor(overrideCost));
  }

  const normalizedBaseCost = Math.max(1, Math.floor(Number(baseEnergyCost) || 0));
  const resistance = Math.max(0, Number(resistanceLevel) || 0);
  const reduction = Math.min(0.5, resistance / 100);
  return Math.max(1, Math.ceil(normalizedBaseCost * (1 - reduction)));
}
