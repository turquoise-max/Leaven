'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Task, updateTask, deleteTask } from '../actions'
import { toast } from 'sonner'
import { TaskForm, TaskFormData } from './task-form'
import { toKSTISOString, toUTCISOString } from '@/lib/date-utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface EditTaskDialogProps {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  storeId: string
}

export function EditTaskDialog({ task, open, onOpenChange, storeId }: EditTaskDialogProps) {
  const [loading, setLoading] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  // Task -> TaskFormData 변환
  const getDefaultValues = (task: Task): Partial<TaskFormData> => {
    // timestamptz -> KST date/time string 변환
    let start_date = '';
    let start_time = '';
    let end_time = '';

    if (task.start_time) {
        const kstIso = toKSTISOString(task.start_time); // YYYY-MM-DDTHH:mm:ss
        if (kstIso) {
            start_date = kstIso.split('T')[0];
            start_time = kstIso.split('T')[1].substring(0, 5);
        }
    }
    
    if (task.end_time) {
        const kstIso = toKSTISOString(task.end_time);
        if (kstIso) {
            end_time = kstIso.split('T')[1].substring(0, 5);
        }
    }

    return {
      title: task.title,
      description: task.description || '',
      is_critical: task.is_critical,
      estimated_minutes: task.estimated_minutes,
      task_type: task.task_type,
      assigned_role_ids: task.assigned_role_ids || (task.assigned_role_id ? [task.assigned_role_id] : ['all']),
      checklist: task.checklist || [],
      status: task.status,
      // Date & Time
      start_date,
      start_time,
      end_time,
      is_recurring: false // 수정 시에는 반복 설정 불가 (개별 수정만 가능)
    }
  }

  const handleSubmit = async (data: TaskFormData) => {
    if (!task) return

    setLoading(true)
    try {
      let start_time_iso = null;
      let end_time_iso = null;

      if (data.task_type === 'scheduled') {
          // 시간 필수
          if (!data.start_time || !data.end_time) {
              toast.error('시간을 입력해주세요.');
              setLoading(false);
              return;
          }
          
          // 날짜 + 시간 -> ISO String (UTC)
          start_time_iso = toUTCISOString(data.start_date, data.start_time);
          end_time_iso = toUTCISOString(data.start_date, data.end_time);
      } else if (data.task_type === 'always') {
          // 상시 업무 -> 날짜만 업데이트
          // 상시 업무의 시간은 00:00~23:59 (KST)로 간주하고 UTC로 변환하거나,
          // 그냥 날짜 정보만 담아서 저장.
          // DB에는 timestamptz로 저장되므로, KST 00:00에 해당하는 UTC 시간을 저장하는 것이 일관성 있음.
          // toUTCISOString('2024-03-05', '00:00') -> UTC 15:00 (전날)
          
          start_time_iso = toUTCISOString(data.start_date, '00:00');
          // end_time은 23:59
          end_time_iso = toUTCISOString(data.start_date, '23:59');
      }

      const result = await updateTask({
        id: task.id,
        title: data.title,
        description: data.description,
        is_critical: data.is_critical,
        estimated_minutes: data.estimated_minutes,
        task_type: data.task_type,
        start_time: start_time_iso || null,
        end_time: end_time_iso || null,
        assigned_role_ids: data.assigned_role_ids || ['all'],
        checklist: data.checklist,
        status: data.status
      })

      if (result?.error) {
        toast.error('업무 수정 실패', { description: result.error as string })
      } else {
        toast.success('업무가 수정되었습니다.')
        onOpenChange(false)
      }
    } catch (error) {
      toast.error('오류가 발생했습니다.')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!task) return
    
    setLoading(true)
    try {
        const result = await deleteTask(task.id)
        if (result?.error) {
            toast.error('업무 삭제 실패', { description: result.error })
        } else {
            toast.success('업무가 삭제되었습니다.')
            setDeleteConfirmOpen(false)
            onOpenChange(false)
        }
    } catch (error) {
        toast.error('오류가 발생했습니다.')
        console.error(error)
    } finally {
        setLoading(false)
    }
  }

  return (
    <>
        <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl h-[85vh] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>업무 일정 수정</DialogTitle>
          <DialogDescription>
                등록된 업무 정보를 수정합니다.
            </DialogDescription>
            </DialogHeader>
            
            {task && (
                <TaskForm 
                    storeId={storeId}
                    defaultValues={getDefaultValues(task)}
        onSubmit={handleSubmit}
        onCancel={() => onOpenChange(false)}
        submitLabel="수정 저장"
        loading={loading}
        showDelete={true}
        onDelete={handleDelete}
        isEditMode={true}
      />
            )}
        </DialogContent>
        </Dialog>

        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>정말 삭제하시겠습니까?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="text-sm text-muted-foreground">
                            이 작업은 되돌릴 수 없습니다. 해당 업무와 관련된 모든 기록이 삭제될 수 있습니다.
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                        삭제
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  )
}