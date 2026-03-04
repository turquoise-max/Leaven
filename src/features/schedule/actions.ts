'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/features/auth/permissions'

// 스케줄 조회 (기간)
export async function getSchedules(storeId: string, startDate: string, endDate: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('schedules')
    .select(`
      id,
      store_id,
      start_time,
      end_time,
      memo,
      title,
      color,
      schedule_members (
        user_id,
        profile:profiles (full_name, avatar_url)
      )
    `)
    .eq('store_id', storeId)
    .gte('start_time', startDate)
    .lte('end_time', endDate)

  if (error) {
    console.error('Error fetching schedules:', error)
    return []
  }

  return data
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
    // KST 기준 ISO String 생성
    const startDateTime = new Date(`${date}T${startTimeStr}:00+09:00`).toISOString()
    const endDateTime = new Date(`${date}T${endTimeStr}:00+09:00`).toISOString()

    // 종료 시간이 시작 시간보다 빠른 경우 (자정 넘어가면) 날짜 하루 더함
    let finalEndDateTime = endDateTime
    if (startTimeStr > endTimeStr) {
       const nextDate = new Date(new Date(date).setDate(new Date(date).getDate() + 1)).toISOString().split('T')[0]
       finalEndDateTime = new Date(`${nextDate}T${endTimeStr}:00+09:00`).toISOString()
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
    const membersToInsert = userIds.map(userId => ({
        schedule_id: schedule.id,
        user_id: userId
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

// 스케줄 시간 수정 (드래그 앤 드롭 등)
export async function updateScheduleTime(
  storeId: string,
  scheduleId: string,
  newStart: string, // ISO String
  newEnd: string    // ISO String
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  try {
    await requirePermission(user.id, storeId, 'manage_schedule')
  } catch (error) {
    return { error: '권한이 없습니다.' }
  }

  // 스케줄 본체만 업데이트하면 연결된 멤버들도 자동으로 변경된 시간을 따름
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

  // KST 기준으로 시간 생성
  const startDateTime = new Date(`${date}T${startTimeStr}:00+09:00`).toISOString()
  let endDateTime = new Date(`${date}T${endTimeStr}:00+09:00`).toISOString()

  if (startTimeStr > endTimeStr) {
       const nextDate = new Date(new Date(date).setDate(new Date(date).getDate() + 1)).toISOString().split('T')[0]
       endDateTime = new Date(`${nextDate}T${endTimeStr}:00+09:00`).toISOString()
  }

  // 1. 스케줄 정보 업데이트
  const { error: updateError } = await supabase
    .from('schedules')
    .update({
      start_time: startDateTime,
      end_time: endDateTime,
      memo: memo || null,
      title: title || null,
      color: color || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', scheduleId)
    .eq('store_id', storeId)

  if (updateError) {
    return { error: updateError.message }
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
  const membersToInsert = userIds.map(userId => ({
    schedule_id: scheduleId,
    user_id: userId
  }))

  const { error: insertError } = await supabase
    .from('schedule_members')
    .insert(membersToInsert)

  if (insertError) {
    return { error: insertError.message }
  }

  revalidatePath('/dashboard/schedule')
  return { success: true }
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