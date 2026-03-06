'use client'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { Task, updateTask } from '../actions'
import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { CheckCircle2, Clock, Circle, Filter, X } from 'lucide-react'
import { EditTaskDialog } from './edit-task-dialog'
import { CreateTaskDialog } from './create-task-dialog'
import { EventClickArg, EventDropArg } from '@fullcalendar/core'
import { EventResizeDoneArg } from '@fullcalendar/interaction'
import { TaskFormData } from './task-form'
import { toast } from 'sonner'
import { toKSTISOString, revertKSTToUTC } from '@/lib/date-utils'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { CalendarHeader } from '@/components/common/calendar-header'

const slotLabelFormat = {
  hour: 'numeric' as const,
  minute: '2-digit' as const,
  omitZeroMinute: false,
  meridiem: 'short' as const
}

const dayHeaderFormat = {
  weekday: 'short' as const,
  day: 'numeric' as const
}

interface TaskCalendarProps {
  tasks: Task[]
  roles: any[]
  openingHours?: any
  storeId: string
  canManage?: boolean
}

export function TaskCalendar({ tasks, roles, openingHours, storeId, canManage = false }: TaskCalendarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Filter State from URL
  const selectedRoleId = searchParams.get('roleId') || 'all'

  // Update URL Helper
  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams)
    if (value && value !== 'all') {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.replace(`${pathname}?${params.toString()}`)
  }

  const clearFilters = () => {
    router.replace(pathname)
  }

  // Calendar Ref & State
  const calendarRef = useRef<FullCalendar>(null)
  const [currentView, setCurrentView] = useState('timeGridWeek')
  const [currentTitle, setCurrentTitle] = useState('')

  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [initialTaskData, setInitialTaskData] = useState<Partial<TaskFormData>>({})

  // Calendar Controls
  const handlePrev = useCallback(() => {
    const api = calendarRef.current?.getApi()
    api?.prev()
  }, [])

  const handleNext = useCallback(() => {
    const api = calendarRef.current?.getApi()
    api?.next()
  }, [])

  const handleToday = useCallback(() => {
    const api = calendarRef.current?.getApi()
    api?.today()
  }, [])

  const handleViewChange = useCallback((view: string) => {
    const api = calendarRef.current?.getApi()
    api?.changeView(view)
    setCurrentView(view)
  }, [])

  const handleDatesSet = useCallback((arg: any) => {
    setCurrentTitle(arg.view.title)
    setCurrentView(arg.view.type)
  }, [])

  const handleEventClick = (info: EventClickArg) => {
    if (!canManage) return
    const task = info.event.extendedProps.originalTask
    if (task) {
        setSelectedTask(task)
        setIsEditOpen(true)
    }
  }

  const handleDateSelect = (info: any) => {
    if (!canManage) return
    const startStr = info.startStr // ISO string
    const endStr = info.endStr

    if (startStr.includes('T')) {
      // 시간 선택 시 (TimeGrid)
      const start = startStr.split('T')[1].substring(0, 5)
      const end = endStr.split('T')[1].substring(0, 5)
      
      setInitialTaskData({
        task_type: 'scheduled',
        start_date: startStr.split('T')[0],
        end_date: startStr.split('T')[0],
        start_time: start,
        end_time: end,
      })
    } else {
      // 날짜만 선택 시 (Month View 등) -> 기본값만 설정
      setInitialTaskData({
        task_type: 'scheduled',
        start_date: startStr,
        end_date: startStr,
        start_time: '09:00',
        end_time: '10:00',
      })
    }
    setIsCreateOpen(true)
  }

  const handleDateClick = (info: any) => {
    if (!canManage) return
    // 빈 공간 클릭 시
    if (info.dateStr.includes('T')) {
       const [dateStr, timeStr] = info.dateStr.split('T')
       const start = timeStr.substring(0, 5)
       // 기본 1시간
       const [h, m] = start.split(':').map(Number)
       const endH = (h + 1) % 24
       const end = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`

       setInitialTaskData({
         task_type: 'scheduled',
         start_date: dateStr,
         end_date: dateStr,
         start_time: start,
         end_time: end,
       })
       setIsCreateOpen(true)
    }
  }

  const handleEventDrop = async (info: EventDropArg) => {
    const task = info.event.extendedProps.originalTask
    if (!task) return

    // scheduled 업무만 드래그 가능 (상시 업무는 날짜 이동만 가능하지만, 여기서는 허용)
    // always 업무도 이동 가능하게 하려면 로직 필요.
    // 여기서는 둘 다 허용.

    const newStart = info.event.start
    const newEnd = info.event.end

    if (!newStart) {
        info.revert()
        return
    }
    
    // 만약 end가 없으면 (allDay 이동 시 등), start + 1시간? 
    // always 업무는 end가 없을 수 있음 (allDay).
    // scheduled 업무는 end가 있어야 함. FullCalendar가 자동으로 계산해서 줄 수도 있음.
    
    // toKSTISOString으로 인해 캘린더 상의 시간은 이미 9시간이 더해진 "가짜 시간"입니다.
    // 따라서 저장할 때는 다시 9시간을 빼서 "진짜 UTC 시간"으로 되돌려야 합니다.
    const startIso = revertKSTToUTC(newStart)
    const endIso = newEnd ? revertKSTToUTC(newEnd) : null

    try {
        const result = await updateTask({
            id: task.id,
            start_time: startIso,
            end_time: endIso
        })

        if (result?.error) {
            toast.error('업무 이동 실패', { description: result.error as string })
            info.revert()
        } else {
            toast.success('업무 시간이 변경되었습니다.')
        }
    } catch (error) {
        console.error(error)
        toast.error('오류가 발생했습니다.')
        info.revert()
    }
  }

  const handleEventResize = async (info: EventResizeDoneArg) => {
    const task = info.event.extendedProps.originalTask
    if (!task) return

    if (task.task_type !== 'scheduled') {
        info.revert()
        return
    }

    const newStart = info.event.start
    const newEnd = info.event.end

    if (!newStart || !newEnd) {
        info.revert()
        return
    }

    // toKSTISOString으로 인해 캘린더 상의 시간은 이미 9시간이 더해진 "가짜 시간"입니다.
    // 따라서 저장할 때는 다시 9시간을 빼서 "진짜 UTC 시간"으로 되돌려야 합니다.
    const startIso = revertKSTToUTC(newStart)
    const endIso = revertKSTToUTC(newEnd)

    try {
        const result = await updateTask({
            id: task.id,
            start_time: startIso,
            end_time: endIso
        })

        if (result?.error) {
            toast.error('업무 시간 변경 실패', { description: result.error as string })
            info.revert()
        } else {
            toast.success('업무 시간이 변경되었습니다.')
        }
    } catch (error) {
        console.error(error)
        toast.error('오류가 발생했습니다.')
        info.revert()
    }
  }

  // 운영 시간 범위 계산 (Memoized)
  const { minTime, maxTime } = useMemo(() => {
    let min = '06:00:00'
    let max = '24:00:00'

    if (openingHours && Object.keys(openingHours).length > 0) {
      let earliestStart = '23:59'
      let latestEnd = '00:00'
      let hasValidData = false

      Object.values(openingHours).forEach((day: any) => {
        if (day.closed) return
        
        hasValidData = true
        // 운영 시간(start_time/end_time) 우선, 없으면 영업 시간(open/close)
        const start = day.start_time || day.open || '09:00'
        const end = day.end_time || day.close || '22:00'
        
        if (start < earliestStart) earliestStart = start
        
        // 종료 시간 처리
        let endCompare = end
        
        // 자정(00:00)인 경우 24:00으로 처리
        if (end === '00:00') {
           endCompare = '24:00'
        } else if (end < start) {
           // 종료 시간이 시작 시간보다 빠른 경우 (새벽 영업)
           const [h, m] = end.split(':').map(Number)
           endCompare = `${h + 24}:${String(m).padStart(2, '0')}`
        }
        
        if (endCompare > latestEnd) latestEnd = endCompare
      })
      
      if (hasValidData) {
        if (earliestStart !== '23:59') {
            min = `${earliestStart}:00`
        }
        if (latestEnd !== '00:00') {
             max = `${latestEnd}:00`
        }
      }
    }
    
    return { minTime: min, maxTime: max }
  }, [openingHours])

  // Convert tasks to FullCalendar events & Apply Filters
  const events = useMemo(() => {
    const mappedEvents = tasks.map(task => {
      // Role color mapping
      const role = roles.find(r => r.id === task.assigned_role_id)
      let color = role ? role.color : '#808080'
      const title = `${task.title} (${role ? role.name : '전체'})`
      
      // 상태에 따른 색상 (상시 업무 제외)
      if (task.task_type !== 'always') {
          const now = new Date()
          const start = task.start_time ? new Date(task.start_time) : null
          const end = task.end_time ? new Date(task.end_time) : null

          if (task.status === 'done') {
              color = '#22c55e' // Green-500 (완료)
          } else if (task.status === 'in_progress') {
              color = '#3b82f6' // Blue-500 (진행 중 - 수동 상태)
          } else if (start && end && now >= start && now <= end) {
              color = '#3b82f6' // Blue-500 (진행 중 - 시간 기준)
          } else if (end && now > end) {
              color = '#ef4444' // Red-500 (지연됨 - Overdue)
          } else {
              color = '#6b7280' // Gray-500 (예정 - Todo)
          }
      }

      // Base event object
      const baseEvent = {
        id: task.id,
        title: title,
        backgroundColor: color,
        borderColor: color,
        textColor: '#fff',
        extendedProps: {
          description: task.description,
          roleName: role ? role.name : '전체',
          assignedRoleId: task.assigned_role_id, // For Filtering
          isCritical: task.is_critical,
          taskType: task.task_type,
          status: task.status,
          checklist: task.checklist,
          originalTask: task
        },
        editable: canManage // 권한에 따라 드래그/리사이즈 허용
      }

      // Handle 'always' tasks
      if (task.task_type === 'always') {
        // 상시 업무는 날짜 기준, 시간 없음 -> All Day
        return {
          ...baseEvent,
          start: toKSTISOString(task.start_time || ''), // ISO String (Date part used by FC for allDay)
          allDay: true,
          // 상시 업무는 리사이즈 불가 (시간이 없으므로)
          durationEditable: false 
        }
      }

      // Handle 'scheduled' tasks
      if (task.task_type === 'scheduled') {
        return {
          ...baseEvent,
          start: toKSTISOString(task.start_time || ''), // UTC -> KST 변환 (Z 제거)
          end: toKSTISOString(task.end_time || '')
        }
      }

      return null
    }).filter(Boolean) as any[]

    // Apply Filter
    if (selectedRoleId !== 'all') {
      return mappedEvents.filter(event => event.extendedProps.assignedRoleId === selectedRoleId)
    }

    return mappedEvents
  }, [tasks, roles, selectedRoleId])

  // Duration calculation helper
  function calculateDuration(start: string, end: string) {
    const [h1, m1] = start.split(':').map(Number)
    const [h2, m2] = end.split(':').map(Number)
    let diffMinutes = (h2 * 60 + m2) - (h1 * 60 + m1)
    if (diffMinutes < 0) diffMinutes += 24 * 60 // Next day
    const hours = Math.floor(diffMinutes / 60)
    const minutes = diffMinutes % 60
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }

  const renderEventContent = (eventInfo: any) => {
    const { status, taskType } = eventInfo.event.extendedProps
    
    return (
      <div className="p-1 overflow-hidden h-full flex flex-col justify-between">
        <div className="flex items-start gap-1">
            {taskType !== 'always' && (
                <div className="mt-0.5">
                    {status === 'done' ? (
                        <CheckCircle2 className="w-3 h-3" />
                    ) : status === 'in_progress' ? (
                        <Clock className="w-3 h-3" />
                    ) : (
                        <Circle className="w-3 h-3" />
                    )}
                </div>
            )}
            <div className="font-semibold text-xs truncate leading-tight">
            {eventInfo.event.title}
            </div>
        </div>
        {eventInfo.timeText && (
          <div className="text-[10px] opacity-80 mt-auto text-right">
            {eventInfo.timeText}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full w-full border rounded-md bg-background overflow-hidden">
      <CalendarHeader
        title={currentTitle}
        view={currentView}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        onViewChange={handleViewChange}
      >
        <div className="flex items-center gap-2">
          <Select 
            value={selectedRoleId} 
            onValueChange={(val) => updateFilter('roleId', val)}
          >
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="전체 역할" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 역할</SelectItem>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: role.color }} />
                    {role.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedRoleId !== 'all' && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={clearFilters}
              >
                <X className="w-4 h-4" />
              </Button>
          )}
        </div>
      </CalendarHeader>

      <div className="flex-1 overflow-hidden">
        <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={false}
            events={events}
            eventContent={renderEventContent}
            eventClick={handleEventClick}
            select={handleDateSelect}
            dateClick={handleDateClick}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            editable={canManage} 
            selectable={canManage}
            selectMirror={true}
            nowIndicator={true}
            allDaySlot={true}
            slotMinTime={minTime}
            slotMaxTime={maxTime}
            height="100%"
            locale="ko"
            timeZone="Asia/Seoul"
            weekends={true}
            firstDay={1}
            slotLabelFormat={slotLabelFormat}
            dayHeaderFormat={dayHeaderFormat}
            datesSet={handleDatesSet}
        />
      </div>
      
      <EditTaskDialog 
        task={selectedTask}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        storeId={storeId}
      />

      <CreateTaskDialog
        storeId={storeId}
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        initialValues={initialTaskData}
        trigger={null} // Hide default trigger
      />
    </div>
  )
}