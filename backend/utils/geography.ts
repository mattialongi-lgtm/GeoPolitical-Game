/**
 * geography.ts
 * Utility per il calcolo delle distanze e validazioni geografiche.
 */

/**
 * Calcola la distanza in chilometri tra due coordinate Lat/Lng usando la formula di Haversine.
 * @param lat1 Latitudine origine in gradi.
 * @param lon1 Longitudine origine in gradi.
 * @param lat2 Latitudine destinazione in gradi.
 * @param lon2 Longitudine destinazione in gradi.
 * @returns Distanza sferica in chilometri.
 */
export function haversineDistance(lat1: number | null | undefined, lon1: number | null | undefined, lat2: number | null | undefined, lon2: number | null | undefined): number {
  if (lat1 === undefined || lat1 === null || lon1 === undefined || lon1 === null || lat2 === undefined || lat2 === null || lon2 === undefined || lon2 === null) {
     return Infinity; // Distanza infinita se le coordinate mancano
  }

  const R = 6371; // Raggio della Terra in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

export const WAR_NAVAL_MAX_DISTANCE_KM = 1500;
