
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, count, error } = await supabase.from('factories')
    .select('*', { count: 'exact' })
    .order('level', { ascending: false })
    .limit(100);
    
  if (error) {
    console.log("Error: " + error.message);
    return;
  }
  console.log("SERVER QUERY COUNT: " + (data ? data.length : 0));
  console.log("SERVER QUERY DATA: " + JSON.stringify(data, null, 2));
}

check();
