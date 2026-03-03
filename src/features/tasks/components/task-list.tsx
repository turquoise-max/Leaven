'use client'

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MoreHorizontal, Pencil, Trash2, Clock, AlertTriangle } from 'lucide-react'
import { Task, deleteTask } from '../actions'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface TaskListProps {
  tasks: Task[]
}

export function TaskList({ tasks }: TaskListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!deleteId) return

    setIsDeleting(true)
    try {
      const result = await deleteTask(deleteId)
      if (result?.error) {
        toast.error('삭제 실패', { description: result.error })
      } else {
        toast.success('업무가 삭제되었습니다.')
      }
    } catch (error) {
      toast.error('오류가 발생했습니다.')
    } finally {
      setIsDeleting(false)
      setDeleteId(null)
    }
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-lg bg-muted/50">
        <p className="text-muted-foreground text-sm">등록된 업무가 없습니다.</p>
        <p className="text-muted-foreground text-xs mt-1">새로운 업무를 추가해보세요.</p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">업무명</TableHead>
              <TableHead>중요도</TableHead>
              <TableHead>예상 소요 시간</TableHead>
              <TableHead className="text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => (
              <TableRow key={task.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{task.title}</span>
                    {task.description && (
                      <span className="text-xs text-muted-foreground truncate max-w-[250px]">
                        {task.description}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {task.is_critical && (
                    <Badge variant="destructive" className="flex w-fit items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Critical
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-muted-foreground text-sm">
                    <Clock className="w-3 h-3" />
                    {task.estimated_minutes}분
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="w-4 h-4" />
                        <span className="sr-only">메뉴 열기</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem disabled>
                        <Pencil className="w-4 h-4 mr-2" />
                        수정 (준비중)
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-red-600 focus:text-red-600"
                        onClick={() => setDeleteId(task.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        삭제
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>업무를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              이 작업은 되돌릴 수 없습니다. 업무 리스트에서 영구적으로 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              className="bg-red-600 hover:bg-red-700"
              disabled={isDeleting}
            >
              {isDeleting ? '삭제 중...' : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}