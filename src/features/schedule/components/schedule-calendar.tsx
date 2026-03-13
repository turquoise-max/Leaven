'use client'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { ScheduleDialog } from './schedule-dialog'
import { updateScheduleTime } from '@/features/schedule/actions'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { toKSTISOString, revertKSTToUTC } from '@/lib/date-utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { X, Filter, Sparkles, ChevronDown, Trash2, Plus } from 'lucide-react'
import { CalendarHeader } from '@/components/common/calendar-header'
import { AutoScheduleDialog } from './auto-schedule-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface ScheduleCalendarProps {
  initialEvents: any[]
  staffList: any[]
  roles: any[]
  canManage: boolean
  storeId: string
  openingHours?: any // Record<string, OpeningHoursData>
}

function hexToRgba(hex: string, alpha: number) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return `rgba(128, 128, 128, ${alpha})`
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(128, 128, 128, ${alpha})`
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

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

// Render Function (Pure)
const renderEventContent = (eventInfo: any) => {
  const { event } = eventInfo
  const members = event.extendedProps.members || []
  let title = event.title !== 'untitled' ? event.title : '근무'

  // 스케줄 고유 색상이 있으면 사용, 없으면 첫 번째 멤버의 역할 색상 사용
  const baseColor = event.extendedProps.color || members[0]?.roleColor || '#808080'
  const style = {
    backgroundColor: hexToRgba(baseColor, 0.1),
    borderColor: baseColor,
    borderLeftWidth: '4px',
  }

  // 1명일 경우 캘린더에 렌더링될 메인 타이틀을 "[역할] 이름" 으로 세팅
  // (만약 자동생성 스케줄처럼 title이 넘어왔다면, "[역할] 이름 (타이틀)" 형태도 고려 가능)
  let displayTitle = title
  if (members.length === 1) {
      const m = members[0]
      // title이 단순 '근무'가 아니라면 괄호 안에 병기
      if (title && title !== '근무') {
          displayTitle = `[${m.roleName}] ${m.userName} (${title})`
      } else {
          displayTitle = `[${m.roleName}] ${m.userName}`
      }
  } else if (members.length > 1) {
      // 다수인 경우 첫 번째 멤버 외 n명
      const m = members[0]
      if (title && title !== '근무') {
          displayTitle = `[${m.roleName}] ${m.userName} 외 ${members.length - 1}명 (${title})`
      } else {
          displayTitle = `[${m.roleName}] ${m.userName} 외 ${members.length - 1}명`
      }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className="w-full h-full p-1 pl-1.5 rounded-r-sm overflow-hidden text-xs flex flex-col justify-start cursor-pointer hover:brightness-95 transition-all"
            style={style}
          >
            {/* 타이틀 및 시간 */}
            <div className="flex flex-col gap-0.5 mb-1 pb-1 border-b border-black/10">
                <span className="font-bold truncate text-[10px] sm:text-[11px] leading-tight text-foreground/90" title={displayTitle}>
                    {displayTitle}
                </span>
                {/* 좁은 상태에서는 시간이 생략되거나 작게 보이도록 처리 */}
                <span className="text-[9px] opacity-70 whitespace-nowrap truncate">{eventInfo.timeText}</span>
            </div>
            
            {/* 멤버 목록 (아바타 형태) */}
            <div className="flex flex-wrap gap-1 overflow-hidden mt-0.5">
                {members.slice(0, 6).map((member: any) => (
                    <div 
                      key={member.id} 
                      className="w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[8px] sm:text-[9px] font-bold text-white shadow-sm shrink-0"
                      style={{ backgroundColor: member.roleColor }}
                      title={`[${member.roleName}] ${member.userName}`}
                    >
                      {member.userName.charAt(0)}
                    </div>
                ))}
                {members.length > 6 && (
                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[8px] sm:text-[9px] font-bold bg-black/10 text-foreground/70 shadow-sm shrink-0">
                    +{members.length - 6}
                  </div>
                )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" align="start" className="flex flex-col gap-2 z-[100] max-w-xs shadow-xl border bg-background text-foreground">
          <div className="font-bold border-b pb-1.5 flex items-center justify-between gap-4">
            <span>{title}</span>
            <span className="text-muted-foreground font-normal text-xs">{eventInfo.timeText}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {members.map((member: any) => (
              <div key={member.id} className="flex items-center gap-2 text-sm">
                <div 
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm shrink-0"
                  style={{ backgroundColor: member.roleColor }}
                >
                  {member.userName.charAt(0)}
                </div>
                <span className="font-medium truncate">{member.userName}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-sm whitespace-nowrap ml-auto" style={{ color: member.roleColor, backgroundColor: hexToRgba(member.roleColor, 0.1) }}>
                  {member.roleName}
                </span>
              </div>
            ))}
          </div>
          {event.extendedProps.memo && (
            <div className="text-xs text-muted-foreground mt-1 bg-muted/50 p-2 rounded-md border">
              {event.extendedProps.memo}
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function ScheduleCalendar({
  initialEvents,
  staffList,
  roles,
  canManage,
  storeId,
  openingHours,
}: ScheduleCalendarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Filter State from URL
  const selectedStaffId = searchParams.get('staffId') || 'all'
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
        
        // 자정(00:00)인 경우 24:00으로 처리하여 비교
        if (end === '00:00') {
           endCompare = '24:00'
        } else if (end < start) {
           // 종료 시간이 시작 시간보다 빠른 경우 (새벽 영업)
           // 베이커리 카페 특성상 드물지만, 혹시 있다면 24시를 더해줌
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
  
  // Calendar Ref & State
  const calendarRef = useRef<FullCalendar>(null)
  const [currentView, setCurrentView] = useState('timeGridWeek')
  const [currentTitle, setCurrentTitle] = useState('')

  // Mounted State for SSR Hydration Mismatch Fix
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Dialog States
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)
  const [autoScheduleOpen, setAutoScheduleOpen] = useState(false)
  const [autoScheduleMode, setAutoScheduleMode] = useState<'create' | 'delete'>('create')
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null)
  const [initialTime, setInitialTime] = useState<{ start: string; end: string } | undefined>(undefined)
  
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

  // Event Mapping & Filtering Logic
  const events = useMemo(() => {
    const mappedEvents = initialEvents.map((event) => {
      // 멤버 정보 매핑
      const members = (event.schedule_members || []).map((m: any) => {
        // member_id로 매핑
        const staff = staffList.find(s => s.id === m.member_id)
        return {
            id: staff?.id || m.member_id, // value 매핑용 id (member_id 기준)
            userName: staff?.name || staff?.profile?.full_name || m.member?.name || m.member?.profile?.full_name || '미지정',
            roleName: staff?.role_info?.name || staff?.role || 'Staff',
            roleColor: staff?.role_info?.color || '#808080',
            roleId: staff?.role_info?.id // 필터링용 Role ID
        }
      })

      return {
        id: event.id,
        title: event.title || '근무',
        start: toKSTISOString(event.start_time), // UTC -> KST 변환 (Z 제거)
        end: toKSTISOString(event.end_time),
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        textColor: 'inherit',
        extendedProps: {
          members: members,
          memo: event.memo,
          title: event.title,
          color: event.color,
          origin: event // 원본 데이터 보존
        }
      }
    })

    // Apply Filters
    return mappedEvents.filter(event => {
      const members = event.extendedProps.members

      // 1. Staff Filter
      if (selectedStaffId !== 'all') {
        const hasStaff = members.some((m: any) => m.id === selectedStaffId)
        if (!hasStaff) return false
      }

      // 2. Role Filter
      if (selectedRoleId !== 'all') {
        const hasRole = members.some((m: any) => m.roleId === selectedRoleId)
        if (!hasRole) return false
      }

      return true
    })
  }, [initialEvents, staffList, selectedStaffId, selectedRoleId])

  const handleDateClick = useCallback((info: any) => {
    if (!canManage) return

    // dateStr이 'YYYY-MM-DD' 또는 ISO String으로 옴
    const dateStr = info.dateStr.split('T')[0]
    
    setSelectedDate(dateStr)
    setDialogMode('create')
    
    if (!info.allDay) {
       // 시간 정보 추출 (YYYY-MM-DDTHH:mm:ss...)
       const timeStr = info.dateStr.split('T')[1]
       const start = timeStr ? timeStr.substring(0, 5) : '09:00'
       
       // 종료 시간은 시작 시간 + 1시간으로 계산 (간단히 문자열 파싱)
       const [hour, minute] = start.split(':').map(Number)
       const endHour = (hour + 1) % 24
       const end = `${String(endHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
       
       setInitialTime({ start, end })
    } else {
       setInitialTime(undefined)
    }

    setSelectedEvent(null)
    setScheduleDialogOpen(true)
  }, [canManage])

  const handleSelect = useCallback((info: any) => {
    if (!canManage) return
    
    // startStr이 항상 ISO String 형태 (YYYY-MM-DDTHH:mm:ss...) 또는 YYYY-MM-DD
    const dateStr = info.startStr.split('T')[0]
    
    setSelectedDate(dateStr)
    setDialogMode('create')
    
    const startStr = info.startStr
    const endStr = info.endStr

    if (startStr.includes('T')) {
       const start = startStr.split('T')[1].substring(0, 5)
       const end = endStr.split('T')[1].substring(0, 5)
       setInitialTime({ start, end })
    } else {
       setInitialTime(undefined)
    }
    
    setSelectedEvent(null)
    setScheduleDialogOpen(true)
  }, [canManage])

  const handleEventClick = useCallback((info: any) => {
    if (!canManage) return 
    
    // 이제 항상 수정 모드로 진입 (단일 스케줄 객체이므로)
    setDialogMode('edit')
    setSelectedDate(null)
    setInitialTime(undefined)
    
    // Dialog에 전달할 데이터 구성
    const event = info.event
    const props = event.extendedProps
    
    // 원본 데이터가 있으면 그것을, 없으면 구성해서 전달
    const eventData = props.origin || {
        id: event.id,
        start: event.startStr,
        end: event.endStr,
        title: props.title,
        memo: props.memo,
        schedule_members: props.members.map((m: any) => ({ member_id: m.id }))
    }

    setSelectedEvent(eventData)
    setScheduleDialogOpen(true)
  }, [canManage])

  const handleEventDrop = useCallback(async (info: any) => {
    if (!canManage) return

    // toKSTISOString으로 인해 캘린더 상의 시간은 "가짜 시간(UTC+9)"입니다.
    // 저장 시 다시 원래의 UTC 시간으로 되돌려야 합니다.
    const newStart = revertKSTToUTC(info.event.start)
    const newEnd = revertKSTToUTC(info.event.end)
    const scheduleId = info.event.id
    
    const result = await updateScheduleTime(storeId, scheduleId, newStart, newEnd)

    if (result.error) {
      toast.error(`스케줄 변경 실패: ${result.error}`)
      info.revert()
    } else {
      toast.success(`스케줄이 이동되었습니다.`)
    }
  }, [canManage, storeId])

  const handleEventResize = useCallback(async (info: any) => {
    if (!canManage) return

    // toKSTISOString으로 인해 캘린더 상의 시간은 "가짜 시간(UTC+9)"입니다.
    // 저장 시 다시 원래의 UTC 시간으로 되돌려야 합니다.
    const newStart = revertKSTToUTC(info.event.start)
    const newEnd = revertKSTToUTC(info.event.end)
    const scheduleId = info.event.id

    const result = await updateScheduleTime(storeId, scheduleId, newStart, newEnd)

    if (result.error) {
      toast.error(`스케줄 변경 실패: ${result.error}`)
      info.revert()
    } else {
      toast.success(`스케줄 시간이 변경되었습니다.`)
    }
  }, [canManage, storeId])

  return (
    <>
      <div className="flex flex-col h-full w-full border rounded-md bg-background overflow-hidden">
        <CalendarHeader
          title={currentTitle}
          view={currentView}
          onPrev={handlePrev}
          onNext={handleNext}
          onToday={handleToday}
          onViewChange={handleViewChange}
        >
          {isMounted && (
            <div className="flex items-center gap-2">
              {canManage && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs text-destructive border-destructive/20 bg-destructive/5 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      setAutoScheduleMode('delete')
                      setAutoScheduleOpen(true)
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline-block">일괄 삭제</span>
                  </Button>
                </>
              )}

              <Select 
                value={selectedStaffId} 
                onValueChange={(val) => updateFilter('staffId', val)}
              >
                <SelectTrigger className="w-[120px] h-8 text-xs">
                  <SelectValue placeholder="전체 직원" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 직원</SelectItem>
                  {staffList.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.name || staff.profile?.full_name || '이름 없음'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

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

              {(selectedStaffId !== 'all' || selectedRoleId !== 'all') && (
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
          )}
        </CalendarHeader>

        <div className="flex-1 overflow-hidden">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={false}
            events={events}
            eventContent={renderEventContent}
            editable={canManage}
            selectable={canManage}
            selectMirror={true}
            dayMaxEvents={true}
            weekends={true}
            firstDay={1}
            height="100%"
            slotMinTime={minTime}
            slotMaxTime={maxTime}
            slotEventOverlap={false}
            allDaySlot={false}
            nowIndicator={true}
            locale="ko"
            timeZone="Asia/Seoul"
            slotLabelFormat={slotLabelFormat}
            dayHeaderFormat={dayHeaderFormat}
            datesSet={handleDatesSet}
            dateClick={handleDateClick}
            select={handleSelect}
            eventClick={handleEventClick}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
          />
        </div>
      </div>

      <ScheduleDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        mode={dialogMode}
        selectedDate={selectedDate}
        selectedEvent={selectedEvent}
        staffList={staffList}
        storeId={storeId}
        initialStartTime={initialTime?.start}
        initialEndTime={initialTime?.end}
      />

      <AutoScheduleDialog
        open={autoScheduleOpen}
        onOpenChange={setAutoScheduleOpen}
        storeId={storeId}
        staffList={staffList}
        initialMode={autoScheduleMode}
      />

      {canManage && (
        <Button
          className="fixed bottom-6 right-6 md:bottom-20 md:right-20 h-14 w-14 rounded-full shadow-lg z-50 flex items-center justify-center p-0 transition-transform hover:scale-105 active:scale-95"
          onClick={() => {
            setDialogMode('create')
            setSelectedDate(null)
            setInitialTime(undefined)
            setSelectedEvent(null)
            setScheduleDialogOpen(true)
          }}
        >
          <Plus className="w-6 h-6" />
        </Button>
      )}
    </>
  )
}
