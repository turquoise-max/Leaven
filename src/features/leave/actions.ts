'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { unstable_noStore as noStore } from 'next/cache'
import { requirePermission } from '@/features/auth/permissions'
import { toUTCISOString } from '@/shared/lib/date-utils'

export async function getLeaveBalances(storeId: string, year: number) {
  noStore()
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('leave_balances')
    .select(`
      *,
      member:store_members!inner(id, name, role, profile:profiles(full_name))
    `)
    .eq('store_id', storeId)
    .eq('year', year)
    
  if (error) {
    console.error('Error fetching leave balances:', error)
    return []
  }
  
  return data
}

export async function getLeaveRequests(storeId: string) {
  noStore()
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('leave_requests')
    .select(`
      *,
      member:store_members!inner(id, name, role, profile:profiles(full_name))
    `)
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    
  if (error) {
    console.error('Error fetching leave requests:', error)
    return []
  }
  
  return data
}

export async function createLeaveRequest(
  storeId: string,
  memberId: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  requestedDays: number,
  reason: string,
  attachmentUrl?: string
) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('leave_requests')
    .insert({
      store_id: storeId,
      member_id: memberId,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      requested_days: requestedDays,
      reason: reason,
      attachment_url: attachmentUrl,
      status: 'pending'
    })
    .select()
    .single()
    
  if (error) {
    console.error('Error creating leave request:', error)
    return { error: '휴가 신청 중 오류가 발생했습니다.' }
  }
  
  revalidatePath('/dashboard/leave')
  return { success: true, data }
}

export async function resolveLeaveRequest(requestId: string, storeId: string, status: 'approved' | 'rejected') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: '인증되지 않은 사용자입니다.' }

  try {
    await requirePermission(user.id, storeId, 'manage_schedule')
  } catch {
    return { error: '요청을 처리할 권한이 없습니다.' }
  }

  // Get request details
  const { data: request, error: reqError } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (reqError || !request) return { error: '요청 정보를 찾을 수 없습니다.' }

  if (request.status !== 'pending') return { error: '이미 처리된 요청입니다.' }

  // Update status
  const { error: finalError } = await supabase
    .from('leave_requests')
    .update({
      status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', requestId)

  if (finalError) return { error: '요청 상태 변경 중 오류가 발생했습니다.' }

  // If approved, deduct balance if it is an annual leave (including half days)
  const isAnnualType = ['annual', 'half_am', 'half_pm'].includes(request.leave_type)
  if (status === 'approved' && isAnnualType) {
    const year = parseInt(request.start_date.substring(0, 4))
    
    // Check if balance exists
    const { data: balance } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('member_id', request.member_id)
      .eq('year', year)
      .maybeSingle()
      
    if (balance) {
      const newUsedDays = Number(balance.used_days || 0) + Number(request.requested_days)
      await supabase
        .from('leave_balances')
        .update({
          used_days: newUsedDays,
          updated_at: new Date().toISOString()
        })
        .eq('id', balance.id)
    } else {
      // Create new balance record
      await supabase
        .from('leave_balances')
        .insert({
          store_id: storeId,
          member_id: request.member_id,
          year: year,
          used_days: Number(request.requested_days),
          total_days: null // Use auto-calc
        })
    }
  }

  // [기획자 핵심 로직] 물리적 동기화 최소화 및 렌더링 기반 동기화로 전환
  // 스케줄 테이블의 데이터를 직접 수정하는 대신, revalidate를 통해 최신 휴가 SSOT를 반영하게 합니다.
  
  if (status === 'approved') {
    // 필요한 경우 스케줄 테이블에 명시적 'leave' 마킹을 할 수 있으나, 
    // 이제 렌더링 시점에 leave_requests를 대조하므로 필수는 아닙니다.
  }

  revalidatePath('/dashboard/leave')
  revalidatePath('/dashboard/schedule')
  return { success: true }
}

export async function cancelLeaveRequest(requestId: string, storeId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: '인증되지 않은 사용자입니다.' }

  try {
    await requirePermission(user.id, storeId, 'manage_schedule')
  } catch {
    return { error: '요청을 처리할 권한이 없습니다.' }
  }

  // 1. Get request details
  const { data: request, error: reqError } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (reqError || !request) return { error: '요청 정보를 찾을 수 없습니다.' }

  // 2. Update status to 'rejected' (승인 취소 = 반려 처리하여 SSOT에서 제거)
  const { error: finalError } = await supabase
    .from('leave_requests')
    .update({
      status: 'rejected',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', requestId)

  if (finalError) return { error: '승인 취소 중 오류가 발생했습니다.' }

  // 3. Rollback 연차 차감
  const isAnnualType = ['annual', 'half_am', 'half_pm'].includes(request.leave_type)
  if (isAnnualType) {
    const year = parseInt(request.start_date.substring(0, 4))
    const { data: balance } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('member_id', request.member_id)
      .eq('year', year)
      .single()
      
    if (balance) {
      await supabase
        .from('leave_balances')
        .update({
          used_days: Math.max(0, Number(balance.used_days) - Number(request.requested_days))
        })
        .eq('id', balance.id)
    }
  }

  // [기획자 핵심 로직] 스케줄 테이블을 직접 수정하지 않고 Path Revalidation만 수행
  // 화면 렌더링 시점에 leave_requests의 'approved' 상태가 사라졌으므로, 
  // 스케줄은 자동으로 원래 유형(regular 등)으로 표시됩니다.

  revalidatePath('/dashboard/leave')
  revalidatePath('/dashboard/schedule')
  return { success: true }
}

export async function updateLeaveBalance(storeId: string, memberId: string, year: number, totalDays: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: '인증되지 않은 사용자입니다.' }

  try {
    await requirePermission(user.id, storeId, 'manage_schedule')
  } catch {
    return { error: '잔여 연차를 수정할 권한이 없습니다.' }
  }

  // 먼저 해당 직원의 연차 데이터가 있는지 확인
  const { data: existingBalance } = await supabase
    .from('leave_balances')
    .select('id')
    .eq('store_id', storeId)
    .eq('member_id', memberId)
    .eq('year', year)
    .maybeSingle()

  if (existingBalance) {
    // 업데이트
    const { error } = await supabase
      .from('leave_balances')
      .update({ total_days: totalDays, updated_at: new Date().toISOString() })
      .eq('id', existingBalance.id)
      
    if (error) return { error: '연차 정보 수정 실패' }
  } else {
    // 신규 생성
    const { error } = await supabase
      .from('leave_balances')
      .insert({
        store_id: storeId,
        member_id: memberId,
        year: year,
        total_days: totalDays,
        used_days: 0 // 새로 추가하는 것이므로 사용일수는 0일로 시작
      })

    if (error) return { error: '새로운 연차 정보 생성 실패' }
  }
  
  revalidatePath('/dashboard/leave')
  return { success: true }
}

export async function resetAllLeaveBalances(storeId: string, year: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: '인증되지 않은 사용자입니다.' }

  try {
    await requirePermission(user.id, storeId, 'manage_schedule')
  } catch {
    return { error: '권한이 없습니다.' }
  }

  const { error } = await supabase
    .from('leave_balances')
    .update({ 
      total_days: null, 
      updated_at: new Date().toISOString() 
    })
    .eq('store_id', storeId)
    .eq('year', year)

  if (error) {
    console.error('Error resetting leave balances:', error)
    return { error: '연차 초기화 중 오류가 발생했습니다.' }
  }

  revalidatePath('/dashboard/leave')
  return { success: true }
}
