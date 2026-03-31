'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Check, QrCode, Link as LinkIcon, Share2, Download } from 'lucide-react'
import { toast } from 'sonner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import Image from 'next/image'

interface StoreCodeDisplayProps {
  code: string
  className?: string
}

export function StoreCodeDisplay({ code, className }: StoreCodeDisplayProps) {
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Use current origin if in browser, fallback for SSR
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://leaven.app'
  const magicLink = `${origin}/join/${code}`
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(magicLink)}`

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code)
    setCopiedCode(true)
    toast.success('매장 6자리 코드가 복사되었습니다.')
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(magicLink)
    setCopiedLink(true)
    toast.success('매직 초대 링크가 복사되었습니다.', { description: '카카오톡 등에 붙여넣기 하세요.' })
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleDownloadQR = async () => {
    try {
      const response = await fetch(qrCodeUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = `Leaven_초대_QR_${code}.png`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success('QR 코드가 다운로드되었습니다.')
    } catch (e) {
      toast.error('QR 코드 다운로드에 실패했습니다.')
    }
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className={`h-[34px] gap-1.5 shadow-sm bg-primary text-primary-foreground font-semibold border-none hover:bg-primary/90 px-4 ${className}`}>
          <Share2 className="w-4 h-4" />
          직원 초대하기
        </Button>
      </DialogTrigger>

      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[500px] p-0 overflow-hidden bg-slate-50">
        <DialogHeader className="p-6 pb-4 bg-white border-b">
          <DialogTitle className="text-xl flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" /> 매장 직원 초대하기
          </DialogTitle>
          <DialogDescription className="text-sm">
            원하는 방식으로 직원을 매장에 초대하세요.<br/>가장 쉽고 빠른 방법은 <strong>매직 링크 공유</strong>입니다.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-8">
          {/* Method 1: Magic Link */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs">1</div>
              <h4 className="font-semibold text-sm">매직 링크 복사 (카톡/문자)</h4>
            </div>
            <div className="flex items-center gap-2 bg-white p-2 rounded-lg border shadow-sm">
              <div className="flex-1 overflow-hidden">
                <p className="text-xs text-muted-foreground truncate bg-muted/30 px-3 py-2 rounded font-mono select-all">
                  {magicLink}
                </p>
              </div>
              <Button 
                onClick={handleCopyLink}
                variant={copiedLink ? "default" : "secondary"}
                className={copiedLink ? "bg-emerald-600 hover:bg-emerald-700" : ""}
              >
                {copiedLink ? <Check className="w-4 h-4 mr-1.5" /> : <LinkIcon className="w-4 h-4 mr-1.5" />}
                {copiedLink ? '복사됨' : '복사'}
              </Button>
            </div>
          </div>

          {/* Method 2: QR Code */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-700 font-bold text-xs">2</div>
              <h4 className="font-semibold text-sm">QR 코드 포스터 (매장 부착용)</h4>
            </div>
            <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl border shadow-sm space-y-4">
              <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                <img 
                  src={qrCodeUrl} 
                  alt="Store Invite QR Code" 
                  className="w-40 h-40 object-contain"
                />
              </div>
              <Button onClick={handleDownloadQR} variant="outline" className="w-full gap-2">
                <Download className="w-4 h-4" /> QR 코드 이미지 다운로드
              </Button>
            </div>
          </div>

          {/* Method 3: 6-digit Code */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 font-bold text-xs">3</div>
              <h4 className="font-semibold text-sm">직접 입력 코드</h4>
            </div>
            <div className="flex items-center justify-between p-3 bg-white rounded-lg border shadow-sm">
              <span className="text-sm font-medium text-muted-foreground">매장 고유 코드:</span>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono font-bold bg-muted/50 px-3 py-1 rounded border tracking-widest">
                  {code}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-md hover:bg-slate-100"
                  onClick={handleCopyCode}
                >
                  {copiedCode ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Copy className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  )
}
