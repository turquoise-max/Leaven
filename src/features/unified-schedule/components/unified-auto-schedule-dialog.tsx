'use client'

import React, { useState } from 'react'
import { format, addDays, startOfWeek, endOfWeek, addWeeks, startOfMonth, endOfMonth, addMonths } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Loader2, Calendar as CalendarIcon, Sparkles } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { generateStaffSchedules } from '@/features/schedule/actions'
import { toast } from 'sonner'
import { DateRange } from 'react-day-picker'
import { useRouter } from 'next/navigation'

interface UnifiedAutoScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  storeId: string
  staffList: any[]
}

export function UnifiedAutoScheduleDialog({
  open,
  onOpenChange,
  storeId,
  staffList,
}: UnifiedAutoScheduleDialogProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  
  // 기본 선택 기간: 다음 주
  const today = new Date()
  const nextWeekStart = startOfWeek(addDays(today, 7), { weekStartsOn: 1 })
  const nextWeekEnd = endOfWeek(addDays(today, 7), { weekStartsOn: 1 })
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: nextWeekStart,
    to: nextWeekEnd,
  })
  
  // 기본적으로 모든 직원을 선택 상태로 둠
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>(
    staffList.map(s => s.id)
  )

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStaffIds(staffList.map(s => s.id))
    } else {
      setSelectedStaffIds([])
    }
  }

  const handleStaffToggle = (memberId: string, checked: boolean) => {
    if (checked) {
      setSelectedStaffIds(prev => [...prev, memberId])
    } else {
      setSelectedStaffIds(prev => prev.filter(id => id !== memberId))
    }
  }

  // 빠른 날짜 선택 헬퍼
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
    
    // YYYY-MM-DD (Local Time) 변환
    const startDate = format(dateRange.from, 'yyyy-MM-dd')
    const endDate = format(dateRange.to, 'yyyy-MM-dd')
    
    const result = await generateStaffSchedules(
      storeId,
      startDate,
      endDate,
      selectedStaffIds
    )
    
    setLoading(false)

    if (result.error) {
      toast.error('스케줄 생성 실패', { description: result.error })
    } else {
      const count = result.count ?? 0
      toast.success('스케줄 생성 완료', { 
        description: `총 ${count}개의 스케줄이 생성되었습니다.` 
      })
      onOpenChange(false)
      // 페이지 새로고침하여 데이터 동기화
      router.refresh()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-4 border-b border-black/10 bg-[#fbfbfb]">
          <DialogTitle className="text-[16px] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#1D9E75]" />
            스케줄 자동 생성
          </DialogTitle>
          <div className="text-[12px] text-[#6b6b6b] mt-1.5 font-normal">
            직원 정보에 설정된 기본 근무 시간을 바탕으로 선택한 기간의 스케줄을 자동 생성합니다. (이미 스케줄이 있는 날짜는 건너뜁니다)
          </div>
        </DialogHeader>

        <div className="p-5 flex flex-col gap-6">
          {/* 기간 선택 영역 */}
          <div className="flex flex-col gap-2.5">
            <label className="text-[12px] font-semibold text-[#1a1a1a]">기간 선택</label>
            
            <div className="flex gap-1.5 mb-1">
              <button 
                className="px-2.5 py-1 text-[11px] font-medium border border-black/10 rounded-md hover:bg-[#f3f2ef] transition-colors" 
                onClick={() => setQuickDate('thisWeek')}
              >
                이번 주
              </button>
              <button 
                className="px-2.5 py-1 text-[11px] font-medium border border-black/10 rounded-md hover:bg-[#f3f2ef] transition-colors" 
                onClick={() => setQuickDate('nextWeek')}
              >
                다음 주
              </button>
              <button 
                className="px-2.5 py-1 text-[11px] font-medium border border-black/10 rounded-md hover:bg-[#f3f2ef] transition-colors" 
                onClick={() => setQuickDate('thisMonth')}
              >
                이번 달
              </button>
              <button 
                className="px-2.5 py-1 text-[11px] font-medium border border-black/10 rounded-md hover:bg-[#f3f2ef] transition-colors" 
                onClick={() => setQuickDate('nextMonth')}
              >
                다음 달
              </button>
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal h-9 text-[12px]",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
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
                    <span>날짜를 선택하세요</span>
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

          {/* 대상 직원 선택 영역 */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-semibold text-[#1a1a1a]">대상 직원</label>
              <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => handleSelectAll(selectedStaffIds.length !== staffList.length)}>
                <Checkbox 
                  id="select-all" 
                  checked={selectedStaffIds.length === staffList.length && staffList.length > 0}
                  onCheckedChange={handleSelectAll}
                  className="w-3.5 h-3.5"
                />
                <span className="text-[11px] font-medium text-[#6b6b6b]">
                  전체 선택
                </span>
              </div>
            </div>
            
            <div className="border border-black/10 rounded-md max-h-[180px] overflow-y-auto bg-white">
              {staffList.length === 0 ? (
                <div className="p-4 text-center text-[12px] text-[#6b6b6b]">
                  등록된 직원이 없습니다.
                </div>
              ) : (
                <div className="flex flex-col">
                  {staffList.map((staff, idx) => {
                    const schedules = staff.work_schedules || []
                    const activeSchedules = schedules
                        .filter((s: any) => !s.is_holiday)
                        .sort((a: any, b: any) => a.day - b.day)

                    let patternText = '설정 없음'
                    if (activeSchedules.length > 0) {
                      const timeGroups = new Map<string, number[]>()
                      activeSchedules.forEach((s: any) => {
                        const timeKey = `${s.start_time}-${s.end_time}`
                        const days = timeGroups.get(timeKey) || []
                        days.push(s.day)
                        timeGroups.set(timeKey, days)
                      })
                      const parts: string[] = []
                      const dayNames = ['일','월','화','수','목','금','토']
                      timeGroups.forEach((days, timeKey) => {
                        const [start, end] = timeKey.split('-')
                        const dayStr = days.map(d => dayNames[d]).join(',')
                        const formatTime = (t: string) => t.substring(0, 5)
                        parts.push(`${dayStr} ${formatTime(start)}~${formatTime(end)}`)
                      })
                      patternText = parts.join(' / ')
                    }

                    return (
                      <label 
                        key={staff.id} 
                        className={cn(
                          "flex items-start gap-3 p-3 cursor-pointer hover:bg-[#f3f2ef] transition-colors",
                          idx !== staffList.length - 1 && "border-b border-black/5"
                        )}
                      >
                        <Checkbox 
                          id={`staff-${staff.id}`}
                          checked={selectedStaffIds.includes(staff.id)}
                          onCheckedChange={(checked) => handleStaffToggle(staff.id, checked as boolean)}
                          className="mt-0.5"
                        />
                        <div className="flex flex-col gap-0.5 w-full">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-[#1a1a1a]">
                              {staff.profile?.full_name || staff.name || '이름 없음'}
                            </span>
                            <span className="text-[10px] bg-[#f0f0f0] text-[#6b6b6b] px-1.5 py-0.5 rounded">
                              {staff.role_info?.name || staff.role}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#6b6b6b] mt-0.5">
                            {patternText}
                          </p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-black/10 bg-[#fbfbfb] flex justify-end gap-2">
          <button 
            className="px-4 py-2 text-[12px] font-medium border border-black/10 rounded-md hover:bg-black/5 transition-colors" 
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            취소
          </button>
          <button 
            className="px-5 py-2 text-[12px] font-medium bg-[#1D9E75] text-white rounded-md hover:bg-[#168560] transition-colors shadow-sm flex items-center gap-1.5"
            onClick={handleSubmit} 
            disabled={loading} 
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            일괄 생성하기
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}