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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateStaffInfo } from '../actions'
import { toast } from 'sonner'

interface EditStaffDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  staff: any
  storeId: string
  canManage: boolean
}

export function EditStaffDialog({
  open,
  onOpenChange,
  staff,
  storeId,
  canManage,
}: EditStaffDialogProps) {
  const [loading, setLoading] = useState(false)
  const [role, setRole] = useState(staff?.role || 'staff')
  const [wageType, setWageType] = useState(staff?.wage_type || 'hourly')
  const [baseWage, setBaseWage] = useState(staff?.base_wage?.toString() || '0')

  async function handleSubmit(formData: FormData) {
    if (!canManage) return

    setLoading(true)
    const result = await updateStaffInfo(storeId, staff.user_id, formData)
    setLoading(false)

    if (result.error) {
      toast.error('정보 수정 실패', { description: result.error })
    } else {
      toast.success('정보 수정 완료')
      onOpenChange(false)
    }
  }

  if (!staff) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>직원 정보 수정</DialogTitle>
          <DialogDescription>
            {staff.profile?.full_name || staff.profile?.email}님의 정보를 수정합니다.
          </DialogDescription>
        </DialogHeader>
        
        <form action={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* 역할 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">
                역할
              </Label>
              <div className="col-span-3">
                <Select 
                  name="role" 
                  value={role} 
                  onValueChange={setRole} 
                  disabled={!canManage}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="역할 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">매니저</SelectItem>
                    <SelectItem value="staff">직원</SelectItem>
                  </SelectContent>
                </Select>
                <input type="hidden" name="role" value={role} />
              </div>
            </div>

            {/* 급여 유형 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="wageType" className="text-right">
                급여 유형
              </Label>
              <div className="col-span-3">
                <Select 
                  name="wageType" 
                  value={wageType} 
                  onValueChange={setWageType} 
                  disabled={!canManage}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="유형 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">시급</SelectItem>
                    <SelectItem value="monthly">월급</SelectItem>
                  </SelectContent>
                </Select>
                <input type="hidden" name="wageType" value={wageType} />
              </div>
            </div>

            {/* 기본급 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="baseWage" className="text-right">
                금액
              </Label>
              <Input
                id="baseWage"
                name="baseWage"
                type="number"
                value={baseWage}
                onChange={(e) => setBaseWage(e.target.value)}
                className="col-span-3"
                disabled={!canManage}
                min="0"
                step="100"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            {canManage && (
              <Button type="submit" disabled={loading}>
                저장
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}