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
  approvedLeaves?: any[]
  isManager?: boolean
  onDateClick: (date: Date) => void
  onScheduleClick: (sch: any, staff: any) => void
  onScheduleDrop?: (scheduleId: string, sourceStaffId: string, targetStaffId: string, targetDate: Date) => void
}

export function MonthlyCalendarView({
  currentDate,
  staffList,
  localSchedules,
  roles,
  activeRoleIds,
  getStaffRoleInfo,
  approvedLeaves = [],
  isManager = true,
  onDateClick,
  onScheduleClick,
  onScheduleDrop
}: MonthlyCalendarViewProps) {
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 })
  let endDate = endOfWeek(monthEnd, { weekStartsOn: 0 })
  
  const calendarDays = []
  let day = startDate
  
  // 4~6주가 유동적으로 렌더링되도록 처리
  while (day <= endDate) {
    calendarDays.push(day)
    day = addDays(day, 1)
  }

  const weekDays = ['일', '월', '화', '수', '목', '금', '토']

  // 특정 날짜 스케줄 찾기 (직급 우선순위 > 이름 가나다순 > 시작 시간 오름차순 정렬)
  const getSchedulesForDate = (date: Date) => {
    const schedules = localSchedules.filter(sch => {
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

    return schedules.sort((a, b) => {
      const staffAId = a.schedule_members?.[0]?.member_id
      const staffBId = b.schedule_members?.[0]?.member_id
      const staffA = staffList.find(s => s.id === staffAId)
      const staffB = staffList.find(s => s.id === staffBId)
      
      const roleA = staffA ? getStaffRoleInfo(staffA) : null
      const roleB = staffB ? getStaffRoleInfo(staffB) : null
      
      // 1. 직급 우선순위 (내림차순)
      const priorityA = roleA?.priority ?? -1
      const priorityB = roleB?.priority ?? -1
      if (priorityA !== priorityB) return priorityB - priorityA
      
      // 2. 이름 (오름차순)
      const nameA = staffA?.name || staffA?.profile?.full_name || ''
      const nameB = staffB?.name || staffB?.profile?.full_name || ''
      const nameSort = nameA.localeCompare(nameB)
      if (nameSort !== 0) return nameSort
      
      // 3. 시작 시간 (오름차순)
      return new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    })
  }

  // 달력을 주 단위로 분할
  const weeks = []
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7))
  }

  return (
    <div className="flex flex-col bg-white rounded-xl border border-black/10 shadow-sm overflow-hidden select-none">
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
      <div className="flex flex-col bg-[#fbfbfb]">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 border-b border-black/5 last:border-b-0 min-h-[50px] md:min-h-[120px]">
            {week.map((date, dayIndex) => {
              const isCurrentMonth = isSameMonth(date, currentDate)
              const isToday = isSameDay(date, new Date())
              const daySchedules = getSchedulesForDate(date)

              return (
                <div 
                  key={date.toISOString()} 
                  onDragOver={(e) => {
                    if (!isManager) return
                    e.preventDefault()
                    e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.02)'
                  }}
                  onDragLeave={(e) => {
                    if (!isManager) return
                    e.currentTarget.style.backgroundColor = ''
                  }}
                  onDrop={(e) => {
                    if (!isManager) return
                    e.preventDefault()
                    e.currentTarget.style.backgroundColor = ''
                    try {
                      const data = JSON.parse(e.dataTransfer.getData('text/plain'))
                      if (data.scheduleId && data.sourceStaffId && onScheduleDrop) {
                        // 월간 뷰에서는 특정 직원의 셀이 아니므로 날짜만 변경 (targetStaffId는 유지)
                        onScheduleDrop(data.scheduleId, data.sourceStaffId, data.sourceStaffId, date)
                      }
                    } catch (err) {
                      console.error('Drop error:', err)
                    }
                  }}
                  className={cn(
                    "border-r border-black/5 last:border-r-0 p-1 md:p-2 flex flex-col md:gap-1 relative transition-all bg-white",
                    "items-center md:items-stretch justify-start md:justify-start", // 모바일에서는 중앙(가로) 정렬, PC에서는 기존 유지
                    isToday && "bg-primary/[0.03] ring-1 ring-inset ring-primary/20",
                    isManager ? "group/cell" : ""
                  )}
                  onClick={() => {
                    // 모바일 환경에서 닷(dot) 형태가 눌리기 쉽도록 빈 셀 공간 클릭 시 
                    // 관리자는 추가 모달, 일반 직원은 빈 동작
                    if (!isManager) return;
                    // PC 뷰나 빈 영역 클릭 시 
                    const isMobile = window.innerWidth < 768;
                    if (isMobile) onDateClick(date);
                  }}
                >
                  {/* 날짜 표시 */}
                  <div className={cn(
                    "text-[12px] md:text-[12px] font-medium px-0.5 flex md:justify-between items-center mb-0 md:mb-1",
                    !isCurrentMonth ? "text-muted-foreground opacity-50" :
                    isToday ? "text-primary font-bold" :
                    dayIndex === 0 ? "text-red-500" :
                    dayIndex === 6 ? "text-blue-500" :
                    "text-[#1a1a1a]"
                  )}>
                    <span className={cn(
                      "flex items-center justify-center",
                      isToday ? "bg-primary text-white w-5 h-5 md:w-5 md:h-5 rounded-full md:-ml-1" : "w-5 h-5 md:w-auto md:h-auto"
                    )}>
                      {format(date, 'd')}
                    </span>
                    {daySchedules.length > 0 && (
                      <span className="hidden md:inline-block text-[10px] text-muted-foreground font-normal">
                        {daySchedules.length}건
                      </span>
                    )}
                  </div>

                  {/* 스케줄 목록 (모바일 뷰 - Dot 아이콘) */}
                  <div className="flex md:hidden flex-wrap gap-1 mt-0.5 px-1 justify-center">
                    {daySchedules.slice(0, 3).map(sch => {
                      const staffId = sch.schedule_members?.[0]?.member_id
                      const staff = staffList.find(s => s.id === staffId)
                      const roleInfo = staff ? getStaffRoleInfo(staff) : null
                      const roleColor = roleInfo?.color || '#534AB7'
                      
                      const isActuallyOnLeave = approvedLeaves.some((leave: any) => {
                        const schDateOnly = format(new Date(sch.start_time), 'yyyy-MM-dd')
                        return leave.member_id === staffId && 
                               schDateOnly >= leave.start_date && 
                               schDateOnly <= leave.end_date
                      })

                      const currentType = isActuallyOnLeave ? 'leave' : sch.schedule_type
                      const isLeave = currentType === 'leave'
                      const scheduleColor = isLeave ? '#64748b' : (sch.color || roleColor)

                      return (
                        <div 
                          key={`mob-${sch.id}`}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: scheduleColor }}
                        />
                      )
                    })}
                    {daySchedules.length > 3 && (
                      <div className="text-[9px] text-muted-foreground font-medium leading-none flex items-center">
                        +{daySchedules.length - 3}
                      </div>
                    )}
                  </div>

                  {/* 스케줄 목록 (PC 뷰 - 기존 바(Bar) 형태) */}
                  <div className="hidden md:flex flex-col gap-1 pb-1">
                    {daySchedules.map(sch => {
                      const staffId = sch.schedule_members?.[0]?.member_id
                      const staff = staffList.find(s => s.id === staffId)
                      const roleInfo = staff ? getStaffRoleInfo(staff) : null
                      const roleColor = roleInfo?.color || '#534AB7'
                      const safeName = staff?.name || '직원'

                      // [기획자 핵심 로직] SSOT 기반 휴가 실시간 렌더링
                      const isActuallyOnLeave = approvedLeaves.some((leave: any) => {
                        const schDateOnly = format(new Date(sch.start_time), 'yyyy-MM-dd');
                        return leave.member_id === staffId && 
                               schDateOnly >= leave.start_date && 
                               schDateOnly <= leave.end_date;
                      });

                      const currentType = isActuallyOnLeave ? 'leave' : sch.schedule_type;
                      
                      const isLeave = currentType === 'leave'
                      const isTraining = currentType === 'training'
                      const isEtc = currentType === 'etc'
                      
                      // 색상 동적 결정: 휴가는 무조건 회색, 나머지는 본래 색상(또는 직급 색상)
                      const scheduleColor = isLeave ? '#64748b' : (sch.color || roleColor)
                      
                      // 타이틀 동적 결정
                      const typeLabelMap: Record<string, string> = {
                        'regular': '근무',
                        'leave': '휴가',
                        'training': '교육',
                        'etc': '기타'
                      }
                      
                      let displayTitle = isActuallyOnLeave ? '휴가' : (sch.title || '근무')
                      
                      if (!isActuallyOnLeave) {
                        if (isTraining && !displayTitle.includes('[교육]')) {
                          displayTitle = displayTitle === '교육' ? '교육' : `[교육] ${displayTitle}`
                        } else if (isEtc && !displayTitle.includes('[기타]')) {
                          displayTitle = displayTitle === '기타' ? '기타' : `[기타] ${displayTitle}`
                        }
                      }

                      return (
                        <div
                          key={sch.id}
                          draggable={isManager && !isLeave}
                          onDragStart={(e) => {
                            if (!isManager || isLeave) return
                            e.stopPropagation()
                            e.dataTransfer.setData('text/plain', JSON.stringify({
                              scheduleId: sch.id,
                              sourceStaffId: staffId
                            }))
                            e.currentTarget.style.opacity = '0.5'
                          }}
                          onDragEnd={(e) => {
                            e.currentTarget.style.opacity = '1'
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (staff) onScheduleClick(sch, staff)
                          }}
                          className={cn(
                            "px-1.5 py-1 rounded text-[10px] truncate transition-transform hover:scale-[1.02] cursor-pointer shadow-sm border border-black/5",
                            isManager && !isLeave && "active:cursor-grabbing cursor-grab"
                          )}
                          style={{ 
                            backgroundColor: hexToRgba(scheduleColor, 0.1), 
                            color: '#1a1a1a',
                            borderLeft: `2.5px solid ${scheduleColor}`
                          }}
                          title={`${safeName} - ${displayTitle}${isLeave && sch.memo ? ` (${sch.memo})` : ''}`}
                        >
                          <span className="font-semibold" style={{ color: scheduleColor }}>{safeName}</span> 
                          {!isLeave && (
                            <span className="opacity-80 ml-1 text-[9px]">{format(new Date(sch.start_time), 'HH:mm')}-{format(new Date(sch.end_time), 'HH:mm')}</span>
                          )}
                          {isLeave && (
                            <span className="opacity-80 ml-1 font-medium">{displayTitle}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* 빈 공간 클릭을 위한 영역 & Hover Plus Icon (PC 전용 스타일) */}
                  {isManager && (
                    <div 
                      className={cn(
                        "hidden md:block flex-1 h-0 min-h-0 group-hover/cell:h-8 group-hover/cell:min-h-[32px] group-hover/cell:mt-1 relative rounded-md transition-all duration-200 overflow-hidden bg-black/[0.02] hover:bg-black/[0.04] cursor-pointer group/add-btn"
                      )}
                      onClick={(e) => {
                        e.stopPropagation()
                        onDateClick(date)
                      }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/add-btn:opacity-100 transition-opacity pointer-events-none">
                        <div className="bg-white rounded-full p-1 shadow-md border border-black/10 text-black/40">
                          <Plus className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}