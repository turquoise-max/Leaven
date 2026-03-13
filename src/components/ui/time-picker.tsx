'use client'

import * as React from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface TimePickerProps {
  value: string // "HH:mm" in 24h format
  onChange: (value: string) => void
  disabled?: boolean
  name?: string
  id?: string
  className?: string
}

export function TimePicker({ value, onChange, disabled, name, id, className }: TimePickerProps) {
  const [hourStr, minStr] = (value || '09:00').split(':')
  const hour24 = parseInt(hourStr || '09', 10)
  const min = parseInt(minStr || '00', 10)

  const handleHourChange = (newHourStr: string) => {
    onChange(`${newHourStr.padStart(2, '0')}:${String(min).padStart(2, '0')}`)
  }

  const handleMinChange = (newMinStr: string) => {
    onChange(`${String(hour24).padStart(2, '0')}:${newMinStr}`)
  }

  return (
    <div className={`flex items-center gap-1.5 ${className || ''}`}>
      {name && <input type="hidden" name={name} value={value} id={id} />}

      <Select value={String(hour24)} onValueChange={handleHourChange} disabled={disabled}>
        <SelectTrigger className="w-[72px] h-9 px-2.5 text-xs font-medium focus:ring-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-[250px]">
          {Array.from({ length: 24 }, (_, i) => i).map((h) => (
            <SelectItem key={h} value={String(h)}>
              {String(h).padStart(2, '0')}시
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="text-muted-foreground/60 font-medium">:</span>

      <Select value={String(min).padStart(2, '0')} onValueChange={handleMinChange} disabled={disabled}>
        <SelectTrigger className="w-[72px] h-9 px-2.5 text-xs font-medium focus:ring-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-[250px]">
          {Array.from({ length: 6 }, (_, i) => i * 10).map((m) => {
            const mStr = String(m).padStart(2, '0')
            return (
              <SelectItem key={mStr} value={mStr}>
                {mStr}분
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    </div>
  )
}
