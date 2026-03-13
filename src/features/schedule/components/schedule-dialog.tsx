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
import { TimePicker } from '@/components/ui/time-picker'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
// import { ScrollArea } from '@/components/ui/scroll-area'
import { createSchedule, deleteSchedule, updateSchedule } from '@/features/schedule/actions'
import { toast } from 'sonner'
import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Calendar as CalendarIcon, Sparkles, Loader2 } from 'lucide-react'
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addMonths, addWeeks } from 'date-fns'
import { ko } from 'date-fns/locale'
import { DateRange } from 'react-day-picker'
import { generateStaffSchedules } from '../actions'

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

  // Auto Generation States
  const [isAutoMode, setIsAutoMode] = useState(false)
  const [isRecurringDialogOpen, setIsRecurringDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date()
    return {
      from: startOfWeek(addDays(today, 7), { weekStartsOn: 1 }),
      to: endOfWeek(addDays(today, 7), { weekStartsOn: 1 }),
    }
  })

  const daysOfWeek = [
    { label: '월', value: 1 },
    { label: '화', value: 2 },
    { label: '수', value: 3 },
    { label: '목', value: 4 },
    { label: '금', value: 5 },
    { label: '토', value: 6 },
    { label: '일', value: 0 },
  ]

  const filteredStaffList = staffList.filter((staff) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    const nameMatch = (staff.name || staff.profile?.full_name || '').toLowerCase().includes(q)
    const emailMatch = (staff.profile?.email || '').toLowerCase().includes(q)
    return nameMatch || emailMatch
  })

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
        
        // 반복/자동 모드 초기화
        setIsRecurring(false)
        setRepeatEndDate('') // 기본값 없음
        setIsAutoMode(false)
        setIsRecurringDialogOpen(false)
        setSearchQuery('')
        setDateRange({
          from: startOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 }),
          to: endOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 }),
        })
        
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
        const memberIds = members.map((m: any) => m.member_id)
        setSelectedUserIds(memberIds)
        
        const memo = selectedEvent.memo || selectedEvent.extendedProps?.memo || ''
        setMemo(memo)
        
        setTitle(selectedEvent.title || '')
        setColor(selectedEvent.color || selectedEvent.extendedProps?.color || '')
        
        // 편집 모드에서는 반복/자동 설정 비활성화
        setIsRecurring(false)
        setIsAutoMode(false)
        setSearchQuery('')
      }
    }
  }, [open, mode, selectedDate, selectedEvent, initialStartTime, initialEndTime])

  const setQuickDate = (type: 'thisWeek' | 'nextWeek' | 'thisMonth' | 'nextMonth') => {
    const now = new Date()
    let from, to
    
    switch (type) {
        case 'thisWeek':
            from = startOfWeek(now, { weekStartsOn: 1 })
            to = endOfWeek(now, { weekStartsOn: 1 })
            break
        case 'nextWeek':
            const nextWeek = addWeeks(now, 1)
            from = startOfWeek(nextWeek, { weekStartsOn: 1 })
            to = endOfWeek(nextWeek, { weekStartsOn: 1 })
            break
        case 'thisMonth':
            from = startOfMonth(now)
            to = endOfMonth(now)
            break
        case 'nextMonth':
            const nextMonth = addMonths(now, 1)
            from = startOfMonth(nextMonth)
            to = endOfMonth(nextMonth)
            break
    }
    
    setDateRange({ from, to })
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    
    if (selectedUserIds.length === 0) {
      toast.error('직원을 최소 1명 이상 선택해주세요.')
      return
    }

    setLoading(true)

    // 자동 생성 모드일 경우 별도 API 호출 후 리턴
    if (isAutoMode && mode === 'create') {
      if (!dateRange?.from || !dateRange?.to) {
        toast.error('기간을 선택해주세요.')
        setLoading(false)
        return
      }

      const startDateStr = format(dateRange.from, 'yyyy-MM-dd')
      const endDateStr = format(dateRange.to, 'yyyy-MM-dd')

      const result = await generateStaffSchedules(
        storeId,
        startDateStr,
        endDateStr,
        selectedUserIds
      )

      setLoading(false)

      if (result.error) {
        toast.error('스케줄 생성 실패', { description: result.error })
      } else {
        const count = result.count ?? 0
        toast.success('스케줄 자동 생성 완료', { description: `총 ${count}개의 스케줄이 생성되었습니다.` })
        onOpenChange(false)
      }
      return
    }

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
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto transition-all sm:max-w-[950px]">
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-start justify-between pr-4">
            <div>
              <DialogTitle className="text-xl">{mode === 'create' ? '근무 일정 추가' : '근무 일정 수정'}</DialogTitle>
              <DialogDescription className="text-sm mt-1.5">
                {mode === 'create' 
                  ? '새로운 일정을 수동으로 추가하거나, 설정된 기본 스케줄을 바탕으로 자동 생성할 수 있습니다.' 
                  : '선택한 근무 일정을 수정합니다.'}
              </DialogDescription>
            </div>
            {mode === 'create' && (
              <div className="flex items-center gap-2 bg-primary/5 px-3 py-2 rounded-lg border border-primary/20 shrink-0 mt-1">
                <Switch 
                  id="auto-mode" 
                  checked={isAutoMode} 
                  onCheckedChange={setIsAutoMode}
                  className="data-[state=checked]:bg-primary"
                />
                <Label htmlFor="auto-mode" className="text-xs font-semibold cursor-pointer text-primary flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  자동 생성
                </Label>
              </div>
            )}
          </div>
        </DialogHeader>
        
        <form id="schedule-form" onSubmit={handleSubmit} className="py-2">

          {/* 자동 생성 모드: 2단 레이아웃 */}
          {isAutoMode && mode === 'create' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 mt-4 animate-in fade-in slide-in-from-top-2">
              
              {/* 좌측 섹션: 생성 기간 선택 */}
              <div className="flex flex-col gap-6">
                <div className="grid gap-5">
                  <div className="flex flex-col gap-1.5 mb-1">
                    <h3 className="text-sm font-semibold text-foreground/90 flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-primary" />
                      생성 기간 선택
                    </h3>
                    <p className="text-xs text-muted-foreground">선택한 기간 동안 각 직원의 '기본 스케줄' 설정에 맞춰 근무가 일괄 생성됩니다. 이미 등록된 일정은 덮어쓰지 않습니다.</p>
                  </div>
              
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" className="h-7 px-2.5 text-xs bg-background" onClick={() => setQuickDate('thisWeek')}>
                          이번 주
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="h-7 px-2.5 text-xs bg-background" onClick={() => setQuickDate('nextWeek')}>
                          다음 주
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="h-7 px-2.5 text-xs bg-background" onClick={() => setQuickDate('thisMonth')}>
                          이번 달
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="h-7 px-2.5 text-xs bg-background" onClick={() => setQuickDate('nextMonth')}>
                          다음 달
                      </Button>
                    </div>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          id="date"
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal bg-background h-10",
                            !dateRange && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateRange?.from ? (
                            dateRange.to ? (
                              <>
                                {format(dateRange.from, "PPP", { locale: ko })} -{" "}
                                {format(dateRange.to, "PPP", { locale: ko })}
                              </>
                            ) : (
                              format(dateRange.from, "PPP", { locale: ko })
                            )
                          ) : (
                            <span>날짜 선택</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          initialFocus
                          mode="range"
                          defaultMonth={dateRange?.from}
                          selected={dateRange}
                          onSelect={setDateRange}
                          numberOfMonths={2}
                          locale={ko}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              {/* 우측 섹션: 직원 선택 (자동 모드) */}
              <div className="flex flex-col gap-6">
                <div className="grid gap-3 flex-1 flex flex-col">
                  <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold text-foreground/90">배정 대상 직원</Label>
                      <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs px-2 hover:bg-muted/80 text-muted-foreground"
                          onClick={() => {
                              if (selectedUserIds.length === staffList.length) {
                                  setSelectedUserIds([])
                              } else {
                                  setSelectedUserIds(staffList.map(s => s.id))
                              }
                          }}
                      >
                          {selectedUserIds.length === staffList.length ? '전체 해제' : '전체 선택'}
                      </Button>
                  </div>
                  
                  <Input 
                    type="search" 
                    placeholder="이름 또는 이메일로 검색" 
                    className="h-9 text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />

                  <div className="flex-1 min-h-[250px] max-h-[350px] border rounded-lg bg-muted/5 p-1.5 overflow-y-auto">
                      <div className="space-y-1">
                          {filteredStaffList.map((staff) => {
                              const isSelected = selectedUserIds.includes(staff.id)
                              return (
                                  <div 
                                      key={staff.id}
                                      className={`
                                          flex items-center justify-between px-3 py-2.5 rounded-md transition-all text-sm border
                                          ${isSelected ? 'bg-background border-primary/30 shadow-sm' : 'bg-transparent border-transparent hover:bg-muted/50'}
                                      `}
                                  >
                                       <div className="flex items-center gap-3 flex-1">
                                          <Checkbox 
                                              checked={isSelected}
                                              onCheckedChange={() => toggleUser(staff.id)}
                                              id={`staff-auto-${staff.id}`}
                                              className={isSelected ? 'border-primary' : ''}
                                          />
                                       <div 
                                          className="flex flex-col cursor-pointer flex-1 gap-0.5"
                                          onClick={() => toggleUser(staff.id)}
                                       >
                                           <div className="flex items-center gap-2">
                                              <span className={cn("font-medium", isSelected ? "text-foreground" : "text-foreground/80")}>
                                                  {staff.name || staff.profile?.full_name || staff.profile?.email || '이름 없음'}
                                              </span>
                                              {staff.role_info ? (
                                                  <Badge 
                                                      variant="outline" 
                                                      className="text-[10px] h-5 px-1.5 font-medium border-transparent" 
                                                      style={{ 
                                                        color: staff.role_info.color,
                                                        backgroundColor: `${staff.role_info.color}15`
                                                      }}
                                                  >
                                                      {staff.role_info.name}
                                                  </Badge>
                                              ) : (
                                                  <span className="text-muted-foreground/50 text-[10px]">({staff.role})</span>
                                              )}
                                           </div>
                                           <span className="text-[11px] text-muted-foreground/70 flex items-center gap-1 mt-0.5">
                                             기본 근무: {
                                                (() => {
                                                  const schedules = staff.work_schedules || []
                                                  const active = schedules.filter((s: any) => !s.is_holiday)
                                                  if (active.length === 0) return '없음'
                                                  return `${active.length}일 설정됨`
                                                })()
                                             }
                                           </span>
                                       </div>
                                    </div>
                                  </div>
                              )
                          })}
                          {filteredStaffList.length === 0 && (
                            <div className="text-center text-sm text-muted-foreground py-8">
                                검색된 직원이 없습니다.
                            </div>
                          )}
                      </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground text-right px-1">
                      {selectedUserIds.length}명 선택됨
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* 수동 모드: 2단 레이아웃 (좌: 근무설정, 우: 대상/메모) */}
          {!isAutoMode && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 mt-4">
              
              {/* 좌측 섹션: 근무 정보 및 반복 설정 */}
              <div className="flex flex-col gap-6">
                <div className="grid gap-6">
                  <div className="grid gap-6">
                    <div className="flex gap-4">
                      {/* 근무 명칭 */}
                      <div className="grid gap-2 flex-1">
                        <Label htmlFor="title" className="text-sm font-semibold text-foreground/90">근무 명칭 <span className="text-muted-foreground font-normal">(선택)</span></Label>
                        <Input
                          id="title"
                          name="title"
                          placeholder="예: 오전 근무, 오픈 조"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="bg-background h-10"
                        />
                      </div>

                      {/* 색상 팝오버 */}
                      <div className="grid gap-2 shrink-0">
                         <Label className="text-sm font-semibold text-foreground/90">색상</Label>
                         <Popover>
                           <PopoverTrigger asChild>
                             <Button 
                               variant="outline" 
                               className="w-10 h-10 rounded-md p-0 flex items-center justify-center border bg-background"
                             >
                                <div 
                                  className="w-5 h-5 rounded-full border"
                                  style={{ backgroundColor: color || '#f1f5f9', borderColor: color ? color : '#e2e8f0' }}
                                />
                             </Button>
                           </PopoverTrigger>
                           <PopoverContent className="w-auto p-3" align="end">
                             <div className="grid grid-cols-5 gap-2">
                               {SCHEDULE_COLORS.map((c) => (
                                  <div
                                    key={c.value}
                                    onClick={() => setColor(c.value)}
                                    className={`
                                        w-7 h-7 rounded-full cursor-pointer border flex items-center justify-center transition-all
                                        ${color === c.value ? 'ring-2 ring-primary ring-offset-2 scale-110 shadow-sm' : 'hover:scale-105 hover:shadow-sm'}
                                    `}
                                    style={{ backgroundColor: c.value || '#f1f5f9', borderColor: c.value ? c.value : '#e2e8f0' }}
                                    title={c.label}
                                  >
                                     {!c.value && <span className="text-[10px] text-muted-foreground font-medium">기본</span>}
                                  </div>
                               ))}
                             </div>
                           </PopoverContent>
                         </Popover>
                      </div>
                    </div>

                    <div className="grid gap-6">
                       {/* 일시 (날짜 및 시간 통합) */}
                       <div className="grid gap-2">
                        <Label className="text-sm font-semibold text-foreground/90">일시</Label>
                        <div className="border p-4 rounded-lg bg-background flex flex-col gap-4">
                          <div className="flex flex-col gap-2">
                            <Input
                              id="date"
                              name="date"
                              type="date"
                              value={date}
                              onChange={(e) => setDate(e.target.value)}
                              required
                              className="w-full h-9"
                            />
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <TimePicker
                              id="startTime"
                              name="startTime"
                              value={startTime}
                              onChange={setStartTime}
                              className="flex-1"
                            />
                            <span className="text-muted-foreground/60 text-sm font-medium px-2 shrink-0">~</span>
                            <TimePicker
                              id="endTime"
                              name="endTime"
                              value={endTime}
                              onChange={setEndTime}
                              className="flex-1"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. 반복 설정 (생성 모드일 때만) */}
                {mode === 'create' && (
                  <div className="grid gap-3 pt-2">
                     <div className="flex items-center justify-between border rounded-lg p-3 bg-background">
                        <div className="flex items-center gap-2">
                           <Switch 
                             id="isRecurring" 
                             checked={isRecurring}
                             onCheckedChange={(checked) => {
                               setIsRecurring(checked)
                               if (checked) {
                                 setIsRecurringDialogOpen(true)
                               }
                             }}
                           />
                           <Label htmlFor="isRecurring" className="text-sm font-semibold cursor-pointer text-foreground/90">매주 반복하기</Label>
                        </div>
                        {isRecurring && (
                           <Button 
                             type="button" 
                             variant="ghost" 
                             size="sm" 
                             onClick={() => setIsRecurringDialogOpen(true)} 
                             className="h-7 text-xs px-2 text-primary hover:text-primary hover:bg-primary/10"
                           >
                             설정 변경
                           </Button>
                        )}
                     </div>
                     {isRecurring && repeatEndDate && repeatDays.length > 0 && (
                        <p className="text-[11px] text-muted-foreground px-1">
                          {format(new Date(repeatEndDate), 'yyyy년 MM월 dd일')}까지 
                          매주 {repeatDays.map(d => daysOfWeek.find(w => w.value === d)?.label).join(', ')}요일 반복
                        </p>
                     )}
                  </div>
                )}
              </div>

              {/* 우측 섹션: 직원 선택 및 메모 */}
              <div className="flex flex-col gap-6">
                
                {/* 직원 선택 */}
                <div className="grid gap-3 flex-1 flex flex-col">
                  <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold text-foreground/90">배정 대상 직원</Label>
                      <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs px-2 hover:bg-muted/80 text-muted-foreground"
                          onClick={() => {
                              if (selectedUserIds.length === staffList.length) {
                                  setSelectedUserIds([])
                              } else {
                                  setSelectedUserIds(staffList.map(s => s.id))
                              }
                          }}
                      >
                          {selectedUserIds.length === staffList.length ? '전체 해제' : '전체 선택'}
                      </Button>
                  </div>
                  
                  <Input 
                    type="search" 
                    placeholder="이름 또는 이메일로 검색" 
                    className="h-9 text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />

                  <div className="flex-1 min-h-[240px] max-h-[350px] border rounded-lg bg-muted/5 p-1.5 overflow-y-auto">
                      <div className="space-y-1">
                          {filteredStaffList.map((staff) => {
                              const isSelected = selectedUserIds.includes(staff.id)
                              return (
                                  <div 
                                      key={staff.id}
                                      className={`
                                          flex items-center justify-between px-3 py-2.5 rounded-md transition-all text-sm border
                                          ${isSelected ? 'bg-background border-primary/30 shadow-sm' : 'bg-transparent border-transparent hover:bg-muted/50'}
                                      `}
                                  >
                                       <div className="flex items-center gap-3 flex-1">
                                          <Checkbox 
                                              checked={isSelected}
                                              onCheckedChange={() => toggleUser(staff.id)}
                                              id={`staff-${staff.id}`}
                                              className={isSelected ? 'border-primary' : ''}
                                          />
                                       <div 
                                          className="flex flex-col cursor-pointer flex-1 gap-0.5"
                                          onClick={() => toggleUser(staff.id)}
                                       >
                                           <div className="flex items-center gap-2">
                                              <span className={cn("font-medium", isSelected ? "text-foreground" : "text-foreground/80")}>
                                                  {staff.name || staff.profile?.full_name || staff.profile?.email || '이름 없음'}
                                              </span>
                                              {staff.role_info ? (
                                                  <Badge 
                                                      variant="outline" 
                                                      className="text-[10px] h-5 px-1.5 font-medium border-transparent" 
                                                      style={{ 
                                                        color: staff.role_info.color,
                                                        backgroundColor: `${staff.role_info.color}15`
                                                      }}
                                                  >
                                                      {staff.role_info.name}
                                                  </Badge>
                                              ) : (
                                                  <span className="text-muted-foreground/50 text-[10px]">({staff.role})</span>
                                              )}
                                           </div>
                                           <span className="text-xs text-muted-foreground/70">{staff.profile?.email}</span>
                                       </div>
                                    </div>
                                  </div>
                              )
                          })}
                          {filteredStaffList.length === 0 && (
                            <div className="text-center text-sm text-muted-foreground py-8">
                                검색된 직원이 없습니다.
                            </div>
                          )}
                      </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground text-right px-1">
                      {selectedUserIds.length}명 선택됨
                  </p>
                </div>

                {/* 메모 */}
                <div className="grid gap-2">
                  <Label htmlFor="memo" className="text-sm font-semibold text-foreground/90">메모 <span className="text-muted-foreground font-normal">(선택)</span></Label>
                  <Textarea
                    id="memo"
                    name="memo"
                    placeholder="스케줄에 대한 특이사항을 입력하세요."
                    className="h-[100px] bg-muted/5 resize-none"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

        </form>

        <DialogFooter className="flex items-center justify-between sm:justify-between pt-4 border-t mt-4">
          {mode === 'edit' ? (
            <Button 
              type="button" 
              variant="destructive" 
              size="sm"
              onClick={handleDelete}
              disabled={loading}
              className="bg-red-50 hover:bg-red-100 text-red-600 border-red-200"
            >
              스케줄 삭제
            </Button>
          ) : <div aria-hidden="true" />}
          
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit" form="schedule-form" disabled={loading} className={cn("min-w-[80px]", isAutoMode ? "bg-primary text-primary-foreground gap-1.5" : "")}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {!loading && isAutoMode && <Sparkles className="w-4 h-4" />}
              {mode === 'create' ? (isAutoMode ? '자동 생성하기' : '일정 추가') : '수정 완료'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={isRecurringDialogOpen} onOpenChange={setIsRecurringDialogOpen}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>매주 반복 설정</DialogTitle>
          <DialogDescription>
            일정을 매주 반복할 요일과 종료일을 설정합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="grid gap-3">
            <Label className="text-sm font-semibold text-foreground/90">반복 요일</Label>
            <div className="flex flex-wrap gap-2">
                {daysOfWeek.map((day) => (
                    <div 
                      key={day.value}
                      onClick={() => toggleDay(day.value)}
                      className={`
                          w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm font-medium cursor-pointer border transition-all select-none
                          ${repeatDays.includes(day.value) 
                              ? 'bg-primary text-primary-foreground border-primary shadow-md scale-105' 
                              : 'bg-background hover:bg-muted text-muted-foreground hover:text-foreground'
                          }
                      `}
                    >
                        {day.label}
                    </div>
                ))}
            </div>
          </div>
          <div className="grid gap-3">
            <Label htmlFor="repeatEndDate" className="text-sm font-semibold text-foreground/90">반복 종료일</Label>
            <Input
              id="repeatEndDate"
              type="date"
              value={repeatEndDate}
              onChange={(e) => setRepeatEndDate(e.target.value)}
              min={date} // 시작일 이후여야 함
              className="h-10"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={() => {
              if (!repeatEndDate) {
                  toast.error('반복 종료일을 선택해주세요.')
                  return
              }
              if (repeatDays.length === 0) {
                  toast.error('반복할 요일을 선택해주세요.')
                  return
              }
              setIsRecurringDialogOpen(false)
          }}>확인</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
