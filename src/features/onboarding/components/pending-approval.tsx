'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cancelRequest } from '@/features/onboarding/actions'
import { toast } from 'sonner'
import { Loader2, Clock } from 'lucide-react'

interface PendingApprovalProps {
  storeId: string
  storeName: string
}

export function PendingApproval({ storeId, storeName }: PendingApprovalProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleCancel = async () => {
    if (!confirm('정말 가입 요청을 취소하시겠습니까?')) return

    setIsLoading(true)
    const result = await cancelRequest(storeId)
    
    if (result?.error) {
      toast.error(result.error)
      setIsLoading(false)
    } else {
      toast.info('가입 요청이 취소되었습니다.')
      // Revalidate path happens in server action
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto bg-amber-100 p-3 rounded-full w-fit mb-4">
          <Clock className="h-6 w-6 text-amber-600" />
        </div>
        <CardTitle className="text-xl">승인 대기 중</CardTitle>
        <CardDescription>
          <span className="font-semibold text-foreground">{storeName}</span> 매장에<br />
          가입 요청을 보냈습니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center text-sm text-muted-foreground">
        점주님의 승인이 완료되면<br />
        알림을 보내드리겠습니다.<br />
        잠시만 기다려주세요.
      </CardContent>
      <CardFooter className="flex justify-center">
        <Button 
          variant="ghost" 
          className="text-red-500 hover:text-red-600 hover:bg-red-50" 
          onClick={handleCancel}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              취소 중...
            </>
          ) : (
            '가입 요청 취소하기'
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}