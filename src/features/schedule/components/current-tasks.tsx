'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, Briefcase, Calendar, CheckCircle2 } from 'lucide-react'
import { Task } from '../task-actions'

interface CurrentTasksProps {
  tasks: Task[]
  userRole: string | null // Role name or ID
  roleId: string | null
  currentSchedule: any | null // TODO: Define Schedule type properly
}

export function CurrentTasks({ tasks, userRole, roleId, currentSchedule }: CurrentTasksProps) {
  const [mounted, setMounted] = useState(false)
  const [now, setNow] = useState<Date>(new Date())

  // Update time every minute & handle hydration mismatch
  useEffect(() => {
    setMounted(true)
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  if (!mounted) {
    return (
      <Card className="h-full border-2 border-primary/20 shadow-lg">
        <CardHeader className="pb-2 bg-primary/5">
          <CardTitle className="flex items-center justify-between text-lg">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              지금 해야 할 일
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
             <p className="text-sm">로딩 중...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const currentTasks = tasks.filter(task => {
    // 0. 근무 여부 체크
    // 근무 중이 아니면 업무 목록을 표시하지 않음 (매니저 포함)
    if (!currentSchedule) return false

    // 1. Role Filter (Multi-role support)
    // assigned_role_ids가 있으면 사용, 없으면 assigned_role_id (Legacy) 사용
    const taskRoleIds = task.assigned_role_ids || (task.assigned_role_id ? [task.assigned_role_id] : ['all'])
    
    // 'all'이 포함되어 있거나, 내 역할이 포함되어 있어야 함
    // roleId가 없는 경우(매니저 등 역할 할당 안 된 경우)에는 'all'인 업무만 볼 수 있음
    if (!taskRoleIds.includes('all') && (!roleId || !taskRoleIds.includes(roleId))) return false

    // 2. Time/Type Filter
    if (task.task_type === 'always') {
        // 상시 업무는 오늘 날짜에 해당하면 표시
        if (!task.start_time) return false // should not happen
        const taskDate = new Date(task.start_time).toDateString()
        const todayDate = now.toDateString()
        return taskDate === todayDate
    }

    if (task.task_type === 'scheduled') {
        if (!task.start_time || !task.end_time) return false
        
        const start = new Date(task.start_time)
        const end = new Date(task.end_time)
        
        // 현재 시간이 업무 시간 범위 내에 있는지 확인
        return start <= now && now <= end
    }

    return false
  })

  // Sort by start time
  currentTasks.sort((a, b) => {
    if (a.is_critical !== b.is_critical) return a.is_critical ? -1 : 1
    return (a.start_time || '').localeCompare(b.start_time || '')
  })

  return (
    <Card className="h-full border-2 border-primary/20 shadow-lg">
      <CardHeader className="pb-2 bg-primary/5">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary animate-pulse" />
            지금 해야 할 일
          </div>
          <div className="flex items-center gap-2">
             {!currentSchedule && (
                <Badge variant="secondary" className="font-normal text-xs">
                    근무 중 아님
                </Badge>
             )}
             <Badge variant="outline" className="font-normal text-xs bg-background">
                {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 기준
             </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {currentTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <CheckCircle2 className="w-10 h-10 mb-2 opacity-20" />
            <p className="text-sm">
                {!currentSchedule 
                    ? '현재 근무 시간이 아닙니다.' 
                    : '현재 예정된 업무가 없습니다.'}
            </p>
            {!currentSchedule && (
                <p className="text-xs mt-1">상시 업무만 확인할 수 있습니다.</p>
            )}
            {currentSchedule && <p className="text-xs">잠시 휴식을 취하세요!</p>}
          </div>
        ) : (
          <div className="divide-y">
            {currentTasks.map(task => (
              <div key={task.id} className="p-4 hover:bg-muted/50 transition-colors flex items-start gap-3">
                <div className="mt-1">
                  {task.task_type === 'always' ? (
                    <Briefcase className="w-4 h-4 text-orange-500" />
                  ) : (
                    <Clock className="w-4 h-4 text-blue-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium truncate">{task.title}</span>
                    {task.is_critical && (
                      <Badge variant="destructive" className="px-1 py-0 text-[10px] h-4">
                        필수
                      </Badge>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-1">
                      {task.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {task.task_type !== 'always' && task.start_time && (
                      <span className="font-medium text-foreground">
                        {new Date(task.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ~ 
                        {task.end_time && new Date(task.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    {task.role && (
                      <Badge variant="secondary" className="px-1 py-0 text-[10px] font-normal h-4">
                        {task.role.name}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}