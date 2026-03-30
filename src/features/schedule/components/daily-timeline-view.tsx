'use client'

import React, { useMemo, useRef, useState, useEffect } from 'react'
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
  onScheduleCreateDrag?: (staffId: string, date: Date, startTimeStr: string, endTimeStr: string) => void
  onScheduleUpdateDrag?: (scheduleId: string, date: Date, startTimeStr: string, endTimeStr: string) => void
  hours: number[]
}

type InteractionState = {
  type: 'create' | 'move' | 'resizeLeft' | 'resizeRight'
  staffId: string
  scheduleId?: string
  startPx: number
  currentPx: number
  trackWidth: number
  originalStartMins?: number
  originalEndMins?: number
} | null

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
  onScheduleCreateDrag,
  onScheduleUpdateDrag,
  hours
}: DailyTimelineViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [interactionState, setInteractionState] = useState<InteractionState>(null)
  const draggedRef = useRef(false)

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
    const maxHour = hours[hours.length - 1] // +1 제거 (배경 그리드는 24칸으로 분할됨)

    // If schedule is completely outside the timeline view hours, ignore
    if (endHour <= minHour || startHour >= maxHour) return null

    // Clamping
    const renderStart = Math.max(startHour, minHour)
    const renderEnd = Math.min(endHour, maxHour)

    const totalHours = maxHour - minHour
    const leftPercent = ((renderStart - minHour) / totalHours) * 100
    const widthPercent = ((renderEnd - renderStart) / totalHours) * 100

    return { left: `${leftPercent}%`, width: `${widthPercent}%`, startMins: Math.round(startHour * 60), endMins: Math.round(endHour * 60) }
  }

  const pxToMins = (x: number, trackWidth: number) => {
    const totalHours = hours[hours.length - 1] - hours[0]
    const totalMins = totalHours * 60
    const percentage = Math.max(0, Math.min(x / trackWidth, 1))
    let mins = Math.round((percentage * totalMins) / 30) * 30
    return mins + hours[0] * 60
  }

  const minsToTimeStr = (mins: number) => {
    const h = Math.floor(mins / 60)
    const m = Math.floor(mins % 60)
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!interactionState) return
      const trackElement = document.getElementById(`track-${interactionState.staffId}`)
      if (!trackElement) return
      
      const rect = trackElement.getBoundingClientRect()
      let x = e.clientX - rect.left
      
      if (Math.abs(x - interactionState.startPx) > 5) {
        draggedRef.current = true
      }

      setInteractionState(prev => prev ? { ...prev, currentPx: x } : null)
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (!interactionState) return
      
      const { type, staffId, scheduleId, startPx, currentPx, trackWidth, originalStartMins, originalEndMins } = interactionState
      const minHour = hours[0]
      const maxHour = hours[hours.length - 1]
      const maxMins = maxHour * 60

      if (type === 'create') {
        const minPx = Math.min(startPx, currentPx)
        const maxPx = Math.max(startPx, currentPx)
        let startMins = pxToMins(minPx, trackWidth)
        let endMins = pxToMins(maxPx, trackWidth)
        if (endMins === startMins) endMins = startMins + 60 // 기본 1시간
        if (Math.abs(currentPx - startPx) > 10) { // 약간의 드래그가 있었을 때만
          onScheduleCreateDrag?.(staffId, currentDate, minsToTimeStr(startMins), minsToTimeStr(endMins))
        }
      } else if (type === 'move' && originalStartMins !== undefined && originalEndMins !== undefined) {
        const dxPx = currentPx - startPx
        const dxMins = Math.round((dxPx / trackWidth) * (maxHour - minHour) * 60 / 30) * 30
        if (dxMins !== 0) {
          let newStartMins = originalStartMins + dxMins
          let newEndMins = originalEndMins + dxMins
          if (newStartMins < minHour * 60) {
            const diff = minHour * 60 - newStartMins
            newStartMins += diff
            newEndMins += diff
          }
          if (newEndMins > maxMins) {
            const diff = newEndMins - maxMins
            newStartMins -= diff
            newEndMins -= diff
          }
          onScheduleUpdateDrag?.(scheduleId!, currentDate, minsToTimeStr(newStartMins), minsToTimeStr(newEndMins))
        }
      } else if (type === 'resizeLeft' && originalStartMins !== undefined && originalEndMins !== undefined) {
        const currentMins = pxToMins(currentPx, trackWidth)
        let newStartMins = currentMins
        if (newStartMins >= originalEndMins) newStartMins = originalEndMins - 30
        if (newStartMins !== originalStartMins) {
          onScheduleUpdateDrag?.(scheduleId!, currentDate, minsToTimeStr(newStartMins), minsToTimeStr(originalEndMins))
        }
      } else if (type === 'resizeRight' && originalStartMins !== undefined && originalEndMins !== undefined) {
        const currentMins = pxToMins(currentPx, trackWidth)
        let newEndMins = currentMins
        if (newEndMins <= originalStartMins) newEndMins = originalStartMins + 30
        if (newEndMins !== originalEndMins) {
          onScheduleUpdateDrag?.(scheduleId!, currentDate, minsToTimeStr(originalStartMins), minsToTimeStr(newEndMins))
        }
      }
      
      setInteractionState(null)
    }

    if (interactionState) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [interactionState, currentDate, onScheduleCreateDrag, onScheduleUpdateDrag, hours])

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
              {hours.slice(0, -1).map((hour, index) => (
                <div 
                  key={`header-${hour}`} 
                  className="flex-1 flex items-end border-r border-black/5 relative h-8"
                >
                  <span className={`absolute bottom-1 text-[9px] lg:text-[10px] text-[#6b6b6b] whitespace-nowrap bg-[#fbfbfb] px-0.5 z-10 ${index === 0 ? 'left-1' : 'left-0 transform -translate-x-1/2'}`}>
                    {formatTimeStr(hour)}
                  </span>
                </div>
              ))}
              {/* Last hour label */}
              {hours.length > 0 && (
                <span className="absolute right-1 bottom-1 text-[9px] lg:text-[10px] text-[#6b6b6b] whitespace-nowrap bg-[#fbfbfb] px-0.5 z-10">
                  {formatTimeStr(hours[hours.length - 1])}
                </span>
              )}
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
                  <div 
                    id={`track-${staff.id}`}
                    className="flex flex-1 relative min-w-0"
                    onMouseDown={(e) => {
                      if (!isManager || isStaffOnLeave) return
                      // Only trigger create on background grid
                      if ((e.target as HTMLElement).id === `track-${staff.id}` || (e.target as HTMLElement).classList.contains('bg-grid-cell')) {
                        const rect = e.currentTarget.getBoundingClientRect()
                        const x = e.clientX - rect.left
                        draggedRef.current = false
                        setInteractionState({
                          type: 'create',
                          staffId: staff.id,
                          startPx: x,
                          currentPx: x,
                          trackWidth: rect.width
                        })
                      }
                    }}
                  >
                    {/* Background Grid Cells */}
                    {hours.slice(0, -1).map(hour => (
                      <div 
                        key={`cell-${staff.id}-${hour}`}
                        className={`flex-1 border-r border-black/5 transition-colors bg-grid-cell ${isStaffOnLeave ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-black/5'}`}
                        onClick={() => {
                          if (draggedRef.current) return
                          if (!isStaffOnLeave) {
                            onCellClick(staff, currentDate, hour)
                          }
                        }}
                      />
                    ))}

                    {/* Interaction Ghost Render (Create Mode) */}
                    {interactionState?.type === 'create' && interactionState.staffId === staff.id && (
                      <div 
                        className="absolute top-1.5 bottom-1.5 rounded-md bg-black/10 border-2 border-black border-dashed pointer-events-none z-10"
                        style={{
                          left: `${Math.min(interactionState!.startPx, interactionState!.currentPx)}px`,
                          width: `${Math.abs(interactionState!.currentPx - interactionState!.startPx)}px`,
                        }}
                      />
                    )}

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

                      // Moving/Resizing styles
                      const isInteractingThis = interactionState?.scheduleId === sch.id
                      const isMove = isInteractingThis && interactionState?.type === 'move'
                      const isResizeLeft = isInteractingThis && interactionState?.type === 'resizeLeft'
                      const isResizeRight = isInteractingThis && interactionState?.type === 'resizeRight'
                      
                      let renderLeft = pos.left
                      let renderWidth = pos.width
                      
                      if (isInteractingThis) {
                        const trackW = interactionState!.trackWidth
                        const dxPercent = ((interactionState!.currentPx - interactionState!.startPx) / trackW) * 100
                        
                        if (isMove) {
                           const originalLeft = ((pos.startMins - hours[0]*60) / ((hours[hours.length-1] - hours[0])*60)) * 100
                           renderLeft = `${originalLeft + dxPercent}%`
                        } else if (isResizeLeft) {
                           const originalLeft = ((pos.startMins - hours[0]*60) / ((hours[hours.length-1] - hours[0])*60)) * 100
                           const originalWidth = ((pos.endMins - pos.startMins) / ((hours[hours.length-1] - hours[0])*60)) * 100
                           const newLeft = originalLeft + dxPercent
                           const newWidth = originalWidth - dxPercent
                           renderLeft = `${newLeft}%`
                           renderWidth = `${newWidth}%`
                        } else if (isResizeRight) {
                           const originalWidth = ((pos.endMins - pos.startMins) / ((hours[hours.length-1] - hours[0])*60)) * 100
                           const newWidth = originalWidth + dxPercent
                           renderWidth = `${newWidth}%`
                        }
                      }

                      return (
                        <div
                          key={sch.id}
                          className={`absolute top-1.5 bottom-1.5 rounded-md shadow-sm border overflow-hidden transition-colors flex flex-col justify-center px-1.5 group/sch ${isInteractingThis ? 'opacity-80 z-20 scale-105 shadow-md' : 'hover:ring-2 hover:ring-black/20 z-10 cursor-pointer'}`}
                          style={{
                            left: renderLeft,
                            width: renderWidth,
                            minWidth: '4px',
                            backgroundColor: hexToRgba(sRoleColor, 0.15),
                            borderColor: hexToRgba(sRoleColor, 0.3),
                            color: sRoleColor,
                            transition: isInteractingThis ? 'none' : 'left 0.2s, width 0.2s, background-color 0.2s'
                          }}
                          onMouseDown={(e) => {
                            if (!isManager) return
                            e.stopPropagation()
                            const rect = document.getElementById(`track-${staff.id}`)?.getBoundingClientRect()
                            if (!rect) return
                            draggedRef.current = false
                            setInteractionState({
                              type: 'move',
                              staffId: staff.id,
                              scheduleId: sch.id,
                              startPx: e.clientX - rect.left,
                              currentPx: e.clientX - rect.left,
                              trackWidth: rect.width,
                              originalStartMins: pos.startMins,
                              originalEndMins: pos.endMins
                            })
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (draggedRef.current) return
                            onScheduleClick(sch, staff)
                          }}
                        >
                          <div className="text-[10px] font-bold truncate leading-tight select-none">
                            {sch.title || '근무'}
                          </div>
                          <div className="text-[9px] opacity-80 truncate leading-tight hidden md:block select-none">
                            {format(new Date(sch.start_time), 'HH:mm')} - {format(new Date(sch.end_time), 'HH:mm')}
                          </div>

                          {/* Resize Handles */}
                          {isManager && !isInteractingThis && (
                            <>
                              <div 
                                className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/10 transition-colors opacity-0 group-hover/sch:opacity-100"
                                onMouseDown={(e) => {
                                  e.stopPropagation()
                                  const rect = document.getElementById(`track-${staff.id}`)?.getBoundingClientRect()
                                  if (!rect) return
                                  draggedRef.current = false
                                  setInteractionState({
                                    type: 'resizeLeft',
                                    staffId: staff.id,
                                    scheduleId: sch.id,
                                    startPx: e.clientX - rect.left,
                                    currentPx: e.clientX - rect.left,
                                    trackWidth: rect.width,
                                    originalStartMins: pos.startMins,
                                    originalEndMins: pos.endMins
                                  })
                                }}
                              />
                              <div 
                                className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/10 transition-colors opacity-0 group-hover/sch:opacity-100"
                                onMouseDown={(e) => {
                                  e.stopPropagation()
                                  const rect = document.getElementById(`track-${staff.id}`)?.getBoundingClientRect()
                                  if (!rect) return
                                  draggedRef.current = false
                                  setInteractionState({
                                    type: 'resizeRight',
                                    staffId: staff.id,
                                    scheduleId: sch.id,
                                    startPx: e.clientX - rect.left,
                                    currentPx: e.clientX - rect.left,
                                    trackWidth: rect.width,
                                    originalStartMins: pos.startMins,
                                    originalEndMins: pos.endMins
                                  })
                                }}
                              />
                            </>
                          )}
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