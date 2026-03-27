'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, FileSignature, Mail, MessageCircle } from 'lucide-react'
import { formatPhoneNumber } from '@/lib/utils'

interface SendContractDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  staff: any
  storeId: string
  onSendSuccess?: () => void
}

export function SendContractDialog({
  open,
  onOpenChange,
  staff,
  storeId,
  onSendSuccess
}: SendContractDialogProps) {
  const [loading, setLoading] = useState(false)
  const [sendViaEmail, setSendViaEmail] = useState(true)
  const [sendViaKakao, setSendViaKakao] = useState(false)

  if (!staff) return null

  const isFulltime = ['fulltime', 'contract'].includes(staff.employment_type)
  const contractTypeName = isFulltime ? '정규직 근로계약서' : '단시간 근로계약서 (아르바이트)'
  
  const staffName = staff.name || staff.profile?.full_name || '직원'
  const email = staff.email || staff.profile?.email
  const phone = staff.phone || staff.profile?.phone

  const handleSend = async () => {
    if (!sendViaEmail && !sendViaKakao) {
      toast.error('발송 채널을 하나 이상 선택해주세요.')
      return
    }

    if (sendViaEmail && !email) {
      toast.error('이메일 정보가 없습니다. 이메일을 등록하거나 카카오톡을 선택해주세요.')
      return
    }

    if (sendViaKakao && !phone) {
      toast.error('전화번호 정보가 없습니다. 전화번호를 등록하거나 이메일을 선택해주세요.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId,
          staffId: staff.id,
          channels: {
            email: sendViaEmail,
            kakao: sendViaKakao
          }
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '계약서 발송에 실패했습니다.')
      }

      toast.success('계약서 발송 성공!', { 
        description: '점주님의 카카오톡(또는 이메일)으로 서명 요청이 발송되었습니다. 먼저 서명을 진행해 주세요.' 
      })
      
      if (onSendSuccess) {
        onSendSuccess()
      }
      onOpenChange(false)
    } catch (error: any) {
      toast.error('근로계약서 발송 실패', { description: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-100 rounded-lg text-purple-700">
              <FileSignature className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle>근로계약서 발송</DialogTitle>
              <DialogDescription className="mt-1">
                {staffName}님에게 서명 요청을 보냅니다.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-6 py-4">
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-100 flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-purple-900 flex items-center gap-1.5">
              💡 발송 후 진행 순서
            </span>
            <span className="text-purple-800 text-xs leading-relaxed">
              발송 시 <strong>점주님(대표자)의 카카오톡/이메일로 먼저 서명 요청</strong>이 전송됩니다.<br/>
              점주님의 서명이 완료된 후 직원에게 서명 요청이 전송됩니다.
            </span>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg border flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">적용 템플릿</span>
            <span className="font-semibold text-foreground flex items-center gap-2">
              {contractTypeName}
              <span className="text-xs font-normal text-muted-foreground bg-background px-1.5 py-0.5 rounded border">
                {isFulltime ? '정규/계약직' : '파트타임/단기'}
              </span>
            </span>
          </div>

          <div className="space-y-4">
            <Label className="text-sm font-semibold">발송 채널 선택</Label>
            
            <div className="grid gap-3">
              <label 
                htmlFor="send-email" 
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${sendViaEmail ? 'bg-primary/5 border-primary/20' : 'hover:bg-muted/50'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-md ${sendViaEmail ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">이메일 발송</span>
                    <span className="text-xs text-muted-foreground">{email || '이메일 미등록'}</span>
                  </div>
                </div>
                <Checkbox 
                  id="send-email" 
                  checked={sendViaEmail} 
                  onCheckedChange={(c) => setSendViaEmail(!!c)} 
                  disabled={!email || loading}
                />
              </label>

              {/* 카카오톡 발송 준비중
              <label 
                htmlFor="send-kakao" 
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${sendViaKakao ? 'bg-yellow-50 border-yellow-200' : 'hover:bg-muted/50'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-md ${sendViaKakao ? 'bg-yellow-100 text-yellow-700' : 'bg-muted text-muted-foreground'}`}>
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">카카오톡 발송</span>
                    <span className="text-xs text-muted-foreground">{formatPhoneNumber(phone) || '전화번호 미등록'}</span>
                  </div>
                </div>
                <Checkbox 
                  id="send-kakao" 
                  checked={sendViaKakao} 
                  onCheckedChange={(c) => setSendViaKakao(!!c)} 
                  disabled={!phone || loading}
                />
              </label>
              */}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            취소
          </Button>
          <Button onClick={handleSend} disabled={loading || (!sendViaEmail && !sendViaKakao)} className="bg-purple-600 hover:bg-purple-700 text-white">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSignature className="mr-2 h-4 w-4" />}
            발송하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}