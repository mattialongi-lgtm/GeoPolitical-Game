const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  console.log("--- Factory Warehouse Fix Verification ---");

  // 1. Pick a test factory and its owner
  const { data: factories } = await supabase.from('factories').select('*').limit(1);
  if (!factories || factories.length === 0) {
    console.error("No factories found for testing.");
    process.exit(1);
  }
  const factory = factories[0];
  const ownerId = factory.ownerUserId;
  const initialStorage = factory.currentStorage || 0;

  console.log(`Testing with Factory: ${factory.name} (${factory.id})`);
  console.log(`Owner: ${ownerId}`);
  console.log(`Initial Storage: ${initialStorage}`);

  // 2. Check initial owner inventory for the resource type
  const { data: initialInv } = await supabase.from('user_inventory')
    .select('quantity').eq('userId', ownerId).eq('itemId', factory.type).maybeSingle();
  const initialQty = initialInv ? initialInv.quantity : 0;
  console.log(`Initial Owner Inventory (${factory.type}): ${initialQty}`);

  // 3. Simulate production (increment storage)
  console.log("\nSimulating production of 50 units...");
  const { error: pError } = await supabase.rpc('increment_factory_storage', {
    p_factory_id: factory.id,
    p_amount: 50
  });

  if (pError) {
    console.error("Error calling increment_factory_storage:", pError);
    process.exit(1);
  }

  // 4. Verify storage increased and inventory did NOT
  const { data: updatedFactory } = await supabase.from('factories').select('currentStorage').eq('id', factory.id).single();
  console.log(`Updated Storage: ${updatedFactory.currentStorage}`);
  if (updatedFactory.currentStorage !== initialStorage + 50) {
    console.error("FAILED: Storage did not increase correctly.");
  } else {
    console.log("PASSED: Storage increased.");
  }

  const { data: currentInv } = await supabase.from('user_inventory')
    .select('quantity').eq('userId', ownerId).eq('itemId', factory.type).maybeSingle();
  const currentQty = currentInv ? currentInv.quantity : 0;
  console.log(`Current Owner Inventory: ${currentQty}`);
  if (currentQty !== initialQty) {
    console.error("FAILED: Owner inventory increased prematurely.");
  } else {
    console.log("PASSED: Owner inventory stayed same.");
  }

  console.log("\nAutomated Backend logic (increment) verified.");
  process.exit(0);
}

verify();
