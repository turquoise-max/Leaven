import React, { useMemo } from 'react'
import { format, addDays, isSameDay } from 'date-fns'
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

interface WeeklyShiftBoardProps {
  weekStart: Date
  staffList: any[]
  localSchedules: any[]
  roles: any[]
  activeRoleIds: string[]
  hours: number[]
  getStaffRoleInfo: (staff: any) => any
  onDayClick: (date: Date) => void
  onScheduleClick: (sch: any, staff: any) => void
}

export function WeeklyShiftBoard({
  weekStart,
  staffList,
  localSchedules,
  roles,
  activeRoleIds,
  hours,
  getStaffRoleInfo,
  onDayClick,
  onScheduleClick
}: WeeklyShiftBoardProps) {
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const HOUR_HEIGHT = 48 // 1시간당 높이 48px

  // 특정 날짜의 스케줄 찾기 (역할 필터링 적용)
  const getSchedulesForDate = (date: Date) => {
    return localSchedules.filter(sch => {
      if (!sch.start_time) return false
      const parsedDate = new Date(sch.start_time)
      if (isNaN(parsedDate.getTime())) return false
      if (!isSameDay(parsedDate, date)) return false

      // 역할 필터링 검사
      const staffId = sch.schedule_members?.[0]?.member_id
      const staff = staffList.find(s => s.id === staffId)
      if (!staff) return false

      const roleInfo = getStaffRoleInfo(staff)
      if (roleInfo && !activeRoleIds.includes(roleInfo.id)) {
        return false // 선택되지 않은 역할의 스케줄은 숨김
      }

      return true
    })
  }

  // 충돌(Overlap) 계산 로직 (동일 날짜 내에서 겹치는 스케줄의 가로 위치 조정)
  const getPositionedSchedules = (daySchedules: any[]) => {
    // 1. 시작 시간 기준으로 정렬
    const sorted = [...daySchedules].sort((a, b) => {
      return new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    })

    // 2. 그룹화 (겹치는 스케줄끼리 묶음)
    const columns: any[][] = []
    
    sorted.forEach(sch => {
      let placed = false
      for (let i = 0; i < columns.length; i++) {
        // 현재 컬럼의 마지막 스케줄과 겹치는지 확인
        const lastInCol = columns[i][columns[i].length - 1]
        if (new Date(sch.start_time).getTime() >= new Date(lastInCol.end_time).getTime()) {
          columns[i].push(sch)
          placed = true
          break
        }
      }
      if (!placed) {
        columns.push([sch])
      }
    })

    // 3. 위치 계산
    const positioned: any[] = []
    columns.forEach((col, colIndex) => {
      col.forEach(sch => {
        const start = new Date(sch.start_time)
        const end = new Date(sch.end_time)
        
        let startHour = start.getHours() + start.getMinutes() / 60
        let endHour = end.getHours() + end.getMinutes() / 60
        
        if (endHour <= startHour || end.getDate() !== start.getDate()) {
          endHour += 24
        }

        const top = (startHour - hours[0]) * HOUR_HEIGHT
        const height = (endHour - startHour) * HOUR_HEIGHT

        // 스태프 정보 매칭
        const staffId = sch.schedule_members?.[0]?.member_id
        const staff = staffList.find(s => s.id === staffId)
        const roleInfo = staff ? getStaffRoleInfo(staff) : null

        positioned.push({
          ...sch,
          top,
          height,
          staff,
          roleInfo,
          colIndex,
          totalCols: columns.length
        })
      })
    })

    return positioned
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-md border border-black/10 overflow-hidden shadow-sm relative select-none">
      
      {/* Header (요일 축) */}
      <div className="flex sticky top-0 z-30 bg-white border-b border-black/5">
        {/* 좌측 상단 빈칸 (시간 라벨 공간) */}
        <div className="w-[48px] shrink-0 border-r border-black/5 bg-white" />
        
        {/* 요일 헤더 */}
        {weekDays.map(day => {
          const isToday = isSameDay(day, new Date())
          return (
            <div 
              key={day.toISOString()} 
              className={`flex-1 min-w-0 border-r border-black/5 p-2 flex flex-col items-center justify-center cursor-pointer transition-colors group ${isToday ? 'bg-primary/5' : 'hover:bg-black/[0.02]'}`}
              onClick={() => onDayClick(day)}
              title="이 날짜 일간 뷰로 이동"
            >
              <span className={`text-[11px] mb-0.5 ${isToday ? 'text-primary font-bold' : 'text-[#6b6b6b]'}`}>
                {format(day, 'E', { locale: ko })}
              </span>
              <span className={`text-[14px] ${isToday ? 'text-primary font-bold' : 'text-[#1a1a1a] font-medium group-hover:text-primary transition-colors'}`}>
                {format(day, 'd')}
              </span>
            </div>
          )
        })}
      </div>

      {/* Body (타임라인 그리드) */}
      <div className="flex-1 overflow-y-auto relative bg-[#fafafa]">
        <div className="flex relative" style={{ minHeight: `${hours.length * HOUR_HEIGHT}px` }}>
          
          {/* Y축 (시간 라벨) */}
          <div className="w-[48px] shrink-0 bg-white sticky left-0 z-20 border-r border-black/5">
            {hours.map(h => {
              const displayHour = h >= 24 ? h - 24 : h;
              const isNextDay = h >= 24;
              return (
                <div key={h} className="text-[10px] text-muted-foreground relative" style={{ height: HOUR_HEIGHT }}>
                  <span className="absolute -top-[7px] w-full text-center block">
                    {displayHour.toString().padStart(2, '0')}
                    {isNextDay && <span className="absolute -top-1 -right-1 text-[7px] text-primary/60 font-semibold">+1</span>}
                  </span>
                </div>
              )
            })}
          </div>

          {/* 가로 보조선 (그리드 배경) */}
          <div className="absolute top-0 left-[48px] right-0 bottom-0 pointer-events-none z-0">
            {hours.map(h => (
              <div 
                key={h} 
                className="w-full border-t border-dashed border-black/5" 
                style={{ height: HOUR_HEIGHT }}
              />
            ))}
          </div>

          {/* 요일별 컬럼 영역 */}
          {weekDays.map((day, dayIdx) => {
            const daySchedules = getSchedulesForDate(day)
            const positionedSchedules = getPositionedSchedules(daySchedules)
            const isToday = isSameDay(day, new Date())

            return (
              <div 
                key={day.toISOString()} 
                className={cn(
                  "flex-1 relative border-r border-black/5 z-10",
                  isToday ? "bg-primary/[0.03]" : ""
                )}
              >
                {/* 배경 클릭 영역 (해당 일자로 이동) */}
                <div 
                  className="absolute inset-0 cursor-pointer hover:bg-black/[0.02] transition-colors group/col"
                  onClick={() => onDayClick(day)}
                >
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 opacity-0 group-hover/col:opacity-100 transition-opacity flex items-center justify-center w-6 h-6 rounded-full bg-white border border-black/10 shadow-sm text-black/50">
                    <Plus className="w-4 h-4" />
                  </div>
                </div>

                {/* 스케줄 블록 렌더링 */}
                {positionedSchedules.map(posSch => {
                  const width = `${100 / posSch.totalCols}%`
                  const left = `${(posSch.colIndex / posSch.totalCols) * 100}%`
                  
                  const roleColor = posSch.roleInfo?.color || '#534AB7'
                  const title = posSch.title || '정규 근무'
                  const isCover = title.includes('대체') || title.includes('땜빵')
                  const safeName = posSch.staff?.profile?.full_name || posSch.staff?.name || '직원'

                  // 플랫 & 클린 UI 디자인
                  const baseColor = isCover ? '#fb923c' : roleColor
                  const bgColor = hexToRgba(baseColor, 0.1) // 아주 은은한 배경
                  const textColor = isCover ? '#c2410c' : '#1a1a1a'

                  // 블록이 너무 짧으면 이름만 표시
                  const isTinyBlock = posSch.height < 40

                  return (
                    <div
                      key={posSch.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (posSch.staff) {
                          onScheduleClick(posSch, posSch.staff)
                        }
                      }}
                      className="absolute px-[1px] cursor-pointer transition-transform hover:z-20 hover:scale-[1.02] py-[1px]"
                      style={{
                        top: posSch.top,
                        height: posSch.height,
                        left,
                        width,
                        zIndex: 10 + posSch.colIndex
                      }}
                    >
                      <div 
                        className={cn(
                          "w-full h-full rounded-[4px] flex flex-col overflow-hidden relative border border-transparent hover:border-black/10 transition-colors"
                        )}
                        style={{ backgroundColor: bgColor }}
                      >
                        {/* 좌측 악센트 라인 */}
                        <div 
                          className="absolute left-0 top-0 bottom-0 w-[3px]"
                          style={{ backgroundColor: baseColor }}
                        />

                        {/* 내용 영역 */}
                        <div className={cn("flex flex-col flex-1 min-h-0 relative z-10", isTinyBlock ? "p-1 pl-2" : "p-1.5 pl-2.5")}>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span 
                              className={cn("font-semibold truncate", isTinyBlock ? "text-[10px]" : "text-[11px]")}
                              style={{ color: textColor }}
                            >
                              {safeName}
                            </span>
                          </div>
                          
                          {!isTinyBlock && (
                            <div className="text-[9px] truncate opacity-70 font-medium" style={{ color: textColor }}>
                              {format(new Date(posSch.start_time), 'HH:mm')} - {format(new Date(posSch.end_time), 'HH:mm')}
                            </div>
                          )}

                          {posSch.height >= 70 && !isCover && (
                            <div className="text-[9px] truncate mt-auto opacity-60 leading-tight" style={{ color: textColor }}>
                              {title}
                            </div>
                          )}
                          
                          {isCover && !isTinyBlock && (
                            <div className="text-[9px] font-bold text-orange-700 truncate mt-auto">
                              대체 근무
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}