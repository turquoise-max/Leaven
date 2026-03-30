'use client'

import React, { useMemo, useRef, useState } from 'react'
import { format, isSameDay } from 'date-fns'
import { ko } from 'date-fns/locale'

interface DailyTimelineViewProps {
  currentDate: Date
  staffList: any[]
  localSchedules: any[]
  roles: any[]
  activeRoleIds: string[]
  getStaffRoleInfo: (staff: any) => any
  approvedLeaves: any[]
  isManager: boolean
  onCellClick: (staff: any, date: Date, hour: number) => void
  onScheduleClick: (sch: any, staff: any) => void
  hours: number[]
}

function hexToRgba(hex: string, alpha: number) {
  if (!hex) return `rgba(0,0,0,${alpha})`
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function DailyTimelineView({
  currentDate,
  staffList,
  localSchedules,
  roles,
  activeRoleIds,
  getStaffRoleInfo,
  approvedLeaves,
  isManager,
  onCellClick,
  onScheduleClick,
  hours
}: DailyTimelineViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // 필터링 및 정렬된 직원 목록
  const displayStaff = useMemo(() => {
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

  const formatTimeStr = (hourVal: number) => {
    const displayHour = Math.floor(hourVal) >= 24 ? Math.floor(hourVal) - 24 : Math.floor(hourVal)
    return `${displayHour.toString().padStart(2, '0')}:00`
  }

  const getSchedulePosition = (sch: any) => {
    const start = new Date(sch.start_time)
    const end = new Date(sch.end_time)

    // Only process if it belongs to currentDate
    if (!isSameDay(start, currentDate) && !isSameDay(end, currentDate)) return null

    let startHour = start.getHours() + start.getMinutes() / 60
    let endHour = end.getHours() + end.getMinutes() / 60

    if (endHour <= startHour || end.getDate() !== start.getDate()) {
      endHour += 24
    }

    const minHour = hours[0]
    const maxHour = hours[hours.length - 1] + 1 // +1 because maxHour in array is e.g. 24, so range is 0~25 hours

    // If schedule is completely outside the timeline view hours, ignore
    if (endHour <= minHour || startHour >= maxHour) return null

    // Clamping
    const renderStart = Math.max(startHour, minHour)
    const renderEnd = Math.min(endHour, maxHour)

    const totalHours = maxHour - minHour
    const leftPercent = ((renderStart - minHour) / totalHours) * 100
    const widthPercent = ((renderEnd - renderStart) / totalHours) * 100

    return { left: `${leftPercent}%`, width: `${widthPercent}%` }
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-black/10 overflow-hidden shadow-sm">
      <div className="flex-1 overflow-x-hidden overflow-y-auto relative" ref={containerRef}>
        <div className="flex flex-col min-w-[800px] h-full">
          {/* Header Row (Hours) */}
          <div className="flex border-b border-black/10 sticky top-0 bg-[#fbfbfb] z-20">
            {/* Top-left empty corner */}
            <div className="w-[120px] lg:w-[150px] shrink-0 border-r border-black/10 bg-[#fbfbfb] sticky left-0 z-30 flex items-center px-3 lg:px-4">
              <span className="text-[12px] font-semibold text-[#6b6b6b]">직원</span>
            </div>
            
            {/* Hours */}
            <div className="flex flex-1 relative min-w-0">
              {hours.map((hour) => (
                <div 
                  key={`header-${hour}`} 
                  className="flex-1 flex items-end px-0.5 lg:px-1 pb-1 border-r border-black/5"
                >
                  <span className="text-[9px] lg:text-[10px] text-[#6b6b6b] whitespace-nowrap truncate">{formatTimeStr(hour)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Body Rows (Staff) */}
          <div className="flex flex-col relative flex-1">
            {displayStaff.map(staff => {
              const roleInfo = getStaffRoleInfo(staff)
              const roleColor = roleInfo?.color || '#534AB7'
              const staffSchedules = localSchedules.filter(sch => 
                sch.schedule_members?.some((sm: any) => sm.member_id === staff.id) &&
                (isSameDay(new Date(sch.start_time), currentDate) || isSameDay(new Date(sch.end_time), currentDate))
              )

              const currentStr = format(currentDate, 'yyyy-MM-dd')
              const staffLeave = approvedLeaves.find(leave => {
                if (leave.member_id !== staff.id) return false
                const leaveStartStr = leave.start_date.split('T')[0]
                const leaveEndStr = leave.end_date.split('T')[0]
                return currentStr >= leaveStartStr && currentStr <= leaveEndStr
              })
              const isStaffOnLeave = !!staffLeave

              return (
                <div key={staff.id} className={`flex border-b border-black/5 group transition-colors h-[50px] lg:h-[60px] ${isStaffOnLeave ? 'bg-[#f5f5f5] grayscale opacity-70' : 'hover:bg-black/[0.02]'}`}>
                  {/* Staff Info Column */}
                  <div className={`w-[120px] lg:w-[150px] shrink-0 border-r border-black/10 sticky left-0 z-10 flex items-center px-2 lg:px-4 gap-2 lg:gap-3 transition-colors ${isStaffOnLeave ? 'bg-[#f5f5f5]' : 'bg-white group-hover:bg-[#fbfbfb]'}`}>
                    <div 
                      className="w-7 h-7 lg:w-8 lg:h-8 shrink-0 rounded-full flex items-center justify-center text-[11px] lg:text-[12px] font-bold"
                      style={{ backgroundColor: hexToRgba(roleColor, 0.15), color: roleColor }}
                    >
                      {staff.name?.substring(0, 1)}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[12px] lg:text-[13px] font-semibold text-[#1a1a1a] truncate flex items-center">
                        <span className="truncate">{staff.name}</span>
                        {isStaffOnLeave && <span className="ml-1 text-[9px] bg-black/10 px-1 py-0.5 rounded text-black/60 shrink-0">휴가</span>}
                      </span>
                      <span className="text-[10px] lg:text-[11px] text-[#6b6b6b] truncate">{roleInfo?.name || '역할 없음'}</span>
                    </div>
                  </div>

                  {/* Timeline Grid for this Staff */}
                  <div className="flex flex-1 relative min-w-0">
                    {/* Background Grid Cells */}
                    {hours.map(hour => (
                      <div 
                        key={`cell-${staff.id}-${hour}`}
                        className={`flex-1 border-r border-black/5 transition-colors ${isStaffOnLeave ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-black/5'}`}
                        onClick={() => {
                          if (!isStaffOnLeave) {
                            onCellClick(staff, currentDate, hour)
                          }
                        }}
                      />
                    ))}

                    {/* Leave Overlay Block */}
                    {isStaffOnLeave && (
                      <div 
                        className="absolute inset-y-1 rounded-md bg-black/5 border border-black/10 flex items-center justify-center z-0 pointer-events-none"
                        style={{ left: 10, right: 10 }}
                      >
                        <span className="text-[12px] font-medium text-[#6b6b6b]">
                          {staffLeave.leave_type === 'annual' ? '연차휴가' : 
                           staffLeave.leave_type === 'sick' ? '병가' : 
                           staffLeave.leave_type === 'half_am' ? '오전반차' :
                           staffLeave.leave_type === 'half_pm' ? '오후반차' : '휴가'}
                        </span>
                      </div>
                    )}

                    {/* Schedule Blocks */}
                    {staffSchedules.map(sch => {
                      const pos = getSchedulePosition(sch)
                      if (!pos) return null

                      const sRoleColor = sch.color || roleColor

                      return (
                        <div
                          key={sch.id}
                          className="absolute top-1.5 bottom-1.5 rounded-md shadow-sm border overflow-hidden cursor-pointer hover:ring-2 hover:ring-black/20 transition-all flex flex-col justify-center px-1.5"
                          style={{
                            left: pos.left,
                            width: pos.width, // percentage
                            minWidth: '4px',
                            backgroundColor: hexToRgba(sRoleColor, 0.15),
                            borderColor: hexToRgba(sRoleColor, 0.3),
                            color: sRoleColor
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            onScheduleClick(sch, staff)
                          }}
                        >
                          {/* 내용이 너무 짧으면 숨김 처리 (퍼센트 너비이므로 truncate 의존) */}
                          <div className="text-[10px] font-bold truncate leading-tight">
                            {sch.title || '근무'}
                          </div>
                          <div className="text-[9px] opacity-80 truncate leading-tight hidden md:block">
                            {format(new Date(sch.start_time), 'HH:mm')} - {format(new Date(sch.end_time), 'HH:mm')}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}