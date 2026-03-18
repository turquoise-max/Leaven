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
import { X, Filter, Sparkles, ChevronDown, Trash2, Plus, Clock, Users } from 'lucide-react'
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

// Helper: 시간을 HH:mm 형식으로 포맷팅 (KST 시간열 기준)
function formatTimeRange(startIso: string, endIso: string) {
  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    const h = date.getHours()
    const m = String(date.getMinutes()).padStart(2, '0')
    const ampm = h < 12 ? '오전' : '오후'
    const h12 = h % 12 || 12
    return `${ampm} ${h12}:${m}`
  }
  return `${formatTime(startIso)} - ${formatTime(endIso)}`
}

// Render Function (Pure)
const renderEventContent = (eventInfo: any) => {
  const { event, view } = eventInfo
  const isMonthView = view.type === 'dayGridMonth'
  
  // 1) 월간 뷰 전용 (통합 이벤트 - 알약(Pill) 스타일 디자인 개선)
  if (isMonthView && event.extendedProps.isGrouped) {
    const groupedMembers = event.extendedProps.groupedMembers || []
    const totalCount = groupedMembers.length
    const maxAvatars = 3

    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div 
              className="mx-0.5 w-[calc(100%-4px)] flex items-center justify-between px-1.5 py-1 rounded-full bg-muted/40 border border-border/50 cursor-pointer hover:bg-muted/70 hover:border-border transition-all shadow-sm"
            >
              <div className="flex items-center">
                {groupedMembers.slice(0, maxAvatars).map((m: any, idx: number) => (
                  <div 
                    key={`${m.memberId}-${idx}`} 
                    className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-[0_0_0_1.5px_hsl(var(--background))] shrink-0"
                    style={{ backgroundColor: m.roleColor, zIndex: maxAvatars - idx, marginLeft: idx > 0 ? '-6px' : '0' }}
                  >
                    {m.userName.charAt(0)}
                  </div>
                ))}
                {totalCount > maxAvatars && (
                  <div 
                    className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-bold bg-secondary text-secondary-foreground shadow-[0_0_0_1.5px_hsl(var(--background))] shrink-0"
                    style={{ marginLeft: '-6px', zIndex: 0 }}
                  >
                    <Plus className="w-2 h-2 opacity-70" strokeWidth={3} />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground mr-1">
                <Users className="w-2.5 h-2.5 opacity-70" />
                <span>{totalCount}명</span>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" align="start" className="flex flex-col gap-3 z-[100] w-72 shadow-xl border bg-background text-foreground p-3">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-1.5 font-bold text-sm">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span>해당일 근무자</span>
              </div>
              <Badge variant="secondary" className="px-2 py-0.5 h-5 text-xs font-semibold bg-muted text-foreground/80">{totalCount}명</Badge>
            </div>
            <div className="flex flex-col gap-3.5 max-h-[320px] overflow-y-auto pr-1">
              {groupedMembers.map((m: any, idx: number) => (
                <div key={`${m.memberId}-${idx}`} className="flex items-start gap-2.5 group">
                  <div 
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0 mt-0.5"
                    style={{ backgroundColor: m.roleColor }}
                  >
                    {m.userName.charAt(0)}
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm truncate">{m.userName}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-sm whitespace-nowrap" style={{ color: m.roleColor, backgroundColor: hexToRgba(m.roleColor, 0.1) }}>
                        {m.roleName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3 opacity-60 shrink-0" />
                      <span className="truncate max-w-[90px] text-foreground/70" title={m.title}>
                        {m.title !== '근무' ? m.title : '기본 근무'}
                      </span>
                      <span className="opacity-40 text-[10px] px-0.5">•</span>
                      <span className="font-medium text-foreground/80 whitespace-nowrap">{formatTimeRange(m.start, m.end)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // 2) 주간/일간 뷰 전용 (개별 이벤트)
  const members = event.extendedProps.members || []
  let title = event.title !== 'untitled' ? event.title : '근무'

  const baseColor = event.extendedProps.color || members[0]?.roleColor || '#808080'
  const style = {
    backgroundColor: hexToRgba(baseColor, 0.1),
    borderColor: baseColor,
    borderLeftWidth: '4px',
  }

  let displayTitle = title
  if (members.length === 1) {
      const m = members[0]
      if (title && title !== '근무') {
          displayTitle = `[${m.roleName}] ${m.userName} (${title})`
      } else {
          displayTitle = `[${m.roleName}] ${m.userName}`
      }
  } else if (members.length > 1) {
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
                <span className="text-[9px] opacity-70 whitespace-nowrap truncate">{eventInfo.timeText}</span>
            </div>
            
            {/* 멤버 목록 (아바타 형태, 주간뷰는 6개까지 표시) */}
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
        {/* 툴팁 (공통) */}
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
    const filteredEvents = initialEvents.filter((event) => {
      const members = event.schedule_members || []
      
      // 1. Staff Filter
      if (selectedStaffId !== 'all') {
        const hasStaff = members.some((m: any) => m.member_id === selectedStaffId)
        if (!hasStaff) return false
      }

      // 2. Role Filter
      if (selectedRoleId !== 'all') {
        const hasRole = members.some((m: any) => {
          const staff = staffList.find(s => s.id === m.member_id)
          return staff?.role_info?.id === selectedRoleId
        })
        if (!hasRole) return false
      }

      return true
    })

    if (currentView === 'dayGridMonth') {
      // 월간 뷰: 날짜별로 모든 스케줄과 멤버를 하나로 통합 (Grouping)
      const groupsByDate: Record<string, any[]> = {}
      
      filteredEvents.forEach(event => {
        const kstStart = toKSTISOString(event.start_time)
        const dateKey = kstStart.split('T')[0] // 'YYYY-MM-DD'

        if (!groupsByDate[dateKey]) {
          groupsByDate[dateKey] = []
        }

        const members = (event.schedule_members || []).map((m: any) => {
          const staff = staffList.find(s => s.id === m.member_id)
          return {
              memberId: staff?.id || m.member_id,
              userName: staff?.name || staff?.profile?.full_name || m.member?.name || m.member?.profile?.full_name || '미지정',
              roleName: staff?.role_info?.name || staff?.role || 'Staff',
              roleColor: staff?.role_info?.color || '#808080',
              roleId: staff?.role_info?.id,
              // 근무 시간 표시를 위해 원본 이벤트 정보 포함
              start: kstStart,
              end: toKSTISOString(event.end_time),
              title: event.title || '근무'
          }
        })
        
        groupsByDate[dateKey].push(...members)
      })

      return Object.entries(groupsByDate).map(([date, groupedMembers]) => {
        // 동일 인물이 같은 날 여러 스케줄을 가질 수 있으므로 이름 오름차순/시작시간 순 정렬
        groupedMembers.sort((a, b) => {
            if (a.start !== b.start) return a.start.localeCompare(b.start)
            return a.userName.localeCompare(b.userName)
        })

        return {
          id: `grouped-${date}`,
          title: '근무 현황',
          start: date, // All-day 이벤트 형식으로 날짜만 지정하여 캘린더 한 칸을 통째로 차지하도록 함
          allDay: true,
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          textColor: 'inherit',
          // 드래그나 리사이징을 막기 위해 false 처리 가능 (월간 뷰에서 통합된 이벤트이므로)
          editable: false, 
          extendedProps: {
            isGrouped: true,
            groupedMembers: groupedMembers
          }
        }
      })
    } else {
      // 주간/일간 뷰: 개별 이벤트 그대로 노출
      return filteredEvents.map((event) => {
        const members = (event.schedule_members || []).map((m: any) => {
          const staff = staffList.find(s => s.id === m.member_id)
          return {
              id: staff?.id || m.member_id,
              userName: staff?.name || staff?.profile?.full_name || m.member?.name || m.member?.profile?.full_name || '미지정',
              roleName: staff?.role_info?.name || staff?.role || 'Staff',
              roleColor: staff?.role_info?.color || '#808080',
              roleId: staff?.role_info?.id
          }
        })

        return {
          id: event.id,
          title: event.title || '근무',
          start: toKSTISOString(event.start_time),
          end: toKSTISOString(event.end_time),
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          textColor: 'inherit',
          editable: canManage,
          extendedProps: {
            members: members,
            memo: event.memo,
            title: event.title,
            color: event.color,
            origin: event 
          }
        }
      })
    }
  }, [initialEvents, staffList, selectedStaffId, selectedRoleId, currentView, canManage])

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
    
    const event = info.event
    const props = event.extendedProps

    // 월간 뷰에서 "그룹화된 이벤트"를 클릭한 경우, 편집 모달 대신 일간 뷰로 전환
    if (props.isGrouped) {
      const api = calendarRef.current?.getApi()
      api?.gotoDate(event.startStr)
      api?.changeView('timeGridDay')
      setCurrentView('timeGridDay')
      return
    }

    // 이제 항상 수정 모드로 진입 (단일 스케줄 객체이므로)
    setDialogMode('edit')
    setSelectedDate(null)
    setInitialTime(undefined)
    
    // 원본 데이터가 있으면 그것을, 없으면 구성해서 전달
    const eventData = props.origin || {
        id: event.id,
        start: event.startStr,
        end: event.endStr,
        title: props.title,
        memo: props.memo,
        schedule_members: (props.members || []).map((m: any) => ({ member_id: m.id }))
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
            nowIndicatorContent={(arg) => {
              const now = arg.date
              const h = String(now.getHours()).padStart(2, '0')
              const m = String(now.getMinutes()).padStart(2, '0')
              return (
                <div className="relative flex items-center justify-end pr-0.5">
                  <div className="absolute right-3 bg-[#1D9E75] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-[0_2px_4px_rgba(29,158,117,0.4)] whitespace-nowrap">
                    {h}:{m}
                  </div>
                  <div className="w-[7px] h-[7px] rounded-full bg-[#1D9E75] border-[1.5px] border-white shadow-[0_0_4px_rgba(29,158,117,0.6)] z-10" />
                </div>
              )
            }}
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
