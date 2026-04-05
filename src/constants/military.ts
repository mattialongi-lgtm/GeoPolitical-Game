export const WEAPONS_CATALOG = [
  { id: "tank", name: "Carri armati", emoji: "🛡️", timeMin: 8, costCash: 1800, reqOil: 35, reqMinerals: 60, reqUranium: 0, reqDiamonds: 0, power: 45 },
  { id: "aircraft", name: "Aerei", emoji: "✈️", timeMin: 16, costCash: 4200, reqOil: 70, reqMinerals: 110, reqUranium: 0, reqDiamonds: 0, power: 110 },
  { id: "battleship", name: "Corazzate navali", emoji: "🚢", timeMin: 36, costCash: 12000, reqOil: 180, reqMinerals: 260, reqUranium: 0, reqDiamonds: 0, power: 220 },
];

export const LEGACY_MILITARY_UNITS = new Set([
  "rifle",
  "drone",
  "artillery",
  "infantry",
  "airstrike",
  "missile",
  "bomber",
  "lunar_tank",
  "space_station",
]);
