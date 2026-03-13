import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RESOURCE_TYPES = ['oil', 'minerals', 'uranium', 'diamonds', 'gold_ore'];

const DEFAULTS: Record<string, { daily: number, cap: number }> = {
  oil: { daily: 5000, cap: 200 },
  minerals: { daily: 5000, cap: 200 },
  uranium: { daily: 2000, cap: 100 },
  diamonds: { daily: 1000, cap: 50 },
  gold_ore: { daily: 3000, cap: 150 },
};

async function init() {
  console.log("Initializing region resources...");

  const { data: regions } = await supabase.from('regions').select('id');
  if (!regions) {
    console.error("No regions found.");
    return;
  }

  for (const region of regions) {
    console.log(`Setting up resources for ${region.id}...`);
    for (const resType of RESOURCE_TYPES) {
      const def = DEFAULTS[resType];
      const { error } = await supabase
        .from('region_resources')
        .upsert({
          regionId: region.id,
          resourceType: resType,
          dailyAvailable: def.daily,
          dailyExtracted: 0,
          baseCapPerRecharge: def.cap,
          updatedAt: new Date().toISOString()
        });
      if (error) {
        console.error(`Error for ${region.id} ${resType}:`, error.message);
      }
    }
  }

  console.log("Initialization complete!");
}

init();
