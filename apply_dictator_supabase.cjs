const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

const CORRECT_USER_ID = '8d6b20c0-6b51-4d17-81d3-02b45d971eb1';

async function applyDictatorship() {
    console.log(`Setting user ${CORRECT_USER_ID} as Dictator of Italy in Supabase...`);
    
    const { data, error } = await supabase
        .from('regions')
        .update({
            governmentForm: 'DICTATORSHIP',
            dictatorship: 1,
            leaderUserId: CORRECT_USER_ID,
            leaderTitle: 'Dittatore'
        })
        .eq('id', 'IT');

    if (error) {
        console.error('Error updating region:', error);
        return;
    }

    console.log('Update successful!');
    
    // Verify
    const { data: region, error: rError } = await supabase
        .from('regions')
        .select('*')
        .eq('id', 'IT')
        .single();
        
    if (rError) {
        console.error('Error verifying update:', rError);
    } else {
        console.log('Verified state:', JSON.stringify(region, null, 2));
    }
}

applyDictatorship();
