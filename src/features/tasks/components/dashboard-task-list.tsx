'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { Task, getDashboardTasks, toggleTaskCheckitem, updateTaskStatus } from '../actions'
import { getTodayDateString } from '@/lib/date-utils'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Clock, CheckCircle2, User, Users, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

// 업무 상태 도출 로직 (스케줄 관리 페이지와 동일)
function getDerivedTaskStatus(task: Task, now: Date): 'todo' | 'in_progress' | 'pending' | 'done' {
  if (task.status === 'done') return 'done'
  if (!task.start_time) return 'todo'

  const taskDateObj = new Date(task.start_time)
  if (isNaN(taskDateObj.getTime())) return 'todo'

  const startTimeMs = taskDateObj.getTime()
  const nowMs = now.getTime()
  const thirtyMinsMs = 30 * 60 * 1000

  if (nowMs < startTimeMs) {
    return 'todo'
  } else if (nowMs >= startTimeMs && nowMs < startTimeMs + thirtyMinsMs) {
    return 'in_progress'
  } else {
    return 'pending'
  }
}

interface DashboardTaskListProps {
  storeId: string
}

export function DashboardTaskList({ storeId }: DashboardTaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(new Date())
  const scrollRef = useRef<HTMLDivElement>(null)

  // 1분마다 현재 시간 갱신
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const fetchTasks = async () => {
    try {
      const today = getTodayDateString()
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
    setTasks(prev => prev.map(task => {
        if (task.id !== taskId) return task
        const newChecklist = task.checklist?.map(item => 
            item.id === itemId ? { ...item, is_completed: checked } : item
        ) || []
        const allCompleted = newChecklist.length > 0 && newChecklist.every(item => item.is_completed)
        const newStatus = allCompleted ? 'done' : (task.status === 'done' ? 'todo' : task.status)
        return { ...task, checklist: newChecklist, status: newStatus }
    }))
    const result = await toggleTaskCheckitem(taskId, itemId, checked)
    if (result.error) fetchTasks()
  }

  const handleStatusChange = async (taskId: string, status: 'todo' | 'in_progress' | 'done') => {
      setTasks(prev => prev.map(task => {
          if (task.id !== taskId) return task
          return { ...task, status }
      }))
      const result = await updateTaskStatus(taskId, status)
      if (result.error) fetchTasks()
  }

  // 업무 분류 로직 (상시 업무 vs 시간 지정 업무)
  const { anytimeTasks, groupedTasks } = useMemo(() => {
    const anytime: Task[] = []
    const groups: Record<string, Task[]> = {}

    tasks.forEach(task => {
      if (!task.start_time || task.task_type === 'always') {
        anytime.push(task)
      } else {
        const d = new Date(task.start_time)
        const hour = d.getHours()
        const min = d.getMinutes()
        const key = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`
        if (!groups[key]) groups[key] = []
        groups[key].push(task)
      }
    })

    const groupedArray = Object.entries(groups).map(([time, items]) => {
      const [h, m] = time.split(':').map(Number)
      return { time, hour: h, minute: m, tasks: items }
    }).sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute))

    return { anytimeTasks: anytime, groupedTasks: groupedArray }
  }, [tasks])

  // 현재 시간선 위치 계산용
  const [currentLineGroupIndex, setCurrentLineGroupIndex] = useState(-1)
  
  useEffect(() => {
    if (groupedTasks.length === 0) return
    const currentMins = now.getHours() * 60 + now.getMinutes()
    let lastPassedIndex = -1
    for (let i = 0; i < groupedTasks.length; i++) {
       const groupMins = groupedTasks[i].hour * 60 + groupedTasks[i].minute
       if (currentMins >= groupMins) {
          lastPassedIndex = i
       } else {
          break
       }
    }
    setCurrentLineGroupIndex(lastPassedIndex)
  }, [now, groupedTasks])

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
    <div className="space-y-4 h-full flex flex-col min-h-0 bg-background rounded-xl border shadow-sm p-4">
      <div className="flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              오늘의 타임라인
          </h2>
          <Badge variant="outline" className="text-xs font-normal">
              {formattedDate}
          </Badge>
      </div>

      <ScrollArea className="flex-1 -mx-4 px-4 h-full relative" ref={scrollRef}>
          <div className="flex flex-col min-h-full pb-10 pt-2">
            
            {/* 상시 업무 영역 */}
            {anytimeTasks.length > 0 && (
              <Accordion type="single" collapsible defaultValue="anytime" className="mb-6 mx-1 border rounded-lg bg-muted/20">
                <AccordionItem value="anytime" className="border-none">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/40 transition-colors rounded-t-lg">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">상시 업무 (시간 미지정)</span>
                      <Badge variant="secondary" className="ml-2 bg-background border">{anytimeTasks.length}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 pt-1 space-y-2">
                    {anytimeTasks.map(task => (
                      <TaskCard 
                        key={task.id} 
                        task={task} 
                        now={now}
                        onCheck={handleChecklistToggle} 
                        onStatusChange={handleStatusChange}
                      />
                    ))}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            {/* 타임라인 영역 */}
            <div className="relative flex-1 pl-12 pr-1">
              {/* 왼쪽 수직 기준선 */}
              <div className="absolute left-[54px] top-4 bottom-4 w-0.5 bg-border/60" />

              {groupedTasks.length === 0 && anytimeTasks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <CheckCircle2 className="w-10 h-10 mb-2 opacity-20" />
                  <p className="text-sm">오늘 예정된 업무가 없습니다</p>
                </div>
              )}

              {groupedTasks.map((group, i) => {
                // 이전 업무와의 시간 차이에 비례한 여백 계산
                let marginTopClass = "mt-4"
                if (i > 0) {
                   const prev = groupedTasks[i-1]
                   const diffMins = (group.hour * 60 + group.minute) - (prev.hour * 60 + prev.minute)
                   
                   if (diffMins <= 30) marginTopClass = "mt-2"
                   else if (diffMins <= 60) marginTopClass = "mt-6"
                   else if (diffMins <= 120) marginTopClass = "mt-10"
                   else marginTopClass = "mt-16"
                }

                // 과거인지 판단
                const isPast = (group.hour * 60 + group.minute) < (now.getHours() * 60 + now.getMinutes())

                return (
                  <div key={group.time} className={cn("relative z-10", marginTopClass)}>
                    
                    {/* 시간 라벨 (왼쪽) */}
                    <div className="absolute -left-[54px] top-1 w-[46px] text-right">
                       <span className="text-xs font-semibold text-muted-foreground bg-background py-1">
                         {group.time}
                       </span>
                    </div>

                    {/* 노드 (점) */}
                    <div className="absolute -left-[5px] top-[9px] flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full bg-primary border-2 border-background shadow-sm z-10" />
                      
                      {group.tasks.some(t => t.assigned_role_ids && t.assigned_role_ids.length > 0) && (
                        <div className="absolute w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center animate-pulse z-0" />
                      )}
                    </div>

                    {/* 카드 목록 */}
                    <div className={cn("flex flex-col gap-2 pl-4 transition-opacity", isPast ? "opacity-60 hover:opacity-100" : "")}>
                      {group.tasks.map(task => (
                        <TaskCard 
                          key={task.id} 
                          task={task} 
                          now={now}
                          onCheck={handleChecklistToggle} 
                          onStatusChange={handleStatusChange}
                        />
                      ))}
                    </div>
                    
                    {/* 현재 시간 표시선 (이 그룹 직후가 현재 시간일 때) */}
                    {i === currentLineGroupIndex && (
                       <div className="relative h-12 flex items-center -ml-[54px] z-20">
                          <div className="w-[50px] text-right pr-[7px] shrink-0 flex justify-end">
                            <div className="bg-[#1D9E75] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-[0_2px_4px_rgba(29,158,117,0.4)] whitespace-nowrap">
                              {now.getHours().toString().padStart(2, '0')}:{now.getMinutes().toString().padStart(2, '0')}
                            </div>
                          </div>
                          <div className="w-[7px] h-[7px] rounded-full bg-[#1D9E75] border-[1.5px] border-white shrink-0 z-20 -ml-[3.5px] shadow-[0_0_4px_rgba(29,158,117,0.6)]" />
                          <div className="flex-1 h-[1.5px] bg-gradient-to-r from-[rgba(29,158,117,0.8)] via-[rgba(29,158,117,0.3)] to-transparent" />
                       </div>
                    )}

                  </div>
                )
              })}
              
              {/* 타임라인 시작 전일 경우 시간 표시선 (제일 위에) */}
              {groupedTasks.length > 0 && currentLineGroupIndex === -1 && (
                 <div className="absolute top-0 left-0 right-0 h-0 flex items-center z-20">
                    <div className="w-[50px] text-right pr-[7px] shrink-0 flex justify-end">
                      <div className="bg-[#1D9E75] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-[0_2px_4px_rgba(29,158,117,0.4)] whitespace-nowrap">
                        {now.getHours().toString().padStart(2, '0')}:{now.getMinutes().toString().padStart(2, '0')}
                      </div>
                    </div>
                    <div className="w-[7px] h-[7px] rounded-full bg-[#1D9E75] border-[1.5px] border-white shrink-0 z-20 -ml-[3.5px] shadow-[0_0_4px_rgba(29,158,117,0.6)]" />
                    <div className="flex-1 h-[1.5px] bg-gradient-to-r from-[rgba(29,158,117,0.8)] via-[rgba(29,158,117,0.3)] to-transparent" />
                 </div>
              )}

            </div>
          </div>
      </ScrollArea>
    </div>
  )
}

interface TaskCardProps {
  task: Task
  now: Date
  onCheck: (taskId: string, itemId: string, checked: boolean) => void
  onStatusChange: (taskId: string, status: 'todo' | 'in_progress' | 'done') => void
}

function TaskCard({ task, now, onCheck, onStatusChange }: TaskCardProps) {
  const isDone = task.status === 'done'
  const isRoleTask = task.assigned_role_ids && task.assigned_role_ids.length > 0
  const derivedStatus = getDerivedTaskStatus(task, now)

  // 색상 매핑
  const statusColorClass = {
    todo: "border-l-gray-400",
    in_progress: "border-l-blue-500",
    pending: "border-l-red-500",
    done: "border-l-green-500 bg-green-50/30"
  }[derivedStatus]

  const checkboxClass = {
    todo: "",
    in_progress: "data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500",
    pending: "border-red-500/50 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500",
    done: "data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
  }[derivedStatus]

  return (
    <Card className={cn(
        "transition-all border-l-4 shadow-sm hover:shadow-md",
        statusColorClass
    )}>
        <CardHeader className="p-3 pb-2">
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1">
                    <Checkbox 
                        checked={isDone}
                        onCheckedChange={() => onStatusChange(task.id, isDone ? 'todo' : 'done')}
                        className={cn(
                            "w-4 h-4 mt-0.5",
                            checkboxClass
                        )}
                    />
                    <div>
                      <h4 className={cn("font-medium text-sm leading-tight", isDone && "line-through text-muted-foreground")}>
                          {task.title}
                      </h4>
                      <div className="flex items-center gap-1 mt-1">
                        {isRoleTask ? (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 font-normal bg-indigo-100 text-indigo-700">공통/역할</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 font-normal bg-blue-100 text-blue-700">개인 업무</Badge>
                        )}
                      </div>
                    </div>
                </div>
            </div>
        </CardHeader>
        
        {((task.description) || (task.checklist && task.checklist.length > 0)) && (
            <CardContent className="p-3 pt-0 space-y-2">
                {task.description && (
                  <p className="text-xs text-muted-foreground pl-6 whitespace-pre-wrap">
                      {task.description}
                  </p>
                )}
                
                {task.checklist && task.checklist.length > 0 && (
                  <div className="pl-6 space-y-1.5 pt-1">
                    {task.checklist.map(item => (
                      <div key={item.id} className="flex items-start gap-2">
                         <Checkbox 
                            checked={item.is_completed}
                            onCheckedChange={(c) => onCheck(task.id, item.id, !!c)}
                            className="w-3.5 h-3.5 mt-0.5 rounded-sm"
                         />
                         <span className={cn("text-xs", item.is_completed && "line-through text-muted-foreground")}>
                           {item.text}
                         </span>
                      </div>
                    ))}
                  </div>
                )}
            </CardContent>
        )}
    </Card>
  )
}