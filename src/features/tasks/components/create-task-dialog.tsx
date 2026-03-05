'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { createTask } from '../actions'
import { toast } from 'sonner'
import { TaskForm, TaskFormData } from './task-form'
import { RepeatConfig } from '../actions'

interface CreateTaskDialogProps {
  storeId: string
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  initialValues?: Partial<TaskFormData>
}

export function CreateTaskDialog({ 
  storeId, 
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  initialValues
}: CreateTaskDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen
  const setOpen = isControlled ? setControlledOpen! : setUncontrolledOpen

  const handleSubmit = async (data: TaskFormData) => {
    setLoading(true)
    try {
      let start_time_iso = null;
      let end_time_iso = null;
      let repeat_config: RepeatConfig | undefined = undefined;

      if (data.task_type === 'scheduled') {
          // 시간 필수
          if (!data.start_time || !data.end_time) {
              toast.error('시간을 입력해주세요.');
              setLoading(false);
              return;
          }
          
          // 날짜 + 시간 -> ISO String (UTC)
          // start_date를 기준으로 시간 생성
          const baseDate = data.start_date; // YYYY-MM-DD
          start_time_iso = new Date(`${baseDate}T${data.start_time}`).toISOString();
          end_time_iso = new Date(`${baseDate}T${data.end_time}`).toISOString();
          
          // 반복 설정
          if (data.is_recurring) {
              repeat_config = {
                  type: data.repeat_type,
                  interval: data.repeat_interval,
                  days: data.repeat_type === 'weekly' ? data.repeat_days : undefined,
                  start_date: data.start_date,
                  end_date: data.end_date,
              };
          }
      } else if (data.task_type === 'always') {
          // 상시 업무는 시간 없음 -> start_time_iso = null
          // 하지만 반복 생성 로직을 위해 repeat_config 필요 (매일 생성)
          repeat_config = {
              type: 'daily',
              interval: 1,
              start_date: data.start_date,
              end_date: data.end_date,
          };
      }

      const result = await createTask({
        store_id: storeId,
        title: data.title,
        description: data.description,
        is_critical: data.is_critical,
        estimated_minutes: data.estimated_minutes,
        task_type: data.task_type,
        start_time: start_time_iso || null,
        end_time: end_time_iso || null,
        repeat_config: repeat_config,
        assigned_role_ids: data.assigned_role_ids || ['all'],
        checklist: data.checklist
      })

      if (result?.error) {
        toast.error('업무 생성 실패', { description: result.error as string })
      } else {
        toast.success('업무가 생성되었습니다.')
        setOpen(false)
      }
    } catch (error) {
      toast.error('오류가 발생했습니다.')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== null && (
        <DialogTrigger asChild>
          {trigger || (
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              새 업무 등록
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-4xl h-[85vh] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>새 업무 등록</DialogTitle>
          <DialogDescription>
            매장에서 수행할 새로운 업무를 등록합니다.
          </DialogDescription>
        </DialogHeader>
        
        <TaskForm 
            storeId={storeId}
            defaultValues={initialValues}
            onSubmit={handleSubmit}
            onCancel={() => setOpen(false)}
            loading={loading}
            submitLabel="업무 등록"
        />
      </DialogContent>
    </Dialog>
  )
}