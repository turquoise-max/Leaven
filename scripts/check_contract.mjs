import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://deuefdqcvunbxfflpixx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRldWVmZHFjdnVuYnhmZmxwaXh4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjA4MDM1NSwiZXhwIjoyMDg3NjU2MzU1fQ.9CmdNjCKjpHFPeck8YYRup37_FW8DcKA3ERqRbyzOQI'
)

async function main() {
  const { data, error } = await supabase
    .from('store_members')
    .select('id, user_id, store_id, contract_status, modusign_document_id, contract_file_url')
    
  if (error) {
    console.error(error)
    return
  }
  
  console.log('Contract Status of all members:')
  console.table(data)
}

main()
