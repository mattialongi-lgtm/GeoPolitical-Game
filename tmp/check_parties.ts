import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

async function checkParties() {
  const { data, error } = await supabase.from('parties').select('*').limit(5);
  if (error) {
    console.error("Error fetching parties:", error);
    return;
  }
  console.log("Party sample data:", JSON.stringify(data, null, 2));

  // Check columns
  if (data && data.length > 0) {
    console.log("Columns:", Object.keys(data[0]));
  } else {
      console.log("No parties found in the table.");
  }
}

checkParties();
