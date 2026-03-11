'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Plus, Loader2, AlertTriangle, Clock, Calendar, Briefcase, Trash2, ArrowUp, ArrowDown, CheckSquare, Users, Repeat } from 'lucide-react'
import { ChecklistItem } from '../actions'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { getStoreRoles } from '@/features/store/actions'
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

export interface TaskFormData {
  title: string
  description: string
  is_critical: boolean
  estimated_minutes: number
  task_type: 'scheduled' | 'always'
  
  // UI State for recursion
  is_recurring: boolean

  // Date & Time
  start_date: string // YYYY-MM-DD
  end_date: string   // YYYY-MM-DD
  start_time: string // HH:mm
  end_time: string   // HH:mm
  
  assigned_role_ids: string[]
  
  // Repeat Config
  repeat_type: 'weekly' | 'monthly'
  repeat_days: number[]
  repeat_interval: number
  
  // Monthly Repeat Config
  repeat_monthly_type: 'date' | 'nth_week'
  is_last_day?: boolean // 매월 말일 여부
  nth_week?: number // 1~5 (5는 마지막 주)
  nth_day?: number  // 0~6 (일~토)
  
  checklist: ChecklistItem[]
  status?: 'todo' | 'in_progress' | 'done'
}

interface SortableChecklistItemProps {
  item: ChecklistItem
  index: number
  totalCount: number
  onDelete: (id: string) => void
}

function SortableChecklistItem({ item, index, totalCount, onDelete }: SortableChecklistItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-3 p-3 rounded-xl border bg-background transition-all relative overflow-hidden ${isDragging ? 'shadow-md ring-1 ring-primary/50 opacity-90' : 'hover:shadow-sm'}`}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-muted group-hover:bg-primary/50 transition-colors"></div>
      
      {/* Drag Handle */}
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing ml-1"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      
      <div className="w-4 h-4 rounded border border-muted-foreground/30 flex-shrink-0"></div>
      <span className="flex-1 text-sm font-medium text-foreground">{item.text}</span>
      
      <Button 
        type="button" 
        variant="ghost" 
        size="icon" 
        className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => onDelete(item.id)}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  )
}

interface TaskFormProps {
  storeId: string
  defaultValues?: Partial<TaskFormData>
  onSubmit: (data: TaskFormData) => Promise<void>
  onCancel: () => void
  loading?: boolean
  submitLabel?: string
  showDelete?: boolean
  onDelete?: () => void
  isEditMode?: boolean
  isTemplateMode?: boolean
}

const weekDays = [
  { label: '일', value: 0 },
  { label: '월', value: 1 },
  { label: '화', value: 2 },
  { label: '수', value: 3 },
  { label: '목', value: 4 },
  { label: '금', value: 5 },
  { label: '토', value: 6 },
]

export function TaskForm({ 
  storeId, 
  defaultValues, 
  onSubmit, 
  onCancel, 
  loading = false,
  submitLabel = '저장',
  showDelete = false,
  onDelete,
  isEditMode = false,
  isTemplateMode = false
}: TaskFormProps) {
  const [roles, setRoles] = useState<any[]>([])
  
  // Checklist State
  const [checklist, setChecklist] = useState<ChecklistItem[]>(defaultValues?.checklist || [])
  const [newChecklistItem, setNewChecklistItem] = useState('')

  // Init form data based on default task_type
  const isDefaultAlways = defaultValues?.task_type === 'always'
  
  const [formData, setFormData] = useState<Omit<TaskFormData, 'checklist'>>({
    title: defaultValues?.title || '',
    description: defaultValues?.description || '',
    is_critical: defaultValues?.is_critical || false,
    estimated_minutes: defaultValues?.estimated_minutes || 30,
    task_type: defaultValues?.task_type || 'scheduled',
    // 템플릿 모드면 기본적으로 반복을 on으로 두는 것이 일반적 (상시 업무도 반복의 일종)
    is_recurring: isTemplateMode ? true : (defaultValues?.is_recurring || false),
    start_date: defaultValues?.start_date || new Date().toISOString().split('T')[0],
    end_date: defaultValues?.end_date || new Date().toISOString().split('T')[0],
    start_time: defaultValues?.start_time || '',
    end_time: defaultValues?.end_time || '',
    assigned_role_ids: defaultValues?.assigned_role_ids || ['all'],
    repeat_type: defaultValues?.repeat_type || 'weekly',
    repeat_days: defaultValues?.repeat_days || [0, 1, 2, 3, 4, 5, 6],
    repeat_interval: defaultValues?.repeat_interval || 1,
    repeat_monthly_type: defaultValues?.repeat_monthly_type || 'date',
    is_last_day: defaultValues?.is_last_day || false,
    nth_week: defaultValues?.nth_week || 1,
    nth_day: defaultValues?.nth_day || 1, // Default to Monday
    status: defaultValues?.status || 'todo'
  })

  useEffect(() => {
    if (storeId) {
      getStoreRoles(storeId).then(setRoles)
    }
  }, [storeId])

  useEffect(() => {
    if (defaultValues?.checklist) {
        setChecklist(defaultValues.checklist)
    }
  }, [defaultValues?.checklist])

  // Handlers
  const handleAddChecklistItem = () => {
    if (!newChecklistItem.trim()) return
    const newItem: ChecklistItem = {
      id: crypto.randomUUID(),
      text: newChecklistItem.trim(),
      is_completed: false
    }
    setChecklist([...checklist, newItem])
    setNewChecklistItem('')
  }

  const handleDeleteChecklistItem = (id: string) => {
    setChecklist(checklist.filter(item => item.id !== id))
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      setChecklist((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over?.id)
        
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate
    if (formData.task_type === 'scheduled' && (!formData.start_time || !formData.end_time)) {
       // Just a simple validation, UI inputs are also required
       return
    }

    onSubmit({
      ...formData,
      checklist
    })
  }

  const toggleDay = (day: number) => {
    setFormData(prev => {
      const days = prev.repeat_days.includes(day)
        ? prev.repeat_days.filter(d => d !== day)
        : [...prev.repeat_days, day]
      return { ...prev, repeat_days: days.sort() }
    })
  }

  const toggleRole = (roleId: string) => {
      setFormData(prev => {
          let newIds = [...prev.assigned_role_ids];
          if (newIds.includes('all')) {
              newIds = [];
          }

          if (newIds.includes(roleId)) {
              newIds = newIds.filter(id => id !== roleId);
          } else {
              newIds.push(roleId);
          }
          
          if (newIds.length === 0) {
             newIds = ['all']
          }

          return { ...prev, assigned_role_ids: newIds };
      });
  }

  const handleMonthlyDateChange = (day: string) => {
      const d = parseInt(day);
      if (isNaN(d) || d < 1 || d > 31) return;
      const [y, m] = formData.start_date.split('-');
      const newDate = `${y}-${m}-${String(d).padStart(2, '0')}`;
      setFormData(prev => ({ ...prev, start_date: newDate }));
  }

  const isAllSelected = formData.assigned_role_ids.includes('all') || (roles.length > 0 && roles.every(r => formData.assigned_role_ids.includes(r.id)));

  const handleSelectAllRoles = () => {
      setFormData(prev => ({
         ...prev,
         assigned_role_ids: ['all']
      }));
  }

  const isAlways = formData.task_type === 'always'

  // Summary Text for Repeat
  const getRepeatSummary = () => {
    if (formData.repeat_type === 'weekly') {
      if (formData.repeat_days.length === 7) return '매일'
      if (formData.repeat_days.length === 0) return '반복 없음'
      return `매주 ${formData.repeat_days.map(d => weekDays.find(w => w.value === d)?.label).join(', ')}요일`
    } else {
      if (formData.repeat_monthly_type === 'nth_week') {
         const weekLabels = ['첫 번째', '두 번째', '세 번째', '네 번째', '마지막']
         const weekStr = weekLabels[(formData.nth_week || 1) - 1]
         const dayStr = weekDays.find(w => w.value === formData.nth_day)?.label || ''
         return `매월 ${weekStr} 주 ${dayStr}요일`
      } else {
         if (formData.is_last_day) return '매월 말일'
         const d = formData.start_date.split('-')[2]
         return `매월 ${d}일`
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col h-full bg-background">
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row h-full">
        
        {/* ======================= 좌측 패널 (기본 및 일정 정보) ======================= */}
        <div className="flex-1 min-w-0 flex flex-col border-b md:border-b-0 md:border-r border-border">
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-7">
              
              {/* 1. 업무명 */}
              <div className="space-y-3">
                <Label htmlFor="title" className="text-sm font-semibold flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-primary" />
                  업무명 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="예: 오픈 준비, 매장 청소, 재고 확인"
                  className="text-base h-11"
                  required
                />
              </div>

              {/* 2. 시간 및 종일 설정 */}
              <div className="space-y-4 bg-muted/30 p-4 rounded-xl border border-border/50">
                <div className="flex items-center justify-between">
                   <Label className="text-sm font-semibold flex items-center gap-2">
                     <Clock className="w-4 h-4 text-blue-500" />
                     수행 시간
                   </Label>
                   <div className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-full border shadow-sm">
                     <Checkbox 
                        id="is_always"
                        checked={isAlways}
                        onCheckedChange={(checked) => setFormData(prev => ({ 
                           ...prev, 
                           task_type: checked ? 'always' : 'scheduled'
                        }))}
                     />
                     <Label htmlFor="is_always" className="cursor-pointer text-sm font-medium">종일 (상시 업무)</Label>
                   </div>
                </div>

                {!isAlways && (
                  <div className="flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200">
                    <div className="grid flex-1 gap-1.5">
                        <Label className="text-xs text-muted-foreground ml-1">시작 시간</Label>
                        <Input
                          type="time"
                          value={formData.start_time}
                          onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                          required={!isAlways}
                          className="h-10 bg-background"
                        />
                    </div>
                    <span className="mt-6 text-muted-foreground font-medium">~</span>
                    <div className="grid flex-1 gap-1.5">
                        <Label className="text-xs text-muted-foreground ml-1">종료 시간</Label>
                        <Input
                          type="time"
                          value={formData.end_time}
                          onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                          required={!isAlways}
                          className="h-10 bg-background"
                        />
                    </div>
                  </div>
                )}
                {isAlways && (
                  <p className="text-sm text-muted-foreground bg-blue-500/10 text-blue-600 dark:text-blue-400 p-3 rounded-lg flex items-start gap-2 animate-in fade-in zoom-in-95 duration-200">
                     <Briefcase className="w-4 h-4 mt-0.5 shrink-0" />
                     이 업무는 종일(상시) 업무로 취급되며, 특정 시간에 얽매이지 않고 하루 중 수시로 확인해야 하는 업무입니다.
                  </p>
                )}
              </div>

              {/* 3. 반복 설정 */}
              <div className="space-y-4 bg-muted/30 p-4 rounded-xl border border-border/50">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                     <Calendar className="w-4 h-4 text-green-500" />
                     <Label className="text-sm font-semibold">반복 설정</Label>
                     {formData.is_recurring && (
                        <Badge variant="secondary" className="ml-2 bg-green-500/10 text-green-600 hover:bg-green-500/20 border-0">
                          {getRepeatSummary()}
                        </Badge>
                     )}
                   </div>
                   <Switch 
                     checked={formData.is_recurring}
                     onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_recurring: checked }))}
                   />
                </div>

                {formData.is_recurring && (
                  <div className="pt-2 animate-in fade-in slide-in-from-top-4 duration-300">
                      <Tabs 
                          value={formData.repeat_type} 
                          onValueChange={(val: any) => setFormData(prev => ({ ...prev, repeat_type: val }))}
                          className="w-full"
                      >
                          <TabsList className="grid w-full grid-cols-2 bg-background border mb-4">
                              <TabsTrigger value="weekly">매주 반복</TabsTrigger>
                              <TabsTrigger value="monthly">매월 반복</TabsTrigger>
                          </TabsList>

                          <TabsContent value="weekly" className="mt-0">
                              <div className="bg-background border rounded-lg p-3">
                                <Label className="text-xs text-muted-foreground mb-3 block">반복할 요일을 선택하세요</Label>
                                <div className="flex justify-between gap-1">
                                    {weekDays.map((day) => {
                                        const isSelected = formData.repeat_days.includes(day.value);
                                        return (
                                            <button
                                                key={day.value}
                                                type="button"
                                                onClick={() => toggleDay(day.value)}
                                                className={`
                                                    w-9 h-9 sm:w-10 sm:h-10 rounded-full text-sm font-medium flex items-center justify-center transition-all
                                                    ${isSelected 
                                                        ? 'bg-primary text-primary-foreground shadow-md scale-105' 
                                                        : 'bg-muted/50 hover:bg-muted text-muted-foreground border border-border'}
                                                `}
                                            >
                                                {day.label}
                                            </button>
                                        )
                                    })}
                                </div>
                              </div>
                          </TabsContent>

                          <TabsContent value="monthly" className="mt-0">
                              <div className="bg-background border rounded-lg flex flex-col divide-y divide-border">
                                  {/* 날짜 지정 옵션 */}
                                  <div className="p-4 flex items-start gap-3">
                                      <div className="pt-1">
                                          <div className="flex items-center space-x-2">
                                              <input 
                                                  type="radio" 
                                                  id="monthly_date" 
                                                  name="monthly_type" 
                                                  checked={formData.repeat_monthly_type === 'date'}
                                                  onChange={() => setFormData(prev => ({ ...prev, repeat_monthly_type: 'date' }))}
                                                  className="w-4 h-4 text-primary accent-primary cursor-pointer"
                                              />
                                          </div>
                                      </div>
                                      <div className={`flex-1 flex flex-col gap-3 transition-opacity ${formData.repeat_monthly_type !== 'date' ? 'opacity-50 pointer-events-none' : ''}`}>
                                          <Label htmlFor="monthly_date" className="cursor-pointer font-medium text-sm">특정 날짜에 반복</Label>
                                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                              <div className="flex items-center gap-2">
                                                  <Input 
                                                      type="number" 
                                                      min={1} 
                                                      max={31}
                                                      disabled={formData.is_last_day}
                                                      value={formData.start_date.split('-')[2]} 
                                                      onChange={(e) => handleMonthlyDateChange(e.target.value)}
                                                      className="w-16 h-9 text-center font-medium"
                                                  />
                                                  <span className="text-sm">일에 반복</span>
                                              </div>
                                              
                                              <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-md border border-border/50">
                                                  <Checkbox 
                                                      id="is_last_day"
                                                      checked={formData.is_last_day}
                                                      onCheckedChange={(checked) => setFormData(prev => ({ 
                                                          ...prev, 
                                                          is_last_day: checked === true
                                                      }))}
                                                  />
                                                  <Label htmlFor="is_last_day" className="cursor-pointer text-sm">항상 매월 말일에 반복</Label>
                                              </div>
                                          </div>
                                      </div>
                                  </div>

                                  {/* 요일 지정 옵션 */}
                                  <div className="p-4 flex items-start gap-3">
                                      <div className="pt-1">
                                          <div className="flex items-center space-x-2">
                                              <input 
                                                  type="radio" 
                                                  id="monthly_nth" 
                                                  name="monthly_type" 
                                                  checked={formData.repeat_monthly_type === 'nth_week'}
                                                  onChange={() => setFormData(prev => ({ ...prev, repeat_monthly_type: 'nth_week' }))}
                                                  className="w-4 h-4 text-primary accent-primary cursor-pointer"
                                              />
                                          </div>
                                      </div>
                                      <div className={`flex-1 flex flex-col gap-3 transition-opacity ${formData.repeat_monthly_type !== 'nth_week' ? 'opacity-50 pointer-events-none' : ''}`}>
                                          <Label htmlFor="monthly_nth" className="cursor-pointer font-medium text-sm">특정 번째 주 요일에 반복</Label>
                                          <div className="flex items-center gap-2">
                                              <Select 
                                                  value={String(formData.nth_week)} 
                                                  onValueChange={(val) => setFormData(prev => ({ ...prev, nth_week: parseInt(val) }))}
                                              >
                                                  <SelectTrigger className="w-24 h-9">
                                                      <SelectValue placeholder="주차" />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                      <SelectItem value="1">첫 번째</SelectItem>
                                                      <SelectItem value="2">두 번째</SelectItem>
                                                      <SelectItem value="3">세 번째</SelectItem>
                                                      <SelectItem value="4">네 번째</SelectItem>
                                                      <SelectItem value="5">마지막</SelectItem>
                                                  </SelectContent>
                                              </Select>
                                              <span className="text-sm text-muted-foreground">주</span>
                                              
                                              <Select 
                                                  value={String(formData.nth_day)} 
                                                  onValueChange={(val) => setFormData(prev => ({ ...prev, nth_day: parseInt(val) }))}
                                              >
                                                  <SelectTrigger className="w-20 h-9">
                                                      <SelectValue placeholder="요일" />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                      {weekDays.map(day => (
                                                          <SelectItem key={day.value} value={String(day.value)}>{day.label}요일</SelectItem>
                                                      ))}
                                                  </SelectContent>
                                              </Select>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          </TabsContent>
                      </Tabs>
                  </div>
                )}
              </div>

            </div>
          </ScrollArea>
        </div>


        {/* ======================= 우측 패널 ======================= */}
        <div className="flex-1 min-w-0 flex flex-col bg-muted/5">
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-8">

              {/* === 우측 공통 (항상 보임) === */}
              {/* 담당 역할 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                   <Label className="text-sm font-semibold flex items-center gap-2">
                     <Users className="w-4 h-4 text-purple-500" />
                     담당 역할 지정
                   </Label>
                   <Button 
                       type="button" 
                       variant={isAllSelected ? "secondary" : "outline"}
                       size="sm" 
                       className="h-7 text-xs rounded-full"
                       onClick={handleSelectAllRoles}
                   >
                       {isAllSelected ? '전체 해제' : '전체 선택'}
                   </Button>
                </div>
                
                <div className="flex flex-wrap gap-2">
                    {roles.map((role) => {
                        const isSelected = formData.assigned_role_ids.includes('all') || formData.assigned_role_ids.includes(role.id);
                        return (
                            <button
                                key={role.id}
                                type="button"
                                onClick={() => toggleRole(role.id)}
                                className={`
                                    flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-all
                                    ${isSelected 
                                        ? 'border-primary bg-primary/10 text-foreground font-medium shadow-sm' 
                                        : 'border-border bg-background text-muted-foreground hover:bg-muted/50'}
                                `}
                            >
                                <div 
                                    className="w-2 h-2 rounded-full" 
                                    style={{ backgroundColor: role.color }}
                                />
                                {role.name}
                            </button>
                        )
                    })}
                </div>
              </div>
              
              <Separator />

              {/* === 조건부 렌더링 영역 === */}
              {!isAlways ? (
                // [일반 업무 모드] - 중요도 & 체크리스트
                <div className="space-y-8 animate-in fade-in duration-300">
                  
                  {/* 중요 업무 설정 */}
                  <div className="flex items-center justify-between bg-background p-4 rounded-xl border border-border shadow-sm">
                    <div className="space-y-1">
                      <Label htmlFor="is_critical" className="text-sm font-semibold flex items-center gap-2 cursor-pointer">
                        <AlertTriangle className={`w-4 h-4 ${formData.is_critical ? 'text-red-500' : 'text-muted-foreground'}`} />
                        중요 업무 표시
                      </Label>
                      <p className="text-xs text-muted-foreground pl-6">
                        이 업무를 강조 표시하여 직원들이 놓치지 않게 합니다.
                      </p>
                    </div>
                    <Switch
                      id="is_critical"
                      checked={formData.is_critical}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_critical: checked }))}
                      className="data-[state=checked]:bg-red-500"
                    />
                  </div>

                  {/* 체크리스트 */}
                  <div className="space-y-4">
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <CheckSquare className="w-4 h-4 text-orange-500" />
                        세부 체크리스트 <span className="text-muted-foreground font-normal text-xs ml-1">({checklist.length})</span>
                      </Label>
                      <p className="text-xs text-muted-foreground pl-6">이 업무를 완료하기 위해 필요한 세부 작업들을 추가하세요.</p>
                    </div>
                    
                    <div className="flex gap-2 bg-background p-1 rounded-lg border shadow-sm">
                      <Input 
                        value={newChecklistItem}
                        onChange={(e) => setNewChecklistItem(e.target.value)}
                        placeholder="할 일 항목 입력 (예: 바닥 쓸기)"
                        className="border-0 focus-visible:ring-0 bg-transparent"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddChecklistItem()
                          }
                        }}
                      />
                      <Button type="button" size="sm" onClick={handleAddChecklistItem} className="rounded-md px-3">
                        추가
                      </Button>
                    </div>

                    <div className="space-y-2 mt-4">
                      {checklist.length === 0 && (
                        <div className="text-center py-10 text-muted-foreground text-sm border border-dashed rounded-xl bg-background/50">
                          등록된 세부 항목이 없습니다.
                        </div>
                      )}
                      
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={checklist.map(item => item.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {checklist.map((item, index) => (
                            <SortableChecklistItem
                              key={item.id}
                              item={item}
                              index={index}
                              totalCount={checklist.length}
                              onDelete={handleDeleteChecklistItem}
                            />
                          ))}
                        </SortableContext>
                      </DndContext>
                    </div>
                  </div>
                </div>

              ) : (

                // [상시 업무 모드] - 공지 및 설명란
                <div className="space-y-4 animate-in fade-in duration-300 h-full flex flex-col">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-orange-500" />
                      공지 및 상시 체크 상황
                    </Label>
                    <p className="text-xs text-muted-foreground pl-6">
                      상시 업무는 대시보드에 고정 노출됩니다. 직원들이 수시로 확인해야 할 지시사항이나 가이드를 작성해주세요.
                    </p>
                  </div>
                  
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="예: 홀 테이블이 비워지면 즉시 정리해주세요. 쓰레기통이 80% 이상 차면 바로 비워주세요."
                    className="flex-1 min-h-[200px] bg-background border-border shadow-sm text-sm leading-relaxed p-4 rounded-xl resize-none"
                  />
                </div>
              )}
              
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* ======================= 하단 액션 바 ======================= */}
      <div className="p-4 border-t bg-background/80 backdrop-blur-sm flex justify-between shrink-0 z-10">
        {showDelete && onDelete ? (
            <Button type="button" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={onDelete}>
                <Trash2 className="w-4 h-4 mr-2" />
                삭제
            </Button>
        ) : (
            <div></div> // Spacer
        )}
        <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onCancel} className="px-6">
                취소
            </Button>
            <Button type="submit" disabled={loading} className="px-8 shadow-md">
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {submitLabel}
            </Button>
        </div>
      </div>
    </form>
  )
}