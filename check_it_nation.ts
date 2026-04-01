
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkNations() {
  const { data, error } = await supabase.from('nations').select('id, name').eq('id', 'IT');
  if (error) {
    console.error(error);
  } else {
    console.log('Nation IT:', data);
  }
}

checkNations();
