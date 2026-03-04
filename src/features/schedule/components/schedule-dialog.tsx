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
import { useState, useEffect, useId } from 'react'
import { Task, TaskAssignment, getTasks, getTaskAssignmentsBySchedule, assignTask, unassignTask } from '@/features/tasks/actions'
import { 
  DndContext, 
  DragEndEvent, 
  DragOverlay, 
  useDraggable, 
  useDroppable, 
  DragStartEvent,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
  PointerSensor,
  pointerWithin
} from '@dnd-kit/core'
import { snapCenterToCursor } from '@dnd-kit/modifiers'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Clock, GripVertical, X } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  
  // Task Management States
  const [tasks, setTasks] = useState<Task[]>([])
  const [assignments, setAssignments] = useState<TaskAssignment[]>([])
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const dndContextId = useId()

  // Sensors for better drag handling
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px move required to start drag
      },
    }),
    useSensor(TouchSensor),
    useSensor(MouseSensor)
  )

  useEffect(() => {
    if (open) {
      if (mode === 'create' && selectedDate) {
        // 날짜만 추출 (YYYY-MM-DD)
        setDate(selectedDate.split('T')[0])
        setStartTime(initialStartTime || '09:00')
        setEndTime(initialEndTime || '18:00')
        setUserId('')
        setAssignments([]) // Reset assignments
      } else if (mode === 'edit' && selectedEvent) {
        // ISO string에서 날짜와 시간 추출
        const start = new Date(selectedEvent.start)
        const end = new Date(selectedEvent.end)
        
        setDate(start.toISOString().split('T')[0])
        setStartTime(start.toTimeString().substring(0, 5))
        setEndTime(end.toTimeString().substring(0, 5))
        setUserId(selectedEvent.extendedProps.userId)
        
        // Fetch assignments for this schedule
        fetchAssignments(selectedEvent.id)
      }

      // Fetch tasks (Task Pool)
      fetchTasks()
    }
  }, [open, mode, selectedDate, selectedEvent, initialStartTime, initialEndTime, storeId])

  const fetchTasks = async () => {
    try {
      const data = await getTasks(storeId)
      setTasks(data)
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
      toast.error('업무 목록을 불러오지 못했습니다.')
    }
  }

  const fetchAssignments = async (scheduleId: string) => {
    try {
      const data = await getTaskAssignmentsBySchedule(storeId, scheduleId)
      setAssignments(data)
    } catch (error) {
      console.error('Failed to fetch assignments:', error)
      toast.error('할당된 업무를 불러오지 못했습니다.')
    }
  }

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

  // DND Handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const task = tasks.find(t => t.id === active.id)
    if (task) setActiveTask(task)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)

    if (!over || mode !== 'edit' || !selectedEvent) {
      if (mode === 'create') {
         toast.warning('스케줄을 먼저 생성한 후 업무를 배정해주세요.')
      }
      return
    }

    if (over.id === 'assignments-area') {
      const task = tasks.find(t => t.id === active.id)
      if (!task) return

      // Optimistic update could go here, but for now we'll wait for server
      
      const result = await assignTask({
        store_id: storeId,
        task_id: task.id,
        user_id: userId,
        assigned_date: date,
        start_time: startTime,
        estimated_minutes: task.estimated_minutes,
        schedule_id: selectedEvent.id
      })

      if (result?.error) {
        toast.error('업무 할당 실패', { description: result.error })
      } else {
        toast.success(`${task.title} 할당 완료`)
        fetchAssignments(selectedEvent.id) // Refresh assignments
      }
    }
  }

  const handleUnassign = async (assignmentId: string) => {
    if (!confirm('업무 할당을 취소하시겠습니까?')) return

    const result = await unassignTask(assignmentId, date)
    if (result?.error) {
      toast.error('할당 취소 실패', { description: result.error })
    } else {
      toast.success('할당이 취소되었습니다.')
      if (selectedEvent) fetchAssignments(selectedEvent.id)
    }
  }

  // Content Wrapper based on mode
  const ContentWrapper = mode === 'edit' ? DndContext : 'div'
  const wrapperProps = mode === 'edit' ? {
    id: dndContextId,
    sensors: sensors,
    collisionDetection: pointerWithin,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd
  } : {}

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "transition-all duration-300 max-h-[90vh] flex flex-col",
        mode === 'edit' ? "sm:max-w-[900px]" : "sm:max-w-[500px]"
      )}>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '근무 일정 추가' : '근무 일정 수정 및 업무 할당'}</DialogTitle>
          <DialogDescription>
            {mode === 'create' 
              ? '새로운 근무 일정을 등록합니다. 업무 할당은 일정 생성 후 가능합니다.' 
              : '근무 일정을 수정하고 해당 시간에 수행할 업무를 배정합니다.'}
          </DialogDescription>
        </DialogHeader>
        
        {/* @ts-ignore - Dynamic component props issue */}
        <ContentWrapper {...wrapperProps} className="flex-1 overflow-hidden">
          <div className={cn(
            "grid gap-6 h-full overflow-hidden",
            mode === 'edit' ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
          )}>
            {/* Left Column: Schedule Form & Assigned Tasks */}
            <div className="flex flex-col gap-4 h-full overflow-hidden">
              <ScrollArea className="flex-1 pr-4">
                <form id="schedule-form" action={handleSubmit} className="grid gap-4 py-4">
                  {/* 직원 선택 */}
                  <div className="grid gap-2">
                    <Label htmlFor="userId">직원</Label>
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

                  {/* 날짜 */}
                  <div className="grid gap-2">
                    <Label htmlFor="date">날짜</Label>
                    <Input
                      id="date"
                      name="date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                    />
                  </div>

                  {/* 시간 */}
                  <div className="grid gap-2">
                    <Label htmlFor="startTime">시간</Label>
                    <div className="flex items-center gap-2">
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
                  <div className="grid gap-2">
                    <Label htmlFor="memo">메모</Label>
                    <Textarea
                      id="memo"
                      name="memo"
                      placeholder="특이사항 입력"
                      className="min-h-[100px]"
                      defaultValue={selectedEvent?.extendedProps?.memo || ''}
                    />
                  </div>
                </form>
              </ScrollArea>

              {/* Assigned Tasks Area (Only in Edit Mode) */}
              {mode === 'edit' && (
                <div className="flex flex-col gap-2 h-[200px] min-h-[200px] border-t pt-4">
                  <Label className="text-sm font-medium">할당된 업무</Label>
                  <AssignmentsArea 
                    assignments={assignments} 
                    onUnassign={handleUnassign}
                  />
                </div>
              )}
            </div>

            {/* Right Column: Task Pool (Only in Edit Mode) */}
            {mode === 'edit' && (
              <div className="flex flex-col gap-2 h-full overflow-hidden border-l pl-6">
                <Label className="text-sm font-medium">업무 목록 (드래그하여 할당)</Label>
                <Card className="flex-1 overflow-hidden bg-muted/30">
                  <ScrollArea className="h-full p-3">
                    <div className="space-y-2">
                      {tasks.map(task => (
                        <DraggableTask key={task.id} task={task} />
                      ))}
                      {tasks.length === 0 && (
                          <div className="text-center text-muted-foreground py-4 text-xs">
                            등록된 업무가 없습니다.
                          </div>
                      )}
                    </div>
                  </ScrollArea>
                </Card>
              </div>
            )}
          </div>

          {mode === 'edit' && (
            <DragOverlay modifiers={[snapCenterToCursor]} zIndex={9999} dropAnimation={null}>
              {activeTask ? (
                  <div className="w-[200px] p-2 bg-background border rounded-md shadow-xl cursor-grabbing opacity-90 ring-2 ring-primary">
                    <span className="font-medium text-xs">{activeTask.title}</span>
                  </div>
              ) : null}
            </DragOverlay>
          )}
        </ContentWrapper>

        <DialogFooter className="flex justify-between sm:justify-between pt-4 border-t">
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
          <div className="flex gap-2 ml-auto">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            {/* Submit button linked to form */}
            <Button type="submit" form="schedule-form" disabled={loading}>
              {mode === 'create' ? '등록' : '수정'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Droppable Assignments Area
function AssignmentsArea({ assignments, onUnassign }: { assignments: TaskAssignment[], onUnassign: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'assignments-area' })

  return (
    <Card 
      ref={setNodeRef}
      className={cn(
        "flex-1 overflow-hidden transition-colors border-dashed",
        isOver ? "bg-primary/10 border-primary" : "bg-background"
      )}
    >
      <ScrollArea className="h-full p-3">
        {assignments.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
            여기로 업무를 드래그하세요
          </div>
        ) : (
          <div className="space-y-2">
            {assignments.map(assignment => (
              <div 
                key={assignment.id} 
                className="flex items-center justify-between p-2 rounded-md bg-primary/10 border border-primary/20 text-xs"
              >
                <div className="flex items-center gap-2 truncate">
                  <Badge variant={assignment.status === 'completed' ? 'secondary' : 'outline'} className="text-[10px] px-1 h-4">
                    {assignment.start_time?.slice(0, 5)}
                  </Badge>
                  <span className="truncate font-medium">{assignment.task?.title}</span>
                </div>
                <button
                  onClick={() => onUnassign(assignment.id)}
                  className="text-muted-foreground hover:text-red-500 transition-colors p-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </Card>
  )
}

// Draggable Task Item
function DraggableTask({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
  })

  if (isDragging) {
      return <div ref={setNodeRef} className="opacity-30 p-2 border rounded-md bg-muted h-[40px]" />
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="p-2 bg-card border rounded-md shadow-sm cursor-grab hover:border-primary/50 transition-colors group text-xs flex items-center justify-between"
    >
      <div className="flex items-center gap-2 truncate">
        <GripVertical className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        <span className="truncate">{task.title}</span>
      </div>
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
        <Clock className="w-3 h-3" />
        {task.estimated_minutes}m
      </div>
    </div>
  )
}