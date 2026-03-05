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
import { MoreHorizontal, Pencil, Trash2, Clock, Calendar, Briefcase, AlertTriangle, Filter, Users } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from '@/components/ui/input'
import { EditTaskDialog } from './edit-task-dialog'

interface TaskListProps {
  tasks: Task[]
  roles: any[]
  storeId: string
}

export function TaskList({ tasks, roles, storeId }: TaskListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  
  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const handleDelete = async () => {
    if (!deleteId) return

    setIsDeleting(true)
    try {
      const result = await deleteTask(deleteId)
      if (result?.error) {
        toast.error('삭제 실패', { description: result.error as string })
      } else {
        toast.success('업무가 삭제되었습니다.')
        setDeleteId(null)
      }
    } catch (error) {
      toast.error('오류가 발생했습니다.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleEditClick = (task: Task) => {
      setEditingTask(task)
      setIsEditOpen(true)
  }

  // Helper to get role info
  const getRoleInfo = (roleId: string | null) => {
    if (!roleId) return null
    return roles.find(r => r.id === roleId)
  }

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    // Type Filter
    if (typeFilter !== 'all' && task.task_type !== typeFilter) return false
    
    // Role Filter
    if (roleFilter !== 'all') {
      const roleIds = task.assigned_role_ids || (task.assigned_role_id ? [task.assigned_role_id] : ['all'])
      
      if (roleFilter === 'unassigned') {
          // 'unassigned' means 'all' employees (no specific role)
          return roleIds.includes('all')
      } else {
          // Check if the filtered role is included in the task's assigned roles
          // If task is assigned to 'all', it should probably show up for any role filter? 
          // Or strictly match? Let's say if I filter for 'Barista', I want tasks assigned to Barista.
          // Tasks assigned to 'all' also apply to Barista, so maybe include them?
          // For now, let's stick to strict assignment filtering.
          return roleIds.includes(roleFilter)
      }
    }

    // Search Filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        task.title.toLowerCase().includes(query) ||
        (task.description?.toLowerCase().includes(query) || false)
      )
    }

    return true
  })

  // Sort tasks
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    // 1. Critical first
    if (a.is_critical !== b.is_critical) return a.is_critical ? -1 : 1
    
    // 2. Type order
    const typeOrder = { scheduled: 0, always: 1 }
    if (a.task_type !== b.task_type) {
      return (typeOrder[a.task_type] || 2) - (typeOrder[b.task_type] || 2)
    }

    // 3. Time order (for scheduled)
    if (a.task_type === 'scheduled' && a.start_time && b.start_time) {
      return a.start_time.localeCompare(b.start_time)
    }

    return 0
  })

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'scheduled': return <Clock className="w-4 h-4 text-blue-500" />
      case 'always': return <Briefcase className="w-4 h-4 text-orange-500" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  const getTypeName = (type: string) => {
    switch (type) {
      case 'scheduled': return '일반 업무'
      case 'always': return '상시 업무'
      default: return type
    }
  }

  const formatTime = (isoString: string | null) => {
      if (!isoString) return '-'
      return new Date(isoString).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (isoString: string | null) => {
      if (!isoString) return '-'
      return new Date(isoString).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="업무 유형" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">모든 유형</SelectItem>
              <SelectItem value="scheduled">일반 업무</SelectItem>
              <SelectItem value="always">상시 업무</SelectItem>
            </SelectContent>
          </Select>

          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="담당 역할" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">모든 역할</SelectItem>
              <SelectItem value="unassigned">공통 (미지정)</SelectItem>
              {roles.map(role => (
                <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="w-full sm:w-[200px]">
           <Input 
             placeholder="업무 검색..." 
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
           />
        </div>
      </div>

      {sortedTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-lg bg-muted/50">
          <p className="text-muted-foreground text-sm">조건에 맞는 업무가 없습니다.</p>
          {(typeFilter !== 'all' || roleFilter !== 'all' || searchQuery) && (
            <Button 
              variant="link" 
              onClick={() => {
                setTypeFilter('all')
                setRoleFilter('all')
                setSearchQuery('')
              }}
              className="mt-2"
            >
              필터 초기화
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead className="w-[250px]">업무명</TableHead>
                <TableHead>유형 / 시간</TableHead>
                <TableHead>날짜</TableHead>
                <TableHead>담당 역할</TableHead>
                <TableHead className="text-right">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTasks.map((task) => {
                const roleIds = task.assigned_role_ids || (task.assigned_role_id ? [task.assigned_role_id] : ['all'])
                const isAll = roleIds.includes('all') || roleIds.length === 0

                return (
                  <TableRow key={task.id}>
                    <TableCell>
                      <div className="flex items-center justify-center" title={getTypeName(task.task_type)}>
                        {getTypeIcon(task.task_type)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{task.title}</span>
                          {task.is_critical && (
                            <Badge variant="destructive" className="px-1 py-0 text-[10px] h-4">
                              중요
                            </Badge>
                          )}
                        </div>
                        {task.description && (
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {task.description}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-sm">
                        <span className="font-medium text-xs text-muted-foreground">
                          {getTypeName(task.task_type)}
                        </span>
                        {task.task_type === 'scheduled' && task.start_time && (
                          <span className="font-medium">
                            {formatTime(task.start_time)} ~ {formatTime(task.end_time)}
                          </span>
                        )}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <Clock className="w-3 h-3" />
                          {task.estimated_minutes}분
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                        <span className="text-sm">
                            {task.task_type === 'always' ? '매일' : formatDate(task.start_time)}
                        </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {isAll ? (
                            <Badge variant="secondary" className="text-muted-foreground">
                              <Users className="w-3 h-3 mr-1" />
                              전체
                            </Badge>
                        ) : (
                            roleIds.map(roleId => {
                                const roleInfo = getRoleInfo(roleId)
                                if (!roleInfo) return null
                                return (
                                    <Badge 
                                      key={roleId}
                                      variant="outline" 
                                      style={{ 
                                        borderColor: roleInfo.color, 
                                        color: roleInfo.color,
                                        backgroundColor: `${roleInfo.color}10` 
                                      }}
                                    >
                                      {roleInfo.name}
                                    </Badge>
                                )
                            })
                        )}
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
                          <DropdownMenuItem onClick={() => handleEditClick(task)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            수정
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
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <EditTaskDialog 
        task={editingTask}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        storeId={storeId}
      />

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
    </div>
  )
}