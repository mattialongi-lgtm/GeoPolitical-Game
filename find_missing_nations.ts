import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data: regions, error: regionsError } = await supabase.from('regions').select('id, name');
  const { data: nations, error: nationsError } = await supabase.from('nations').select('id');
  const currentNations = new Set(nations?.map(n => n.id) || []);
  
  const missingNations: any[] = [];
  for (const r of regions || []) {
      const nid = r.id.length === 2 ? r.id : (r.id.includes('-') ? r.id.split('-')[0] : null);
      if (nid && !currentNations.has(nid.toUpperCase())) {
          missingNations.push({ id: nid.toUpperCase(), name: r.name });
      }
  }
  
  // Uniquify
  const uniqueMissing = Array.from(new Map(missingNations.map(m => [m.id, m.name])).entries())
      .map(([id, name]) => ({ id, name }));

  console.log(`Missing nations in 'nations' table: ${uniqueMissing.length}`);
  console.log(JSON.stringify(uniqueMissing.slice(0, 5), null, 2));
}

run();
