
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
  const { data, error } = await supabase
    .from('users')
    .select('username, avatarData')
    .ilike('username', 'Ascanio%');
  
  if (error) {
    console.error(error);
    return;
  }
  
  console.log("Users found:", data?.length);
  data?.forEach(u => {
    console.log(`User: ${u.username}`);
    console.log(`Avatar length: ${u.avatarData ? u.avatarData.length : 'null'}`);
    if (u.avatarData) {
        console.log(`Starts with: ${u.avatarData.substring(0, 30)}`);
    }
  });
}

checkUser();
