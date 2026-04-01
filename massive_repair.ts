import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  // 1. Identify all required nations
  console.log("Checking all regions in the database...");
  const { data: regions, error: regionsError } = await supabase.from('regions').select('id, name');
  if (regionsError) {
      console.error(regionsError);
      return;
  }
  
  const nationData = new Map<string, string>();
  for (const r of regions || []) {
      const nid = r.id.length === 2 ? r.id.toUpperCase() : (r.id.includes('-') ? r.id.split('-')[0].toUpperCase() : null);
      if (nid) {
          // If we don't have a name yet, or it's the nation-region itself, use that name.
          if (!nationData.has(nid) || r.id.length === 2) {
              nationData.set(nid, r.name);
          }
      }
  }
  
  console.log(`Found ${nationData.size} nations in the regions table.`);
  
  // 2. Fetch current nations to avoid overwriting or just to log
  const { data: currentNations } = await supabase.from('nations').select('id');
  const currentIds = new Set(currentNations?.map(n => n.id) || []);
  console.log(`Currently there are ${currentIds.size} nations in the 'nations' table.`);
  
  // 3. Upsert nations
  const nationsToUpsert = Array.from(nationData).map(([id, name]) => ({ id, name }));
  console.log(`Upserting ${nationsToUpsert.length} nations...`);
  
  for (let i = 0; i < nationsToUpsert.length; i += 50) {
      const chunk = nationsToUpsert.slice(i, i + 50);
      const { error: nationsUpdateError } = await supabase.from('nations').upsert(chunk, { onConflict: 'id' });
      if (nationsUpdateError) {
          console.error(`Error upserting nations chunk starting at ${i}:`, nationsUpdateError);
      } else {
          console.log(`Upserted nations chunk ${i + chunk.length}/${nationsToUpsert.length}`);
      }
  }
  
  // 4. Now fix the nation_id in the regions table
  console.log("Repairing nation_id in the regions table...");
  const updates: any[] = [];
  for (const region of regions || []) {
      let targetNationId = null;
      if (region.id.length === 2) {
          targetNationId = region.id.toUpperCase();
      } else if (region.id.includes('-')) {
          targetNationId = region.id.split('-')[0].toUpperCase();
      }
      
      if (targetNationId) {
          updates.push({ id: region.id, nation_id: targetNationId });
      }
  }
  
  console.log(`Updating ${updates.length} regions with their new nation_id...`);
  for (let i = 0; i < updates.length; i += 100) {
      const chunk = updates.slice(i, i + 100);
      const { error: regionsUpdateError } = await supabase.from('regions').upsert(chunk);
      if (regionsUpdateError) {
          console.error(`Error updating regions chunk starting at ${i}:`, regionsUpdateError);
      } else {
          console.log(`Updated regions chunk ${i + chunk.length}/${updates.length}`);
      }
  }
  
  console.log("Database repair complete!");
}

run();
