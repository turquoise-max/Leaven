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
  approvedLeaves?: any[]
  isManager?: boolean
  onCellClick: (staff: any, date: Date) => void
  onScheduleClick: (sch: any, staff: any) => void
  onScheduleDrop?: (scheduleId: string, sourceStaffId: string, targetStaffId: string, targetDate: Date) => void
  onHeaderDateClick?: (date: Date) => void
}

export function StaffScheduleMatrix({
  startDate,
  daysCount = 7,
  staffList,
  localSchedules,
  roles,
  activeRoleIds,
  getStaffRoleInfo,
  approvedLeaves = [],
  isManager = true,
  onCellClick,
  onScheduleClick,
  onScheduleDrop,
  onHeaderDateClick
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

  // 필터링 및 정렬된 직원 목록
  const visibleStaff = useMemo(() => {
    return staffList
      .filter(staff => {
        const roleInfo = getStaffRoleInfo(staff)
        if (roleInfo && !activeRoleIds.includes(roleInfo.id)) return false
        return true
      })
      .sort((a, b) => {
        const roleA = getStaffRoleInfo(a)
        const roleB = getStaffRoleInfo(b)
        
        // 1. 직급 우선순위 (내림차순)
        const priorityA = roleA?.priority ?? -1
        const priorityB = roleB?.priority ?? -1
        if (priorityA !== priorityB) return priorityB - priorityA
        
        // 2. 이름 (오름차순)
        const nameA = a.name || a.profile?.full_name || ''
        const nameB = b.name || b.profile?.full_name || ''
        return nameA.localeCompare(nameB)
      })
  }, [staffList, activeRoleIds, getStaffRoleInfo])

  return (
    <div className="flex flex-col h-full bg-white md:bg-white rounded-xl md:border md:border-black/10 md:shadow-sm overflow-hidden select-none">
      {/* 
        모바일 뷰 (세로 타임라인 형태: 날짜가 좌측 라벨, 일정이 우측 리스트)
        - 자신의 스케줄을 주로 확인하는 모바일 환경에 최적화
        - 각각 떨어진 카드가 아닌, 하나의 연속된 리스트로 이어지도록 개선
      */}
      <div className="block md:hidden flex-1 overflow-auto bg-white">
        {visibleStaff.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-[14px]">
            표시할 직원이 없습니다.
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-black/5">
            {dates.map((date) => {
              const isToday = isSameDay(date, new Date())
              const staff = visibleStaff[0]
              const daySchedules = getSchedulesForStaffAndDate(staff.id, date)
              
              const roleInfo = getStaffRoleInfo(staff)
              const roleColor = roleInfo?.color || '#534AB7'

              return (
                <div 
                  key={date.toISOString()}
                  className={cn(
                    "flex flex-row items-center gap-3 py-2 px-3 transition-colors min-h-[44px]",
                    isToday ? "bg-primary/[0.02]" : ""
                  )}
                >
                  {/* 좌측 날짜 영역 */}
                  <div className="flex flex-col items-center justify-center min-w-[32px] shrink-0">
                    <span className={cn(
                      "text-[10px] font-medium leading-none mb-0.5",
                      isToday ? "text-primary" : "text-muted-foreground"
                    )}>
                      {format(date, 'E', { locale: ko })}
                    </span>
                    <span className={cn(
                      "text-[13px] font-bold leading-none flex items-center justify-center rounded-full w-6 h-6",
                      isToday ? "bg-primary text-white shadow-sm" : "text-[#1a1a1a]"
                    )}>
                      {format(date, 'd')}
                    </span>
                  </div>
                  
                  {/* 우측 일정 영역 */}
                  <div className="flex-1 flex flex-col justify-center min-w-0 relative group">
                    {/* 매니저 권한인 경우 빈 공간에서 추가 아이콘 띄우기 */}
                    {isManager && daySchedules.length === 0 && (
                      <div className="absolute inset-y-0 right-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation()
                            onCellClick(staff, date)
                          }}
                          className="p-1 bg-black/5 hover:bg-black/10 text-muted-foreground rounded-full"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {daySchedules.length === 0 ? (
                      <div className="text-[12px] text-muted-foreground/50 py-1 pl-1">
                        일정이 없습니다.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1 w-full">
                        {daySchedules.map((sch) => {
                        const start = new Date(sch.start_time)
                        const end = new Date(sch.end_time)
                        
                        const isActuallyOnLeave = approvedLeaves.some((leave: any) => {
                          const schDateOnly = format(new Date(sch.start_time), 'yyyy-MM-dd')
                          return leave.member_id === staff.id && 
                                 schDateOnly >= leave.start_date && 
                                 schDateOnly <= leave.end_date
                        })

                        const currentType = isActuallyOnLeave ? 'leave' : sch.schedule_type
                        const isLeave = currentType === 'leave'
                        const scheduleColor = isLeave ? '#64748b' : (sch.color || roleColor)
                        
                        const typeLabelMap: Record<string, string> = {
                          'regular': '근무',
                          'leave': '휴가',
                          'training': '교육',
                          'etc': '기타'
                        }
                        const displayTitle = typeLabelMap[currentType] || sch.title || '근무'

                          return (
                            <div 
                              key={sch.id}
                              onClick={(e) => {
                                e.stopPropagation()
                                onScheduleClick(sch, staff)
                              }}
                              className="relative flex flex-row items-center justify-between gap-2 active:opacity-70 transition-opacity bg-black/[0.02] rounded px-2 py-1.5 w-full"
                            >
                              {/* 일정 좌측 색상 지시선과 타이틀 */}
                              <div className="flex items-center gap-1.5 min-w-0">
                                <div 
                                  className="w-1 rounded-full shrink-0" 
                                  style={{ 
                                    height: '10px',
                                    backgroundColor: scheduleColor,
                                    opacity: isLeave ? 0.4 : 1 
                                  }} 
                                />
                                <span className={cn(
                                  "text-[13px] font-semibold truncate leading-none", 
                                  isLeave ? "text-slate-600 line-through decoration-slate-400" : "text-[#1a1a1a]"
                                )}>
                                  {displayTitle}
                                </span>
                              </div>

                              {/* 우측 시간 (또는 메모) */}
                              <div className="shrink-0 flex items-center">
                                {!isLeave ? (
                                  <span className="text-[11px] font-medium leading-none" style={{ color: scheduleColor }}>
                                    {format(start, 'HH:mm')} - {format(end, 'HH:mm')}
                                  </span>
                                ) : sch.memo && sch.memo !== '자동 생성됨' ? (
                                  <span className="text-[10px] text-slate-500 truncate max-w-[80px] leading-none">
                                    {sch.memo}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* PC 뷰 (가로 스크롤 매트릭스 표 형태) */}
      <div className="hidden md:block flex-1 overflow-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead className="sticky top-0 bg-[#fbfbfb] z-20 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <tr>
              <th className="p-3 border-b border-r border-black/5 font-semibold text-[13px] text-[#1a1a1a] w-[200px] sticky left-0 bg-[#fbfbfb] z-30 shadow-[1px_0_0_rgba(0,0,0,0.05)] text-center">
                직원 정보
              </th>
              {dates.map(date => {
                const isToday = isSameDay(date, new Date())
                return (
                  <th 
                    key={date.toISOString()} 
                    onClick={() => onHeaderDateClick?.(date)}
                    className={cn(
                      "p-2 text-center border-b border-r border-black/5 font-medium min-w-[120px] transition-colors",
                      onHeaderDateClick ? "cursor-pointer hover:bg-black/[0.03]" : "",
                      isToday ? "bg-primary/5 text-primary hover:bg-primary/10" : "text-[#6b6b6b]"
                    )}
                  >
                    <div className="text-[11px] mb-0.5 opacity-70">{format(date, 'E', { locale: ko })}</div>
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
                      <div className="flex items-center justify-center gap-2">
                        <div className="min-w-0 text-center">
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
                                onScheduleDrop(data.scheduleId, data.sourceStaffId, staff.id, date)
                              }
                            } catch (err) {
                              console.error('Drop error:', err)
                            }
                          }}
                          className={cn(
                            "p-1.5 border-b border-r border-black/5 align-top relative transition-all group/cell",
                            isToday ? "bg-primary/[0.02]" : ""
                          )}
                        >
                          <div className="flex flex-col h-full min-h-[40px] pointer-events-none *:pointer-events-auto">
                            <div className="flex flex-col gap-1.5">
                              {daySchedules.map(sch => {
                                const start = new Date(sch.start_time)
                                const end = new Date(sch.end_time)
                                
                                // [기획자 핵심 로직] SSOT 기반 휴가 실시간 렌더링
                                const isActuallyOnLeave = approvedLeaves.some((leave: any) => {
                                  // leave_requests의 start_date, end_date는 "YYYY-MM-DD" 문자열임
                                  // sch.start_time은 UTC ISO 문자열임. 비교를 위해 날짜만 추출
                                  const schDateOnly = format(new Date(sch.start_time), 'yyyy-MM-dd');
                                  return leave.member_id === staff.id && 
                                         schDateOnly >= leave.start_date && 
                                         schDateOnly <= leave.end_date;
                                });

                                const currentType = isActuallyOnLeave ? 'leave' : sch.schedule_type;
                                const isTraining = currentType === 'training'
                                const isEtc = currentType === 'etc'
                                const isLeave = currentType === 'leave'
                                
                                // 색상 동적 결정: 휴가는 무조건 회색, 나머지는 본래 색상(또는 직급 색상)
                                const scheduleColor = isLeave ? '#64748b' : (sch.color || roleColor)
                                
                                // 타이틀 동적 결정: 휴가 기록이 있으면 강제로 '휴가' 표시
                                const typeLabelMap: Record<string, string> = {
                                  'regular': '근무',
                                  'leave': '휴가',
                                  'training': '교육',
                                  'etc': '기타'
                                }
                                const displayTitle = typeLabelMap[currentType] || sch.title || '근무'

                                return (
                                  <TooltipProvider key={sch.id} delayDuration={300}>
                                    <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div 
                                        draggable={isManager && !isLeave}
                                        onDragStart={(e) => {
                                          if (!isManager || isLeave) return
                                          e.dataTransfer.setData('text/plain', JSON.stringify({
                                            scheduleId: sch.id,
                                            sourceStaffId: staff.id
                                          }))
                                          e.currentTarget.style.opacity = '0.5'
                                        }}
                                        onDragEnd={(e) => {
                                          e.currentTarget.style.opacity = '1'
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          onScheduleClick(sch, staff)
                                        }}
                                        className={cn(
                                          "px-2 py-1.5 rounded-md text-[11px] font-medium transition-all hover:scale-[1.02] shadow-sm border border-black/5 text-left cursor-pointer flex flex-col justify-center",
                                          isLeave ? "h-full min-h-[50px] items-center text-center opacity-90 hover:opacity-100" : "",
                                          isManager && !isLeave ? "active:cursor-grabbing cursor-grab" : ""
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
                                      </div>
                                    </TooltipTrigger>
                                    {!isLeave ? (
                                      <TooltipContent side="top" className="p-3 max-w-[250px] bg-white border border-black/10 shadow-lg text-[#1a1a1a]">
                                        <div className="font-semibold text-[12px] mb-2 border-b border-black/5 pb-1 flex justify-between items-center">
                                          <span>세부 할 일 ({(sch.tasks || []).length}개)</span>
                                          <span className="text-[10px] text-muted-foreground font-normal bg-black/5 px-1.5 py-0.5 rounded">
                                            {format(start, 'HH:mm')} - {format(end, 'HH:mm')}
                                          </span>
                                        </div>
                                        <div className="flex flex-col gap-1.5 max-h-[150px] overflow-y-auto no-scrollbar">
                                          {(sch.tasks || []).length > 0 ? (
                                            (sch.tasks || []).map((t: any) => (
                                              <div key={t.id} className="flex items-start gap-1.5 text-[11px]">
                                                <CheckSquare className={cn(
                                                  "w-3.5 h-3.5 shrink-0 mt-[1px]", 
                                                  t.status === 'done' ? "text-[#1D9E75]" : "text-muted-foreground/50"
                                                )} />
                                                <span className={cn("leading-tight", t.status === 'done' && "line-through text-muted-foreground")}>
                                                  {t.title || '할 일'}
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
                            {isManager && (
                              <div 
                                className={cn(
                                  "h-0 group-hover/cell:h-8 group-hover/cell:mt-1 relative rounded-md transition-all duration-200 overflow-hidden bg-black/[0.02] hover:bg-black/[0.04] cursor-pointer group/add-btn"
                                )}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onCellClick(staff, date)
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