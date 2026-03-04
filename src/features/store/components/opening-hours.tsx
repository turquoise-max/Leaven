'use client'

import { useState, useEffect } from 'react'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp, Clock, Coffee, Store } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OpeningHoursData {
  open: string // 영업 시작 (손님용)
  close: string // 영업 종료 (손님용)
  start_time?: string // 운영 시작 (직원용)
  end_time?: string // 운영 종료 (직원용)
  break_start?: string // 브레이크 시작
  break_end?: string // 브레이크 종료
  closed: boolean
}

interface OpeningHoursProps {
  initialData: Record<string, OpeningHoursData>
  onChange: (data: Record<string, OpeningHoursData>) => void
}

const DAYS = [
  { key: 'mon', label: '월요일' },
  { key: 'tue', label: '화요일' },
  { key: 'wed', label: '수요일' },
  { key: 'thu', label: '목요일' },
  { key: 'fri', label: '금요일' },
  { key: 'sat', label: '토요일' },
  { key: 'sun', label: '일요일' },
]

export function OpeningHours({ initialData, onChange }: OpeningHoursProps) {
  const [hours, setHours] = useState<Record<string, OpeningHoursData>>(initialData || {})
  const [expandedDay, setExpandedDay] = useState<string | null>(null)

  useEffect(() => {
    // 초기 데이터 로드 시 start_time/end_time이 없으면 open/close 값으로 채움 (마이그레이션)
    const migratedData = { ...initialData }
    let changed = false
    
    Object.keys(migratedData).forEach(key => {
      const dayData = migratedData[key]
      if (!dayData.start_time || !dayData.end_time) {
        migratedData[key] = {
          ...dayData,
          start_time: dayData.start_time || dayData.open || '09:00',
          end_time: dayData.end_time || dayData.close || '22:00'
        }
        changed = true
      }
    })
    
    setHours(migratedData)
    if (changed) onChange(migratedData)
  }, [initialData]) // onChange는 의존성 배열에서 제외 (무한 루프 방지)

  const handleToggle = (day: string) => {
    // hours[day]가 없으면 기본값(휴무 상태)으로 간주
    const currentDayData = hours[day] || { 
      open: '09:00', close: '22:00', 
      start_time: '09:00', end_time: '22:00',
      closed: true 
    }
    
    const newData = {
      ...hours,
      [day]: {
        ...currentDayData,
        closed: !currentDayData.closed,
        // 토글 시 값이 없으면 기본값 채워줌
        open: currentDayData.open || '09:00',
        close: currentDayData.close || '22:00',
        start_time: currentDayData.start_time || currentDayData.open || '09:00',
        end_time: currentDayData.end_time || currentDayData.close || '22:00',
      }
    }
    setHours(newData)
    onChange(newData)
    
    // 영업 상태로 변경 시 해당 요일 펼치기
    if (currentDayData.closed) {
      setExpandedDay(day)
    } else if (expandedDay === day) {
      setExpandedDay(null)
    }
  }

  const handleTimeChange = (day: string, field: keyof OpeningHoursData, value: string) => {
    // hours[day]가 없으면 기본값 사용 (영업 중 상태로 간주하여 수정 가능하게 함)
    const currentDayData = hours[day] || { 
      open: '09:00', close: '22:00', 
      start_time: '09:00', end_time: '22:00',
      closed: false 
    }

    const newData = {
      ...hours,
      [day]: {
        ...currentDayData,
        [field]: value,
        closed: currentDayData.closed,
      }
    }
    
    // 운영 시간 변경 시 영업 시간도 자동 변경 (영업 시간이 설정되지 않았거나 동일한 경우)
    if (field === 'start_time') {
      const currentOpen = currentDayData.open || '09:00'
      const currentStart = currentDayData.start_time || '09:00'
      if (currentOpen === currentStart) {
        newData[day].open = value
      }
    }
    if (field === 'end_time') {
      const currentClose = currentDayData.close || '22:00'
      const currentEnd = currentDayData.end_time || '22:00'
      if (currentClose === currentEnd) {
        newData[day].close = value
      }
    }

    setHours(newData)
    onChange(newData)
  }

  const toggleExpand = (day: string) => {
    setExpandedDay(expandedDay === day ? null : day)
  }

  return (
    <div className="space-y-4">
      {DAYS.map(({ key, label }) => {
        const dayData = hours[key] || { 
          open: '09:00', close: '22:00', 
          start_time: '09:00', end_time: '22:00', 
          closed: false 
        }
        const isExpanded = expandedDay === key && !dayData.closed

        return (
          <div key={key} className={cn(
            "border rounded-lg bg-card transition-all duration-200",
            isExpanded ? "ring-2 ring-primary/20" : ""
          )}>
            {/* Header / Summary Row */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <Switch
                  id={`closed-${key}`}
                  checked={!dayData.closed}
                  onCheckedChange={() => handleToggle(key)}
                />
                <Label htmlFor={`closed-${key}`} className="min-w-[50px] font-medium">
                  {label}
                </Label>
                <span className={cn(
                  "text-sm px-2 py-0.5 rounded-full",
                  dayData.closed ? "bg-muted text-muted-foreground" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                )}>
                  {dayData.closed ? '휴무' : '영업중'}
                </span>
              </div>

              {!dayData.closed && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center text-sm font-medium">
                    <Clock className="w-4 h-4 mr-1 text-muted-foreground" />
                    {dayData.start_time || dayData.open} ~ {dayData.end_time || dayData.close}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="ml-2 h-8 w-8 p-0"
                    onClick={() => toggleExpand(key)}
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              )}
            </div>

            {/* Expanded Details */}
            {isExpanded && (
              <div className="px-4 pb-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                <div className="h-px bg-border my-2" />
                
                {/* 1. 운영 시간 (직원 기준) */}
                <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                  <Label className="text-right text-muted-foreground flex items-center justify-end gap-1">
                    <Clock className="w-3 h-3" /> 매장 운영
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={dayData.start_time || dayData.open}
                      onChange={(e) => handleTimeChange(key, 'start_time', e.target.value)}
                      className="w-32 h-9"
                    />
                    <span className="text-muted-foreground">~</span>
                    <Input
                      type="time"
                      value={dayData.end_time || dayData.close}
                      onChange={(e) => handleTimeChange(key, 'end_time', e.target.value)}
                      className="w-32 h-9"
                    />
                    <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">
                      *직원 출근 및 마감 기준
                    </span>
                  </div>
                </div>

                {/* 2. 영업 시간 (손님 기준) */}
                <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                  <Label className="text-right text-muted-foreground flex items-center justify-end gap-1">
                    <Store className="w-3 h-3" /> 손님 영업
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={dayData.open}
                      onChange={(e) => handleTimeChange(key, 'open', e.target.value)}
                      className="w-32 h-9"
                    />
                    <span className="text-muted-foreground">~</span>
                    <Input
                      type="time"
                      value={dayData.close}
                      onChange={(e) => handleTimeChange(key, 'close', e.target.value)}
                      className="w-32 h-9"
                    />
                  </div>
                </div>

                {/* 3. 브레이크 타임 */}
                <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                  <Label className="text-right text-muted-foreground flex items-center justify-end gap-1">
                    <Coffee className="w-3 h-3" /> 브레이크
                  </Label>
                  <div className="flex items-center gap-2">
                    {dayData.break_start ? (
                      <>
                        <Input
                          type="time"
                          value={dayData.break_start}
                          onChange={(e) => handleTimeChange(key, 'break_start', e.target.value)}
                          className="w-32 h-9"
                        />
                        <span className="text-muted-foreground">~</span>
                        <Input
                          type="time"
                          value={dayData.break_end || ''}
                          onChange={(e) => handleTimeChange(key, 'break_end', e.target.value)}
                          className="w-32 h-9"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 h-8 hover:text-red-600 hover:bg-red-50 ml-2"
                          onClick={() => {
                            const newData = { ...hours }
                            delete newData[key].break_start
                            delete newData[key].break_end
                            setHours(newData)
                            onChange(newData)
                          }}
                        >
                          삭제
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 border-dashed text-muted-foreground hover:text-primary"
                        onClick={() => handleTimeChange(key, 'break_start', '15:00')}
                      >
                        + 브레이크 타임 추가
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
