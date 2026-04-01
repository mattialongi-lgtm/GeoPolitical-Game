import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data: nations, error: nationsError } = await supabase.from('nations').select('id');
  const nationIds = new Set(nations?.map(n => n.id) || []);
  let log = `Loaded ${nationIds.size} nations.\n`;
  log += `Sample nationIds: ${Array.from(nationIds).slice(0, 10).join(', ')}\n`;

  const { data: regions, error: regionsError } = await supabase.from('regions').select('id, name, nation_id');
  log += `Loaded ${regions?.length || 0} regions.\n`;

  const updates: any[] = [];
  for (const region of (regions || [])) {
    let targetNationId = region.nation_id;

    if (nationIds.has(region.id)) {
      targetNationId = region.id;
    } else if (region.id.includes('-')) {
      const prefix = region.id.split('-')[0].toUpperCase();
      if (nationIds.has(prefix)) {
        targetNationId = prefix;
      }
    }

    if (targetNationId !== region.nation_id) {
      log += `Proposed repair: id=${region.id}, current=${region.nation_id}, target=${targetNationId}\n`;
      updates.push({ id: region.id, nation_id: targetNationId });
    }
  }

  log += `Found ${updates.length} regions needing repair.\n`;
  fs.writeFileSync('repair_log.txt', log);
  console.log("Logged everything to repair_log.txt");
  
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
  }
}

run();
