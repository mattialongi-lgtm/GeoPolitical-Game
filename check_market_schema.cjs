const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    const { data: offers, error } = await supabase.from('market_offers').select('*').limit(1);
    if (error) {
        console.error('Error fetching market_offers:', error);
    } else {
        console.log('market_offers sample:', offers[0]);
    }

    const { data: inv, error: invError } = await supabase.from('user_inventory').select('*').limit(1);
    if (invError) {
        console.error('Error fetching user_inventory:', invError);
    } else {
        console.log('user_inventory sample:', inv[0]);
    }
}

checkSchema();
