'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { addMinutesToTime, getCurrentISOString, toUTCISOString, getNextDateString } from '@/lib/date-utils'
import { requirePermission, hasPermission, getStoreMemberRole } from '@/features/auth/permissions'

export interface ChecklistItem {
  id: string
  text: string
  is_completed: boolean
}

export interface Task {
  id: string
  store_id: string
  title: string
  description: string | null
  is_critical: boolean
  estimated_minutes: number
  created_at: string
  updated_at: string
  task_type: 'scheduled' | 'always'
  start_time: string | null // timestamptz (ISO string)
  end_time: string | null // timestamptz (ISO string)
  original_repeat_id: string | null
  assigned_role_ids: string[] | null
  assigned_role_id?: string | null // Deprecated
  checklist: ChecklistItem[] | null
  status: 'todo' | 'in_progress' | 'done'
  is_template?: boolean
  recurrence_rule?: any
  role?: {
    name: string
    color: string
  }
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

export interface RepeatConfig {
  type: 'daily' | 'weekly' | 'monthly'
  interval: number
  days?: number[] // 0(Sun) - 6(Sat)
  end_date: string // YYYY-MM-DD
  start_date: string // YYYY-MM-DD
  is_last_day?: boolean
}

export interface CreateTaskInput {
  store_id: string
  title: string
  description?: string
  is_critical?: boolean
  estimated_minutes?: number
  task_type: 'scheduled' | 'always'
  start_time?: string | null // ISO String (UTC)
  end_time?: string | null // ISO String (UTC)
  assigned_role_ids?: string[] | null
  assigned_role_id?: string | null // Deprecated
  checklist?: ChecklistItem[]
  repeat_config?: RepeatConfig
  is_template?: boolean
  recurrence_rule?: any
}

export interface UpdateTaskInput {
  id: string
  title?: string
  description?: string
  is_critical?: boolean
  estimated_minutes?: number
  task_type?: 'scheduled' | 'always'
  start_time?: string | null
  end_time?: string | null
  assigned_role_ids?: string[] | null
  assigned_role_id?: string | null // Deprecated
  checklist?: ChecklistItem[]
  status?: 'todo' | 'in_progress' | 'done'
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
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []
  
  try {
      await requirePermission(user.id, storeId, 'view_tasks')
  } catch (e) {
      console.error(e)
      return []
  }

  const canManage = await hasPermission(user.id, storeId, 'manage_tasks')
  const member = await getStoreMemberRole(user.id, storeId)

  let query = supabase
    .from('tasks')
    .select('*')
    .eq('store_id', storeId)
    .eq('is_template', false)
    
  if (!canManage && member?.role_id) {
    // 본인 역할 할당 업무 또는 공통 업무(비어있거나 null)
    query = query.or(`assigned_role_ids.cs.{${member.role_id}},assigned_role_ids.eq.{},assigned_role_ids.is.null`)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching tasks:', error)
    throw new Error('업무 목록을 불러오는데 실패했습니다.')
  }

  return data as Task[]
}

export async function getTaskTemplates(storeId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  const canManage = await hasPermission(user.id, storeId, 'manage_tasks')
  if (!canManage) return []

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('store_id', storeId)
    .eq('is_template', true)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching task templates:', error)
    throw new Error('업무 템플릿 목록을 불러오는데 실패했습니다.')
  }

  return data as Task[]
}

export async function generateTasksFromTemplates(storeId: string, startDate: string, endDate: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  try {
    await requirePermission(user.id, storeId, 'manage_tasks')
  } catch (error) {
    return { error: '권한이 없습니다.' }
  }

  const { data, error } = await supabase.rpc('generate_tasks_from_templates', {
    p_store_id: storeId,
    p_start_date: startDate,
    p_end_date: endDate
  })

  if (error) {
    console.error('Error generating tasks:', error)
    return { error: error.message }
  }

  revalidatePath('/dashboard/tasks')
  return { success: true, count: data }
}

export async function deleteTasksByPeriod(storeId: string, startDate: string, endDate: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  try {
    await requirePermission(user.id, storeId, 'manage_tasks')
  } catch (error) {
    return { error: '권한이 없습니다.' }
  }

  const { data, error } = await supabase.rpc('delete_tasks_by_period', {
    p_store_id: storeId,
    p_start_date: startDate,
    p_end_date: endDate
  })

  if (error) {
    console.error('Error deleting tasks by period:', error)
    return { error: error.message }
  }

  revalidatePath('/dashboard/tasks')
  return { success: true, count: data }
}

export async function createTask(input: CreateTaskInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('User not found')
  await requirePermission(user.id, input.store_id, 'manage_tasks')
  
  const tasksToCreate: any[] = []
  const original_repeat_id = input.repeat_config ? crypto.randomUUID() : null

  if (input.repeat_config) {
    const { start_date, end_date, type, interval, days, is_last_day } = input.repeat_config
    const start = new Date(start_date) // UTC 00:00
    const end = new Date(end_date)
    
    // Anchor Date (기준일) - UTC 기준
    const anchorDate = start.getUTCDate()
    
    const timePartStart = input.start_time ? input.start_time.split('T')[1] : null
    const timePartEnd = input.end_time ? input.end_time.split('T')[1] : null
    const isAlways = input.task_type === 'always'

    let current = new Date(start)
    
    // Monthly 반복을 위한 반복 변수
    let monthCursor = 0

    while (current <= end) {
      let shouldCreate = false

      if (type === 'daily') {
        shouldCreate = true
      } else if (type === 'weekly') {
        if (days && days.includes(current.getDay())) { // getDay() returns 0-6 (Sun-Sat) based on local time? No, Date created from YYYY-MM-DD string is UTC. getDay() is local. We should use getUTCDay().
            // IMPORTANT: new Date('2024-01-01') creates UTC midnight. 
            // getUTCDay() will match the intended date.
            if (days.includes(current.getUTCDay())) {
                 shouldCreate = true
            }
        }
      } else if (type === 'monthly') {
        // Monthly logic handled in increment step, so always true here
        shouldCreate = true
      }

      if (shouldCreate) {
        const year = current.getUTCFullYear()
        const month = String(current.getUTCMonth() + 1).padStart(2, '0')
        const day = String(current.getUTCDate()).padStart(2, '0')
        const dateStr = `${year}-${month}-${day}`
        
        let start_time = null
        let end_time = null

        if (!isAlways && timePartStart && timePartEnd) {
            start_time = `${dateStr}T${timePartStart}`
            end_time = `${dateStr}T${timePartEnd}`
        } else if (isAlways) {
            start_time = `${dateStr}T00:00:00Z`
            end_time = `${dateStr}T23:59:59Z` 
        }

        tasksToCreate.push({
          store_id: input.store_id,
          title: input.title,
          description: input.description,
          is_critical: input.is_critical,
          estimated_minutes: input.estimated_minutes,
          task_type: input.task_type,
          start_time: start_time,
          end_time: end_time,
          original_repeat_id: original_repeat_id,
          assigned_role_ids: input.assigned_role_ids || [],
          // assigned_role_id: null, // DB Default or handle via migration
          checklist: input.checklist || [],
          status: 'todo',
          is_template: false
        })
      }

      // 날짜 증가 로직
      if (type === 'monthly') {
        // 다음 달 계산
        monthCursor += interval
        
        // 기준 연/월에서 monthCursor만큼 이동
        // start는 고정되어 있음
        const nextDate = new Date(start)
        nextDate.setUTCMonth(start.getUTCMonth() + monthCursor)
        
        // 해당 월의 마지막 날짜 계산
        const year = nextDate.getUTCFullYear()
        const month = nextDate.getUTCMonth()
        // 다음달의 0일 = 이번달의 마지막 날
        const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
        
        let targetDay = anchorDate
        
        if (is_last_day) {
            targetDay = daysInMonth
        } else {
            // Anchor Date 보존 로직: 기준일이 31일인데 이번달이 30일까지면 30일로, 28일이면 28일로.
            targetDay = Math.min(anchorDate, daysInMonth)
        }
        
        nextDate.setUTCDate(targetDay)
        current = nextDate
      } else {
        // daily: +interval
        // weekly: +1 (and check day)
        current.setUTCDate(current.getUTCDate() + (type === 'daily' ? interval : 1))
      }
    }

  } else {
    // 단일 생성 (또는 템플릿 생성)
    tasksToCreate.push({
      store_id: input.store_id,
      title: input.title,
      description: input.description,
      is_critical: input.is_critical,
      estimated_minutes: input.estimated_minutes,
      task_type: input.task_type,
      start_time: input.start_time,
      end_time: input.end_time,
      original_repeat_id: null,
      assigned_role_ids: input.assigned_role_ids || [],
      // assigned_role_id: null,
      checklist: input.checklist || [],
      status: 'todo',
      is_template: input.is_template || false,
      recurrence_rule: input.recurrence_rule || null
    })
  }

  if (tasksToCreate.length === 0) {
      return { error: '생성할 업무가 없습니다.' }
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert(tasksToCreate)
    .select()

  if (error) {
    console.error('Error creating task:', error)
    return { error: '업무 생성 중 오류가 발생했습니다.' }
  }

  revalidatePath('/dashboard/tasks')
  return { data: data[0] } // Return first created task
}

export async function updateTask(input: UpdateTaskInput & { recurrence_rule?: any }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { id, ...updateData } = input

  // Get store_id for permission check
  const { data: task } = await supabase.from('tasks').select('store_id').eq('id', id).single()
  if (!task) return { error: 'Task not found' }

  if (!user) throw new Error('User not found')
  await requirePermission(user.id, task.store_id, 'manage_tasks')

  const { data, error } = await supabase
    .from('tasks')
    .update({
      ...updateData,
      updated_at: getCurrentISOString()
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
  const { data: { user } } = await supabase.auth.getUser()

  // Get store_id for permission check
  const { data: task } = await supabase.from('tasks').select('store_id').eq('id', id).single()
  if (!task) return { error: 'Task not found' }

  if (!user) throw new Error('User not found')
  await requirePermission(user.id, task.store_id, 'manage_tasks')

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
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('User not found')
  await requirePermission(user.id, input.store_id, 'manage_tasks')

  // 종료 시간 계산 (순수 시간 계산, Timezone 무관)
  const end_time = addMinutesToTime(input.start_time, input.estimated_minutes)

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
  const { data: { user } } = await supabase.auth.getUser()

  // Get store_id from assignment
  const { data: assignment } = await supabase.from('task_assignments').select('store_id').eq('id', assignmentId).single()
  if (!assignment) return { error: 'Assignment not found' }

  if (!user) throw new Error('User not found')
  await requirePermission(user.id, assignment.store_id, 'manage_tasks')

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

export async function deleteAllTasks(storeId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('User not found')
  await requirePermission(user.id, storeId, 'manage_tasks')

  // 연관 데이터 삭제 (Cascade 설정이 안되어 있을 경우를 대비해 명시적 삭제)
  await supabase.from('task_assignments').delete().eq('store_id', storeId)
  await supabase.from('task_history').delete().eq('store_id', storeId)

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('store_id', storeId)

  if (error) {
    console.error('Error deleting all tasks:', error)
    return { error: '전체 업무 삭제 실패' }
  }

  revalidatePath('/dashboard/tasks')
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

// 업무 상태 업데이트
export async function updateTaskStatus(
  taskId: string, 
  status: 'todo' | 'in_progress' | 'done'
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('tasks')
    .update({ 
        status,
        updated_at: getCurrentISOString()
    })
    .eq('id', taskId)

  if (error) {
    console.error('Error updating task status:', error)
    return { error: '상태 업데이트 실패' }
  }

  revalidatePath('/dashboard/tasks')
  return { success: true }
}

// 캘린더용 이벤트 조회
export async function getCalendarEvents(storeId: string, start: string, end: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    let query = supabase
        .from('tasks')
        .select('*')
        .eq('store_id', storeId)
        .eq('is_template', false)
        .gte('start_time', start) 
        .lte('start_time', end)

    if (user) {
        const canManage = await hasPermission(user.id, storeId, 'manage_tasks')
        const member = await getStoreMemberRole(user.id, storeId)
        
        if (!canManage && member?.role_id) {
            query = query.or(`assigned_role_ids.cs.{${member.role_id}},assigned_role_ids.eq.{},assigned_role_ids.is.null`)
        }
    }

    const { data: tasks, error } = await query
    
    if (error) throw new Error('업무 목록 조회 실패')

    return { tasks: tasks as Task[] }
}

// 대시보드용 업무 조회 (오늘 날짜 기준)
export async function getDashboardTasks(storeId: string, date: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    // date: YYYY-MM-DD (KST 기준)
    // 유틸리티를 활용하여 정확한 UTC 경계값(Start, End) 산출
    const startIso = toUTCISOString(date, '00:00')
    const nextDate = getNextDateString(date)
    const endIso = toUTCISOString(nextDate, '00:00')
    
    let query = supabase
        .from('tasks')
        .select('*')
        .eq('store_id', storeId)
        .eq('is_template', false)
        .gte('start_time', startIso)
        .lt('start_time', endIso)
        .order('start_time', { ascending: true })

    if (user) {
        const canManage = await hasPermission(user.id, storeId, 'manage_tasks')
        const member = await getStoreMemberRole(user.id, storeId)
        
        if (!canManage && member?.role_id) {
            // 본인 역할 할당 업무 또는 공통 업무
            // 주의: .or() 와 이전 필터들이 AND로 묶여야 하므로, 
            // Supabase client에서는 체이닝을 그대로 사용하면 앞선 eq, gte 조건과 결합됩니다.
            query = query.or(`assigned_role_ids.cs.{${member.role_id}},assigned_role_ids.eq.{},assigned_role_ids.is.null`)
        }
    }
        
    const { data, error } = await query
        
    if (error) {
        console.error('Error fetching dashboard tasks:', error)
        return []
    }
    
    return data as Task[]
}

// 체크리스트 아이템 토글 및 업무 상태 자동 업데이트
export async function toggleTaskCheckitem(taskId: string, itemId: string, isCompleted: boolean) {
  const supabase = await createClient()

  // 1. Get current task
  const { data: task } = await supabase.from('tasks').select('checklist, status').eq('id', taskId).single()
  if (!task || !task.checklist) return { error: 'Task not found' }

  // 2. Update checklist
  const newChecklist = (task.checklist as any[]).map((item: any) =>
    item.id === itemId ? { ...item, is_completed: isCompleted } : item
  )

  // 3. Check completion status
  // 모든 아이템이 완료되었는지 확인
  const allCompleted = newChecklist.length > 0 && newChecklist.every((item: any) => item.is_completed)
  
  // 상태 결정 로직:
  // - 다 완료됨 -> done
  // - 다 완료 안 됨 -> 
  //   - 원래 done이었다면 -> todo로 복구
  //   - 원래 todo/in_progress였다면 -> 그대로 유지
  let newStatus = task.status
  if (allCompleted) {
      newStatus = 'done'
  } else if (task.status === 'done') {
      newStatus = 'todo' // 다시 미완료로 복구
  }
  
  // 4. Update DB
  const { error } = await supabase
    .from('tasks')
    .update({
      checklist: newChecklist,
      status: newStatus,
      updated_at: getCurrentISOString()
    })
    .eq('id', taskId)

  if (error) {
      console.error('Error updating checklist:', error)
      return { error: 'Failed to update' }
  }
  
  revalidatePath('/dashboard')
  return { success: true }
}