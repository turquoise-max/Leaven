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
      <DialogContent className="sm:max-w-md p-4 sm:p-5 w-[95vw] sm:w-[92vw] rounded-xl">
        <DialogHeader className="pb-1">
          <DialogTitle className="text-lg">나의 할 일 추가</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-sm">할 일 이름 <span className="text-red-500">*</span></Label>
            <Input 
              id="title" 
              placeholder="예: 분리수거하기, 매장 환기 등" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-8 sm:h-9"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">하위 할 일 (체크리스트)</Label>
            <div className="space-y-2">
              <div className="h-[100px] sm:h-[120px] bg-muted/10 rounded-lg p-1 border border-black/5">
                <div className="space-y-1.5 h-full overflow-y-auto pr-1 custom-scrollbar">
                  {checklist.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                      체크리스트 항목이 없습니다.
                    </div>
                  ) : (
                    checklist.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 bg-black/5 px-2 py-1.5 rounded-md">
                        <div className="w-3.5 h-3.5 rounded-sm border border-black/20 bg-white shrink-0" />
                        <span className="text-sm flex-1 leading-normal break-all min-w-0">{item.text}</span>
                        <button 
                          onClick={() => handleRemoveChecklist(item.id)}
                          className="text-muted-foreground hover:text-red-500 transition-colors p-0.5 shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="flex gap-1.5">
                <Input 
                  placeholder="항목 입력" 
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  onKeyDown={handleAddChecklist}
                  className="h-8 text-sm"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon" 
                  onClick={handleAddChecklist}
                  disabled={!newChecklistItem.trim()}
                  className="h-8 w-8 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-sm">메모 (선택)</Label>
            <Textarea 
              id="description" 
              placeholder="추가 내용을 입력하세요" 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full resize-none h-[50px] sm:h-[60px] overflow-y-auto text-sm py-1.5 sm:py-2 break-all"
              rows={2}
            />
          </div>

          <div className="space-y-2 sm:space-y-2.5 p-2.5 sm:p-3 border rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">업무 시간</Label>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  {isAnytime ? "특정 시간 없이 완료" : "업무 시작 시간 지정"}
                </p>
              </div>
              <div className="flex items-center gap-2 bg-white/50 px-2.5 py-1 rounded-full border border-black/5 shadow-sm">
                <span className="text-[11px] font-medium text-muted-foreground">종일</span>
                <Switch 
                  checked={isAnytime} 
                  onCheckedChange={setIsAnytime}
                  className="scale-90 data-[state=checked]:bg-primary"
                />
              </div>
            </div>
            
            {!isAnytime && (
              <div className="pt-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
                <TimePicker 
                  value={startTime} 
                  onChange={setStartTime} 
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1 sm:pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="h-8 sm:h-9 px-3 sm:px-4 text-sm">
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !title.trim()} className="h-8 sm:h-9 px-3 sm:px-4 text-sm">
            {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
            저장하기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}