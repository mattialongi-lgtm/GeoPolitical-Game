const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFunction() {
    const { data: func, error } = await supabase.rpc('get_function_definition', { function_name: 'create_market_offer' });
    if (error) {
        // Alternative: try to call it with dummy data to see if it even exists
        const { error: callError } = await supabase.rpc('create_market_offer', {
            p_user_id: '00000000-0000-0000-0000-000000000000',
            p_item_id: 'oil',
            p_quantity: 1,
            p_price: 1,
            p_region_id: 'IT-RM',
            p_tax_rate: 10,
            p_origin_state_id: 'IT'
        });
        console.log('Call error (checking existence):', callError);
    } else {
        console.log('Function definition:', func);
    }
}

checkFunction();
