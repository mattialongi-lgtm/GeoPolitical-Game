
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function countRegions() {
  const { count, error } = await supabase
    .from('regions')
    .select('id', { count: 'exact', head: true });
  
  if (error) {
    console.error(error);
    return;
  }
  
  console.log("Total regions in DB:", count);

  const { data: sample, error: err2 } = await supabase
    .from('regions')
    .select('id, name')
    .limit(100);

  if (err2) {
    console.error(err2);
    return;
  }
  console.log("Sample regions (up to 100):");
  sample?.forEach(r => console.log(` - ${r.id}: ${r.name}`));
}

countRegions();
