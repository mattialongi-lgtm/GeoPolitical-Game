import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data, error } = await supabase.from('regions').select('id, name, nation_id');
  if (error) {
    console.error(error);
  } else {
    console.log(`Found ${data.length} regions.`);
    const countByNation = data.reduce((acc: any, r) => {
      acc[r.nation_id] = (acc[r.nation_id] || 0) + 1;
      return acc;
    }, {});
    console.log("Counts by nation_id:", countByNation);
  }
}

run();
