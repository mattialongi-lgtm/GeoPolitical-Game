
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkRegions() {
  const { data, error } = await supabase.from('regions').select('*').limit(1);
  if (error) {
    console.error(error);
  } else {
    console.log('Sample region keys:');
    Object.keys(data?.[0] || {}).forEach(k => console.log(k));
  }
}

checkRegions();
