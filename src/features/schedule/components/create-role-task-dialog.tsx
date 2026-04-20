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
import { RoleTaskForm, RoleTaskFormData } from './role-task-form'
import { createTask } from '../task-actions'
import { toast } from 'sonner'
import { getTodayDateString, toUTCISOString } from '@/shared/lib/date-utils'

interface CreateRoleTaskDialogProps {
  storeId: string
  initialRoleIds?: string[]
  trigger?: React.ReactNode
  hideRoleSelection?: boolean
  hideEndTime?: boolean
  hideTaskType?: boolean
}

export function CreateRoleTaskDialog({ storeId, initialRoleIds, trigger, hideRoleSelection = false, hideEndTime = false, hideTaskType = false }: CreateRoleTaskDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (data: RoleTaskFormData) => {
    setLoading(true)
    try {
      const today = getTodayDateString()
      let start_time = null
      let end_time = null

      if (data.task_type === 'scheduled' && data.start_time && data.end_time) {
         start_time = toUTCISOString(today, data.start_time)
         end_time = toUTCISOString(today, data.end_time)
      }

      const result = await createTask({
        store_id: storeId,
        title: data.title,
        description: data.description,
        is_critical: data.is_critical,
        task_type: data.task_type,
        start_time: start_time,
        end_time: end_time,
        assigned_role_ids: data.assigned_role_ids,
        checklist: data.checklist,
        is_template: true,
        is_routine: true
      })

      if (result?.error) {
        toast.error('오류 발생', { description: result.error as string })
      } else {
        toast.success('루틴 업무가 생성되었습니다.')
        setOpen(false)
      }
    } catch (error) {
      console.error(error)
      toast.error('루틴 업무 등록 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            루틴 추가
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl h-auto max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl shadow-2xl border-none">
        <DialogHeader className="p-8 pb-6 bg-gradient-to-r from-primary/5 to-transparent">
          <DialogTitle className="text-2xl font-bold tracking-tight text-foreground">새 루틴 업무 만들기</DialogTitle>
          <p className="text-[14px] text-muted-foreground mt-1.5">직급별로 매일 수행해야 할 주요 반복 업무를 등록해 주세요.</p>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          <RoleTaskForm 
            storeId={storeId}
            initialRoleIds={initialRoleIds}
            onSubmit={handleSubmit}
            onCancel={() => setOpen(false)}
            loading={loading}
            hideRoleSelection={hideRoleSelection}
            hideEndTime={hideEndTime}
            hideTaskType={hideTaskType}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}