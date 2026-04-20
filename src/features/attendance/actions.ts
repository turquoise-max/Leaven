'use server' //

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { unstable_noStore as noStore } from 'next/cache'
import { getCurrentISOString } from '@/shared/lib/date-utils'
import { requirePermission } from '@/features/auth/permissions'
import { isWithinRadius } from '@/shared/lib/geo-utils'

export interface AttendanceRecord {
  id: string
  store_id: string
  member_id: string
  schedule_id: string | null
  target_date: string // YYYY-MM-DD
  clock_in_time: string | null // TIMESTAMPTZ
  clock_out_time: string | null // TIMESTAMPTZ
  break_start_time: string | null // TIMESTAMPTZ
  break_end_time: string | null // TIMESTAMPTZ
  total_break_minutes: number
  status: 'working' | 'completed' | 'absent' | 'break' // Adding 'break' as a virtual status or physical
  notes: string | null
  created_at: string
}

export async function getDailyAttendanceOverview(storeId: string, date: string, _ts?: number) {
  const supabase = await createClient()

  // 1. Get all attendances for the given date and store
  const { data: attendanceData, error: attendanceError } = await supabase
    .from('store_attendance')
    .select(`
      *,
      member:store_members(
        id,
        name,
        role,
        role_info:store_roles(name, color),
        profile:profiles(full_name)
      )
    `)
    .eq('store_id', storeId)
    .eq('target_date', date)

  if (attendanceError) {
    console.error('Error fetching attendance:', attendanceError)
  }

  // 2. Get schedules for the given date
  const { data: schedulesData, error: schedulesError } = await supabase
    .from('schedules')
    .select(`
      *,
      schedule_members(
        member_id
      )
    `)
    .eq('store_id', storeId)
    .gte('start_time', new Date(new Date(date).getTime() - 24 * 60 * 60 * 1000).toISOString())
    .lte('start_time', new Date(new Date(date).getTime() + 48 * 60 * 60 * 1000).toISOString())

  if (schedulesError) {
    console.error('Error fetching schedules:', schedulesError)
  }

  return {
    attendance: attendanceData || [],
    schedules: schedulesData || []
  }
}

export async function clockIn(
  storeId: string, 
  memberId: string, 
  targetDate: string, 
  scheduleId?: string,
  location?: { lat: number; lng: number }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: '인증되지 않은 사용자입니다.' }

  // Verify permission: Either the staff themselves or a manager
  const { data: member } = await supabase.from('store_members').select('user_id').eq('id', memberId).single()
  
  if (member?.user_id !== user.id) {
    try {
      await requirePermission(user.id, storeId, 'manage_schedule') // Proxy permission for managing others' attendance
    } catch {
      return { error: '타인의 출퇴근을 대리 체크할 권한이 없습니다.' }
    }
  } else if (location) {
    // Verify location if it's the user themselves
    const { data: store } = await supabase
      .from('stores')
      .select('latitude, longitude, auth_radius')
      .eq('id', storeId)
      .single()

    if (store && store.latitude !== null && store.longitude !== null) {
      const within = isWithinRadius(
        store.latitude,
        store.longitude,
        location.lat,
        location.lng,
        store.auth_radius
      )
      if (!within) {
        return { error: '매장 위치에서 벗어나 있어 출근 체크가 불가능합니다.' }
      }
    }
  }

  const now = getCurrentISOString()

  // Check if already clocked in for this date
  const { data: existing } = await supabase
    .from('store_attendance')
    .select('id')
    .eq('store_id', storeId)
    .eq('member_id', memberId)
    .eq('target_date', targetDate)
    .maybeSingle()

  if (existing) {
    return { error: '이미 해당 날짜에 출근 기록이 존재합니다.' }
  }

  const { data, error } = await supabase
    .from('store_attendance')
    .insert({
      store_id: storeId,
      member_id: memberId,
      target_date: targetDate,
      schedule_id: scheduleId || null,
      clock_in_time: now,
      status: 'working'
    })
    .select()
    .single()

  if (error) {
    console.error('Clock in error:', error)
    return { error: '출근 체크 중 오류가 발생했습니다.' }
  }

  revalidatePath('/dashboard/attendance')
  return { success: true, data }
}

export async function clockOut(
  attendanceId: string, 
  storeId: string,
  location?: { lat: number; lng: number }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: '인증되지 않은 사용자입니다.' }

  // Verify permission
  const { data: attendance } = await supabase
    .from('store_attendance')
    .select('member_id, member:store_members(user_id)')
    .eq('id', attendanceId)
    .single()

  const memberUserId = attendance?.member ? (Array.isArray(attendance.member) ? attendance.member[0]?.user_id : (attendance.member as any).user_id) : null;

  if (memberUserId !== user.id) {
    try {
      await requirePermission(user.id, storeId, 'manage_schedule')
    } catch {
      return { error: '타인의 퇴근을 대리 체크할 권한이 없습니다.' }
    }
  } else if (location) {
    // Verify location if it's the user themselves
    const { data: store } = await supabase
      .from('stores')
      .select('latitude, longitude, auth_radius')
      .eq('id', storeId)
      .single()

    if (store && store.latitude !== null && store.longitude !== null) {
      const within = isWithinRadius(
        store.latitude,
        store.longitude,
        location.lat,
        location.lng,
        store.auth_radius
      )
      if (!within) {
        return { error: '매장 위치에서 벗어나 있어 퇴근 체크가 불가능합니다.' }
      }
    }
  }

  const now = getCurrentISOString()

  const { data, error } = await supabase
    .from('store_attendance')
    .update({
      clock_out_time: now,
      status: 'completed'
    })
    .eq('id', attendanceId)
    .select()
    .single()

  if (error) {
    console.error('Clock out error:', error)
    return { error: '퇴근 체크 중 오류가 발생했습니다.' }
  }

  revalidatePath('/dashboard/attendance')
  return { success: true, data }
}

export async function startBreak(attendanceId: string, storeId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: '인증되지 않은 사용자입니다.' }
  const now = getCurrentISOString()

  const { data, error } = await supabase
    .from('store_attendance')
    .update({
      break_start_time: now,
      status: 'break'
    })
    .eq('id', attendanceId)
    .select()
    .single()

  if (error) {
    console.error('Start break error:', error)
    return { error: '휴식 시작 중 오류가 발생했습니다.' }
  }

  revalidatePath('/dashboard/attendance')
  return { success: true, data }
}

export async function endBreak(attendanceId: string, storeId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: '인증되지 않은 사용자입니다.' }
  const now = getCurrentISOString()

  // First get the start break time
  const { data: attendance } = await supabase
    .from('store_attendance')
    .select('break_start_time, total_break_minutes')
    .eq('id', attendanceId)
    .single()

  if (!attendance?.break_start_time) {
    return { error: '휴식 시작 기록이 없습니다.' }
  }

  const start = new Date(attendance.break_start_time).getTime()
  const end = new Date(now).getTime()
  const diffMins = Math.round((end - start) / 60000)

  const newTotalBreak = (attendance.total_break_minutes || 0) + diffMins

  const { data, error } = await supabase
    .from('store_attendance')
    .update({
      break_start_time: null, // Reset for next break
      break_end_time: now, // Store last break end
      total_break_minutes: newTotalBreak,
      status: 'working'
    })
    .eq('id', attendanceId)
    .select()
    .single()

  if (error) {
    console.error('End break error:', error)
    return { error: '휴식 종료 중 오류가 발생했습니다.' }
  }

  revalidatePath('/dashboard/attendance')
  return { success: true, data }
}

export async function getAttendanceRequests(storeId: string, _ts?: number) {
  noStore()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('store_attendance_requests')
    .select(`
      *,
      member:store_members!store_attendance_requests_member_id_fkey(
        id,
        name,
        role,
        role_info:store_roles(name, color),
        profile:profiles(full_name)
      ),
      attendance:store_attendance(
        id,
        clock_in_time,
        clock_out_time,
        status
      )
    `)
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching requests:', error)
    return []
  }

  return data as any[]
}

export async function createAttendanceRequest(
  storeId: string, 
  memberId: string, 
  targetDate: string, 
  requestedIn: string | null, 
  requestedOut: string | null, 
  reason: string,
  attendanceId?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: '인증되지 않은 사용자입니다.' }

  const { data, error } = await supabase
    .from('store_attendance_requests')
    .insert({
      store_id: storeId,
      member_id: memberId,
      target_date: targetDate,
      attendance_id: attendanceId || null,
      requested_clock_in: requestedIn,
      requested_clock_out: requestedOut,
      reason,
      status: 'pending'
    })
    .select()
    .single()

  if (error) {
    console.error('Create request error:', error)
    return { error: '수정 요청 생성 중 오류가 발생했습니다.' }
  }

  revalidatePath('/dashboard/attendance')
  return { success: true, data }
}

export async function resolveAttendanceRequest(requestId: string, storeId: string, isApproved: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: '인증되지 않은 사용자입니다.' }

  try {
    await requirePermission(user.id, storeId, 'manage_schedule')
  } catch {
    return { error: '요청을 처리할 권한이 없습니다.' }
  }

  const now = getCurrentISOString()

  // 1. Get request details
  const { data: request, error: reqError } = await supabase
    .from('store_attendance_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (reqError || !request) {
    return { error: '요청 정보를 찾을 수 없습니다.' }
  }

  if (request.status !== 'pending') {
    return { error: '이미 처리된 요청입니다.' }
  }

  // 2. If approved, update or insert attendance record
  if (isApproved) {
    if (request.attendance_id) {
      // Update existing
      const updateData: any = {
        status: 'completed',
        updated_at: now
      }
      if (request.requested_clock_in) updateData.clock_in_time = request.requested_clock_in
      if (request.requested_clock_out) updateData.clock_out_time = request.requested_clock_out

      const { error: attError } = await supabase
        .from('store_attendance')
        .update(updateData)
        .eq('id', request.attendance_id)
        .select()
        .single()

      if (attError) return { error: '출퇴근 기록 업데이트 중 오류가 발생했습니다: ' + attError.message }
    } else {
      // Insert new
      const { error: attError } = await supabase
        .from('store_attendance')
        .insert({
          store_id: request.store_id,
          member_id: request.member_id,
          target_date: request.target_date,
          clock_in_time: request.requested_clock_in,
          clock_out_time: request.requested_clock_out,
          status: 'completed'
        })
        .select()
        .single()

      if (attError) return { error: '새 출퇴근 기록 생성 중 오류가 발생했습니다: ' + attError.message }
    }
  }

  // 3. Update request status
  const { error: finalError } = await supabase
    .from('store_attendance_requests')
    .update({
      status: isApproved ? 'approved' : 'rejected',
      reviewed_by: user.id,
      reviewed_at: now
    })
    .eq('id', requestId)
    .select()
    .single()

  if (finalError) return { error: '요청 상태 변경 중 오류가 발생했습니다: ' + finalError.message }

  revalidatePath('/dashboard/attendance')
  return { success: true }
}