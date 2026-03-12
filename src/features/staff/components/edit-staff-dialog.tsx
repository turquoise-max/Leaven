'use client'

import { useState, useEffect, useMemo } from 'react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { updateStaffInfo, approveRequest, rejectRequest, removeStaff } from '../actions'
import { getStoreRoles, getStoreSettings } from '@/features/store/actions'
import { toast } from 'sonner'
import { Loader2, User, FileSignature, Check, X, Mail, Phone } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

// 분리된 UI 컴포넌트 임포트
import { 
  PersonalInfoTab, 
  WorkSettingsTab, 
  ContractSettingsTab,
  StaffFormData
} from './edit-staff-tabs'
import { SendContractDialog } from './send-contract-dialog'

interface EditStaffDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  staff: any
  storeId: string
  canManage: boolean
}

const DEFAULT_SCHEDULES = Array.from({ length: 7 }, (_, i) => ({
  day: i, start_time: '09:00', end_time: '18:00', break_minutes: 60, is_holiday: true
}))

const DEFAULT_FORM_DATA: StaffFormData = {
  name: '', email: '', phone: '', memo: '', roleId: '',
  employmentType: 'parttime', wageType: 'hourly', baseWage: '0',
  hiredAt: '', address: '', birthDate: '', emergencyContact: '',
  customPayDay: '', weeklyHoliday: '', contractEndDate: '',
  insuranceStatus: { employment: false, industrial: false, national: false, health: false },
  workSchedules: DEFAULT_SCHEDULES,
  customWageSettings: {
    is_custom: false,
    wage_period_type: 'default',
    wage_start_day: '1',
    wage_end_day: '0',
    pay_month: 'next',
    is_pay_day_last: false,
    pay_day: '10'
  }
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
  const isCreateMode = !staff
  
  const [roles, setRoles] = useState<any[]>([])
  const [storeSettings, setStoreSettings] = useState<any>(null)
  const [formData, setFormData] = useState<StaffFormData>(DEFAULT_FORM_DATA)
  const [isDirty, setIsDirty] = useState(false)
  const [showSendDialog, setShowSendDialog] = useState(false)

  const handleFormChange = (updates: Partial<StaffFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }))
    setIsDirty(true)
  }

  // Calculate Weekly Total Minutes
  const weeklyTotalMinutes = useMemo(() => {
    const schedules = formData?.workSchedules || []
    return schedules.reduce((acc, sch) => {
      if (!sch.is_holiday && sch.start_time && sch.end_time) {
        const [startH, startM] = sch.start_time.split(':').map(Number)
        const [endH, endM] = sch.end_time.split(':').map(Number)
        let diff = (endH * 60 + endM) - (startH * 60 + startM)
        if (diff < 0) diff += 24 * 60
        diff -= (sch.break_minutes || 0)
        if (diff < 0) diff = 0
        return acc + diff
      }
      return acc
    }, 0)
  }, [formData?.workSchedules])

  const isOver15Hours = weeklyTotalMinutes >= 15 * 60

  // Load roles & store settings
  useEffect(() => {
    if (storeId && open) {
      getStoreRoles(storeId).then(setRoles)
      getStoreSettings(storeId).then(setStoreSettings)
    }
  }, [storeId, open])

  // Initialize form state
  useEffect(() => {
    if (open) {
      if (staff) {
        const initialDate = staff.hired_at || staff.joined_at
        
        const newFormData: StaffFormData = {
          name: staff.name || staff.profile?.full_name || '',
          email: staff.email || staff.profile?.email || '',
          phone: staff.phone || staff.profile?.phone || '',
          memo: staff.memo || '',
          roleId: staff.role_id || '',
          employmentType: staff.employment_type || 'parttime',
          wageType: staff.wage_type || 'hourly',
          baseWage: staff.base_wage?.toString() || '0',
          hiredAt: initialDate ? new Date(initialDate).toISOString().split('T')[0] : '',
          address: staff.address || '',
          birthDate: staff.birth_date || '',
          emergencyContact: staff.emergency_contact || '',
          customPayDay: staff.custom_pay_day?.toString() || '',
          weeklyHoliday: staff.weekly_holiday?.toString() || '',
          contractEndDate: staff.contract_end_date ? new Date(staff.contract_end_date).toISOString().split('T')[0] : '',
          insuranceStatus: {
            employment: staff.insurance_status?.employment || false,
            industrial: staff.insurance_status?.industrial || false,
            national: staff.insurance_status?.national || false,
            health: staff.insurance_status?.health || false
          },
          workSchedules: (staff.work_schedules && Array.isArray(staff.work_schedules) && staff.work_schedules.length > 0)
            ? staff.work_schedules
            : DEFAULT_SCHEDULES,
          customWageSettings: staff.custom_wage_settings || {
            is_custom: false,
            wage_period_type: 'default',
            wage_start_day: '1',
            wage_end_day: '0',
            pay_month: 'next',
            is_pay_day_last: false,
            pay_day: '10'
          }
        }
        setFormData(newFormData)
        setIsDirty(false)
      } else {
        setFormData({
          ...DEFAULT_FORM_DATA,
          hiredAt: new Date().toISOString().split('T')[0]
        })
        setIsDirty(false)
      }
    }
  }, [staff, open])

  // Legacy role matching logic
  useEffect(() => {
    if (staff && roles.length > 0 && !staff.role_id && !formData.roleId) {
       let matchingRole = null;
       if (staff.role === 'owner') {
          matchingRole = roles.find(r => r.name === '점주' || r.name === 'Owner' || (r.is_system && r.priority === 100))
       } else if (staff.role === 'manager') {
          matchingRole = roles.find(r => r.name === '매니저' || r.name === 'Manager')
       } else {
          matchingRole = roles.find(r => r.name === '직원' || r.name === 'Staff')
       }
       
       if (matchingRole) {
          handleFormChange({ roleId: matchingRole.id })
       } else if (roles.length > 0) {
          const defaultRole = [...roles].sort((a, b) => a.priority - b.priority)[0]
          if (defaultRole) handleFormChange({ roleId: defaultRole.id })
       }
    }
  }, [staff, roles, formData.roleId])

  // Create FormData object from state for API calls
  const buildFormDataForSubmit = () => {
    const fd = new FormData()
    Object.entries(formData).forEach(([key, value]) => {
      if (key === 'workSchedules' || key === 'insuranceStatus' || key === 'customWageSettings') {
        fd.append(key, JSON.stringify(value))
      } else if (value !== null && value !== undefined) {
        fd.append(key, value.toString())
      }
    })
    
    // Override insurance with logic
    const finalInsuranceStatus = {
      employment: isOver15Hours ? true : formData.insuranceStatus.employment,
      industrial: true,
      national: isOver15Hours ? true : formData.insuranceStatus.national,
      health: isOver15Hours ? true : formData.insuranceStatus.health,
    }
    fd.set('insuranceStatus', JSON.stringify(finalInsuranceStatus))
    return fd
  }

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!canManage || isResigned) return

    setLoading(true)
    const submitData = buildFormDataForSubmit()

    if (isCreateMode) {
      const { createManualStaff } = await import('../actions')
      if (!formData.name) {
        toast.error('이름을 입력해주세요.')
        setLoading(false)
        return
      }
      const result = await createManualStaff(storeId, submitData) as any
      setLoading(false)
      if (result?.error) {
        toast.error('등록 실패', { description: result.error })
      } else {
        toast.success('수기 등록 완료')
        router.refresh()
        onOpenChange(false)
      }
    } else {
      const result = await updateStaffInfo(storeId, staff.id, submitData) as any
      setLoading(false)
      if (result?.error) {
        toast.error('정보 수정 실패', { description: result.error })
      } else {
        toast.success('정보 수정 완료')
        router.refresh()
        onOpenChange(false)
      }
    }
  }

  const handleApprove = async () => {
    if (!canManage || !staff || isResigned) return

    setLoading(true)
    const submitData = buildFormDataForSubmit()
    
    const updateResult = await updateStaffInfo(storeId, staff.id, submitData) as any
    if (updateResult?.error) {
      toast.error('정보 저장 실패', { description: updateResult.error })
      setLoading(false)
      return
    }

    const result = await approveRequest(storeId, staff.id) as any
    setLoading(false)

    if (result?.error) {
      toast.error('승인 실패', { description: result.error })
    } else {
      toast.success('승인 완료')
      router.refresh()
      onOpenChange(false)
    }
  }

  const handleReject = async () => {
    if (!canManage || !staff) return
    if (!confirm('정말 거절하시겠습니까?')) return

    setLoading(true)
    const result = await rejectRequest(storeId, staff.id) as any
    setLoading(false)

    if (result?.error) {
      toast.error('거절 실패', { description: result.error })
    } else {
      toast.success('거절 완료')
      router.refresh()
      onOpenChange(false)
    }
  }

  const handleRemove = async () => {
    if (!canManage || !staff) return
    if (!confirm('정말 퇴사 처리하시겠습니까?')) return

    setLoading(true)
    const result = await removeStaff(storeId, staff.id) as any
    setLoading(false)

    if (result?.error) {
      toast.error('퇴사 처리 실패', { description: result.error })
    } else {
      toast.success('퇴사 처리 완료')
      router.refresh()
      onOpenChange(false)
    }
  }

  const handleSendContractClick = () => {
    if (!canManage || !staff) return
    setShowSendDialog(true)
  }

  const isPending = staff?.status === 'pending_approval' || staff?.status === 'invited'
  const isContractSent = staff?.contract_status === 'sent'
  const isOwner = staff?.role === 'owner'
  const isResigned = !!staff?.resigned_at
  const canEdit = canManage && !isResigned
  const displayName = formData.name || staff?.profile?.full_name || (isCreateMode ? '신규 등록' : '이름 없음')
  const displayEmail = formData.email || staff?.profile?.email || ''
  const avatarUrl = staff?.profile?.avatar_url

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 py-4 border-b bg-muted/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
               {isResigned ? <User className="w-5 h-5" /> : (isPending ? <FileSignature className="w-5 h-5" /> : <User className="w-5 h-5" />)}
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">
                {isCreateMode ? '직원 수기 등록' : isResigned ? '퇴사자 정보 열람' : isPending ? '근로 조건 설정 및 계약' : '직원 정보 상세/수정'}
              </DialogTitle>
              <DialogDescription className="text-sm mt-0.5">
                {isCreateMode ? '이메일 초대 없이 직접 직원의 정보를 입력하여 등록합니다.' : isResigned ? `${displayName}님의 과거 재직 기록을 조회합니다. (수정 불가)` : isPending ? `새로 합류할 ${displayName}님의 근로 조건을 기입하고 계약을 진행하세요.` : `${displayName}님의 세부 정보, 권한, 스케줄을 관리합니다.`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSave} className={cn("flex-1 overflow-hidden flex flex-col min-h-0", isResigned && "opacity-95")}>
          <div className="p-6 pb-4 flex flex-col gap-6 shrink-0">
            {/* Profile Header */}
            {isPending && isContractSent && (
              <div className="bg-blue-50/50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-sm font-medium">직원에게 전자 근로계약서가 발송되었습니다. 서명이 완료되면 자동으로 재직중으로 이관됩니다.</span>
                </div>
              </div>
            )}
            <div className="flex items-center gap-6 p-6 bg-muted/20 rounded-xl border">
               <Avatar className="h-20 w-20 border-2 border-background shadow-sm shrink-0">
                 <AvatarImage src={avatarUrl} />
                 <AvatarFallback className="text-xl bg-primary/10 text-primary font-medium">
                   {displayName.slice(0, 2)}
                 </AvatarFallback>
               </Avatar>
               <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                 <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-xl font-bold text-foreground truncate">{displayName}</h3>
                    {formData.roleId && (
                       <div className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide border bg-background/50 shadow-sm"
                            style={{ 
                              borderColor: `${roles.find(r => r.id === formData.roleId)?.color || '#ccc'}40`,
                              color: roles.find(r => r.id === formData.roleId)?.color || '#333'
                            }}>
                          {roles.find(r => r.id === formData.roleId)?.name || '직원'}
                       </div>
                     )}
                     <div className={cn(
                       "px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide shadow-sm",
                       isResigned ? "bg-red-50 text-red-700 border border-red-200" : 
                       (isPending && isContractSent) ? "bg-blue-100 text-blue-700 border-blue-200" :
                       isPending ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-muted text-muted-foreground border"
                     )}>
                       {isCreateMode ? '가입 대기 예정' : isResigned ? '퇴사자' : (isPending ? (isContractSent ? '서명 대기 중' : '승인 대기') : '재직중')}
                     </div>
                 </div>
                 <div className="text-sm text-muted-foreground flex gap-3 flex-wrap">
                    {displayEmail && <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{displayEmail}</span>}
                    {formData.phone && <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{formData.phone}</span>}
                 </div>
               </div>
            </div>
          </div>

          <Tabs defaultValue="personal" className="flex-1 flex flex-col min-h-0 w-full px-6">
             <TabsList className="grid w-full grid-cols-3 mb-2 h-11 p-1 bg-muted/50 rounded-lg shrink-0">
                <TabsTrigger value="personal" className="text-sm font-medium h-9 data-[state=active]:shadow-sm">개인 정보</TabsTrigger>
                <TabsTrigger value="work" className="text-sm font-medium h-9 data-[state=active]:shadow-sm">근무 설정</TabsTrigger>
                <TabsTrigger value="contract" className="text-sm font-medium h-9 data-[state=active]:shadow-sm">급여 및 계약서 정보</TabsTrigger>
             </TabsList>

             <div className="flex-1 min-h-0 relative">
               <TabsContent value="personal" className="h-full min-h-0 mt-0 focus-visible:outline-none data-[state=active]:flex data-[state=active]:flex-col">
                  <ScrollArea className="flex-1 h-full -mx-6 px-6">
                    <div className="pb-6 pt-2">
                      <PersonalInfoTab 
                        formData={formData} 
                        onChange={handleFormChange} 
                        canEdit={canEdit} 
                      />
                    </div>
                  </ScrollArea>
               </TabsContent>

               <TabsContent value="work" className="h-full min-h-0 mt-0 focus-visible:outline-none data-[state=active]:flex data-[state=active]:flex-col">
                  <ScrollArea className="flex-1 h-full -mx-6 px-6">
                    <div className="pb-6 pt-2">
                      <WorkSettingsTab 
                        formData={formData} 
                        onChange={handleFormChange} 
                        canEdit={canEdit} 
                        roles={roles} 
                        isOwner={isOwner} 
                        weeklyTotalMinutes={weeklyTotalMinutes} 
                      />
                    </div>
                  </ScrollArea>
               </TabsContent>

               <TabsContent value="contract" className="h-full min-h-0 mt-0 focus-visible:outline-none data-[state=active]:flex data-[state=active]:flex-col">
                  <ScrollArea className="flex-1 h-full -mx-6 px-6">
                    <div className="pb-6 pt-2">
                      <ContractSettingsTab 
                        formData={formData} 
                        onChange={handleFormChange} 
                        canEdit={canEdit} 
                        weeklyTotalMinutes={weeklyTotalMinutes} 
                        isOver15Hours={isOver15Hours} 
                        storeSettings={storeSettings}
                      />
                    </div>
                  </ScrollArea>
               </TabsContent>
             </div>
          </Tabs>

          <DialogFooter className="px-6 py-4 border-t bg-muted/10 flex items-center justify-between sm:justify-between shrink-0 pointer-events-auto">
            {isResigned ? (
               <div className="flex w-full justify-end">
                 <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-24">
                   닫기
                 </Button>
               </div>
            ) : (
              <>
                <div className="flex gap-2">
                  {canEdit && !isPending && !isOwner && (
                     <Button 
                      type="button" 
                      variant="destructive" 
                      onClick={handleRemove}
                      disabled={loading}
                      className="bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50 border-none shadow-none"
                    >
                      퇴사 처리
                    </Button>
                  )}
                  {canEdit && isPending && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handleReject}
                      disabled={loading}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    >
                      <X className="w-4 h-4 mr-1.5" />
                      가입 거절
                    </Button>
                  )}
                </div>

                <div className="flex gap-2">
                  {canEdit && isPending && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handleApprove} 
                      disabled={loading}
                    >
                      {isContractSent ? '서명 없이 즉시 합류' : '발송 없이 즉시 합류'}
                    </Button>
                  )}

                  {canEdit && (isPending || !isOwner) && (
                    <Button 
                      type="button" 
                      variant={isPending && !isContractSent ? 'default' : 'secondary'}
                      onClick={handleSendContractClick} 
                      disabled={loading}
                      className={cn(
                        "shadow-sm",
                        isPending && !isContractSent ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-purple-100 text-purple-700 hover:bg-purple-200 hover:text-purple-800"
                      )}
                    >
                      <FileSignature className="mr-2 h-4 w-4" />
                      {isPending && !isContractSent ? '근로계약서 발송' : (isContractSent ? '계약서 재발송' : '계약서 재발송')}
                    </Button>
                  )}
                  
                  {(!isPending && canEdit) && (
                    <Button type="submit" disabled={loading} className="w-32 shadow-sm">
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      정보 저장
                    </Button>
                  )}
                  {isPending && isContractSent && (
                    <Button type="submit" disabled={loading} className="w-32 shadow-sm" variant="outline">
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      정보만 임시저장
                    </Button>
                  )}
                </div>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>

      <SendContractDialog
        open={showSendDialog}
        onOpenChange={setShowSendDialog}
        staff={staff}
        storeId={storeId}
        onSendSuccess={() => {
          router.refresh()
          onOpenChange(false)
        }}
      />
    </Dialog>
  )
}
