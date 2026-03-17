/**
 * Region Images – Maps region/country ISO codes to representative landmark images.
 * Uses freely available Wikimedia Commons images via Wikimedia REST API thumbnails.
 * Falls back to flag images for unmapped regions.
 */

/**
 * Mapping of ISO country codes to representative landmark/landscape image URLs.
 * Images sourced from freely available CDNs.
 */
const REGION_IMAGES: Record<string, string> = {
  // Europe
  IT: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Colosseum_in_Rome-April_2007-1-_copie_2B.jpg/320px-Colosseum_in_Rome-April_2007-1-_copie_2B.jpg",
  FR: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Tour_Eiffel_Wikimedia_Commons.jpg/240px-Tour_Eiffel_Wikimedia_Commons.jpg",
  DE: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Brandenburger_Tor_abends.jpg/320px-Brandenburger_Tor_abends.jpg",
  ES: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Sagrada_Familia_8-12-21_%281%29.jpg/240px-Sagrada_Familia_8-12-21_%281%29.jpg",
  GB: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Clock_Tower_-_Palace_of_Westminster%2C_London_-_May_2007.jpg/200px-Clock_Tower_-_Palace_of_Westminster%2C_London_-_May_2007.jpg",
  US: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Lady_Liberty_under_a_blue_sky_%28cropped%29.jpg/240px-Lady_Liberty_under_a_blue_sky_%28cropped%29.jpg",
  CA: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Canadian_Horseshoe_Falls_with_Maid_of_the_Mist.jpg/320px-Canadian_Horseshoe_Falls_with_Maid_of_the_Mist.jpg",
  BR: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Cristo_Redentor_-_Rio.jpg/240px-Cristo_Redentor_-_Rio.jpg",
  JP: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Kinkaku3402CBcropped.jpg/320px-Kinkaku3402CBcropped.jpg",
  CN: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/20090529_Great_Wall_8185.jpg/320px-20090529_Great_Wall_8185.jpg",
  IN: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Taj_Mahal_%28Edited%29.jpeg/320px-Taj_Mahal_%28Edited%29.jpeg",
  RU: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Moscow_Kremlin.jpg/320px-Moscow_Kremlin.jpg",
  AU: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Sydney_Opera_House_Close_up_HDR_Sydney_Australia.jpg/320px-Sydney_Opera_House_Close_up_HDR_Sydney_Australia.jpg",
  ZA: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Table_Mountain_DanieVDM.jpg/320px-Table_Mountain_DanieVDM.jpg",
  MX: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/El_Castillo_at_Chichen_Itza.jpg/320px-El_Castillo_at_Chichen_Itza.jpg",
  AR: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Buenos_Aires_-_Monserrat_-_Obelisco.jpg/200px-Buenos_Aires_-_Monserrat_-_Obelisco.jpg",
  EG: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Kheops-Pyramid.jpg/320px-Kheops-Pyramid.jpg",
  NG: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Zuma_Rock.jpg/320px-Zuma_Rock.jpg",
  TR: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Hagia_Sophia_Mars_2013.jpg/320px-Hagia_Sophia_Mars_2013.jpg",
  KR: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Gyeongbokgung-GesseongjeonHall.jpg/320px-Gyeongbokgung-GeeseongjeonHall.jpg",
  SA: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Kaaba_-_Flickr_-_Al_Jazeera_English.jpg/320px-Kaaba_-_Flickr_-_Al_Jazeera_English.jpg",
  PL: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Wawel_Castle%2C_Krak%C3%B3w.jpg/320px-Wawel_Castle%2C_Krak%C3%B3w.jpg",
  UA: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Kyiv_-_Pechersk_Lavra.jpg/320px-Kyiv_-_Pechersk_Lavra.jpg",
  SE: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Stockholm_old_town_2011.jpg/320px-Stockholm_old_town_2011.jpg",
  NO: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Geirangerfjord_%286-2007%29.jpg/320px-Geirangerfjord_%286-2007%29.jpg",
  NL: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/KeijsersGracht.jpg/320px-KeijsersGracht.jpg",
  CH: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Matterhorn_from_Domh%C3%BCtte_-_2.jpg/240px-Matterhorn_from_Domh%C3%BCtte_-_2.jpg",
  PT: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Lisbon_46_%2831675642567%29.jpg/320px-Lisbon_46_%2831675642567%29.jpg",
  GR: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/The_Parthenon_in_Athens.jpg/320px-The_Parthenon_in_Athens.jpg",
  AT: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Schloss_Sch%C3%B6nbrunn_Wien_2014_%28Zuschnitt_2%29.jpg/320px-Schloss_Sch%C3%B6nbrunn_Wien_2014_%28Zuschnitt_2%29.jpg",
  CZ: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Prague_1_Prague_Castle_from_Charles_Bridge_at_Night.jpg/320px-Prague_1_Prague_Castle_from_Charles_Bridge_at_Night.jpg",
  RO: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Pele%C8%99_Castle.jpg/320px-Pele%C8%99_Castle.jpg",
  HU: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Hungarian_Parliament_Building.jpg/320px-Hungarian_Parliament_Building.jpg",
  FI: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/Helsinki_Cathedral_in_winter.jpg/320px-Helsinki_Cathedral_in_winter.jpg",
  DK: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Nyhavn%2C_Copenhagen.jpg/320px-Nyhavn%2C_Copenhagen.jpg",
  IE: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Cliffs_of_Moher.jpg/320px-Cliffs_of_Moher.jpg",
  BE: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Grand_Place_1.jpg/320px-Grand_Place_1.jpg",
  // Asia
  TH: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Wat_Arun_night_view_Bangkok_%28Unsplash%29.jpg/240px-Wat_Arun_night_view_Bangkok_%28Unsplash%29.jpg",
  VN: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/HaLongBay.jpg/320px-HaLongBay.jpg",
  PH: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Chocolate_Hills_overview.JPG/320px-Chocolate_Hills_overview.JPG",
  ID: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Borobudur-Nothwest-view.jpg/320px-Borobudur-Nothwest-view.jpg",
  // Middle East
  IR: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Naghshe_Jahan_Square_Isfahan_modified2.jpg/320px-Naghshe_Jahan_Square_Isfahan_modified2.jpg",
  IL: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/Jerusalem_Western_Wall_BW_1.JPG/240px-Jerusalem_Western_Wall_BW_1.JPG",
  // Africa
  KE: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Elephants_at_Amboseli_national_park_against_Mount_Kilimanjaro.jpg/320px-Elephants_at_Amboseli_national_park_against_Mount_Kilimanjaro.jpg",
  MA: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Koutoubia_Mosque%2CMarrakech%2CMorocco.jpg/240px-Koutoubia_Mosque%2CMarrakech%2CMorocco.jpg",
  // South America
  CO: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/CartagenaIndias2006.jpg/320px-CartagenaIndias2006.jpg",
  CL: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Moais_in_Rano_Raraku.jpg/320px-Moais_in_Rano_Raraku.jpg",
  PE: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Machu_Picchu%2C_Peru.jpg/320px-Machu_Picchu%2C_Peru.jpg",
  // Oceania
  NZ: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Milford_Sound_%28New_Zealand%29.JPG/320px-Milford_Sound_%28New_Zealand%29.JPG",
};

/**
 * Get the representative image URL for a region.
 * Falls back to flag CDN for unmapped regions.
 * @param iso2 - The ISO2 code (e.g., "IT", "IT-RM")
 * @returns Image URL string
 */
export function getRegionImage(iso2: string): string | null {
  if (!iso2) return null;
  const upper = iso2.toUpperCase();
  // Handle sub-region codes (e.g., "IT-RM" → "IT")
  const countryCode = upper.includes('-') ? upper.split('-')[0] : upper;
  return REGION_IMAGES[countryCode] || null;
}

/**
 * Get the flag image URL for a region (used as fallback).
 * @param iso2 - The ISO2 code
 * @returns flagcdn URL
 */
export function getFlagUrl(iso2: string): string {
  const code = (iso2 || '').toLowerCase().split('-')[0];
  return `https://flagcdn.com/${code}.svg`;
}

export default REGION_IMAGES;
