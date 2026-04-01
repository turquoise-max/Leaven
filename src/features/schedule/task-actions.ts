'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { addMinutesToTime, getCurrentISOString, toUTCISOString, getNextDateString } from '@/shared/lib/date-utils'
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
  is_routine?: boolean
  
  // New fields merged from task_assignments
  user_id?: string | null
  role_id?: string | null
  schedule_id?: string | null
  assigned_date?: string | null
  
  role?: {
    name: string
    color: string
  }
  member?: {
    name: string
    profile?: {
      full_name: string
    }
  }
}

// Deprecated, keep as alias to Task to avoid too many immediate breakages during refactor
export interface TaskAssignment extends Task {
  task_id?: string
  member_id?: string
  task?: Task
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
  is_routine?: boolean
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
  status?: 'todo' | 'in_progress' | 'pending' | 'done'
}

export interface AssignTaskInput {
  store_id: string
  task_id: string
  member_id: string
  assigned_date: string
  start_time?: string | null
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

  const canManageTasks = await hasPermission(user.id, storeId, 'manage_tasks')
  const canManageRoles = await hasPermission(user.id, storeId, 'manage_roles')
  if (!canManageTasks && !canManageRoles) return []

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
  
  const hasTaskPerm = await hasPermission(user.id, input.store_id, 'manage_tasks')
  const hasRolePerm = input.is_template ? await hasPermission(user.id, input.store_id, 'manage_roles') : false
  if (!hasTaskPerm && !hasRolePerm) {
    throw new Error('Permission denied: manage_tasks or manage_roles (for templates) required')
  }
  
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
        is_template: false,
        is_routine: input.is_routine || false
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
      recurrence_rule: input.recurrence_rule || null,
      is_routine: input.is_routine || false
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
  const { data: task } = await supabase.from('tasks').select('store_id, is_template').eq('id', id).single()
  if (!task) return { error: 'Task not found' }

  if (!user) throw new Error('User not found')
  
  const hasTaskPerm = await hasPermission(user.id, task.store_id, 'manage_tasks')
  const hasRolePerm = task.is_template ? await hasPermission(user.id, task.store_id, 'manage_roles') : false
  if (!hasTaskPerm && !hasRolePerm) {
    return { error: 'Permission denied' }
  }

  const { error } = await supabase
    .from('tasks')
    .update({
      ...updateData,
      updated_at: getCurrentISOString()
    })
    .eq('id', id)
    // RLS 등으로 인해 select().single()을 호출하면 데이터를 받아올 수 없어 
    // PGRST116 (The result contains 0 rows) 에러가 발생할 수 있습니다.
    // 업데이트만 수행하고 에러 유무만 체크하도록 수정합니다.

  if (error) {
    console.error('Error updating task:', error)
    return { error: '업무 수정 중 오류가 발생했습니다.' }
  }

  revalidatePath('/dashboard/tasks')
  return { data: { id, ...updateData } }
}

export async function deleteTask(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('User not found')

  // Get task info for permission check
  const { data: task } = await supabase
    .from('tasks')
    .select('store_id, is_template, assigned_role_ids')
    .eq('id', id)
    .single()
    
  if (!task) return { error: 'Task not found' }

  // Check if it's a personal task
  const { data: existingTask } = await supabase
    .from('tasks')
    .select('user_id')
    .eq('id', id)
    .single()

  const isPersonalTask = !task.is_template && (!task.assigned_role_ids || task.assigned_role_ids.length === 0)

  if (isPersonalTask) {
    if (existingTask?.user_id !== user.id) {
      // If not the owner, check for management permission
      await requirePermission(user.id, task.store_id, 'manage_tasks')
    }
  } else {
    // For role tasks or templates, always require management permission
    const hasTaskPerm = await hasPermission(user.id, task.store_id, 'manage_tasks')
    const hasRolePerm = task.is_template ? await hasPermission(user.id, task.store_id, 'manage_roles') : false
    if (!hasTaskPerm && !hasRolePerm) {
      return { error: 'Permission denied' }
    }
  }

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting task:', error)
    return { error: '업무 삭제 중 오류가 발생했습니다.' }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/my-tasks')
  revalidatePath('/dashboard/schedule')
  return { success: true }
}

export async function getTaskAssignments(storeId: string, date: string) {
  const supabase = await createClient()

  // Simplified select to avoid postgrest-js parser errors with complex jsonb extractions
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *
    `)
    .eq('store_id', storeId)
    .eq('assigned_date', date)
    .eq('is_template', false)

  if (error) {
    console.error('Error fetching tasks (formerly task assignments):', error)
    return []
  }

  // NOTE: If member profile is strictly needed by components consuming this, 
  // additional joins or separate queries mapping user_id to profiles might be needed.
  // We'll keep it simple for now as we transition.
  return data as Task[]
}

export async function assignTask(input: AssignTaskInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('User not found')
  await requirePermission(user.id, input.store_id, 'manage_tasks')

  // store_member의 user_id 조회
  const { data: targetMember } = await supabase
    .from('store_members')
    .select('user_id')
    .eq('id', input.member_id)
    .single()

  if (!targetMember || !targetMember.user_id) {
    return { error: '유효하지 않은 직원입니다.' }
  }

  // 종료 시간 계산 (순수 시간 계산, Timezone 무관)
  let end_time = null
  if (input.start_time) {
    end_time = addMinutesToTime(input.start_time, input.estimated_minutes)
  }

  // Fetch template task details
  const { data: templateTask } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', input.task_id)
    .single()

  if (!templateTask) {
    return { error: '원본 템플릿을 찾을 수 없습니다.' }
  }

  // start_time / end_time 은 "09:00" 형태의 문자열이 올 수 있고, DB의 timestamptz 형식에 맞춰야 하므로 
  // 기존 toUTCISOString 등을 사용해 KST -> UTC 변환 적용
  const startUTC = input.start_time ? toUTCISOString(input.assigned_date, input.start_time) : null;
  const endUTC = end_time ? toUTCISOString(input.assigned_date, end_time) : null;

  const { data, error } = await supabase
    .from('tasks')
    .insert([{
      store_id: input.store_id,
      title: templateTask.title,
      description: templateTask.description,
      checklist: templateTask.checklist,
      estimated_minutes: input.estimated_minutes,
      task_type: input.start_time ? 'scheduled' : 'always',
      user_id: targetMember.user_id,
      assigned_date: input.assigned_date,
      start_time: startUTC,
      end_time: endUTC,
      status: 'todo',
      schedule_id: input.schedule_id || null,
      is_template: false,
      is_routine: true
    }])
    .select()
    .single()

  if (error) {
    console.error('Error creating task from assignment:', error)
    return { error: '업무 할당(생성) 중 오류가 발생했습니다.' }
  }

  revalidatePath(`/dashboard/schedule/${input.assigned_date}`)
  revalidatePath('/dashboard/schedule')
  return { data }
}

export async function updateTaskAssignment(
  assignmentId: string,
  taskId: string, // No longer strictly needed since assignmentId == taskId now, keeping for signature compatibility
  storeId: string,
  title: string,
  startTime: string | null,
  estimatedMinutes: number
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not found')
  await requirePermission(user.id, storeId, 'manage_tasks')

  const { data: task } = await supabase
    .from('tasks')
    .select('assigned_date')
    .eq('id', assignmentId)
    .single()

  // 상시 업무(시간 미지정)일 경우, 해당 날짜의 자정으로 설정
  const finalStartTime = startTime 
    ? new Date(startTime).toISOString() 
    : (task && task.assigned_date ? `${task.assigned_date}T00:00:00Z` : null)

  let endTime = null
  if (startTime) {
    endTime = addMinutesToTime(startTime.split('T')[1]?.substring(0, 5) || startTime, estimatedMinutes)
  }

  // Update unified task table
  const { data, error } = await supabase
    .from('tasks')
    .update({ 
      title, 
      start_time: finalStartTime,
      end_time: endTime ? (task && task.assigned_date ? `${task.assigned_date}T${endTime}` : null) : null,
      estimated_minutes: estimatedMinutes,
      task_type: startTime ? 'scheduled' : 'always',
      updated_at: getCurrentISOString()
    })
    .eq('id', assignmentId)
    .select()
    .single()

  if (error) {
    console.error('Failed to update task:', error)
    return { error: 'Failed to update task' }
  }

  revalidatePath('/dashboard/schedule')
  return { data }
}

export async function unassignTask(assignmentId: string, date: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get store_id from task
  const { data: task } = await supabase.from('tasks').select('store_id').eq('id', assignmentId).single()
  if (!task) return { error: 'Task not found' }

  if (!user) throw new Error('User not found')
  await requirePermission(user.id, task.store_id, 'manage_tasks')

  // Just delete the assigned task
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', assignmentId)

  if (error) {
    console.error('Error deleting assigned task:', error)
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
    .from('tasks')
    .select(`
      *
    `)
    .eq('store_id', storeId)
    .eq('schedule_id', scheduleId)
    .eq('is_template', false)

  if (error) {
    console.error('Error fetching task assignments by schedule:', error)
    return []
  }

  return data as Task[]
}

// 업무 상태 업데이트
export async function updateTaskStatus(
  taskId: string, 
  status: 'todo' | 'in_progress' | 'pending' | 'done'
) {
  const supabase = await createClient()

  // 1. 현재 할 일 정보를 가져와서 checklist가 있는지 확인
  const { data: task } = await supabase
    .from('tasks')
    .select('checklist')
    .eq('id', taskId)
    .single()

  // 2. 상태가 'done'이면 하위 항목 전부 체크, 아니면 전부 해제 (체크리스트가 있을 경우에만)
  const updatePayload: any = {
    status,
    updated_at: getCurrentISOString()
  }

  if (task?.checklist && Array.isArray(task.checklist)) {
    updatePayload.checklist = task.checklist.map((item: any) => ({
      ...item,
      is_completed: status === 'done'
    }))
  }

  const { error } = await supabase
    .from('tasks')
    .update(updatePayload)
    .eq('id', taskId)

  if (error) {
    console.error('Error updating task status:', error)
    return { error: '상태 업데이트 실패' }
  }

  revalidatePath('/dashboard/tasks')
  revalidatePath('/dashboard/my-tasks')
  return { success: true }
}

// 캘린더용 이벤트 조회
export async function createPersonalDashboardTask(input: {
  store_id: string
  title: string
  description?: string
  task_type: 'scheduled' | 'always'
  start_time?: string | null // HH:mm format
  end_time?: string | null // HH:mm format
  assigned_date: string // YYYY-MM-DD
  checklist?: { id: string, text: string, is_completed: boolean }[]
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // 1. 해당 사용자의 member_id 조회
  const { data: member } = await supabase
    .from('store_members')
    .select('id')
    .eq('store_id', input.store_id)
    .eq('user_id', user.id)
    .single()

  if (!member) {
    return { error: '직원 정보를 찾을 수 없습니다.' }
  }

  // 2. 당일 배정된 스케줄 ID 조회 (시간 범위 내 검색)
  let scheduleId = null;
  const startIso = toUTCISOString(input.assigned_date, '00:00')
  const nextDate = getNextDateString(input.assigned_date)
  const endIso = toUTCISOString(nextDate, '00:00')
  
  const { data: scheduleData } = await supabase
      .from('schedules')
      .select('id, schedule_members!inner(member_id)')
      .eq('store_id', input.store_id)
      .eq('schedule_members.member_id', member.id)
      .gte('start_time', startIso)
      .lt('start_time', endIso)
      .limit(1)
      .maybeSingle()

  if (scheduleData) {
      scheduleId = scheduleData.id
  }

  let taskStartTime = null;
  let taskEndTime = null;

  if (input.task_type === 'scheduled' && input.start_time) {
    // 이미 UTC 문자열이면 그대로 사용, 'HH:mm' 형태면 변환
    if (input.start_time.includes('T')) {
      taskStartTime = input.start_time
      taskEndTime = input.end_time || null
    } else {
      taskStartTime = toUTCISOString(input.assigned_date, input.start_time)
      if (input.end_time) {
        taskEndTime = toUTCISOString(input.assigned_date, input.end_time)
      }
    }
  }

  // 3. Task 단일 생성 (user_id와 schedule_id를 포함시켜 한 번에 Insert)
  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .insert({
      store_id: input.store_id,
      title: input.title,
      description: input.description,
      task_type: input.task_type,
      start_time: taskStartTime,
      end_time: taskEndTime,
      assigned_role_ids: [],
      checklist: input.checklist || [],
      is_template: false,
      status: 'todo',
      user_id: user.id,
      schedule_id: scheduleId,
      assigned_date: input.assigned_date
    })
    .select()
    .single()

  if (taskError) {
     console.error('Task creation error:', taskError)
     return { error: '업무 생성 실패' }
  }

  revalidatePath('/dashboard/my-tasks')
  return { success: true, data: task }
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
    
    if (!user) return []

    // 1. 현재 직원의 member_id와 role(점주 여부 확인)을 가져옵니다.
    const { data: memberData } = await supabase
        .from('store_members')
        .select('id, role')
        .eq('store_id', storeId)
        .eq('user_id', user.id)
        .single()
        
    if (!memberData) return []

    const member = await getStoreMemberRole(user.id, storeId)
    const isOwner = memberData.role === 'owner' || member?.role === 'owner'

    // 2. 해당 직원의 오늘 날짜 근무 스케줄이 존재하는지 확인합니다.
    // 점주(Owner)는 스케줄 표 등록 여부와 무관하게 대시보드 가이드를 항상 열람할 수 있도록 예외(Bypass) 처리합니다.
    if (!isOwner) {
        const startIso = toUTCISOString(date, '00:00')
        const nextDate = getNextDateString(date)
        const endIso = toUTCISOString(nextDate, '00:00')
        
        const { data: scheduleData } = await supabase
            .from('schedules')
            .select('id, schedule_members!inner(member_id)')
            .eq('store_id', storeId)
            .eq('schedule_members.member_id', memberData.id)
            .gte('start_time', startIso)
            .lt('start_time', endIso)
            .limit(1)
            .maybeSingle()

        // 일반 직원은 오늘 스케줄이 없다면 대시보드 업무에 아무것도 보여주지 않음
        if (!scheduleData) {
            return []
        }
    }

    // 1. 내 당일 배정된 개별 업무 목록 가져오기 (단일 테이블 tasks에서)
    const { data: myTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('store_id', storeId)
        .eq('user_id', user.id)
        .eq('assigned_date', date)
        .eq('is_template', false)

    const assignedTasks: Task[] = []
    myTasks?.forEach((t: any) => {
        let safeStartTime = t.start_time;
        // 마이그레이션된 데이터가 HH:mm:ss 텍스트일 경우 처리
        if (t.start_time && !t.start_time.includes('T')) {
           safeStartTime = toUTCISOString(date, t.start_time.substring(0, 5));
        }

        let safeEndTime = t.end_time;
        if (t.end_time && !t.end_time.includes('T')) {
           safeEndTime = toUTCISOString(date, t.end_time.substring(0, 5));
        }

        assignedTasks.push({
          ...t,
          start_time: safeStartTime,
          end_time: safeEndTime,
          task_type: safeStartTime ? 'scheduled' : 'always',
        } as Task)
    })
    
    // 2. 내 역할의 플레이북(가이드라인) 조회 (is_routine = true)
    // 기존 is_template 플래그는 마이그레이션으로 인해 오염되었을 수 있으므로 is_routine 사용
    let templateQuery = supabase
        .from('tasks')
        .select('*')
        .eq('store_id', storeId)
        .eq('is_routine', true)

    // DB의 배열을 직접 .cs (contains)로 조회 시 owner와 같이 UUID 형태가 아닌 문자열일 경우
    // Supabase PostgREST에서 오류가 나거나 조회가 안 되는 버그가 존재합니다.
    // 따라서 템플릿을 먼저 모두 조회한 뒤, 안전하게 메모리 단에서 필터링합니다.
    const { data: rawTemplates, error } = await templateQuery

    let templateData: any[] = []
    if (!error && rawTemplates) {
      // getStoreMemberRole이나 supabase에서 조회한 memberData.role_id를 확인
      // memberData (store_members 테이블 조회 결과)에는 role_id 필드가 있을 수 있음
      const { data: fullMemberData } = await supabase
        .from('store_members')
        .select('id, role, role_id')
        .eq('store_id', storeId)
        .eq('user_id', user.id)
        .single()
        
      const userRoles = [
        fullMemberData?.role_id,
        fullMemberData?.role,
        member?.role_id,
        member?.role
      ].filter(Boolean);

      // 1. 메모리 상에서 안전하게 현재 로그인한 사람의 역할에 맞는 플레이북만 필터링
      const filteredTemplates = rawTemplates.filter(t => {
         // 이미 개별 할당된 업무(user_id가 있는 경우)는 플레이북 원본이 아니므로 제외
         if (t.user_id) return false;

         const assignedRoles = t.assigned_role_ids || [];
         
         // 역할이 지정되지 않은 플레이북은 모두에게 보이게 처리
         if (assignedRoles.length === 0) return true;
         
         if (assignedRoles.includes('all')) return true;
         
         if (userRoles.some(r => assignedRoles.includes(r))) return true;
         
         return false;
      });

      // 2. 날짜/시간 포맷팅 처리
      templateData = filteredTemplates.map(t => {
        let safeStartTime = t.start_time;
        if (safeStartTime && !safeStartTime.includes('T')) {
          safeStartTime = toUTCISOString(date, safeStartTime.substring(0, 5)); 
        }
        return {
          ...t,
          start_time: safeStartTime
        }
      });
    }

    if (error) {
        console.error('Error fetching template tasks:', error)
        return assignedTasks
    }

    // 서버 사이드에서 합치기
    const allTasks = [...assignedTasks, ...(templateData as Task[])]

    // start_time 오름차순으로 최종 정렬
    return allTasks.sort((a, b) => {
      const aTime = a.start_time ? new Date(a.start_time).getTime() : 0
      const bTime = b.start_time ? new Date(b.start_time).getTime() : 0
      return aTime - bTime
    })
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

export async function createDirectScheduleTask(input: {
  store_id: string
  title: string
  task_type: 'scheduled' | 'always'
  start_time: string | null
  end_time: string | null
  estimated_minutes: number
  checklist: any[]
  staff_id: string
  schedule_id: string
  assigned_date: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  try {
    await requirePermission(user.id, input.store_id, 'manage_tasks')
  } catch (e) {
    return { error: '권한이 없습니다.' }
  }

  const { data: memberData } = await supabase
    .from('store_members')
    .select('user_id')
    .eq('id', input.staff_id)
    .single()

  const insertPayload = {
    store_id: input.store_id,
    title: input.title,
    task_type: input.task_type,
    start_time: input.start_time,
    end_time: input.end_time,
    estimated_minutes: input.estimated_minutes,
    checklist: input.checklist,
    status: 'todo',
    is_template: false,
    is_routine: false,
    user_id: memberData?.user_id || null,
    schedule_id: input.schedule_id,
    assigned_date: input.assigned_date
  }

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .insert(insertPayload)
    .select()
    .single()

  if (taskError) {
    console.error('Task creation error details:', taskError)
    return { error: `업무 생성 실패: ${taskError.message || '알 수 없는 오류'}` }
  }

  revalidatePath('/dashboard/schedule')
  return { success: true, data: task }
}
