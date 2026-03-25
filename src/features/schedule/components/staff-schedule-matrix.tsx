import React, { useMemo } from 'react'
import { format, addDays, isSameDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Plus, CheckSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

function hexToRgba(hex: string, alpha: number) {
  if (!hex) return `rgba(0,0,0,${alpha})`
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

interface StaffScheduleMatrixProps {
  startDate: Date
  daysCount: number
  staffList: any[]
  localSchedules: any[]
  roles: any[]
  activeRoleIds: string[]
  getStaffRoleInfo: (staff: any) => any
  onCellClick: (staff: any, date: Date) => void
  onScheduleClick: (sch: any, staff: any) => void
}

export function StaffScheduleMatrix({
  startDate,
  daysCount = 7,
  staffList,
  localSchedules,
  roles,
  activeRoleIds,
  getStaffRoleInfo,
  onCellClick,
  onScheduleClick
}: StaffScheduleMatrixProps) {
  const dates = Array.from({ length: daysCount }, (_, i) => addDays(startDate, i))

  // 특정 직원의 특정 날짜 스케줄 찾기 (시작 시간 오름차순 정렬)
  const getSchedulesForStaffAndDate = (staffId: string, date: Date) => {
    const schedules = localSchedules.filter(sch => {
      if (!sch.start_time) return false
      const parsedDate = new Date(sch.start_time)
      if (isNaN(parsedDate.getTime())) return false
      if (!isSameDay(parsedDate, date)) return false

      const hasMember = sch.schedule_members?.some((sm: any) => sm.member_id === staffId)
      return hasMember
    })
    
    return schedules.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
  }

  // 필터링된 직원 목록
  const visibleStaff = staffList.filter(staff => {
    const roleInfo = getStaffRoleInfo(staff)
    if (roleInfo && !activeRoleIds.includes(roleInfo.id)) return false
    return true
  })

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-black/10 shadow-sm overflow-hidden select-none">
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead className="sticky top-0 bg-[#fbfbfb] z-20 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <tr>
              <th className="p-3 border-b border-r border-black/5 font-semibold text-[13px] text-[#1a1a1a] w-[200px] sticky left-0 bg-[#fbfbfb] z-30 shadow-[1px_0_0_rgba(0,0,0,0.05)]">
                직원 정보
              </th>
              {dates.map(date => {
                const isToday = isSameDay(date, new Date())
                return (
                  <th 
                    key={date.toISOString()} 
                    className={cn(
                      "p-2 text-center border-b border-r border-black/5 font-medium min-w-[120px]",
                      isToday ? "bg-primary/5 text-primary" : "text-[#6b6b6b]"
                    )}
                  >
                    <div className="text-[11px] mb-0.5">{format(date, 'E', { locale: ko })}</div>
                    <div className={cn("text-[14px]", isToday && "font-bold")}>{format(date, 'M/d')}</div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {visibleStaff.length === 0 ? (
              <tr>
                <td colSpan={dates.length + 1} className="p-8 text-center text-muted-foreground text-[13px]">
                  표시할 직원이 없습니다.
                </td>
              </tr>
            ) : (
              visibleStaff.map(staff => {
                const roleInfo = getStaffRoleInfo(staff)
                const roleColor = roleInfo?.color || '#534AB7'

                return (
                  <tr key={staff.id} className="group hover:bg-black/[0.01] transition-colors">
                    <td className="p-3 border-b border-r border-black/5 sticky left-0 bg-white group-hover:bg-[#fafafa] z-10 shadow-[1px_0_0_rgba(0,0,0,0.05)]">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0"
                          style={{ backgroundColor: hexToRgba(roleColor, 0.15), color: roleColor }}
                        >
                          {(staff.name || '직').substring(0, 1)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold text-[#1a1a1a] truncate">{staff.name || '알 수 없음'}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{roleInfo?.name || '역할 없음'}</div>
                        </div>
                      </div>
                    </td>
                    
                    {dates.map(date => {
                      const daySchedules = getSchedulesForStaffAndDate(staff.id, date)
                      const isToday = isSameDay(date, new Date())

                      return (
                        <td 
                          key={date.toISOString()} 
                          className={cn(
                            "p-1.5 border-b border-r border-black/5 align-top relative transition-colors group/cell",
                            isToday ? "bg-primary/[0.02]" : ""
                          )}
                        >
                          <div className="flex flex-col h-full min-h-[60px]">
                            <div className="flex flex-col gap-1.5">
                              {daySchedules.map(sch => {
                                const start = new Date(sch.start_time)
                                const end = new Date(sch.end_time)
                                
                                const isLeave = sch.schedule_type === 'leave'
                                const isTraining = sch.schedule_type === 'training'
                                const isEtc = sch.schedule_type === 'etc'
                                
                                // 색상 동적 결정: 휴가는 무조건 회색, 나머지는 본래 색상(또는 직급 색상)
                                const scheduleColor = isLeave ? '#64748b' : (sch.color || roleColor)
                                
                                // 타이틀 동적 결정
                                let displayTitle = sch.title || '근무'
                                if (isLeave && !displayTitle.includes('휴가') && !displayTitle.includes('병가')) {
                                  displayTitle = displayTitle === '휴가' ? '휴가' : `[휴가] ${displayTitle}`
                                } else if (isTraining && !displayTitle.includes('[교육]')) {
                                  displayTitle = displayTitle === '교육' ? '교육' : `[교육] ${displayTitle}`
                                } else if (isEtc && !displayTitle.includes('[기타]')) {
                                  displayTitle = displayTitle === '기타' ? '기타' : `[기타] ${displayTitle}`
                                }

                                return (
                                  <TooltipProvider key={sch.id} delayDuration={300}>
                                    <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div 
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          onScheduleClick(sch, staff)
                                        }}
                                        className={cn(
                                          "px-2 py-1.5 rounded-md text-[11px] font-medium transition-all hover:scale-[1.02] shadow-sm border border-black/5 text-left cursor-pointer flex flex-col justify-center",
                                          isLeave ? "h-full min-h-[50px] items-center text-center opacity-90 hover:opacity-100" : ""
                                        )}
                                        style={{ 
                                          backgroundColor: hexToRgba(scheduleColor, isLeave ? 0.15 : 0.1), 
                                          color: '#1a1a1a',
                                          borderLeft: isLeave ? 'none' : `3px solid ${scheduleColor}`
                                        }}
                                      >
                                        {!isLeave && (
                                          <div className="font-semibold text-[10px] opacity-70 mb-0.5" style={{ color: scheduleColor }}>
                                            {format(start, 'HH:mm')} - {format(end, 'HH:mm')}
                                          </div>
                                        )}
                                        <div className={cn("truncate text-[#1a1a1a]", isLeave && "font-bold text-[12px] tracking-wide")} style={isLeave ? { color: scheduleColor } : {}}>
                                          {displayTitle}
                                        </div>
                                        {isLeave && sch.memo && (
                                          <div className="text-[9px] mt-0.5 opacity-60 truncate max-w-full px-1">
                                            {sch.memo}
                                          </div>
                                        )}
                                      </div>
                                    </TooltipTrigger>
                                    {!isLeave ? (
                                      <TooltipContent side="top" className="p-3 max-w-[250px] bg-white border border-black/10 shadow-lg text-[#1a1a1a]">
                                        <div className="font-semibold text-[12px] mb-2 border-b border-black/5 pb-1 flex justify-between items-center">
                                          <span>세부 할 일 ({(sch.task_assignments || []).length}개)</span>
                                          <span className="text-[10px] text-muted-foreground font-normal bg-black/5 px-1.5 py-0.5 rounded">
                                            {format(start, 'HH:mm')} - {format(end, 'HH:mm')}
                                          </span>
                                        </div>
                                        <div className="flex flex-col gap-1.5 max-h-[150px] overflow-y-auto no-scrollbar">
                                          {(sch.task_assignments || []).length > 0 ? (
                                            (sch.task_assignments || []).map((ta: any) => (
                                              <div key={ta.id} className="flex items-start gap-1.5 text-[11px]">
                                                <CheckSquare className={cn(
                                                  "w-3.5 h-3.5 shrink-0 mt-[1px]", 
                                                  ta.task?.status === 'done' ? "text-[#1D9E75]" : "text-muted-foreground/50"
                                                )} />
                                                <span className={cn("leading-tight", ta.task?.status === 'done' && "line-through text-muted-foreground")}>
                                                  {ta.task?.title || '할 일'}
                                                </span>
                                              </div>
                                            ))
                                          ) : (
                                            <div className="text-[11px] text-muted-foreground text-center py-2">
                                              등록된 세부 할 일이 없습니다.
                                            </div>
                                          )}
                                        </div>
                                      </TooltipContent>
                                    ) : (
                                      <TooltipContent side="top" className="p-3 max-w-[250px] bg-white border border-black/10 shadow-lg text-[#1a1a1a]">
                                        <div className="font-bold text-[12px] mb-1">{displayTitle}</div>
                                        {sch.memo && <div className="text-[11px] text-muted-foreground">{sch.memo}</div>}
                                        </TooltipContent>
                                      )}
                                    </Tooltip>
                                  </TooltipProvider>
                                )
                              })}
                            </div>
                            
                            {/* 빈 공간 클릭을 위한 영역 & Hover Plus Icon */}
                            <div 
                              className="flex-1 min-h-[24px] mt-1 relative cursor-pointer hover:bg-black/[0.02] rounded-md transition-colors group/empty"
                              onClick={(e) => {
                                e.stopPropagation()
                                onCellClick(staff, date)
                              }}
                            >
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/empty:opacity-100 transition-opacity pointer-events-none">
                                <div className="bg-white rounded-full p-1 shadow-md border border-black/10 text-black/40">
                                  <Plus className="w-4 h-4" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}