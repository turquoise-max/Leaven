'use client'

import React, { useState, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { updateSchedule, deleteSchedule } from '@/features/schedule/actions'
import { createTask, assignTask, deleteTask, updateTaskAssignment, toggleTaskCheckitem, getTaskTemplates } from '@/features/schedule/task-actions'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2 } from 'lucide-react'
import { toKSTISOString } from '@/lib/date-utils'

function hexToRgba(hex: string, alpha: number) {
  if (!hex) return `rgba(0,0,0,${alpha})`
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// 자동 파생 상태 계산 헬퍼 (시간 기반)
export function getDerivedTaskStatus(ta: any, scheduleDateStr: string, now: Date): 'todo' | 'in_progress' | 'pending' | 'done' {
  if (ta.task?.status === 'done') return 'done'
  if (!ta.start_time) return 'todo'

  let taskDateObj = null;
  if (ta.start_time.includes('T')) {
    taskDateObj = new Date(ta.start_time)
  } else {
    const dateStr = ta.assigned_date || scheduleDateStr
    if (!dateStr) return 'todo'
    // 만약 start_time이 "09:00" 처럼 초가 없으면 추가
    const timeStr = ta.start_time.length === 5 ? `${ta.start_time}:00` : ta.start_time
    taskDateObj = new Date(`${dateStr}T${timeStr}`)
  }

  if (isNaN(taskDateObj.getTime())) return 'todo'

  const startTimeMs = taskDateObj.getTime()
  const nowMs = now.getTime()
  const thirtyMinsMs = 30 * 60 * 1000

  if (nowMs < startTimeMs) {
    return 'todo'
  } else if (nowMs >= startTimeMs && nowMs < startTimeMs + thirtyMinsMs) {
    return 'in_progress'
  } else {
    return 'pending'
  }
}

interface ScheduleDetailPanelProps {
  storeId: string
  selectedSchedule: any
  setSelectedSchedule: React.Dispatch<React.SetStateAction<any>>
  staffList: any[]
  setLocalSchedules: React.Dispatch<React.SetStateAction<any[]>>
  handleTaskToggle: (taskId: string, currentStatus: string) => Promise<void>
  now: Date
}

export const STATUS_INFO: Record<string, { label: string, color: string, bg: string, border: string }> = {
  todo: { label: '대기', color: '#6b6b6b', bg: '#f3f2ef', border: '#e5e5e5' },
  in_progress: { label: '진행 중', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  pending: { label: '보류', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
  done: { label: '완료', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' }
}

export function ScheduleDetailPanel({
  storeId,
  selectedSchedule,
  setSelectedSchedule,
  staffList,
  setLocalSchedules,
  handleTaskToggle,
  now
}: ScheduleDetailPanelProps) {
  const router = useRouter()
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false)
  
  // Create mode state
  const [newTaskDraft, setNewTaskDraft] = useState({ title: '', hasTime: false, startTime: '', endTime: '' })
  const [newChecklists, setNewChecklists] = useState<string[]>(['']) // 항상 입력할 수 있는 빈 칸 1개 제공
  
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Edit mode state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editTaskDraft, setEditTaskDraft] = useState({ title: '', hasTime: false, startTime: '' })
  const [editChecklists, setEditChecklists] = useState<{ id: string, text: string, is_completed: boolean }[]>([])

  // Role templates state
  const [roleTemplates, setRoleTemplates] = useState<any[]>([])
  const [loadingRoleTemplates, setLoadingRoleTemplates] = useState(false)

  useEffect(() => {
    if (selectedSchedule?.roleId && storeId) {
      setLoadingRoleTemplates(true)
      getTaskTemplates(storeId).then(templates => {
        const filteredAndSorted = templates
          .filter(t => 
            (t.assigned_role_ids?.includes(selectedSchedule.roleId) || t.assigned_role_ids?.includes('all')) &&
            t.task_type !== 'always' && t.start_time
          )
          .sort((a, b) => {
            // 시간 추출 시 toKSTISOString을 사용하여 올바른 로컬 시간(KST)으로 변환 후 비교
            const timeA = toKSTISOString(a.start_time!).substring(11, 16)
            const timeB = toKSTISOString(b.start_time!).substring(11, 16)
            return timeA.localeCompare(timeB)
          })
        setRoleTemplates(filteredAndSorted)
      }).finally(() => {
        setLoadingRoleTemplates(false)
      })
    } else {
      setRoleTemplates([])
    }
  }, [selectedSchedule?.roleId, storeId])

  // Checklist handler helpers
  const handleChecklistChange = (index: number, value: string, isEdit: boolean) => {
    if (isEdit) {
      const newItems = [...editChecklists]
      newItems[index].text = value
      setEditChecklists(newItems)
      // 만약 마지막 아이템에 글자가 입력되었다면, 새 빈 아이템 추가
      if (index === newItems.length - 1 && value.trim() !== '') {
        setEditChecklists([...newItems, { id: crypto.randomUUID(), text: '', is_completed: false }])
      }
    } else {
      const newItems = [...newChecklists]
      newItems[index] = value
      setNewChecklists(newItems)
      // 만약 마지막 아이템에 글자가 입력되었다면, 새 빈 칸 추가
      if (index === newItems.length - 1 && value.trim() !== '') {
        setNewChecklists([...newItems, ''])
      }
    }
  }

  const handleChecklistKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number, isEdit: boolean) => {
    if (e.nativeEvent.isComposing) return; // 한글 등 조합 중일 때는 엔터 이벤트 무시

    if (e.key === 'Enter') {
      e.preventDefault()
      // 다음 인풋으로 포커스 이동 (가장 마지막 인풋에서 엔터 치면 새 인풋은 handleChecklistChange에서 자동 생성됨)
      const nextInput = document.getElementById(`checklist-${isEdit ? 'edit' : 'new'}-${index + 1}`)
      if (nextInput) {
        nextInput.focus()
      }
    } else if (e.key === 'Backspace' && (isEdit ? editChecklists[index].text === '' : newChecklists[index] === '')) {
      // 값이 빈 칸인데 백스페이스 누르면 삭제 (마지막 하나 남은 빈 칸은 삭제 안함)
      if (isEdit && editChecklists.length > 1) {
        e.preventDefault()
        const newItems = editChecklists.filter((_, i) => i !== index)
        setEditChecklists(newItems)
        // 이전 인풋으로 포커스
        const prevInput = document.getElementById(`checklist-edit-${index - 1}`)
        if (prevInput) prevInput.focus()
      } else if (!isEdit && newChecklists.length > 1) {
        e.preventDefault()
        const newItems = newChecklists.filter((_, i) => i !== index)
        setNewChecklists(newItems)
        const prevInput = document.getElementById(`checklist-new-${index - 1}`)
        if (prevInput) prevInput.focus()
      }
    }
  }

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  const handleFieldChange = (field: string, value: any) => {
    if (!selectedSchedule) return

    // 1. Optimistic update for panel
    const newSchedule = { ...selectedSchedule, [field]: value }
    setSelectedSchedule(newSchedule)

    // 2. Optimistic update for main calendar (localSchedules)
    setLocalSchedules(prev => prev.map(s => {
      if (s.id === newSchedule.id) {
        let endDateTime = new Date(`${newSchedule.editDate}T${newSchedule.editEndTime}:00`)
        if (newSchedule.editStartTime > newSchedule.editEndTime) {
          endDateTime.setDate(endDateTime.getDate() + 1)
        }
        return {
          ...s,
          start_time: new Date(`${newSchedule.editDate}T${newSchedule.editStartTime}:00`).toISOString(),
          end_time: endDateTime.toISOString(),
          schedule_members: [{ member_id: newSchedule.editStaffId }]
        }
      }
      return s
    }))

    // 3. Debounced API Call
    setSaveStatus('saving')
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    
    saveTimeoutRef.current = setTimeout(async () => {
      const formData = new FormData()
      formData.append('userIds', JSON.stringify([newSchedule.editStaffId]))
      formData.append('date', newSchedule.editDate)
      formData.append('startTime', newSchedule.editStartTime)
      formData.append('endTime', newSchedule.editEndTime)
      formData.append('title', newSchedule.title || '정규 근무')
      formData.append('color', newSchedule.color || '')
      formData.append('schedule_type', newSchedule.scheduleType || 'regular')
      
      const res = await updateSchedule(storeId, newSchedule.id, formData)
      if (res.error) {
        toast.error('자동 저장 실패: ' + res.error)
        setSaveStatus('idle')
        return
      }
      
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }, 500)
  }

  if (!selectedSchedule) {
    return (
      <div className="w-[320px] xl:w-[340px] shrink-0 bg-white border border-black/10 rounded-xl p-4 shadow-sm flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <span className="text-xl">📅</span>
          </div>
          <h3 className="text-[13px] font-medium text-[#1a1a1a] mb-1">선택된 일정이 없습니다</h3>
          <p className="text-[11px]">일정을 클릭하거나 빈 공간을 드래그하여<br/>새 일정을 추가해보세요.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-[320px] xl:w-[340px] shrink-0 bg-white border border-black/10 rounded-xl p-4 shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-4 pb-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <div 
            className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
            style={{ backgroundColor: hexToRgba(selectedSchedule.roleColor, 0.15), color: selectedSchedule.roleColor }}
          >
            {(selectedSchedule.displayName || '직').substring(0, 1)}
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-semibold text-[15px] text-[#1a1a1a]">{selectedSchedule.displayName || '알 수 없음'}</span>
            <span className="text-[11px] font-medium text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-md border border-black/5">{selectedSchedule.displayRole}</span>
          </div>
          {saveStatus === 'saving' && <span className="text-[10px] text-muted-foreground animate-pulse ml-2">저장 중...</span>}
          {saveStatus === 'saved' && <span className="text-[10px] text-[#1D9E75] ml-2 font-medium">저장됨</span>}
        </div>
        <button 
          className="text-muted-foreground hover:text-black w-6 h-6 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
          onClick={() => setSelectedSchedule(null)}
        >
          ✕
        </button>
      </div>
      
      <div className="flex flex-col gap-5 flex-1 overflow-y-auto pr-1 pb-4 custom-scrollbar">
        
        {/* 1. 스케줄 기본 정보 수정 폼 */}
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-[10px] font-medium text-muted-foreground">날짜</label>
              <Input 
                type="date" 
                className="h-8 text-[11px] px-2" 
                value={selectedSchedule.editDate} 
                onChange={(e) => handleFieldChange('editDate', e.target.value)} 
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-[10px] font-medium text-muted-foreground">스케줄 유형</label>
              <Select 
                value={selectedSchedule.scheduleType || 'regular'} 
                onValueChange={(val) => {
                  handleFieldChange('scheduleType', val)
                  // 유형에 따라 타이틀도 연동 변경
                  const typeLabelMap: Record<string, string> = {
                    'regular': '정규 근무',
                    'substitute': '대체 근무',
                    'overtime': '연장 근무',
                    'off': '휴무',
                    'leave': '휴가/병가',
                    'training': '교육',
                    'etc': '기타'
                  }
                  handleFieldChange('title', typeLabelMap[val] || '정규 근무')
                }}
              >
                <SelectTrigger className="h-8 text-[11px] px-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular" className="text-[11px]">정규 근무</SelectItem>
                  <SelectItem value="substitute" className="text-[11px]">대체 근무</SelectItem>
                  <SelectItem value="overtime" className="text-[11px]">연장 근무</SelectItem>
                  <SelectItem value="off" className="text-[11px]">휴무</SelectItem>
                  <SelectItem value="leave" className="text-[11px]">휴가/병가</SelectItem>
                  <SelectItem value="training" className="text-[11px]">교육</SelectItem>
                  <SelectItem value="etc" className="text-[11px]">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-[10px] font-medium text-muted-foreground">시작 시간</label>
              <Input 
                type="time" 
                className="h-8 text-[11px] px-2" 
                value={selectedSchedule.editStartTime} 
                onChange={(e) => handleFieldChange('editStartTime', e.target.value)} 
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-[10px] font-medium text-muted-foreground">종료 시간</label>
              <Input 
                type="time" 
                className="h-8 text-[11px] px-2" 
                value={selectedSchedule.editEndTime} 
                onChange={(e) => handleFieldChange('editEndTime', e.target.value)} 
              />
            </div>
          </div>
        </div>

        <div className="w-full h-px bg-black/10 my-3" />

        {(() => {
          const allTasks = selectedSchedule.task_assignments || []
          const customTasks = allTasks

          const renderTaskItem = (ta: any) => {
            const derivedStatus = getDerivedTaskStatus(ta, selectedSchedule.editDate, now)
            const sInfo = STATUS_INFO[derivedStatus]
            const isDone = derivedStatus === 'done'
            const isPending = derivedStatus === 'pending'
            
            if (editingTaskId === ta.task?.id) {
              return (
                <div key={ta.id} className="border border-primary/30 bg-primary/5 rounded-md p-3 flex flex-col gap-3 animate-in fade-in duration-200">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-[#1a1a1a]">업무 그룹 (대표 제목)</label>
                    <Input 
                      placeholder="예: 홀 테이블 정리, 화장실 청소 등" 
                      className="h-8 text-[12px] font-medium bg-white" 
                      value={editTaskDraft.title}
                      onChange={(e) => setEditTaskDraft(prev => ({...prev, title: e.target.value}))}
                      autoFocus
                    />
                  </div>
                  
                  <div className="flex flex-col gap-1.5 bg-white p-2 rounded-md border border-black/5">
                    <label className="text-[10px] font-semibold text-muted-foreground mb-1">세부 할 일 (체크리스트)</label>
                    {editChecklists.map((item, index) => (
                      <div key={item.id} className="flex items-center gap-2">
                        <Checkbox disabled className="w-3.5 h-3.5 opacity-50" />
                        <Input
                          id={`checklist-edit-${index}`}
                          placeholder={index === editChecklists.length - 1 ? "할 일 추가... (엔터 입력)" : "할 일 내용"}
                          className="h-7 text-[11px] bg-transparent border-transparent hover:border-black/10 focus-visible:border-primary/50 focus-visible:ring-0 px-1 shadow-none transition-colors"
                          value={item.text}
                          onChange={(e) => handleChecklistChange(index, e.target.value, true)}
                          onKeyDown={(e) => handleChecklistKeyDown(e, index, true)}
                        />
                        {item.text && index !== editChecklists.length - 1 && (
                          <button 
                            className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors shrink-0"
                            onClick={() => {
                              const newItems = editChecklists.filter((_, i) => i !== index)
                              setEditChecklists(newItems)
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex items-center justify-between border-t border-black/5 pt-2">
                    <label className="text-[10px] font-medium text-[#1a1a1a] flex items-center gap-2 cursor-pointer">
                      <Switch 
                        checked={editTaskDraft.hasTime} 
                        onCheckedChange={(val) => setEditTaskDraft(prev => ({...prev, hasTime: val}))} 
                        className="scale-75 origin-left"
                      />
                      수행 시간 지정하기
                    </label>
                  </div>

                  {editTaskDraft.hasTime && (
                    <div className="flex flex-col gap-1.5 bg-white p-2 rounded border border-black/5">
                      <label className="text-[9px] text-muted-foreground">업무 시작 시간 (선택)</label>
                      <div className="flex items-center gap-2">
                        <Input type="time" className="h-7 text-[10px]" value={editTaskDraft.startTime} onChange={(e) => setEditTaskDraft(prev => ({...prev, startTime: e.target.value}))}/>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-1.5 mt-1">
                    <button 
                      className="text-[11px] px-3 py-1.5 rounded text-muted-foreground hover:bg-black/5 transition-colors font-medium"
                      onClick={() => setEditingTaskId(null)}
                    >
                      취소
                    </button>
                    <button 
                      className="text-[11px] px-3 py-1.5 rounded bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-sm"
                      onClick={async () => {
                        if (!editTaskDraft.title.trim()) {
                          toast.error('업무 그룹(대표 제목)을 입력해주세요.')
                          return
                        }
                        
                        const loadingToast = toast.loading('업무 수정 중...')
                        const startTimeToUse = editTaskDraft.hasTime && editTaskDraft.startTime 
                          ? `${selectedSchedule.editDate}T${editTaskDraft.startTime}:00` 
                          : null;
                        
                        const finalChecklist = editChecklists
                          .filter(c => c.text.trim() !== '')
                          .map(c => ({ id: c.id, text: c.text.trim(), is_completed: c.is_completed }))

                        const res = await updateTaskAssignment(
                          ta.id, 
                          ta.task.id, 
                          storeId, 
                          editTaskDraft.title, 
                          startTimeToUse,
                          30
                        );
                        
                        const { createClient } = await import('@/lib/supabase/client')
                        const supabase = createClient()
                        await supabase.from('tasks').update({ checklist: finalChecklist }).eq('id', ta.task.id)

                        if (res.error) {
                          toast.dismiss(loadingToast)
                          toast.error(res.error)
                          return
                        }

                        const updatedSchedule = {
                          ...selectedSchedule,
                          task_assignments: selectedSchedule.task_assignments.map((assignment: any) => {
                            if (assignment.id === ta.id) {
                              return {
                                ...assignment,
                                start_time: editTaskDraft.hasTime ? editTaskDraft.startTime : null,
                                task: {
                                  ...assignment.task,
                                  title: editTaskDraft.title,
                                  start_time: startTimeToUse,
                                  checklist: finalChecklist
                                }
                              }
                            }
                            return assignment
                          })
                        }
                        setSelectedSchedule(updatedSchedule)
                        setLocalSchedules(prev => prev.map(s => s.id === updatedSchedule.id ? updatedSchedule : s))

                        toast.dismiss(loadingToast)
                        toast.success('업무가 수정되었습니다.')
                        setEditingTaskId(null)
                        router.refresh()
                      }}
                    >
                      저장
                    </button>
                  </div>
                </div>
              )
            }

            return (
              <div key={ta.id} className={`relative flex flex-col gap-1 p-2.5 bg-[#fcfcfc] border ${isPending ? 'border-orange-300 bg-orange-50/30' : 'border-black/10'} rounded-md shadow-sm group hover:border-black/20 transition-colors`}>
                
                {/* Hover Actions (Edit / Delete) */}
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button 
                     className="p-1 rounded bg-white border border-black/10 text-muted-foreground hover:text-black hover:bg-muted/50 shadow-sm"
                     onClick={() => {
                        setEditTaskDraft({
                          title: ta.task?.title || '',
                          hasTime: !!ta.start_time,
                          startTime: ta.start_time ? (ta.start_time.includes('T') ? format(new Date(ta.start_time), 'HH:mm') : ta.start_time.substring(0, 5)) : ''
                        })
                        
                        const existingList = ta.task?.checklist || []
                        setEditChecklists([
                            ...existingList,
                            { id: crypto.randomUUID(), text: '', is_completed: false }
                        ])
                        
                        setEditingTaskId(ta.task?.id)
                     }}
                     title="수정"
                   >
                     <Pencil className="w-3 h-3" />
                   </button>
                   <button 
                     className="p-1 rounded bg-white border border-black/10 text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 shadow-sm"
                     onClick={async () => {
                       if (window.confirm('이 업무를 정말 삭제하시겠습니까?')) {
                         const loadingToast = toast.loading('업무 삭제 중...')
                         const res = await deleteTask(ta.task?.id)
                         if (res.error) {
                           toast.dismiss(loadingToast)
                           toast.error(res.error)
                           return
                         }
                         
                         const updatedSchedule = {
                           ...selectedSchedule,
                           task_assignments: selectedSchedule.task_assignments.filter((assignment: any) => assignment.id !== ta.id)
                         }
                         setSelectedSchedule(updatedSchedule)
                         setLocalSchedules(prev => prev.map(s => s.id === updatedSchedule.id ? updatedSchedule : s))
                         
                         toast.dismiss(loadingToast)
                         toast.success('업무가 삭제되었습니다.')
                         router.refresh()
                       }
                     }}
                     title="삭제"
                   >
                     <Trash2 className="w-3 h-3" />
                   </button>
                </div>

                <div className="flex items-start gap-2 pr-12">
                  <Checkbox 
                    id={`panel-task-${ta.task?.id}`} 
                    checked={isDone}
                    onCheckedChange={() => handleTaskToggle(ta.task?.id, ta.task?.status)}
                    className="mt-0.5 w-4 h-4 border-black/30 data-[state=checked]:bg-[#16a34a] data-[state=checked]:border-[#16a34a]"
                  />
                  <div className="flex flex-col flex-1 leading-tight mt-0.5">
                    <label 
                      htmlFor={`panel-task-${ta.task?.id}`}
                      className={`text-[12px] font-medium cursor-pointer ${isDone ? 'line-through text-muted-foreground/60' : 'text-[#1a1a1a]'}`}
                    >
                      {ta.task?.title}
                    </label>
                    {ta.task?.checklist && ta.task.checklist.length > 0 && (
                      <div className="flex flex-col gap-1.5 mt-2">
                        {ta.task.checklist.map((item: any) => (
                          <div key={item.id} className="flex items-start gap-1.5 group/chk">
                            <Checkbox 
                              id={`chk-${item.id}`}
                              checked={item.is_completed}
                              onCheckedChange={async (val) => {
                                const newTasks = selectedSchedule.task_assignments.map((assignment: any) => {
                                  if (assignment.task?.id === ta.task.id) {
                                    const newChecklist = assignment.task.checklist.map((c: any) => 
                                      c.id === item.id ? { ...c, is_completed: !!val } : c
                                    )
                                    
                                    const allCompleted = newChecklist.length > 0 && newChecklist.every((c: any) => c.is_completed)
                                    let newStatus = assignment.task.status
                                    if (allCompleted) {
                                      newStatus = 'done'
                                    } else if (assignment.task.status === 'done') {
                                      newStatus = 'todo'
                                    }

                                    return {
                                      ...assignment,
                                      task: {
                                        ...assignment.task,
                                        checklist: newChecklist,
                                        status: newStatus
                                      }
                                    }
                                  }
                                  return assignment
                                });
                                const updatedSchedule = { ...selectedSchedule, task_assignments: newTasks };
                                setSelectedSchedule(updatedSchedule);
                                setLocalSchedules((prev: any[]) => prev.map(s => s.id === updatedSchedule.id ? updatedSchedule : s));
                                
                                await toggleTaskCheckitem(ta.task.id, item.id, !!val);
                                router.refresh();
                              }}
                              className="mt-0.5 w-3 h-3 rounded-[3px] border-black/20 data-[state=checked]:bg-[#1a1a1a] data-[state=checked]:border-[#1a1a1a]"
                            />
                            <label 
                              htmlFor={`chk-${item.id}`}
                              className={`text-[11px] cursor-pointer flex-1 leading-tight ${item.is_completed ? 'line-through text-muted-foreground/60' : 'text-muted-foreground hover:text-[#1a1a1a]'}`}
                            >
                              {item.text}
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {ta.start_time && (
                    <div 
                      className="text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                      style={{ backgroundColor: sInfo.bg, color: sInfo.color, border: `1px solid ${sInfo.border}` }}
                    >
                      {sInfo.label}
                    </div>
                  )}
                </div>
                
                {ta.start_time && (
                  <div className="flex items-center gap-2 mt-1.5 pl-6">
                    <span className={`text-[9px] font-medium flex items-center gap-1 bg-white px-1.5 py-0.5 rounded border ${isPending ? 'text-orange-500 border-orange-200' : isDone ? 'text-muted-foreground/50 border-black/5' : 'text-primary/80 border-primary/20'}`}>
                      🕒 {ta.start_time.includes('T') ? format(new Date(ta.start_time), 'HH:mm') : ta.start_time.substring(0, 5)}
                    </span>
                  </div>
                )}
              </div>
            )
          }

          return (
            <>
              {/* 2. 역할별 업무 가이드 (기본 토글: 닫힘) */}
              <details className="group">
                <summary className="text-[13px] font-semibold text-[#1a1a1a] cursor-pointer flex justify-between items-center select-none outline-none hover:bg-muted/30 py-1.5 px-1 rounded-sm transition-colors">
                  <div className="flex items-center gap-1.5">
                    <span>{selectedSchedule.displayRole} 업무 가이드</span>
                    <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">조회 전용</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground transition-transform duration-200 group-open:rotate-180">▼</span>
                </summary>
                <div className="mt-2 flex flex-col gap-2 pl-2 pr-1">
                  {loadingRoleTemplates ? (
                    <div className="text-[10px] text-muted-foreground bg-muted/30 p-2.5 rounded border border-dashed text-center animate-pulse">
                      불러오는 중...
                    </div>
                  ) : roleTemplates.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {roleTemplates.map((template: any) => (
                        <div key={template.id} className="p-2.5 bg-[#fcfcfc] border border-black/10 rounded-md shadow-sm">
                          <div className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary/40 mt-1.5 shrink-0" />
                            <div className="flex flex-col flex-1 leading-tight mt-0.5 gap-1">
                              <span className="text-[12px] font-medium text-[#1a1a1a]">{template.title}</span>
                              {template.description && (
                                <span className="text-[11px] text-muted-foreground">{template.description}</span>
                              )}
                            </div>
                            {template.start_time && template.task_type !== 'always' && (
                              <div className="text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 bg-muted/50 text-muted-foreground border border-black/5 whitespace-nowrap">
                                🕒 {toKSTISOString(template.start_time).substring(11, 16)}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] text-muted-foreground bg-muted/30 p-2.5 rounded border border-dashed text-center">
                      이 역할에 지정된 업무 가이드가 없습니다.
                    </div>
                  )}
                </div>
              </details>

              <div className="w-full h-px bg-black/10 my-1" />

              {/* 3. 개인별 업무(체크리스트) 관리 */}
              <div className="flex flex-col gap-3 mt-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[13px] font-semibold text-[#1a1a1a]">오늘의 할 일 (체크리스트)</span>
                  <span className="text-[10px] text-muted-foreground">
                    완료: {customTasks.filter((ta: any) => ta.task?.status === 'done').length} / {customTasks.length}
                  </span>
                </div>
                
                <div className="flex flex-col gap-2">
                  {customTasks.length > 0 ? (
                    customTasks.map((ta: any) => renderTaskItem(ta))
                  ) : (
                    <div className="text-[11px] text-muted-foreground text-center py-5 border border-dashed border-black/10 rounded-md bg-[#fcfcfc]">
                      등록된 개별 업무가 없습니다.
                    </div>
                  )}

                  {/* 업무 추가 폼 */}
            {isTaskFormOpen ? (
              <div className="border border-primary/30 bg-primary/5 rounded-md p-3 flex flex-col gap-3 mt-1 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold text-[#1a1a1a]">업무 그룹 (대표 제목)</label>
                  <Input 
                    placeholder="예: 홀 테이블 정리, 화장실 청소 등" 
                    className="h-8 text-[12px] font-medium bg-white" 
                    value={newTaskDraft.title}
                    onChange={(e) => setNewTaskDraft(prev => ({...prev, title: e.target.value}))}
                    autoFocus
                  />
                </div>
                
                <div className="flex flex-col gap-1.5 bg-white p-2 rounded-md border border-black/5">
                  <label className="text-[10px] font-semibold text-muted-foreground mb-1">세부 할 일 (체크리스트)</label>
                  {newChecklists.map((text, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Checkbox disabled className="w-3.5 h-3.5 opacity-50" />
                      <Input
                        id={`checklist-new-${index}`}
                        placeholder={index === newChecklists.length - 1 ? "할 일 추가... (엔터 입력)" : "할 일 내용"}
                        className="h-7 text-[11px] bg-transparent border-transparent hover:border-black/10 focus-visible:border-primary/50 focus-visible:ring-0 px-1 shadow-none transition-colors"
                        value={text}
                        onChange={(e) => handleChecklistChange(index, e.target.value, false)}
                        onKeyDown={(e) => handleChecklistKeyDown(e, index, false)}
                      />
                      {text && index !== newChecklists.length - 1 && (
                        <button 
                          className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors shrink-0"
                          onClick={() => {
                            const newItems = newChecklists.filter((_, i) => i !== index)
                            setNewChecklists(newItems)
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t border-black/5 pt-2">
                  <label className="text-[10px] font-medium text-[#1a1a1a] flex items-center gap-2 cursor-pointer">
                    <Switch 
                      checked={newTaskDraft.hasTime} 
                      onCheckedChange={(val) => setNewTaskDraft(prev => ({...prev, hasTime: val}))} 
                      className="scale-75 origin-left"
                    />
                    수행 시간 지정하기
                  </label>
                </div>

                {newTaskDraft.hasTime && (
                  <div className="flex flex-col gap-1.5 bg-white p-2 rounded border border-black/5">
                    <label className="text-[9px] text-muted-foreground">업무 시작 시간 (선택)</label>
                    <div className="flex items-center gap-2">
                      <Input type="time" className="h-7 text-[10px]" value={newTaskDraft.startTime} onChange={(e) => setNewTaskDraft(prev => ({...prev, startTime: e.target.value}))}/>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-1.5 mt-1">
                  <button 
                    className="text-[11px] px-3 py-1.5 rounded text-muted-foreground hover:bg-black/5 transition-colors font-medium"
                    onClick={() => setIsTaskFormOpen(false)}
                  >
                    취소
                  </button>
                  <button 
                    className="text-[11px] px-3 py-1.5 rounded bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-sm"
                    onClick={async () => {
                      if (!newTaskDraft.title.trim()) {
                        toast.error('업무 그룹(대표 제목)을 입력해주세요.')
                        return
                      }

                      const loadingToast = toast.loading('업무를 추가하는 중...')
                      
                      const startTimeStr = newTaskDraft.hasTime && newTaskDraft.startTime 
                        ? `${selectedSchedule.editDate}T${newTaskDraft.startTime}:00` 
                        : null;
                        
                      const finalChecklist = newChecklists
                        .filter(text => text.trim() !== '')
                        .map(text => ({
                           id: crypto.randomUUID(),
                           text: text.trim(),
                           is_completed: false
                        }))

                      const taskRes = await createTask({
                        store_id: storeId,
                        title: newTaskDraft.title,
                        task_type: newTaskDraft.hasTime ? 'scheduled' : 'always',
                        start_time: startTimeStr ? new Date(startTimeStr).toISOString() : null,
                        estimated_minutes: 30, // 기본값
                        checklist: finalChecklist
                      });
                      
                      if (taskRes.error || !taskRes.data) {
                        toast.dismiss(loadingToast)
                        toast.error('업무 생성에 실패했습니다.')
                        return;
                      }
                      
                      // 시간 지정 여부에 따라 null 혹은 시간('HH:mm') 전달
                      const assignStartTime = newTaskDraft.hasTime && newTaskDraft.startTime 
                        ? newTaskDraft.startTime 
                        : null;

                      const assignRes = await assignTask({
                        store_id: storeId,
                        task_id: taskRes.data.id,
                        member_id: selectedSchedule.editStaffId,
                        assigned_date: selectedSchedule.editDate,
                        start_time: assignStartTime,
                        estimated_minutes: 30,
                        schedule_id: selectedSchedule.id
                      });
                      
                      if (assignRes.error || !assignRes.data) {
                        toast.dismiss(loadingToast)
                        toast.error('업무 할당에 실패했습니다.')
                        return;
                      }

                      // 성공적으로 생성되었으므로 UI 상태 업데이트
                      const newTaskAssignment = {
                        ...assignRes.data,
                        task: taskRes.data
                      };
                      
                      const updatedSchedule = {
                        ...selectedSchedule,
                        task_assignments: [...(selectedSchedule.task_assignments || []), newTaskAssignment]
                      };
                      
                      setSelectedSchedule(updatedSchedule);
                      setLocalSchedules(prev => prev.map(s => s.id === updatedSchedule.id ? updatedSchedule : s));
                      
                      toast.dismiss(loadingToast)
                      toast.success(`'${newTaskDraft.title}' 업무가 추가되었습니다.`)
                      setIsTaskFormOpen(false)
                      setNewTaskDraft({ title: '', hasTime: false, startTime: '', endTime: '' })
                      setNewChecklists([''])
                      router.refresh()
                    }}
                  >
                    추가하기
                  </button>
                </div>
              </div>
            ) : (
              <button 
                className="w-full border border-dashed border-black/20 text-[#6b6b6b] hover:text-[#1a1a1a] hover:bg-muted/50 hover:border-black/30 text-[11px] py-2 rounded-md flex items-center justify-center gap-1 transition-all mt-1 font-medium"
                onClick={() => setIsTaskFormOpen(true)}
              >
                <span className="text-[14px] leading-none mb-[1px]">+</span> 개별 업무 추가
              </button>
                  )}
                </div>
              </div>
            </>
          )
        })()}
        
        <div className="mt-auto pt-6 pb-2">
          <button 
            className="w-full text-[11px] text-destructive hover:bg-destructive/10 hover:text-destructive py-2 rounded font-medium transition-colors border border-transparent hover:border-destructive/20"
            onClick={async () => {
              if (window.confirm('이 스케줄을 정말 삭제하시겠습니까?')) {
                const res = await deleteSchedule(storeId, selectedSchedule.id)
                if (res.error) {
                  toast.error(res.error)
                  return
                }
                setLocalSchedules(prev => prev.filter(s => s.id !== selectedSchedule.id))
                setSelectedSchedule(null)
                toast.success('스케줄이 삭제되었습니다.')
                router.refresh()
              }
            }}
          >
            이 스케줄 삭제
          </button>
        </div>

      </div>
    </div>
  )
}