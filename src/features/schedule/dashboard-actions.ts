'use server'

import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'

// YYYY-MM-DD KST -> UTC boundaries
// 이 함수들은 dashboard/page.tsx에서만 사용할 간단한 집계용
export async function getTodayDashboardStats(storeId: string) {
  const supabase = await createClient()

  // 현재 한국 시간 기준 오늘 날짜 구하기 (YYYY-MM-DD)
  // 서버 시간대가 UTC일 수 있으므로 UTC 시간에 9시간을 더해 한국 날짜를 계산
  const now = new Date()
  const kstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000))
  const todayStr = format(kstNow, 'yyyy-MM-dd')
  
  // 오늘 날짜의 한국 시간 기준 00:00:00 ~ 23:59:59 의 UTC 타임스탬프 계산
  const kstMidnightUTC = new Date(`${todayStr}T00:00:00+09:00`).toISOString()
  const kstEndUTC = new Date(`${todayStr}T23:59:59.999+09:00`).toISOString()

  // 1. 금일 스케줄이 있는 직원 수 (고유 member_id)
  const { data: scheduleData, error: scheduleError } = await supabase
    .from('schedules')
    .select(`
      id,
      schedule_members!inner(member_id)
    `)
    .eq('store_id', storeId)
    .gte('end_time', kstMidnightUTC) // 시작/종료 시간이 오늘에 조금이라도 걸치면 포함
    .lte('start_time', kstEndUTC)

  let scheduledMembersCount = 0
  if (!scheduleError && scheduleData) {
    const memberSet = new Set<string>()
    scheduleData.forEach((schedule: any) => {
      if (schedule.schedule_members) {
        const members = Array.isArray(schedule.schedule_members) ? schedule.schedule_members : [schedule.schedule_members]
        members.forEach((m: any) => {
          if (m.member_id) memberSet.add(m.member_id)
        })
      }
    })
    scheduledMembersCount = memberSet.size
  } else {
    console.error('Error fetching today schedules for dashboard:', scheduleError)
  }

  // 2. 금일 휴가인 직원 수
  // leave_requests 테이블에서 status가 'approved'이고, 오늘 날짜가 start_date와 end_date 사이에 있는 경우
  const { data: leaveData, error: leaveError } = await supabase
    .from('leave_requests')
    .select('member_id')
    .eq('store_id', storeId)
    .eq('status', 'approved')
    .lte('start_date', todayStr)
    .gte('end_date', todayStr)

  let leaveMembersCount = 0
  if (!leaveError && leaveData) {
    const leaveMemberSet = new Set<string>()
    leaveData.forEach((leave: any) => {
      if (leave.member_id) leaveMemberSet.add(leave.member_id)
    })
    leaveMembersCount = leaveMemberSet.size
  } else {
    console.error('Error fetching today leaves for dashboard:', leaveError)
  }

  // 3. 금일 출근한 직원 수
  // store_attendance 테이블에서 clock_in_time이 존재하고 target_date가 오늘 날짜와 일치하는 경우
  const { data: attendanceData, error: attendanceError } = await supabase
    .from('store_attendance')
    .select('member_id')
    .eq('store_id', storeId)
    .eq('target_date', todayStr)
    .not('clock_in_time', 'is', null)

  let clockedInMembersCount = 0
  if (!attendanceError && attendanceData) {
    const attendanceMemberSet = new Set<string>()
    attendanceData.forEach((attendance: any) => {
      if (attendance.member_id) attendanceMemberSet.add(attendance.member_id)
    })
    clockedInMembersCount = attendanceMemberSet.size
  } else {
    console.error('Error fetching today attendance for dashboard:', attendanceError)
  }

  return {
    scheduledMembersCount,
    leaveMembersCount,
    clockedInMembersCount
  }
}
