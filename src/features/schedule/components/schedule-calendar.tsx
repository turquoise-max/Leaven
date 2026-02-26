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
    },
    backgroundColor: '#3b82f6',
  }))

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
          events={events}
          editable={canManage}
          selectable={canManage}
          selectMirror={true}
          dayMaxEvents={true}
          weekends={true}
          height="100%"
          slotMinTime="06:00:00"
          slotMaxTime="24:00:00"
          allDaySlot={false}
          locale="ko"
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
