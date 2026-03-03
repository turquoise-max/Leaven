'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/features/auth/permissions'

export async function inviteStaff(storeId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  // 1. 권한 체크
  try {
    await requirePermission(user.id, storeId, 'manage_staff')
  } catch (error) {
    return { error: '권한이 없습니다.' }
  }

  const email = formData.get('email') as string
  if (!email) {
    return { error: '이메일을 입력해주세요.' }
  }

  // 2. 이메일로 사용자 조회 (profiles 테이블)
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (!profile) {
    return { error: '해당 이메일로 가입된 사용자를 찾을 수 없습니다.' }
  }

  // 3. 이미 멤버인지 확인
  const { data: existingMember } = await supabase
    .from('store_members')
    .select('id')
    .eq('store_id', storeId)
    .eq('user_id', profile.id)
    .single()

  if (existingMember) {
    return { error: '이미 매장에 등록된 직원입니다.' }
  }

  // 4. 멤버 추가 (초대 상태)
  const { error } = await supabase.from('store_members').insert({
    store_id: storeId,
    user_id: profile.id,
    role: 'staff',
    status: 'invited',
    joined_at: new Date().toISOString(),
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/staff')
  return { success: true }
}

export async function createManualStaff(storeId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  // 1. 권한 체크
  try {
    await requirePermission(user.id, storeId, 'manage_staff')
  } catch (error) {
    return { error: '권한이 없습니다.' }
  }

  // 2. 데이터 추출
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const phone = formData.get('phone') as string
  const role = formData.get('role') as string || 'staff'
  const wageType = formData.get('wageType') as string || 'hourly'
  const baseWage = parseInt(formData.get('baseWage') as string || '0')

  if (!name) return { error: '이름을 입력해주세요.' }

  // 3. 수기 등록 (user_id는 null)
  const { error } = await supabase.from('store_members').insert({
    store_id: storeId,
    user_id: null,
    role: role as any,
    status: 'active', // 수기 등록은 바로 활동 상태
    name,
    email: email || null,
    phone: phone || null,
    wage_type: wageType as any,
    base_wage: baseWage,
    joined_at: new Date().toISOString(),
  })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/staff')
  return { success: true }
}

export async function updateStaffInfo(storeId: string, targetMemberId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  // 1. 권한 체크
  try {
    await requirePermission(user.id, storeId, 'manage_staff')
  } catch (error) {
    return { error: '권한이 없습니다.' }
  }

  // 2. 정보 추출
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const role = formData.get('role') as string
  const wageType = formData.get('wageType') as string
  const baseWage = parseInt(formData.get('baseWage') as string || '0')
  const phone = formData.get('phone') as string

  // 추가: 대상 멤버가 점주인지 확인
  const { data: targetMember } = await supabase
    .from('store_members')
    .select('role')
    .eq('id', targetMemberId)
    .single()
  
  // 점주는 역할 변경 불가 (항상 owner 유지)
  let newRole = role
  if (targetMember?.role === 'owner') {
    newRole = 'owner'
  }

  // 3. 업데이트 실행
  const { error } = await supabase
    .from('store_members')
    .update({
      role: newRole as any,
      wage_type: wageType as any,
      base_wage: baseWage,
      phone: phone || null,
      name: name || null,
      email: email || null,
    })
    .eq('id', targetMemberId) // user_id 대신 member id(pk) 사용 권장 (수기 등록 직원은 user_id가 없으므로)
    .eq('store_id', storeId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/staff')
  revalidatePath('/dashboard', 'layout') // 사이드바 데이터 갱신
  return { success: true }
}

export async function approveRequest(storeId: string, memberId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  try {
    await requirePermission(user.id, storeId, 'manage_staff')
  } catch (error) {
    return { error: '권한이 없습니다.' }
  }

  const { error } = await supabase
    .from('store_members')
    .update({ status: 'active' })
    .eq('id', memberId)
    .eq('store_id', storeId)
    .eq('status', 'pending_approval')

  if (error) return { error: error.message }

  revalidatePath('/dashboard/staff')
  revalidatePath('/dashboard', 'layout') // 대시보드 알림 및 사이드바 갱신
  return { success: true }
}

export async function rejectRequest(storeId: string, memberId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  try {
    await requirePermission(user.id, storeId, 'manage_staff')
  } catch (error) {
    return { error: '권한이 없습니다.' }
  }

  const { error } = await supabase
    .from('store_members')
    .delete()
    .eq('id', memberId)
    .eq('store_id', storeId)
    .eq('status', 'pending_approval')

  if (error) return { error: error.message }

  revalidatePath('/dashboard/staff')
  revalidatePath('/dashboard', 'layout') // 대시보드 알림 및 사이드바 갱신
  return { success: true }
}

export async function removeStaff(storeId: string, memberId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  try {
    await requirePermission(user.id, storeId, 'manage_staff')
  } catch (error) {
    return { error: '권한이 없습니다.' }
  }

  const { error } = await supabase
    .from('store_members')
    .delete()
    .eq('id', memberId)
    .eq('store_id', storeId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/staff')
  revalidatePath('/dashboard', 'layout') // 사이드바 데이터 갱신
  return { success: true }
}

export async function getPendingRequestsCount(storeId: string) {
  const supabase = await createClient()
  
  const { count, error } = await supabase
    .from('store_members')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .eq('status', 'pending_approval')

  if (error) return 0
  return count || 0
}