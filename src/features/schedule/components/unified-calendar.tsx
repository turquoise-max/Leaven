'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameDay, isSameMonth } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Search, Sparkles, Plus, CalendarPlus, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { updateTaskStatus } from '@/features/schedule/task-actions'
import { updateScheduleTime } from '@/features/schedule/actions'
import { toast } from 'sonner'
import { toUTCISOString, getDiffInMinutes, addMinutesToTime } from '@/lib/date-utils'
import { ScheduleDetailPanel, STATUS_INFO } from './schedule-detail-panel'
import { ScheduleCreateDialog } from './schedule-create-dialog'
import { UnifiedAutoScheduleDialog } from './unified-auto-schedule-dialog'
import { UnifiedBulkDeleteDialog } from './unified-bulk-delete-dialog'
import { Trash2 } from 'lucide-react'
import { deleteStaffSchedules } from '@/features/schedule/actions'
import { MiniCalendar } from './mini-calendar'
import { CalendarHeader } from './calendar-header'
import { TimelineTooltip } from './timeline-tooltip'
import { SingleDayDeleteModal, ConfirmMoveModal } from './schedule-action-modals'
import { TimelineStaffColumn } from './timeline-staff-column'
import { WeeklyShiftBoard } from './weekly-shift-board'

// 자동 파생 상태 계산 헬퍼 (시간 기반)
export function getDerivedTaskStatus(ta: any, scheduleDateStr: string, now: Date): 'todo' | 'in_progress' | 'pending' | 'done' {
  if (ta.task?.status === 'done') return 'done'
  if (!ta.start_time) return 'todo'

  let taskDateObj = null;
  if (ta.start_time.includes('T')) {
    taskDateObj = new Date(ta.start_time)
  } else {
    const dateStr = ta.assigned_date || scheduleDateStr
    if (!dateStr) return 'todo'
    // 만약 start_time이 "09:00" 처럼 초가 없으면 추가
    const timeStr = ta.start_time.length === 5 ? `${ta.start_time}:00` : ta.start_time
    taskDateObj = new Date(`${dateStr}T${timeStr}`)
  }

  if (isNaN(taskDateObj.getTime())) return 'todo'

  const startTimeMs = taskDateObj.getTime()
  const nowMs = now.getTime()
  const thirtyMinsMs = 30 * 60 * 1000

  if (nowMs < startTimeMs) {
    return 'todo'
  } else if (nowMs >= startTimeMs && nowMs < startTimeMs + thirtyMinsMs) {
    return 'in_progress'
  } else {
    return 'pending'
  }
}

// 유틸리티: 색상 변환
function hexToRgba(hex: string, alpha: number) {
  if (!hex) return `rgba(0,0,0,${alpha})`
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

interface UnifiedCalendarProps {
  storeId: string
  roles: any[]
  staffList?: any[]
  schedules?: any[]
  storeOpeningHours?: any
}

export function UnifiedCalendar({ storeId, roles, staffList = [], schedules = [], storeOpeningHours }: UnifiedCalendarProps) {
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day')
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null)
  
  const [currentDate, setCurrentDate] = useState<Date>(new Date()) // 미니 달력 뷰 기준
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 0 }))
  
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [tooltipData, setTooltipData] = useState<any>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  // 모달/패널 상태
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isAutoScheduleModalOpen, setIsAutoScheduleModalOpen] = useState(false)
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false)
  const [confirmMoveModal, setConfirmMoveModal] = useState<{
    isOpen: boolean;
    scheduleId: string;
    newStartUTC: string;
    newEndUTC: string;
    deltaMinutes: number;
  } | null>(null)

  const [singleDayDeleteModal, setSingleDayDeleteModal] = useState<{
    isOpen: boolean;
    staffId: string;
    staffName: string;
    date: Date;
  } | null>(null)

  const [createForm, setCreateForm] = useState({
    title: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00',
    endTime: '18:00',
    staffId: ''
  })
  
  // 검색창 포커스 상태
  const [isSearchFocused, setIsSearchFocused] = useState(false)

  // 드래그 상태 관리
  const [dragState, setDragState] = useState<{
    type: 'create_v' | 'create_h' | 'move_v' | 'resize_v';
    scheduleId?: string;
    staffId?: string;
    startY: number; // 부모 컨테이너 기준 상대 Y 좌표 (생성 시)
    startX: number;
    startClientY: number; // 브라우저 창 기준 최초 클릭 절대 Y 좌표 (드래그 오차 방지용)
    currentY: number; // 부모 컨테이너 기준 상대 Y 좌표 (생성 시)
    currentX: number;
    initialTop?: number;
    initialHeight?: number;
  } | null>(null)

  const [localSchedules, setLocalSchedules] = useState<any[]>([])
  
  // 드래그 종료 직후 클릭 방지용 ref
  const isDraggingRef = useRef(false)

  // 실시간 현재 시간 상태 (타임라인 지시선용)
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000) // 1분마다 업데이트
    return () => clearInterval(timer)
  }, [])

  // 역할(Role) 필터링 상태 (기본값: 모든 역할 선택됨)
  const [activeRoleIds, setActiveRoleIds] = useState<string[]>([])
  useEffect(() => {
    if (roles && roles.length > 0 && activeRoleIds.length === 0) {
      setActiveRoleIds(roles.map(r => r.id))
    }
  }, [roles])

  const toggleRole = (roleId: string) => {
    setActiveRoleIds(prev => {
      // 이미 모든 역할이 선택된 상태에서 하나를 클릭하면, 그 하나만 선택되도록 (독점 선택 편의성)
      if (prev.length === roles.length) {
        return [roleId]
      }
      
      const next = prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
      // 모두 해제되면 다시 전체 선택으로 복구
      return next.length === 0 ? roles.map(r => r.id) : next
    })
  }

  useEffect(() => {
    setLocalSchedules(schedules || [])
  }, [schedules])

  // 중복 스케줄 검사 유틸리티
  const checkOverlap = (staffId: string, newStart: Date, newEnd: Date, excludeScheduleId?: string) => {
    return localSchedules.some(sch => {
      if (excludeScheduleId && sch.id === excludeScheduleId) return false;
      const hasMember = sch.schedule_members?.some((sm: any) => sm.member_id === staffId);
      if (!hasMember) return false;
      
      const schStart = new Date(sch.start_time);
      const schEnd = new Date(sch.end_time);
      
      // 날짜가 다르면 패스
      if (!isSameDay(schStart, newStart)) return false;

      // 겹침 조건: 새 시작시간이 기존 종료시간 전이고, 새 종료시간이 기존 시작시간 후일 때
      return newStart < schEnd && newEnd > schStart;
    });
  }

  // 드래그 중 최신 상태를 참조하기 위한 ref (클로저 문제 해결)
  const dragStateRef = useRef(dragState)
  const localSchedulesRef = useRef(localSchedules)
  
  useEffect(() => {
    dragStateRef.current = dragState
  }, [dragState])
  
  useEffect(() => {
    localSchedulesRef.current = localSchedules
  }, [localSchedules])

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      const currentDragState = dragStateRef.current
      if (!currentDragState) return
      
      let newY = e.clientY
      if (currentDragState.type === 'create_v') {
        // 매번 DOM을 찾지 않고, 최초 클릭한 상대좌표(startY)에 
        // 마우스가 브라우저 상에서 이동한 순수 픽셀 변위량(deltaY)만 더함
        const deltaY = e.clientY - currentDragState.startClientY
        newY = Math.max(0, currentDragState.startY + deltaY)
      }
      
      setDragState(prev => prev ? { ...prev, currentY: newY, currentX: e.clientX } : null)
    }
    
    const handleGlobalMouseUp = (e: MouseEvent) => {
      const currentDragState = dragStateRef.current
      if (!currentDragState) return
      
      const { type, startY, currentY, startX, currentX, initialTop, initialHeight, scheduleId, staffId } = currentDragState
      // 30분 단위 스냅 (1시간 = 40px -> 30분 = 20px)
      const snappedDy = Math.round((currentY - startY) / 20) * 20
      const dx = currentX - startX

      // 드래그 거리가 5px 이상이면 드래그(이동/리사이즈/생성)로 간주
      const isDrag = Math.abs(currentY - startY) > 5 || Math.abs(dx) > 5
      if (isDrag) {
        isDraggingRef.current = true
        setTimeout(() => {
          isDraggingRef.current = false
        }, 100)
      }

      if (type === 'create_v') {
        if (Math.abs(snappedDy) >= 20) {
          const MAX_HEIGHT = hours.length * 40
          const topY = Math.max(0, Math.min(MAX_HEIGHT - 20, Math.round(Math.min(startY, currentY) / 20) * 20))
          const bottomY = Math.max(20, Math.min(MAX_HEIGHT, Math.round(Math.max(startY, currentY) / 20) * 20))
          
          const startHour = hours[0] + (topY / 40)
          const endHour = hours[0] + (bottomY / 40)
          
          const formatTimeStr = (hourVal: number) => {
            const h = Math.floor(hourVal)
            const m = Math.floor((hourVal % 1) * 60)
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
          }

          const dateStr = format(selectedDate, 'yyyy-MM-dd')
          const startTimeStr = formatTimeStr(startHour)
          const endTimeStr = formatTimeStr(endHour)
          
          const newStartUTC = toUTCISOString(dateStr, startTimeStr)
          const newEndUTC = toUTCISOString(dateStr, endTimeStr)
          
          // 최신 schedules 참조 (overlap 체크용 - string 비교 혹은 Date 비교. Date(utc) 비교가 안전함)
          const startUtcDate = new Date(newStartUTC)
          const endUtcDate = new Date(newEndUTC)
          const isOverlap = localSchedulesRef.current.some(s => {
            const hasMember = s.schedule_members?.some((sm: any) => sm.member_id === staffId);
            if (!hasMember) return false;
            if (!isSameDay(new Date(s.start_time), startUtcDate)) return false;
            return startUtcDate < new Date(s.end_time) && endUtcDate > new Date(s.start_time);
          });
          
          if (staffId && isOverlap) {
            toast.error('해당 시간대에 이미 스케줄이 존재합니다.')
          } else {
            // 시간 표시용 포맷팅: 24 이상일 경우 -24
            const displayStartHour = Math.floor(startHour) >= 24 ? Math.floor(startHour) - 24 : Math.floor(startHour)
            const displayEndHour = Math.floor(endHour) >= 24 ? Math.floor(endHour) - 24 : Math.floor(endHour)
            const displayStartStr = `${displayStartHour.toString().padStart(2, '0')}:${Math.floor((startHour % 1) * 60).toString().padStart(2, '0')}`
            const displayEndStr = `${displayEndHour.toString().padStart(2, '0')}:${Math.floor((endHour % 1) * 60).toString().padStart(2, '0')}`
            
            // date는 자정을 넘겼을 경우 다음날로 넘기지 않고 선택한 기준일(dateStr)로 유지
            setCreateForm({
              title: '',
              date: dateStr,
              startTime: displayStartStr,
              endTime: displayEndStr,
              staffId: staffId || ''
            })
            setIsCreateModalOpen(true)
          }
        }
      } else if (type === 'move_v' || type === 'resize_v') {
        // 드래그 변위가 스냅 기준(20px, 30분)보다 작으면 단순 클릭으로 간주하고 무시
        if (Math.abs(snappedDy) < 20) {
          setDragState(null)
          return
        }

        // 최신 schedules 참조
        const sch = localSchedulesRef.current.find(s => s.id === scheduleId)
        if (sch) {
          let newTop = initialTop!
          let newHeight = initialHeight!
          
          const MAX_HEIGHT = hours.length * 40
          
          if (type === 'move_v') {
            newTop = Math.max(0, Math.min(initialTop! + snappedDy, MAX_HEIGHT - newHeight))
          } else if (type === 'resize_v') {
            newHeight = Math.max(20, Math.min(newHeight + snappedDy, MAX_HEIGHT - newTop))
          }
          
          const startHour = hours[0] + (newTop / 40)
          const endHour = startHour + (newHeight / 40)
          
          const formatTimeStr = (hourVal: number) => {
            const h = Math.floor(hourVal)
            const m = Math.floor((hourVal % 1) * 60)
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
          }

          const dateStr = format(selectedDate, 'yyyy-MM-dd')
          const startTimeStr = formatTimeStr(startHour)
          const endTimeStr = formatTimeStr(endHour)
          
          const newStartUTC = toUTCISOString(dateStr, startTimeStr)
          const newEndUTC = toUTCISOString(dateStr, endTimeStr)
          
          // 기존 시간과 동일하면 업데이트 하지 않음 (클릭만 한 경우)
          if (sch.start_time === newStartUTC && sch.end_time === newEndUTC) {
            setDragState(null)
            return
          }
          
          const startUtcDate = new Date(newStartUTC)
          const endUtcDate = new Date(newEndUTC)
          const isOverlap = localSchedulesRef.current.some(s => {
            if (s.id === sch.id) return false;
            const hasMember = s.schedule_members?.some((sm: any) => sm.member_id === staffId);
            if (!hasMember) return false;
            if (!isSameDay(new Date(s.start_time), startUtcDate)) return false;
            return startUtcDate < new Date(s.end_time) && endUtcDate > new Date(s.start_time);
          });
          
          if (staffId && isOverlap) {
            toast.error('해당 시간대에 이미 다른 스케줄이 있어 변경할 수 없습니다.')
          } else {
            // 개별 시간 지정 업무가 있는지 확인
            const hasTimeSpecificTasks = sch.task_assignments?.some((ta: any) => ta.start_time)
            const deltaMinutes = getDiffInMinutes(sch.start_time, newStartUTC)
            
            if (hasTimeSpecificTasks) {
              // 개별 업무가 있으면 모달 띄우기
              setConfirmMoveModal({
                isOpen: true,
                scheduleId: sch.id,
                newStartUTC,
                newEndUTC,
                deltaMinutes
              })
            } else {
              // 개별 업무가 없으면 즉시 업데이트
              processScheduleUpdate(sch.id, newStartUTC, newEndUTC, false, deltaMinutes)
            }
          }
        }
      }
      
      setDragState(null)
    }

    // 의존성 배열을 비워두어 한 번만 이벤트가 붙고 해제되도록 최적화
    // (대신 내부에서 dragStateRef.current 를 참조하여 최신 상태 확보)
    window.addEventListener('mousemove', handleGlobalMouseMove)
    window.addEventListener('mouseup', handleGlobalMouseUp)
    
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove)
      window.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [selectedDate]) // selectedDate가 바뀔 때만(Date 객체 기준 모달 초기값 생성을 위해) 갱신

  const processScheduleUpdate = (scheduleId: string, newStartUTC: string, newEndUTC: string, moveTasks: boolean, deltaMinutes: number = 0) => {
    // API 호출
    updateScheduleTime(storeId, scheduleId, newStartUTC, newEndUTC, moveTasks)
      .then((res) => {
        if (res.error) toast.error(res.error)
      })
      .catch(() => toast.error('네트워크 오류가 발생했습니다.'))
      
    toast.success(`일정 시간이 변경되었습니다.`)
    
    // 로컬 상태 업데이트
    setLocalSchedules(prev => prev.map(s => {
      if (s.id === scheduleId) {
        let updatedAssignments = s.task_assignments;
        
        if (moveTasks && updatedAssignments && deltaMinutes !== 0) {
          updatedAssignments = updatedAssignments.map((ta: any) => {
            if (!ta.start_time) return ta;
            
            // date-utils.ts의 순수 문자열 연산 활용
            const newStartStr = addMinutesToTime(ta.start_time, deltaMinutes)
            let newEndStr = ta.end_time;
            if (ta.end_time) {
              newEndStr = addMinutesToTime(ta.end_time, deltaMinutes)
              newEndStr = newEndStr.length === 5 ? newEndStr + ':00' : newEndStr
            }

            return {
              ...ta,
              start_time: newStartStr.length === 5 ? newStartStr + ':00' : newStartStr,
              end_time: newEndStr
            }
          })
        }

        return {
          ...s,
          start_time: newStartUTC,
          end_time: newEndUTC,
          task_assignments: updatedAssignments
        }
      }
      return s
    }))
    
    // 선택된 스케줄이 이동된 경우, 우측 패널 시간도 동기화
    setSelectedSchedule((prev: any) => {
      if (prev && prev.id === scheduleId) {
        const start = new Date(newStartUTC)
        const end = new Date(newEndUTC)
        
        let startHour = start.getHours() + start.getMinutes() / 60
        let endHour = end.getHours() + end.getMinutes() / 60
        if (endHour <= startHour || end.getDate() !== start.getDate()) {
          endHour += 24
        }
        
        let updatedAssignments = prev.task_assignments;
        if (moveTasks && updatedAssignments && deltaMinutes !== 0) {
          updatedAssignments = updatedAssignments.map((ta: any) => {
            if (!ta.start_time) return ta;
            const newStartStr = addMinutesToTime(ta.start_time, deltaMinutes)
            let newEndStr = ta.end_time;
            if (ta.end_time) {
              newEndStr = addMinutesToTime(ta.end_time, deltaMinutes)
              newEndStr = newEndStr.length === 5 ? newEndStr + ':00' : newEndStr
            }
            return {
              ...ta,
              start_time: newStartStr.length === 5 ? newStartStr + ':00' : newStartStr,
              end_time: newEndStr
            }
          })
        }

        return {
          ...prev,
          start_time: newStartUTC,
          end_time: newEndUTC,
          displayTime: `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')} (${(endHour - startHour).toFixed(1)}시간)`,
          editDate: format(start, 'yyyy-MM-dd'),
          editStartTime: format(start, 'HH:mm'),
          editEndTime: format(end, 'HH:mm'),
          task_assignments: updatedAssignments
        }
      }
      return prev
    })
  }

  const handleTaskToggle = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done'
    
    // Optimistic UI update
    setSelectedSchedule((prev: any) => {
      if (!prev) return prev
      return {
        ...prev,
        task_assignments: prev.task_assignments?.map((ta: any) => 
          ta.task?.id === taskId 
            ? { ...ta, task: { ...ta.task, status: newStatus } }
            : ta
        )
      }
    })
    
    // localSchedules 도 함께 업데이트 (tooltip 등에 반영되도록)
    setLocalSchedules(prev => prev.map(s => {
      if (s.id === selectedSchedule?.id) {
        return {
          ...s,
          task_assignments: s.task_assignments?.map((ta: any) => 
            ta.task?.id === taskId 
              ? { ...ta, task: { ...ta.task, status: newStatus } }
              : ta
          )
        }
      }
      return s
    }))

    const result = await updateTaskStatus(taskId, newStatus)
    if (result.error) {
      toast.error('업무 상태 변경에 실패했습니다.')
    }
  }

  // 직원 객체의 역할 정보를 확실하게 찾아주는 헬퍼
  const getStaffRoleInfo = (staff: any) => {
    if (staff?.role_info) return staff.role_info
    
    // role_info가 없을 경우 (예: role_id가 비어있고 레거시 role 텍스트만 있는 경우)
    if (staff?.role) {
      const legacyRoleName = staff.role === 'owner' ? '점주' : staff.role === 'manager' ? '매니저' : '직원'
      const foundRole = roles?.find(r => r.name === legacyRoleName)
      if (foundRole) return foundRole
    }
    return null
  }

  const handleScheduleClick = (sch: any, staffData: any) => {
    const start = new Date(sch.start_time)
    const end = new Date(sch.end_time)
    
    let startHour = start.getHours() + start.getMinutes() / 60
    let endHour = end.getHours() + end.getMinutes() / 60
    
    // 종료 시간이 시작 시간보다 작거나, 날짜가 다음 날이면 +24시간 (자정 넘김)
    if (endHour <= startHour || end.getDate() !== start.getDate()) {
      endHour += 24
    }
    
    const member = sch.schedule_members?.[0]?.member
    const roleInfo = getStaffRoleInfo(staffData)
    const roleColor = roleInfo?.color || sch.color || '#534AB7'

    setSelectedSchedule({
      ...sch,
      displayDate: format(start, 'yyyy년 M월 d일 (E)', { locale: ko }),
      displayTime: `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')} (${(endHour - startHour).toFixed(1)}시간)`,
      displayName: staffData?.name || member?.name || sch.title || '직원',
      displayRole: roleInfo?.name || '역할 없음',
      roleColor: roleColor,
      
      // Edit form fields
      editStaffId: sch.schedule_members?.[0]?.member_id || staffData?.id,
      editDate: format(start, 'yyyy-MM-dd'),
      editStartTime: format(start, 'HH:mm'),
      editEndTime: format(end, 'HH:mm')
    })
    setIsModalOpen(true)
    setTooltipData(null) // 모달 열릴 때 툴팁 닫기
  }

  // 실제 데이터 기반 스케줄 체크 로직 연동 (timezone 오차 방지)
  const hasScheduleOnDate = (date: Date, staffId?: string) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return localSchedules.some(sch => {
      if (!sch.start_time) return false;
      
      // Timezone 오차 방지: Date 객체 파싱 후 로컬 포맷으로 변환하여 안전하게 비교
      const parsedDate = new Date(sch.start_time);
      if (isNaN(parsedDate.getTime())) return false; // Invalid Date 에러 방지
      
      const schDateStr = format(parsedDate, 'yyyy-MM-dd')
      
      const isSameDate = schDateStr === dateStr
      if (!isSameDate) return false
      
      if (staffId) {
        return sch.schedule_members?.some((sm: any) => sm.member_id === staffId)
      }
      return true
    })
  }

  const hasScheduleInWeek = (startOfWeekDate: Date, staffId?: string) => {
    const startDateStr = format(startOfWeekDate, 'yyyy-MM-dd')
    const endOfWeekDate = addDays(startOfWeekDate, 6)
    const endDateStr = format(endOfWeekDate, 'yyyy-MM-dd')
    
    return localSchedules.some(sch => {
      if (!sch.start_time) return false;
      
      const parsedDate = new Date(sch.start_time);
      if (isNaN(parsedDate.getTime())) return false;
      
      const schDateStr = format(parsedDate, 'yyyy-MM-dd')
      
      // 해당 주의 범위 내에 있는지 확인
      if (schDateStr < startDateStr || schDateStr > endDateStr) return false;
      
      if (staffId) {
        return sch.schedule_members?.some((sm: any) => sm.member_id === staffId)
      }
      return true
    })
  }

  const [searchQuery, setSearchQuery] = useState('')

  // 데이터 필터링 (선택된 날짜에 스케줄이 있는 직원만 필터링 + 이름 검색 + 역할 필터링)
  const filteredStaff = useMemo(() => {
    let filtered = staffList

    // 1. 뷰 모드에 따라 스케줄 유무 필터링 적용
    // 일간 뷰: 선택된 날짜에 스케줄이 있는 직원만
    // 주간 뷰: 선택된 주에 스케줄이 하루라도 있는 직원만
    if (viewMode === 'day') {
      filtered = filtered.filter(staff => hasScheduleOnDate(selectedDate, staff.id))
    } else if (viewMode === 'week') {
      filtered = filtered.filter(staff => hasScheduleInWeek(weekStart, staff.id))
    }

    // 2. 이름 검색 필터링
    if (searchQuery.trim()) {
      filtered = filtered.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    }
    
    // 3. 역할 필터링
    if (activeRoleIds.length > 0) {
      filtered = filtered.filter(staff => {
        const roleInfo = getStaffRoleInfo(staff)
        // roleInfo가 없거나 매칭되는 role.id가 activeRoleIds에 포함되어 있으면 표시
        if (!roleInfo) return true
        return activeRoleIds.includes(roleInfo.id)
      })
    }
    
    return filtered
  }, [staffList, searchQuery, selectedDate, localSchedules, activeRoleIds])

  // 달력 렌더링 로직
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 })
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 })
    
    const days = []
    let day = startDate
    while (day <= endDate) {
      days.push(day)
      day = addDays(day, 1)
    }
    return days
  }, [currentDate])

  // Get dynamic hours from storeOpeningHours
  const hours = useMemo(() => {
    let minHour = 6;
    let maxHour = 30; // 06:00 next day
    
    if (storeOpeningHours) {
      let earliest = 24;
      let latest = 0;
      
      const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
      let foundAny = false;
      
      days.forEach(day => {
        const data = storeOpeningHours[day];
        if (data && !data.closed) {
          foundAny = true;
          // open / start_time
          const openTime = data.start_time || data.open || '09:00';
          const [oH] = openTime.split(':').map(Number);
          if (oH < earliest) earliest = oH;
          
          // close / end_time
          const closeTime = data.end_time || data.close || '22:00';
          let [cH] = closeTime.split(':').map(Number);
          // if close time is smaller than open time, it means next day
          if (cH <= oH) cH += 24;
          if (cH > latest) latest = cH;
        }
      });
      
      if (foundAny) {
        // Add 1 hour padding before and after, ensuring we don't go negative or wrap weirdly
        minHour = Math.max(0, earliest - 1);
        maxHour = latest + 1;
        // If the gap is less than 6 hours (weird setup), at least show 12 hours
        if (maxHour - minHour < 12) maxHour = minHour + 12;
      }
    }
    
    return Array.from({ length: maxHour - minHour + 1 }, (_, i) => i + minHour);
  }, [storeOpeningHours]);

  // 툴팁 위치 제어 로직
  const handleMouseMove = (e: MouseEvent) => {
    if (!tooltipData || !tooltipRef.current) return
    const tw = 220, th = 180
    const vw = window.innerWidth, vh = window.innerHeight
    const x = e.clientX, y = e.clientY
    
    setTooltipPos({
      x: x + tw + 12 > vw ? x - tw - 8 : x + 12,
      y: y + th > vh ? y - th : y + 8
    })
  }

  useEffect(() => {
    if (tooltipData) {
      window.addEventListener('mousemove', handleMouseMove)
    } else {
      window.removeEventListener('mousemove', handleMouseMove)
    }
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [tooltipData])

  return (
    <div className="flex flex-col h-full text-[#1a1a1a]" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      
      {/* 1. 상단 컨트롤 영역 (검색, 필터, 뷰 토글 등 전역 컨트롤) */}
      <CalendarHeader
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isSearchFocused={isSearchFocused}
        setIsSearchFocused={setIsSearchFocused}
        filteredStaff={filteredStaff}
        getStaffRoleInfo={getStaffRoleInfo}
        hexToRgba={hexToRgba}
        viewMode={viewMode}
        setViewMode={setViewMode}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        weekStart={weekStart}
        setWeekStart={setWeekStart}
        roles={roles}
        activeRoleIds={activeRoleIds}
        toggleRole={toggleRole}
        onAddSchedule={() => {
          setCreateForm({
            title: '정규 근무',
            date: format(selectedDate, 'yyyy-MM-dd'),
            startTime: '09:00',
            endTime: '18:00',
            staffId: ''
          })
          setIsCreateModalOpen(true)
        }}
        onAutoSchedule={() => setIsAutoScheduleModalOpen(true)}
        onBulkDelete={() => setIsBulkDeleteModalOpen(true)}
      />

      {/* Main Layout (Calendar + Timeline) */}
      <div className="flex-1 flex gap-4 px-6 pt-4 pb-6 overflow-hidden min-h-0">
        
        {/* Left: Mini Calendar */}
        <MiniCalendar 
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          calendarDays={calendarDays}
          hasScheduleOnDate={hasScheduleOnDate}
        />

        {/* Right: Timeline Panel */}
        <div className="flex-1 bg-white border border-black/10 rounded-xl p-4 shadow-sm flex flex-col min-w-0 overflow-hidden">
          
          {/* Main Body (일간 뷰 or 주간 뷰) */}
          {viewMode === 'week' ? (
            <div className="flex-1 min-h-0 mt-0">
              <WeeklyShiftBoard 
                weekStart={weekStart}
                staffList={filteredStaff} // 검색어 필터링 적용된 목록
                localSchedules={localSchedules}
                roles={roles}
                activeRoleIds={activeRoleIds}
                hours={hours}
                getStaffRoleInfo={getStaffRoleInfo}
                onDayClick={(date) => {
                  setSelectedDate(date)
                  setCurrentDate(date)
                  setViewMode('day')
                }}
                onScheduleClick={(sch, staff) => {
                  handleScheduleClick(sch, staff)
                }}
              />
            </div>
          ) : (
          <div className="flex-1 flex overflow-auto relative select-none pt-4 mt-2 border-t border-black/5">
            
            {/* 실시간 현재 시간 지시선 */}
            {isSameDay(selectedDate, now) && (() => {
              const currentHourNum = now.getHours() + now.getMinutes() / 60
              const displayTimeStr = format(now, 'HH:mm')
              // hours[0] = 6 (06:00 기준)
              // 스크롤 컨테이너 기준: pt-4(16px) + 헤더높이(36px) = 52px
              const lineTop = 52 + (currentHourNum - hours[0]) * 40
              
              return currentHourNum >= hours[0] && currentHourNum < hours[0] + 24 ? (
                <div 
                  className="absolute left-[40px] right-0 h-[1.5px] z-40 pointer-events-none flex items-center"
                  style={{ 
                    top: `${lineTop}px`,
                    background: 'linear-gradient(to right, rgba(29,158,117,0.8) 0%, rgba(29,158,117,0.3) 50%, rgba(29,158,117,0) 100%)'
                  }}
                >
                  <div className="absolute -left-[38px] top-1/2 -translate-y-1/2 bg-[#1D9E75] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-[0_2px_4px_rgba(29,158,117,0.4)]">
                    {displayTimeStr}
                  </div>
                  <div className="absolute left-0 -translate-x-1/2 w-[7px] h-[7px] rounded-full bg-[#1D9E75] border-[1.5px] border-white shadow-[0_0_4px_rgba(29,158,117,0.6)]" />
                </div>
              ) : null
            })()}

            {/* 좌측 Y축: 시간 표기 */}
            <div className="w-[40px] shrink-0 bg-white sticky left-0 z-30 pt-[36px]">
              {hours.map(h => {
                const displayHour = h >= 24 ? h - 24 : h;
                const isNextDay = h >= 24;
                return (
                <div key={h} className="h-[40px] text-[9px] text-muted-foreground relative">
                  {/* 시간 텍스트를 가로 보조선의 정중앙(수직) 위치에 맞춤 */}
                  <span className="absolute -top-[7px] left-0 w-full text-center">
                    {displayHour.toString().padStart(2, '0')}:00
                    {isNextDay && <span className="absolute -top-1 right-0 text-[6px] text-primary/60 font-semibold">+1</span>}
                  </span>
                  {/* 시간 기준 가로 보조선 (아주 연한 점선) - top 0px 위치로 맞춰 스케줄 블록의 시작점과 일치시킴 */}
                  <div className="absolute top-0 left-full w-[2000px] h-px border-t border-dashed border-black/5 pointer-events-none" />
                </div>
                )
              })}
            </div>

            {/* 우측 X축: 직원 컬럼들 (반응형 80% 정도를 채우도록 설정) */}
            {filteredStaff.length > 0 ? (
              <div className="flex flex-1 pl-4 gap-6 w-full max-w-[80%]">
                {filteredStaff.map(staff => {
                  const roleInfo = getStaffRoleInfo(staff)
                  return (
                    <TimelineStaffColumn
                      key={staff.id}
                      staff={staff}
                      safeName={staff.name || '알 수 없음'}
                      roleColor={roleInfo?.color || '#534AB7'}
                      selectedDate={selectedDate}
                      isDragCreate={dragState?.type === 'create_v' && dragState.staffId === staff.id}
                      dragState={dragState}
                      setDragState={setDragState}
                      localSchedules={localSchedules}
                      hours={hours}
                      now={now}
                      isDraggingRef={isDraggingRef}
                      isModalOpen={isModalOpen}
                      selectedScheduleId={selectedSchedule?.id}
                      handleScheduleClick={handleScheduleClick}
                      setTooltipData={setTooltipData}
                      setSingleDayDeleteModal={setSingleDayDeleteModal}
                      getStaffRoleInfo={getStaffRoleInfo}
                    />
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-[12px] text-muted-foreground pt-10 h-full w-full shrink-0">
                이 날짜에 배정된 스케줄이 없습니다.<br/>우측 상단의 [스케줄 추가] 버튼을 눌러보세요.
              </div>
            )}
          </div>
          )}
        </div>

        {/* 3단 레이아웃 우측: Schedule Detail Panel (주간 뷰에서는 숨김) */}
        {viewMode === 'day' && (
          <ScheduleDetailPanel
            storeId={storeId}
            selectedSchedule={selectedSchedule}
            setSelectedSchedule={setSelectedSchedule}
            staffList={staffList}
            setLocalSchedules={setLocalSchedules}
            handleTaskToggle={handleTaskToggle}
            now={now}
          />
        )}
      </div>

      {/* Create Schedule Modal */}
      <ScheduleCreateDialog
        storeId={storeId}
        isOpen={isCreateModalOpen}
        setIsOpen={setIsCreateModalOpen}
        createForm={createForm}
        setCreateForm={setCreateForm}
        staffList={staffList}
        checkOverlap={checkOverlap}
        setLocalSchedules={setLocalSchedules}
      />

      {/* Auto Schedule Modal */}
      <UnifiedAutoScheduleDialog
        open={isAutoScheduleModalOpen}
        onOpenChange={setIsAutoScheduleModalOpen}
        storeId={storeId}
        staffList={staffList}
      />

      {/* Bulk Delete Modal */}
      <UnifiedBulkDeleteDialog
        open={isBulkDeleteModalOpen}
        onOpenChange={setIsBulkDeleteModalOpen}
        storeId={storeId}
        staffList={staffList}
      />

      {/* Single Day Staff Schedule Delete Dialog */}
      {singleDayDeleteModal && (
        <SingleDayDeleteModal
          isOpen={singleDayDeleteModal.isOpen}
          staffId={singleDayDeleteModal.staffId}
          staffName={singleDayDeleteModal.staffName}
          date={singleDayDeleteModal.date}
          storeId={storeId}
          onClose={() => setSingleDayDeleteModal(null)}
        />
      )}

      {/* Confirm Task Move Dialog */}
      {confirmMoveModal && (
        <ConfirmMoveModal
          isOpen={confirmMoveModal.isOpen}
          scheduleId={confirmMoveModal.scheduleId}
          newStartUTC={confirmMoveModal.newStartUTC}
          newEndUTC={confirmMoveModal.newEndUTC}
          deltaMinutes={confirmMoveModal.deltaMinutes}
          onClose={() => setConfirmMoveModal(null)}
          onConfirm={(moveTasks) => {
            processScheduleUpdate(
              confirmMoveModal.scheduleId,
              confirmMoveModal.newStartUTC,
              confirmMoveModal.newEndUTC,
              moveTasks,
              confirmMoveModal.deltaMinutes
            )
          }}
        />
      )}

      {/* Tooltip Overlay */}
      <TimelineTooltip 
        tooltipData={tooltipData}
        tooltipPos={tooltipPos}
        tooltipRef={tooltipRef}
      />
    </div>
  )
}