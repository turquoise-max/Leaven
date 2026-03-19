'use client'

import React, { useState } from 'react'
import { format, addDays, startOfWeek, endOfWeek, addWeeks, startOfMonth, endOfMonth, addMonths } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Loader2, Calendar as CalendarIcon, Trash2 } from 'lucide-react'
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
import { deleteStaffSchedules } from '@/features/schedule/actions'
import { toast } from 'sonner'
import { DateRange } from 'react-day-picker'
import { useRouter } from 'next/navigation'

interface UnifiedBulkDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  storeId: string
  staffList: any[]
}

export function UnifiedBulkDeleteDialog({
  open,
  onOpenChange,
  storeId,
  staffList,
}: UnifiedBulkDeleteDialogProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  
  // 기본 선택 기간: 이번 주
  const today = new Date()
  const thisWeekStart = startOfWeek(today, { weekStartsOn: 1 })
  const thisWeekEnd = endOfWeek(today, { weekStartsOn: 1 })
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: thisWeekStart,
    to: thisWeekEnd,
  })
  
  // 기본적으로 선택 안함
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([])

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
    
    const startDate = format(dateRange.from, 'yyyy-MM-dd')
    const endDate = format(dateRange.to, 'yyyy-MM-dd')
    
    const result = await deleteStaffSchedules(
      storeId,
      startDate,
      endDate,
      selectedStaffIds
    )
    
    setLoading(false)

    if (result.error) {
      toast.error('스케줄 삭제 실패', { description: result.error })
    } else {
      const count = result.count ?? 0
      toast.success('스케줄 초기화 완료', { 
        description: `총 ${count}개의 스케줄이 삭제되었습니다.` 
      })
      onOpenChange(false)
      router.refresh()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-4 border-b border-black/10 bg-[#fff5f5]">
          <DialogTitle className="text-[16px] flex items-center gap-2 text-destructive">
            <Trash2 className="w-4 h-4" />
            스케줄 일괄 초기화
          </DialogTitle>
          <div className="text-[12px] text-destructive/80 mt-1.5 font-normal">
            선택한 기간 내, 지정한 직원의 <strong>모든 스케줄을 영구 삭제</strong>합니다. 이 작업은 되돌릴 수 없습니다.
          </div>
        </DialogHeader>

        <div className="p-5 flex flex-col gap-6">
          <div className="flex flex-col gap-2.5">
            <label className="text-[12px] font-semibold text-[#1a1a1a]">초기화 기간</label>
            
            <div className="flex gap-1.5 mb-1">
              <button 
                className="px-2.5 py-1 text-[11px] font-medium border border-black/10 rounded-md hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30 transition-colors" 
                onClick={() => setQuickDate('thisWeek')}
              >
                이번 주
              </button>
              <button 
                className="px-2.5 py-1 text-[11px] font-medium border border-black/10 rounded-md hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30 transition-colors" 
                onClick={() => setQuickDate('nextWeek')}
              >
                다음 주
              </button>
              <button 
                className="px-2.5 py-1 text-[11px] font-medium border border-black/10 rounded-md hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30 transition-colors" 
                onClick={() => setQuickDate('thisMonth')}
              >
                이번 달
              </button>
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal h-9 text-[12px] border-black/10 hover:bg-white",
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

          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-semibold text-[#1a1a1a]">초기화 대상 직원</label>
              <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => handleSelectAll(selectedStaffIds.length !== staffList.length)}>
                <Checkbox 
                  id="select-all-del" 
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
                  {staffList.map((staff, idx) => (
                    <label 
                      key={staff.id} 
                      className={cn(
                        "flex items-center gap-3 p-3 cursor-pointer hover:bg-destructive/5 transition-colors",
                        idx !== staffList.length - 1 && "border-b border-black/5"
                      )}
                    >
                      <Checkbox 
                        id={`staff-del-${staff.id}`}
                        checked={selectedStaffIds.includes(staff.id)}
                        onCheckedChange={(checked) => handleStaffToggle(staff.id, checked as boolean)}
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-[#1a1a1a]">
                          {staff.profile?.full_name || staff.name || '이름 없음'}
                        </span>
                        <span className="text-[10px] bg-[#f0f0f0] text-[#6b6b6b] px-1.5 py-0.5 rounded">
                          {staff.role_info?.name || staff.role}
                        </span>
                      </div>
                    </label>
                  ))}
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
            className="px-5 py-2 text-[12px] font-medium bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors shadow-sm flex items-center gap-1.5"
            onClick={handleSubmit} 
            disabled={loading} 
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            일괄 삭제하기
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}