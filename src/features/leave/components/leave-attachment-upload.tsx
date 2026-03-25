'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Upload, X, Loader2, FileText, ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface LeaveAttachmentUploadProps {
  onUpload: (url: string | null) => void
  storeId: string
}

export function LeaveAttachmentUpload({ onUpload, storeId }: LeaveAttachmentUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 파일 크기 제한 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('파일 크기는 5MB 이하여야 합니다.')
      return
    }

    setIsUploading(true)
    const supabase = createClient()
    const fileExt = file.name.split('.').pop()
    const timestamp = new Date().getTime()
    // 파일명 정규화: 영문, 숫자, 하이픈, 언더바를 제외한 모든 문자(한글, 공백 등) 제거
    const safeName = file.name.split('.')[0].replace(/[^a-zA-Z0-9-_]/g, '')
    const filePath = `leave-attachments/${storeId}/${timestamp}_${safeName || 'file'}.${fileExt}`

    try {
      // 업로드 (버킷 이름 정정: store-documents -> store_documents)
      const { error: uploadError } = await supabase.storage
        .from('store_documents')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // 공개 URL 가져오기
      const { data: { publicUrl } } = supabase.storage
        .from('store_documents')
        .getPublicUrl(filePath)

      setFileName(file.name)
      setPreviewUrl(publicUrl)
      onUpload(publicUrl)
      toast.success('증빙 서류가 업로드되었습니다.')
    } catch (error: any) {
      console.error(error)
      toast.error('업로드 실패', { description: error.message })
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemove = () => {
    setFileName(null)
    setPreviewUrl(null)
    onUpload(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <div 
        className={cn(
          "border-2 border-dashed rounded-lg p-4 transition-colors flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted/50",
          fileName ? "border-primary/50 bg-primary/5" : "border-muted-foreground/20"
        )}
        onClick={() => !isUploading && !fileName && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-xs font-medium text-muted-foreground">업로드 중...</p>
          </div>
        ) : fileName ? (
          <div className="flex items-center justify-between w-full gap-3 px-2">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="bg-primary/10 p-2 rounded-md">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-semibold truncate">{fileName}</span>
                <span className="text-[10px] text-muted-foreground">증빙 자료 등록됨</span>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation()
                handleRemove()
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <>
            <div className="bg-muted p-3 rounded-full">
              <Upload className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold">증빙 자료 업로드</p>
              <p className="text-xs text-muted-foreground mt-1">병원 진단서, 청첩장 등 (이미지, PDF)</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}