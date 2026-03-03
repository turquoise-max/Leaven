'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { acceptInvitation } from '@/features/onboarding/actions'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface InvitationCardProps {
  storeId: string
  storeName: string
  role: string
}

export function InvitationCard({ storeId, storeName, role }: InvitationCardProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleAccept = async () => {
    setIsLoading(true)
    const result = await acceptInvitation(storeId)
    
    if (result?.error) {
      toast.error(result.error)
      setIsLoading(false)
    } else {
      toast.success('매장에 성공적으로 합류했습니다!')
      // Redirect happens in server action
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto border-primary/50 shadow-lg">
      <CardHeader className="text-center">
        <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-4">
          <span className="text-2xl">🎉</span>
        </div>
        <CardTitle className="text-xl">초대장이 도착했습니다!</CardTitle>
        <CardDescription>
          <span className="font-semibold text-foreground">{storeName}</span> 매장에서 
          <br />
          당신을 직원으로 초대했습니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center text-sm text-muted-foreground">
        수락하시면 즉시 매장 대시보드로 이동하여<br />
        근무 일정과 업무를 확인할 수 있습니다.
      </CardContent>
      <CardFooter className="flex justify-center">
        <Button 
          size="lg" 
          className="w-full" 
          onClick={handleAccept}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              처리 중...
            </>
          ) : (
            '초대 수락하고 시작하기'
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}