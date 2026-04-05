import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

console.log("Supabase URL:", supabaseUrl);
console.log("Using Key (first 10 chars):", supabaseKey.substring(0, 10));

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("\n--- Listing all tables in 'public' schema ---");
  // PostgREST doesn't have a direct "list tables" endpoint in the JS client,
  // but we can try to query a known non-existent table to see if the error gives us clues,
  // or use a raw query if we have an RPC.
  // Alternatively, let's just try to fetch from 'regions' as well, since server.ts uses it.
  
  const tables = ['users', 'regions', 'articles', 'wars', 'budgets', 'nations'];
  for (const table of tables) {
    const { error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`Table '${table}': ERROR - ${error.message} (${error.code})`);
    } else {
      console.log(`Table '${table}': OK`);
    }
  }

  console.log("\n--- Checking RLS on 'users' ---");
  const testId = "00000000-0000-0000-0000-000000000000";
  const { error: insertError } = await supabase.from('users').insert({
    id: testId,
    username: "TestUser",
    money: 1000
  });

  if (insertError) {
    console.error("Insert into 'users' failed:", insertError.message, "(code:", insertError.code, ")");
  } else {
    console.log("Insert into 'users' succeeded!");
    await supabase.from('users').delete().eq('id', testId);
  }
}

check();
