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
  const ownerName = formData.get('owner_name') as string
  const storePhone = formData.get('store_phone') as string
  const zipCode = formData.get('zip_code') as string
  const addressDetail = formData.get('address_detail') as string
  const imageUrl = formData.get('image_url') as string
  const stampImageUrl = formData.get('stamp_image_url') as string
  const leaveCalcType = formData.get('leave_calc_type') as string
  
  const latitude = formData.get('latitude') ? parseFloat(formData.get('latitude') as string) : null
  const longitude = formData.get('longitude') ? parseFloat(formData.get('longitude') as string) : null
  const authRadius = formData.get('auth_radius') ? parseInt(formData.get('auth_radius') as string, 10) : 200
  
  const wageStartDay = formData.get('wage_start_day') ? parseInt(formData.get('wage_start_day') as string, 10) : 1
  const wageEndDay = formData.get('wage_end_day') ? parseInt(formData.get('wage_end_day') as string, 10) : 0
  const payDay = formData.get('pay_day') ? parseInt(formData.get('pay_day') as string, 10) : 10

  let wageExceptions = {}
  try {
    const exceptionsStr = formData.get('wage_exceptions') as string
    if (exceptionsStr) {
      wageExceptions = JSON.parse(exceptionsStr)
    }
  } catch (e) {
    console.error('Error parsing wage exceptions:', e)
  }

  let openingHours = {}
  try {
    const openingHoursStr = formData.get('opening_hours') as string
    if (openingHoursStr) {
      openingHours = JSON.parse(openingHoursStr)
    }
  } catch (e) {
    console.error('Error parsing opening hours:', e)
  }

  const { error } = await supabase
    .from('stores')
    .update({
      name,
      address,
      business_number: businessNumber,
      description,
      owner_name: ownerName,
      store_phone: storePhone,
      zip_code: zipCode,
      address_detail: addressDetail,
      opening_hours: openingHours,
      image_url: imageUrl,
      stamp_image_url: stampImageUrl,
      latitude,
      longitude,
      auth_radius: authRadius,
      wage_start_day: wageStartDay,
      wage_end_day: wageEndDay,
      pay_day: payDay,
      wage_exceptions: wageExceptions,
      leave_calc_type: leaveCalcType,
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

export async function getStoreRoles(storeId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('store_roles')
    .select('*')
    .eq('store_id', storeId)
    .order('priority', { ascending: true })

  if (error) {
    console.error('Error fetching store roles:', error)
    return []
  }

  return data
}

export async function getStoreSettings(storeId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('stores')
    .select('wage_start_day, wage_end_day, pay_day, wage_exceptions, leave_calc_type')
    .eq('id', storeId)
    .single()
    
  if (error) {
    console.error('Error fetching store settings:', error)
    return null
  }
  
  return data
}
