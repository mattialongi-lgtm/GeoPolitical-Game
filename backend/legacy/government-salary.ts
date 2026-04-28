const GOVERNMENT_SALARY_CONFIG: Record<string, { headOfState: number; minister: number }> = {
  PARLIAMENTARY_REPUBLIC: { headOfState: 40, minister: 25 },
  PRESIDENTIAL_REPUBLIC: { headOfState: 40, minister: 25 },
  DOMINANT_PARTY: { headOfState: 30, minister: 20 },
  DICTATORSHIP: { headOfState: 60, minister: 15 },
  ONE_PARTY_SYSTEM: { headOfState: 35, minister: 20 },
  EXECUTIVE_MONARCHY: { headOfState: 80, minister: 10 },
  REPUBBLICA: { headOfState: 40, minister: 25 },
  "REPUBBLICA PARLAMENTARE": { headOfState: 40, minister: 25 },
};

export function calculateStateSalaries(governmentForm: string | null, regionCount: number) {
  const normalized = (governmentForm || "").toUpperCase();
  const config = GOVERNMENT_SALARY_CONFIG[normalized] || GOVERNMENT_SALARY_CONFIG.PARLIAMENTARY_REPUBLIC;
  const actualCount = Math.max(1, regionCount);

  return {
    headOfStateGold: config.headOfState * actualCount,
    ministerGold: config.minister * actualCount,
  };
}

export const PRIMARIES_CYCLE_MS = 5 * 24 * 60 * 60 * 1000;

export const getPrimariesCycleStart = () =>
  new Date(Math.floor(Date.now() / PRIMARIES_CYCLE_MS) * PRIMARIES_CYCLE_MS).toISOString();

export const createMinisterWageCalculator = (supabase: any) => async (stateId: string, _role: string) => {
  const { data: region } = await supabase
    .from("regions")
    .select("governmentForm, economyLevel, ownerUserId, healthIndex, educationIndex, developmentIndex")
    .eq("id", stateId)
    .single();

  if (!region) return 0;

  const devIndex =
    ((region.developmentIndex ?? 1) +
      (region.educationIndex ?? 1) +
      (region.healthIndex ?? 1) +
      (region.economyLevel ?? 1)) /
    4;

  let govMult = 1.0;
  if (region.governmentForm === "PRESIDENTIAL_REPUBLIC") govMult = 1.5;
  if (region.governmentForm === "DICTATORSHIP") govMult = 2.0;
  if (region.governmentForm === "ONE_PARTY_SYSTEM") govMult = 1.8;

  const { count } = await supabase
    .from("regions")
    .select("*", { count: "exact", head: true })
    .eq("ownerUserId", region.ownerUserId);

  const sizeMult = 1 + ((count || 1) * 0.1);
  const baseWage = 10;
  return Math.floor(baseWage * devIndex * govMult * sizeMult);
};
