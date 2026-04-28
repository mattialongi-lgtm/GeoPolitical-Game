import { randomBytes } from "crypto";

export const generateSecureId = (length: number = 9): string =>
  randomBytes(Math.ceil(length / 2)).toString("hex").slice(0, length);

export const seededRandom = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return () => {
    hash = (hash * 16807) % 2147483647;
    return (hash - 1) / 2147483646;
  };
};

export const generateGameStatsForCountry = (iso2: string) => {
  const rng = seededRandom(iso2);
  const resourceTypes = ["Oil", "Steel", "Food", "Tech", "Uranium"];
  const numResources = 1 + Math.floor(rng() * 3);
  const selectedResources = [];
  const shuffled = [...resourceTypes].sort(() => rng() - 0.5);

  const getIndicator = () => 1 + Math.floor(rng() * 10);

  for (let i = 0; i < numResources; i++) {
    selectedResources.push({
      type: shuffled[i],
      base: 10 + Math.floor(rng() * 90),
    });
  }

  return {
    indicators: {
      health: getIndicator(),
      education: getIndicator(),
      industry: getIndicator(),
      security: getIndicator(),
      infrastructure: getIndicator(),
      morale: getIndicator(),
      economy: getIndicator(),
      tech: getIndicator(),
      resourcesQuality: getIndicator(),
      stability: getIndicator(),
    },
    resources: selectedResources,
  };
};
