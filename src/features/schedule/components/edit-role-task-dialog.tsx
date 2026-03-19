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
import { getTodayDateString, toUTCISOString } from '@/lib/date-utils'

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
    start_time: task.start_time ? task.start_time.split('T')[1]?.substring(0, 5) : '09:00',
    end_time: task.end_time ? task.end_time.split('T')[1]?.substring(0, 5) : '18:00',
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
        toast.success('업무 템플릿이 수정되었습니다.')
        onOpenChange(false)
      }
    } catch (error) {
      console.error(error)
      toast.error('업무 템플릿 수정 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('이 업무 템플릿을 삭제하시겠습니까?')) return
    
    setLoading(true)
    try {
      const result = await deleteTask(task.id)
      if (result?.error) {
        toast.error('오류 발생', { description: result.error as string })
      } else {
        toast.success('업무 템플릿이 삭제되었습니다.')
        onOpenChange(false)
      }
    } catch (error) {
      console.error(error)
      toast.error('삭제 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl h-[85vh] max-h-[800px] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle>플레이북 가이드 수정</DialogTitle>
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