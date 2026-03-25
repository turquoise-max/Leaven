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
  const [formData, setFormData] = useState<Omit<RoleTaskFormData, 'checklist'>>({
    title: defaultValues?.title || '',
    description: defaultValues?.description || '',
    is_critical: defaultValues?.is_critical || false,
    task_type: defaultValues?.task_type || 'scheduled',
    start_time: defaultValues?.start_time || '09:00',
    end_time: defaultValues?.end_time || '18:00',
    assigned_role_ids: defaultValues?.assigned_role_ids || initialRoleIds
  })

  useEffect(() => {
    if (storeId) {
      getStoreRoles(storeId).then(setRoles)
    }
  }, [storeId])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // hideEndTime이 true면 end_time을 start_time과 동일하게 설정하여 불필요한 기간 입력을 생략
    const finalData = { ...formData, checklist: [] }
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
    <form onSubmit={handleSubmit} className="flex flex-col h-full bg-background overflow-hidden">
      <ScrollArea className="flex-1 p-8">
        <div className="space-y-8">
          
          {/* 업무명 */}
          <div className="space-y-3">
            <Label htmlFor="title" className="text-[16px] font-bold text-foreground ml-1">어떤 업무인가요?</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="예: 커피 머신 전원 켜기, 홀 테이블 닦기"
              className="h-14 text-lg font-semibold px-5 rounded-2xl border-2 focus-visible:ring-primary/20 transition-all shadow-sm"
              autoFocus
              required
            />
          </div>

          {!hideRoleSelection ? (
            <>
              <Separator className="bg-border/50" />

              {/* 담당 역할 */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-muted-foreground">
                    이 업무를 수행할 직무/역할
                  </Label>
                  <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-2 text-muted-foreground hover:text-foreground" onClick={handleSelectAllRoles}>
                    {isAllSelected ? '전체 해제' : '전체 선택'}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
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
          ) : (
            // 역할 선택이 숨겨졌을 때, 초기값으로 세팅된 역할 이름을 읽기 전용 뱃지로 고정 노출
            <div className="flex items-center gap-3 bg-muted/20 p-3 rounded-lg border border-border/50 mt-2">
              <Label className="text-xs font-semibold text-muted-foreground shrink-0">대상 직무:</Label>
              <div className="flex flex-wrap gap-1.5">
                {formData.assigned_role_ids.includes('all') ? (
                  <Badge variant="secondary" className="text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/10">전체 공통 업무</Badge>
                ) : formData.assigned_role_ids.length > 0 ? (
                  roles
                    .filter(r => formData.assigned_role_ids.includes(r.id))
                    .map(r => (
                      <Badge key={r.id} variant="outline" className="text-[11px] font-medium bg-white text-[#1a1a1a] flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: r.color || '#ccc' }} />
                        {r.name}
                      </Badge>
                    ))
                ) : (
                  <span className="text-[11px] text-muted-foreground">선택 안 됨</span>
                )}
              </div>
            </div>
          )}

          {/* 시간 설정 */}
          <div className="space-y-4 bg-muted/30 p-6 rounded-2xl border-2 border-border/40 transition-all">
            <div className="flex items-center justify-between">
              <Label className="text-[15px] font-bold text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" /> 언제 해야 하나요?
              </Label>
              {!hideTaskType && (
                <div className="flex items-center gap-3 bg-background/50 px-3 py-1.5 rounded-full border">
                  <Label htmlFor="is_always" className="text-xs font-semibold cursor-pointer text-muted-foreground">하루 종일(상시)</Label>
                  <Switch 
                    id="is_always"
                    checked={isAlways}
                    onCheckedChange={(checked) => setFormData(prev => ({ 
                      ...prev, 
                      task_type: checked ? 'always' : 'scheduled'
                    }))}
                  />
                </div>
              )}
            </div>

            {(!isAlways || hideTaskType) && (
              <div className="flex items-center gap-6 pt-2">
                <div className="flex-1 space-y-2">
                  <Label className="text-[12px] font-bold text-muted-foreground ml-1 block">시작 시간</Label>
                  <TimePicker value={formData.start_time} onChange={(val) => setFormData(prev => ({ ...prev, start_time: val }))} />
                </div>
                {!hideEndTime && (
                  <>
                    <span className="text-muted-foreground/30 mt-8 font-light">~</span>
                    <div className="flex-1 space-y-2">
                      <Label className="text-[12px] font-bold text-muted-foreground ml-1 block">종료 시간</Label>
                      <TimePicker value={formData.end_time} onChange={(val) => setFormData(prev => ({ ...prev, end_time: val }))} />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 설명 */}
          <div className="space-y-2.5 pb-8">
            <Label className="text-[15px] font-bold text-foreground ml-1">상세 내용 (선택)</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="예: 창고에서 여분 컵 미리 채워두기"
              className="resize-none h-24 text-base px-4 py-3 rounded-xl border-2 transition-all focus-visible:ring-primary/20"
            />
          </div>
          
        </div>
      </ScrollArea>

      <div className="p-6 border-t bg-background flex justify-between shrink-0 bg-gradient-to-t from-muted/20 to-transparent">
        {showDelete && onDelete ? (
          <Button type="button" variant="ghost" className="h-11 px-5 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl font-semibold" onClick={onDelete}>
            <Trash2 className="w-4 h-4 mr-2" /> 삭제하기
          </Button>
        ) : <div />}
        <div className="flex gap-3">
          <Button type="button" variant="outline" className="h-11 px-6 rounded-xl font-semibold border-2" onClick={onCancel}>취소</Button>
          <Button type="submit" className="h-11 px-8 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all active:scale-95" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {submitLabel === '저장' ? '업무 추가하기' : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  )
}