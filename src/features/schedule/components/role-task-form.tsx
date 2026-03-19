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
      <ScrollArea className="flex-1 p-5">
        <div className="space-y-6">
          
          {/* 업무명 & 중요도 (컴팩트 헤더) */}
          <div className="flex gap-4 items-start">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="title" className="text-sm font-medium text-muted-foreground">업무명</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="예: 오픈 준비, 매장 청소 등"
                className="text-base font-medium"
                autoFocus
                required
              />
            </div>
            <div className="shrink-0 space-y-1.5 flex flex-col items-center">
              <Label htmlFor="is_critical" className="text-sm font-medium text-muted-foreground">중요</Label>
              <div className="flex items-center gap-2 h-10 px-3 bg-muted/30 border rounded-md">
                <Switch
                  id="is_critical"
                  checked={formData.is_critical}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_critical: checked }))}
                  className="data-[state=checked]:bg-destructive"
                />
                <Star className={`w-4 h-4 ${formData.is_critical ? 'text-destructive fill-destructive' : 'text-muted-foreground'}`} />
              </div>
            </div>
          </div>

          {!hideRoleSelection && (
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
          )}

          {/* 시간 설정 */}
          <div className="space-y-2.5 bg-muted/10 p-4 rounded-lg border border-border/50">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> 업무 시간
              </Label>
              {!hideTaskType && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="is_always" className="text-xs cursor-pointer text-muted-foreground">종일(상시) 업무</Label>
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
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Label className="text-[11px] text-muted-foreground mb-1.5 block">기준 시각 (시작)</Label>
                  <TimePicker value={formData.start_time} onChange={(val) => setFormData(prev => ({ ...prev, start_time: val }))} />
                </div>
                {!hideEndTime && (
                  <>
                    <span className="text-muted-foreground/50 mt-6">~</span>
                    <div className="flex-1">
                      <Label className="text-[11px] text-muted-foreground mb-1.5 block">종료 시각</Label>
                      <TimePicker value={formData.end_time} onChange={(val) => setFormData(prev => ({ ...prev, end_time: val }))} />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 설명 */}
          <div className="space-y-2.5 pb-8">
            <Label className="text-sm font-medium text-muted-foreground">작업 설명 (선택)</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="예: 창고에서 여분 컵 미리 채워두기"
              className="resize-none h-16 text-sm"
            />
          </div>
          
        </div>
      </ScrollArea>

      <div className="p-4 border-t bg-background flex justify-between shrink-0">
        {showDelete && onDelete ? (
          <Button type="button" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={onDelete}>
            <Trash2 className="w-4 h-4 mr-2" /> 템플릿 삭제
          </Button>
        ) : <div />}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>취소</Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  )
}