'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { createAnnouncement, updateAnnouncement } from '../announcement-actions'
import { toast } from 'sonner'

interface AnnouncementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  storeId: string
  initialData?: {
    id: string
    title: string
    content: string
    is_important: boolean
  } | null
}

export function AnnouncementDialog({ open, onOpenChange, storeId, initialData }: AnnouncementDialogProps) {
  const [loading, setLoading] = useState(false)
  
  const isEditing = !!initialData

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    
    // Checkbox is not included in formData if not checked, so handle it explicitly
    const isImportant = formData.get('is_important') === 'on' ? 'true' : 'false'
    formData.set('is_important', isImportant)

    try {
      let result
      if (isEditing) {
        result = await updateAnnouncement(initialData.id, storeId, formData)
      } else {
        result = await createAnnouncement(storeId, formData)
      }

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(isEditing ? '공지사항이 수정되었습니다.' : '공지사항이 등록되었습니다.')
        onOpenChange(false)
      }
    } catch (error) {
      console.error(error)
      toast.error('오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] w-[95vw]">
        <DialogHeader>
          <DialogTitle>{isEditing ? '공지사항 수정' : '새 공지사항 작성'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="title">제목</Label>
            <Input 
              id="title" 
              name="title" 
              placeholder="공지사항 제목을 입력하세요" 
              defaultValue={initialData?.title || ''} 
              required 
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="content">내용</Label>
            <Textarea
              id="content"
              name="content"
              placeholder="공지사항 내용을 입력하세요"
              defaultValue={initialData?.content || ''}
              className="min-h-[150px] max-h-[300px] resize-y w-full whitespace-pre-wrap break-all"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox 
              id="is_important" 
              name="is_important" 
              defaultChecked={initialData?.is_important || false} 
            />
            <Label htmlFor="is_important" className="cursor-pointer">
              중요 공지 (상단 고정 및 강조 표시)
            </Label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              취소
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? '저장 중...' : isEditing ? '수정하기' : '등록하기'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}