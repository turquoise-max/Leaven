'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { Task, getDashboardTasks, toggleTaskCheckitem, updateTaskStatus } from '../task-actions'
import { getTodayDateString, toKSTISOString } from '@/shared/lib/date-utils'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Clock, CheckCircle2, User, Users, Calendar, Plus, Trash2, StopCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { deleteTask } from '../task-actions'
import { CreatePersonalTaskDialog } from './create-personal-task-dialog'

// 타임라인 내 시간 문자열("HH:mm")을 파싱하여 분(minute)으로 반환
function parseTimeToMinutes(timeString: string): number {
  let hourStr = '00'
  let minStr = '00'

  if (timeString.includes('T')) {
    // UTC/ISO 시간이 넘어왔을 때 한국 시간(KST)으로 변환 후 추출
    const kstString = toKSTISOString(timeString)
    const timePart = kstString.split('T')[1]
    if (timePart && timePart.length >= 5) {
      hourStr = timePart.substring(0, 2)
      minStr = timePart.substring(3, 5)
    }
  } else if (timeString.length >= 5) {
    // 순수 "09:00:00" 형태
    hourStr = timeString.substring(0, 2)
    minStr = timeString.substring(3, 5)
  }
  
  return Number(hourStr) * 60 + Number(minStr)
}

// 시간 문자열 포맷팅 헬퍼 (HH:mm)
function formatTimeLabel(timeString: string): string {
  if (!timeString) return '';
  if (timeString.includes('T')) {
    const kstString = toKSTISOString(timeString)
    const timePart = kstString.split('T')[1]
    if (timePart && timePart.length >= 5) {
      return timePart.substring(0, 5)
    }
  } else if (timeString.length >= 5) {
    return timeString.substring(0, 5)
  }
  return timeString;
}

// 업무 상태 도출 로직 (스케줄 관리 페이지와 동일하되, 시간 텍스트 기반으로 정확히 비교)
function getDerivedTaskStatus(task: Task, now: Date): 'todo' | 'in_progress' | 'pending' | 'done' {
  if (task.status === 'done') return 'done'
  if (!task.start_time) return 'todo'
  if (task.task_type === 'always') return 'todo'

  const taskMins = parseTimeToMinutes(task.start_time)
  const nowMins = now.getHours() * 60 + now.getMinutes()
  
  const diffMins = nowMins - taskMins

  if (diffMins < 0) {
    // 아직 시작 시간이 안 됨
    return 'todo'
  } else if (diffMins >= 0 && diffMins <= 30) {
    // 시작 시간 ~ 30분 이내
    return 'in_progress'
  } else {
    // 30분 초과
    return 'pending'
  }
}

import { TaskAttendanceWidget } from '@/features/attendance/components/task-attendance-widget'

interface DashboardTaskListProps {
  storeId: string
  roleId: string | null
  attendanceStatus?: 'none' | 'working' | 'completed'
  currentUserId?: string
}

// 로컬 스토리지 키 생성 유틸리티
function getRoutineStorageKey(userId: string | undefined, date: string) {
  return `routine_tasks_${userId || 'anonymous'}_${date}`
}

export function DashboardTaskList({ storeId, roleId, attendanceStatus, currentUserId }: DashboardTaskListProps) {
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

  // 당일 루틴 업무 상태 (Local Storage 기반)
  const [routineStatus, setRoutineStatus] = useState<Record<string, {
    status: 'todo' | 'done',
    checkedItems: string[]
  }>>({})

  // 1분마다 현재 시간 갱신
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  // Local Storage에서 당일 루틴 상태 불러오기
  useEffect(() => {
    const today = getTodayDateString()
    const key = getRoutineStorageKey(currentUserId, today)
    try {
      const stored = localStorage.getItem(key)
      if (stored) {
        setRoutineStatus(JSON.parse(stored))
      } else {
        // 어제 이전의 찌꺼기 데이터 청소 (옵션)
        for (let i = 0; i < localStorage.length; i++) {
           const k = localStorage.key(i)
           if (k?.startsWith(`routine_tasks_${currentUserId || 'anonymous'}_`) && k !== key) {
             localStorage.removeItem(k)
           }
        }
      }
    } catch (e) {
      console.error('Failed to parse routine status from local storage')
    }
  }, [currentUserId])

  // 루틴 상태가 변경될 때마다 Local Storage 동기화
  const saveRoutineStatusToStorage = (newStatus: typeof routineStatus) => {
    const today = getTodayDateString()
    const key = getRoutineStorageKey(currentUserId, today)
    localStorage.setItem(key, JSON.stringify(newStatus))
    setRoutineStatus(newStatus)
  }

  const fetchTasks = async () => {
    try {
      setLoading(true)
      const today = getTodayDateString()
      
      // getDashboardTasks가 이제 is_template=true인 플레이북 데이터와 
      // 오늘 날짜의 내 스케줄(task_assignments)에 속한 세부 할 일 데이터를 한 번에 가져옵니다.
      const data = await getDashboardTasks(storeId, today)
      
      // 받은 데이터를 클라이언트에서 용도에 맞게 분리합니다.
      // 이제 루틴/플레이북 여부는 is_routine을 기준으로 합니다.
      const normalTasks = data?.filter(t => !t.is_routine) || []
      const playbookTasks = data?.filter(t => t.is_routine) || []
      
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

  const handleChecklistToggle = async (taskId: string, itemId: string, checked: boolean, isRoutine?: boolean) => {
    if (isRoutine) {
      // 템플릿(루틴)인 경우 프론트엔드 로컬 상태만 업데이트
      const currentTaskStatus = routineStatus[taskId] || { status: 'todo', checkedItems: [] }
      let newCheckedItems = [...currentTaskStatus.checkedItems]
      
      if (checked && !newCheckedItems.includes(itemId)) {
        newCheckedItems.push(itemId)
      } else if (!checked) {
        newCheckedItems = newCheckedItems.filter(id => id !== itemId)
      }
      
      // 해당 템플릿의 전체 체크리스트 항목 수 구하기
      const task = roleTasks.find(t => t.id === taskId)
      const totalChecklists = task?.checklist?.length || 0
      
      const allCompleted = totalChecklists > 0 && newCheckedItems.length === totalChecklists
      const newStatusVal = allCompleted ? 'done' : 'todo'
      
      saveRoutineStatusToStorage({
        ...routineStatus,
        [taskId]: {
          status: newStatusVal,
          checkedItems: newCheckedItems
        }
      })
      return
    }

    // 일반 개인/할당 업무인 경우 DB 연동
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

  const handleStatusChange = async (taskId: string, status: 'todo' | 'in_progress' | 'done', isRoutine?: boolean) => {
      if (isRoutine) {
        // 템플릿(루틴) 통째로 완료/미완료 토글 시 처리
        const task = roleTasks.find(t => t.id === taskId)
        let newCheckedItems: string[] = []
        
        // 'done'으로 변경하면 내부의 모든 체크리스트를 체크된 상태로 만듦
        if (status === 'done' && task?.checklist) {
          newCheckedItems = task.checklist.map(item => item.id)
        }
        
        saveRoutineStatusToStorage({
          ...routineStatus,
          [taskId]: {
            status: status === 'done' ? 'done' : 'todo',
            checkedItems: newCheckedItems
          }
        })
        return
      }

      setTasks(prev => prev.map(task => {
          if (task.id !== taskId) return task
          // 메인 상태가 'done'이면 모든 하위 항목도 체크, 아니면 전부 해제
          const newChecklist = task.checklist?.map(item => ({
              ...item,
              is_completed: status === 'done'
          })) || []
          return { ...task, status, checklist: newChecklist }
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
        // KST 기준의 정확한 시간 텍스트 라벨 가져오기
        const key = formatTimeLabel(task.start_time)
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
    <>
      <div className="flex flex-col h-full bg-white rounded-xl border border-black/10 shadow-sm overflow-hidden select-none">
      <div className="p-3 md:p-4 border-b border-black/5 bg-[#fbfbfb] flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            <h2 className="text-[14px] md:text-[16px] font-semibold text-[#1a1a1a] flex items-center gap-1.5 shrink-0">
                <Clock className="w-4 h-4 md:w-[18px] md:h-[18px] text-[#1a1a1a]" />
                <span className="truncate">오늘의 타임라인</span>
            </h2>
            <div className="hidden xs:block w-px h-4 bg-black/10 mx-0.5 md:mx-1 shrink-0" />
            <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
              <Switch 
                id="show-guide" 
                checked={showPlaybook} 
                onCheckedChange={setShowPlaybook} 
                className="scale-[0.75] md:scale-90"
              />
              <Label htmlFor="show-guide" className="text-[10px] md:text-[12px] font-medium text-[#6b6b6b] cursor-pointer whitespace-nowrap">
                <span className="hidden xs:inline">루틴 업무</span>
                <span className="xs:hidden">루틴</span>
              </Label>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
            <Badge variant="outline" className="hidden sm:inline-flex text-[10px] md:text-[11px] font-medium bg-white text-[#6b6b6b] border-black/10 px-1.5 md:px-2.5">
                <span>{formattedDate}</span>
            </Badge>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-6 w-6 md:h-7 md:w-7 rounded-md border-black/10 shadow-sm"
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

      <ScrollArea className="flex-1 p-3 md:p-5 h-full relative bg-[#fbfbfb]" ref={scrollRef}>
          <div className="flex flex-col min-h-full pt-2 md:pt-4 pb-32">
            
            {/* 상시 업무 및 플레이북 영역 (시간 미지정) */}
            {mergedAnytimeTasks.length > 0 && (
              <div className="mb-4 md:mb-8">
                <div className="flex items-center gap-2 mb-2 md:mb-3">
                  <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#6b6b6b]" />
                  <h3 className="text-[12px] md:text-[13px] font-bold text-[#1a1a1a]">상시 업무 {showPlaybook && '& 루틴'}</h3>
                  <span className="hidden xs:inline text-[10px] md:text-[11px] text-[#6b6b6b] font-medium bg-black/5 px-1.5 py-0.5 rounded-md">시간 미지정</span>
                  <Badge variant="secondary" className="ml-auto bg-black/5 text-[#1a1a1a] font-bold shadow-none border-none text-[10px] md:text-[11px] px-1.5 h-5">{mergedAnytimeTasks.length}</Badge>
                </div>
                <div className="space-y-2 md:space-y-2.5">
                  {mergedAnytimeTasks.map(task => {
                    const rStatus = task.is_routine ? routineStatus[task.id] : undefined;
                    return (
                      <TaskCard 
                        key={task.id} 
                        task={task} 
                        now={now}
                        routineStatus={rStatus}
                        onCheck={handleChecklistToggle} 
                        onStatusChange={handleStatusChange}
                        onDelete={() => handleDeleteTask(task.id)}
                        isDeleting={deletingId === task.id}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {/* 타임라인 영역 */}
            <div className="relative flex-1 pl-10 md:pl-12 pr-0 md:pr-1 mt-1 md:mt-2">
              {/* 왼쪽 수직 기준선 */}
              <div className="absolute left-[46px] md:left-[54px] top-2 bottom-4 w-px bg-black/10" />

              {groupedTasks.length === 0 && mergedAnytimeTasks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <CheckCircle2 className="w-10 h-10 mb-2 opacity-20" />
                  <p className="text-sm">오늘 예정된 업무가 없습니다</p>
                </div>
              )}

              {groupedTasks.map((group, i) => {
                // 이전 업무와의 시간 차이에 비례한 여백 계산
                let marginTopClass = "mt-3 md:mt-4"
                if (i > 0) {
                   const prev = groupedTasks[i-1]
                   const diffMins = (group.hour * 60 + group.minute) - (prev.hour * 60 + prev.minute)
                   
                   if (diffMins <= 30) marginTopClass = "mt-1.5 md:mt-2"
                   else if (diffMins <= 60) marginTopClass = "mt-4 md:mt-6"
                   else if (diffMins <= 120) marginTopClass = "mt-6 md:mt-10"
                   else marginTopClass = "mt-10 md:mt-16"
                }

                // 과거인지 판단
                const isPast = (group.hour * 60 + group.minute) < (now.getHours() * 60 + now.getMinutes())

                return (
                  <div key={group.time} className={cn("relative z-10", marginTopClass)}>
                    <div className="flex items-center">
                      {/* 시간 라벨 (왼쪽) */}
                      <div className="absolute -left-[46px] md:-left-[54px] w-[38px] md:w-[46px] text-right">
                        <span className="text-[10px] md:text-xs font-semibold text-muted-foreground bg-transparent py-1">
                          {group.time}
                        </span>
                      </div>

                      {/* 노드 (점) */}
                      <div className="absolute -left-[4.5px] flex items-center justify-center">
                        <div className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-[#1a1a1a] border-2 border-[#fbfbfb] shadow-sm z-10" />
                      </div>

                      {/* 카드 목록 */}
                      <div className={cn("flex-1 flex flex-col gap-1.5 md:gap-2 pl-3 md:pl-4 transition-opacity", isPast ? "opacity-60 hover:opacity-100" : "")}>
                        {group.tasks.map(task => {
                          const rStatus = task.is_routine ? routineStatus[task.id] : undefined;
                          return (
                            <TaskCard 
                              key={task.id} 
                              task={task} 
                              now={now}
                              routineStatus={rStatus}
                              onCheck={handleChecklistToggle} 
                              onStatusChange={handleStatusChange}
                              onDelete={() => handleDeleteTask(task.id)}
                              isDeleting={deletingId === task.id}
                            />
                          )
                        })}
                      </div>
                    </div>
                    
                    {/* 현재 시간 표시선 (이 그룹 직후가 현재 시간일 때) */}
                    {i === currentLineGroupIndex && (
                       <div className="relative h-8 md:h-12 flex items-center -ml-[46px] md:-ml-[54px] z-20">
                          <div className="w-[42px] md:w-[50px] text-right pr-[7px] shrink-0 flex justify-end">
                            <div className="bg-[#1D9E75] text-white text-[8px] md:text-[9px] font-bold px-1 md:px-1.5 py-0.5 rounded-md shadow-[0_2px_4px_rgba(29,158,117,0.4)] whitespace-nowrap">
                              {now.getHours().toString().padStart(2, '0')}:{now.getMinutes().toString().padStart(2, '0')}
                            </div>
                          </div>
                          <div className="w-1.5 md:w-[7px] h-1.5 md:h-[7px] rounded-full bg-[#1D9E75] border-[1.5px] border-white shrink-0 z-20 -ml-[3px] md:-ml-[3.5px] shadow-[0_0_4px_rgba(29,158,117,0.6)]" />
                          <div className="flex-1 h-[1.5px] bg-gradient-to-r from-[rgba(29,158,117,0.8)] via-[rgba(29,158,117,0.3)] to-transparent" />
                       </div>
                    )}

                  </div>
                )
              })}
              
              {/* 타임라인 시작 전일 경우 시간 표시선 (제일 위에) */}
              {groupedTasks.length > 0 && currentLineGroupIndex === -1 && (
                 <div className="absolute top-0 left-0 right-0 h-0 flex items-center z-20">
                    <div className="w-[42px] md:w-[50px] text-right pr-[7px] shrink-0 flex justify-end">
                      <div className="bg-[#1D9E75] text-white text-[8px] md:text-[9px] font-bold px-1 md:px-1.5 py-0.5 rounded-md shadow-[0_2px_4px_rgba(29,158,117,0.4)] whitespace-nowrap">
                        {now.getHours().toString().padStart(2, '0')}:{now.getMinutes().toString().padStart(2, '0')}
                      </div>
                    </div>
                    <div className="w-1.5 md:w-[7px] h-1.5 md:h-[7px] rounded-full bg-[#1D9E75] border-[1.5px] border-white shrink-0 z-20 -ml-[3px] md:-ml-[3.5px] shadow-[0_0_4px_rgba(29,158,117,0.6)]" />
                    <div className="flex-1 h-[1.5px] bg-gradient-to-r from-[rgba(29,158,117,0.8)] via-[rgba(29,158,117,0.3)] to-transparent" />
                 </div>
              )}

            </div>
            
          </div>
      </ScrollArea>

      </div>

      <CreatePersonalTaskDialog 
        storeId={storeId}
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={fetchTasks}
      />
    </>
  )
}

interface TaskCardProps {
  task: Task
  now: Date
  routineStatus?: { status: 'todo' | 'done', checkedItems: string[] }
  onCheck: (taskId: string, itemId: string, checked: boolean, isRoutine?: boolean) => void
  onStatusChange: (taskId: string, status: 'todo' | 'in_progress' | 'done', isRoutine?: boolean) => void
  onDelete: () => void
  isDeleting: boolean
}

function TaskCard({ task, now, routineStatus, onCheck, onStatusChange, onDelete, isDeleting }: TaskCardProps) {
  const isRoutine = task.is_routine === true
  const isDone = isRoutine ? (routineStatus?.status === 'done') : (task.status === 'done')
  
  // 템플릿(가이드) 이거나 역할에 배정된 경우 뱃지 표시
  const isRoleTask = isRoutine || (task.assigned_role_ids && task.assigned_role_ids.length > 0)
  const isPersonal = !isRoutine && (!task.assigned_role_ids || task.assigned_role_ids.length === 0)
  
  // 템플릿의 경우 로컬 완료 상태 우선, 아니면 시간 기반 상태
  const derivedStatus = isRoutine 
    ? (routineStatus?.status === 'done' ? 'done' : getDerivedTaskStatus(task, now))
    : getDerivedTaskStatus(task, now)

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
        "transition-all border-l-[3px] rounded-r-lg bg-white shadow-sm hover:shadow border-t border-r border-b border-black/5 flex flex-col p-2 md:p-3.5 gap-1 md:gap-2",
        isRoutine ? "border-l-[#534AB7]/40 bg-slate-50/50" : statusColorClass // 템플릿은 별도 컬러 처리
    )}>
        <div className="flex items-start gap-2 md:gap-2.5">
            <Checkbox 
                checked={isDone}
                onCheckedChange={() => onStatusChange(task.id, isDone ? 'todo' : 'done', isRoutine)}
                className={cn(
                    "w-4 h-4 md:w-[18px] md:h-[18px] mt-0.5 rounded-md transition-colors",
                    isRoutine ? "border-black/20 data-[state=checked]:bg-[#534AB7] data-[state=checked]:border-[#534AB7]" : checkboxClass
                )}
            />
            
            <div className="flex flex-col gap-0.5 md:gap-1 min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 md:gap-4">
                <div className="flex items-center gap-1.5 md:gap-2 flex-wrap min-w-0">
                  <h4 className={cn("font-bold text-[12px] md:text-[13px] text-[#1a1a1a] leading-tight md:truncate break-all whitespace-normal", isDone && "line-through text-muted-foreground opacity-60")}>
                      {task.title}
                  </h4>
                  {isRoutine ? (
                    <Badge variant="secondary" className="text-[8px] md:text-[9px] px-1 md:px-1.5 py-0 h-4 md:h-[18px] font-medium bg-[#534AB7]/10 text-[#534AB7] border-none">루틴</Badge>
                  ) : isRoleTask ? (
                    <Badge variant="secondary" className="text-[8px] md:text-[9px] px-1 md:px-1.5 py-0 h-4 md:h-[18px] font-medium bg-blue-500/10 text-blue-600 border-none">역할 업무</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[8px] md:text-[9px] px-1 md:px-1.5 py-0 h-4 md:h-[18px] font-medium bg-amber-500/10 text-amber-700 border-none">개인</Badge>
                  )}
                </div>
                
                {isPersonal && (
                  <button 
                    className="shrink-0 w-5 h-5 md:w-6 md:h-6 flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
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
                <p className={cn("text-[11px] whitespace-pre-wrap leading-snug break-all", isRoutine ? "text-muted-foreground" : "text-[#6b6b6b]", isDone && !isRoutine && "opacity-60")}>
                    {task.description}
                </p>
              )}
            </div>
        </div>
        
        {task.checklist && task.checklist.length > 0 && (
          <div className="pl-6 md:pl-7 space-y-1.5 md:space-y-2 mt-0.5 md:mt-1">
            {task.checklist.map(item => {
              const isItemCompleted = isRoutine 
                ? (routineStatus?.checkedItems?.includes(item.id) || false) 
                : item.is_completed
              
              return (
                <div key={item.id} className="flex items-start gap-1.5 md:gap-2">
                   <Checkbox 
                      checked={isItemCompleted}
                      onCheckedChange={(c) => onCheck(task.id, item.id, !!c, isRoutine)}
                      className={cn(
                        "w-3 md:w-3.5 h-3 md:h-3.5 mt-0.5 rounded-sm border-black/20 transition-colors shrink-0", 
                        isRoutine 
                          ? (isItemCompleted && "data-[state=checked]:bg-[#534AB7] data-[state=checked]:border-[#534AB7]")
                          : (isItemCompleted && "data-[state=checked]:bg-[#1D9E75] data-[state=checked]:border-[#1D9E75]")
                      )}
                   />
                   <span className={cn(
                     "text-[10px] md:text-[11px] font-medium text-[#1a1a1a] transition-all break-all", 
                     isItemCompleted && "line-through text-muted-foreground opacity-60"
                   )}>
                     {item.text}
                   </span>
                </div>
              )
            })}
          </div>
        )}
    </div>
  )
}
