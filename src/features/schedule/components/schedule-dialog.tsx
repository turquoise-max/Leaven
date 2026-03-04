'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
// import { ScrollArea } from '@/components/ui/scroll-area'
import { createSchedule, deleteSchedule, updateSchedule } from '@/features/schedule/actions'
import { toast } from 'sonner'
import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

interface ScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  selectedDate: string | null // YYYY-MM-DD
  selectedEvent: any | null
  staffList: any[]
  storeId: string
  initialStartTime?: string
  initialEndTime?: string
}

export function ScheduleDialog({
  open,
  onOpenChange,
  mode,
  selectedDate,
  selectedEvent,
  staffList,
  storeId,
  initialStartTime,
  initialEndTime,
}: ScheduleDialogProps) {
  const [loading, setLoading] = useState(false)
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('18:00')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [memo, setMemo] = useState('')
  const [title, setTitle] = useState('')
  const [color, setColor] = useState('')
  
  // Recurring States
  const [isRecurring, setIsRecurring] = useState(false)
  const [repeatEndDate, setRepeatEndDate] = useState('')
  const [repeatDays, setRepeatDays] = useState<number[]>([]) // 0: Sun, 1: Mon, ...

  const daysOfWeek = [
    { label: '일', value: 0 },
    { label: '월', value: 1 },
    { label: '화', value: 2 },
    { label: '수', value: 3 },
    { label: '목', value: 4 },
    { label: '금', value: 5 },
    { label: '토', value: 6 },
  ]

  const SCHEDULE_COLORS = [
    { label: '기본', value: '' },
    { label: '빨강', value: '#EF4444' },
    { label: '주황', value: '#F97316' },
    { label: '노랑', value: '#EAB308' },
    { label: '초록', value: '#22C55E' },
    { label: '파랑', value: '#3B82F6' },
    { label: '보라', value: '#A855F7' },
    { label: '분홍', value: '#EC4899' },
    { label: '회색', value: '#6B7280' },
  ]

  useEffect(() => {
    if (open) {
      if (mode === 'create' && selectedDate) {
        // 날짜만 추출 (YYYY-MM-DD)
        const dateStr = selectedDate.split('T')[0]
        setDate(dateStr)
        setStartTime(initialStartTime || '09:00')
        setEndTime(initialEndTime || '18:00')
        setSelectedUserIds([])
        setMemo('')
        setTitle('')
        setColor('')
        
        // 반복 설정 초기화
        setIsRecurring(false)
        setRepeatEndDate('') // 기본값 없음
        
        // 기본 요일 선택 (선택된 날짜의 요일 하나만 선택)
        const day = new Date(dateStr).getDay()
        setRepeatDays([day])

      } else if (mode === 'edit' && selectedEvent) {
        // ISO string에서 날짜와 시간 추출 (FullCalendar 객체일 수도 있고, DB 원본일 수도 있음)
        const startVal = selectedEvent.start || selectedEvent.start_time
        const endVal = selectedEvent.end || selectedEvent.end_time
        
        if (!startVal || !endVal) return

        const start = new Date(startVal)
        const end = new Date(endVal)
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return

        // toISOString()은 UTC 기준으로 변환되므로 날짜가 하루 밀릴 수 있음
        // 로컬 시간 기준으로 날짜 문자열 생성 (YYYY-MM-DD)
        const year = start.getFullYear()
        const month = String(start.getMonth() + 1).padStart(2, '0')
        const day = String(start.getDate()).padStart(2, '0')
        setDate(`${year}-${month}-${day}`)
        
        // 시간 설정 (HH:mm)
        const startHour = String(start.getHours()).padStart(2, '0')
        const startMinute = String(start.getMinutes()).padStart(2, '0')
        setStartTime(`${startHour}:${startMinute}`)
        
        const endHour = String(end.getHours()).padStart(2, '0')
        const endMinute = String(end.getMinutes()).padStart(2, '0')
        setEndTime(`${endHour}:${endMinute}`)
        
        // 다중 멤버 매핑
        const members = selectedEvent.schedule_members || []
        const userIds = members.map((m: any) => m.user_id)
        setSelectedUserIds(userIds)
        
        const memo = selectedEvent.memo || selectedEvent.extendedProps?.memo || ''
        setMemo(memo)
        
        setTitle(selectedEvent.title || '')
        setColor(selectedEvent.color || selectedEvent.extendedProps?.color || '')
        
        // 편집 모드에서는 반복 설정 비활성화 (개별 수정만 지원)
        setIsRecurring(false)
      }
    }
  }, [open, mode, selectedDate, selectedEvent, initialStartTime, initialEndTime])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    
    if (selectedUserIds.length === 0) {
      toast.error('직원을 최소 1명 이상 선택해주세요.')
      return
    }

    setLoading(true)
    const formData = new FormData(e.currentTarget)
    
    // 수동으로 데이터 추가 (JSON 변환 필요)
    formData.set('userIds', JSON.stringify(selectedUserIds))
    formData.set('repeatDays', JSON.stringify(repeatDays))
    formData.set('color', color)
    
    // Checkbox는 체크 안되면 폼에 포함 안되므로 수동 처리
    if (isRecurring) {
        formData.set('isRecurring', 'on')
        if (!repeatEndDate) {
            toast.error('반복 종료일을 선택해주세요.')
            setLoading(false)
            return
        }
        if (repeatDays.length === 0) {
            toast.error('반복할 요일을 선택해주세요.')
            setLoading(false)
            return
        }
    }

    let result
    
    if (mode === 'create') {
      result = await createSchedule(storeId, formData)
    } else {
      result = await updateSchedule(storeId, selectedEvent.id, formData)
    }
    
    setLoading(false)

    if (result.error) {
      toast.error(mode === 'create' ? '스케줄 생성 실패' : '스케줄 수정 실패', { description: result.error })
    } else {
      const count = (result as any).count || 1
      toast.success(mode === 'create' ? `${count}개의 스케줄이 생성되었습니다.` : '스케줄 수정 완료')
      onOpenChange(false)
    }
  }

  async function handleDelete() {
    if (!selectedEvent) return
    if (!confirm('정말 삭제하시겠습니까?')) return

    setLoading(true)
    const result = await deleteSchedule(storeId, selectedEvent.id)
    setLoading(false)

    if (result.error) {
      toast.error('삭제 실패', { description: result.error })
    } else {
      toast.success('삭제 완료')
      onOpenChange(false)
    }
  }

  const toggleUser = (userId: string) => {
    // 생성/편집 모드 모두 다중 선택 가능
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const toggleDay = (dayValue: number) => {
      setRepeatDays(prev => 
          prev.includes(dayValue)
            ? prev.filter(d => d !== dayValue)
            : [...prev, dayValue]
      )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '근무 일정 추가' : '근무 일정 수정'}</DialogTitle>
          <DialogDescription>
            {mode === 'create' 
              ? '여러 직원에게 반복되는 근무 일정을 한 번에 배정할 수 있습니다.' 
              : '선택한 근무 일정을 수정합니다.'}
          </DialogDescription>
        </DialogHeader>
        
        <form id="schedule-form" onSubmit={handleSubmit} className="grid gap-6 py-4">
          
          {/* 1. 스케줄 정보 */}
          <div className="grid gap-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-1">근무 정보</h3>
            <div className="grid gap-2">
              <Label htmlFor="title">근무 명칭 (선택)</Label>
              <Input
                id="title"
                name="title"
                placeholder="예: 오전 근무, 오픈 조"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
               <Label>색상</Label>
               <div className="flex flex-wrap gap-2">
                  {SCHEDULE_COLORS.map((c) => (
                      <div
                        key={c.value}
                        onClick={() => setColor(c.value)}
                        className={`
                            w-6 h-6 rounded-full cursor-pointer border flex items-center justify-center
                            ${color === c.value ? 'ring-2 ring-primary ring-offset-1' : 'hover:opacity-80'}
                        `}
                        style={{ backgroundColor: c.value || '#ffffff' }}
                        title={c.label}
                      >
                         {!c.value && <span className="text-[10px] text-muted-foreground">기본</span>}
                      </div>
                  ))}
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="grid gap-2">
                <Label htmlFor="date">시작일</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>시간</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="startTime"
                    name="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                  <span>~</span>
                  <Input
                    id="endTime"
                    name="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* 2. 반복 설정 (생성 모드일 때만) */}
          {mode === 'create' && (
            <div className="grid gap-4">
               <div className="flex items-center gap-2">
                  <Checkbox 
                    id="isRecurring" 
                    name="isRecurring" 
                    checked={isRecurring}
                    onCheckedChange={(checked) => setIsRecurring(checked as boolean)}
                  />
                  <Label htmlFor="isRecurring" className="font-medium cursor-pointer">반복 설정</Label>
               </div>

               {isRecurring && (
                  <div className="pl-6 grid gap-4">
                      <div className="grid gap-2">
                          <Label>반복 요일</Label>
                          <div className="flex gap-2">
                              {daysOfWeek.map((day) => (
                                  <div 
                                    key={day.value}
                                    onClick={() => toggleDay(day.value)}
                                    className={`
                                        w-8 h-8 rounded-full flex items-center justify-center text-xs cursor-pointer border transition-colors
                                        ${repeatDays.includes(day.value) 
                                            ? 'bg-primary text-primary-foreground border-primary' 
                                            : 'bg-background hover:bg-muted'
                                        }
                                    `}
                                  >
                                      {day.label}
                                  </div>
                              ))}
                          </div>
                      </div>
                      <div className="grid gap-2">
                          <Label htmlFor="repeatEndDate">반복 종료일</Label>
                          <Input
                            id="repeatEndDate"
                            name="repeatEndDate"
                            type="date"
                            value={repeatEndDate}
                            onChange={(e) => setRepeatEndDate(e.target.value)}
                            min={date} // 시작일 이후여야 함
                          />
                      </div>
                  </div>
               )}
            </div>
          )}

          <Separator />

          {/* 3. 직원 선택 */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
                <Label>배정 대상 직원</Label>
                <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-xs"
                    onClick={() => {
                        if (selectedUserIds.length === staffList.length) {
                            setSelectedUserIds([])
                        } else {
                            setSelectedUserIds(staffList.map(s => s.user_id))
                        }
                    }}
                >
                    {selectedUserIds.length === staffList.length ? '전체 해제' : '전체 선택'}
                </Button>
            </div>
            
            <div className="h-[150px] border rounded-md p-2 overflow-y-auto">
                <div className="space-y-1">
                    {staffList.map((staff) => (
                        <div 
                            key={staff.user_id}
                            className={`
                                flex items-center justify-between p-2 rounded-md transition-colors text-sm
                                ${selectedUserIds.includes(staff.user_id) ? 'bg-primary/10' : 'hover:bg-muted'}
                            `}
                        >
                             <div className="flex items-center gap-3 flex-1">
                                <Checkbox 
                                    checked={selectedUserIds.includes(staff.user_id)}
                                    onCheckedChange={() => toggleUser(staff.user_id)}
                                    id={`staff-${staff.user_id}`}
                                />
                                <div 
                                    className="flex flex-col cursor-pointer flex-1"
                                    onClick={() => toggleUser(staff.user_id)}
                                >
                                    <span className="font-medium">{staff.profile?.full_name || staff.profile?.email}</span>
                                    <span className="text-xs text-muted-foreground">{staff.profile?.email}</span>
                                </div>
                             </div>
                             
                             <div 
                                className="cursor-pointer pl-2"
                                onClick={() => toggleUser(staff.user_id)}
                             >
                                {staff.role_info ? (
                                    <Badge 
                                        variant="outline" 
                                        className="text-[10px] h-5 px-1.5" 
                                        style={{ 
                                        borderColor: staff.role_info.color, 
                                        color: staff.role_info.color,
                                        backgroundColor: `${staff.role_info.color}10`
                                        }}
                                    >
                                        {staff.role_info.name}
                                    </Badge>
                                ) : (
                                    <span className="text-muted-foreground text-xs">({staff.role})</span>
                                )}
                             </div>
                        </div>
                    ))}
                </div>
            </div>
          </div>

          {/* 4. 메모 */}
          <div className="grid gap-2">
            <Label htmlFor="memo">메모</Label>
            <Textarea
              id="memo"
              name="memo"
              placeholder="특이사항 입력"
              className="min-h-[80px]"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </div>
        </form>

        <DialogFooter className="flex justify-between sm:justify-between pt-4 border-t">
          {mode === 'edit' ? (
            <Button 
              type="button" 
              variant="destructive" 
              onClick={handleDelete}
              disabled={loading}
            >
              삭제
            </Button>
          ) : <div></div>}
          <div className="flex gap-2 ml-auto">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit" form="schedule-form" disabled={loading}>
              {mode === 'create' ? '등록' : '수정'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}