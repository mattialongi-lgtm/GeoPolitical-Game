import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { count, error } = await supabase.from('nations').select('id', { count: 'exact', head: true });
  if (error) {
    console.error(error);
  } else {
    console.log(`Total nations: ${count}`);
  }
}

run();
