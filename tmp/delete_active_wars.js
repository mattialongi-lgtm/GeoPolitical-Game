const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = (process.env.VITE_SUPABASE_URL || "").trim();
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteWars() {
  console.log("Fetching active wars...");
  const { data: wars, error: fetchError } = await supabase
    .from('wars')
    .select('id, attackerRegionId, defenderRegionId')
    .eq('status', 'active');

  if (fetchError) {
    console.error("Error fetching wars:", fetchError);
    return;
  }

  if (!wars || wars.length === 0) {
    console.log("No active wars found.");
    return;
  }

  console.log(`Found ${wars.length} active wars. Deleting...`);
  
  for (const war of wars) {
    console.log(`Deleting war ${war.id} (${war.attackerRegionId} vs ${war.defenderRegionId})`);
    
    // We should also delete related data to avoid foreign key issues
    // Often there are participants, deployments, etc.
    // Let's try to delete the war directly first, if there are FKs we'll see the error.
    
    const { error: deleteError } = await supabase
      .from('wars')
      .delete()
      .eq('id', war.id);

    if (deleteError) {
      console.error(`Error deleting war ${war.id}:`, deleteError.message);
      
      if (deleteError.message.includes('foreign key constraint')) {
          console.log("Attempting to delete related records first...");
          // Try deleting from related tables
          await supabase.from('war_participants').delete().eq('warId', war.id);
          await supabase.from('war_deployments').delete().eq('warId', war.id);
          await supabase.from('war_history').delete().eq('warId', war.id);
          
          // Try again
          const { error: retryError } = await supabase.from('wars').delete().eq('id', war.id);
          if (retryError) {
              console.error(`Still failed to delete war ${war.id}:`, retryError.message);
          } else {
              console.log(`Successfully deleted war ${war.id} after clearing relations.`);
          }
      }
    } else {
      console.log(`Successfully deleted war ${war.id}`);
    }
  }
}

deleteWars();
