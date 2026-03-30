const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
    const { data: columns, error } = await supabase.rpc('get_table_columns', { table_name: 'market_offers' });
    if (error) {
        // Fallback to direct query if RPC doesn't exist
        const { data: cols, error: err } = await supabase.from('information_schema.columns')
            .select('column_name')
            .eq('table_name', 'market_offers')
            .eq('table_schema', 'public');
        
        if (err) {
            console.error('Error fetching columns:', err);
        } else {
            console.log('Columns for market_offers:', cols.map(c => c.column_name));
        }
    } else {
        console.log('Columns for market_offers (from RPC):', columns);
    }
}

checkColumns();
