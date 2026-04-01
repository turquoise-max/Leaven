'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { TimePicker } from '@/components/ui/time-picker'
import { toast } from 'sonner'
import { updateSchedule, deleteSchedule, createSchedule } from '@/features/schedule/actions'
import { createTask, assignTask, deleteTask, updateTaskAssignment, toggleTaskCheckitem, createDirectScheduleTask } from '@/features/schedule/task-actions'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2 } from 'lucide-react'
import { toKSTISOString, toUTCISOString, addMinutesToTime } from '@/shared/lib/date-utils'

function hexToRgba(hex: string, alpha: number) {
  if (!hex) return `rgba(0,0,0,${alpha})`
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function timeToMinutes(timeStr: string) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(mins: number) {
  const h = Math.floor(mins / 60);
  const m = Math.floor(mins % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function TimeSlider({ 
  startTime, 
  endTime, 
  onChange, 
  existingSchedules 
}: { 
  startTime: string, 
  endTime: string, 
  onChange: (start: string, end: string) => void,
  existingSchedules: {startMin: number, endMin: number}[]
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [activeHandle, setActiveHandle] = useState<'start' | 'end' | null>(null)

  const startMins = timeToMinutes(startTime)
  const endMins = timeToMinutes(endTime)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!activeHandle || !trackRef.current) return
      
      const rect = trackRef.current.getBoundingClientRect()
      let x = e.clientX - rect.left
      if (x < 0) x = 0
      if (x > rect.width) x = rect.width
      
      // 30분 단위 스냅
      const percentage = x / rect.width
      const totalMins = 24 * 60
      let mins = Math.round((percentage * totalMins) / 30) * 30
      
      if (activeHandle === 'start') {
        if (mins >= endMins) mins = endMins - 30
        onChange(minutesToTime(mins), endTime)
      } else {
        if (mins <= startMins) mins = startMins + 30
        onChange(startTime, minutesToTime(mins))
      }
    }
    
    const handleMouseUp = () => {
      setActiveHandle(null)
    }

    if (activeHandle) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [activeHandle, startMins, endMins, onChange, startTime, endTime])

  return (
    <div className="relative w-full h-8 flex items-center select-none my-4">
      <div ref={trackRef} className="absolute w-full h-3 bg-black/5 rounded-full" />
      
      {/* Existing Schedules Overlay */}
      {existingSchedules.map((sch, i) => {
        const left = (sch.startMin / (24 * 60)) * 100
        const width = ((sch.endMin - sch.startMin) / (24 * 60)) * 100
        return (
          <div 
            key={i} 
            className="absolute h-3 bg-red-500/30 rounded-full" 
            style={{ left: `${left}%`, width: `${width}%` }}
            title="기존 스케줄"
          />
        )
      })}

      {/* Selected Range */}
      <div 
        className="absolute h-3 bg-[#1a1a1a] rounded-full"
        style={{ 
          left: `${(startMins / (24 * 60)) * 100}%`, 
          width: `${((endMins - startMins) / (24 * 60)) * 100}%` 
        }} 
      />

      {/* Start Handle */}
      <div 
        className="absolute w-3.5 h-3.5 bg-white border-[1.5px] border-[#1a1a1a] rounded-full top-1/2 -translate-y-1/2 -ml-[7px] cursor-ew-resize shadow-sm hover:scale-125 transition-transform z-10"
        style={{ left: `${(startMins / (24 * 60)) * 100}%` }}
        onMouseDown={() => setActiveHandle('start')}
      />

      {/* End Handle */}
      <div 
        className="absolute w-3.5 h-3.5 bg-white border-[1.5px] border-[#1a1a1a] rounded-full top-1/2 -translate-y-1/2 -ml-[7px] cursor-ew-resize shadow-sm hover:scale-125 transition-transform z-10"
        style={{ left: `${(endMins / (24 * 60)) * 100}%` }}
        onMouseDown={() => setActiveHandle('end')}
      />

      {/* Time Ticks */}
      <div className="absolute w-full top-full mt-2 flex justify-between px-1">
        {[0, 6, 12, 18, 24].map(h => (
          <div key={h} className="text-[10px] text-muted-foreground font-medium relative -ml-2">
            {h.toString().padStart(2, '0')}:00
            <div className="absolute -top-3 left-1/2 w-px h-1.5 bg-black/20" />
          </div>
        ))}
      </div>
    </div>
  )
}

// 자동 파생 상태 계산 헬퍼 (시간 기반)
export function getDerivedTaskStatus(t: any, scheduleDateStr: string, now: Date): 'todo' | 'in_progress' | 'pending' | 'done' {
  if (t.status === 'done') return 'done'
  if (!t.start_time) return 'todo'

  let taskDateObj = null;
  if (t.start_time.includes('T')) {
    taskDateObj = new Date(t.start_time)
  } else {
    const dateStr = t.assigned_date || scheduleDateStr
    if (!dateStr) return 'todo'
    // 만약 start_time이 "09:00" 처럼 초가 없으면 추가
    const timeStr = t.start_time.length === 5 ? `${t.start_time}:00` : t.start_time
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

interface ScheduleDetailPanelProps {
  mode: 'create' | 'edit'
  storeId: string
  selectedSchedule?: any
  setSelectedSchedule?: React.Dispatch<React.SetStateAction<any>>
  staffList: any[]
  setLocalSchedules: React.Dispatch<React.SetStateAction<any[]>>
  localSchedules?: any[]
  handleTaskToggle?: (taskId: string, currentStatus: string) => Promise<void>
  now?: Date
  approvedLeaves?: any[]
  createForm?: any
  setCreateForm?: (form: any) => void
  checkOverlap?: (staffId: string, start: Date, end: Date) => boolean
  onClose: () => void
}

export const STATUS_INFO: Record<string, { label: string, color: string, bg: string, border: string }> = {
  todo: { label: '대기', color: '#6b6b6b', bg: '#f3f2ef', border: '#e5e5e5' },
  in_progress: { label: '진행 중', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  pending: { label: '보류', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
  done: { label: '완료', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' }
}

export function ScheduleDetailPanel({
  mode,
  storeId,
  selectedSchedule,
  setSelectedSchedule,
  staffList,
  setLocalSchedules,
  localSchedules = [],
  handleTaskToggle,
  now = new Date(),
  approvedLeaves = [],
  createForm,
  setCreateForm,
  checkOverlap,
  onClose
}: ScheduleDetailPanelProps) {
  const router = useRouter()
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false)
  
  // Create mode state
  const [newTaskDraft, setNewTaskDraft] = useState({ title: '', hasTime: false, startTime: '', endTime: '' })
  const [newChecklists, setNewChecklists] = useState<string[]>(['']) // 항상 입력할 수 있는 빈 칸 1개 제공
  
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Edit mode state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editTaskDraft, setEditTaskDraft] = useState({ title: '', hasTime: false, startTime: '' })
  const [editChecklists, setEditChecklists] = useState<{ id: string, text: string, is_completed: boolean }[]>([])

  // Checklist handler helpers
  const handleChecklistChange = (index: number, value: string, isEdit: boolean) => {
    if (isEdit) {
      const newItems = [...editChecklists]
      newItems[index].text = value
      setEditChecklists(newItems)
      // 만약 마지막 아이템에 글자가 입력되었다면, 새 빈 아이템 추가
      if (index === newItems.length - 1 && value.trim() !== '') {
        setEditChecklists([...newItems, { id: crypto.randomUUID(), text: '', is_completed: false }])
      }
    } else {
      const newItems = [...newChecklists]
      newItems[index] = value
      setNewChecklists(newItems)
      // 만약 마지막 아이템에 글자가 입력되었다면, 새 빈 칸 추가
      if (index === newItems.length - 1 && value.trim() !== '') {
        setNewChecklists([...newItems, ''])
      }
    }
  }

  const handleChecklistKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number, isEdit: boolean) => {
    if (e.nativeEvent.isComposing) return; // 한글 등 조합 중일 때는 엔터 이벤트 무시

    if (e.key === 'Enter') {
      e.preventDefault()
      // 다음 인풋으로 포커스 이동 (가장 마지막 인풋에서 엔터 치면 새 인풋은 handleChecklistChange에서 자동 생성됨)
      const nextInput = document.getElementById(`checklist-${isEdit ? 'edit' : 'new'}-${index + 1}`)
      if (nextInput) {
        nextInput.focus()
      }
    } else if (e.key === 'Backspace' && (isEdit ? editChecklists[index].text === '' : newChecklists[index] === '')) {
      // 값이 빈 칸인데 백스페이스 누르면 삭제 (마지막 하나 남은 빈 칸은 삭제 안함)
      if (isEdit && editChecklists.length > 1) {
        e.preventDefault()
        const newItems = editChecklists.filter((_, i) => i !== index)
        setEditChecklists(newItems)
        // 이전 인풋으로 포커스
        const prevInput = document.getElementById(`checklist-edit-${index - 1}`)
        if (prevInput) prevInput.focus()
      } else if (!isEdit && newChecklists.length > 1) {
        e.preventDefault()
        const newItems = newChecklists.filter((_, i) => i !== index)
        setNewChecklists(newItems)
        const prevInput = document.getElementById(`checklist-new-${index - 1}`)
        if (prevInput) prevInput.focus()
      }
    }
  }

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  const handleFieldsChange = (updates: Record<string, any>) => {
    if (!selectedSchedule) return

    // 1. Optimistic update for panel
    const newSchedule = { ...selectedSchedule, ...updates }
    if (setSelectedSchedule) setSelectedSchedule(newSchedule)

    // 2. Optimistic update for main calendar (localSchedules)
    setLocalSchedules(prev => prev.map(s => {
      if (s.id === newSchedule.id) {
        let endDateTime = new Date(`${newSchedule.editDate}T${newSchedule.editEndTime}:00`)
        if (newSchedule.editStartTime > newSchedule.editEndTime) {
          endDateTime.setDate(endDateTime.getDate() + 1)
        }
        return {
          ...s,
          start_time: new Date(`${newSchedule.editDate}T${newSchedule.editStartTime}:00`).toISOString(),
          end_time: endDateTime.toISOString(),
          schedule_members: [{ member_id: newSchedule.editStaffId }],
          schedule_type: newSchedule.scheduleType || newSchedule.schedule_type,
          title: newSchedule.title,
          color: newSchedule.color
        }
      }
      return s
    }))

    // 3. Debounced API Call
    setSaveStatus('saving')
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    
    saveTimeoutRef.current = setTimeout(async () => {
      const formData = new FormData()
      formData.append('userIds', JSON.stringify([newSchedule.editStaffId]))
      formData.append('date', newSchedule.editDate)
      formData.append('startTime', newSchedule.editStartTime)
      formData.append('endTime', newSchedule.editEndTime)
      formData.append('title', newSchedule.title || '근무')
      formData.append('color', newSchedule.color || '')
      formData.append('schedule_type', newSchedule.scheduleType || newSchedule.schedule_type || 'regular')
      
      const res = await updateSchedule(storeId, newSchedule.id, formData)
      if (res.error) {
        toast.error('자동 저장 실패: ' + res.error)
        setSaveStatus('idle')
        return
      }
      
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }, 500)
  }

  const handleFieldChange = (field: string, value: any) => {
    if (mode === 'edit') {
      handleFieldsChange({ [field]: value })
    } else if (mode === 'create' && setCreateForm && createForm) {
      setCreateForm({ ...createForm, [field]: value })
    }
  }

  // 통합 모달을 위해 현재 상태를 파생
  const isCreate = mode === 'create'
  const state = isCreate ? createForm : selectedSchedule
  
  if (!state) return null

  // 공통 변수 계산
  const targetStaffId = isCreate ? state.staffId : (state.editStaffId || state.schedule_members?.[0]?.member_id)
  const targetStaff = staffList.find(s => s.id === targetStaffId)
  const targetDate = isCreate ? state.date : state.editDate
  const targetStartTime = isCreate ? state.startTime : state.editStartTime
  const targetEndTime = isCreate ? state.endTime : state.editEndTime
  const targetType = isCreate ? state.scheduleType : (state.scheduleType || state.schedule_type)
  const roleColor = isCreate ? (targetStaff?.role_info?.color || '#534AB7') : state.roleColor
  const displayRole = isCreate ? (targetStaff?.role_info?.name || '역할 없음') : state.displayRole
  const displayName = isCreate ? (targetStaff?.name || '알 수 없음') : state.displayName

  // 오버레이 및 충돌 체크용 (TimeSlider)
  const existingSchedules = useMemo(() => {
    if (!targetStaffId || !targetDate) return [];
    return localSchedules
      .filter(sch => {
        if (!isCreate && sch.id === state.id) return false; // 본인 제외
        if (!sch.start_time) return false;
        const startObj = new Date(sch.start_time)
        if (isNaN(startObj.getTime())) return false;
        
        const yy = startObj.getFullYear()
        const mm = String(startObj.getMonth() + 1).padStart(2, '0')
        const dd = String(startObj.getDate()).padStart(2, '0')
        const schDateStr = `${yy}-${mm}-${dd}`
        
        if (schDateStr !== targetDate) return false;
        return sch.schedule_members?.some((sm: any) => sm.member_id === targetStaffId);
      })
      .map(sch => {
        const startObj = new Date(sch.start_time)
        const endObj = new Date(sch.end_time)
        const sH = startObj.getHours()
        const sM = startObj.getMinutes()
        let eH = endObj.getHours()
        const eM = endObj.getMinutes()
        if (eH < sH || endObj.getDate() !== startObj.getDate()) eH += 24
        return { startMin: sH * 60 + sM, endMin: eH * 60 + eM }
      });
  }, [localSchedules, targetStaffId, targetDate, isCreate, state]);

  const isOverlapping = useMemo(() => {
    const curStartMin = timeToMinutes(targetStartTime)
    const curEndMin = timeToMinutes(targetEndTime)
    return existingSchedules.some(sch => curStartMin < sch.endMin && curEndMin > sch.startMin)
  }, [existingSchedules, targetStartTime, targetEndTime])

  const isActuallyOnLeave = approvedLeaves.some((leave: any) => {
    return leave.member_id === targetStaffId && targetDate >= leave.start_date && targetDate <= leave.end_date;
  });

  return (
    <div className={`flex flex-col h-[85vh] max-h-[750px] overflow-hidden w-full ${isCreate ? '' : 'md:flex-row'}`}>
      {/* Left Column: Schedule Info & Slider */}
      <div className={`w-full flex flex-col border-black/10 ${isCreate ? '' : 'md:w-1/2 border-r'}`}>
        <div className="p-5 flex flex-col h-full overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between mb-4 pb-3 border-b shrink-0">
            <div className="flex items-center gap-2">
              <div 
                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                style={{ 
                  backgroundColor: hexToRgba(targetType === 'leave' ? '#64748b' : roleColor, 0.15), 
                  color: targetType === 'leave' ? '#64748b' : roleColor 
                }}
              >
                {(displayName || '직').substring(0, 1)}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-semibold text-[15px] text-[#1a1a1a]">
                  {isCreate ? '스케줄 직접 추가' : displayName}
                </span>
                {!isCreate && (
                  <span className="text-[11px] font-medium text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-md border border-black/5">
                    {displayRole}
                  </span>
                )}
              </div>
              {saveStatus === 'saving' && <span className="text-[10px] text-muted-foreground animate-pulse ml-2">저장 중...</span>}
              {saveStatus === 'saved' && <span className="text-[10px] text-[#1D9E75] ml-2 font-medium">저장됨</span>}
            </div>
          </div>
          
          <div className="flex flex-col gap-4">
            {isCreate && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-medium text-muted-foreground">직원</label>
                {targetStaffId ? (
                  <div className="text-[14px] font-semibold text-[#1a1a1a]">
                    {displayName}
                  </div>
                ) : (
                  <Select value={state.staffId} onValueChange={(val) => handleFieldChange('staffId', val)}>
                    <SelectTrigger className="text-[12px] h-8 bg-white">
                      <SelectValue placeholder="직원 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {staffList.map(s => <SelectItem key={s.id} value={s.id} className="text-[12px]">{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-[10px] font-medium text-muted-foreground">날짜</label>
                <Input 
                  type="date" 
                  className="h-8 text-[11px] px-2" 
                  value={targetDate} 
                  onChange={(e) => handleFieldChange(isCreate ? 'date' : 'editDate', e.target.value)} 
                />
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-[10px] font-medium text-muted-foreground">스케줄 유형</label>
                <Select 
                  value={targetType || 'regular'} 
                  disabled={isActuallyOnLeave}
                  onValueChange={(val) => {
                    if (isActuallyOnLeave && val !== 'leave') {
                      toast.error('변경할 수 없습니다.', { description: '승인된 휴가가 존재합니다.', duration: 4000 })
                      if (!isCreate && setSelectedSchedule) setSelectedSchedule((prev: any) => ({ ...prev }))
                      return;
                    }
                    const typeLabelMap: Record<string, string> = {
                      'regular': '근무', 'leave': '휴가', 'training': '교육', 'etc': '기타'
                    }
                    if (isCreate) {
                      if (setCreateForm) setCreateForm({ ...createForm, scheduleType: val, title: typeLabelMap[val] || '근무' })
                    } else {
                      handleFieldsChange({ schedule_type: val, scheduleType: val, title: typeLabelMap[val] || '근무' })
                    }
                  }}
                >
                  <SelectTrigger className="h-8 text-[11px] px-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular" className="text-[11px]">근무</SelectItem>
                    <SelectItem value="leave" className="text-[11px]">휴가</SelectItem>
                    <SelectItem value="training" className="text-[11px]">교육</SelectItem>
                    <SelectItem value="etc" className="text-[11px]">기타</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isActuallyOnLeave && (
              <div className="text-[10px] text-orange-600 bg-orange-50 px-2 py-1.5 rounded border border-orange-100">
                승인된 휴가 일정이 존재합니다. (자동으로 휴가 유형 적용)
              </div>
            )}

            {targetType !== 'leave' && (
              <div className="flex gap-2">
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-[10px] font-medium text-muted-foreground">시작 시간</label>
                  <TimePicker 
                    value={targetStartTime} 
                    onChange={(val) => handleFieldChange(isCreate ? 'startTime' : 'editStartTime', val)} 
                  />
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-[10px] font-medium text-muted-foreground">종료 시간</label>
                  <TimePicker 
                    value={targetEndTime} 
                    onChange={(val) => handleFieldChange(isCreate ? 'endTime' : 'editEndTime', val)} 
                  />
                </div>
              </div>
            )}

            {/* Time Slider */}
            <div className="flex flex-col gap-2 mt-4 border-t border-black/5 pt-4">
              <label className="text-[11px] font-medium text-muted-foreground">시간 슬라이더 (드래그하여 조정)</label>
              <TimeSlider 
                startTime={targetStartTime} 
                endTime={targetEndTime} 
                onChange={(s, e) => {
                  if (isCreate && setCreateForm) setCreateForm({ ...createForm, startTime: s, endTime: e })
                  else handleFieldsChange({ editStartTime: s, editEndTime: e })
                }}
                existingSchedules={existingSchedules}
              />
              {isOverlapping && (
                <div className="text-[11px] font-medium text-red-500 bg-red-50 px-2 py-1.5 rounded border border-red-100 mt-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  해당 시간대에 이미 스케줄이 존재합니다.
                </div>
              )}
            </div>
          </div>

          <div className="mt-auto pt-6 flex gap-2 justify-end">
            {isCreate ? (
              <>
                <button 
                  className="px-4 py-2 text-[11px] font-medium border border-black/10 rounded-md hover:bg-black/5 transition-colors" 
                  onClick={onClose}
                >
                  취소
                </button>
                <button 
                  className="px-5 py-2 text-[11px] font-medium bg-[#1a1a1a] text-white rounded-md hover:bg-black/80 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed" 
                  disabled={isOverlapping}
                  onClick={async () => {
                    if (!createForm.staffId || !createForm.startTime || !createForm.endTime || !createForm.date) {
                      toast.error('직원, 날짜, 시간을 모두 입력해주세요.')
                      return
                    }
                    const startStr = `${createForm.date}T${createForm.startTime}:00`
                    const endStr = `${createForm.date}T${createForm.endTime}:00`
                    
                    if (checkOverlap && checkOverlap(createForm.staffId, new Date(startStr), new Date(endStr))) {
                      toast.error('해당 시간대에 이미 스케줄이 존재합니다.')
                      return
                    }

                    if (isActuallyOnLeave && (createForm.scheduleType || 'regular') !== 'leave') {
                      toast.error('휴가 상태 오류', { description: '유형을 휴가로 설정해주세요.' });
                      return;
                    }

                    const formData = new FormData()
                    formData.append('userIds', JSON.stringify([createForm.staffId]))
                    formData.append('date', createForm.date)
                    formData.append('startTime', createForm.startTime)
                    formData.append('endTime', createForm.endTime)
                    formData.append('title', createForm.title || '근무')
                    formData.append('schedule_type', createForm.scheduleType || 'regular')

                    const res = await createSchedule(storeId, formData)
                    if (res.error) {
                      toast.error(res.error)
                      return
                    }

                    const typeLabelMap: Record<string, string> = {
                      'regular': '근무', 'leave': '휴가', 'training': '교육', 'etc': '기타'
                    }
                    const displayTitle = typeLabelMap[createForm.scheduleType || 'regular'] || createForm.title || '근무'
                    
                    const newSchedule = {
                      id: `temp-${Date.now()}`,
                      start_time: startStr,
                      end_time: endStr,
                      title: displayTitle,
                      schedule_type: createForm.scheduleType || 'regular',
                      schedule_members: [{ member_id: createForm.staffId }],
                      task_assignments: []
                    }
                    
                    setLocalSchedules(prev => [...prev, newSchedule])
                    toast.success('스케줄이 추가되었습니다.')
                    onClose()
                    router.refresh()
                  }}
                >
                  추가하기
                </button>
              </>
            ) : (
              <button 
                className="w-full text-[11px] text-destructive hover:bg-destructive/10 hover:text-destructive py-2 rounded font-medium transition-colors border border-transparent hover:border-destructive/20"
                onClick={async () => {
                  if (window.confirm('이 스케줄을 정말 삭제하시겠습니까?')) {
                    const res = await deleteSchedule(storeId, state.id)
                    if (res.error) {
                      toast.error(res.error)
                      return
                    }
                    setLocalSchedules(prev => prev.filter(s => s.id !== state.id))
                    if (setSelectedSchedule) setSelectedSchedule(null)
                    toast.success('스케줄이 삭제되었습니다.')
                    onClose()
                    router.refresh()
                  }
                }}
              >
                이 스케줄 삭제
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Tasks (Checklists) */}
      {!isCreate && (
        <div className="w-full md:w-1/2 flex flex-col bg-[#fafafa] overflow-y-auto custom-scrollbar p-5 border-t md:border-t-0 border-black/10">
          {(() => {
          const allTasks = state.tasks || []
          const customTasks = allTasks

          const renderTaskItem = (t: any) => {
            const derivedStatus = getDerivedTaskStatus(t, selectedSchedule.editDate, now)
            const sInfo = STATUS_INFO[derivedStatus]
            const isDone = derivedStatus === 'done'
            const isPending = derivedStatus === 'pending'
            
            if (editingTaskId === t.id) {
              return (
                <div key={t.id} className="border border-primary/30 bg-primary/5 rounded-md p-3 flex flex-col gap-3 animate-in fade-in duration-200">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-[#1a1a1a]">업무 그룹 (대표 제목)</label>
                    <Input 
                      placeholder="예: 홀 테이블 정리, 화장실 청소 등" 
                      className="h-8 text-[12px] font-medium bg-white" 
                      value={editTaskDraft.title}
                      onChange={(e) => setEditTaskDraft(prev => ({...prev, title: e.target.value}))}
                      autoFocus
                    />
                  </div>
                  
                  <div className="flex flex-col gap-1.5 bg-white p-2 rounded-md border border-black/5">
                    <label className="text-[10px] font-semibold text-muted-foreground mb-1">세부 할 일 (체크리스트)</label>
                    <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
                      {editChecklists.map((item, index) => (
                        <div key={item.id} className="flex items-center gap-2">
                          <Checkbox disabled className="w-3.5 h-3.5 opacity-50" />
                          <Input
                            id={`checklist-edit-${index}`}
                            placeholder={index === editChecklists.length - 1 ? "할 일 추가... (엔터 입력)" : "할 일 내용"}
                            className="h-7 text-[11px] bg-transparent border-transparent hover:border-black/10 focus-visible:border-primary/50 focus-visible:ring-0 px-1 shadow-none transition-colors"
                            value={item.text}
                            onChange={(e) => handleChecklistChange(index, e.target.value, true)}
                            onKeyDown={(e) => handleChecklistKeyDown(e, index, true)}
                          />
                          {item.text && index !== editChecklists.length - 1 && (
                            <button 
                              className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors shrink-0"
                              onClick={() => {
                                const newItems = editChecklists.filter((_, i) => i !== index)
                                setEditChecklists(newItems)
                              }}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between border-t border-black/5 pt-2">
                    <label className="text-[10px] font-medium text-[#1a1a1a] flex items-center gap-2 cursor-pointer">
                      <Switch 
                        checked={editTaskDraft.hasTime} 
                        onCheckedChange={(val) => setEditTaskDraft(prev => ({...prev, hasTime: val}))} 
                        className="scale-75 origin-left"
                      />
                      수행 시간 지정하기
                    </label>
                  </div>

                  {editTaskDraft.hasTime && (
                    <div className="flex flex-col gap-1.5 bg-white p-2 rounded border border-black/5">
                      <label className="text-[9px] text-muted-foreground">업무 시작 시간 (선택)</label>
                      <div className="flex items-center gap-2">
                        <TimePicker 
                          value={editTaskDraft.startTime} 
                          onChange={(val) => setEditTaskDraft(prev => ({...prev, startTime: val}))}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-1.5 mt-1">
                    <button 
                      className="text-[11px] px-3 py-1.5 rounded text-muted-foreground hover:bg-black/5 transition-colors font-medium"
                      onClick={() => setEditingTaskId(null)}
                    >
                      취소
                    </button>
                    <button 
                      className="text-[11px] px-3 py-1.5 rounded bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-sm"
                      onClick={async () => {
                        if (!editTaskDraft.title.trim()) {
                          toast.error('업무 그룹(대표 제목)을 입력해주세요.')
                          return
                        }
                        
                        const loadingToast = toast.loading('업무 수정 중...')
                        const startTimeToUse = editTaskDraft.hasTime && editTaskDraft.startTime 
                          ? `${selectedSchedule.editDate}T${editTaskDraft.startTime}:00` 
                          : null;
                        
                        const finalChecklist = editChecklists
                          .filter(c => c.text.trim() !== '')
                          .map(c => ({ id: c.id, text: c.text.trim(), is_completed: c.is_completed }))

                        const res = await updateTaskAssignment(
                          t.id, 
                          t.id, 
                          storeId, 
                          editTaskDraft.title, 
                          startTimeToUse,
                          30
                        );
                        
                        const { createClient } = await import('@/lib/supabase/client')
                        const supabase = createClient()
                        await supabase.from('tasks').update({ checklist: finalChecklist }).eq('id', t.id)

                        if (res.error) {
                          toast.dismiss(loadingToast)
                          toast.error(res.error)
                          return
                        }

                        const updatedSchedule = {
                          ...selectedSchedule,
                          tasks: selectedSchedule.tasks.map((task: any) => {
                            if (task.id === t.id) {
                              return {
                                ...task,
                                title: editTaskDraft.title,
                                start_time: startTimeToUse || (editTaskDraft.hasTime ? editTaskDraft.startTime : null),
                                checklist: finalChecklist
                              }
                            }
                            return task
                          })
                        }
                        if (setSelectedSchedule) setSelectedSchedule(updatedSchedule)
                        setLocalSchedules(prev => prev.map(s => s.id === updatedSchedule.id ? updatedSchedule : s))

                        toast.dismiss(loadingToast)
                        toast.success('업무가 수정되었습니다.')
                        setEditingTaskId(null)
                        router.refresh()
                      }}
                    >
                      저장
                    </button>
                  </div>
                </div>
              )
            }

            return (
              <div key={t.id} className={`relative flex flex-col gap-1 p-2.5 bg-[#fcfcfc] border ${isPending ? 'border-orange-300 bg-orange-50/30' : 'border-black/10'} rounded-md shadow-sm group hover:border-black/20 transition-colors`}>
                
                {/* Hover Actions (Edit / Delete) */}
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button 
                     className="p-1 rounded bg-white border border-black/10 text-muted-foreground hover:text-black hover:bg-muted/50 shadow-sm"
                     onClick={() => {
                        setEditTaskDraft({
                          title: t.title || '',
                          hasTime: !!t.start_time,
                          startTime: t.start_time ? (t.start_time.includes('T') ? format(new Date(t.start_time), 'HH:mm') : t.start_time.substring(0, 5)) : ''
                        })
                        
                        const existingList = t.checklist || []
                        setEditChecklists([
                            ...existingList,
                            { id: crypto.randomUUID(), text: '', is_completed: false }
                        ])
                        
                        setEditingTaskId(t.id)
                     }}
                     title="수정"
                   >
                     <Pencil className="w-3 h-3" />
                   </button>
                   <button 
                     className="p-1 rounded bg-white border border-black/10 text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 shadow-sm"
                     onClick={async () => {
                       if (window.confirm('이 업무를 정말 삭제하시겠습니까?')) {
                         const loadingToast = toast.loading('업무 삭제 중...')
                         const res = await deleteTask(t.id)
                         if (res.error) {
                           toast.dismiss(loadingToast)
                           toast.error(res.error)
                           return
                         }
                         
                         const updatedSchedule = {
                           ...selectedSchedule,
                           tasks: selectedSchedule.tasks.filter((task: any) => task.id !== t.id)
                         }
                         if (setSelectedSchedule) setSelectedSchedule(updatedSchedule)
                         setLocalSchedules(prev => prev.map(s => s.id === updatedSchedule.id ? updatedSchedule : s))
                         
                         toast.dismiss(loadingToast)
                         toast.success('업무가 삭제되었습니다.')
                         router.refresh()
                       }
                     }}
                     title="삭제"
                   >
                     <Trash2 className="w-3 h-3" />
                   </button>
                </div>

                <div className="flex items-start gap-2 pr-12">
                  <Checkbox 
                    id={`panel-task-${t.id}`} 
                    checked={isDone}
                    onCheckedChange={() => handleTaskToggle?.(t.id, t.status)}
                    className="mt-0.5 w-4 h-4 border-black/30 data-[state=checked]:bg-[#16a34a] data-[state=checked]:border-[#16a34a]"
                  />
                  <div className="flex flex-col flex-1 leading-tight mt-0.5">
                    <label 
                      htmlFor={`panel-task-${t.id}`}
                      className={`text-[12px] font-medium cursor-pointer ${isDone ? 'line-through text-muted-foreground/60' : 'text-[#1a1a1a]'}`}
                    >
                      {t.title}
                    </label>
                    {t.checklist && t.checklist.length > 0 && (
                      <div className="flex flex-col gap-1.5 mt-2">
                        {t.checklist.map((item: any) => (
                          <div key={item.id} className="flex items-start gap-1.5 group/chk">
                            <Checkbox 
                              id={`chk-${item.id}`}
                              checked={item.is_completed}
                              onCheckedChange={async (val) => {
                                const newTasks = selectedSchedule.tasks.map((task: any) => {
                                  if (task.id === t.id) {
                                    const newChecklist = task.checklist.map((c: any) => 
                                      c.id === item.id ? { ...c, is_completed: !!val } : c
                                    )
                                    
                                    const allCompleted = newChecklist.length > 0 && newChecklist.every((c: any) => c.is_completed)
                                    let newStatus = task.status
                                    if (allCompleted) {
                                      newStatus = 'done'
                                    } else if (task.status === 'done') {
                                      newStatus = 'todo'
                                    }

                                    return {
                                      ...task,
                                      checklist: newChecklist,
                                      status: newStatus
                                    }
                                  }
                                  return task
                                });
                                const updatedSchedule = { ...selectedSchedule, tasks: newTasks };
                                if (setSelectedSchedule) setSelectedSchedule(updatedSchedule);
                                setLocalSchedules((prev: any[]) => prev.map(s => s.id === updatedSchedule.id ? updatedSchedule : s));
                                
                                await toggleTaskCheckitem(t.id, item.id, !!val);
                                router.refresh();
                              }}
                              className="mt-0.5 w-3 h-3 rounded-[3px] border-black/20 data-[state=checked]:bg-[#1a1a1a] data-[state=checked]:border-[#1a1a1a]"
                            />
                            <label 
                              htmlFor={`chk-${item.id}`}
                              className={`text-[11px] cursor-pointer flex-1 leading-tight ${item.is_completed ? 'line-through text-muted-foreground/60' : 'text-muted-foreground hover:text-[#1a1a1a]'}`}
                            >
                              {item.text}
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {t.start_time && (
                    <div 
                      className="text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                      style={{ backgroundColor: sInfo.bg, color: sInfo.color, border: `1px solid ${sInfo.border}` }}
                    >
                      {sInfo.label}
                    </div>
                  )}
                </div>
                
                {t.start_time && (
                  <div className="flex items-center gap-2 mt-1.5 pl-6">
                    <span className={`text-[9px] font-medium flex items-center gap-1 bg-white px-1.5 py-0.5 rounded border ${isPending ? 'text-orange-500 border-orange-200' : isDone ? 'text-muted-foreground/50 border-black/5' : 'text-primary/80 border-primary/20'}`}>
                      🕒 {t.start_time.includes('T') ? format(new Date(t.start_time), 'HH:mm') : t.start_time.substring(0, 5)}
                    </span>
                  </div>
                )}
              </div>
            )
          }

          return (
            <div className="flex flex-col gap-3 h-full">
              <div className="flex items-center justify-between pb-3 border-b border-black/10 shrink-0">
                <span className="text-[14px] font-semibold text-[#1a1a1a]">오늘의 할 일 (체크리스트)</span>
                <span className="text-[11px] text-muted-foreground bg-black/5 px-2 py-0.5 rounded-full font-medium">
                  완료: {customTasks.filter((t: any) => t.status === 'done').length} / {customTasks.length}
                </span>
              </div>
                
                <div className="flex flex-col gap-2">
                  {customTasks.length > 0 ? (
                    customTasks.map((t: any) => renderTaskItem(t))
                  ) : (
                    <div className="text-[11px] text-muted-foreground text-center py-5 border border-dashed border-black/10 rounded-md bg-[#fcfcfc]">
                      등록된 개별 업무가 없습니다.
                    </div>
                  )}

                  {/* 업무 추가 폼 */}
            {isTaskFormOpen ? (
              <div className="border border-primary/30 bg-primary/5 rounded-md p-3 flex flex-col gap-3 mt-auto mb-2 animate-in fade-in duration-200 shadow-sm">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold text-[#1a1a1a]">업무 그룹 (대표 제목)</label>
                  <Input 
                    placeholder="예: 홀 테이블 정리, 화장실 청소 등" 
                    className="h-8 text-[12px] font-medium bg-white" 
                    value={newTaskDraft.title}
                    onChange={(e) => setNewTaskDraft(prev => ({...prev, title: e.target.value}))}
                    autoFocus
                  />
                </div>
                
                <div className="flex flex-col gap-1.5 bg-white p-2 rounded-md border border-black/5">
                  <label className="text-[10px] font-semibold text-muted-foreground mb-1">세부 할 일 (체크리스트)</label>
                  <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
                    {newChecklists.map((text, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Checkbox disabled className="w-3.5 h-3.5 opacity-50" />
                        <Input
                          id={`checklist-new-${index}`}
                          placeholder={index === newChecklists.length - 1 ? "할 일 추가... (엔터 입력)" : "할 일 내용"}
                          className="h-7 text-[11px] bg-transparent border-transparent hover:border-black/10 focus-visible:border-primary/50 focus-visible:ring-0 px-1 shadow-none transition-colors"
                          value={text}
                          onChange={(e) => handleChecklistChange(index, e.target.value, false)}
                          onKeyDown={(e) => handleChecklistKeyDown(e, index, false)}
                        />
                        {text && index !== newChecklists.length - 1 && (
                          <button 
                            className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors shrink-0"
                            onClick={() => {
                              const newItems = newChecklists.filter((_, i) => i !== index)
                              setNewChecklists(newItems)
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-black/5 pt-2">
                  <label className="text-[10px] font-medium text-[#1a1a1a] flex items-center gap-2 cursor-pointer">
                    <Switch 
                      checked={newTaskDraft.hasTime} 
                      onCheckedChange={(val) => setNewTaskDraft(prev => ({...prev, hasTime: val}))} 
                      className="scale-75 origin-left"
                    />
                    수행 시간 지정하기
                  </label>
                </div>

                {newTaskDraft.hasTime && (
                  <div className="flex flex-col gap-1.5 bg-white p-2 rounded border border-black/5">
                    <label className="text-[9px] text-muted-foreground">업무 시작 시간 (선택)</label>
                    <div className="flex items-center gap-2">
                      <TimePicker 
                        value={newTaskDraft.startTime} 
                        onChange={(val) => setNewTaskDraft(prev => ({...prev, startTime: val}))}
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-1.5 mt-1">
                  <button 
                    className="text-[11px] px-3 py-1.5 rounded text-muted-foreground hover:bg-black/5 transition-colors font-medium"
                    onClick={() => setIsTaskFormOpen(false)}
                  >
                    취소
                  </button>
                  <button 
                    className="text-[11px] px-3 py-1.5 rounded bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-sm"
                    onClick={async () => {
                      if (!newTaskDraft.title.trim()) {
                        toast.error('업무 그룹(대표 제목)을 입력해주세요.')
                        return
                      }

                      const loadingToast = toast.loading('업무를 추가하는 중...')
                      
                      // startTimeStr은 입력된 시간을 UTC 형태 문자열로 생성할지 여부
                      const assignStartTime = newTaskDraft.hasTime && newTaskDraft.startTime 
                        ? newTaskDraft.startTime // "HH:mm" 포맷
                        : null;
                        
                      const finalChecklist = newChecklists
                        .filter(text => text.trim() !== '')
                        .map(text => ({
                           id: crypto.randomUUID(),
                           text: text.trim(),
                           is_completed: false
                        }))

                      // 바로 스케줄과 연결되는 개별 업무로 생성 (is_template = false)
                      const result = await createDirectScheduleTask({
                        store_id: storeId,
                        title: newTaskDraft.title,
                        task_type: newTaskDraft.hasTime ? 'scheduled' : 'always',
                        start_time: assignStartTime ? toUTCISOString(selectedSchedule.editDate, assignStartTime) : null,
                        end_time: assignStartTime ? toUTCISOString(selectedSchedule.editDate, addMinutesToTime(assignStartTime, 30)) : null,
                        estimated_minutes: 30,
                        checklist: finalChecklist,
                        staff_id: targetStaffId,
                        schedule_id: selectedSchedule.id,
                        assigned_date: selectedSchedule.editDate
                      })

                      if (result.error) {
                        toast.dismiss(loadingToast)
                        toast.error(result.error)
                        return
                      }

                      const task = result.data

                      // 성공적으로 생성되었으므로 UI 상태 업데이트
                      const updatedSchedule = {
                        ...selectedSchedule,
                        tasks: [...(selectedSchedule.tasks || []), task]
                      };
                      
                      if (setSelectedSchedule) setSelectedSchedule(updatedSchedule);
                      setLocalSchedules(prev => prev.map(s => s.id === updatedSchedule.id ? updatedSchedule : s));
                      
                      toast.dismiss(loadingToast)
                      toast.success(`'${newTaskDraft.title}' 업무가 추가되었습니다.`)
                      setIsTaskFormOpen(false)
                      setNewTaskDraft({ title: '', hasTime: false, startTime: '', endTime: '' })
                      setNewChecklists([''])
                      router.refresh()
                    }}
                  >
                    추가하기
                  </button>
                </div>
              </div>
            ) : (
              <button 
                className="w-full border border-dashed border-black/20 text-[#6b6b6b] hover:text-[#1a1a1a] bg-white hover:bg-black/5 hover:border-black/30 text-[12px] py-2.5 rounded-md flex items-center justify-center gap-1 transition-all mt-auto mb-2 font-medium shadow-sm"
                onClick={() => setIsTaskFormOpen(true)}
              >
                <span className="text-[14px] leading-none mb-[1px]">+</span> 개별 업무 추가
              </button>
                  )}
                </div>
            </div>
          )
        })()}
        </div>
      )}
    </div>
  )
}
