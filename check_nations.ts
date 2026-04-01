import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data: nations, error: nationsError } = await supabase.from('nations').select('id, name');
  if (nationsError) {
    console.error(nationsError);
    return;
  }
  console.log(`Found ${nations.length} nations.`);
  console.log(nations.slice(0, 5));
}

run();
