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
import { inviteStaff, createManualStaff } from '@/features/staff/actions'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface InviteStaffDialogProps {
  children: React.ReactNode
  storeId: string
}

export function InviteStaffDialog({ children, storeId }: InviteStaffDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // 1. 초대하기 핸들러
  async function handleInviteSubmit(formData: FormData) {
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

  // 2. 수기 등록 핸들러
  async function handleManualSubmit(formData: FormData) {
    setLoading(true)
    const result = await createManualStaff(storeId, formData)
    setLoading(false)

    if (result.error) {
      toast.error('등록 실패', {
        description: result.error,
      })
    } else {
      toast.success('등록 완료', {
        description: '직원을 목록에 추가했습니다.',
      })
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-125">
        <DialogHeader>
          <DialogTitle>직원 추가</DialogTitle>
          <DialogDescription>
            직원을 이메일로 초대하거나, 정보를 직접 입력하여 등록할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="invite" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="invite">초대하기</TabsTrigger>
            <TabsTrigger value="manual">직접 등록</TabsTrigger>
          </TabsList>
          
          {/* Tab 1: 초대하기 */}
          <TabsContent value="invite">
            <form action={handleInviteSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="staff@example.com"
                  required
                />
                <p className="text-sm text-muted-foreground">
                  직원이 가입 후 이메일을 확인하여 수락하면 목록에 추가됩니다.
                </p>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={loading}>
                  {loading ? '전송 중...' : '초대 메일 발송'}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          {/* Tab 2: 직접 등록 */}
          <TabsContent value="manual">
            <form action={handleManualSubmit} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">이름 (필수)</Label>
                  <Input id="name" name="name" placeholder="홍길동" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">직책</Label>
                  <Select name="role" defaultValue="staff">
                    <SelectTrigger>
                      <SelectValue placeholder="직책 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">직원 (Staff)</SelectItem>
                      <SelectItem value="manager">매니저 (Manager)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">전화번호 (선택)</Label>
                <Input id="phone" name="phone" placeholder="010-1234-5678" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="wageType">급여 형태</Label>
                  <Select name="wageType" defaultValue="hourly">
                    <SelectTrigger>
                      <SelectValue placeholder="형태 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">시급</SelectItem>
                      <SelectItem value="daily">일급</SelectItem>
                      <SelectItem value="monthly">월급</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="baseWage">급여액 (원)</Label>
                  <Input 
                    id="baseWage" 
                    name="baseWage" 
                    type="number" 
                    placeholder="10000" 
                    defaultValue="0"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={loading}>
                  {loading ? '등록 중...' : '직원 등록'}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}