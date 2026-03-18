'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameDay, isSameMonth } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { updateTaskStatus } from '@/features/tasks/actions'
import { updateScheduleTime } from '@/features/schedule/actions'
import { toast } from 'sonner'
import { toUTCISOString, getDiffInMinutes, addMinutesToTime } from '@/lib/date-utils'
import { ScheduleDetailPanel, STATUS_INFO } from './schedule-detail-panel'
import { ScheduleCreateDialog } from './schedule-create-dialog'

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
}

export function UnifiedCalendar({ storeId, roles, staffList = [], schedules = [] }: UnifiedCalendarProps) {
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
  const [confirmMoveModal, setConfirmMoveModal] = useState<{
    isOpen: boolean;
    scheduleId: string;
    newStartUTC: string;
    newEndUTC: string;
    deltaMinutes: number;
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
          const MAX_HEIGHT = 24 * 40
          const topY = Math.max(0, Math.min(MAX_HEIGHT - 20, Math.round(Math.min(startY, currentY) / 20) * 20))
          const bottomY = Math.max(20, Math.min(MAX_HEIGHT, Math.round(Math.max(startY, currentY) / 20) * 20))
          
          const startHour = 6 + (topY / 40)
          const endHour = 6 + (bottomY / 40)
          
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
          
          const MAX_HEIGHT = 24 * 40 // 최대 높이(24시간)
          
          if (type === 'move_v') {
            newTop = Math.max(0, Math.min(initialTop! + snappedDy, MAX_HEIGHT - newHeight))
          } else if (type === 'resize_v') {
            newHeight = Math.max(20, Math.min(newHeight + snappedDy, MAX_HEIGHT - newTop))
          }
          
          const startHour = 6 + (newTop / 40)
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
      displayName: sch.title || staffData?.name || member?.name || '직원',
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

  const [searchQuery, setSearchQuery] = useState('')

  // 데이터 필터링 (선택된 날짜에 스케줄이 있는 직원만 필터링 + 이름 검색)
  const filteredStaff = useMemo(() => {
    let filtered = staffList

    // 1. 선택된 날짜에 스케줄이 있는 직원만 필터링 (최소한 1개의 스케줄이 해당 직원과 날짜에 매칭되어야 함)
    // schedules 대신 상태로 관리되는 localSchedules를 사용하여 새로 생성된 스케줄도 실시간 반영
    filtered = filtered.filter(staff => hasScheduleOnDate(selectedDate, staff.id))

    // 2. 이름 검색 필터링
    if (searchQuery.trim()) {
      filtered = filtered.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    }
    
    return filtered
  }, [staffList, searchQuery, selectedDate, localSchedules])

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

  const hours = Array.from({ length: 24 }, (_, i) => i + 6) // 06:00 ~ 익일 05:00 (24시간)

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
      
      {/* 1. 상단 컨트롤 영역 (검색) */}
      <div className="px-6 py-4 flex items-center justify-end gap-4 shrink-0 h-[64px]">
        {/* 직원 검색 */}
        <div className="relative w-full sm:w-[240px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6b6b6b]" />
          <Input 
            placeholder="직원 이름으로 검색..." 
            className="h-8 pl-8 text-[11px] bg-white border-black/10 focus-visible:ring-1 focus-visible:ring-[#1a1a1a] focus-visible:ring-offset-0"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
          />
          
          {/* 자동완성 드롭다운 */}
          {isSearchFocused && searchQuery.trim() !== '' && filteredStaff.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-black/10 rounded-md shadow-lg z-50 overflow-hidden max-h-[200px] overflow-y-auto">
              {filteredStaff.map(staff => {
                const roleInfo = getStaffRoleInfo(staff)
                const rColor = roleInfo?.color || '#534AB7'
                return (
                  <div 
                    key={staff.id} 
                    className="px-3 py-2 text-[11px] text-[#1a1a1a] hover:bg-[#f3f2ef] cursor-pointer flex items-center gap-2"
                    onClick={() => {
                      setSearchQuery(staff.name || '알 수 없음')
                      setIsSearchFocused(false)
                    }}
                  >
                    <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] shrink-0"
                         style={{ backgroundColor: hexToRgba(rColor, 0.2), color: rColor }}>
                      {(staff.name || '직').substring(0, 1)}
                    </div>
                    <span>{staff.name || '알 수 없음'}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{roleInfo?.name || '역할 없음'}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main Layout (Calendar + Timeline) */}
      <div className="flex-1 flex gap-4 px-6 pb-6 overflow-hidden min-h-0">
        
        {/* Left: Mini Calendar */}
        <div className="w-[210px] shrink-0 flex flex-col">
          <div className="bg-white border border-black/10 rounded-xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <button className="border-none bg-transparent text-[#6b6b6b] text-[13px] px-1.5 cursor-pointer hover:text-black" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>&#8249;</button>
              <div className="text-[12px] font-medium text-[#1a1a1a]">{format(currentDate, 'yyyy년 M월')}</div>
              <button className="border-none bg-transparent text-[#6b6b6b] text-[13px] px-1.5 cursor-pointer hover:text-black" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>&#8250;</button>
            </div>
            <div className="grid grid-cols-7 gap-[1px]">
              {['일','월','화','수','목','금','토'].map(d => (
                <div key={d} className="text-[8px] text-[#6b6b6b] text-center py-0.5">{d}</div>
              ))}
              {calendarDays.map((d, i) => {
                const isCurMonth = isSameMonth(d, currentDate)
                const isSelected = isSameDay(d, selectedDate)
                const isTodayDate = isSameDay(d, new Date())
                const hasSch = hasScheduleOnDate(d)

                if (!isCurMonth) {
                  return <div key={i} className="text-[10px] text-center py-1 rounded-[5px] text-transparent cursor-default">.</div>
                }

                return (
                  <div 
                    key={i} 
                    onClick={() => setSelectedDate(d)}
                    className={`relative text-[10px] text-center py-1 rounded-[5px] cursor-pointer transition-colors
                      ${isSelected ? 'bg-[#1a1a1a] text-white' : 'text-[#6b6b6b] hover:bg-[#f3f2ef]'}
                      ${isTodayDate && !isSelected ? 'font-medium text-[#1a1a1a]' : ''}
                    `}
                  >
                    {d.getDate()}
                    {hasSch && (
                      <div className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-[3px] h-[3px] rounded-full ${isSelected ? 'bg-[#9FE1CB]' : 'bg-[#1D9E75]'}`} />
                    )}
                  </div>
                )
              })}
            </div>
            
            <div className="text-[11px] text-[#6b6b6b] mt-2 pt-2 border-t border-black/10">
              <strong className="text-[#1a1a1a] font-medium">{format(selectedDate, 'M월 d일 (E)', { locale: ko })}</strong>
            </div>
          </div>
        </div>

        {/* Right: Timeline Panel */}
        <div className="flex-1 bg-white border border-black/10 rounded-xl p-4 shadow-sm flex flex-col min-w-0 overflow-hidden">
          
          <div className="flex items-center justify-between mb-2 shrink-0">
            <div className="flex items-center gap-3">
              <div className="text-[13px] font-medium text-[#1a1a1a]">
                {format(selectedDate, 'M월 d일 (E)', { locale: ko })}
              </div>
              <div className="flex gap-1">
                <button className="text-[10px] px-2 py-0.5 border border-black/20 rounded text-[#6b6b6b] hover:text-[#1a1a1a]" onClick={() => setSelectedDate(addDays(selectedDate, -1))}>‹ 이전</button>
                <button className="text-[10px] px-2 py-0.5 border border-black/20 rounded text-[#6b6b6b] hover:text-[#1a1a1a]" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>다음 ›</button>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex gap-2 flex-wrap">
                {/* 레전드 영역 - 역할별 컬러 범례 */}
                {roles.slice(0, 4).map(r => (
                  <div key={r.id} className="flex items-center gap-1 text-[9px] text-[#6b6b6b]">
                    <div className="w-2 h-2 rounded-[2px]" style={{ backgroundColor: hexToRgba(r.color, 0.2), border: `1px solid ${r.color}` }} />
                    {r.name}
                  </div>
                ))}
              </div>
              <button 
                className="bg-[#1a1a1a] text-white text-[11px] font-medium px-3 py-1.5 rounded-md hover:bg-black/80 flex items-center gap-1.5 shadow-sm transition-colors"
                onClick={() => {
                  setCreateForm({
                    title: '',
                    date: format(selectedDate, 'yyyy-MM-dd'),
                    startTime: '09:00',
                    endTime: '18:00',
                    staffId: ''
                  })
                  setIsCreateModalOpen(true)
                }}
              >
                <span className="text-[13px] leading-none mb-[1px]">+</span> 스케줄 추가
              </button>
            </div>
          </div>

          {/* 직원별 데일리 수직 타임라인 스크롤 영역 */}
          <div className="flex-1 flex overflow-auto relative select-none pt-4">
            
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
                  const isDragCreate = dragState?.type === 'create_v' && dragState.staffId === staff.id
                  const safeName = staff.name || '알 수 없음'
                  const roleInfo = getStaffRoleInfo(staff)
                  const roleColor = roleInfo?.color || '#534AB7'
                  
                  return (
                    <div key={staff.id} className="flex-1 flex flex-col relative min-w-[50px] max-w-[120px]">
                      {/* 상단 직원 이름 헤더 (역할 색상 적용) */}
                      <div className="h-[36px] shrink-0 flex flex-col items-center justify-center gap-0.5 sticky top-0 z-20 bg-white/95 backdrop-blur-sm pb-1 px-1">
                        {/* 프로필 서클에 옅은 역할 배경색을 깔아 직무 식별을 명확히 함 */}
                        <div 
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold shrink-0 shadow-sm border border-black/5"
                          style={{ backgroundColor: hexToRgba(roleColor, 0.15), color: roleColor }}
                        >
                          {safeName.substring(0, 1)}
                        </div>
                        <span className="text-[10px] font-medium text-[#1a1a1a] truncate w-full text-center tracking-tight">{safeName}</span>
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

                      {/* 호버 시 세로 가이드라인 표시 (다시 넉넉하게 변경) */}
                      <div className="absolute inset-0 w-8 left-1/2 -translate-x-1/2 bg-black/0 group-hover:bg-black/[0.03] rounded-full transition-colors pointer-events-none -z-10" />

                      {/* 직원별 스케줄 블록들 */}
                      {localSchedules
                        .filter(sch => {
                          if (!sch.start_time) return false;
                          const parsedDate = new Date(sch.start_time);
                          if (isNaN(parsedDate.getTime())) return false;
                          
                          const dateStr = format(selectedDate, 'yyyy-MM-dd')
                          // Timezone 오차 방지: Date 객체 파싱 후 로컬 시간 기준으로 렌더링 필터링
                          const schDateStr = format(parsedDate, 'yyyy-MM-dd')
                          return schDateStr === dateStr && sch.schedule_members?.some((sm: any) => sm.member_id === staff.id)
                        })
                        .map(sch => {
                          const start = new Date(sch.start_time)
                          const end = new Date(sch.end_time)
                          
                          let startHour = start.getHours() + start.getMinutes() / 60
                          let endHour = end.getHours() + end.getMinutes() / 60
                          
                          // 자정 넘김 로직: 종료일이 다음 날이거나 시간이 작아지는 경우 +24
                          if (endHour <= startHour || end.getDate() !== start.getDate()) {
                            endHour += 24
                          }
                          
                          let topPos = Math.max(0, (startHour - hours[0]) * 40)
                          let heightPos = Math.max(20, (endHour - startHour) * 40)
                          
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
                          
                          // 이 블록에서 사용할 역할 정보: 1순위 직원 역할 정보 2순위 스케줄 자체 컬러 3순위 기본 컬러
                          const schRoleInfo = getStaffRoleInfo(staff)
                          const schRoleColor = schRoleInfo?.color || sch.color || '#534AB7'

                          const tasks = sch.task_assignments || []
                          const timeSpecificTasks = tasks.filter((ta: any) => ta.start_time)
                          const anytimeTasks = tasks.filter((ta: any) => !ta.start_time)

                          return (
                            <div 
                              key={sch.id}
                              className={`schedule-block absolute rounded-full cursor-pointer transition-all hover:brightness-95 z-10 flex flex-col left-1/2 -translate-x-1/2 w-1 shadow-sm ${selectedSchedule?.id === sch.id ? 'ring-[1.5px] ring-black ring-offset-[1.5px] z-20' : 'hover:scale-x-[2]'}`}
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
                                  anytimeTasks: anytimeTasks.map((ta: any) => ({
                                    title: ta.task?.title,
                                    checklist: ta.task?.checklist
                                  })),
                                  timeSpecificTasks: timeSpecificTasks.map((ta: any) => {
                                    const ts = new Date(ta.start_time)
                                    // timezone 무시하고 시간만 렌더링하기 위해 안전장치
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
                              {/* 상시 업무 여부를 표시하는 작은 점 (높이가 허용될 때만 상단에 고정 표시) */}
                              {heightPos > 20 && anytimeTasks.length > 0 && (
                                <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white shadow-sm opacity-80" />
                              )}
                              
                              {/* 특정 시간 지정 업무 마커 (스케줄 시간대 내 비율 위치) */}
                              {timeSpecificTasks.map((ta: any, idx: number) => {
                                const taskStartStr = ta.start_time
                                // 단순 시간 추출 (HH:mm)
                                const taskTimeMatch = taskStartStr.match(/T?(\d{2}):(\d{2})/)
                                if (!taskTimeMatch) return null
                                
                                let taskHourNum = parseInt(taskTimeMatch[1]) + parseInt(taskTimeMatch[2]) / 60
                                
                                // 자정 넘김 처리: 스케줄 시작 시간보다 업무 시간이 작으면 다음날로 간주 (+24)
                                // (단, 스케줄 범위가 하루를 넘어가는 경우에 한함)
                                if (taskHourNum < Math.floor(startHour)) {
                                  taskHourNum += 24
                                }
                                
                                // 스케줄 시작 시간 기준 상대적 시간차
                                const relativeHour = taskHourNum - startHour
                                // 1시간 = 40px
                                let dotTop = relativeHour * 40
                                
                                const isOutOfBounds = dotTop < -4 || dotTop > heightPos - 4
                                
                                // 자동 파생 상태 계산
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
              })}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-[12px] text-muted-foreground pt-10 h-full w-full shrink-0">
                이 날짜에 배정된 스케줄이 없습니다.<br/>우측 상단의 [스케줄 추가] 버튼을 눌러보세요.
              </div>
            )}
          </div>
        </div>

        {/* 3단 레이아웃 우측: Schedule Detail Panel */}
        <ScheduleDetailPanel
          storeId={storeId}
          selectedSchedule={selectedSchedule}
          setSelectedSchedule={setSelectedSchedule}
          staffList={staffList}
          setLocalSchedules={setLocalSchedules}
          handleTaskToggle={handleTaskToggle}
          now={now}
        />
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

      {/* Confirm Task Move Dialog */}
      {confirmMoveModal && (
        <Dialog open={confirmMoveModal.isOpen} onOpenChange={(open) => {
          if (!open) setConfirmMoveModal(null)
        }}>
          <DialogContent className="w-[360px] p-5 gap-0">
            <DialogHeader className="mb-4 text-left">
              <DialogTitle className="text-[15px] font-semibold flex items-center gap-2">
                <span className="text-[18px]">🔄</span> 스케줄과 함께 업무도 이동할까요?
              </DialogTitle>
            </DialogHeader>
            <div className="text-[13px] text-muted-foreground mb-6 leading-relaxed bg-muted/30 p-3 rounded-md">
              이 스케줄에는 개별 시간이 지정된 업무가 포함되어 있습니다.<br/>
              스케줄 변경 시간에 맞춰 <strong>개별 업무 시간도 함께 이동</strong>하시겠습니까?
            </div>
            <div className="flex gap-2 w-full justify-end">
              <button 
                className="text-[12px] h-9 px-4 rounded-md border text-[#1a1a1a] font-medium hover:bg-muted/50 transition-colors"
                onClick={() => {
                  processScheduleUpdate(confirmMoveModal.scheduleId, confirmMoveModal.newStartUTC, confirmMoveModal.newEndUTC, false, confirmMoveModal.deltaMinutes)
                  setConfirmMoveModal(null)
                }}
              >
                아니오 (스케줄만 변경)
              </button>
              <button 
                className="text-[12px] h-9 px-4 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-sm"
                onClick={() => {
                  processScheduleUpdate(confirmMoveModal.scheduleId, confirmMoveModal.newStartUTC, confirmMoveModal.newEndUTC, true, confirmMoveModal.deltaMinutes)
                  setConfirmMoveModal(null)
                }}
              >
                예 (함께 이동)
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Tooltip Overlay */}
      {tooltipData && (
        <div 
          ref={tooltipRef}
          className="fixed z-[9999] bg-white border border-black/30 rounded-xl p-2.5 pointer-events-none min-w-[160px] max-w-[240px] shadow-[0_2px_12px_rgba(0,0,0,0.1)] transition-opacity"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          {tooltipData.isTaskSpecific ? (
            <>
              <div className="text-[12px] font-medium text-[#1a1a1a] mb-1">{tooltipData.name}</div>
              <div className="text-[10px] text-primary flex items-center gap-1 font-medium mb-1">
                🕒 {tooltipData.time}
              </div>
              <div className="text-[9px] font-medium mb-2" style={{ color: STATUS_INFO[tooltipData.status || 'todo']?.color || '#6b6b6b' }}>
                상태: {STATUS_INFO[tooltipData.status || 'todo']?.label || '대기'}
              </div>
              {tooltipData.checklist && tooltipData.checklist.length > 0 && (
                <div className="flex flex-col gap-1 border-t border-black/10 pt-1.5">
                  <div className="text-[9px] text-[#6b6b6b] tracking-wide mb-0.5">체크리스트</div>
                  {tooltipData.checklist.map((c: any, ci: number) => (
                    <div key={ci} className="text-[9px] text-[#6b6b6b] flex items-start gap-1">
                      <span className="shrink-0 text-muted-foreground mt-[1px]">-</span>
                      <span className={`${c.is_completed ? 'line-through opacity-60' : 'text-[#1a1a1a]'}`}>{c.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-[12px] font-medium text-[#1a1a1a] mb-0.5">{tooltipData.name}</div>
              <div className="text-[10px] text-[#6b6b6b] mb-1.5">{tooltipData.role}</div>
              <div className="text-[10px] text-[#1a1a1a] flex items-center gap-1 mb-1.5 pb-1.5 border-b border-black/10">
                🕐 {tooltipData.shift}
              </div>
              
              <div className="text-[9px] text-[#6b6b6b] mb-1 tracking-wide">상시 업무</div>
              <div className="flex flex-col gap-[3px] mb-2">
                {tooltipData.anytimeTasks?.length > 0 ? (
                  tooltipData.anytimeTasks.map((t: any, i: number) => (
                    <div key={i} className="flex flex-col gap-0.5 mb-1.5 last:mb-0">
                      <div className="text-[10px] text-[#1a1a1a] flex items-start gap-1">
                        <span className="shrink-0">·</span><span className="font-medium">{t.title}</span>
                      </div>
                      {t.checklist && t.checklist.length > 0 && (
                        <div className="pl-2.5 flex flex-col gap-0.5">
                          {t.checklist.map((c: any, ci: number) => (
                            <div key={ci} className="text-[9px] text-[#6b6b6b] flex items-start gap-1">
                              <span className="shrink-0 text-muted-foreground mt-[1px]">-</span>
                              <span className={`${c.is_completed ? 'line-through opacity-60' : ''}`}>{c.text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-[10px] text-[#6b6b6b] italic">등록된 상시 업무 없음</div>
                )}
              </div>
              
              {tooltipData.timeSpecificTasks?.length > 0 && (
                <>
                  <div className="text-[9px] text-[#6b6b6b] mb-1 tracking-wide border-t border-black/10 pt-1.5">시간 지정 업무</div>
                  <div className="flex flex-col gap-[3px]">
                    {tooltipData.timeSpecificTasks.map((t: any, i: number) => (
                      <div key={i} className="flex flex-col gap-0.5 mb-1.5 last:mb-0">
                        <div className="text-[10px] text-[#1a1a1a] flex items-start gap-1 justify-between">
                          <span className="flex items-start gap-1"><span className="shrink-0">·</span><span className="font-medium">{t.title}</span></span>
                          <span className="text-[9px] text-primary/80 shrink-0 font-medium">{t.time}</span>
                        </div>
                        {t.checklist && t.checklist.length > 0 && (
                          <div className="pl-2.5 flex flex-col gap-0.5">
                            {t.checklist.map((c: any, ci: number) => (
                              <div key={ci} className="text-[9px] text-[#6b6b6b] flex items-start gap-1">
                                <span className="shrink-0 text-muted-foreground mt-[1px]">-</span>
                                <span className={`${c.is_completed ? 'line-through opacity-60' : ''}`}>{c.text}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}