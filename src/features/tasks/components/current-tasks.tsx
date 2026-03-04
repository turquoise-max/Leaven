'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, Briefcase, Calendar, CheckCircle2 } from 'lucide-react'
import { Task } from '../actions'

interface CurrentTasksProps {
  tasks: Task[]
  userRole: string | null // Role name or ID
  roleId: string | null
}

export function CurrentTasks({ tasks, userRole, roleId }: CurrentTasksProps) {
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
    // 1. Role Filter
    if (task.assigned_role_id && task.assigned_role_id !== roleId) return false

    // 2. Time/Type Filter
    if (task.task_type === 'always') return true

    const currentTime = now.getHours() * 60 + now.getMinutes()
    
    if (!task.start_time || !task.end_time) return false
    
    const [startH, startM] = task.start_time.split(':').map(Number)
    const [endH, endM] = task.end_time.split(':').map(Number)
    const startTime = startH * 60 + startM
    const endTime = endH * 60 + endM

    // Handle day crossing (e.g. 23:00 ~ 02:00) - Not fully supported yet in simple logic
    // Assume tasks are within same day for now
    const isTimeMatch = currentTime >= startTime && currentTime <= endTime

    if (!isTimeMatch) return false

    if (task.task_type === 'time_specific') {
      // Assuming time_specific applies to every day for now, 
      // or we need a date field to check if it's 'today'.
      // Since we don't have date, we treat it as daily task at specific time.
      return true
    }

    if (task.task_type === 'recurring' && task.repeat_pattern) {
      const pattern = task.repeat_pattern
      if (pattern.type === 'daily') return true
      if (pattern.type === 'weekly' && pattern.days?.includes(now.getDay())) return true
      if (pattern.type === 'monthly' && pattern.date === now.getDate()) return true
      // Hourly logic is complex, skipping for simple dashboard view or treating as daily range
      if (pattern.type === 'hourly') return true 
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
          <Badge variant="outline" className="font-normal text-xs bg-background">
            {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 기준
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {currentTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <CheckCircle2 className="w-10 h-10 mb-2 opacity-20" />
            <p className="text-sm">현재 예정된 업무가 없습니다.</p>
            <p className="text-xs">잠시 휴식을 취하세요!</p>
          </div>
        ) : (
          <div className="divide-y">
            {currentTasks.map(task => (
              <div key={task.id} className="p-4 hover:bg-muted/50 transition-colors flex items-start gap-3">
                <div className="mt-1">
                  {task.task_type === 'always' ? (
                    <Briefcase className="w-4 h-4 text-orange-500" />
                  ) : task.task_type === 'recurring' ? (
                    <Calendar className="w-4 h-4 text-green-500" />
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
                        {task.start_time.slice(0, 5)} ~ {task.end_time?.slice(0, 5)}
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