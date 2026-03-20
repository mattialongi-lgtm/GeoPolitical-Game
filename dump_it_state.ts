import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function dump() {
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || "").trim();
  const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data, error } = await supabase.from('nations').select('*').eq('id', 'IT').single();
  if (error) {
    console.error("Error fetching nation IT:", error);
  } else {
    console.log("Nation IT record:", JSON.stringify(data, null, 2));
  }
}

dump();
