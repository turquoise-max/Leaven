'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Plus, Loader2, AlertTriangle, Clock, Calendar, Briefcase, Trash2, ArrowUp, ArrowDown, CheckSquare } from 'lucide-react'
import { ChecklistItem, Task } from '../actions'
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
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

export interface TaskFormData {
  title: string
  description: string
  is_critical: boolean
  estimated_minutes: number
  task_type: 'scheduled' | 'always'
  
  // UI State for recursion
  is_recurring: boolean

  // Date & Time
  start_date: string // YYYY-MM-DD (Single date or Start date of recursion)
  end_date: string   // YYYY-MM-DD (End date of recursion)
  start_time: string // HH:mm
  end_time: string   // HH:mm
  
  assigned_role_ids: string[]
  
  // Repeat Config
  repeat_type: 'daily' | 'weekly' | 'monthly'
  repeat_days: number[]
  repeat_interval: number
  is_last_day?: boolean // 매월 말일 여부
  
  checklist: ChecklistItem[]
  status?: 'todo' | 'in_progress' | 'done'
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
}

export function TaskForm({ 
  storeId, 
  defaultValues, 
  onSubmit, 
  onCancel, 
  loading = false,
  submitLabel = '저장',
  showDelete = false,
  onDelete,
  isEditMode = false
}: TaskFormProps) {
  const [roles, setRoles] = useState<any[]>([])
  
  // Checklist State
  const [checklist, setChecklist] = useState<ChecklistItem[]>(defaultValues?.checklist || [])
  const [newChecklistItem, setNewChecklistItem] = useState('')

  const [formData, setFormData] = useState<Omit<TaskFormData, 'checklist'>>({
    title: defaultValues?.title || '',
    description: defaultValues?.description || '',
    is_critical: defaultValues?.is_critical || false,
    estimated_minutes: defaultValues?.estimated_minutes || 30,
    task_type: defaultValues?.task_type || 'scheduled',
    is_recurring: defaultValues?.is_recurring || false,
    start_date: defaultValues?.start_date || new Date().toISOString().split('T')[0],
    end_date: defaultValues?.end_date || new Date().toISOString().split('T')[0],
    start_time: defaultValues?.start_time || '',
    end_time: defaultValues?.end_time || '',
    assigned_role_ids: defaultValues?.assigned_role_ids || ['all'],
    repeat_type: defaultValues?.repeat_type || 'daily',
    repeat_days: defaultValues?.repeat_days || [],
    repeat_interval: defaultValues?.repeat_interval || 1,
    is_last_day: defaultValues?.is_last_day || false,
    status: defaultValues?.status || 'todo'
  })

  // Load roles
  useEffect(() => {
    if (storeId) {
      getStoreRoles(storeId).then(setRoles)
    }
  }, [storeId])

  // Update checklist when defaultValues change (important for edit mode)
  useEffect(() => {
    if (defaultValues?.checklist) {
        setChecklist(defaultValues.checklist)
    }
  }, [defaultValues?.checklist])


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

  const handleMoveChecklistItem = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === checklist.length - 1) return

    const newChecklist = [...checklist]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    const [movedItem] = newChecklist.splice(index, 1)
    newChecklist.splice(targetIndex, 0, movedItem)
    setChecklist(newChecklist)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
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

  const weekDays = [
    { label: '일', value: 0 },
    { label: '월', value: 1 },
    { label: '화', value: 2 },
    { label: '수', value: 3 },
    { label: '목', value: 4 },
    { label: '금', value: 5 },
    { label: '토', value: 6 },
  ]
  
  // Quick Chips Helper
  const setQuickDuration = (months: number) => {
      const start = new Date(formData.start_date);
      // UTC 00:00 보정을 위해 날짜만 추출해서 계산하거나, 그냥 로컬 시간으로 계산 후 포맷팅
      // start_date는 YYYY-MM-DD
      
      // 안전한 날짜 계산을 위해 연/월/일 분리
      const [y, m, d] = formData.start_date.split('-').map(Number);
      
      const targetDate = new Date(y, m - 1 + months, d); // 로컬 시간 기준 계산
      
      // YYYY-MM-DD 포맷
      const year = targetDate.getFullYear();
      const month = String(targetDate.getMonth() + 1).padStart(2, '0');
      const day = String(targetDate.getDate()).padStart(2, '0');
      
      setFormData(prev => ({ ...prev, end_date: `${year}-${month}-${day}` }));
  }

  const quickOptions = {
      daily: [
          { label: '1주일', value: 0.25 }, // 7일 (대략) -> 별도 처리 필요하지만 일단 개월 수로 통일하거나 함수 분리
          { label: '1개월', value: 1 },
          { label: '3개월', value: 3 },
          { label: '6개월', value: 6 },
          { label: '1년', value: 12 },
      ],
      weekly: [
          { label: '1개월', value: 1 },
          { label: '3개월', value: 3 },
          { label: '6개월', value: 6 },
          { label: '1년', value: 12 },
      ],
      monthly: [
          { label: '3개월', value: 3 },
          { label: '6개월', value: 6 },
          { label: '1년', value: 12 },
      ]
  }

  const handleQuickChip = (value: number) => {
      if (value < 1) {
          // 1주일 (0.25) 처리
          const start = new Date(formData.start_date);
          start.setDate(start.getDate() + 7);
          const year = start.getFullYear();
          const month = String(start.getMonth() + 1).padStart(2, '0');
          const day = String(start.getDate()).padStart(2, '0');
          setFormData(prev => ({ ...prev, end_date: `${year}-${month}-${day}` }));
      } else {
          setQuickDuration(value);
      }
  }

  // 매월 반복 시 날짜 변경 핸들러
  const handleMonthlyDateChange = (day: string) => {
      const d = parseInt(day);
      if (isNaN(d) || d < 1 || d > 31) return;
      
      // start_date의 일자 변경
      const [y, m] = formData.start_date.split('-');
      const newDate = `${y}-${m}-${String(d).padStart(2, '0')}`;
      
      setFormData(prev => ({ ...prev, start_date: newDate }));
  }

  const toggleRole = (roleId: string) => {
      setFormData(prev => {
          let newIds = [...prev.assigned_role_ids];
          
          // 'all'이 포함되어 있으면 전체 ID로 변환 후 처리
          if (newIds.includes('all')) {
              newIds = roles.map(r => r.id);
          }

          if (newIds.includes(roleId)) {
              newIds = newIds.filter(id => id !== roleId);
          } else {
              newIds.push(roleId);
          }
          
          return { ...prev, assigned_role_ids: newIds };
      });
  }

  const isAllSelected = formData.assigned_role_ids.includes('all') || (roles.length > 0 && roles.every(r => formData.assigned_role_ids.includes(r.id)));

  const handleSelectAll = () => {
      setFormData(prev => {
          if (isAllSelected) {
              return { ...prev, assigned_role_ids: [] };
          } else {
              return { ...prev, assigned_role_ids: roles.map(r => r.id) };
          }
      });
  }

  return (
    <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-hidden flex flex-row divide-x h-full min-h-0">
        {/* 좌측: 기본 정보 */}
        <div className="flex-1 h-full min-w-0 relative flex flex-col">
          <ScrollArea className="flex-1 h-full">
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  업무 기본 정보
                </h3>
                
                <div className="grid gap-2">
                  <Label htmlFor="title">업무명 <span className="text-red-500">*</span></Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="예: 오픈 준비, 재고 확인"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">업무 상세 설명 (Note)</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="업무 내용을 자세히 입력하세요."
                    className="resize-none min-h-[80px]"
                  />
                </div>

                <div className="grid gap-3">
                  <Label>업무 유형</Label>
                  <RadioGroup 
                    value={formData.task_type} 
                    onValueChange={(val: any) => setFormData(prev => ({ 
                      ...prev, 
                      task_type: val,
                      is_recurring: val === 'always' ? true : prev.is_recurring // 상시 업무는 기본적으로 기간 설정 필요
                    }))}
                    className="grid grid-cols-2 gap-2"
                  >
                    <div>
                      <RadioGroupItem value="scheduled" id="type-scheduled" className="peer sr-only" />
                      <Label
                        htmlFor="type-scheduled"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer text-center h-full"
                      >
                        <Clock className="mb-2 h-4 w-4" />
                        <span className="text-xs">일반 업무 (시간 지정)</span>
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem value="always" id="type-always" className="peer sr-only" />
                      <Label
                        htmlFor="type-always"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer text-center h-full"
                      >
                        <Briefcase className="mb-2 h-4 w-4" />
                        <span className="text-xs">상시 업무 (시간 미지정)</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* 반복 설정 토글 (일반 업무일 때만, 수정 모드가 아닐 때만) */}
                {formData.task_type === 'scheduled' && !isEditMode && (
                    <div className="flex items-center justify-between space-x-2 border p-3 rounded-md bg-muted/30">
                      <Label htmlFor="is_recurring" className="flex items-center gap-2 text-sm font-medium">
                        <Calendar className="w-4 h-4" />
                        반복 설정
                      </Label>
                      <Switch
                        id="is_recurring"
                        checked={formData.is_recurring}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_recurring: checked }))}
                      />
                    </div>
                )}

                {/* 기간 및 반복 설정 (반복이거나 상시 업무일 때, 수정 모드가 아닐 때만) */}
                {(formData.is_recurring || formData.task_type === 'always') && !isEditMode && (
                  <div className="space-y-4 p-4 bg-muted/30 rounded-md border animate-in fade-in slide-in-from-top-2">
                      
                      {/* 1. 반복 주기 (Tabs) */}
                      {formData.task_type === 'scheduled' && (
                          <div className="space-y-3">
                              <Label>반복 주기</Label>
                              <Tabs 
                                  value={formData.repeat_type} 
                                  onValueChange={(val: any) => setFormData(prev => ({ ...prev, repeat_type: val }))}
                                  className="w-full"
                              >
                                  <TabsList className="grid w-full grid-cols-3">
                                      <TabsTrigger value="daily">매일</TabsTrigger>
                                      <TabsTrigger value="weekly">매주</TabsTrigger>
                                      <TabsTrigger value="monthly">매월</TabsTrigger>
                                  </TabsList>

                                  {/* 상세 조건 (Step 3) */}
                                  <div className="mt-3">
                                      <TabsContent value="daily" className="mt-0">
                                          <p className="text-xs text-muted-foreground text-center py-2 bg-background/50 rounded-md border border-dashed">
                                              매일 반복됩니다.
                                          </p>
                                      </TabsContent>

                                      <TabsContent value="weekly" className="mt-0 space-y-2">
                                          <Label className="text-xs text-muted-foreground">반복 요일</Label>
                                          <div className="flex justify-between gap-1">
                                              {weekDays.map((day) => {
                                                  const isSelected = formData.repeat_days.includes(day.value);
                                                  return (
                                                      <button
                                                          key={day.value}
                                                          type="button"
                                                          onClick={() => toggleDay(day.value)}
                                                          className={`
                                                              w-8 h-8 rounded-full text-xs flex items-center justify-center transition-all
                                                              ${isSelected 
                                                                  ? 'bg-primary text-primary-foreground font-bold ring-2 ring-primary ring-offset-1' 
                                                                  : 'bg-background hover:bg-muted text-muted-foreground border'}
                                                          `}
                                                      >
                                                          {day.label}
                                                      </button>
                                                  )
                                              })}
                                          </div>
                                      </TabsContent>

                                      <TabsContent value="monthly" className="mt-0 space-y-3">
                                          <div className="flex items-end gap-3 p-3 bg-background/50 rounded-md border border-dashed">
                                              <div className="grid gap-1.5 flex-1">
                                                  <Label className="text-xs text-muted-foreground">매월 반복일</Label>
                                                  <div className="flex items-center gap-2">
                                                      <Input 
                                                          type="number" 
                                                          min={1} 
                                                          max={31}
                                                          disabled={formData.is_last_day}
                                                          value={formData.start_date.split('-')[2]} 
                                                          onChange={(e) => handleMonthlyDateChange(e.target.value)}
                                                          className="w-16 text-center"
                                                      />
                                                      <span className="text-sm">일에 반복</span>
                                                  </div>
                                              </div>
                                              
                                              <div className="flex items-center gap-2 pb-2">
                                                  <Checkbox 
                                                      id="is_last_day"
                                                      checked={formData.is_last_day}
                                                      onCheckedChange={(checked) => setFormData(prev => ({ 
                                                          ...prev, 
                                                          is_last_day: checked === true
                                                      }))}
                                                  />
                                                  <Label htmlFor="is_last_day" className="cursor-pointer text-sm">매월 말일</Label>
                                              </div>
                                          </div>
                                      </TabsContent>
                                  </div>
                              </Tabs>
                          </div>
                      )}

                      <Separator className="my-2" />

                      {/* 2. 기간 설정 (Step 4) */}
                      <div className="space-y-3">
                          <Label>기간 설정 <span className="text-red-500">*</span></Label>
                          <div className="flex items-center gap-2">
                              <div className="grid flex-1 gap-1">
                                  <span className="text-xs text-muted-foreground">시작일</span>
                                  <Input 
                                      type="date"
                                      value={formData.start_date}
                                      onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                                  />
                              </div>
                              <span className="mt-5 text-muted-foreground">~</span>
                              <div className="grid flex-1 gap-1">
                                  <span className="text-xs text-muted-foreground">종료일</span>
                                  <Input 
                                      type="date"
                                      value={formData.end_date}
                                      onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                                  />
                              </div>
                          </div>
                          
                          {/* Quick Chips */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                              {(formData.task_type === 'always' ? quickOptions.daily : quickOptions[formData.repeat_type]).map((option) => (
                                  <Badge 
                                      key={option.label}
                                      variant="outline"
                                      className="cursor-pointer hover:bg-secondary hover:text-secondary-foreground transition-colors px-2 py-1 font-normal"
                                      onClick={() => handleQuickChip(option.value)}
                                  >
                                      + {option.label}
                                  </Badge>
                              ))}
                          </div>
                      </div>
                  </div>
                )}

                {/* 단건 날짜 설정 (반복 아닐 때 또는 수정 모드일 때) */}
                {(!formData.is_recurring || isEditMode) && (
                  <div className="space-y-3 p-3 bg-muted/30 rounded-md border animate-in fade-in slide-in-from-top-2">
                      <div className="grid gap-2">
                          <Label>수행 날짜 <span className="text-red-500">*</span></Label>
                          <Input 
                              type="date"
                              value={formData.start_date}
                              onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value, end_date: e.target.value }))}
                          />
                      </div>
                  </div>
                )}

                {/* 시간 설정 (일반 업무일 때만) */}
                {formData.task_type === 'scheduled' && (
                  <div className="grid gap-2 animate-in fade-in slide-in-from-top-2">
                      <Label>
                          수행 시간 <span className="text-red-500">*</span>
                      </Label>
                      <div className="flex items-center gap-2">
                      <div className="grid flex-1 gap-1">
                          <span className="text-xs text-muted-foreground">시작</span>
                          <Input
                          type="time"
                          value={formData.start_time}
                          onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                          />
                      </div>
                      <span className="mt-5">~</span>
                      <div className="grid flex-1 gap-1">
                          <span className="text-xs text-muted-foreground">종료</span>
                          <Input
                          type="time"
                          value={formData.end_time}
                          onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                          />
                      </div>
                      </div>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* 우측: 담당 역할 및 체크리스트 */}
        <div className="flex-1 h-full min-w-0 relative flex flex-col">
          <ScrollArea className="flex-1 h-full">
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <CheckSquare className="w-4 h-4" />
                  담당 역할 지정 및 체크리스트
                </h3>

                {/* 담당 역할 지정 (Checkbox List UI - Multi Selection) */}
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                      <Label>담당 역할 지정</Label>
                      <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-xs"
                          onClick={handleSelectAll}
                      >
                          {isAllSelected ? '전체 해제' : '전체 선택'}
                      </Button>
                  </div>
                  <div className="border rounded-md p-2 max-h-[200px] overflow-y-auto bg-card">
                      <div className="space-y-1">
                          {/* 개별 역할 목록 */}
                          {roles.map((role) => {
                              const isSelected = formData.assigned_role_ids.includes('all') || formData.assigned_role_ids.includes(role.id);
                              
                              return (
                                  <div 
                                      key={role.id}
                                      className={`
                                          flex items-center gap-3 p-2 rounded-md transition-colors text-sm
                                          ${isSelected ? 'bg-primary/10' : 'hover:bg-muted'}
                                  `}
                              >
                                  <Checkbox 
                                      id={`role-${role.id}`}
                                      checked={isSelected}
                                      onCheckedChange={() => toggleRole(role.id)}
                                  />
                                  <div 
                                    className="flex items-center gap-2 flex-1 cursor-pointer"
                                    onClick={() => toggleRole(role.id)}
                                  >
                                  <div 
                                      className="w-2 h-2 rounded-full flex-shrink-0" 
                                      style={{ backgroundColor: role.color }}
                                      />
                                      <span className="font-medium">{role.name}</span>
                                  </div>
                              </div>
                            )
                          })}
                      </div>
                  </div>
                </div>

                {/* 중요 업무 설정 */}
                <div className="flex items-center justify-between space-x-2 border p-3 rounded-md bg-muted/30">
                  <div className="space-y-0.5">
                    <Label htmlFor="is_critical" className="flex items-center gap-2 cursor-pointer">
                      중요 업무 설정
                      {formData.is_critical && <AlertTriangle className="w-3 h-3 text-red-500" />}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      체크 시 중요 업무로 강조 표시됩니다.
                    </p>
                  </div>
                  <Switch
                    id="is_critical"
                    checked={formData.is_critical}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_critical: checked }))}
                  />
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>체크리스트 ({checklist.length})</Label>
                  </div>
                  
                  <div className="flex gap-2">
                    <Input 
                      value={newChecklistItem}
                      onChange={(e) => setNewChecklistItem(e.target.value)}
                      placeholder="할 일 항목 추가"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddChecklistItem()
                        }
                      }}
                    />
                    <Button type="button" size="icon" onClick={handleAddChecklistItem}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="space-y-2 mt-2">
                    {checklist.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-md">
                        체크리스트가 없습니다.
                      </div>
                    )}
                    
                    {checklist.map((item, index) => (
                      <div key={item.id} className="group flex items-center gap-2 p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors">
                        <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleMoveChecklistItem(index, 'up')}
                            disabled={index === 0}
                            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveChecklistItem(index, 'down')}
                            disabled={index === checklist.length - 1}
                            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                        
                        <span className="flex-1 text-sm">{item.text}</span>
                        
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-red-500"
                          onClick={() => handleDeleteChecklistItem(item.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>

      <div className="p-4 border-t bg-muted/10 flex justify-between shrink-0">
        {showDelete && onDelete ? (
            <Button type="button" variant="destructive" onClick={onDelete}>
                <Trash2 className="w-4 h-4 mr-2" />
                삭제
            </Button>
        ) : (
            <div></div> // Spacer
        )}
        <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
                취소
            </Button>
            <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {submitLabel}
            </Button>
        </div>
      </div>
    </form>
  )
}