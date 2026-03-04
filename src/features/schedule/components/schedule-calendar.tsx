'use client'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ScheduleDialog } from './schedule-dialog'
import { updateScheduleTime } from '@/features/schedule/actions'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'

interface ScheduleCalendarProps {
  initialEvents: any[]
  staffList: any[]
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

// UTC 시간을 KST 시간 문자열로 변환 (FullCalendar 표시용)
// 예: "2024-03-04T22:00:00Z" (UTC) -> "2024-03-05T07:00:00" (KST, Z 제거)
function convertUTCToKSTString(dateStr: string) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  // UTC 시간에 9시간을 더해 KST 시간 생성
  const kstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  // ISO String으로 변환 후 'Z'를 제거하여 "로컬 시간"처럼 보이게 함
  return kstDate.toISOString().replace('Z', '')
}

// Static Options (Prevent Re-render)
const headerToolbar = {
  left: 'prev,next today',
  center: 'title',
  right: 'dayGridMonth,timeGridWeek,timeGridDay',
}

const buttonText = {
  today: '오늘',
  month: '월',
  week: '주',
  day: '일',
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
  const title = event.title !== 'untitled' ? event.title : '근무'

  // 스케줄 고유 색상이 있으면 사용, 없으면 첫 번째 멤버의 역할 색상 사용
  const baseColor = event.extendedProps.color || members[0]?.roleColor || '#808080'
  const style = {
    backgroundColor: hexToRgba(baseColor, 0.05),
    borderColor: baseColor,
    borderLeftWidth: '4px',
  }

  return (
    <div 
      className="w-full h-full p-1 pl-2 rounded-r-sm overflow-hidden text-xs flex flex-col justify-start"
      style={style}
    >
      {/* 시간 및 타이틀 */}
      <div className="flex items-center gap-1 mb-1 border-b pb-1 border-black/5">
          <span className="font-bold truncate text-[11px] leading-tight text-foreground/90">{title}</span>
          <span className="text-[9px] opacity-70 whitespace-nowrap ml-auto">{eventInfo.timeText}</span>
      </div>
      
      {/* 멤버 목록 */}
      <div className="flex flex-col gap-0.5 overflow-hidden">
          {members.map((member: any) => (
              <div key={member.id} className="flex items-center gap-1 truncate leading-tight text-[10px]">
                   <span className="font-medium truncate">{member.userName}</span>
                   <span 
                      className="text-[9px] px-1 rounded-[2px] opacity-90 whitespace-nowrap"
                      style={{ 
                          color: member.roleColor,
                          backgroundColor: hexToRgba(member.roleColor, 0.1)
                      }}
                   >
                      {member.roleName}
                   </span>
              </div>
          ))}
      </div>

      {members.length > 3 && (
          <div className="text-[9px] opacity-60 mt-0.5 text-right pr-1">
              + {members.length - 3} more
            </div>
      )}
    </div>
  )
}

export function ScheduleCalendar({
  initialEvents,
  staffList,
  canManage,
  storeId,
  openingHours,
}: ScheduleCalendarProps) {
  const router = useRouter()
  
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
  
  // Dialog States
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null)
  const [initialTime, setInitialTime] = useState<{ start: string; end: string } | undefined>(undefined)
  
  // Event Mapping Logic
  const events = useMemo(() => {
    return initialEvents.map((event) => {
      // 멤버 정보 매핑
      const members = (event.schedule_members || []).map((m: any) => {
        const staff = staffList.find(s => s.user_id === m.user_id)
        return {
            id: m.user_id, 
            userName: m.profile?.full_name || '미지정',
            roleName: staff?.role_info?.name || staff?.role || 'Staff',
            roleColor: staff?.role_info?.color || '#808080'
        }
      })

      return {
        id: event.id,
        title: event.title || '근무',
        start: convertUTCToKSTString(event.start_time),
        end: convertUTCToKSTString(event.end_time),
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
  }, [initialEvents, staffList])

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
        schedule_members: props.members.map((m: any) => ({ user_id: m.id }))
    }

    setSelectedEvent(eventData)
    setScheduleDialogOpen(true)
  }, [canManage])

  const handleEventDrop = useCallback(async (info: any) => {
    if (!canManage) return

    const newStart = info.event.start.toISOString()
    const newEnd = info.event.end.toISOString()
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

    const newStart = info.event.start.toISOString()
    const newEnd = info.event.end.toISOString()
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
      <div className="h-full w-full">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={headerToolbar}
          buttonText={buttonText}
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
          allDaySlot={false}
          nowIndicator={true}
          locale="ko"
          timeZone="Asia/Seoul"
          slotLabelFormat={slotLabelFormat}
          dayHeaderFormat={dayHeaderFormat}
          dateClick={handleDateClick}
          select={handleSelect}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
        />
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
    </>
  )
}