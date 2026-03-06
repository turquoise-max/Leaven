'use client'

import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface CalendarHeaderProps {
  title: string
  view: string
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onViewChange: (view: string) => void
  children?: React.ReactNode
  className?: string
}

export function CalendarHeader({
  title,
  view,
  onPrev,
  onNext,
  onToday,
  onViewChange,
  children,
  className
}: CalendarHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between p-4 border-b bg-card", className)}>
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-md border bg-background shadow-sm">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-r-none border-r" 
            onClick={onPrev}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 rounded-none font-normal px-3 hover:bg-transparent"
            onClick={onToday}
          >
            오늘
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-l-none border-l" 
            onClick={onNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <h2 className="font-semibold text-lg ml-2 min-w-[140px]">{title}</h2>
      </div>

      <div className="flex items-center gap-2">
        {children}
        
        <div className="h-6 w-px bg-border mx-2" />
        
        <Select value={view} onValueChange={onViewChange}>
          <SelectTrigger className="w-[100px] h-8">
            <SelectValue placeholder="보기" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dayGridMonth">월간</SelectItem>
            <SelectItem value="timeGridWeek">주간</SelectItem>
            <SelectItem value="timeGridDay">일간</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}