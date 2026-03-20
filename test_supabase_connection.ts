import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function test() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  
  console.log("Testing connection to:", supabaseUrl);
  
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing env vars");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });
    if (error) {
      console.error("Supabase request error:", error);
    } else {
      console.log("Success! Found users count:", data);
    }
    
    // Test auth edge cases
    const testTokens = ["fake-token", "undefined", "", "null", "Bearer something"];
    for (const t of testTokens) {
      console.log(`Testing auth.getUser with token: "${t}"`);
      const { error: authError } = await supabase.auth.getUser(t);
      console.log(`Auth result for "${t}":`, authError ? { status: authError.status, code: authError.code, message: authError.message } : "SUCCESS");
    }
    
  } catch (err) {
    console.error("Exception during test:", err);
  }
}

test();
