'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Plus, Loader2, AlertTriangle, Clock, Briefcase, Trash2, CheckSquare, Users, Star } from 'lucide-react'
import { ChecklistItem } from '../task-actions'
import { Checkbox } from "@/components/ui/checkbox"
import { getStoreRoles, Role } from '@/features/store/roles'
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { TimePicker } from "@/components/ui/time-picker"
import { Badge } from "@/components/ui/badge"

export interface RoleTaskFormData {
  title: string
  description: string
  is_critical: boolean
  task_type: 'scheduled' | 'always'
  start_time: string // HH:mm
  end_time: string   // HH:mm
  assigned_role_ids: string[]
  checklist: ChecklistItem[]
}

interface RoleTaskFormProps {
  storeId: string
  defaultValues?: Partial<RoleTaskFormData>
  initialRoleIds?: string[]
  onSubmit: (data: RoleTaskFormData) => Promise<void>
  onCancel: () => void
  loading?: boolean
  submitLabel?: string
  showDelete?: boolean
  onDelete?: () => void
  hideRoleSelection?: boolean
  hideEndTime?: boolean
  hideTaskType?: boolean
}

export function RoleTaskForm({ 
  storeId, 
  defaultValues, 
  initialRoleIds = [],
  onSubmit, 
  onCancel, 
  loading = false,
  submitLabel = '저장',
  showDelete = false,
  onDelete,
  hideRoleSelection = false,
  hideEndTime = false,
  hideTaskType = false
}: RoleTaskFormProps) {
  const [roles, setRoles] = useState<Role[]>([])
  const [formData, setFormData] = useState<RoleTaskFormData>({
    title: defaultValues?.title || '',
    description: defaultValues?.description || '',
    is_critical: defaultValues?.is_critical || false,
    task_type: defaultValues?.task_type || 'scheduled',
    start_time: defaultValues?.start_time || '09:00',
    end_time: defaultValues?.end_time || '18:00',
    assigned_role_ids: defaultValues?.assigned_role_ids || initialRoleIds,
    checklist: defaultValues?.checklist || []
  })
  
  const [newChecklistItem, setNewChecklistItem] = useState('')

  useEffect(() => {
    if (storeId) {
      getStoreRoles(storeId).then(setRoles)
    }
  }, [storeId])

  const handleAddChecklistItem = (e: React.KeyboardEvent<HTMLInputElement> | React.MouseEvent<HTMLButtonElement>) => {
    // 키보드 이벤트일 경우, Enter 키가 아니거나 한글 조합 중(isComposing)일 때는 무시
    if ('key' in e) {
      if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    }
    
    e.preventDefault()

    if (newChecklistItem.trim() === '') return

    setFormData(prev => ({
      ...prev,
      checklist: [
        ...prev.checklist,
        { id: crypto.randomUUID(), text: newChecklistItem.trim(), is_completed: false }
      ]
    }))
    setNewChecklistItem('')
  }

  const handleRemoveChecklistItem = (id: string) => {
    setFormData(prev => ({
      ...prev,
      checklist: prev.checklist.filter(item => item.id !== id)
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // hideEndTime이 true면 end_time을 start_time과 동일하게 설정하여 불필요한 기간 입력을 생략
    const finalData = { ...formData }
    if (hideEndTime && finalData.task_type === 'scheduled') {
      finalData.end_time = finalData.start_time
    }
    
    onSubmit(finalData)
  }

  const toggleRole = (roleId: string) => {
    setFormData(prev => {
      let newIds = [...prev.assigned_role_ids]
      if (newIds.includes('all')) newIds = []

      if (newIds.includes(roleId)) {
        newIds = newIds.filter(id => id !== roleId)
      } else {
        newIds.push(roleId)
      }
      
      if (newIds.length === 0) newIds = ['all']
      return { ...prev, assigned_role_ids: newIds }
    })
  }

  const isAllSelected = formData.assigned_role_ids.includes('all') || (roles.length > 0 && roles.every(r => formData.assigned_role_ids.includes(r.id)))

  const handleSelectAllRoles = () => {
    setFormData(prev => ({ ...prev, assigned_role_ids: ['all'] }))
  }

  const isAlways = formData.task_type === 'always'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col flex-1 h-full min-h-0 bg-background overflow-hidden relative">
      <ScrollArea className="flex-1 px-6 py-5 h-full overflow-y-auto w-full">
        <div className="space-y-6 pb-2">
          
          {/* 업무명 & 역할 배지 */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="title" className="text-[15px] font-bold text-foreground ml-1">어떤 업무인가요?</Label>
              {hideRoleSelection && (
                <div className="flex flex-wrap gap-1">
                  {formData.assigned_role_ids.includes('all') ? (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium bg-primary/10 text-primary">전체 공통</Badge>
                  ) : formData.assigned_role_ids.length > 0 ? (
                    roles
                      .filter(r => formData.assigned_role_ids.includes(r.id))
                      .map(r => (
                        <Badge key={r.id} variant="outline" className="text-[10px] px-1.5 py-0 font-medium bg-white text-[#1a1a1a] flex items-center gap-1 border-border/50">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: r.color || '#ccc' }} />
                          {r.name}
                        </Badge>
                      ))
                  ) : null}
                </div>
              )}
            </div>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="예: 커피 머신 전원 켜기, 홀 테이블 닦기"
              className="h-11 text-[14px] font-semibold px-4 rounded-xl border-2 focus-visible:ring-primary/20 transition-all shadow-sm"
              autoFocus
              required
            />
          </div>

          {!hideRoleSelection && (
            <>
              <Separator className="bg-border/50" />

              {/* 담당 역할 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[13px] font-medium text-muted-foreground">
                    이 업무를 수행할 직무/역할
                  </Label>
                  <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-2 py-0 text-muted-foreground hover:text-foreground" onClick={handleSelectAllRoles}>
                    {isAllSelected ? '전체 해제' : '전체 선택'}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {roles.map((role) => {
                    const isSelected = formData.assigned_role_ids.includes('all') || formData.assigned_role_ids.includes(role.id)
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => toggleRole(role.id)}
                        className={`
                          flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors
                          ${isSelected ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border/60 text-muted-foreground bg-card hover:bg-muted/50'}
                        `}
                      >
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: role.color || '#ccc' }} />
                        {role.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {/* 시간 설정 */}
          <div className="space-y-3 bg-muted/20 p-3.5 rounded-xl border-2 border-border/30 transition-all">
            <div className="flex items-center justify-between">
              <Label className="text-[13px] font-bold text-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary" /> 언제 해야 하나요?
              </Label>
              {!hideTaskType && (
                <div className="flex items-center gap-2 bg-background/80 px-2 py-1 rounded-full border shadow-sm h-7">
                  <Label htmlFor="is_always" className="text-[11px] font-semibold cursor-pointer text-muted-foreground ml-1">상시 업무</Label>
                  <Switch 
                    id="is_always"
                    checked={isAlways}
                    onCheckedChange={(checked) => setFormData(prev => ({ 
                      ...prev, 
                      task_type: checked ? 'always' : 'scheduled'
                    }))}
                    className="scale-75 origin-right"
                  />
                </div>
              )}
            </div>

            {(!isAlways || hideTaskType) && (
              <div className="flex items-center gap-2 pt-1 pb-1">
                <TimePicker value={formData.start_time} onChange={(val) => setFormData(prev => ({ ...prev, start_time: val }))} />
                {!hideEndTime && (
                  <>
                    <span className="text-muted-foreground/40 font-light px-1">~</span>
                    <TimePicker value={formData.end_time} onChange={(val) => setFormData(prev => ({ ...prev, end_time: val }))} />
                  </>
                )}
              </div>
            )}
          </div>

          {/* 체크리스트 */}
          <div className="space-y-2.5">
            <Label className="text-[14px] font-bold text-foreground ml-1 flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-primary" /> 
              세부 체크리스트 <span className="text-muted-foreground font-normal text-[11px] ml-1">(선택사항)</span>
            </Label>
            
            <div className="flex gap-2">
              <Input
                value={newChecklistItem}
                onChange={(e) => setNewChecklistItem(e.target.value)}
                onKeyDown={handleAddChecklistItem}
                placeholder="예: 커피머신 온도 확인하기"
                className="h-10 rounded-lg text-sm"
              />
              <Button 
                type="button" 
                variant="secondary"
                onClick={handleAddChecklistItem}
                disabled={newChecklistItem.trim() === ''}
                className="h-10 px-4 rounded-lg font-medium text-sm shrink-0"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> 추가
              </Button>
            </div>
            
            {formData.checklist.length > 0 && (
              <div className="mt-3 bg-muted/20 rounded-xl border border-border/50 overflow-hidden flex flex-col max-h-[150px]">
                <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                  <div className="flex flex-col gap-1.5">
                    {formData.checklist.map((item, index) => (
                      <div key={item.id} className="flex items-center justify-between group bg-background p-1.5 px-2.5 rounded-md border shadow-sm shrink-0">
                        <div className="flex items-center gap-2 overflow-hidden min-w-0">
                          <div className="w-4 h-4 rounded border-2 border-primary/30 flex items-center justify-center shrink-0">
                            <span className="text-[9px] font-bold text-primary/50 leading-none">{index + 1}</span>
                          </div>
                          <span className="text-[13px] font-medium truncate">{item.text}</span>
                        </div>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={() => handleRemoveChecklistItem(item.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 설명 */}
          <div className="space-y-2 pb-2 mt-4">
            <Label className="text-[14px] font-bold text-foreground ml-1">기타 상세 내용 (선택)</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="추가적으로 알아야 할 설명이나 유의사항을 적어주세요."
              className="resize-none h-20 text-sm px-3 py-2.5 rounded-lg border-2 transition-all focus-visible:ring-primary/20"
            />
          </div>
          
        </div>
      </ScrollArea>

      <div className="px-6 py-4 border-t bg-background flex justify-between items-center shrink-0 z-[50] w-full relative shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] mt-auto">
        {showDelete && onDelete ? (
          <Button type="button" variant="ghost" className="h-10 px-4 text-[13px] text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg font-semibold" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> 삭제하기
          </Button>
        ) : <div />}
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="h-10 px-4 rounded-lg font-semibold border-2 text-[13px]" onClick={onCancel}>취소</Button>
          <Button type="submit" className="h-10 px-6 rounded-lg font-bold shadow-md shadow-primary/20 transition-all active:scale-95 text-[13px]" disabled={loading}>
            {loading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            {submitLabel === '저장' ? '루틴 추가하기' : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  )
}