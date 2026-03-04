'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface Task {
  id: string
  store_id: string
  title: string
  description: string | null
  is_critical: boolean
  estimated_minutes: number
  created_at: string
  updated_at: string
}

export interface TaskAssignment {
  id: string
  task_id: string
  user_id: string
  schedule_id: string | null
  assigned_date: string
  start_time: string | null
  end_time: string | null
  status: 'pending' | 'in_progress' | 'completed' | 'verified'
  task?: Task
  user?: {
    full_name: string
  }
}

export interface CreateTaskInput {
  store_id: string
  title: string
  description?: string
  is_critical?: boolean
  estimated_minutes?: number
}

export interface UpdateTaskInput {
  id: string
  title?: string
  description?: string
  is_critical?: boolean
  estimated_minutes?: number
}

export interface AssignTaskInput {
  store_id: string
  task_id: string
  user_id: string
  assigned_date: string
  start_time: string
  estimated_minutes: number
  schedule_id?: string
}

export async function getTasks(storeId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching tasks:', error)
    throw new Error('업무 목록을 불러오는데 실패했습니다.')
  }

  return data as Task[]
}

export async function createTask(input: CreateTaskInput) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tasks')
    .insert([input])
    .select()
    .single()

  if (error) {
    console.error('Error creating task:', error)
    return { error: '업무 생성 중 오류가 발생했습니다.' }
  }

  revalidatePath('/dashboard/tasks')
  return { data }
}

export async function updateTask(input: UpdateTaskInput) {
  const supabase = await createClient()
  const { id, ...updateData } = input

  const { data, error } = await supabase
    .from('tasks')
    .update({
      ...updateData,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating task:', error)
    return { error: '업무 수정 중 오류가 발생했습니다.' }
  }

  revalidatePath('/dashboard/tasks')
  return { data }
}

export async function deleteTask(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting task:', error)
    return { error: '업무 삭제 중 오류가 발생했습니다.' }
  }

  revalidatePath('/dashboard/tasks')
  return { success: true }
}

export async function getTaskAssignments(storeId: string, date: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('task_assignments')
    .select(`
      *,
      task:tasks(*),
      user:profiles(full_name)
    `)
    .eq('store_id', storeId)
    .eq('assigned_date', date)

  if (error) {
    console.error('Error fetching task assignments:', error)
    return []
  }

  return data as TaskAssignment[]
}

export async function assignTask(input: AssignTaskInput) {
  const supabase = await createClient()

  // 종료 시간 계산
  const [hours, minutes] = input.start_time.split(':').map(Number)
  const startDate = new Date()
  startDate.setHours(hours, minutes, 0)
  
  const endDate = new Date(startDate.getTime() + input.estimated_minutes * 60000)
  const end_time = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('task_assignments')
    .insert([{
      store_id: input.store_id,
      task_id: input.task_id,
      user_id: input.user_id,
      assigned_date: input.assigned_date,
      start_time: input.start_time,
      end_time: end_time,
      status: 'pending',
      schedule_id: input.schedule_id
    }])
    .select()
    .single()

  if (error) {
    console.error('Error assigning task:', error)
    return { error: '업무 할당 중 오류가 발생했습니다.' }
  }

  revalidatePath(`/dashboard/schedule/${input.assigned_date}`)
  revalidatePath('/dashboard/schedule')
  return { data }
}

export async function unassignTask(assignmentId: string, date: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('task_assignments')
    .delete()
    .eq('id', assignmentId)

  if (error) {
    console.error('Error unassigning task:', error)
    return { error: '업무 할당 취소 중 오류가 발생했습니다.' }
  }

  revalidatePath(`/dashboard/schedule/${date}`)
  revalidatePath('/dashboard/schedule')
  return { success: true }
}

export async function getTaskAssignmentsBySchedule(storeId: string, scheduleId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('task_assignments')
    .select(`
      *,
      task:tasks(*),
      user:profiles(full_name)
    `)
    .eq('store_id', storeId)
    .eq('schedule_id', scheduleId)

  if (error) {
    console.error('Error fetching task assignments by schedule:', error)
    return []
  }

  return data as TaskAssignment[]
}
