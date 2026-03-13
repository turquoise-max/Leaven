'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { X, Loader2 } from 'lucide-react'
import { cancelRequest } from '@/features/onboarding/actions'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'

interface CancelRequestButtonProps {
  storeId: string
}

export function CancelRequestButton({ storeId }: CancelRequestButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleCancel = async (e: React.MouseEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await cancelRequest(storeId)
      toast.success('매장 합류 요청이 취소되었습니다.')
      setOpen(false)
    } catch (error) {
      toast.error('합류 취소 중 오류가 발생했습니다.')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
          title="합류 취소"
        >
          <X className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>매장 합류 취소</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-muted-foreground">
              정말 이 매장에 대한 합류 요청을 취소하시겠습니까?<br />
              취소한 후 다시 가입하려면 점주님의 새로운 초대가 필요합니다.
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>돌아가기</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleCancel}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            합류 취소
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
