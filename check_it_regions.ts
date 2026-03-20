import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function check() {
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || "").trim();
  const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data, error } = await supabase.from('regions').select('*').eq('nation_id', 'IT');
  if (error) {
    console.error("Error fetching regions for IT:", error);
  } else {
    console.log(`Found ${data.length} regions for IT:`, JSON.stringify(data, null, 2));
  }
  
  // Also check if there are regions for 'Impero Romano' name or something?
  // No, nation_id should be 'IT'.
  
  // Let's check some regions without nation_id to see if they should be IT
  const { data: orphans } = await supabase.from('regions').select('id, name, nation_id').is('nation_id', null).limit(10);
  console.log("Orphan regions sample:", JSON.stringify(orphans, null, 2));
}

check();
