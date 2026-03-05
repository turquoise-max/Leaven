'use client'

import { useEffect, useState } from 'react'
import { Task, getDashboardTasks, toggleTaskCheckitem } from '../actions'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AlertTriangle, Clock, Calendar, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface DashboardTaskListProps {
  storeId: string
}

export function DashboardTaskList({ storeId }: DashboardTaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(new Date())
  
  // 섹션별 접기/펴기 상태 관리
  const [isUpcomingOpen, setIsUpcomingOpen] = useState(false)
  const [isDoneOpen, setIsDoneOpen] = useState(false)

  // 실시간 상태 업데이트를 위해 1분마다 현재 시간 갱신
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const fetchTasks = async () => {
    try {
      // 한국 시간 기준 오늘 날짜 구하기
      const offset = new Date().getTimezoneOffset() * 60000
      const today = new Date(Date.now() - offset).toISOString().split('T')[0]
      
      const data = await getDashboardTasks(storeId, today)
      setTasks(data || [])
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [storeId])

  const handleChecklistToggle = async (taskId: string, itemId: string, checked: boolean) => {
    // Optimistic Update
    setTasks(prev => prev.map(task => {
        if (task.id !== taskId) return task
        
        const newChecklist = task.checklist?.map(item => 
            item.id === itemId ? { ...item, is_completed: checked } : item
        ) || []
        
        // Check if all completed
        const allCompleted = newChecklist.length > 0 && newChecklist.every(item => item.is_completed)
        const newStatus = allCompleted ? 'done' : (task.status === 'done' ? 'todo' : task.status)
        
        return { ...task, checklist: newChecklist, status: newStatus }
    }))

    // Server Action
    const result = await toggleTaskCheckitem(taskId, itemId, checked)
    if (result.error) {
        // Revert on error (re-fetch)
        fetchTasks()
    }
  }

  // 상태별 분류
  const overdueTasks: Task[] = []
  const activeTasks: Task[] = []
  const upcomingTasks: Task[] = []
  const doneTasks: Task[] = []

  tasks.forEach(task => {
      if (task.status === 'done') {
          doneTasks.push(task)
          return
      }

      const start = task.start_time ? new Date(task.start_time) : null
      const end = task.end_time ? new Date(task.end_time) : null

      if (!start || !end) {
          activeTasks.push(task)
          return
      }

      if (now > end) {
          overdueTasks.push(task)
      } else if (now >= start && now <= end) {
          activeTasks.push(task)
      } else if (now < start) {
          upcomingTasks.push(task)
      }
  })

  // 날짜 포맷팅 (Intl 사용)
  const formattedDate = new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short'
  }).format(now);

  if (loading) {
      return (
          <div className="space-y-4">
              <div className="h-[100px] w-full bg-muted animate-pulse rounded-lg" />
              <div className="h-[100px] w-full bg-muted animate-pulse rounded-lg" />
          </div>
      )
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              오늘의 업무
          </h2>
          <Badge variant="outline" className="text-xs font-normal">
              {formattedDate}
          </Badge>
      </div>

      <ScrollArea className="flex-1 -mx-4 px-4">
          <div className="space-y-6 pb-6">
              
              {/* 1. 보류 (Overdue) */}
              {overdueTasks.length > 0 && (
                  <div className="space-y-3">
                      <div className="flex items-center gap-2 text-red-500 font-medium text-sm animate-pulse">
                          <AlertTriangle className="w-4 h-4" />
                          <span>놓친 업무가 있어요! ({overdueTasks.length})</span>
                      </div>
                      {overdueTasks.map(task => (
                          <TaskCard 
                              key={task.id} 
                              task={task} 
                              onCheck={handleChecklistToggle} 
                              variant="overdue"
                          />
                      ))}
                  </div>
              )}

              {/* 2. 진행 중 (Active) */}
              <div className="space-y-3">
                  <div className="flex items-center gap-2 text-primary font-medium text-sm">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>지금 해야 할 일 ({activeTasks.length})</span>
                  </div>
                  {activeTasks.length === 0 ? (
                      <div className="text-center py-8 bg-muted/30 rounded-lg border border-dashed text-muted-foreground text-sm">
                          지금 예정된 업무가 없습니다.
                      </div>
                  ) : (
                      activeTasks.map(task => (
                          <TaskCard 
                              key={task.id} 
                              task={task} 
                              onCheck={handleChecklistToggle} 
                              variant="active"
                          />
                      ))
                  )}
              </div>

              {/* 3. 예정됨 (Upcoming) */}
              {upcomingTasks.length > 0 && (
                  <div className="space-y-3">
                      <div 
                        className="flex items-center justify-between cursor-pointer group"
                        onClick={() => setIsUpcomingOpen(!isUpcomingOpen)}
                      >
                          <div className="flex items-center gap-2 text-muted-foreground font-medium text-sm group-hover:text-foreground transition-colors">
                              <Calendar className="w-4 h-4" />
                              <span>다가오는 업무 ({upcomingTasks.length})</span>
                          </div>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              {isUpcomingOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </Button>
                      </div>
                      
                      {isUpcomingOpen && (
                          <div className="space-y-2 animate-in slide-in-from-top-2 fade-in duration-200">
                              {upcomingTasks.map(task => (
                                  <TaskCard 
                                      key={task.id} 
                                      task={task} 
                                      onCheck={handleChecklistToggle} 
                                      variant="upcoming"
                                  />
                              ))}
                          </div>
                      )}
                  </div>
              )}

              {/* 4. 완료됨 (Done) */}
              {doneTasks.length > 0 && (
                   <div className="space-y-3">
                      <div 
                        className="flex items-center justify-between cursor-pointer group"
                        onClick={() => setIsDoneOpen(!isDoneOpen)}
                      >
                          <div className="flex items-center gap-2 text-muted-foreground font-medium text-sm group-hover:text-foreground transition-colors">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>완료된 업무 ({doneTasks.length})</span>
                          </div>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              {isDoneOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </Button>
                      </div>

                      {isDoneOpen && (
                          <div className="space-y-2 animate-in slide-in-from-top-2 fade-in duration-200">
                              {doneTasks.map(task => (
                                  <TaskCard 
                                      key={task.id} 
                                      task={task} 
                                      onCheck={handleChecklistToggle} 
                                      variant="done"
                                  />
                              ))}
                          </div>
                      )}
                  </div>
              )}

          </div>
      </ScrollArea>
    </div>
  )
}

interface TaskCardProps {
  task: Task
  onCheck: (taskId: string, itemId: string, checked: boolean) => void
  variant: 'overdue' | 'active' | 'upcoming' | 'done'
}

function TaskCard({ task, onCheck, variant }: TaskCardProps) {
  const isDone = variant === 'done'
  const isOverdue = variant === 'overdue'
  const isUpcoming = variant === 'upcoming'

  // Time formatting
  const formatTime = (isoString: string | null) => {
      if (!isoString) return '';
      const date = new Date(isoString);
      return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  const startTime = formatTime(task.start_time);
  const endTime = formatTime(task.end_time);

  return (
    <Card className={cn(
        "transition-all",
        isOverdue && "border-red-200 bg-red-50/50 dark:bg-red-900/10",
        isDone && "opacity-60 bg-muted/50",
        isUpcoming && "opacity-80 bg-muted/30"
    )}>
        <CardHeader className="p-4 pb-2">
            <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        {task.is_critical && (
                            <Badge variant="destructive" className="h-5 text-[10px] px-1">중요</Badge>
                        )}
                        <h4 className={cn("font-medium leading-none", isDone && "line-through text-muted-foreground")}>
                            {task.title}
                        </h4>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{startTime} ~ {endTime}</span>
                        {task.estimated_minutes > 0 && (
                            <span>({task.estimated_minutes}분)</span>
                        )}
                    </div>
                </div>
                {/* Role Badge if available */}
                {/* {task.role && ( ... )} */}
            </div>
        </CardHeader>
        <CardContent className="p-4 pt-2">
            {task.description && (
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                    {task.description}
                </p>
            )}
            
            {/* Checklist */}
            {task.checklist && task.checklist.length > 0 ? (
                <div className="space-y-2">
                    {task.checklist.map(item => (
                        <div key={item.id} className="flex items-start gap-2">
                            <Checkbox 
                                id={`check-${item.id}`}
                                checked={item.is_completed}
                                onCheckedChange={(checked) => onCheck(task.id, item.id, checked === true)}
                                disabled={isDone && false} // 완료된 것도 다시 풀 수 있게 할지? 일단 가능하게.
                                className={cn(
                                    isOverdue && "border-red-400 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                                )}
                            />
                            <label 
                                htmlFor={`check-${item.id}`}
                                className={cn(
                                    "text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 pt-0.5 cursor-pointer",
                                    item.is_completed && "line-through text-muted-foreground"
                                )}
                            >
                                {item.text}
                            </label>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-xs text-muted-foreground italic">
                    체크리스트 없음
                </div>
            )}
        </CardContent>
    </Card>
  )
}