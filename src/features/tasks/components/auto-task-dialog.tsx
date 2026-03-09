'use client'

import { useState } from 'react'
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
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { generateTasksFromTemplates, deleteTasksByPeriod } from '../actions'
import { toast } from 'sonner'
import { DateRange } from 'react-day-picker'

interface AutoTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  storeId: string
}

export function AutoTaskDialog({ open, onOpenChange, storeId }: AutoTaskDialogProps) {
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'create' | 'delete'>('create')
  
  // Default: Next Week
  const today = new Date()
  const nextWeekStart = startOfWeek(addDays(today, 7), { weekStartsOn: 1 })
  const nextWeekEnd = endOfWeek(addDays(today, 7), { weekStartsOn: 1 })
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: nextWeekStart,
    to: nextWeekEnd,
  })

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

    setLoading(true)
    
    // Convert to YYYY-MM-DD (Local Time)
    const startDate = format(dateRange.from, 'yyyy-MM-dd')
    const endDate = format(dateRange.to, 'yyyy-MM-dd')
    
    let result;
    
    if (mode === 'create') {
        result = await generateTasksFromTemplates(storeId, startDate, endDate)
    } else {
        result = await deleteTasksByPeriod(storeId, startDate, endDate)
    }
    
    setLoading(false)

    if (result.error) {
      toast.error(mode === 'create' ? '업무 생성 실패' : '업무 삭제 실패', { 
          description: result.error 
      })
    } else {
      const count = result.count ?? 0
      toast.success(mode === 'create' ? '업무 생성 완료' : '업무 삭제 완료', { 
        description: `총 ${count}개의 업무가 캘린더에서 ${mode === 'create' ? '생성' : '삭제'}되었습니다.` 
      })
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-primary" />
            업무 자동 관리
          </DialogTitle>
          <DialogDescription>
            반복 업무를 기간에 맞춰 일괄 생성하거나 삭제합니다.
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
                    <p>'업무 템플릿'의 반복 규칙에 따라 캘린더에 업무를 생성합니다. <br/>이미 같은 내용이 있는 날짜는 건너뜁니다.</p>
                ) : (
                    <p className="text-destructive">선택한 기간 캘린더에 생성된 모든 업무를 지웁니다. <br/>(단, 원본 템플릿은 삭제되지 않습니다.)</p>
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
