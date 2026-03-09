'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { TaskForm, TaskFormData } from './task-form'
import { createTask } from '../actions'
import { toast } from 'sonner'
import { getTodayDateString, toUTCISOString } from '@/lib/date-utils'

interface CreateTaskTemplateDialogProps {
  storeId: string
}

export function CreateTaskTemplateDialog({ storeId }: CreateTaskTemplateDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (data: TaskFormData) => {
    setLoading(true)
    try {
      // 템플릿은 특정 날짜의 개념이 없으므로 임의의 기준일(오늘)을 사용하거나 null 처리를 합니다.
      // start_time / end_time 은 HH:mm 이므로 KST 기준으로 적당한 날짜와 조합하여 UTC 변환할 수 있도록 합니다.
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

      const result = await createTask({
        store_id: storeId,
        title: data.title,
        description: data.description,
        is_critical: data.is_critical,
        estimated_minutes: data.estimated_minutes,
        task_type: data.task_type,
        start_time: start_time,
        end_time: end_time,
        assigned_role_ids: data.assigned_role_ids,
        checklist: data.checklist,
        is_template: true,
        recurrence_rule: recurrence_rule
      })

      if (result?.error) {
        toast.error('오류 발생', { description: result.error as string })
      } else {
        toast.success('업무 템플릿이 생성되었습니다.')
        setOpen(false)
      }
    } catch (error) {
      console.error(error)
      toast.error('템플릿 생성 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          새 템플릿 추가
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl h-[85vh] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>새 업무 템플릿 추가</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          <TaskForm 
            storeId={storeId}
            onSubmit={handleSubmit}
            onCancel={() => setOpen(false)}
            loading={loading}
            isTemplateMode={true}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}