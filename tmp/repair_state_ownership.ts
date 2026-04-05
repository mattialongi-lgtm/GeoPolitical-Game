import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function repair() {
  console.log("Starting nation_id repair...");

  // 1. Fetch all nations and their leaders
  const { data: nations, error: nError } = await supabase.from('nations').select('id, leaderUserId');
  if (nError) throw nError;

  const leaderToNation: Record<string, string> = {};
  nations.forEach(n => {
    if (n.leaderUserId) leaderToNation[n.leaderUserId] = n.id;
  });

  // 2. Fetch all regions
  const { data: regions, error: rError } = await supabase.from('regions').select('id, name, nation_id, ownerUserId');
  if (rError) throw rError;

  const updates: any[] = [];
  for (const region of regions) {
    if (region.ownerUserId && leaderToNation[region.ownerUserId]) {
      const correctNationId = leaderToNation[region.ownerUserId];
      if (region.nation_id !== correctNationId) {
        console.log(`Region ${region.name} (${region.id}) should belong to ${correctNationId} but is ${region.nation_id}`);
        updates.push({ id: region.id, nation_id: correctNationId });
      }
    }
  }

  if (updates.length > 0) {
    console.log(`Fixing ${updates.length} regions...`);
    const { error: uError } = await supabase.from('regions').upsert(updates);
    if (uError) throw uError;
    console.log("Repair successful!");
  } else {
    console.log("No regions need repair.");
  }
}

repair().catch(console.error);
