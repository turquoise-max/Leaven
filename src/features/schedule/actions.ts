'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/features/auth/permissions'
import { toUTCISOString, getCurrentISOString, getNextDateString, getDiffInMinutes, addMinutesToTime } from '@/shared/lib/date-utils'

// 스케줄 조회 (기간) 및 해당 기간의 승인된 휴가 정보 함께 반환
export async function getSchedules(storeId: string, startDate: string, endDate: string) {
  const supabase = await createClient()

  // 1. 스케줄 기본 정보 조회
  const { data: schedules, error: scheduleError } = await supabase
    .from('schedules')
    .select(`
      id,
      store_id,
      start_time,
      end_time,
      memo,
      title,
      color,
      schedule_type,
      schedule_members (
        member_id,
        member:store_members (name, user_id, profile:profiles(full_name, avatar_url))
      ),
      task_assignments(
        id,
        start_time,
        end_time,
        task:tasks(id, title, description, status, checklist)
      )
    `)
    .eq('store_id', storeId)
    .gte('start_time', startDate)
    .lte('end_time', endDate)

  if (scheduleError) {
    console.error('Error fetching schedules:', scheduleError)
    return []
  }

  // 2. 해당 기간의 승인된 휴가 정보 조회 (SSOT)
  const { data: leaves, error: leaveError } = await supabase
    .from('leave_requests')
    .select('member_id, start_date, end_date, leave_type, reason')
    .eq('store_id', storeId)
    .eq('status', 'approved')
    .gte('end_date', startDate.split('T')[0])
    .lte('start_date', endDate.split('T')[0])

  if (leaveError) {
    console.error('Error fetching leaves:', leaveError)
    return schedules
  }

  // 스케줄 객체에 관련 휴가 정보를 붙여서 반환
  return schedules.map((sch: any) => ({
    ...sch,
    approved_leaves: leaves // 프론트엔드에서 필터링하여 사용
  }))
}

// 스케줄 생성 (다중 인원, 반복 지원)
export async function createSchedule(storeId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  try {
    await requirePermission(user.id, storeId, 'manage_schedule')
  } catch (error) {
    return { error: '권한이 없습니다.' }
  }

  // 데이터 추출
  const userIdsJson = formData.get('userIds') as string
  let userIds: string[] = []
  try {
    userIds = JSON.parse(userIdsJson)
  } catch (e) {
    return { error: 'Invalid user selection' }
  }

  if (!userIds || userIds.length === 0) {
    return { error: '직원을 선택해주세요.' }
  }

  const startDateStr = formData.get('date') as string
  const startTimeStr = formData.get('startTime') as string
  const endTimeStr = formData.get('endTime') as string
  const memo = formData.get('memo') as string
  const title = formData.get('title') as string
  const color = formData.get('color') as string
  
  const isRecurring = formData.get('isRecurring') === 'on'
  const repeatEndDateStr = formData.get('repeatEndDate') as string
  const repeatDaysJson = formData.get('repeatDays') as string // ["1", "3", "5"] (월,수,금)
  
  let targetDates: string[] = [startDateStr]

  // 반복 설정 시 날짜 목록 생성
  if (isRecurring && repeatEndDateStr && repeatDaysJson) {
    try {
      const repeatDays = JSON.parse(repeatDaysJson).map(Number) // [1, 3, 5]
      const start = new Date(startDateStr)
      const end = new Date(repeatEndDateStr)
      
      targetDates = [] // 초기화 (시작일도 조건에 맞는지 체크하기 위해)
      
      for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
        if (repeatDays.includes(d.getDay())) {
          targetDates.push(d.toISOString().split('T')[0])
        }
      }
    } catch (e) {
      console.error('Error parsing repeat options:', e)
      return { error: '반복 설정 오류' }
    }
  }

  if (targetDates.length === 0) {
    return { error: '생성할 날짜가 없습니다.' }
  }

  let createdCount = 0

  for (const date of targetDates) {
    // KST 입력 -> UTC 변환 (시스템 시간대 영향 제거)
    const startDateTime = toUTCISOString(date, startTimeStr)
    let finalEndDateTime = toUTCISOString(date, endTimeStr)

    // 종료 시간이 시작 시간보다 빠른 경우 (자정 넘어가면) 날짜 하루 더함
    if (startTimeStr > endTimeStr) {
       const nextDate = getNextDateString(date)
       finalEndDateTime = toUTCISOString(nextDate, endTimeStr)
    }

    // 1. 스케줄 본체 생성
    const { data: schedule, error: scheduleError } = await supabase
        .from('schedules')
        .insert({
            store_id: storeId,
            start_time: startDateTime,
            end_time: finalEndDateTime,
            memo: memo || null,
            title: title || null,
            color: color || null,
        })
        .select()
        .single()
    
    if (scheduleError) {
        return { error: scheduleError.message }
    }

    // 2. 멤버 연결
    const membersToInsert = userIds.map(memberId => ({
        schedule_id: schedule.id,
        member_id: memberId
    }))

    const { error: membersError } = await supabase
        .from('schedule_members')
        .insert(membersToInsert)
    
    if (membersError) {
        // 롤백 필요하지만 일단 에러 반환 (실제로는 트랜잭션 필요)
        return { error: membersError.message }
    }

    createdCount++
  }

  revalidatePath('/dashboard/schedule')
  return { success: true, count: createdCount }
}

// 스케줄 시간 수정 (드래그 앤 드롭 등) 및 개별 업무(Task) 시간 이동
export async function updateScheduleTime(
  storeId: string,
  scheduleId: string,
  newStart: string, // ISO String
  newEnd: string,   // ISO String
  moveTasks: boolean = false
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  try {
    await requirePermission(user.id, storeId, 'manage_schedule')
  } catch (error) {
    return { error: '권한이 없습니다.' }
  }

  // 기존 스케줄 정보를 가져와 시간 차이(delta)를 분 단위로 계산 (moveTasks가 true일 때만)
  let deltaMinutes = 0;
  if (moveTasks) {
    const { data: oldSchedule } = await supabase
      .from('schedules')
      .select('start_time')
      .eq('id', scheduleId)
      .single()

    if (oldSchedule?.start_time) {
      deltaMinutes = getDiffInMinutes(oldSchedule.start_time, newStart)
    }
  }

  // 스케줄 업데이트
  const { error } = await supabase
    .from('schedules')
    .update({
      start_time: newStart,
      end_time: newEnd,
      updated_at: new Date().toISOString(),
    })
    .eq('id', scheduleId)
    .eq('store_id', storeId) 

  if (error) {
    return { error: error.message }
  }

  // 개별 업무 시간 연동 이동 로직 (timezone 이슈 없이 순수 문자열 연산)
  if (moveTasks && deltaMinutes !== 0) {
    const { data: assignments } = await supabase
      .from('task_assignments')
      .select('id, start_time, end_time, assigned_date')
      .eq('schedule_id', scheduleId)
      .eq('store_id', storeId)

    if (assignments && assignments.length > 0) {
      for (const assignment of assignments) {
        if (assignment.start_time) {
          try {
            const updates: any = {}
            
            // start_time 업데이트 (형식: HH:mm:ss)
            const newStartStr = addMinutesToTime(assignment.start_time, deltaMinutes)
            updates.start_time = newStartStr.length === 5 ? newStartStr + ':00' : newStartStr

            // end_time 업데이트
            if (assignment.end_time) {
              const newEndStr = addMinutesToTime(assignment.end_time, deltaMinutes)
              updates.end_time = newEndStr.length === 5 ? newEndStr + ':00' : newEndStr
            }

            await supabase
              .from('task_assignments')
              .update(updates)
              .eq('id', assignment.id)

          } catch (e) {
            console.error('Task time update error:', e)
          }
        }
      }
    }
  }

  revalidatePath('/dashboard/schedule')
  return { success: true }
}

// 스케줄 수정 (다이얼로그)
export async function updateSchedule(storeId: string, scheduleId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  try {
    await requirePermission(user.id, storeId, 'manage_schedule')
  } catch (error) {
    return { error: '권한이 없습니다.' }
  }

  // 데이터 추출
  const userIdsJson = formData.get('userIds') as string
  let userIds: string[] = []
  try {
    userIds = JSON.parse(userIdsJson)
  } catch (e) {
    return { error: 'Invalid user selection' }
  }

  if (!userIds || userIds.length === 0) {
    return { error: '직원을 선택해주세요.' }
  }

  const date = formData.get('date') as string
  const startTimeStr = formData.get('startTime') as string
  const endTimeStr = formData.get('endTime') as string
  const memo = formData.get('memo') as string
  const title = formData.get('title') as string
  const color = formData.get('color') as string
  const scheduleType = formData.get('schedule_type') as string

  // KST 입력 -> UTC 변환
  const startDateTime = toUTCISOString(date, startTimeStr)
  let endDateTime = toUTCISOString(date, endTimeStr)

  if (startTimeStr > endTimeStr) {
       const nextDate = getNextDateString(date)
       endDateTime = toUTCISOString(nextDate, endTimeStr)
  }

  // 기존 스케줄 정보를 가져와 날짜 차이 확인
  const { data: oldSchedule } = await supabase
    .from('schedules')
    .select('start_time')
    .eq('id', scheduleId)
    .single()

  const oldDateStr = oldSchedule?.start_time?.split('T')[0] || date

  // 1. 스케줄 정보 업데이트
  const { error: updateError } = await supabase
    .from('schedules')
    .update({
      start_time: startDateTime,
      end_time: endDateTime,
      memo: memo || null,
      title: title || null,
      color: color || null,
      schedule_type: scheduleType || 'regular',
      updated_at: new Date().toISOString(),
    })
    .eq('id', scheduleId)
    .eq('store_id', storeId)

  if (updateError) {
    return { error: updateError.message }
  }

  // 날짜가 변경되었거나 직원이 변경되었을 경우 해당 스케줄에 속한 task_assignments 업데이트
  
  // 1. 기존 멤버 파악 (기존 스케줄의 담당자를 알아내서 새 userIds와 비교)
  const { data: oldMembersData } = await supabase
    .from('schedule_members')
    .select('member_id')
    .eq('schedule_id', scheduleId)

  const oldMemberIds = oldMembersData?.map(m => m.member_id) || []
  
  // 단일 담당자 변경 체크 (여러 명일 수 있지만 보통 드래그앤드롭은 1명만 선택됨)
  // userIds: 새로 할당될 member_id들의 배열
  const isMemberChanged = userIds.length > 0 && (oldMemberIds.length !== userIds.length || !oldMemberIds.includes(userIds[0]))

  if (oldDateStr !== date || isMemberChanged) {
    // start_time / end_time 은 그대로 두고 날짜만 업데이트
    // start_time / end_time 에 기존 날짜 정보가 포함되어 있으므로 재계산이 필요할 수 있지만
    // assigned_date만 바꾸거나, getDiffInMinutes 처럼 세밀한 처리가 필요.
    // 여기서는 가장 치명적인 assigned_date 만 1차로 변경.
    // 시간이 지정된 Task의 경우 원래 날짜기준 타임스탬프를 가지고 있으므로
    // 날짜 차이(deltaDays)를 계산하여 처리.
    const deltaMs = new Date(date).getTime() - new Date(oldDateStr).getTime()
    const deltaMinutes = Math.round(deltaMs / 60000)

    const { data: assignments } = await supabase
      .from('task_assignments')
      .select('id, start_time, end_time, assigned_date, user_id')
      .eq('schedule_id', scheduleId)
      .eq('store_id', storeId)

    if (assignments && assignments.length > 0) {
      // 새 멤버의 auth.user_id 조회 (task_assignments.user_id 컬럼용)
      let newUserId: string | null = null;
      if (isMemberChanged && userIds.length > 0) {
          const { data: newMemberData } = await supabase
              .from('store_members')
              .select('user_id')
              .eq('id', userIds[0])
              .single()
          // 만약 store_members.user_id가 null 이라면 (아직 미가입 직원), 
          // task_assignments의 user_id를 null로 업데이트할 수는 없음 (schema.sql에서 user_id는 NOT NULL 제약이 걸려있음).
          // 따라서 여기서는 null이라도 처리하거나 빈 문자열로 할 수 없으므로 무시하는 예외처리가 필요할 수도 있음.
          if (newMemberData && newMemberData.user_id) {
              newUserId = newMemberData.user_id
          }
      }

      // Bulk update를 위한 배열 생성
      const assignmentsToUpdate = []

      for (const assignment of assignments) {
        const updates: any = { id: assignment.id } // upsert 대신 개별 update를 배열에 담아 처리하거나, upsert를 위해 기존 값 유지
        
        let hasChanges = false;

        if (oldDateStr !== date) {
           updates.assigned_date = date
           hasChanges = true;
        }

        // 직원이 변경되었고, 대상 직원이 가입된 유저(auth.users)라면 user_id 업데이트
        // 가입되지 않은 직원이라면 task_assignments 생성이 원래도 안 되거나 에러가 났을 것임.
        if (isMemberChanged && newUserId) {
            updates.user_id = newUserId
            hasChanges = true;
        }
        
        if (oldDateStr !== date && assignment.start_time && deltaMinutes !== 0) {
            // 시간 이동 (날짜만 바뀌어도 deltaMinutes 만큼 이동)
            try {
              const newStartStr = addMinutesToTime(assignment.start_time, deltaMinutes)
              updates.start_time = newStartStr.length === 5 ? newStartStr + ':00' : newStartStr

              if (assignment.end_time) {
                const newEndStr = addMinutesToTime(assignment.end_time, deltaMinutes)
                updates.end_time = newEndStr.length === 5 ? newEndStr + ':00' : newEndStr
              }
              hasChanges = true;
            } catch(e) {
                console.error("Task assignment time update error:", e)
            }
        }

        if (hasChanges) { 
            // id 값만 들어간 객체가 아니면(실제 변경점이 있으면) 업데이트 배열에 담음
            assignmentsToUpdate.push(updates)
        }
      }

      // 일괄(Batch) 업데이트 실행 (N+1 문제 해결)
      // Supabase(PostgreSQL)의 upsert는 필수 컬럼이 누락되면 에러가 나므로, 
      // 개별 update 쿼리를 Promise.all로 던지거나 (갯수가 적으므로) 처리하는 편이 안전함.
      if (assignmentsToUpdate.length > 0) {
          await Promise.all(
            assignmentsToUpdate.map(updateObj => 
              supabase.from('task_assignments').update(updateObj).eq('id', updateObj.id)
            )
          )
      }
    }
  }

  // 2. 멤버 동기화 (기존 멤버 삭제 후 재등록)
  // 2-1. 기존 멤버 삭제
  const { error: deleteError } = await supabase
    .from('schedule_members')
    .delete()
    .eq('schedule_id', scheduleId)

  if (deleteError) {
    return { error: deleteError.message }
  }

  // 2-2. 새 멤버 등록
  const membersToInsert = userIds.map(memberId => ({
    schedule_id: scheduleId,
    member_id: memberId
  }))

  const { error: insertError } = await supabase
    .from('schedule_members')
    .insert(membersToInsert)

  if (insertError) {
    return { error: insertError.message }
  }

  revalidatePath('/dashboard/schedule')
  revalidatePath('/dashboard/my-tasks')
  return { success: true }
}

// 현재 로그인한 사용자의 현재 시간 기준 스케줄 조회
export async function getCurrentSchedule(storeId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const now = getCurrentISOString()
  console.log(`[getCurrentSchedule] Checking for user ${user.id} at ${now}`)

  // First get the member_id for the current user in this store
  const { data: memberData } = await supabase
    .from('store_members')
    .select('id')
    .eq('store_id', storeId)
    .eq('user_id', user.id)
    .single()
    
  if (!memberData) return null

  // schedule_members를 통해 내 member_id가 포함된 스케줄 중
  // 현재 시간이 start_time과 end_time 사이에 있는 것 조회
  const { data, error } = await supabase
    .from('schedules')
    .select(`
      id,
      start_time,
      end_time,
      title,
      memo,
      schedule_members!inner (member_id)
    `)
    .eq('store_id', storeId)
    .eq('schedule_members.member_id', memberData.id)
    .lte('start_time', now)
    .gte('end_time', now)
    .limit(1)
    .maybeSingle() // 여러 개 겹칠 경우 하나만

  if (error) {
    console.error('Error fetching current schedule:', error)
    return null
  }

  console.log(`[getCurrentSchedule] Result:`, data ? `Found schedule ${data.id}` : 'No schedule found')
  return data
}

// 스케줄 삭제
export async function deleteSchedule(storeId: string, scheduleId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  try {
    await requirePermission(user.id, storeId, 'manage_schedule')
  } catch (error) {
    return { error: '권한이 없습니다.' }
  }

  const { error } = await supabase
    .from('schedules')
    .delete()
    .eq('id', scheduleId)
    .eq('store_id', storeId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/schedule')
  return { success: true }
}

// 자동 스케줄 생성 (직원 근무 패턴 기반)
export async function generateStaffSchedules(
  storeId: string,
  startDate: string, // YYYY-MM-DD
  endDate: string,   // YYYY-MM-DD
  targetStaffIds: string[]
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  try {
    await requirePermission(user.id, storeId, 'manage_schedule')
  } catch (error) {
    return { error: '권한이 없습니다.' }
  }

  // Call RPC
  const { data, error } = await supabase.rpc('generate_staff_schedules', {
    p_store_id: storeId,
    p_start_date: startDate,
    p_end_date: endDate,
    p_target_staff_ids: targetStaffIds
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/schedule')
  return { success: true, count: data }
}

// 스케줄 일괄 삭제 (직원, 기간)
export async function deleteStaffSchedules(
  storeId: string,
  startDate: string, // YYYY-MM-DD
  endDate: string,   // YYYY-MM-DD
  targetStaffIds: string[]
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  try {
    await requirePermission(user.id, storeId, 'manage_schedule')
  } catch (error) {
    return { error: '권한이 없습니다.' }
  }

  // Call RPC
  const { data, error } = await supabase.rpc('delete_staff_schedules', {
    p_store_id: storeId,
    p_start_date: startDate,
    p_end_date: endDate,
    p_target_staff_ids: targetStaffIds
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/schedule')
  return { success: true, count: data }
}