'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RoleTaskForm, RoleTaskFormData } from './role-task-form'
import { updateTask, deleteTask } from '../task-actions'
import { toast } from 'sonner'
import { getTodayDateString, toUTCISOString, toKSTISOString } from '@/shared/lib/date-utils'

interface EditRoleTaskDialogProps {
  storeId: string
  task: any // The existing task template
  open: boolean
  onOpenChange: (open: boolean) => void
  hideRoleSelection?: boolean
  hideEndTime?: boolean
  hideTaskType?: boolean
}

export function EditRoleTaskDialog({ storeId, task, open, onOpenChange, hideRoleSelection = false, hideEndTime = false, hideTaskType = false }: EditRoleTaskDialogProps) {
  const [loading, setLoading] = useState(false)

  if (!task) return null

  const defaultValues: Partial<RoleTaskFormData> = {
    title: task.title,
    description: task.description || '',
    is_critical: task.is_critical || false,
    task_type: task.task_type || 'scheduled',
    start_time: task.start_time ? toKSTISOString(task.start_time).split('T')[1]?.substring(0, 5) : '09:00',
    end_time: task.end_time ? toKSTISOString(task.end_time).split('T')[1]?.substring(0, 5) : '18:00',
    assigned_role_ids: task.assigned_role_ids || ['all'],
    checklist: task.checklist || []
  }

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

      const result = await updateTask({
        id: task.id,
        title: data.title,
        description: data.description,
        is_critical: data.is_critical,
        task_type: data.task_type,
        start_time: start_time,
        end_time: end_time,
        assigned_role_ids: data.assigned_role_ids,
        checklist: data.checklist,
      })

      if (result?.error) {
        toast.error('오류 발생', { description: result.error as string })
      } else {
        toast.success('루틴 업무가 수정되었습니다.')
        onOpenChange(false)
      }
    } catch (error: any) {
      console.error(error)
      toast.error('루틴 업무 수정 중 오류가 발생했습니다.', { description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('이 루틴 업무를 삭제하시겠습니까?')) return
    
    setLoading(true)
    try {
      const result = await deleteTask(task.id)
      if (result?.error) {
        toast.error('오류 발생', { description: result.error as string })
      } else {
        toast.success('루틴 업무가 삭제되었습니다.')
        onOpenChange(false)
      }
    } catch (error: any) {
      console.error(error)
      toast.error('삭제 중 오류가 발생했습니다.', { description: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl h-auto max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl shadow-2xl border-none">
        <DialogHeader className="p-8 pb-6 bg-gradient-to-r from-primary/5 to-transparent">
          <DialogTitle className="text-2xl font-bold tracking-tight text-foreground">루틴 업무 수정</DialogTitle>
          <p className="text-[14px] text-muted-foreground mt-1.5">선택한 루틴 업무의 내용을 수정하거나 삭제할 수 있습니다.</p>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          <RoleTaskForm 
            storeId={storeId}
            defaultValues={defaultValues}
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
            loading={loading}
            submitLabel="수정사항 저장"
            showDelete={true}
            onDelete={handleDelete}
            hideRoleSelection={hideRoleSelection}
            hideEndTime={hideEndTime}
            hideTaskType={hideTaskType}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}