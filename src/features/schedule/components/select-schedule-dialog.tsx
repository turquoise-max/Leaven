'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

interface SelectScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  schedules: any[]
  onSelect: (schedule: any) => void
}

export function SelectScheduleDialog({
  open,
  onOpenChange,
  schedules,
  onSelect,
}: SelectScheduleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>수정할 스케줄 선택</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[300px] mt-2">
          <div className="space-y-2 p-1">
            {schedules.map((schedule) => (
              <div
                key={schedule.id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted cursor-pointer transition-colors"
                onClick={() => {
                  onSelect(schedule)
                  onOpenChange(false)
                }}
              >
                <div className="flex flex-col">
                  <span className="font-medium">{schedule.userName}</span>
                  <span className="text-xs text-muted-foreground">{schedule.title || '근무'}</span>
                </div>
                <Badge 
                  variant="outline" 
                  style={{ 
                    borderColor: schedule.roleColor, 
                    color: schedule.roleColor,
                    backgroundColor: `${schedule.roleColor}10`
                  }}
                >
                  {schedule.roleName}
                </Badge>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}