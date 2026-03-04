'use client'

import React, { useState, useId } from 'react'
import { DndContext, DragEndEvent, DragOverlay, useDraggable, useDroppable, DragStartEvent } from '@dnd-kit/core'
import { Task, TaskAssignment, assignTask, unassignTask } from '@/features/tasks/actions'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { Clock, GripVertical, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface DailyTimelineProps {
  date: string
  schedules: any[] // Staff schedules
  tasks: Task[]
  assignments: TaskAssignment[]
  storeId: string
}

// 시간 슬롯 생성 (06:00 ~ 24:00, 1시간 단위)
const HOURS = Array.from({ length: 19 }, (_, i) => i + 6)

export function DailyTimeline({ date, schedules, tasks, assignments, storeId }: DailyTimelineProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const dndContextId = useId()

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    setActiveId(active.id as string)
    const task = tasks.find(t => t.id === active.id)
    if (task) setActiveTask(task)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    
    setActiveId(null)
    setActiveTask(null)

    if (!over) return

    // Droppable ID format: "userId-hour" (e.g., "user123-14")
    // UUID contains hyphens, so we need to split by the last hyphen
    const overId = over.id as string
    const lastHyphenIndex = overId.lastIndexOf('-')
    if (lastHyphenIndex === -1) return

    const userId = overId.substring(0, lastHyphenIndex)
    const hourStr = overId.substring(lastHyphenIndex + 1)
    const hour = parseInt(hourStr)

    if (!userId || isNaN(hour)) return

    const task = tasks.find(t => t.id === active.id)
    if (!task) return

    const startTime = `${String(hour).padStart(2, '0')}:00`

    // 업무 할당 서버 액션 호출
    const result = await assignTask({
      store_id: storeId,
      task_id: task.id,
      user_id: userId,
      assigned_date: date,
      start_time: startTime,
      estimated_minutes: task.estimated_minutes
    })

    if (result?.error) {
      toast.error('업무 할당 실패', { description: result.error })
    } else {
      toast.success(`${task.title} 할당 완료`)
    }
  }

  // 직원별 할당된 업무 필터링 함수
  const getAssignmentsForCell = (userId: string, hour: number) => {
    return assignments.filter(a => {
      if (a.user_id !== userId) return false
      if (!a.start_time) return false
      const startHour = parseInt(a.start_time.split(':')[0])
      return startHour === hour
    })
  }

  // 근무 시간인지 확인하는 함수
  const isWorkingHour = (userId: string, hour: number) => {
    const schedule = schedules.find(s => s.user_id === userId)
    if (!schedule) return false
    
    // 단순화를 위해 start_time, end_time만 비교 (분 단위 무시하고 시간 단위로)
    const startHour = parseInt(schedule.start_time.split(':')[0])
    const endHour = parseInt(schedule.end_time.split(':')[0])
    
    // 자정을 넘기는 근무는 고려하지 않음 (일단)
    return hour >= startHour && hour < endHour
  }

  const handleUnassign = async (assignmentId: string) => {
    if (!confirm('업무 할당을 취소하시겠습니까?')) return

    const result = await unassignTask(assignmentId, date)
    if (result?.error) {
      toast.error('할당 취소 실패', { description: result.error })
    } else {
      toast.success('할당이 취소되었습니다.')
    }
  }

  return (
    <DndContext id={dndContextId} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-200px)]">
        {/* Timeline Area */}
        <div className="flex-1 overflow-auto border rounded-lg bg-background">
          <div className="min-w-[800px]">
            {/* Header (Hours) */}
            <div className="flex border-b sticky top-0 bg-background z-10">
              <div className="w-40 p-3 font-semibold border-r shrink-0 bg-muted/30">직원 / 시간</div>
              {HOURS.map(hour => (
                <div key={hour} className="flex-1 min-w-[60px] p-2 text-center text-xs text-muted-foreground border-r last:border-r-0 bg-muted/30">
                  {hour}:00
                </div>
              ))}
            </div>

            {/* Rows (Staff) */}
            {schedules.map(schedule => (
              <div key={schedule.user_id} className="flex border-b last:border-b-0">
                {/* Staff Info Column */}
                <div className="w-40 p-3 border-r shrink-0 sticky left-0 bg-background z-10 flex items-center gap-2">
                   <Avatar className="h-8 w-8">
                     <AvatarImage src={schedule.profile?.avatar_url} />
                     <AvatarFallback>{schedule.profile?.full_name?.substring(0, 2)}</AvatarFallback>
                   </Avatar>
                   <div className="truncate">
                     <div className="text-sm font-medium truncate">{schedule.profile?.full_name}</div>
                     <div className="text-xs text-muted-foreground">
                       {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}
                     </div>
                   </div>
                </div>

                {/* Hour Cells */}
                {HOURS.map(hour => {
                  const isWorking = isWorkingHour(schedule.user_id, hour)
                  const cellAssignments = getAssignmentsForCell(schedule.user_id, hour)
                  
                  return (
                    <TimelineCell 
                      key={`${schedule.user_id}-${hour}`}
                      id={`${schedule.user_id}-${hour}`}
                      isWorking={isWorking}
                      assignments={cellAssignments}
                      onUnassign={handleUnassign}
                    />
                  )
                })}
              </div>
            ))}
            
            {schedules.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                    이 날짜에 근무하는 직원이 없습니다.
                </div>
            )}
          </div>
        </div>

        {/* Task Pool Sidebar */}
        <div className="w-full lg:w-80 shrink-0 flex flex-col gap-4">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">업무 목록 (Task Pool)</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden">
              <ScrollArea className="h-full p-4">
                <div className="space-y-3">
                  {tasks.map(task => (
                    <DraggableTask key={task.id} task={task} />
                  ))}
                  {tasks.length === 0 && (
                     <div className="text-center text-muted-foreground py-8 text-sm">
                        등록된 업무가 없습니다.
                     </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      <DragOverlay>
        {activeTask ? (
           <div className="w-[280px] p-3 bg-background border rounded-md shadow-xl cursor-grabbing opacity-90 ring-2 ring-primary">
             <div className="flex items-start justify-between">
               <span className="font-medium text-sm">{activeTask.title}</span>
               {activeTask.is_critical && (
                 <Badge variant="destructive" className="text-[10px] h-5 px-1">Critical</Badge>
               )}
             </div>
             <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
               <Clock className="w-3 h-3" />
               {activeTask.estimated_minutes}분
             </div>
           </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

// Droppable Timeline Cell
interface TimelineCellProps {
  id: string
  isWorking: boolean
  assignments: TaskAssignment[]
  onUnassign: (id: string) => void
}

function TimelineCell({ id, isWorking, assignments, onUnassign }: TimelineCellProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        "flex-1 min-w-[60px] border-r last:border-r-0 relative p-1 transition-colors group/cell",
        !isWorking && "bg-slate-100 dark:bg-slate-900 pattern-diagonal-lines opacity-50",
        isWorking && isOver && "bg-primary/20",
        isWorking && !isOver && "hover:bg-muted/50"
      )}
    >
      {assignments.map(assignment => (
        <div 
          key={assignment.id} 
          className="group/item relative bg-primary/10 border border-primary/20 rounded px-1 py-0.5 text-[10px] mb-1 truncate text-primary font-medium flex items-center justify-between"
          title={assignment.task?.title}
        >
          <span className="truncate">{assignment.task?.title}</span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onUnassign(assignment.id)
            }}
            className="opacity-0 group-hover/item:opacity-100 hover:text-red-600 transition-opacity ml-1 shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  )
}

// Draggable Task Item
function DraggableTask({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
  })

  if (isDragging) {
      return <div ref={setNodeRef} className="opacity-30 p-3 border rounded-md bg-muted h-[80px]" />
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="p-3 bg-card border rounded-md shadow-sm cursor-grab hover:border-primary/50 transition-colors group"
    >
      <div className="flex items-start justify-between">
        <span className="font-medium text-sm flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            {task.title}
        </span>
        {task.is_critical && (
          <Badge variant="destructive" className="text-[10px] h-5 px-1">Critical</Badge>
        )}
      </div>
      {task.description && (
        <p className="text-xs text-muted-foreground mt-1 truncate pl-6">
          {task.description}
        </p>
      )}
      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground pl-6">
        <Clock className="w-3 h-3" />
        {task.estimated_minutes}분
      </div>
    </div>
  )
}