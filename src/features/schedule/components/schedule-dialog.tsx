'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createSchedule, deleteSchedule, updateSchedule } from '../actions'
import { toast } from 'sonner'
import { useState, useEffect } from 'react'

interface ScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  selectedDate: string | null // YYYY-MM-DD
  selectedEvent: any | null
  staffList: any[]
  storeId: string
  initialStartTime?: string
  initialEndTime?: string
}

export function ScheduleDialog({
  open,
  onOpenChange,
  mode,
  selectedDate,
  selectedEvent,
  staffList,
  storeId,
  initialStartTime,
  initialEndTime,
}: ScheduleDialogProps) {
  const [loading, setLoading] = useState(false)
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('18:00')
  const [userId, setUserId] = useState('')

  useEffect(() => {
    if (open) {
      if (mode === 'create' && selectedDate) {
        // 날짜만 추출 (YYYY-MM-DD)
        setDate(selectedDate.split('T')[0])
        setStartTime(initialStartTime || '09:00')
        setEndTime(initialEndTime || '18:00')
        setUserId('')
      } else if (mode === 'edit' && selectedEvent) {
        // ISO string에서 날짜와 시간 추출
        const start = new Date(selectedEvent.start)
        const end = new Date(selectedEvent.end)
        
        setDate(start.toISOString().split('T')[0])
        setStartTime(start.toTimeString().substring(0, 5))
        setEndTime(end.toTimeString().substring(0, 5))
        setUserId(selectedEvent.extendedProps.userId)
      }
    }
  }, [open, mode, selectedDate, selectedEvent, initialStartTime, initialEndTime])

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    let result
    
    if (mode === 'create') {
      result = await createSchedule(storeId, formData)
    } else {
      result = await updateSchedule(storeId, selectedEvent.id, formData)
    }
    
    setLoading(false)

    if (result.error) {
      toast.error(mode === 'create' ? '스케줄 생성 실패' : '스케줄 수정 실패', { description: result.error })
    } else {
      toast.success(mode === 'create' ? '스케줄 생성 완료' : '스케줄 수정 완료')
      onOpenChange(false)
    }
  }

  async function handleDelete() {
    if (!selectedEvent) return
    if (!confirm('정말 삭제하시겠습니까?')) return

    setLoading(true)
    const result = await deleteSchedule(storeId, selectedEvent.id)
    setLoading(false)

    if (result.error) {
      toast.error('삭제 실패', { description: result.error })
    } else {
      toast.success('삭제 완료')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-106.25">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '근무 일정 추가' : '근무 일정 수정'}</DialogTitle>
          <DialogDescription>
            {mode === 'create' 
              ? '새로운 근무 일정을 등록합니다.' 
              : '등록된 근무 일정을 수정하거나 삭제합니다.'}
          </DialogDescription>
        </DialogHeader>
        
        <form action={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* 직원 선택 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="userId" className="text-right">
                직원
              </Label>
              <div className="col-span-3">
                <Select 
                  name="userId" 
                  value={userId} 
                  onValueChange={setUserId} 
                >
                  <SelectTrigger>
                    <SelectValue placeholder="직원 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {staffList.map((staff) => (
                      <SelectItem key={staff.user_id} value={staff.user_id}>
                        {staff.profile?.full_name || staff.profile?.email} ({staff.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="userId" value={userId} />
              </div>
            </div>

            {/* 날짜 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="date" className="text-right">
                날짜
              </Label>
              <Input
                id="date"
                name="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="col-span-3"
                required
              />
            </div>

            {/* 시간 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="startTime" className="text-right">
                시간
              </Label>
              <div className="col-span-3 flex items-center gap-2">
                <Input
                  id="startTime"
                  name="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
                <span>~</span>
                <Input
                  id="endTime"
                  name="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* 메모 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="memo" className="text-right">
                메모
              </Label>
              <Textarea
                id="memo"
                name="memo"
                placeholder="특이사항 입력"
                className="col-span-3"
                defaultValue={selectedEvent?.extendedProps?.memo || ''}
              />
            </div>
          </div>

          <DialogFooter className="flex justify-between sm:justify-between">
            {mode === 'edit' && (
              <Button 
                type="button" 
                variant="destructive" 
                onClick={handleDelete}
                disabled={loading}
              >
                삭제
              </Button>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button type="submit" disabled={loading}>
                {mode === 'create' ? '등록' : '수정'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}