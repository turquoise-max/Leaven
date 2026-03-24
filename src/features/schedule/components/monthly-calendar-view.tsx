import React from 'react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

function hexToRgba(hex: string, alpha: number) {
  if (!hex) return `rgba(0,0,0,${alpha})`
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

interface MonthlyCalendarViewProps {
  currentDate: Date
  staffList: any[]
  localSchedules: any[]
  roles: any[]
  activeRoleIds: string[]
  getStaffRoleInfo: (staff: any) => any
  onDateClick: (date: Date) => void
  onScheduleClick: (sch: any, staff: any) => void
}

export function MonthlyCalendarView({
  currentDate,
  staffList,
  localSchedules,
  roles,
  activeRoleIds,
  getStaffRoleInfo,
  onDateClick,
  onScheduleClick
}: MonthlyCalendarViewProps) {
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 })
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 })
  
  const calendarDays = []
  let day = startDate
  while (day <= endDate) {
    calendarDays.push(day)
    day = addDays(day, 1)
  }

  const weekDays = ['일', '월', '화', '수', '목', '금', '토']

  const getSchedulesForDate = (date: Date) => {
    return localSchedules.filter(sch => {
      if (!sch.start_time) return false
      const parsedDate = new Date(sch.start_time)
      if (isNaN(parsedDate.getTime())) return false
      if (!isSameDay(parsedDate, date)) return false

      const staffId = sch.schedule_members?.[0]?.member_id
      const staff = staffList.find(s => s.id === staffId)
      if (!staff) return false

      const roleInfo = getStaffRoleInfo(staff)
      if (roleInfo && !activeRoleIds.includes(roleInfo.id)) {
        return false
      }

      return true
    })
  }

  // 달력을 주 단위로 분할
  const weeks = []
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7))
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-black/10 shadow-sm overflow-hidden select-none">
      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 border-b border-black/5 bg-[#fbfbfb]">
        {weekDays.map((dayName, i) => (
          <div 
            key={i} 
            className={cn(
              "py-2 text-center text-[12px] font-semibold",
              i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-[#1a1a1a]"
            )}
          >
            {dayName}
          </div>
        ))}
      </div>

      {/* 달력 그리드 */}
      <div className="flex-1 overflow-y-auto bg-[#fbfbfb]">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 border-b border-black/5 last:border-b-0 min-h-[120px]">
            {week.map((date, dayIndex) => {
              const isCurrentMonth = isSameMonth(date, currentDate)
              const isToday = isSameDay(date, new Date())
              const daySchedules = getSchedulesForDate(date)

              return (
                <div 
                  key={date.toISOString()} 
                  className={cn(
                    "border-r border-black/5 last:border-r-0 p-1.5 flex flex-col gap-1 relative group/cell cursor-pointer transition-colors bg-white",
                    !isCurrentMonth && "bg-black/[0.02]",
                    isToday && "bg-primary/[0.03] ring-1 ring-inset ring-primary/20",
                    "hover:bg-black/[0.02]"
                  )}
                  onClick={() => onDateClick(date)}
                >
                  {/* 날짜 표시 */}
                  <div className={cn(
                    "text-[12px] font-medium px-1 flex justify-between items-center mb-1",
                    !isCurrentMonth ? "text-muted-foreground opacity-50" :
                    isToday ? "text-primary font-bold" :
                    dayIndex === 0 ? "text-red-500" :
                    dayIndex === 6 ? "text-blue-500" :
                    "text-[#1a1a1a]"
                  )}>
                    <span className={cn(
                      isToday && "bg-primary text-white w-5 h-5 rounded-full flex items-center justify-center -ml-1"
                    )}>
                      {format(date, 'd')}
                    </span>
                    {daySchedules.length > 0 && (
                      <span className="text-[10px] text-muted-foreground font-normal">
                        {daySchedules.length}건
                      </span>
                    )}
                  </div>

                  {/* 스케줄 목록 */}
                  <div className="flex flex-col gap-1 pb-1">
                    {daySchedules.map(sch => {
                      const staffId = sch.schedule_members?.[0]?.member_id
                      const staff = staffList.find(s => s.id === staffId)
                      const roleInfo = staff ? getStaffRoleInfo(staff) : null
                      const roleColor = roleInfo?.color || '#534AB7'
                      const title = sch.title || '근무'
                      const safeName = staff?.name || '직원'
                      
                      // 스케줄 자체 색상(휴가용 회색 등)이 있으면 그것을 최우선 적용
                      const scheduleColor = sch.color || roleColor

                      return (
                        <div
                          key={sch.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (staff) onScheduleClick(sch, staff)
                          }}
                          className="px-1.5 py-1 rounded text-[10px] truncate transition-transform hover:scale-[1.02] cursor-pointer shadow-sm border border-black/5"
                          style={{ 
                            backgroundColor: hexToRgba(scheduleColor, 0.1), 
                            color: '#1a1a1a',
                            borderLeft: `2.5px solid ${scheduleColor}`
                          }}
                          title={`${safeName} - ${title}`}
                        >
                          <span className="font-semibold" style={{ color: scheduleColor }}>{safeName}</span> 
                          {!title.includes('[') && (
                            <span className="opacity-80 ml-0.5">{format(new Date(sch.start_time), 'HH:mm')}</span>
                          )}
                          {title.includes('[') && (
                            <span className="opacity-80 ml-1 font-medium">{title}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Hover Plus Icon */}
                  <div className="absolute top-1 right-1 opacity-0 group-hover/cell:opacity-100 transition-opacity pointer-events-none">
                    <div className="bg-white rounded p-0.5 shadow-sm border border-black/10 text-black/40">
                      <Plus className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}