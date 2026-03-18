'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Clock } from 'lucide-react'

export interface TimePickerProps {
  value: string // "HH:mm" in 24h format
  onChange: (value: string) => void
  disabled?: boolean
  name?: string
  id?: string
  className?: string
}

export function TimePicker({ value, onChange, disabled, name, id, className }: TimePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const safeValue = value || '09:00'
  const [hour, min] = safeValue.split(':')
  
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
  // Use 10-minute intervals for minutes
  const minutes = Array.from({ length: 6 }, (_, i) => String(i * 10).padStart(2, '0'))

  // To auto-scroll to selected hour/min, we can use refs
  const hourContainerRef = React.useRef<HTMLDivElement>(null)
  const minContainerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (hourContainerRef.current) {
          const selectedHour = hourContainerRef.current.querySelector('[data-selected="true"]')
          if (selectedHour) {
            selectedHour.scrollIntoView({ block: 'center', behavior: 'instant' })
          }
        }
        if (minContainerRef.current) {
          const selectedMin = minContainerRef.current.querySelector('[data-selected="true"]')
          if (selectedMin) {
            selectedMin.scrollIntoView({ block: 'center', behavior: 'instant' })
          }
        }
      }, 10)
    }
  }, [isOpen])

  const handleHourClick = (h: string) => {
    onChange(`${h}:${min}`)
  }
  
  const handleMinClick = (m: string) => {
    onChange(`${hour}:${m}`)
    setIsOpen(false) // Close popover after complete selection
  }

  return (
    <div className={cn('relative inline-flex', className)}>
      {name && <input type="hidden" name={name} value={value} id={id} />}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={isOpen}
            disabled={disabled}
            className={cn(
              "w-full justify-between h-9 px-3 font-medium",
              !value && "text-muted-foreground"
            )}
          >
            <span className="text-[13px]">{safeValue}</span>
            <Clock className="ml-1.5 h-[14px] w-[14px] shrink-0 opacity-50 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 border shadow-md rounded-md overflow-hidden" align="start">
          <div className="flex h-[240px] divide-x bg-background">
            <ScrollArea className="w-[84px] bg-muted/20">
              <div ref={hourContainerRef} className="flex flex-col p-1 gap-1">
                {hours.map((h) => {
                  const isSelected = h === hour
                  return (
                    <Button
                      key={`h-${h}`}
                      variant={isSelected ? "default" : "ghost"}
                      size="sm"
                      data-selected={isSelected}
                      className={cn(
                        "justify-center text-xs h-8 rounded-sm",
                        isSelected ? "bg-primary text-primary-foreground font-bold shadow-sm" : "font-medium hover:bg-muted text-muted-foreground hover:text-foreground"
                      )}
                      onClick={() => handleHourClick(h)}
                    >
                      {h}시
                    </Button>
                  )
                })}
              </div>
            </ScrollArea>
            <ScrollArea className="w-[84px] bg-background">
              <div ref={minContainerRef} className="flex flex-col p-1 gap-1">
                {minutes.map((m) => {
                  const isSelected = m === min
                  return (
                    <Button
                      key={`m-${m}`}
                      variant={isSelected ? "default" : "ghost"}
                      size="sm"
                      data-selected={isSelected}
                      className={cn(
                        "justify-center text-xs h-8 rounded-sm",
                        isSelected ? "bg-primary text-primary-foreground font-bold shadow-sm" : "font-medium hover:bg-muted text-muted-foreground hover:text-foreground"
                      )}
                      onClick={() => handleMinClick(m)}
                    >
                      {m}분
                    </Button>
                  )
                })}
              </div>
            </ScrollArea>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}