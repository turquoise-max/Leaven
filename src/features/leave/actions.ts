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

  // 4. Create block schedules automatically based on the leave dates
  if (status === 'approved') {
    // Generate dates between start_date and end_date
    const start = new Date(`${request.start_date}T00:00:00Z`)
    const end = new Date(`${request.end_date}T00:00:00Z`)
    
    let current = new Date(start)
    while (current <= end) {
      const dateStr = current.toISOString().substring(0, 10)
      
      let title = '휴가'
      let color = '#94a3b8' // slate-400
      let startTimeStr = `${dateStr}T00:00:00Z`
      let endTimeStr = `${dateStr}T23:59:59Z`

      if (request.leave_type === 'sick') {
        title = '병가'
        color = '#ef4444' // red-500
      } else if (request.leave_type === 'annual') {
        title = '연차'
        color = '#3b82f6' // blue-500
      } else if (request.leave_type === 'half_am') {
        title = '오전 반차'
        color = '#60a5fa'
        endTimeStr = `${dateStr}T13:00:00Z` // Mocking 13:00 as end of AM half
      } else if (request.leave_type === 'half_pm') {
        title = '오후 반차'
        color = '#60a5fa'
        startTimeStr = `${dateStr}T13:00:00Z`
      }

      // Check if there's already a schedule for this person on this day
      // Wait, we just insert a new schedule and it acts as a block
      const { data: schData, error: schError } = await supabase
        .from('schedules')
        .insert({
          store_id: storeId,
          title: title,
          memo: request.reason,
          start_time: startTimeStr,
          end_time: endTimeStr,
          color: color
        })
        .select()
        .single()
        
      if (schData && !schError) {
        await supabase.from('schedule_members').insert({
          schedule_id: schData.id,
          member_id: request.member_id
        })
      }
      
      current.setUTCDate(current.getUTCDate() + 1)
    }
  }

  revalidatePath('/dashboard/leave')
  revalidatePath('/dashboard/schedule')
  return { success: true }
}

export async function updateLeaveBalance(balanceId: string, storeId: string, totalDays: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: '인증되지 않은 사용자입니다.' }

  try {
    await requirePermission(user.id, storeId, 'manage_schedule')
  } catch {
    return { error: '잔여 연차를 수정할 권한이 없습니다.' }
  }
  
  const { error } = await supabase
    .from('leave_balances')
    .update({ total_days: totalDays, updated_at: new Date().toISOString() })
    .eq('id', balanceId)
    
  if (error) return { error: '연차 정보 수정 실패' }
  
  revalidatePath('/dashboard/leave')
  return { success: true }
}