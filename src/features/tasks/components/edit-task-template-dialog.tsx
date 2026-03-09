'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TaskForm, TaskFormData } from './task-form'
import { updateTask, Task } from '../actions'
import { toast } from 'sonner'
import { toKSTISOString, getTodayDateString, toUTCISOString } from '@/lib/date-utils'

interface EditTaskTemplateDialogProps {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  storeId: string
}

export function EditTaskTemplateDialog({ task, open, onOpenChange, storeId }: EditTaskTemplateDialogProps) {
  const [loading, setLoading] = useState(false)
  const [defaultValues, setDefaultValues] = useState<Partial<TaskFormData> | undefined>()

  useEffect(() => {
    if (task && open) {
      // 시간 추출
      const startTimeStr = task.start_time ? toKSTISOString(task.start_time).substring(11, 16) : ''
      const endTimeStr = task.end_time ? toKSTISOString(task.end_time).substring(11, 16) : ''

      let repeat_type: 'weekly' | 'monthly' = 'weekly'
      let repeat_days = [0, 1, 2, 3, 4, 5, 6]
      let is_last_day = false
      let start_date = getTodayDateString() // 임의의 오늘 날짜

      if (task.recurrence_rule) {
        if (task.recurrence_rule.date !== undefined || task.recurrence_rule.is_last_day !== undefined) {
          repeat_type = 'monthly'
          is_last_day = task.recurrence_rule.is_last_day === true
          if (task.recurrence_rule.date) {
            const [y, m] = start_date.split('-')
            start_date = `${y}-${m}-${String(task.recurrence_rule.date).padStart(2, '0')}`
          }
        } else if (task.recurrence_rule.days) {
          repeat_type = 'weekly'
          repeat_days = task.recurrence_rule.days
        }
      } else {
        // null인 경우 기본적으로 weekly, 모든 요일로 처리 (구버전 호환)
        repeat_type = 'weekly'
        repeat_days = [0, 1, 2, 3, 4, 5, 6]
      }

      setDefaultValues({
        title: task.title,
        description: task.description || '',
        is_critical: task.is_critical,
        estimated_minutes: task.estimated_minutes,
        task_type: task.task_type,
        is_recurring: true, // 템플릿은 항상 true 취급
        start_date: start_date, 
        end_date: start_date,
        start_time: startTimeStr,
        end_time: endTimeStr,
        assigned_role_ids: task.assigned_role_ids || [],
        checklist: task.checklist || [],
        repeat_type: repeat_type,
        repeat_days: repeat_days,
        is_last_day: is_last_day,
        repeat_interval: 1,
      })
    }
  }, [task, open])

  const handleSubmit = async (data: TaskFormData) => {
    if (!task) return

    setLoading(true)
    try {
      const today = getTodayDateString()
      let start_time = null
      let end_time = null

      if (data.task_type === 'scheduled' && data.start_time && data.end_time) {
         start_time = toUTCISOString(today, data.start_time)
         end_time = toUTCISOString(today, data.end_time)
      } else if (data.task_type === 'always') {
         start_time = null
         end_time = null
      }

      let recurrence_rule = null;
      if (data.task_type === 'always' || data.repeat_type === 'weekly') {
        recurrence_rule = data.repeat_days.length > 0 ? { days: data.repeat_days } : null;
      } else if (data.repeat_type === 'monthly') {
        recurrence_rule = {
          date: data.is_last_day ? null : parseInt(data.start_date.split('-')[2], 10),
          is_last_day: data.is_last_day
        };
      }

      const result = await updateTask({
        id: task.id,
        title: data.title,
        description: data.description,
        is_critical: data.is_critical,
        estimated_minutes: data.estimated_minutes,
        task_type: data.task_type,
        start_time: start_time,
        end_time: end_time,
        assigned_role_ids: data.assigned_role_ids,
        checklist: data.checklist,
        recurrence_rule: recurrence_rule
      })

      if (result?.error) {
        toast.error('오류 발생', { description: result.error as string })
      } else {
        toast.success('업무 템플릿이 수정되었습니다.')
        onOpenChange(false)
      }
    } catch (error) {
      console.error(error)
      toast.error('템플릿 수정 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl h-[85vh] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>업무 템플릿 수정</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          {defaultValues && (
            <TaskForm 
              storeId={storeId}
              defaultValues={defaultValues}
              onSubmit={handleSubmit}
              onCancel={() => onOpenChange(false)}
              loading={loading}
              isEditMode={true}
              isTemplateMode={true}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}