'use client'

import { useState, useEffect } from 'react'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface OpeningHoursData {
  open: string
  close: string
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

  useEffect(() => {
    setHours(initialData || {})
  }, [initialData])

  const handleToggle = (day: string) => {
    const newData = {
      ...hours,
      [day]: {
        ...hours[day],
        closed: !hours[day]?.closed,
        open: hours[day]?.open || '09:00',
        close: hours[day]?.close || '22:00',
      }
    }
    setHours(newData)
    onChange(newData)
  }

  const handleTimeChange = (day: string, field: 'open' | 'close', value: string) => {
    const newData = {
      ...hours,
      [day]: {
        ...hours[day],
        [field]: value,
        closed: hours[day]?.closed || false,
      }
    }
    setHours(newData)
    onChange(newData)
  }

  return (
    <div className="space-y-4">
      {DAYS.map(({ key, label }) => {
        const dayData = hours[key] || { open: '09:00', close: '22:00', closed: false }
        
        return (
          <div key={key} className="flex items-center justify-between p-3 border rounded-lg bg-card">
            <div className="flex items-center gap-4">
              <Switch
                id={`closed-${key}`}
                checked={!dayData.closed}
                onCheckedChange={() => handleToggle(key)}
              />
              <Label htmlFor={`closed-${key}`} className="min-w-[50px]">
                {label}
              </Label>
              <span className={`text-sm ${dayData.closed ? 'text-muted-foreground' : 'text-primary font-medium'}`}>
                {dayData.closed ? '휴무' : '영업'}
              </span>
            </div>

            {!dayData.closed && (
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={dayData.open}
                  onChange={(e) => handleTimeChange(key, 'open', e.target.value)}
                  className="w-32"
                />
                <span>~</span>
                <Input
                  type="time"
                  value={dayData.close}
                  onChange={(e) => handleTimeChange(key, 'close', e.target.value)}
                  className="w-32"
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}