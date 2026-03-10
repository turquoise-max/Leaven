'use client'

import { useState, useEffect } from 'react'
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addMonths, addWeeks } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Calendar as CalendarIcon, Loader2, Sparkles, Trash2, CalendarClock } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { generateStaffSchedules, deleteStaffSchedules } from '../actions'
import { toast } from 'sonner'
import { DateRange } from 'react-day-picker'

interface AutoScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  storeId: string
  staffList: any[]
  initialMode?: 'create' | 'delete'
}

export function AutoScheduleDialog({
  open,
  onOpenChange,
  storeId,
  staffList,
  initialMode = 'create'
}: AutoScheduleDialogProps) {
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'create' | 'delete'>(initialMode)

  useEffect(() => {
    if (open) {
      setMode(initialMode)
    }
  }, [open, initialMode])
  
  // Default: Next Week
  const today = new Date()
  const nextWeekStart = startOfWeek(addDays(today, 7), { weekStartsOn: 1 })
  const nextWeekEnd = endOfWeek(addDays(today, 7), { weekStartsOn: 1 })
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: nextWeekStart,
    to: nextWeekEnd,
  })
  
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>(
    staffList.map(s => s.user_id)
  )

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStaffIds(staffList.map(s => s.user_id))
    } else {
      setSelectedStaffIds([])
    }
  }

  const handleStaffToggle = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedStaffIds(prev => [...prev, userId])
    } else {
      setSelectedStaffIds(prev => prev.filter(id => id !== userId))
    }
  }

  // Quick Date Select Helpers
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

  const handleSubmit = async () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast.error('기간을 선택해주세요.')
      return
    }
    if (selectedStaffIds.length === 0) {
      toast.error('직원을 한 명 이상 선택해주세요.')
      return
    }

    setLoading(true)
    
    // Convert to YYYY-MM-DD (Local Time)
    const startDate = format(dateRange.from, 'yyyy-MM-dd')
    const endDate = format(dateRange.to, 'yyyy-MM-dd')
    
    let result;
    
    if (mode === 'create') {
        result = await generateStaffSchedules(
          storeId,
          startDate,
          endDate,
          selectedStaffIds
        )
    } else {
        result = await deleteStaffSchedules(
          storeId,
          startDate,
          endDate,
          selectedStaffIds
        )
    }
    
    setLoading(false)

    if (result.error) {
      toast.error(mode === 'create' ? '스케줄 생성 실패' : '스케줄 삭제 실패', { 
          description: result.error 
      })
    } else {
      const count = result.count ?? 0
      toast.success(mode === 'create' ? '스케줄 생성 완료' : '스케줄 삭제 완료', { 
        description: `총 ${count}개의 스케줄이 ${mode === 'create' ? '생성' : '삭제'}되었습니다.` 
      })
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-primary" />
            스케줄 자동 관리
          </DialogTitle>
          <DialogDescription>
            직원들의 근무 스케줄을 자동으로 생성하거나, 일괄 삭제할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(val) => setMode(val as 'create' | 'delete')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create" className="gap-2">
                <Sparkles className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                자동 생성
            </TabsTrigger>
            <TabsTrigger value="delete" className="gap-2 text-destructive data-[state=active]:text-destructive">
                <Trash2 className="w-4 h-4" />
                일괄 삭제
            </TabsTrigger>
          </TabsList>

          <div className="grid gap-6 py-4">
            {/* Description per mode */}
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                {mode === 'create' ? (
                    <p>직원별 근무 설정에 따라 스케줄을 생성합니다. <br/>이미 스케줄이 있는 날짜는 건너뜁니다.</p>
                ) : (
                    <p className="text-destructive">선택한 기간과 직원의 모든 스케줄을 영구 삭제합니다. <br/>이 작업은 되돌릴 수 없습니다.</p>
                )}
            </div>

            {/* Date Range Picker with Quick Select */}
            <div className="grid gap-2">
              <Label>
                {mode === 'create' ? '생성 기간' : '삭제 기간'}
              </Label>
              
              <div className="flex gap-2 mb-1">
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setQuickDate('thisWeek')}>
                    이번 주
                </Button>
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setQuickDate('nextWeek')}>
                    다음 주
                </Button>
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setQuickDate('thisMonth')}>
                    이번 달
                </Button>
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setQuickDate('nextMonth')}>
                    다음 달
                </Button>
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
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

            {/* Staff Selection */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>대상 직원</Label>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="select-all" 
                    checked={selectedStaffIds.length === staffList.length && staffList.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                  <Label htmlFor="select-all" className="text-xs font-normal cursor-pointer">
                    전체 선택
                  </Label>
                </div>
              </div>
              
              <div className="border rounded-md">
                <ScrollArea className="h-[200px]">
                  <div className="p-4 space-y-3">
                    {staffList.map((staff) => {
                      // 근무 패턴 요약 (예: 월,수 09:00-18:00)
                      const schedules = staff.work_schedules || []
                      const activeSchedules = schedules
                          .filter((s: any) => !s.is_holiday)
                          .sort((a: any, b: any) => a.day - b.day)

                      let patternText = '설정 없음'

                      if (activeSchedules.length > 0) {
                        // 시간대별로 요일 그룹화
                        const timeGroups = new Map<string, number[]>()
                        
                        activeSchedules.forEach((s: any) => {
                          const timeKey = `${s.start_time}-${s.end_time}`
                          const days = timeGroups.get(timeKey) || []
                          days.push(s.day)
                          timeGroups.set(timeKey, days)
                        })

                        // 그룹별 텍스트 생성
                        const parts: string[] = []
                        const dayNames = ['일','월','화','수','목','금','토']

                        timeGroups.forEach((days, timeKey) => {
                          const [start, end] = timeKey.split('-')
                          const dayStr = days.map(d => dayNames[d]).join(',')
                          // 시간 포맷 간소화 (09:00:00 -> 09:00)
                          const formatTime = (t: string) => t.substring(0, 5)
                          parts.push(`${dayStr} ${formatTime(start)}-${formatTime(end)}`)
                        })

                        patternText = parts.join(' / ')
                      }

                      return (
                        <div key={staff.user_id} className="flex items-start gap-3">
                          <Checkbox 
                            id={`staff-${staff.user_id}`}
                            checked={selectedStaffIds.includes(staff.user_id)}
                            onCheckedChange={(checked) => handleStaffToggle(staff.user_id, checked as boolean)}
                          />
                          <div className="grid gap-0.5">
                            <Label 
                              htmlFor={`staff-${staff.user_id}`}
                              className="font-medium cursor-pointer"
                            >
                              {staff.profile?.full_name || '이름 없음'}
                              <span className="ml-2 text-xs font-normal text-muted-foreground">
                                {staff.role_info?.name || staff.role}
                              </span>
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              근무 요일: {patternText}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                    {staffList.length === 0 && (
                      <p className="text-sm text-center text-muted-foreground py-4">
                        직원이 없습니다.
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            취소
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading} 
            variant={mode === 'delete' ? 'destructive' : 'default'}
            className="gap-2"
          >
            {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === 'create' ? (
                <Sparkles className="h-4 w-4" />
            ) : (
                <Trash2 className="h-4 w-4" />
            )}
            {mode === 'create' ? '생성하기' : '삭제하기'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}