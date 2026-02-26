'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function createStore(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  const name = formData.get('name') as string
  const address = formData.get('address') as string
  const businessNumber = formData.get('business_number') as string
  const description = formData.get('description') as string

  // Call RPC function to create store and assign owner in a single transaction
  const { error } = await supabase.rpc('create_store_with_owner', {
    name_param: name,
    description_param: description,
    address_param: address,
    business_number_param: businessNumber,
  })

  if (error) {
    console.error('Store creation error:', error)
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}