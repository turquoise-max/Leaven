import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixRoutines() {
  console.log('Updating tasks: setting is_routine = true where is_template = true and user_id is null...');
  
  const { data, error } = await supabase
    .from('tasks')
    .update({ is_routine: true })
    .eq('is_template', true)
    .is('user_id', null)
    .select('id, title');

  if (error) {
    console.error('Error updating tasks:', error);
  } else {
    console.log(`Successfully updated ${data.length} tasks to be routines.`);
    data.forEach(t => console.log(`- ${t.title} (${t.id})`));
  }
}

fixRoutines();