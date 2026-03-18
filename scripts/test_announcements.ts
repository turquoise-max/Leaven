import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy'

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase
    .from('store_announcements')
    .select(`
      *,
      author:author_id (
        id,
        user_metadata
      )
    `)
    .limit(1)

  if (error) {
    console.error('Error:', error)
  } else {
    console.log('Data:', data)
  }
}

run()