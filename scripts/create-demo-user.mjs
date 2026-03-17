import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Load .env.local manually since we're running a standalone script without dotenv
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '../.env.local')
const envFile = fs.readFileSync(envPath, 'utf8')

envFile.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) {
    process.env[match[1].trim()] = match[2].trim()
  }
})

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase URL or Service Role Key in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createDemoAdmin() {
  console.log('Creating demo admin user...')
  
  const email = 'admin@leaven.com'
  const password = 'password123!'
  
  // 1. Check if user already exists
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
  
  if (listError) {
    console.error('Failed to list users:', listError)
    return
  }
  
  const existingUser = users.find(u => u.email === email)
  
  if (existingUser) {
    console.log(`User ${email} already exists. Updating password and confirming email...`)
    
    const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
      password: password,
      email_confirm: true,
      user_metadata: { full_name: '시연용 관리자' }
    })
    
    if (updateError) {
      console.error('Failed to update user:', updateError)
    } else {
      console.log('Successfully updated demo admin account!')
      console.log(`Email: ${email}`)
      console.log(`Password: ${password}`)
    }
    return
  }

  // 2. Create new user with email_confirm: true
  const { data, error } = await supabase.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true,
    user_metadata: { full_name: '시연용 관리자' }
  })

  if (error) {
    console.error('Error creating user:', error)
  } else {
    console.log('Successfully created demo admin account!')
    console.log(`Email: ${email}`)
    console.log(`Password: ${password}`)
  }
}

createDemoAdmin()