'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Plus, Loader2, AlertTriangle } from 'lucide-react'
import { createTask, Task } from '../actions'
import { toast } from 'sonner'

interface CreateTaskDialogProps {
  storeId: string
  trigger?: React.ReactNode
}

export function CreateTaskDialog({ storeId, trigger }: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    is_critical: false,
    estimated_minutes: 30
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title) return

    setLoading(true)
    try {
      const result = await createTask({
        store_id: storeId,
        title: formData.title,
        description: formData.description,
        is_critical: formData.is_critical,
        estimated_minutes: formData.estimated_minutes
      })

      if (result?.error) {
        toast.error('업무 생성 실패', { description: result.error })
      } else {
        toast.success('업무가 생성되었습니다.')
        setOpen(false)
        setFormData({
          title: '',
          description: '',
          is_critical: false,
          estimated_minutes: 30
        })
      }
    } catch (error) {
      toast.error('오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            새 업무 등록
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>새 업무 등록</DialogTitle>
            <DialogDescription>
              매장에서 수행할 새로운 업무를 등록합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">업무명</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="예: 오픈 준비, 재고 확인"
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">상세 설명 (선택)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="업무 수행 방법이나 주의사항 등을 입력하세요."
                className="resize-none"
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between space-x-2 border p-3 rounded-md bg-muted/50">
              <div className="space-y-0.5">
                <Label htmlFor="is_critical" className="flex items-center gap-2">
                  중요 업무 (Critical)
                  {formData.is_critical && <AlertTriangle className="w-3 h-3 text-red-500" />}
                </Label>
                <p className="text-xs text-muted-foreground">
                  알림이 반드시 필요한 필수 업무로 지정합니다.
                </p>
              </div>
              <Switch
                id="is_critical"
                checked={formData.is_critical}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_critical: checked }))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="estimated_minutes">예상 소요 시간 (분)</Label>
              <div className="flex gap-2">
                {[10, 30, 60, 90].map((min) => (
                  <Button
                    key={min}
                    type="button"
                    variant={formData.estimated_minutes === min ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setFormData(prev => ({ ...prev, estimated_minutes: min }))}
                  >
                    {min}분
                  </Button>
                ))}
              </div>
              <Input
                type="number"
                id="estimated_minutes"
                value={formData.estimated_minutes}
                onChange={(e) => setFormData(prev => ({ ...prev, estimated_minutes: parseInt(e.target.value) || 0 }))}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              등록하기
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}