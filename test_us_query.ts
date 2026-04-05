import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const nationId = 'US';
  
  const { data: regions, error: regionsError } = await supabase
      .from('regions')
      .select('id, name, nation_id')
      .or(`nation_id.eq.${nationId},id.ilike.${nationId}-%`);

  if (regionsError) {
    console.error("Error fetching regions:", regionsError);
  } else {
    console.log(`Found ${regions?.length || 0} regions for ${nationId}.`);
    console.log(JSON.stringify(regions, null, 2));
  }
}

run();
