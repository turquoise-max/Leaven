'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { inviteStaff } from '../actions'
import { toast } from 'sonner'

interface InviteStaffDialogProps {
  children: React.ReactNode
  storeId: string
}

export function InviteStaffDialog({ children, storeId }: InviteStaffDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    const result = await inviteStaff(storeId, formData)
    setLoading(false)

    if (result.error) {
      toast.error('초대 실패', {
        description: result.error,
      })
    } else {
      toast.success('초대 완료', {
        description: '직원에게 초대 메일을 발송했습니다.',
      })
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>직원 초대</DialogTitle>
          <DialogDescription>
            초대할 직원의 이메일 주소를 입력해주세요.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                이메일
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="staff@example.com"
                className="col-span-3"
                required
              />
            </div>
            {/* 추후 역할 선택 기능 추가 가능 */}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? '전송 중...' : '초대 보내기'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}