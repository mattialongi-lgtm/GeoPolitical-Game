import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function fix() {
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || "").trim();
  const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log("Fixing Italian regions assignment...");
  
  // Assign all regions starting with IT- to nation IT
  const { data, error } = await supabase
    .from('regions')
    .update({ nation_id: 'IT' })
    .ilike('id', 'IT-%');
  
  if (error) {
    console.error("Error updating IT regions:", error);
  } else {
    console.log("Updated IT regions.");
  }
  
  // Also ensure 'IT' itself belongs to 'IT' if it exists
  await supabase.from('regions').update({ nation_id: 'IT' }).eq('id', 'IT');
  
  // Sanctions & Military Agreements check
  const { data: mil } = await supabase.from('military_agreements').select('count', { count: 'exact', head: true });
  console.log("Active military agreements:", mil);
}

fix();
