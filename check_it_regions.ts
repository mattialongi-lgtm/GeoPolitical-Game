import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const nationId = 'IT';
  const { data, error } = await supabase
    .from('regions')
    .select('id, name, nation_id')
    .or(`nation_id.eq.${nationId},id.ilike.${nationId}-%`);

  if (error) {
    console.error(error);
  } else {
    console.log(`Nation ${nationId} has ${data?.length || 0} regions.`);
    console.log(data);
  }
}

run();
