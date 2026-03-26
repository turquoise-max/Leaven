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
      member:store_members!inner(id, name, role, user_id, profile:profiles(full_name))
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

  // [아키텍트 결정] RLS 정책 충돌을 피해 안전한 트랜잭션을 보장하기 위해 RPC를 통해 승인/반려를 처리합니다.
  const { data, error } = await supabase.rpc('resolve_leave_request_v1', {
    p_request_id: requestId,
    p_user_id: user.id,
    p_store_id: storeId,
    p_status: status
  })

  if (error) {
    console.error('RPC Error resolving leave request:', error)
    return { error: '요청 상태 변경 중 오류가 발생했습니다.' }
  }

  if (data?.error) {
    return { error: data.error }
  }

  // [기획자 핵심 로직] 물리적 동기화 최소화 및 렌더링 기반 동기화로 전환
  // 스케줄 테이블의 데이터를 직접 수정하는 대신, revalidate를 통해 최신 휴가 SSOT를 반영하게 합니다.
  revalidatePath('/dashboard/leave')
  revalidatePath('/dashboard/schedule')
  return { success: true }
}

export async function revokeLeaveRequest(requestId: string, storeId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: '인증되지 않은 사용자입니다.' }

  try {
    await requirePermission(user.id, storeId, 'manage_schedule')
  } catch {
    return { error: '요청을 처리할 권한이 없습니다.' }
  }

  // 승인 취소 및 연차 복구 RPC 호출
  const { data, error } = await supabase.rpc('revoke_leave_request_v1', {
    p_request_id: requestId,
    p_user_id: user.id,
    p_store_id: storeId
  })

  if (error) {
    console.error('RPC Error revoking leave request:', error)
    return { error: '승인 취소 중 오류가 발생했습니다.' }
  }

  if (data?.error) {
    return { error: data.error }
  }

  revalidatePath('/dashboard/leave')
  revalidatePath('/dashboard/schedule')
  return { success: true }
}

export async function cancelLeaveRequest(requestId: string, storeId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: '인증되지 않은 사용자입니다.' }

  // [아키텍트 결정] RLS 권한 문제를 근본적으로 해결하기 위해 DB RPC(PostgreSQL Function) 호출 방식으로 전환
  // 이 방식은 원자적 트랜잭션을 보장하며, 복잡한 RLS 정책 우회 없이 안전하게 비즈니스 로직을 처리합니다.
  const { data, error } = await supabase.rpc('cancel_leave_request_v1', {
    p_request_id: requestId,
    p_user_id: user.id,
    p_store_id: storeId
  })

  if (error) {
    console.error('RPC Error cancelling leave request:', error)
    return { error: '휴가 취소 중 오류가 발생했습니다.' }
  }

  if (data?.error) {
    return { error: data.error }
  }

  // [기획자 핵심 로직] 스케줄 테이블을 직접 수정하지 않고 Path Revalidation만 수행
  // 렌더링 시점에 leave_requests의 상태를 대조하므로 SSOT(Single Source of Truth)가 유지됩니다.
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
