'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { acceptInvitation, rejectInvitation } from '@/features/onboarding/actions'
import { toast } from 'sonner'

interface InvitationButtonsProps {
  storeId: string
  variant?: 'large' | 'compact'
}

export function InvitationButtons({ storeId, variant = 'large' }: InvitationButtonsProps) {
  const [loading, setLoading] = useState<'accept' | 'reject' | null>(null)

  const handleAccept = async () => {
    setLoading('accept')
    try {
      const result = await acceptInvitation(storeId)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('초대를 수락했습니다.')
      }
    } catch (error: any) {
      toast.error(error.message || '초대 수락 중 오류가 발생했습니다.')
    } finally {
      setLoading(null)
    }
  }

  const handleReject = async () => {
    setLoading('reject')
    try {
      const result = await rejectInvitation(storeId)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('초대를 거절했습니다.')
      }
    } catch (error: any) {
      toast.error(error.message || '초대 거절 중 오류가 발생했습니다.')
    } finally {
      setLoading(null)
    }
  }

  const isAccepting = loading === 'accept'
  const isRejecting = loading === 'reject'
  const isAnyLoading = loading !== null

  if (variant === 'compact') {
    return (
      <div className="flex gap-2">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleReject}
          disabled={isAnyLoading}
          className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 text-xs"
        >
          {isRejecting ? <Loader2 className="w-3 h-3 animate-spin" /> : '거절'}
        </Button>
        <Button 
          size="sm" 
          onClick={handleAccept}
          disabled={isAnyLoading}
          className="bg-primary hover:bg-primary/90 h-8 text-xs font-bold px-4"
        >
          {isAccepting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
          수락하기
        </Button>
      </div>
    )
  }

  return (
    <div className="flex gap-3">
      <Button 
        variant="outline" 
        onClick={handleReject}
        disabled={isAnyLoading}
        className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
      >
        {isRejecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        거절
      </Button>
      <Button 
        onClick={handleAccept}
        disabled={isAnyLoading}
        className="bg-primary shadow-sm font-bold"
      >
        {isAccepting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        수락하고 합류하기
      </Button>
    </div>
  )
}