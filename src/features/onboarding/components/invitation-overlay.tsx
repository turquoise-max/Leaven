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
import { acceptInvitation } from '@/features/onboarding/actions'
import { toast } from 'sonner'
import { Loader2, BellRing } from 'lucide-react'

interface InvitationOverlayProps {
  storeId: string
  storeName: string
  role: string
}

export function InvitationOverlay({ storeId, storeName, role }: InvitationOverlayProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [isLoading, setIsLoading] = useState(false)

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
    <>
      {/* 팝업이 닫혀있을 때 표시되는 알림 버튼 */}
      {!isOpen && (
        <div className="fixed top-4 right-28 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <Button 
            variant="default" 
            size="sm" 
            className="rounded-full shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground gap-2 pr-4 pl-3"
            onClick={() => setIsOpen(true)}
          >
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
            </span>
            초대장 도착
          </Button>
        </div>
      )}

      {/* 초대 수락 팝업 */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center sm:text-left">
            <div className="mx-auto sm:mx-0 bg-primary/10 p-2 rounded-full w-fit mb-2">
              <BellRing className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle>새로운 초대가 도착했습니다</DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-foreground">{storeName}</span> 매장에서 
              당신을 직원으로 초대했습니다.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 text-sm text-muted-foreground text-center sm:text-left">
            <p>수락하시면 즉시 매장 대시보드로 이동하여 근무 일정과 업무를 확인할 수 있습니다.</p>
          </div>

          <DialogFooter className="sm:justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsOpen(false)}
            >
              나중에 보기
            </Button>
            <Button 
              type="button" 
              onClick={handleAccept}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  처리 중...
                </>
              ) : (
                '초대 수락하기'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}