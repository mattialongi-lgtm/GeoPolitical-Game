
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkData() {
  const { data, error } = await supabase.from('regions').select('id, name, nation_id').limit(10);
  if (error) {
    console.error(error);
  } else {
    console.log('Sample regions:', data);
  }
}

checkData();
