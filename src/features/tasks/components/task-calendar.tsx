'use client'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import rrulePlugin from '@fullcalendar/rrule'
import { Task } from '../actions'
import { useMemo } from 'react'

interface TaskCalendarProps {
  tasks: Task[]
  roles: any[]
  openingHours?: any
}

export function TaskCalendar({ tasks, roles, openingHours }: TaskCalendarProps) {
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

  // Convert tasks to FullCalendar events
  const events = useMemo(() => {
    return tasks.map(task => {
      // Role color mapping
      const role = roles.find(r => r.id === task.assigned_role_id)
      const color = role ? role.color : '#808080'
      const title = `${task.title} (${role ? role.name : '전체'})`

      // Base event object
      const baseEvent = {
        id: task.id,
        title: title,
        backgroundColor: color,
        borderColor: color,
        textColor: '#fff', // Adjust based on background color if needed
        extendedProps: {
          description: task.description,
          roleName: role ? role.name : '전체',
          isCritical: task.is_critical,
          taskType: task.task_type
        }
      }

      // Handle 'always' tasks
      if (task.task_type === 'always') {
        return {
          ...baseEvent,
          allDay: true, // Show in all-day section
          // Always tasks repeat daily
          rrule: {
            freq: 'daily',
            interval: 1
          }
        }
      }

      // Handle 'time_specific' (Assume daily if no specific date logic provided yet)
      // If we want time_specific to be one-off, we need a date field in DB. 
      // Currently, schema supports pattern-based tasks. 
      // So time_specific without repeat_pattern effectively means "Daily at this time" 
      // or we treat it as recurring daily.
      if (task.task_type === 'time_specific') {
        if (!task.start_time || !task.end_time) return null

        // Convert HH:MM:SS to hours/minutes for duration calculation if needed
        // But rrule handles time via dtstart if we set it, or we can just use startTime/endTime of FC?
        // FC rrule plugin uses 'dtstart' inside rrule string or object? 
        // Actually, for simple time recurrence, we can use groupId or startTime/endTime properties 
        // combined with daysOfWeek if it was simple weekly. But for rrule plugin:
        
        return {
          ...baseEvent,
          rrule: {
            freq: 'daily',
            interval: 1,
            dtstart: `2024-01-01T${task.start_time}`, // Arbitrary past date
          },
          duration: calculateDuration(task.start_time, task.end_time)
        }
      }

      // Handle 'recurring' tasks
      if (task.task_type === 'recurring' && task.repeat_pattern) {
        const pattern = task.repeat_pattern
        const rruleObj: any = {
          dtstart: `2024-01-01T${task.start_time || '09:00:00'}`,
        }

        if (pattern.type === 'daily') {
          rruleObj.freq = 'daily'
          rruleObj.interval = pattern.interval || 1
        } else if (pattern.type === 'weekly') {
          rruleObj.freq = 'weekly'
          rruleObj.interval = pattern.interval || 1
          // Convert 0-6 (Sun-Sat) to RRule format if needed, or FC rrule handles integers?
          // FC rrule expects 'byweekday': [ 'mo', 'tu' ] or integers [0, 1] (0=MO in RRule?? No, 0=MO in FC?)
          // RRule lib: 0=MO, 6=SU? Wait. JS Date: 0=Sun. 
          // RRule: RRule.MO, etc. 
          // Let's check FC docs. FC rrule plugin accepts object similar to RRule object.
          // In RRule object, byweekday is [ RRule.MO, ... ]. 
          // We need to map our 0(Sun)-6(Sat) to RRule constants.
          if (pattern.days) {
             rruleObj.byweekday = pattern.days.map((d: number) => {
                // Map 0(Sun)..6(Sat) -> RRule.SU..RRule.SA
                // RRule constants are objects, but FC plugin might accept strings 'su','mo'...
                const map = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa']
                return map[d]
             })
          }
        } else if (pattern.type === 'monthly') {
          rruleObj.freq = 'monthly'
          rruleObj.interval = pattern.interval || 1
          if (pattern.date) {
            rruleObj.bymonthday = [pattern.date]
          }
        } else if (pattern.type === 'hourly') {
           // Hourly recurrence is tricky in calendar view (too many events).
           // Maybe just show as all-day with note?
           rruleObj.freq = 'daily' 
           baseEvent.title = `[${pattern.interval}시간 간격] ${baseEvent.title}`
        }

        return {
          ...baseEvent,
          rrule: rruleObj,
          duration: task.start_time && task.end_time ? calculateDuration(task.start_time, task.end_time) : '01:00'
        }
      }

      return null
    }).filter(Boolean)
  }, [tasks, roles])

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
    return (
      <div className="p-1 overflow-hidden h-full flex flex-col">
        <div className="font-semibold text-xs truncate">
          {eventInfo.event.title}
        </div>
        {eventInfo.timeText && (
          <div className="text-[10px] opacity-80">
            {eventInfo.timeText}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, rrulePlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        events={events as any}
        eventContent={renderEventContent}
        nowIndicator={true}
        allDaySlot={true}
        slotMinTime={minTime}
        slotMaxTime={maxTime}
        height="100%"
        locale="ko"
        weekends={true}
      />
    </div>
  )
}