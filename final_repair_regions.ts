import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data: regions, error: regionsError } = await supabase.from('regions').select('id, name, nation_id');
  if (regionsError) {
    console.error("Error fetching regions:", regionsError);
    return;
  }
  
  const updates: any[] = [];
  for (const region of regions) {
    let targetNationId = region.nation_id;

    if (!region.nation_id) {
      if (region.id.length === 2) {
        targetNationId = region.id.toUpperCase();
      } else if (region.id.includes('-')) {
        targetNationId = region.id.split('-')[0].toUpperCase();
      }
    }

    if (targetNationId && targetNationId !== region.nation_id) {
      updates.push({ id: region.id, nation_id: targetNationId });
    }
  }

  console.log(`Found ${updates.length} regions needing repair.`);
  
  if (updates.length > 0) {
      for (let i = 0; i < updates.length; i += 100) {
        const chunk = updates.slice(i, i + 100);
        const { error: updateError } = await supabase.from('regions').upsert(chunk);
        if (updateError) {
          console.error(`Error updating chunk starting at ${i}:`, updateError);
        } else {
          console.log(`Updated ${i + chunk.length}/${updates.length} regions...`);
        }
      }
      console.log("Repair complete!");
  } else {
      console.log("Nothing to repair.");
  }
}

run();
