
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data, error } = await supabase.from('regions').select('*').limit(1);
  if (error) {
    fs.writeFileSync('diag_output.txt', JSON.stringify(error));
  } else if (data && data.length > 0) {
    fs.writeFileSync('diag_output.txt', JSON.stringify(Object.keys(data[0])));
  } else {
    fs.writeFileSync('diag_output.txt', 'No data found');
  }
}
run();
