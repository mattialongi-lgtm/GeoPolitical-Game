import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''; // admin is needed for update if RLS is on

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE URL or KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// A selected set of regions (~50 countries, mainly Europe, NA, and major world powers)
const GEOGRAPHY_DATA: Record<string, { lat: number, lng: number, coastline: boolean, borders: string[] }> = {
  // EUROPE
  "IT": { lat: 41.8719, lng: 12.5674, coastline: true, borders: ["FR", "CH", "AT", "SI", "SM", "VA"] },
  "FR": { lat: 46.2276, lng: 2.2137, coastline: true, borders: ["ES", "AD", "BE", "LU", "DE", "CH", "IT", "MC"] },
  "DE": { lat: 51.1657, lng: 10.4515, coastline: true, borders: ["DK", "PL", "CZ", "AT", "CH", "FR", "BE", "LU", "NL"] },
  "CH": { lat: 46.8182, lng: 8.2275, coastline: false, borders: ["IT", "FR", "DE", "AT", "LI"] },
  "AT": { lat: 47.5162, lng: 14.5501, coastline: false, borders: ["DE", "CZ", "SK", "HU", "SI", "IT", "CH", "LI"] },
  "ES": { lat: 40.4637, lng: -3.7492, coastline: true, borders: ["FR", "AD", "PT", "GI", "MA"] },
  "PT": { lat: 39.3999, lng: -8.2245, coastline: true, borders: ["ES"] },
  "GB": { lat: 55.3781, lng: -3.4360, coastline: true, borders: ["IE"] },
  "IE": { lat: 53.1424, lng: -7.6921, coastline: true, borders: ["GB"] },
  "NL": { lat: 52.1326, lng: 5.2913, coastline: true, borders: ["DE", "BE"] },
  "BE": { lat: 50.5039, lng: 4.4699, coastline: true, borders: ["NL", "DE", "LU", "FR"] },
  "PL": { lat: 51.9194, lng: 19.1451, coastline: true, borders: ["DE", "CZ", "SK", "UA", "BY", "LT", "RU"] },
  "CZ": { lat: 49.8175, lng: 15.4730, coastline: false, borders: ["DE", "PL", "SK", "AT"] },
  "GR": { lat: 39.0742, lng: 21.8243, coastline: true, borders: ["AL", "MK", "BG", "TR"] },
  "TR": { lat: 38.9637, lng: 35.2433, coastline: true, borders: ["GR", "BG", "GE", "AM", "AZ", "IR", "IQ", "SY"] },
  "RO": { lat: 45.9432, lng: 24.9668, coastline: true, borders: ["UA", "MD", "BG", "RS", "HU"] },
  "HU": { lat: 47.1625, lng: 19.5033, coastline: false, borders: ["AT", "SK", "UA", "RO", "RS", "HR", "SI"] },
  "SE": { lat: 60.1282, lng: 18.6435, coastline: true, borders: ["NO", "FI"] },
  "NO": { lat: 60.4720, lng: 8.4689, coastline: true, borders: ["SE", "FI", "RU"] },
  "FI": { lat: 61.9241, lng: 25.7482, coastline: true, borders: ["SE", "NO", "RU"] },
  "DK": { lat: 56.2639, lng: 9.5018, coastline: true, borders: ["DE"] },
  "RU": { lat: 61.5240, lng: 105.3188, coastline: true, borders: ["NO", "FI", "EE", "LV", "LT", "PL", "BY", "UA", "GE", "AZ", "KZ", "CN", "MN", "KP"] },
  "UA": { lat: 48.3794, lng: 31.1656, coastline: true, borders: ["RU", "BY", "PL", "SK", "HU", "RO", "MD"] },

  // AMERICAS
  "US": { lat: 37.0902, lng: -95.7129, coastline: true, borders: ["CA", "MX"] },
  "CA": { lat: 56.1304, lng: -106.3468, coastline: true, borders: ["US"] },
  "MX": { lat: 23.6345, lng: -102.5528, coastline: true, borders: ["US", "GT", "BZ"] },
  "BR": { lat: -14.2350, lng: -51.9253, coastline: true, borders: ["UY", "AR", "PY", "BO", "PE", "CO", "VE", "GY", "SR", "GF"] },
  "AR": { lat: -38.4161, lng: -63.6167, coastline: true, borders: ["CL", "BO", "PY", "BR", "UY"] },
  "CO": { lat: 4.5709, lng: -74.2973, coastline: true, borders: ["PA", "VE", "BR", "PE", "EC"] },

  // ASIA & OCEANIA
  "CN": { lat: 35.8617, lng: 104.1954, coastline: true, borders: ["KP", "RU", "MN", "KZ", "KG", "TJ", "AF", "PK", "IN", "NP", "BT", "MM", "LA", "VN"] },
  "IN": { lat: 20.5937, lng: 78.9629, coastline: true, borders: ["PK", "CN", "NP", "BT", "BD", "MM"] },
  "JP": { lat: 36.2048, lng: 138.2529, coastline: true, borders: [] },
  "KR": { lat: 35.9078, lng: 127.7669, coastline: true, borders: ["KP"] },
  "KP": { lat: 40.3399, lng: 127.5101, coastline: true, borders: ["CN", "RU", "KR"] },
  "AU": { lat: -25.2744, lng: 133.7751, coastline: true, borders: [] },
  "NZ": { lat: -40.9006, lng: 174.8860, coastline: true, borders: [] },
  "ID": { lat: -0.7893, lng: 113.9213, coastline: true, borders: ["MY", "PG", "TL"] },

  // MIDDLE EAST & AFRICA
  "IL": { lat: 31.0461, lng: 34.8516, coastline: true, borders: ["LB", "SY", "JO", "EG"] },
  "EG": { lat: 26.8206, lng: 30.8025, coastline: true, borders: ["LY", "SD", "IL", "PS"] },
  "ZA": { lat: -30.5595, lng: 22.9375, coastline: true, borders: ["NA", "BW", "ZW", "MZ", "SZ", "LS"] },
  "NG": { lat: 9.0820, lng: 8.6753, coastline: true, borders: ["BJ", "NE", "TD", "CM"] },
  "SA": { lat: 23.8859, lng: 45.0792, coastline: true, borders: ["JO", "IQ", "KW", "BH", "QA", "AE", "OM", "YE"] }
};

async function seed() {
  console.log("Starting geography seed...");

  const codes = Object.keys(GEOGRAPHY_DATA);

  for (const iso of codes) {
    const data = GEOGRAPHY_DATA[iso];
    
    // Assicurati che i borders siano coerenti bidirezionalmente
    for (const border of data.borders) {
      if (GEOGRAPHY_DATA[border]) {
         if (!GEOGRAPHY_DATA[border].borders.includes(iso)) {
            GEOGRAPHY_DATA[border].borders.push(iso);
         }
      }
    }
  }

  let updatedCount = 0;
  for (const iso of codes) {
    const data = GEOGRAPHY_DATA[iso];
    const { error } = await supabase
      .from('regions')
      .update({
        lat: data.lat,
        lng: data.lng,
        coastline: data.coastline,
        borders: data.borders
      })
      .eq('id', iso);

    if (error) {
       console.error(`Error updating ${iso}:`, error.message);
    } else {
       console.log(`Updated ${iso}`);
       updatedCount++;
    }
  }
  
  console.log(`Geography seed complete! Updated ${updatedCount} regions.`);
}

seed();
