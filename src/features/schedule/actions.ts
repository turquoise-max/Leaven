'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/features/auth/permissions'

// 스케줄 생성
export async function createSchedule(storeId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  try {
    await requirePermission(user.id, storeId, 'manage_schedule')
  } catch (error) {
    return { error: '권한이 없습니다.' }
  }

  const userId = formData.get('userId') as string
  const date = formData.get('date') as string
  const startTimeStr = formData.get('startTime') as string
  const endTimeStr = formData.get('endTime') as string
  const memo = formData.get('memo') as string

  // 날짜와 시간을 합쳐서 ISO String으로 변환 (KST 기준)
  // +09:00을 명시하여 한국 시간으로 해석하게 함 -> toISOString()은 이를 UTC로 변환하여 저장
  const startDateTime = new Date(`${date}T${startTimeStr}:00+09:00`).toISOString()
  const endDateTime = new Date(`${date}T${endTimeStr}:00+09:00`).toISOString()

  // TODO: 종료 시간이 시작 시간보다 빠른 경우 (익일 근무) 처리 필요

  const { error } = await supabase.from('schedules').insert({
    store_id: storeId,
    user_id: userId,
    start_time: startDateTime,
    end_time: endDateTime,
    memo: memo || null,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/schedule')
  return { success: true }
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

  const { error } = await supabase
    .from('schedules')
    .update({
      start_time: newStart,
      end_time: newEnd,
      updated_at: new Date().toISOString(),
    })
    .eq('id', scheduleId)
    .eq('store_id', storeId) // 안전장치

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/schedule')
  return { success: true }
}

// 스케줄 전체 수정 (다이얼로그)
export async function updateSchedule(storeId: string, scheduleId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  try {
    await requirePermission(user.id, storeId, 'manage_schedule')
  } catch (error) {
    return { error: '권한이 없습니다.' }
  }

  const userId = formData.get('userId') as string
  const date = formData.get('date') as string
  const startTimeStr = formData.get('startTime') as string
  const endTimeStr = formData.get('endTime') as string
  const memo = formData.get('memo') as string

  // KST 기준으로 시간 생성
  const startDateTime = new Date(`${date}T${startTimeStr}:00+09:00`).toISOString()
  const endDateTime = new Date(`${date}T${endTimeStr}:00+09:00`).toISOString()

  const { error } = await supabase
    .from('schedules')
    .update({
      user_id: userId,
      start_time: startDateTime,
      end_time: endDateTime,
      memo: memo || null,
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