'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { TimePicker } from '@/components/ui/time-picker'
import { getTodayDateString } from '@/shared/lib/date-utils'
import { createPersonalDashboardTask } from '../task-actions'
import { toast } from 'sonner'
import { Loader2, Plus, X } from 'lucide-react'

interface CreatePersonalTaskDialogProps {
  storeId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CreatePersonalTaskDialog({ storeId, open, onOpenChange, onSuccess }: CreatePersonalTaskDialogProps) {
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isAnytime, setIsAnytime] = useState(false)
  const [startTime, setStartTime] = useState('09:00')
  const [checklist, setChecklist] = useState<{ id: string, text: string, is_completed: boolean }[]>([])
  const [newChecklistItem, setNewChecklistItem] = useState('')

  const handleAddChecklist = (e?: React.KeyboardEvent | React.MouseEvent) => {
    if (e && 'key' in e) {
      if (e.key !== 'Enter') return
      // 한글 입력기(IME) 조합 중 엔터 쳤을 때 중복 입력되는 현상 방지
      if (e.nativeEvent.isComposing) return
    }
    if (e) e.preventDefault()
    
    if (!newChecklistItem.trim()) return
    
    setChecklist([
      ...checklist,
      {
        id: crypto.randomUUID(),
        text: newChecklistItem.trim(),
        is_completed: false
      }
    ])
    setNewChecklistItem('')
  }

  const handleRemoveChecklist = (id: string) => {
    setChecklist(checklist.filter(item => item.id !== id))
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('업무 내용을 입력해주세요.')
      return
    }

    setLoading(true)
    try {
      const today = getTodayDateString()
      
      const result = await createPersonalDashboardTask({
        store_id: storeId,
        title,
        description,
        task_type: isAnytime ? 'always' : 'scheduled',
        start_time: isAnytime ? null : startTime,
        assigned_date: today,
        checklist
      })

      if (result.error) {
        toast.error('오류 발생: ' + result.error)
      } else {
        toast.success('개인 업무가 추가되었습니다.')
        
        // Reset form
        setTitle('')
        setDescription('')
        setIsAnytime(false)
        setStartTime('09:00')
        setChecklist([])
        setNewChecklistItem('')
        
        onSuccess()
        onOpenChange(false)
      }
    } catch (error) {
      console.error(error)
      toast.error('업무 등록 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>새 개인 업무 추가</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">업무 내용 <span className="text-red-500">*</span></Label>
            <Input 
              id="title" 
              placeholder="예: 매장 청소 마무리" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-3">
            <Label>체크리스트 (선택)</Label>
            <div className="space-y-2">
              {checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-2 bg-black/5 px-3 py-2 rounded-md">
                  <div className="w-4 h-4 rounded-sm border border-black/20 bg-white shrink-0" />
                  <span className="text-sm flex-1">{item.text}</span>
                  <button 
                    onClick={() => handleRemoveChecklist(item.id)}
                    className="text-muted-foreground hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input 
                  placeholder="체크리스트 항목 추가..." 
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  onKeyDown={handleAddChecklist}
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon" 
                  onClick={handleAddChecklist}
                  disabled={!newChecklistItem.trim()}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">상세 설명 (선택)</Label>
            <Textarea 
              id="description" 
              placeholder="필요한 경우 상세 내용을 입력하세요" 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg bg-black/5">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">시간 지정 없음 (상시 업무)</Label>
              <p className="text-[12px] text-muted-foreground">오늘 중 언제든 수행할 수 있는 업무</p>
            </div>
            <Switch 
              checked={isAnytime} 
              onCheckedChange={setIsAnytime} 
            />
          </div>

          {!isAnytime && (
            <div className="space-y-2">
              <Label>업무 시간</Label>
              <TimePicker 
                value={startTime} 
                onChange={setStartTime} 
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !title.trim()}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            추가하기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}