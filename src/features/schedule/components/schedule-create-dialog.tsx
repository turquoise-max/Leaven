'use client'

import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TimePicker } from '@/components/ui/time-picker'
import { toast } from 'sonner'
import { createSchedule } from '@/features/schedule/actions'
import { useRouter } from 'next/navigation'
import { CalendarPlus } from 'lucide-react'

import { useEffect, useRef, useState } from 'react'

// 시간 분 변환 유틸
function timeToMinutes(timeStr: string) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number) {
  const h = Math.floor(mins / 60);
  const m = Math.floor(mins % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// 커스텀 타임 슬라이더 컴포넌트
function TimeSlider({ 
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

interface ScheduleCreateDialogProps {
  storeId: string
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  createForm: {
    title: string
    date: string
    startTime: string
    endTime: string
    staffId: string
    scheduleType?: 'regular' | 'substitute' | 'overtime' | 'off' | 'leave' | 'training' | 'etc'
  }
  setCreateForm: (form: any) => void
  staffList: any[]
  checkOverlap: (staffId: string, start: Date, end: Date) => boolean
  setLocalSchedules: React.Dispatch<React.SetStateAction<any[]>>
  localSchedules?: any[]
}

export function ScheduleCreateDialog({
  storeId,
  isOpen,
  setIsOpen,
  createForm,
  setCreateForm,
  staffList,
  checkOverlap,
  setLocalSchedules,
  localSchedules = []
}: ScheduleCreateDialogProps) {
  const router = useRouter()

  // 해당 직원의 해당 날짜 기존 스케줄 계산 (오버레이 표시용)
  // timezone을 안전하게 처리하기 위해 Date 파싱 활용
  const existingSchedules = React.useMemo(() => {
    if (!createForm.staffId || !createForm.date) return [];
    
    return localSchedules
      .filter(sch => {
        if (!sch.start_time) return false;
        const startObj = new Date(sch.start_time)
        if (isNaN(startObj.getTime())) return false;
        
        // 날짜를 YYYY-MM-DD 포맷으로 비교 (로컬 타임존 기준)
        const yy = startObj.getFullYear()
        const mm = String(startObj.getMonth() + 1).padStart(2, '0')
        const dd = String(startObj.getDate()).padStart(2, '0')
        const schDateStr = `${yy}-${mm}-${dd}`
        
        if (schDateStr !== createForm.date) return false;
        return sch.schedule_members?.some((sm: any) => sm.member_id === createForm.staffId);
      })
      .map(sch => {
        const startObj = new Date(sch.start_time)
        const endObj = new Date(sch.end_time)
        
        const sH = startObj.getHours()
        const sM = startObj.getMinutes()
        
        let eH = endObj.getHours()
        const eM = endObj.getMinutes()
        
        // 종료 시간이 시작 시간보다 작거나 날짜가 익일인 경우 24시 초과로 처리
        if (eH < sH || endObj.getDate() !== startObj.getDate()) {
          eH += 24
        }
        
        return {
          startMin: sH * 60 + sM,
          endMin: eH * 60 + eM
        }
      });
  }, [localSchedules, createForm.staffId, createForm.date]);

  // 실시간 충돌 여부 계산
  const isOverlapping = React.useMemo(() => {
    const curStartMin = timeToMinutes(createForm.startTime)
    const curEndMin = timeToMinutes(createForm.endTime)
    
    return existingSchedules.some(sch => {
      // 겹치는 조건: 현재 시작이 기존 종료보다 앞서고, 현재 종료가 기존 시작보다 뒤인 경우
      return curStartMin < sch.endMin && curEndMin > sch.startMin
    })
  }, [existingSchedules, createForm.startTime, createForm.endTime])

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-4 border-b border-black/10 bg-[#fbfbfb]">
          <DialogTitle className="text-[16px] flex items-center gap-2">
            <CalendarPlus className="w-4 h-4 text-[#1a1a1a]" />
            스케줄 직접 추가
          </DialogTitle>
          <div className="text-[12px] text-[#6b6b6b] mt-1.5 font-normal">
            원하는 날짜와 시간을 지정하여 새로운 단일 스케줄을 추가합니다.
          </div>
        </DialogHeader>
        
        <div className="p-5 flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3">
            {/* 고정 정보 영역 (직원명 & 날짜) */}
            <div className="flex bg-[#f3f2ef] rounded-lg p-3 border border-black/5 items-center gap-4 col-span-2">
              <div className="flex-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">대상 직원</label>
                {createForm.staffId ? (
                  <div className="text-[14px] font-semibold text-[#1a1a1a]">
                    {staffList.find(s => s.id === createForm.staffId)?.name || '알 수 없음'}
                  </div>
                ) : (
                  <Select value={createForm.staffId} onValueChange={(val) => setCreateForm({...createForm, staffId: val})}>
                    <SelectTrigger className="text-[12px] h-7 bg-white">
                      <SelectValue placeholder="직원 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {staffList.map(s => <SelectItem key={s.id} value={s.id} className="text-[12px]">{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="w-px h-8 bg-black/10" />
              <div className="flex-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">날짜</label>
                {createForm.date ? (
                  <div className="text-[14px] font-semibold text-[#1a1a1a]">
                    {createForm.date}
                  </div>
                ) : (
                  <Input 
                    type="date" 
                    className="text-[12px] h-7 bg-white px-2 py-0" 
                    value={createForm.date} 
                    onChange={(e) => setCreateForm({...createForm, date: e.target.value})} 
                  />
                )}
              </div>
            </div>

            {/* 스케줄 유형 선택 */}
            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="text-[12px] font-semibold text-[#1a1a1a]">스케줄 유형</label>
              <Select 
                value={createForm.scheduleType || 'regular'} 
                onValueChange={(val) => {
                  const typeLabelMap: Record<string, string> = {
                    'regular': '근무',
                    'leave': '휴가',
                    'training': '교육',
                    'etc': '기타'
                  }
                  setCreateForm({
                    ...createForm,
                    scheduleType: val,
                    title: typeLabelMap[val] || '근무'
                  })
                }}
              >
                <SelectTrigger className="h-9 text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular" className="text-[13px]">근무</SelectItem>
                  <SelectItem value="leave" className="text-[13px]">휴가</SelectItem>
                  <SelectItem value="training" className="text-[13px]">교육</SelectItem>
                  <SelectItem value="etc" className="text-[13px]">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 시간 입력 영역 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-[#1a1a1a]">시작 시간</label>
              <TimePicker 
                value={createForm.startTime} 
                onChange={(val) => setCreateForm({...createForm, startTime: val})}
                className="w-full"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-[#1a1a1a]">종료 시간</label>
              <TimePicker 
                value={createForm.endTime} 
                onChange={(val) => setCreateForm({...createForm, endTime: val})}
                className="w-full"
              />
            </div>
          </div>

          {/* 시간 선택 슬라이더 */}
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[12px] font-medium text-muted-foreground italic">시간 슬라이더 (드래그하여 조정 가능)</label>
            </div>
            
            <TimeSlider 
              startTime={createForm.startTime} 
              endTime={createForm.endTime} 
              onChange={(s, e) => setCreateForm({ ...createForm, startTime: s, endTime: e })}
              existingSchedules={existingSchedules}
            />
            
            {isOverlapping && (
              <div className="text-[11px] font-medium text-red-500 bg-red-50 px-2 py-1.5 rounded border border-red-100 mt-4 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                선택한 시간대에 이미 기존 스케줄이 존재합니다. 시간을 조정해주세요.
              </div>
            )}
          </div>
        </div>
        
        <div className="px-5 py-4 border-t border-black/10 bg-[#fbfbfb] flex justify-end gap-2">
          <button 
            className="px-4 py-2 text-[12px] font-medium border border-black/10 rounded-md hover:bg-black/5 transition-colors" 
            onClick={() => setIsOpen(false)}
          >
            취소
          </button>
          <button 
            className="px-5 py-2 text-[12px] font-medium bg-[#1a1a1a] text-white rounded-md hover:bg-black/80 transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed" 
            disabled={isOverlapping}
            onClick={async () => {
              if (!createForm.staffId || !createForm.startTime || !createForm.endTime || !createForm.date) {
                toast.error('직원, 날짜, 시간을 모두 입력해주세요.')
                return
              }
              
              const startStr = `${createForm.date}T${createForm.startTime}:00`
              const endStr = `${createForm.date}T${createForm.endTime}:00`
              
              if (checkOverlap(createForm.staffId, new Date(startStr), new Date(endStr))) {
                toast.error('해당 시간대에 이미 스케줄이 존재합니다.')
                return
              }

              // API Call
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

              // Optimistic UI Update
              const newSchedule = {
                id: `temp-${Date.now()}`,
                start_time: startStr,
                end_time: endStr,
                title: createForm.title || '근무',
                schedule_type: createForm.scheduleType || 'regular',
                schedule_members: [{ member_id: createForm.staffId }],
                task_assignments: []
              }
              
              setLocalSchedules(prev => [...prev, newSchedule])
              toast.success('스케줄이 추가되었습니다.')
              setIsOpen(false)
              router.refresh()
            }}
          >
            추가하기
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}