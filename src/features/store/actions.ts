'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function setCurrentStore(storeId: string) {
  const cookieStore = await cookies()
  cookieStore.set('leaven_current_store_id', storeId)
  revalidatePath('/dashboard')
}

export async function updateStore(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // 사용자의 매장 ID 조회
  const { data: member } = await supabase
    .from('store_members')
    .select('store_id, role')
    .eq('user_id', user.id)
    .single()

  if (!member || member.role !== 'owner') {
    return { error: 'Permission denied' }
  }

  const storeId = member.store_id
  const name = formData.get('name') as string
  const address = formData.get('address') as string
  const businessNumber = formData.get('business_number') as string
  const description = formData.get('description') as string

  const { error } = await supabase
    .from('stores')
    .update({
      name,
      address,
      business_number: businessNumber,
      description,
      updated_at: new Date().toISOString(),
    })
    .eq('id', storeId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/settings')
  return { success: true }
}

export async function getUserStores() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  const { data: stores, error } = await supabase
    .from('store_members')
    .select(`
      role,
      status,
      store:stores (
        id,
        name,
        address
      )
    `)
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })

  if (error) {
    console.error('Error fetching stores:', error)
    return []
  }

  if (!stores) return []

  return stores.map(member => ({
    ...member,
    store: Array.isArray(member.store) ? member.store[0] : member.store
  }))
}

export async function deleteStore(storeId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  // RPC 호출하여 매장 삭제 (권한 체크는 RPC 내부에서 수행)
  const { error } = await supabase.rpc('delete_store', {
    store_id_param: storeId
  })

  if (error) {
    console.error('Error deleting store:', error)
    return { error: error.message }
  }

  // 현재 선택된 매장 쿠키 삭제
  const cookieStore = await cookies()
  cookieStore.delete('leaven_current_store_id')

  revalidatePath('/dashboard')
  return { success: true }
}
