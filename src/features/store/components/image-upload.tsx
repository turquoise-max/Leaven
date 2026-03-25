'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Upload, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface ImageUploadProps {
  currentImageUrl?: string | null
  onImageChange: (url: string | null) => void
  storeName: string
}

export function ImageUpload({ currentImageUrl, onImageChange, storeName }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setPreviewUrl(currentImageUrl || null)
  }, [currentImageUrl])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 파일 크기 제한 (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('이미지 크기는 2MB 이하여야 합니다.')
      return
    }

    // 이미지 파일 확인
    if (!file.type.startsWith('image/')) {
      toast.error('이미지 파일만 업로드할 수 있습니다.')
      return
    }

    setIsUploading(true)
    const supabase = createClient()
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `store-profiles/${fileName}`

    try {
      // 업로드
      const { error: uploadError } = await supabase.storage
        .from('store-images')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // 공개 URL 가져오기
      const { data: { publicUrl } } = supabase.storage
        .from('store-images')
        .getPublicUrl(filePath)

      setPreviewUrl(publicUrl)
      onImageChange(publicUrl)
      toast.success('이미지 업로드 완료')
    } catch (error: any) {
      toast.error('이미지 업로드 실패', { description: error.message })
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemoveImage = () => {
    setPreviewUrl(null)
    onImageChange(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-6">
      <Avatar className="w-24 h-24 border-2 border-border">
        <AvatarImage src={previewUrl || undefined} alt={storeName} />
        <AvatarFallback className="text-lg bg-muted">
          {storeName.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            {previewUrl ? '이미지 교체' : '이미지 등록'}
          </Button>
          {previewUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemoveImage}
              disabled={isUploading}
              className="text-destructive hover:text-destructive"
            >
              <X className="w-4 h-4 mr-2" />
              삭제
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          JPG, PNG, GIF (최대 2MB)
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  )
}