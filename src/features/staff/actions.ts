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
    .neq('role', 'owner') // 점주 제외
    
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

  if (profile) {
    // 3. 가입된 사용자라면, 이미 멤버인지 확인
    const { data: existingMember } = await supabase
      .from('store_members')
      .select('id')
      .eq('store_id', storeId)
      .eq('user_id', profile.id)
      .single()

    if (existingMember) {
      return { error: '이미 매장에 등록된 직원입니다.' }
    }
  } else {
    // 가입되지 않은 이메일의 경우 이메일 중복 초대 확인
    const { data: existingInvited } = await supabase
      .from('store_members')
      .select('id')
      .eq('store_id', storeId)
      .eq('email', email)
      .single()

    if (existingInvited) {
      return { error: '이미 초대된 이메일입니다.' }
    }
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
    user_id: profile ? profile.id : null,
    email: !profile ? email : null,
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
    role_id: roleId || null, // 빈 문자열("")이면 null로 처리
    status: 'active', // 수기 등록 직원은 생성 즉시 정규 직원(재직자) 탭에 표시되도록 active로 설정
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

  // 2-1. 점주 역할(시스템 역할) 부여 제한 체크
  if (roleId) {
    const { data: targetRole } = await supabase
      .from('store_roles')
      .select('is_system, priority')
      .eq('id', roleId)
      .single()

    if (targetRole && targetRole.is_system && targetRole.priority === 100) {
      // 일반 직원을 점주로 변경하려는 시도 차단
      if (targetMember?.role !== 'owner') {
        return { error: '시스템 관리자 역할은 부여할 수 없습니다.' }
      }
    }
  }

  // 3. 업데이트 실행
  const { data, error } = await supabase
    .from('store_members')
    .update({
      role_id: newRoleId || null, // 빈 문자열("")이면 null로 처리하여 UUID syntax error 방지
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

export async function mergeManualStaff(storeId: string, pendingMemberId: string, manualMemberId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  try {
    await requirePermission(user.id, storeId, 'manage_staff')
  } catch (error) {
    return { error: '권한이 없습니다.' }
  }

  // 1. 가져오기: 가입 요청 정보 (pending_approval)
  const { data: pendingMember, error: pError } = await supabase
    .from('store_members')
    .select('user_id, email, name, phone, joined_at')
    .eq('id', pendingMemberId)
    .eq('store_id', storeId)
    .eq('status', 'pending_approval')
    .single()

  if (pError || !pendingMember) return { error: '가입 요청 정보를 찾을 수 없습니다.' }
  if (!pendingMember.user_id) return { error: '매핑할 수 없는 가입 요청입니다 (user_id 없음).' }

  // 2. 수기 등록(가계정) 레코드에 정보 병합 후 활성화(active)
  // user_id 업데이트, email/name/phone 업데이트(필요하다면), status를 active로 변경
  const { error: updateError } = await supabase
    .from('store_members')
    .update({
      user_id: pendingMember.user_id,
      email: pendingMember.email,
      // name: pendingMember.name || name, // 수기 등록 이름 유지 또는 가입자 이름으로 덮어쓰기 선택 (가입자 이름 덮어쓰기)
      // phone: pendingMember.phone || phone,
      status: 'active',
      joined_at: pendingMember.joined_at // 가입 요청한 날짜로 조인일 변경 (또는 수기 등록일 유지)
    })
    .eq('id', manualMemberId)
    .eq('store_id', storeId)
    .is('user_id', null) // 아직 매핑되지 않은 계정이어야 함

  if (updateError) return { error: updateError.message }

  // 3. 기존의 가입 요청(pending_approval) 레코드 삭제
  const { error: deleteError } = await supabase
    .from('store_members')
    .delete()
    .eq('id', pendingMemberId)
    .eq('store_id', storeId)

  if (deleteError) return { error: deleteError.message }

  revalidatePath('/dashboard/staff')
  revalidatePath('/dashboard', 'layout')
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
    .in('status', ['pending_approval', 'invited'])

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
    .in('status', ['pending_approval', 'invited'])

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

  // 1. Get current info to save as snapshot
  const { data: member } = await supabase
    .from('store_members')
    .select(`
      user_id,
      role, 
      name, email, phone, 
      role_info:store_roles(name),
      details
    `)
    .eq('id', memberId)
    .eq('store_id', storeId)
    .single()

  const roleInfo = Array.isArray(member?.role_info) ? member?.role_info[0] : member?.role_info
  
  // 프로필 정보 확실하게 가져오기 (조인 에러 방지)
  let profileInfo = null
  if (member?.user_id) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('full_name, email, phone')
      .eq('id', member.user_id)
      .single()
    if (prof) profileInfo = prof
  }
  
  const lastRoleName = roleInfo?.name || (member?.role === 'owner' ? '점주' : member?.role === 'manager' ? '매니저' : '알 수 없는 역할')
  
  // 우선순위: 1. 기존 store_members 컬럼 값 (수기 등록 또는 이미 박제된 값) 2. profiles 테이블 값 3. 기본값
  const snapshotName = member?.name || profileInfo?.full_name || '이름 없음'
  const snapshotEmail = member?.email || profileInfo?.email || ''
  const snapshotPhone = member?.phone || profileInfo?.phone || ''
  
  const details = member?.details || {}

  // 2. 삭제(delete) 대신 퇴사일(resigned_at) 업데이트 및 status를 'inactive'로 변경하여 기록 보존 (Soft Delete)
  // 기존 정보 유지를 위해 role_id와 user_id 연결을 끊지 않고 그대로 유지하되, 만약의 경우를 대비해 프로필 데이터를 로컬 컬럼에 스냅샷으로 박제합니다.
  const { error } = await supabase
    .from('store_members')
    .update({ 
      resigned_at: new Date().toISOString(),
      status: 'inactive',
      name: snapshotName,
      email: snapshotEmail,
      phone: snapshotPhone,
      details: { 
        ...details, 
        last_role_name: lastRoleName,
        snapshot: true 
      }
    })
    .eq('id', memberId)
    .eq('store_id', storeId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/staff')
  revalidatePath('/dashboard', 'layout') // 사이드바 데이터 갱신
  return { success: true }
}

export async function restoreStaff(storeId: string, memberId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  try {
    await requirePermission(user.id, storeId, 'manage_staff')
  } catch (error) {
    return { error: '권한이 없습니다.' }
  }

  // 복원 (상태를 active로, 퇴사일을 null로)
  const { error } = await supabase
    .from('store_members')
    .update({ 
      resigned_at: null,
      status: 'active'
    })
    .eq('id', memberId)
    .eq('store_id', storeId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/staff')
  revalidatePath('/dashboard', 'layout') 
  return { success: true }
}

export async function deleteStaffRecord(storeId: string, memberId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  try {
    await requirePermission(user.id, storeId, 'manage_staff')
  } catch (error) {
    return { error: '권한이 없습니다.' }
  }

  // 완전 삭제 (Hard Delete)
  const { error } = await supabase
    .from('store_members')
    .delete()
    .eq('id', memberId)
    .eq('store_id', storeId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/staff')
  revalidatePath('/dashboard', 'layout') 
  return { success: true }
}

export async function inviteRegisteredStaff(storeId: string, memberId: string, email: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  try {
    await requirePermission(user.id, storeId, 'manage_staff')
  } catch (error) {
    return { error: '권한이 없습니다.' }
  }

  // 1. 이메일로 사용자 조회
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (!profile) {
    return { notRegistered: true }
  }

  // 2. 이미 다른 매장 멤버로 등록되어 있는지 확인 (옵션)
  // 퇴사자('inactive' 상태)는 제외하여 재입사가 가능하도록 처리
  const { data: existingMember } = await supabase
    .from('store_members')
    .select('id')
    .eq('store_id', storeId)
    .eq('user_id', profile.id)
    .neq('id', memberId)
    .neq('status', 'inactive')
    .is('resigned_at', null)
    .single()

  if (existingMember) {
    return { error: '해당 사용자는 이미 현재 매장에서 활동 중입니다.' }
  }

  // 3. 기존 퇴사자(재입사 대상)의 레코드에서 user_id 연결 해제 (Unique 제약 조건 충돌 방지)
  // 기존 레코드는 기록용으로 남겨두고(이름/기록 유지), user_id만 null로 변경
  await supabase
    .from('store_members')
    .update({ user_id: null })
    .eq('store_id', storeId)
    .eq('user_id', profile.id)
    .eq('status', 'inactive')
    .neq('id', memberId)

  // 4. 수기 계정에 user_id 매핑 (상태는 invited 유지, 직원이 수락하면 active로 변경)
  const { error: updateError } = await supabase
    .from('store_members')
    .update({ 
      user_id: profile.id,
      email: email
    })
    .eq('id', memberId)
    .eq('store_id', storeId)

  if (updateError) return { error: updateError.message }

  revalidatePath('/dashboard/staff')
  revalidatePath('/dashboard', 'layout')
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

export async function cancelContractRequest(storeId: string, memberId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  try {
    await requirePermission(user.id, storeId, 'manage_staff')
  } catch (error) {
    return { error: '권한이 없습니다.' }
  }

  // modusign_document_id를 유지하면서 상태만 canceled로 변경하거나, 
  // 아예 null로 초기화해서 재발송 가능하게 할 수 있습니다. 재발송을 위해 null로 초기화합니다.
  const { error } = await supabase
    .from('store_members')
    .update({ 
      contract_status: null,
      modusign_document_id: null
    })
    .eq('id', memberId)
    .eq('store_id', storeId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/staff')
  revalidatePath('/dashboard', 'layout')
  return { success: true }
}
