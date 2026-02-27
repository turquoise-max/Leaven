'use client'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScheduleDialog } from './schedule-dialog'
import { updateScheduleTime } from '../actions'
import { toast } from 'sonner'

interface ScheduleCalendarProps {
  initialEvents: any[]
  staffList: any[]
  canManage: boolean
  storeId: string
}

export function ScheduleCalendar({
  initialEvents,
  staffList,
  canManage,
  storeId,
}: ScheduleCalendarProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null)

  // 이벤트 데이터 매핑
  const events = initialEvents.map((event) => ({
    id: event.id,
    title: event.profile?.full_name || '미지정',
    start: event.start_time,
    end: event.end_time,
    extendedProps: {
      userId: event.user_id,
      memo: event.memo,
      role: staffList.find(s => s.user_id === event.user_id)?.role || 'staff'
    },
    // 기본 스타일 제거 (커스텀 렌더링 사용)
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    textColor: 'inherit',
  }))

  const renderEventContent = (eventInfo: any) => {
    const { event } = eventInfo
    const role = event.extendedProps.role
    
    // 역할에 따른 색상 (예시)
    let borderColor = 'border-blue-500'
    let bgColor = 'bg-blue-50'
    let textColor = 'text-blue-700'

    if (role === 'owner') {
      borderColor = 'border-purple-500'
      bgColor = 'bg-purple-50'
      textColor = 'text-purple-700'
    } else if (role === 'manager') {
      borderColor = 'border-indigo-500'
      bgColor = 'bg-indigo-50'
      textColor = 'text-indigo-700'
    }

    return (
      <div className={`w-full h-full p-1 pl-2 border-l-4 ${borderColor} ${bgColor} ${textColor} rounded-r-sm overflow-hidden text-xs flex flex-col justify-start`}>
        <div className="font-semibold truncate">{event.title}</div>
        <div className="text-[10px] opacity-90 truncate">
          {eventInfo.timeText}
        </div>
        {event.extendedProps.memo && (
          <div className="mt-1 text-[10px] opacity-75 truncate italic">
            {event.extendedProps.memo}
          </div>
        )}
      </div>
    )
  }

  const handleDateClick = (info: any) => {
    if (!canManage) return
    setDialogMode('create')
    setSelectedDate(info.dateStr)
    setSelectedEvent(null)
    setDialogOpen(true)
  }

  const handleEventClick = (info: any) => {
    // 상세 보기만 하려면 canManage 체크 제거 또는 별도 로직
    if (!canManage) return 
    
    setDialogMode('edit')
    setSelectedDate(null)
    setSelectedEvent(info.event)
    setDialogOpen(true)
  }

  const handleEventDrop = async (info: any) => {
    if (!canManage) return

    const { event } = info
    const newStart = event.start.toISOString()
    const newEnd = event.end.toISOString()

    const result = await updateScheduleTime(storeId, event.id, newStart, newEnd)

    if (result.error) {
      toast.error('스케줄 변경 실패', { description: result.error })
      info.revert() // 변경 취소
    } else {
      toast.success('스케줄 변경 완료')
    }
  }

  return (
    <>
      <div className="h-full w-full">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          buttonText={{
            today: '오늘',
            month: '월',
            week: '주',
            day: '일',
          }}
          events={events}
          eventContent={renderEventContent}
          editable={canManage}
          selectable={canManage}
          selectMirror={true}
          dayMaxEvents={true}
          weekends={true}
          height="100%"
          slotMinTime="06:00:00"
          slotMaxTime="24:00:00"
          allDaySlot={false}
          nowIndicator={true}
          locale="ko"
          slotLabelFormat={{
            hour: 'numeric',
            minute: '2-digit',
            omitZeroMinute: false,
            meridiem: 'short'
          }}
          dayHeaderFormat={{
            weekday: 'short',
            day: 'numeric'
          }}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
        />
      </div>

      <ScheduleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        selectedDate={selectedDate}
        selectedEvent={selectedEvent}
        staffList={staffList}
        storeId={storeId}
      />
    </>
  )
}
