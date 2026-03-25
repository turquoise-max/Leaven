'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { unstable_noStore as noStore } from 'next/cache'
import { requirePermission } from '@/features/auth/permissions'

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
  reason: string
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

  // If approved, deduct balance if it is an annual leave
  if (status === 'approved' && request.leave_type === 'annual') {
    const year = parseInt(request.start_date.substring(0, 4))
    
    // Check if balance exists
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
          used_days: Number(balance.used_days) + Number(request.requested_days)
        })
        .eq('id', balance.id)
    } else {
      // Create new balance record with just used_days
      await supabase
        .from('leave_balances')
        .insert({
          store_id: storeId,
          member_id: request.member_id,
          year: year,
          used_days: request.requested_days,
          total_days: 0 // Manager must set total days manually later
        })
    }
  }

  // 승인 완료된 휴가를 기존 근무 스케줄의 `type`으로 덮어쓰기 로직
  if (status === 'approved') {
    const startIso = new Date(`${request.start_date}T00:00:00Z`).toISOString()
    const endIso = new Date(`${request.end_date}T23:59:59Z`).toISOString()

    // 1. 해당 날짜, 해당 직원이 포함된 스케줄 찾기
    const { data: existingSchedules } = await supabase
      .from('schedules')
      .select('id, schedule_members!inner(member_id)')
      .eq('store_id', storeId)
      .eq('schedule_members.member_id', request.member_id)
      .gte('start_time', startIso)
      .lt('start_time', endIso)

    if (existingSchedules && existingSchedules.length > 0) {
      // 2-1. 기존 스케줄이 있다면 본래 데이터(color, title 등)는 건드리지 않고 오직 schedule_type만 'leave'로 변경
      const scheduleIds = existingSchedules.map(s => s.id)
      await supabase
        .from('schedules')
        .update({
          schedule_type: 'leave',
          memo: `[휴가 사유] ${request.reason || '없음'}`
        })
        .in('id', scheduleIds)
    } else {
      // 2-2. 기존 스케줄이 없다면 빈 스케줄을 만들고 schedule_type을 'leave'로 설정
      const { data: schData, error: schError } = await supabase
        .from('schedules')
        .insert({
          store_id: storeId,
          title: '근무', // 프론트엔드가 알아서 휴가로 렌더링함
          memo: `[휴가 사유] ${request.reason || '없음'}`,
          start_time: startIso,
          end_time: endIso,
          color: null,
          schedule_type: 'leave'
        })
        .select()
        .single()
        
      if (schData && !schError) {
        await supabase.from('schedule_members').insert({
          schedule_id: schData.id,
          member_id: request.member_id
        })
      }
    }
  }

  revalidatePath('/dashboard/leave')
  revalidatePath('/dashboard/schedule')
  return { success: true }
}

// 새로운 액션 추가: 이미 승인 완료된 휴가를 취소/원복(Rollback)하는 기능
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

  if (request.status !== 'approved') return { error: '승인 완료된 휴가만 취소할 수 있습니다.' }

  // 2. Update status to 'cancelled'
  const { error: finalError } = await supabase
    .from('leave_requests')
    .update({
      status: 'cancelled', // 커스텀 상태 추가 (또는 rejected 활용)
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', requestId)

  if (finalError) return { error: '승인 취소 중 오류가 발생했습니다.' }

  // 3. Rollback 연차 차감 (만약 '연차(annual)' 였다면 썼던 연차 일수만큼 다시 돌려줌)
  if (request.leave_type === 'annual') {
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
          // 썼던 일수만큼 다시 빼서 원상복구
          used_days: Math.max(0, Number(balance.used_days) - Number(request.requested_days))
        })
        .eq('id', balance.id)
    }
  }

  // 4. 스케줄을 다시 정규 근무(regular)로 원복
  const startIso = new Date(`${request.start_date}T00:00:00Z`).toISOString()
  const endIso = new Date(`${request.end_date}T23:59:59Z`).toISOString()

  // 휴가 취소 시 해당 직원의 해당 날짜에 'leave' 타입으로 변경되었던 스케줄 찾기
  const { data: existingSchedules } = await supabase
    .from('schedules')
    .select('id, schedule_members!inner(member_id)')
    .eq('store_id', storeId)
    .eq('schedule_type', 'leave') // 휴가로 바뀐 것들만
    .eq('schedule_members.member_id', request.member_id)
    .gte('start_time', startIso)
    .lt('start_time', endIso)

  if (existingSchedules && existingSchedules.length > 0) {
    const scheduleIds = existingSchedules.map(s => s.id)
    // 다시 일반 정규 근무로 변경 (프론트 렌더링 로직에 의해 원래의 색상과 타이틀이 복구된 것처럼 보임)
    await supabase
      .from('schedules')
      .update({
        schedule_type: 'regular',
        memo: null // 휴가 사유 메모 초기화
      })
      .in('id', scheduleIds)
  }

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
