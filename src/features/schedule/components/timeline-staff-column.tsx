import React from 'react'
import { format } from 'date-fns'
import { Trash2 } from 'lucide-react'
import { getDerivedTaskStatus } from './unified-calendar'

interface TimelineStaffColumnProps {
  staff: any
  safeName: string
  roleColor: string
  selectedDate: Date
  isDragCreate: boolean
  dragState: any
  setDragState: any
  localSchedules: any[]
  hours: number[]
  now: Date
  isDraggingRef: React.MutableRefObject<boolean>
  isModalOpen: boolean
  selectedScheduleId?: string
  handleScheduleClick: (sch: any, staff: any) => void
  setTooltipData: (data: any) => void
  setSingleDayDeleteModal: (data: any) => void
  getStaffRoleInfo: (staff: any) => any
}

export function TimelineStaffColumn({
  staff,
  safeName,
  roleColor,
  selectedDate,
  isDragCreate,
  dragState,
  setDragState,
  localSchedules,
  hours,
  now,
  isDraggingRef,
  isModalOpen,
  selectedScheduleId,
  handleScheduleClick,
  setTooltipData,
  setSingleDayDeleteModal,
  getStaffRoleInfo
}: TimelineStaffColumnProps) {
  return (
    <div className="flex-1 flex flex-col relative min-w-[50px] max-w-[120px] group/col">
      {/* 상단 직원 이름 헤더 (역할 색상 적용) */}
      <div className="h-[36px] shrink-0 flex flex-col items-center justify-center gap-0.5 sticky top-0 z-20 bg-white/95 backdrop-blur-sm pb-1 px-1 relative">
        {/* 프로필 서클에 옅은 역할 배경색을 깔아 직무 식별을 명확히 함 */}
        <div 
          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold shrink-0 shadow-sm border border-black/5"
          style={{ backgroundColor: `${roleColor}26`, color: roleColor }}
        >
          {safeName.substring(0, 1)}
        </div>
        <span className="text-[10px] font-medium text-[#1a1a1a] truncate w-full text-center tracking-tight">{safeName}</span>
        
        {/* 오늘 하루 스케줄 비우기 버튼 (hover 시 표시) */}
        <button 
          className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center bg-white border border-black/10 text-destructive shadow-sm opacity-0 group-hover/col:opacity-100 hover:bg-destructive hover:text-white hover:border-destructive transition-all"
          title="이 날짜 스케줄 모두 지우기"
          onClick={() => {
            setSingleDayDeleteModal({
              isOpen: true,
              staffId: staff.id,
              staffName: safeName,
              date: selectedDate
            })
          }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 직원별 타임라인 바디 (테두리 없음, 깔끔한 빈 공간) */}
      <div 
        id={`staff-col-${staff.id}`}
        className="relative flex-1 group w-full"
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest('.schedule-block')) return;
          const rect = e.currentTarget.getBoundingClientRect()
          const offsetY = e.clientY - rect.top
          
          setDragState({
            type: 'create_v',
            staffId: staff.id,
            startY: offsetY,
            startX: e.clientX,
            startClientY: e.clientY,
            currentY: offsetY,
            currentX: e.clientX
          })
        }}
      >
        {/* Drag creation preview */}
        {isDragCreate && dragState && (
          <div 
            className="absolute left-1/2 -translate-x-1/2 w-4 bg-primary/20 border-x-2 border-primary/50 rounded-sm z-20 pointer-events-none"
            style={{
              top: `${Math.max(0, Math.min(dragState.startY, dragState.currentY))}px`,
              height: `${Math.abs(dragState.currentY - dragState.startY)}px`
            }}
          />
        )}

        {/* 호버 시 세로 가이드라인 표시 */}
        <div className="absolute inset-0 w-8 left-1/2 -translate-x-1/2 bg-black/0 group-hover:bg-black/[0.03] rounded-full transition-colors pointer-events-none -z-10" />

        {/* 직원별 스케줄 블록들 */}
        {localSchedules
          .filter(sch => {
            if (!sch.start_time) return false;
            const parsedDate = new Date(sch.start_time);
            if (isNaN(parsedDate.getTime())) return false;
            
            const dateStr = format(selectedDate, 'yyyy-MM-dd')
            const schDateStr = format(parsedDate, 'yyyy-MM-dd')
            return schDateStr === dateStr && sch.schedule_members?.some((sm: any) => sm.member_id === staff.id)
          })
          .map(sch => {
            const start = new Date(sch.start_time)
            const end = new Date(sch.end_time)
            
            let startHour = start.getHours() + start.getMinutes() / 60
            let endHour = end.getHours() + end.getMinutes() / 60
            
            if (endHour <= startHour || end.getDate() !== start.getDate()) {
              endHour += 24
            }
            
            // 시각적 기준이 되는 시작 시간 (화면 범위를 벗어날 경우 화면 최상단 시간에 맞춤)
            const visualStartHour = Math.max(startHour, hours[0])
            let topPos = (visualStartHour - hours[0]) * 40
            let heightPos = Math.max(20, (endHour - visualStartHour) * 40)
            
            if (dragState && dragState.scheduleId === sch.id) {
              const MAX_HEIGHT = 24 * 40
              if (dragState.type === 'move_v' && dragState.initialTop !== undefined) {
                const dy = Math.round((dragState.currentY - dragState.startY) / 20) * 20
                topPos = Math.max(0, Math.min(dragState.initialTop + dy, MAX_HEIGHT - heightPos))
              } else if (dragState.type === 'resize_v' && dragState.initialHeight !== undefined) {
                const dy = Math.round((dragState.currentY - dragState.startY) / 20) * 20
                heightPos = Math.max(20, Math.min(dragState.initialHeight + dy, MAX_HEIGHT - topPos))
              }
            }
            
            const schRoleInfo = getStaffRoleInfo(staff)
            const schRoleColor = schRoleInfo?.color || sch.color || '#534AB7'

            const tasks = sch.task_assignments || []
            // 루틴 업무는 점(Dot)으로 표시하지 않음
            const customTasks = tasks.filter((ta: any) => ta.task && !ta.task.is_routine)
            const routineTasks = tasks.filter((ta: any) => ta.task && ta.task.is_routine)
            const timeSpecificTasks = customTasks.filter((ta: any) => ta.start_time)
            const anytimeTasks = customTasks.filter((ta: any) => !ta.start_time)

            return (
              <div 
                key={sch.id}
                className={`schedule-block absolute rounded-full cursor-pointer transition-all hover:brightness-95 z-10 flex flex-col left-1/2 -translate-x-1/2 w-1 shadow-sm ${selectedScheduleId === sch.id ? 'ring-[1.5px] ring-black ring-offset-[1.5px] z-20' : 'hover:scale-x-[2]'}`}
                style={{ 
                  backgroundColor: schRoleColor,
                  top: `${topPos}px`,
                  height: `${heightPos - 2}px`,
                  cursor: dragState?.type === 'move_v' ? 'grabbing' : 'grab'
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setDragState({
                    type: 'move_v',
                    scheduleId: sch.id,
                    staffId: staff.id,
                    startY: e.clientY,
                    startX: e.clientX,
                    startClientY: e.clientY,
                    currentY: e.clientY,
                    currentX: e.clientX,
                    initialTop: topPos,
                    initialHeight: heightPos
                  })
                }}
                onClick={(e) => {
                  if (isDraggingRef.current) return;
                  handleScheduleClick(sch, staff)
                }}
                onMouseEnter={(e) => {
                  if (dragState || isModalOpen) return
                  const tRoleInfo = getStaffRoleInfo(staff)
                  setTooltipData({
                    isSchedule: true,
                    name: sch.title || safeName,
                    role: tRoleInfo?.name || '역할 없음',
                    shift: `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')} (${(endHour - startHour).toFixed(1)}h)`,
                    routineTasks: routineTasks.map((ta: any) => ({
                      title: ta.task?.title,
                      checklist: ta.task?.checklist
                    })),
                    anytimeTasks: anytimeTasks.map((ta: any) => ({
                      title: ta.task?.title,
                      checklist: ta.task?.checklist
                    })),
                    timeSpecificTasks: timeSpecificTasks.map((ta: any) => {
                      const ts = new Date(ta.start_time)
                      const timeStr = ta.start_time.includes('T') ? format(ts, 'HH:mm') : ta.start_time.substring(0, 5)
                      return {
                        title: ta.task?.title,
                        time: timeStr,
                        checklist: ta.task?.checklist
                      }
                    })
                  })
                }}
                onMouseLeave={() => setTooltipData(null)}
              >
                {heightPos > 20 && anytimeTasks.length > 0 && (
                  <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white shadow-sm opacity-80" />
                )}
                
                {timeSpecificTasks.map((ta: any, idx: number) => {
                  const taskStartStr = ta.start_time
                  let taskHourNum = 0
                  
                  // ISO string or Postgres timestamptz (e.g. "2026-03-19 02:14:00+00")
                  // First try parsing as Date
                  const taskDate = new Date(taskStartStr)
                  if (!isNaN(taskDate.getTime()) && taskStartStr.length > 5) { // length > 5 prevents "11:14" from becoming 2001-01-01T11:14
                    taskHourNum = taskDate.getHours() + taskDate.getMinutes() / 60
                  } else {
                    // HH:mm string fallback
                    const taskTimeMatch = taskStartStr.match(/(\d{2}):(\d{2})/)
                    if (!taskTimeMatch) return null
                    taskHourNum = parseInt(taskTimeMatch[1]) + parseInt(taskTimeMatch[2]) / 60
                  }
                  
                  if (taskHourNum < Math.floor(startHour)) {
                    taskHourNum += 24
                  }
                  
                  const relativeHour = taskHourNum - visualStartHour
                  let dotTop = relativeHour * 40
                  const isOutOfBounds = dotTop < -4 || dotTop > heightPos - 4
                  const derivedStatus = getDerivedTaskStatus(ta, format(start, 'yyyy-MM-dd'), now)
                  const dotBorderColor = derivedStatus === 'done' ? '#16a34a' : derivedStatus === 'in_progress' ? '#2563eb' : derivedStatus === 'pending' ? '#ea580c' : '#6b6b6b'
                  const dotBgColor = derivedStatus === 'done' ? '#bbf7d0' : derivedStatus === 'in_progress' ? '#bfdbfe' : derivedStatus === 'pending' ? '#fed7aa' : 'white'

                  return (
                    <div
                      key={ta.id || idx}
                      className={`absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full z-30 transition-transform hover:scale-150 ${isOutOfBounds ? 'shadow-[0_0_0_2px_rgba(239,68,68,0.3)] animate-pulse' : 'shadow-[0_1px_3px_rgba(0,0,0,0.3)]'}`}
                      style={{ 
                        top: `${dotTop}px`,
                        border: `2px solid ${isOutOfBounds ? '#ef4444' : dotBorderColor}`,
                        backgroundColor: dotBgColor,
                        opacity: isOutOfBounds ? 0.8 : 1
                      }}
                      onMouseEnter={(e) => {
                        e.stopPropagation()
                        setTooltipData({
                          isTaskSpecific: true,
                          name: ta.task?.title,
                          time: taskStartStr.includes('T') ? format(new Date(taskStartStr), 'HH:mm') : taskStartStr.substring(0, 5),
                          status: derivedStatus,
                          checklist: ta.task?.checklist
                        })
                      }}
                      onMouseLeave={(e) => {
                        e.stopPropagation()
                        setTooltipData(null)
                      }}
                    />
                  )
                })}

                <div 
                  className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize hover:bg-black/20 transition-colors rounded-b-full z-20"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDragState({
                      type: 'resize_v',
                      scheduleId: sch.id,
                      staffId: staff.id,
                      startY: e.clientY,
                      startX: e.clientX,
                      startClientY: e.clientY,
                      currentY: e.clientY,
                      currentX: e.clientX,
                      initialTop: topPos,
                      initialHeight: heightPos
                    })
                  }}
                />
              </div>
            )
          })}
      </div>
    </div>
  )
}