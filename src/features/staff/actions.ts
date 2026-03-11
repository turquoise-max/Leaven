'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/features/auth/permissions'

// 직원 목록 조회 (역할 정보 포함)
export async function getStaffList(storeId: string) {
  const supabase = await createClient()

  // 1. 직원 목록 조회 (역할 정보 포함)
  const { data, error } = await supabase
    .from('store_members')
    .select(`
      *,
      profile:profiles(full_name, email, avatar_url),
      role_info:store_roles(id, name, color, priority, is_system)
    `)
    .eq('store_id', storeId)
    
  if (error) {
    console.error('Error fetching staff list:', error)
    return []
  }
  
  // 데이터 가공 및 정렬
  const staffList = data.map(member => ({
    ...member,
    profile: Array.isArray(member.profile) ? member.profile[0] : member.profile,
    role_info: Array.isArray(member.role_info) ? member.role_info[0] : member.role_info
  })).sort((a, b) => {
    // 1. Priority (Descending)
    const priorityA = a.role_info?.priority ?? -1
    const priorityB = b.role_info?.priority ?? -1
    if (priorityA !== priorityB) return priorityB - priorityA
    
    // 2. Name (Ascending)
    const nameA = a.profile?.full_name || a.name || ''
    const nameB = b.profile?.full_name || b.name || ''
    return nameA.localeCompare(nameB)
  })

  return staffList
}

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
  const roleId = formData.get('roleId') as string // roleId 추가
  
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
  // roleId가 없으면 staff 역할 찾아서 넣어야 함 (기본값)
  let targetRoleId = roleId
  let targetRoleName = 'staff' // Legacy fallback
  
  if (!targetRoleId) {
    const { data: defaultRole } = await supabase
      .from('store_roles')
      .select('id, name')
      .eq('store_id', storeId)
      .eq('name', '직원') // 기본 역할 이름 가정
      .single()
      
    if (defaultRole) {
      targetRoleId = defaultRole.id
      // targetRoleName = defaultRole.name // DB에는 role 컬럼이 ENUM일 수 있으므로 주의. role 컬럼은 legacy.
    }
  }

  const { error } = await supabase.from('store_members').insert({
    store_id: storeId,
    user_id: profile.id,
    role: 'staff', // Legacy column - keep as 'staff' for now or handle correctly
    role_id: targetRoleId || null,
    status: 'invited',
    joined_at: new Date().toISOString(),
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/staff')
  revalidatePath('/dashboard', 'layout')
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
  const roleId = formData.get('roleId') as string // roleId 사용
  const employmentType = formData.get('employmentType') as string || 'parttime'
  const wageType = formData.get('wageType') as string || 'hourly'
  const baseWage = parseInt(formData.get('baseWage') as string || '0')
  const workHours = formData.get('workHours') as string
  const hiredAt = formData.get('hiredAt') as string
  const memo = formData.get('memo') as string
  const workSchedulesJson = formData.get('workSchedules') as string

  // New Contract Fields
  const address = formData.get('address') as string
  const birthDate = formData.get('birthDate') as string
  const emergencyContact = formData.get('emergencyContact') as string
  const customPayDayStr = formData.get('customPayDay') as string
  const customPayDay = customPayDayStr ? parseInt(customPayDayStr) : null
  const weeklyHolidayStr = formData.get('weeklyHoliday') as string
  const weeklyHoliday = weeklyHolidayStr && weeklyHolidayStr !== 'null' ? parseInt(weeklyHolidayStr) : null
  const contractEndDate = formData.get('contractEndDate') as string
  const insuranceStatusJson = formData.get('insuranceStatus') as string
  const customWageSettingsJson = formData.get('customWageSettings') as string
  
  let workSchedules = []
  try {
    if (workSchedulesJson) {
      workSchedules = JSON.parse(workSchedulesJson)
    }
  } catch (e) {
    console.error('Failed to parse workSchedules:', e)
  }

  let insuranceStatus = { employment: false, industrial: false, national: false, health: false }
  try {
    if (insuranceStatusJson) {
      insuranceStatus = JSON.parse(insuranceStatusJson)
    }
  } catch (e) {
    console.error('Failed to parse insuranceStatus:', e)
  }

  let customWageSettings = null
  try {
    if (customWageSettingsJson) {
      customWageSettings = JSON.parse(customWageSettingsJson)
    }
  } catch (e) {
    console.error('Failed to parse customWageSettings:', e)
  }

  if (!name) return { error: '이름을 입력해주세요.' }

  // 3. 수기 등록 (user_id는 null)
  const { error } = await supabase.from('store_members').insert({
    store_id: storeId,
    user_id: null,
    role: 'staff', // Legacy
    role_id: roleId || null,
    status: 'invited', // 수기 등록은 합류 대기 탭에 표시되도록 invited로 설정
    name,
    email: email || null,
    phone: phone || null,
    memo: memo || null,
    employment_type: employmentType as any,
    wage_type: wageType as any,
    base_wage: baseWage,
    work_hours: workHours || null,
    hired_at: hiredAt || null,
    work_schedules: workSchedules,
    joined_at: new Date().toISOString(),
    
    // New fields
    address: address || null,
    birth_date: birthDate || null,
    emergency_contact: emergencyContact || null,
    custom_pay_day: customPayDay,
    weekly_holiday: weeklyHoliday,
    contract_end_date: contractEndDate || null,
    insurance_status: insuranceStatus,
    custom_wage_settings: customWageSettings,
  })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/staff')
  revalidatePath('/dashboard', 'layout')
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
  const roleId = formData.get('roleId') as string // roleId 사용
  const employmentType = formData.get('employmentType') as string
  const wageType = formData.get('wageType') as string
  const baseWage = parseInt(formData.get('baseWage') as string || '0')
  const phone = formData.get('phone') as string
  const workHours = formData.get('workHours') as string
  const hiredAt = formData.get('hiredAt') as string
  const memo = formData.get('memo') as string
  const workSchedulesJson = formData.get('workSchedules') as string

  // New Contract Fields
  const address = formData.get('address') as string
  const birthDate = formData.get('birthDate') as string
  const emergencyContact = formData.get('emergencyContact') as string
  const customPayDayStr = formData.get('customPayDay') as string
  const customPayDay = customPayDayStr ? parseInt(customPayDayStr) : null
  const weeklyHolidayStr = formData.get('weeklyHoliday') as string
  const weeklyHoliday = weeklyHolidayStr && weeklyHolidayStr !== 'null' ? parseInt(weeklyHolidayStr) : null
  const contractEndDate = formData.get('contractEndDate') as string
  const insuranceStatusJson = formData.get('insuranceStatus') as string
  const customWageSettingsJson = formData.get('customWageSettings') as string
  
  let workSchedules = []
  try {
    if (workSchedulesJson) {
      workSchedules = JSON.parse(workSchedulesJson)
    }
  } catch (e) {
    console.error('Failed to parse workSchedules:', e)
  }

  let insuranceStatus = { employment: false, industrial: false, national: false, health: false }
  try {
    if (insuranceStatusJson) {
      insuranceStatus = JSON.parse(insuranceStatusJson)
    }
  } catch (e) {
    console.error('Failed to parse insuranceStatus:', e)
  }

  let customWageSettings = null
  try {
    if (customWageSettingsJson) {
      customWageSettings = JSON.parse(customWageSettingsJson)
    }
  } catch (e) {
    console.error('Failed to parse customWageSettings:', e)
  }

  // 추가: 대상 멤버가 점주인지 확인 (점주 역할 변경 불가)
  const { data: targetMember } = await supabase
    .from('store_members')
    .select('role, role_id, role_info:store_roles(is_system, name)') // role_info 조인
    .eq('id', targetMemberId)
    .single()
  
  // 점주는 역할 변경 불가 (항상 owner 유지)
  // role_info가 배열일 수 있으므로 처리 필요
  const roleInfo = Array.isArray(targetMember?.role_info) ? targetMember?.role_info[0] : targetMember?.role_info
  
  // role 컬럼이 'owner'이거나, system role 이름이 '점주'인 경우 등
  let newRoleId = roleId
  if (targetMember?.role === 'owner') {
    // 점주는 역할 변경 불가 -> 기존 role_id 유지
    newRoleId = targetMember.role_id
  }

  // 3. 업데이트 실행
  const { data, error } = await supabase
    .from('store_members')
    .update({
      role_id: newRoleId,
      // role: ... // Legacy role update logic needed if we want to sync
      employment_type: employmentType as any,
      wage_type: wageType as any,
      base_wage: baseWage,
      work_hours: workHours || null,
      hired_at: hiredAt || null, // 이미 YYYY-MM-DD 형식이므로 그대로 저장
      phone: phone || null,
      name: name || null,
      email: email || null,
      memo: memo || null,
      work_schedules: workSchedules,
      
      // New fields
      address: address || null,
      birth_date: birthDate || null,
      emergency_contact: emergencyContact || null,
      custom_pay_day: customPayDay,
      weekly_holiday: weeklyHoliday,
      contract_end_date: contractEndDate || null,
      insurance_status: insuranceStatus,
      custom_wage_settings: customWageSettings,
    })
    .eq('id', targetMemberId) // user_id 대신 member id(pk) 사용 권장 (수기 등록 직원은 user_id가 없으므로)
    .eq('store_id', storeId)
    .select()
    .single()

  if (error) {
    console.error('Update staff error:', error)
    return { error: error.message }
  }

  revalidatePath('/dashboard/staff')
  revalidatePath('/dashboard', 'layout') // 사이드바 데이터 갱신
  return { success: true, data }
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

  // 삭제(delete) 대신 퇴사일(resigned_at) 업데이트로 기록 보존 (Soft Delete)
  const { error } = await supabase
    .from('store_members')
    .update({ resigned_at: new Date().toISOString() })
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