import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase URL or Service Key')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function debug() {
  const targetEmail = 'mustjaeui1103@gmail.com'
  
  // 1. Find user in auth.users (via admin API)
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers()
  if (usersError) {
    console.error('Failed to fetch users:', usersError)
    return
  }
  
  const user = usersData.users.find(u => u.email === targetEmail)
  if (!user) {
    console.log(`User with email ${targetEmail} not found in auth.users`)
    return
  }
  
  console.log('--- USER INFO ---')
  console.log(`ID: ${user.id}`)
  console.log(`Email: ${user.email}`)
  console.log(`Created: ${user.created_at}`)
  
  // 2. Find store_members by user_id
  const { data: membersByUserId, error: memError1 } = await supabase
    .from('store_members')
    .select('*, store:stores(name)')
    .eq('user_id', user.id)
    
  console.log('\n--- STORE MEMBERS (By User ID) ---')
  console.log(JSON.stringify(membersByUserId, null, 2))
  
  // 3. Find store_members by email
  const { data: membersByEmail, error: memError2 } = await supabase
    .from('store_members')
    .select('*, store:stores(name)')
    .eq('email', targetEmail)
    
  console.log('\n--- STORE MEMBERS (By Email) ---')
  console.log(JSON.stringify(membersByEmail, null, 2))

  // 4. Find duplicate store_members that might have the same name or something, maybe a manual entry
  // The store manager might have created an entry with an email, but it's not linked to the user_id
}

debug().catch(console.error)