'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { Task, getDashboardTasks, toggleTaskCheckitem, updateTaskStatus } from '../task-actions'
import { getTodayDateString } from '@/shared/lib/date-utils'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Clock, CheckCircle2, User, Users, Calendar, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { deleteTask } from '../task-actions'

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
  roleId: string | null
}

export function DashboardTaskList({ storeId, roleId }: DashboardTaskListProps) {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    title: '',
    date: getTodayDateString(),
    startTime: '09:00',
    endTime: '10:00',
    staffId: ''
  })
  
  const [tasks, setTasks] = useState<Task[]>([])
  const [roleTasks, setRoleTasks] = useState<Task[]>([])
  const [showPlaybook, setShowPlaybook] = useState(true)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(new Date())
  const scrollRef = useRef<HTMLDivElement>(null)

  const [deletingId, setDeletingId] = useState<string | null>(null)

  // 1분마다 현재 시간 갱신
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const fetchTasks = async () => {
    try {
      setLoading(true)
      const today = getTodayDateString()
      
      // getDashboardTasks가 이제 is_template=true인 플레이북 데이터와 
      // 오늘 날짜의 내 스케줄(task_assignments)에 속한 세부 할 일 데이터를 한 번에 가져옵니다.
      const data = await getDashboardTasks(storeId, today)
      
      // 받은 데이터를 클라이언트에서 용도에 맞게 분리합니다.
      const normalTasks = data?.filter(t => !t.is_template) || []
      const playbookTasks = data?.filter(t => t.is_template) || []
      
      setTasks(normalTasks)
      setRoleTasks(playbookTasks)
      
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [storeId, roleId])

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

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('이 업무를 정말 삭제하시겠습니까?')) return
    
    setDeletingId(taskId)
    // Optimistic Update
    setTasks(prev => prev.filter(t => t.id !== taskId))
    
    const result = await deleteTask(taskId)
    if (result.error) {
      toast.error('삭제 실패: ' + result.error)
      fetchTasks() // 실패 시 롤백
    } else {
      toast.success('업무가 삭제되었습니다.')
    }
    setDeletingId(null)
  }

  // 업무 분류 로직 (상시 업무 vs 시간 지정 업무)
  const { anytimeTasks, groupedTasks, mergedAnytimeTasks } = useMemo(() => {
    const anytime: Task[] = []
    const groups: Record<string, Task[]> = {}

    // 통합 배열 생성 (토글 여부에 따라 roleTasks 포함)
    const combinedTasks = showPlaybook ? [...tasks, ...roleTasks] : [...tasks]

    // 모든 태스크(일반 + 가이드)를 순회하며 그룹화
    combinedTasks.forEach(task => {
      // 상시 업무(시간 미지정) 분류
      if (!task.start_time || task.task_type === 'always') {
        anytime.push(task)
      } else {
        // 시간 지정 업무 처리
        // 날짜 파싱 오류(NaN) 방지를 위해 문자열 기반 추출을 우선으로 하되 정규식/안전 파싱 적용
        let hourStr = '00'
        let minStr = '00'
        
        if (task.start_time.includes('T')) {
          // 예: "2024-03-24T09:00:00Z" 혹은 "2024-03-24T09:00:00+09:00"
          const timePart = task.start_time.split('T')[1]
          if (timePart && timePart.length >= 5) {
            hourStr = timePart.substring(0, 2)
            minStr = timePart.substring(3, 5)
          } else {
            // fallback
            const d = new Date(task.start_time)
            if (!isNaN(d.getTime())) {
              hourStr = d.getHours().toString().padStart(2, '0')
              minStr = d.getMinutes().toString().padStart(2, '0')
            }
          }
        } else {
          // 예: "09:00:00" (Date 파싱 시 무조건 Invalid Date 가 될 수 있으므로 문자열로 자름)
          if (task.start_time.length >= 5) {
            hourStr = task.start_time.substring(0, 2)
            minStr = task.start_time.substring(3, 5)
          }
        }
        
        const key = `${hourStr}:${minStr}`
        if (!groups[key]) groups[key] = []
        groups[key].push(task)
      }
    })

    const groupedArray = Object.entries(groups).map(([time, items]) => {
      const parts = time.split(':')
      const h = parts.length > 0 ? Number(parts[0]) : 0
      const m = parts.length > 1 ? Number(parts[1]) : 0
      return { time, hour: h, minute: m, tasks: items }
    }).sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute))

    return { anytimeTasks: anytime, groupedTasks: groupedArray, mergedAnytimeTasks: anytime }
  }, [tasks, roleTasks, showPlaybook])

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
    <div className="flex flex-col h-full bg-white rounded-xl border border-black/10 shadow-sm overflow-hidden select-none">
      <div className="p-4 border-b border-black/5 bg-[#fbfbfb] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-[16px] font-semibold text-[#1a1a1a] flex items-center gap-2">
                <Clock className="w-[18px] h-[18px] text-[#1a1a1a]" />
                오늘의 타임라인
            </h2>
            <div className="w-px h-4 bg-black/10 mx-1" />
            <div className="flex items-center gap-2">
              <Switch 
                id="show-guide" 
                checked={showPlaybook} 
                onCheckedChange={setShowPlaybook} 
                className="scale-90"
              />
              <Label htmlFor="show-guide" className="text-[12px] font-medium text-[#6b6b6b] cursor-pointer">가이드 표시</Label>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-[11px] font-medium bg-white text-[#6b6b6b] border-black/10">
                {formattedDate}
            </Badge>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-7 w-7 rounded-md border-black/10 shadow-sm"
                    onClick={() => {
                      setCreateForm({
                        title: '개인 업무',
                        date: getTodayDateString(),
                        startTime: '09:00',
                        endTime: '10:00',
                        staffId: '' // 서버 연동 시 본인 아이디를 사용하거나 내부적으로 알아서 할당됨
                      })
                      setCreateModalOpen(true)
                    }}
                  >
                    <Plus className="w-4 h-4 text-[#1a1a1a]" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="text-[11px]">개인 업무 추가</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
      </div>

      <ScrollArea className="flex-1 p-5 h-full relative bg-[#fbfbfb]" ref={scrollRef}>
          <div className="flex flex-col min-h-full pb-10">
            
            {/* 상시 업무 및 플레이북 영역 (시간 미지정) */}
            {mergedAnytimeTasks.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-[#6b6b6b]" />
                  <h3 className="text-[13px] font-bold text-[#1a1a1a]">상시 업무 {showPlaybook && '& 가이드'}</h3>
                  <span className="text-[11px] text-[#6b6b6b] font-medium bg-black/5 px-1.5 py-0.5 rounded-md">시간 미지정</span>
                  <Badge variant="secondary" className="ml-auto bg-black/5 text-[#1a1a1a] font-bold shadow-none border-none">{mergedAnytimeTasks.length}</Badge>
                </div>
                <div className="space-y-2.5">
                  {mergedAnytimeTasks.map(task => (
                    <TaskCard 
                      key={task.id} 
                      task={task} 
                      now={now}
                      onCheck={handleChecklistToggle} 
                      onStatusChange={handleStatusChange}
                      onDelete={() => handleDeleteTask(task.id)}
                      isDeleting={deletingId === task.id}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 타임라인 영역 */}
            <div className="relative flex-1 pl-12 pr-1 mt-2">
              {/* 왼쪽 수직 기준선 */}
              <div className="absolute left-[54px] top-2 bottom-4 w-px bg-black/10" />

              {groupedTasks.length === 0 && mergedAnytimeTasks.length === 0 && (
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
                    <div className="absolute -left-[4.5px] top-[9px] flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#1a1a1a] border-2 border-[#fbfbfb] shadow-sm z-10" />
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
                          onDelete={() => handleDeleteTask(task.id)}
                          isDeleting={deletingId === task.id}
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

      {/* 
        실제 서비스에서는 TaskCreateDialog 등 '개인 업무' 전용 모달 컴포넌트를 import하여 렌더링합니다.
        일단 UI 흐름을 위해 열림 상태만 관리하고, 추후 전용 모달이 제작되면 여기에 연결합니다.
      */}
    </div>
  )
}

interface TaskCardProps {
  task: Task
  now: Date
  onCheck: (taskId: string, itemId: string, checked: boolean) => void
  onStatusChange: (taskId: string, status: 'todo' | 'in_progress' | 'done') => void
  onDelete: () => void
  isDeleting: boolean
}

function TaskCard({ task, now, onCheck, onStatusChange, onDelete, isDeleting }: TaskCardProps) {
  const isDone = task.status === 'done'
  const isTemplate = task.is_template === true
  
  // 템플릿(가이드) 이거나 역할에 배정된 경우 뱃지 표시
  const isRoleTask = isTemplate || (task.assigned_role_ids && task.assigned_role_ids.length > 0)
  const isPersonal = !isTemplate && (!task.assigned_role_ids || task.assigned_role_ids.length === 0)
  
  const derivedStatus = getDerivedTaskStatus(task, now)

  // 색상 매핑
  const statusColorClass = {
    todo: "border-l-black/20",
    in_progress: "border-l-blue-500",
    pending: "border-l-red-500",
    done: "border-l-[#1D9E75] bg-[#1D9E75]/5"
  }[derivedStatus]

  const checkboxClass = {
    todo: "border-black/20 data-[state=checked]:bg-[#1a1a1a] data-[state=checked]:border-[#1a1a1a]",
    in_progress: "border-blue-500 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500",
    pending: "border-red-500 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500",
    done: "border-[#1D9E75] data-[state=checked]:bg-[#1D9E75] data-[state=checked]:border-[#1D9E75] text-white"
  }[derivedStatus]

  return (
    <div className={cn(
        "transition-all border-l-[3px] rounded-r-lg bg-white shadow-sm hover:shadow border-t border-r border-b border-black/5 flex flex-col p-3.5 gap-2",
        isTemplate ? "border-l-[#534AB7]/40 bg-slate-50/50" : statusColorClass // 템플릿은 별도 컬러 처리
    )}>
        <div className="flex items-start gap-2.5">
            {!isTemplate ? (
              <Checkbox 
                  checked={isDone}
                  onCheckedChange={() => onStatusChange(task.id, isDone ? 'todo' : 'done')}
                  className={cn(
                      "w-[18px] h-[18px] mt-0.5 rounded-md transition-colors",
                      checkboxClass
                  )}
              />
            ) : (
              <div className="w-[18px] h-[18px] mt-0.5 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-[#534AB7]/40" />
              </div>
            )}
            
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <h4 className={cn("font-bold text-[13px] text-[#1a1a1a] leading-tight truncate", isDone && !isTemplate && "line-through text-muted-foreground opacity-60")}>
                      {task.title}
                  </h4>
                  {isTemplate ? (
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-[18px] font-medium bg-[#534AB7]/10 text-[#534AB7] border-none">가이드</Badge>
                  ) : isRoleTask ? (
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-[18px] font-medium bg-blue-500/10 text-blue-600 border-none">역할 업무</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-[18px] font-medium bg-amber-500/10 text-amber-700 border-none">개인</Badge>
                  )}
                </div>
                
                {isPersonal && (
                  <button 
                    className="shrink-0 w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                    title="업무 삭제"
                    disabled={isDeleting}
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete()
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              
              {task.description && (
                <p className={cn("text-[11px] whitespace-pre-wrap leading-snug", isTemplate ? "text-muted-foreground" : "text-[#6b6b6b]", isDone && !isTemplate && "opacity-60")}>
                    {task.description}
                </p>
              )}
            </div>
        </div>
        
        {task.checklist && task.checklist.length > 0 && (
          <div className="pl-7 space-y-2 mt-1">
            {task.checklist.map(item => (
              <div key={item.id} className="flex items-start gap-2">
                 {!isTemplate ? (
                   <Checkbox 
                      checked={item.is_completed}
                      onCheckedChange={(c) => onCheck(task.id, item.id, !!c)}
                      className={cn("w-3.5 h-3.5 mt-0.5 rounded-sm border-black/20", item.is_completed && "data-[state=checked]:bg-[#1D9E75] data-[state=checked]:border-[#1D9E75]")}
                   />
                 ) : (
                   <div className="w-[3px] h-[3px] rounded-full bg-muted-foreground mt-[7px] shrink-0" />
                 )}
                 <span className={cn("text-[11px] font-medium text-[#1a1a1a]", item.is_completed && !isTemplate && "line-through text-muted-foreground opacity-60")}>
                   {item.text}
                 </span>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
