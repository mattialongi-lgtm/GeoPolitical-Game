import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data, error } = await supabase.from('regions').select('id, name, nation_id');
  if (error) {
    console.error(error);
  } else {
    fs.writeFileSync('all_regions_dump.json', JSON.stringify(data, null, 2));
    console.log(`Dumped ${data.length} regions to all_regions_dump.json`);
  }
}

run();
