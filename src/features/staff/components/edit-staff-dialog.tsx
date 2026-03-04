'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
import { updateStaffInfo, approveRequest, rejectRequest, removeStaff } from '../actions'
import { getStoreRoles } from '@/features/store/actions'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

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
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  
  // Form State
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState('')
  const [roles, setRoles] = useState<any[]>([])
  const [wageType, setWageType] = useState('hourly')
  const [baseWage, setBaseWage] = useState('0')
  const [phone, setPhone] = useState('')
  const [workHours, setWorkHours] = useState('')
  const [hiredAt, setHiredAt] = useState('')
  const [isDirty, setIsDirty] = useState(false)

  // Load roles
  useEffect(() => {
    if (storeId && open) {
      getStoreRoles(storeId).then(setRoles)
    }
  }, [storeId, open])

  // Initialize form state when staff changes
  useEffect(() => {
    if (staff) {
      setName(staff.name || staff.profile?.full_name || '')
      setEmail(staff.email || staff.profile?.email || '')
      setWageType(staff.wage_type || 'hourly')
      setBaseWage(staff.base_wage?.toString() || '0')
      setPhone(staff.phone || staff.profile?.phone || '')
      setWorkHours(staff.work_hours || '')
      // hired_at이 있으면 YYYY-MM-DD로, 없으면 joined_at 사용
      const initialDate = staff.hired_at || staff.joined_at
      setHiredAt(initialDate ? new Date(initialDate).toISOString().split('T')[0] : '')
      
      // roleId 설정 (직접 할당)
      if (staff.role_id) {
        setRoleId(staff.role_id)
      } else {
        // role_id가 없는 경우 (Legacy data), roles 목록이 로드된 후 매칭 시도
        setRoleId('') 
      }
      
      setIsDirty(false)
    }
  }, [staff])

  // Legacy role 매칭 (roles가 로드된 후)
  useEffect(() => {
    if (staff && roles.length > 0 && !staff.role_id && !roleId) {
       // role 문자열로 매핑
       // owner -> 점주 (is_system=true)
       // manager -> 매니저
       // staff -> 직원
       let matchingRole = null;
       
       if (staff.role === 'owner') {
          matchingRole = roles.find(r => r.name === '점주' || r.name === 'Owner' || (r.is_system && r.priority === 100))
       } else if (staff.role === 'manager') {
          matchingRole = roles.find(r => r.name === '매니저' || r.name === 'Manager')
       } else {
          matchingRole = roles.find(r => r.name === '직원' || r.name === 'Staff')
       }
       
       if (matchingRole) {
          setRoleId(matchingRole.id)
       } else if (roles.length > 0) {
          // 기본값: 가장 낮은 우선순위 역할
          const defaultRole = [...roles].sort((a, b) => a.priority - b.priority)[0]
          if (defaultRole) setRoleId(defaultRole.id)
       }
    }
  }, [staff, roles, roleId])

  // Check for changes
  useEffect(() => {
    if (!staff) return
    const currentBaseWage = baseWage === '' ? '0' : baseWage
    const staffBaseWage = staff.base_wage?.toString() || '0'
    const staffPhone = staff.phone || staff.profile?.phone || ''
    const staffName = staff.name || staff.profile?.full_name || ''
    const staffEmail = staff.email || staff.profile?.email || ''
    const staffWorkHours = staff.work_hours || ''
    
    const initialDate = staff.hired_at || staff.joined_at
    const staffHiredAt = initialDate ? new Date(initialDate).toISOString().split('T')[0] : ''
    
    const staffRoleId = staff.role_id || roleId // role_id가 없으면 현재 roleId와 같다고 가정(변경 없음)하여 비교

    const hasChanged = 
      name !== staffName ||
      email !== staffEmail ||
      roleId !== (staff.role_id || roleId) ||
      wageType !== (staff.wage_type || 'hourly') ||
      currentBaseWage !== staffBaseWage ||
      phone !== staffPhone ||
      workHours !== staffWorkHours ||
      hiredAt !== staffHiredAt

    setIsDirty(hasChanged)
  }, [name, email, roleId, wageType, baseWage, phone, workHours, hiredAt, staff])

  const handleSave = async (formData: FormData) => {
    if (!canManage || !staff) return

    setLoading(true)
    const result = await updateStaffInfo(storeId, staff.id, formData)
    setLoading(false)

    if (result.error) {
      toast.error('정보 수정 실패', { description: result.error })
    } else {
      // @ts-ignore
      if (result.data) {
        console.log('Updated staff data:', result.data)
      }
      toast.success('정보 수정 완료')
      router.refresh()
      onOpenChange(false)
    }
  }

  const handleApprove = async () => {
    if (!canManage || !staff) return

    setLoading(true)
    
    // 승인 시에는 항상 현재 입력된 정보로 업데이트 (입사일 등 초기값 저장을 위해)
    const formData = new FormData()
    formData.append('name', name)
    formData.append('email', email)
    formData.append('roleId', roleId)
    formData.append('wageType', wageType)
    formData.append('baseWage', baseWage)
    formData.append('phone', phone)
    formData.append('workHours', workHours)
    formData.append('hiredAt', hiredAt)
    
    const updateResult = await updateStaffInfo(storeId, staff.id, formData)
    if (updateResult.error) {
      toast.error('정보 저장 실패', { description: updateResult.error })
      setLoading(false)
      return
    }

    const result = await approveRequest(storeId, staff.id)
    setLoading(false)

    if (result.error) {
      toast.error('승인 실패', { description: result.error })
    } else {
      toast.success('승인 완료', { description: '직원의 가입 요청을 승인했습니다.' })
      router.refresh()
      onOpenChange(false)
    }
  }

  const handleReject = async () => {
    if (!canManage || !staff) return
    if (!confirm('정말 거절하시겠습니까? 해당 요청은 삭제됩니다.')) return

    setLoading(true)
    const result = await rejectRequest(storeId, staff.id)
    setLoading(false)

    if (result.error) {
      toast.error('거절 실패', { description: result.error })
    } else {
      toast.success('거절 완료', { description: '가입 요청을 거절했습니다.' })
      router.refresh()
      onOpenChange(false)
    }
  }

  const handleRemove = async () => {
    if (!canManage || !staff) return
    const displayName = name || staff.profile?.full_name || staff.name || '직원'
    if (!confirm(`'${displayName}' 직원을 퇴사 처리하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return

    setLoading(true)
    const result = await removeStaff(storeId, staff.id)
    setLoading(false)

    if (result.error) {
      toast.error('퇴사 처리 실패', { description: result.error })
    } else {
      toast.success('퇴사 처리 완료')
      router.refresh()
      onOpenChange(false)
    }
  }

  if (!staff) return null

  const isPending = staff.status === 'pending_approval'
  const displayName = staff.name || staff.profile?.full_name || '이름 없음'
  const isOwner = staff.role === 'owner' // 점주 역할 여부 (수정 불가)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-106.25 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isPending ? '가입 승인 요청' : '직원 정보 수정'}</DialogTitle>
          <DialogDescription>
            {displayName}님의 정보를 {isPending ? '확인하고 승인합니다.' : '수정합니다.'}
          </DialogDescription>
        </DialogHeader>
        
        <form action={handleSave}>
          <div className="space-y-6 py-4">
            {/* 프로필 정보 섹션 */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium leading-none text-muted-foreground">프로필 정보</h4>
              <div className="grid gap-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">이름</Label>
                  <Input
                    id="name"
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="col-span-3"
                    disabled={!canManage}
                    placeholder="이름 입력"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="email" className="text-right">이메일</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="col-span-3"
                    disabled={!canManage}
                    placeholder="이메일 입력"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="phone" className="text-right">전화번호</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="col-span-3"
                    disabled={!canManage}
                    placeholder="010-0000-0000"
                  />
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* 근무 정보 섹션 */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium leading-none text-muted-foreground">근무 정보</h4>
              <div className="grid gap-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="roleId" className="text-right">역할</Label>
                  <div className="col-span-3">
                    {isOwner ? (
                      <>
                        <Input value="점주" disabled className="bg-muted text-muted-foreground" />
                        <input type="hidden" name="roleId" value={roleId} />
                      </>
                    ) : (
                      <>
                        <Select 
                          name="roleId" 
                          value={roleId} 
                          onValueChange={setRoleId} 
                          disabled={!canManage}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="역할 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map((role) => (
                                <SelectItem key={role.id} value={role.id}>
                                    <div className="flex items-center gap-2">
                                        <div 
                                            className="w-2 h-2 rounded-full" 
                                            style={{ backgroundColor: role.color }}
                                        />
                                        {role.name}
                                    </div>
                                </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <input type="hidden" name="roleId" value={roleId} />
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="workHours" className="text-right">근무 시간</Label>
                  <Input
                    id="workHours"
                    name="workHours"
                    value={workHours}
                    onChange={(e) => setWorkHours(e.target.value)}
                    className="col-span-3"
                    disabled={!canManage}
                    placeholder="예: 주 5일, 09:00 - 18:00"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="hiredAt" className="text-right">입사일</Label>
                  <Input
                    id="hiredAt"
                    name="hiredAt"
                    type="date"
                    value={hiredAt}
                    onChange={(e) => setHiredAt(e.target.value)}
                    className="col-span-3"
                    disabled={!canManage}
                  />
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* 급여 정보 섹션 */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium leading-none text-muted-foreground">급여 정보</h4>
              <div className="grid gap-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="wageType" className="text-right">급여 유형</Label>
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
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="baseWage" className="text-right">금액</Label>
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
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
            {/* 좌측 버튼 그룹 (삭제/거절) */}
            <div className="flex gap-2">
              {canManage && !isPending && !isOwner && (
                 <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={handleRemove}
                  disabled={loading}
                >
                  퇴사 처리
                </Button>
              )}
              {canManage && isPending && (
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={handleReject}
                  disabled={loading}
                >
                  가입 거절
                </Button>
              )}
            </div>

            {/* 우측 버튼 그룹 (저장/승인) */}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                취소
              </Button>
              
              {canManage && isPending ? (
                <Button 
                  type="button" 
                  onClick={handleApprove} 
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  가입 승인
                </Button>
              ) : (
                canManage && (
                  <Button type="submit" disabled={loading || !isDirty}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    저장
                  </Button>
                )
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}