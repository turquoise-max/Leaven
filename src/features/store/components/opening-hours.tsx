'use client'

import { useState, useEffect } from 'react'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp, Clock, Coffee, Store, CalendarOff } from 'lucide-react'
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

interface OpeningHoursMeta {
  public_holiday_closed?: boolean
  global_break_time?: {
    enabled: boolean
    start: string
    end: string
  }
}

interface OpeningHoursProps {
  initialData: Record<string, any> // Includes days and 'meta'
  onChange: (data: Record<string, any>) => void
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
  const [hours, setHours] = useState<Record<string, any>>(initialData || {})
  const [expandedDay, setExpandedDay] = useState<string | null>(null)

  // 추출된 메타 정보
  const meta: OpeningHoursMeta = hours.meta || {
    public_holiday_closed: false,
    global_break_time: { enabled: false, start: '15:00', end: '17:00' }
  }

  useEffect(() => {
    // 초기 데이터 로드 시 start_time/end_time이 없으면 open/close 값으로 채움 (마이그레이션)
    const migratedData = { ...initialData }
    let changed = false
    
    Object.keys(migratedData).forEach(key => {
      if (key === 'meta') return
      
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

  const handleMetaChange = (field: keyof OpeningHoursMeta, value: any) => {
    const newMeta = { ...meta, [field]: value }
    const newData: Record<string, any> = { ...hours, meta: newMeta }
    
    // 만약 글로벌 브레이크 타임을 켰다면 개별 요일의 브레이크타임을 지워주는 정리 로직 (선택적)
    if (field === 'global_break_time' && value.enabled) {
      DAYS.forEach(({ key }) => {
        if (newData[key]) {
          delete newData[key].break_start
          delete newData[key].break_end
        }
      })
    }

    setHours(newData)
    onChange(newData)
  }

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
    <div className="space-y-6">
      {/* 글로벌 설정 영역 (상단) */}
      <div className="flex flex-col gap-4 p-4 border rounded-xl bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 text-red-600 rounded-lg dark:bg-red-900/30 dark:text-red-400">
              <CalendarOff className="w-4 h-4" />
            </div>
            <div>
              <Label htmlFor="public-holiday" className="text-base font-semibold">법정 공휴일 휴무</Label>
              <p className="text-xs text-muted-foreground mt-0.5">대체공휴일 및 법정 공휴일에 자동으로 휴무 처리됩니다.</p>
            </div>
          </div>
          <Switch 
            id="public-holiday" 
            checked={!!meta.public_holiday_closed}
            onCheckedChange={(checked) => handleMetaChange('public_holiday_closed', checked)}
          />
        </div>

        <div className="h-px bg-border/50" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400">
              <Coffee className="w-4 h-4" />
            </div>
            <div>
              <Label htmlFor="global-break" className="text-base font-semibold">공통 브레이크 타임 설정</Label>
              <p className="text-xs text-muted-foreground mt-0.5">매일 동일한 브레이크 타임을 적용합니다.</p>
            </div>
          </div>
          <Switch 
            id="global-break" 
            checked={!!meta.global_break_time?.enabled}
            onCheckedChange={(checked) => handleMetaChange('global_break_time', { ...meta.global_break_time, enabled: checked })}
          />
        </div>

        {meta.global_break_time?.enabled && (
          <div className="flex items-center gap-3 ml-[52px] mt-1 p-3 bg-background border rounded-lg animate-in fade-in slide-in-from-top-2">
            <span className="text-sm font-medium text-muted-foreground">브레이크 타임:</span>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={meta.global_break_time.start}
                onChange={(e) => handleMetaChange('global_break_time', { ...meta.global_break_time, start: e.target.value })}
                className="w-32 h-9 bg-muted/50"
              />
              <span className="text-muted-foreground">~</span>
              <Input
                type="time"
                value={meta.global_break_time.end}
                onChange={(e) => handleMetaChange('global_break_time', { ...meta.global_break_time, end: e.target.value })}
                className="w-32 h-9 bg-muted/50"
              />
            </div>
          </div>
        )}
      </div>

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
                    {meta.global_break_time?.enabled ? (
                      <div className="px-3 py-1.5 bg-muted/50 rounded-md text-sm text-muted-foreground font-medium flex items-center gap-2 border">
                        <span>전체 공통 설정 적용 중</span>
                        <span className="text-foreground bg-background px-2 py-0.5 rounded shadow-sm text-xs">
                          {meta.global_break_time.start} ~ {meta.global_break_time.end}
                        </span>
                      </div>
                    ) : dayData.break_start ? (
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
                        + 개별 브레이크 타임 추가
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
    </div>
  )
}
