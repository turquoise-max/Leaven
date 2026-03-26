'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { updateStaffInfo, approveRequest, rejectRequest, removeStaff, inviteRegisteredStaff, cancelContractRequest } from '../actions'
import { getStoreRoles, getStoreSettings } from '@/features/store/actions'
import { toast } from 'sonner'
import { Loader2, User, FileSignature, Check, X, Mail, Phone, AlertTriangle, Link2, Link2Off } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn, formatPhoneNumber } from '@/lib/utils'

// 분리된 UI 컴포넌트 임포트
import { 
  BasicWorkInfoTab, 
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
  onSuccess?: (action: 'approve' | 'reject' | 'remove', staffId: string) => void
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
  onSuccess,
}: EditStaffDialogProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const isCreateMode = !staff
  
  const [roles, setRoles] = useState<any[]>([])
  const [storeSettings, setStoreSettings] = useState<any>(null)
  const [formData, setFormData] = useState<StaffFormData>(DEFAULT_FORM_DATA)
  const [isDirty, setIsDirty] = useState(false)
  const [showSendDialog, setShowSendDialog] = useState(false)
  const [showApproveConfirm, setShowApproveConfirm] = useState(false)
  const [showRejectConfirm, setShowRejectConfirm] = useState(false)

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

  // Legacy role matching logic (Only for owner/manager. Leave staff as empty to represent 'No Role')
  useEffect(() => {
    // If it's the first time matching and there's no role_id
    // and formData.roleId is still empty, let's try to match owner/manager.
    // If it's just 'staff', we deliberately leave it empty ("역할 미설정").
    if (staff && roles.length > 0 && !staff.role_id && formData.roleId === '') {
       let matchingRole = null;
       if (staff.role === 'owner') {
          matchingRole = roles.find(r => r.name === '점주' || r.name === 'Owner' || (r.is_system && r.priority === 100))
       } else if (staff.role === 'manager') {
          matchingRole = roles.find(r => r.name === '매니저' || r.name === 'Manager')
       }
       
       // For 'staff', we don't automatically assign the 'Staff' role anymore.
       // It will remain as '' (역할 미설정).
       
       if (matchingRole) {
          handleFormChange({ roleId: matchingRole.id })
       }
    }
  }, [staff, roles]) // Do not include formData.roleId in dependencies to prevent infinite loop or overwriting user changes

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
      if (onSuccess) onSuccess('approve', staff.id)
      router.refresh()
      onOpenChange(false)
    }
  }

  const handleReject = async () => {
    if (!canManage || !staff) return

    setLoading(true)
    const result = await rejectRequest(storeId, staff.id) as any
    setLoading(false)

    if (result?.error) {
      toast.error('거절 실패', { description: result.error })
    } else {
      toast.success('거절 완료')
      if (onSuccess) onSuccess('reject', staff.id)
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
      if (onSuccess) onSuccess('remove', staff.id)
      router.refresh()
      onOpenChange(false)
    }
  }

  const handleSendContractClick = () => {
    if (!canManage || !staff) return
    if (!formData.email) {
      toast.error('이메일 주소가 없습니다.', { description: '근로계약서를 발송하려면 직원의 이메일을 먼저 입력하고 저장해주세요.' })
      return
    }
    setShowSendDialog(true)
  }

  const handleInviteClick = async () => {
    if (!canManage || !staff) return
    if (!formData.email) {
      toast.error('이메일 주소가 없습니다.', { description: '매장에 초대하려면 직원의 이메일을 먼저 입력하고 저장해주세요.' })
      return
    }
    
    setLoading(true)
    const result = await inviteRegisteredStaff(storeId, staff.id, formData.email)
    setLoading(false)

    if (result?.error) {
      toast.error('초대 실패', { description: result.error })
    } else if (result?.notRegistered) {
      toast.info('미가입 이메일입니다.', { description: '해당 이메일로 가입된 Leaven 계정이 없습니다. 앱 설치 및 가입을 안내해주세요.' })
    } else {
      toast.success('초대 완료', { description: '직원에게 앱 가입 초대가 발송되었습니다. (로그인 시 알림)' })
      if (onSuccess) onSuccess('approve', staff.id) // UI 갱신을 위해 임의로 호출 (또는 router.refresh)
      router.refresh()
    }
  }

  const isPending = staff?.status === 'pending_approval' || staff?.status === 'invited'
  const isContractSent = staff?.contract_status === 'sent' || staff?.contract_status === 'pending_staff'
  const isOwner = staff?.role === 'owner'
  const isResigned = !!staff?.resigned_at
  const isLinked = !!staff?.user_id
  const canEdit = canManage && !isResigned
  const displayName = formData.name || staff?.profile?.full_name || (isCreateMode ? '신규 등록' : '이름 없음')
  const displayEmail = formData.email || staff?.profile?.email || ''
  const avatarUrl = staff?.profile?.avatar_url

  // Contract Readiness Calculation
  const contractRequirements = useMemo(() => {
    return [
      { id: 'name', label: '이름', fulfilled: !!formData.name, tab: 'basic' },
      { id: 'contact', label: '연락처(이메일/전화번호)', fulfilled: !!(formData.email || formData.phone), tab: 'basic' },
      { id: 'employmentType', label: '고용 형태', fulfilled: !!formData.employmentType, tab: 'basic' },
      { id: 'hiredAt', label: '입사일', fulfilled: !!formData.hiredAt, tab: 'basic' },
      { id: 'schedule', label: '기본 스케줄', fulfilled: weeklyTotalMinutes > 0, tab: 'basic' },
      { id: 'baseWage', label: '급여 금액', fulfilled: !!formData.baseWage && formData.baseWage !== '0', tab: 'contract' }
    ]
  }, [formData, weeklyTotalMinutes])

  const fulfilledCount = contractRequirements.filter(r => r.fulfilled).length
  const totalCount = contractRequirements.length
  const readinessPercent = Math.round((fulfilledCount / totalCount) * 100)
  const isContractReady = fulfilledCount === totalCount

  const handleSaveAndSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canManage || isResigned || !isContractReady) return

    setLoading(true)
    const submitData = buildFormDataForSubmit()

    if (isCreateMode) {
      const { createManualStaff } = await import('../actions')
      const result = await createManualStaff(storeId, submitData) as any
      setLoading(false)
      if (result?.error) {
        toast.error('등록 실패', { description: result.error })
      } else {
        toast.success('저장 완료')
        setShowSendDialog(true)
      }
    } else {
      const result = await updateStaffInfo(storeId, staff.id, submitData) as any
      setLoading(false)
      if (result?.error) {
        toast.error('정보 수정 실패', { description: result.error })
      } else {
        toast.success('저장 완료')
        setShowSendDialog(true)
      }
    }
  }

  const [activeTab, setActiveTab] = useState('basic')

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[950px] w-[95vw] p-0 gap-0 overflow-hidden flex flex-col bg-slate-50">
        <SheetHeader className="px-6 py-5 border-b bg-white shrink-0 shadow-sm z-10 relative">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary border border-primary/20">
               {isResigned ? <User className="w-6 h-6" /> : (isPending ? <FileSignature className="w-6 h-6" /> : <User className="w-6 h-6" />)}
            </div>
            <div className="flex flex-col text-left">
              <SheetTitle className="text-xl font-bold tracking-tight">
                {isCreateMode ? '직원 수기 등록' : isResigned ? '퇴사자 프로필' : isPending ? '근로 조건 설정 및 계약' : '직원 통합 프로필'}
              </SheetTitle>
              <SheetDescription className="text-sm mt-0.5 text-muted-foreground/80">
                {isCreateMode ? '이메일 초대 없이 직접 직원의 정보를 입력하여 등록합니다.' : isResigned ? `${displayName}님의 과거 재직 기록을 조회합니다. (수정 불가)` : isPending ? `새로 합류할 ${displayName}님의 근로 조건을 기입하고 계약을 진행하세요.` : `${displayName}님의 개인 정보, 근로 계약, 스케줄을 종합 관리합니다.`}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <form onSubmit={handleSave} className={cn("flex-1 overflow-hidden flex flex-col min-h-0", isResigned && "opacity-95")}>
          <div className="p-6 pb-4 flex flex-col gap-5 shrink-0">
            {/* Profile Header */}
            {isPending && isContractSent && (
              <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-sm font-medium">직원에게 전자 근로계약서가 발송되었습니다. 서명이 완료되면 자동으로 재직중으로 이관됩니다.</span>
                </div>
              </div>
            )}
            <div className="flex items-center gap-6 p-6 bg-white rounded-xl border shadow-sm">
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

                     {!isCreateMode && (
                       <div className={cn(
                         "px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide border flex items-center gap-1 shadow-sm",
                         isLinked ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-muted text-muted-foreground border-muted-foreground/20"
                       )} title={isLinked ? "Leaven 계정과 연결됨" : "수기 등록 (계정 미연동)"}>
                         {isLinked ? <Link2 className="w-3 h-3" /> : <Link2Off className="w-3 h-3" />}
                         {isLinked ? '계정 연동됨' : '수기 등록'}
                       </div>
                     )}
                 </div>
                 <div className="text-sm text-muted-foreground flex gap-3 flex-wrap">
                    {displayEmail && <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{displayEmail}</span>}
                    {formData.phone && <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{formatPhoneNumber(formData.phone)}</span>}
                 </div>
               </div>

               {/* Contract Readiness Indicator & Actions (Sheet UX Adapted) */}
               {!isResigned && !isCreateMode && (
                 <div className="flex flex-col shrink-0 w-full sm:w-[240px] bg-background/80 backdrop-blur p-4 rounded-xl border border-black/5 shadow-sm">
                   <div className="flex items-center justify-between w-full mb-2">
                     <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 tracking-tight">
                       <FileSignature className="w-3.5 h-3.5" /> 계약서 준비도
                     </span>
                     <span className={cn("text-xs font-black", isContractReady ? "text-emerald-600" : "text-amber-600")}>
                       {readinessPercent}%
                     </span>
                   </div>
                   <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-4 border border-black/5">
                     <div 
                       className={cn("h-full transition-all duration-500 shadow-inner", isContractReady ? "bg-emerald-500" : "bg-amber-500")}
                       style={{ width: `${readinessPercent}%` }}
                     />
                   </div>
                   
                   <div className="flex flex-col gap-2 w-full mt-auto">
                     {/* 계약서 발송 버튼 */}
                     {canEdit && (isPending || !isOwner) && (
                       <div className="flex flex-col gap-1.5 w-full">
                         <div className="relative group w-full">
                           <Button 
                             type="button" 
                             onClick={handleSendContractClick} 
                             disabled={loading || !isContractReady}
                             size="sm"
                             className={cn(
                               "w-full shadow-sm text-xs h-8 font-semibold transition-all",
                               isPending && !isContractSent ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-primary text-primary-foreground hover:bg-primary/90"
                             )}
                           >
                             <FileSignature className="mr-1.5 h-3.5 w-3.5" />
                             {isPending && !isContractSent ? '근로계약서 발송' : (isContractSent ? '계약서 재발송' : '근로계약서 발송')}
                           </Button>
                           {!isContractReady && (
                             <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[220px] px-2.5 py-1.5 bg-slate-800 text-white text-[10px] rounded-md shadow-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none z-50 leading-tight">
                               저장 후 발송할 수 있습니다. <br/><span className="text-amber-300">누락: {contractRequirements.filter(r => !r.fulfilled).map(r => r.label).join(', ')}</span>
                               <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45" />
                             </div>
                           )}
                         </div>
                         
                         {/* 계약 취소 버튼 */}
                         {isContractSent && (
                           <Button 
                             type="button" 
                             variant="outline"
                             onClick={async () => {
                               if (!confirm('발송된 근로계약서를 취소하시겠습니까? (취소 후 언제든 다시 발송할 수 있습니다)')) return
                               setLoading(true)
                               const res = await cancelContractRequest(storeId, staff.id)
                               setLoading(false)
                               if (res.error) {
                                 toast.error('취소 실패', { description: res.error })
                               } else {
                                 toast.success('계약이 취소되었습니다.')
                                 router.refresh()
                                 onOpenChange(false)
                               }
                             }} 
                             disabled={loading}
                             size="sm"
                             className="w-full text-xs h-8 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 transition-colors"
                           >
                             <X className="mr-1.5 h-3.5 w-3.5" />
                             진행중 계약 취소
                           </Button>
                         )}
                       </div>
                     )}

                     {/* 발송 없이 합류 (승인 대기중일 때만) */}
                     {canEdit && isPending && (
                       <Button 
                         type="button" 
                         variant="outline" 
                         onClick={() => setShowApproveConfirm(true)} 
                         disabled={loading}
                         size="sm"
                         className="w-full text-[11px] h-8 text-muted-foreground bg-white"
                       >
                         {isContractSent ? '서명 대기 생략하고 즉시 합류' : '계약서 발송 없이 즉시 합류'}
                       </Button>
                     )}
                     
                     {/* 계정 연동 (수기 등록자) */}
                     {canEdit && !isLinked && (
                       <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm"
                          className="w-full text-[11px] h-8 text-muted-foreground hover:text-foreground hover:bg-muted mt-1 bg-muted/50 border border-transparent hover:border-border transition-colors"
                          onClick={handleInviteClick}
                          disabled={loading}
                       >
                          <Mail className="w-3.5 h-3.5 mr-1.5" />
                          앱 가입 초대 링크 발송
                       </Button>
                     )}
                   </div>
                 </div>
               )}
            </div>
          </div>

          <div className="px-6 flex-1 min-h-0 bg-white">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col pt-4">
              <TabsList className="grid w-full grid-cols-2 mb-4 p-1 bg-slate-100/80 rounded-xl shrink-0 border border-black/5 shadow-sm h-12">
                  <TabsTrigger value="basic" className="h-full text-[13px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg relative transition-all">
                    프로필 및 기본 정보
                    {!contractRequirements.filter(r => r.tab === 'basic').every(r => r.fulfilled) && (
                      <span className="absolute top-1/2 -translate-y-1/2 right-4 w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="contract" className="h-full text-[13px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg relative transition-all">
                    근로 조건 및 급여
                    {!contractRequirements.filter(r => r.tab === 'contract').every(r => r.fulfilled) && (
                      <span className="absolute top-1/2 -translate-y-1/2 right-4 w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    )}
                  </TabsTrigger>
              </TabsList>

              <div className="flex-1 min-h-0 relative bg-white rounded-b-xl">
                <TabsContent value="basic" className="absolute inset-0 focus-visible:outline-none m-0">
                    <ScrollArea className="h-full w-full">
                      <div className="pb-8 pt-2">
                        <BasicWorkInfoTab 
                          formData={formData} 
                          onChange={handleFormChange} 
                          canEdit={canEdit} 
                          isLinked={isLinked}
                          roles={roles} 
                          isOwner={isOwner} 
                          weeklyTotalMinutes={weeklyTotalMinutes} 
                        />
                      </div>
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="contract" className="absolute inset-0 focus-visible:outline-none m-0">
                    <ScrollArea className="h-full w-full">
                      <div className="pb-8 pt-2">
                        <ContractSettingsTab 
                          formData={formData} 
                          onChange={handleFormChange} 
                          canEdit={canEdit} 
                          weeklyTotalMinutes={weeklyTotalMinutes} 
                          isOver15Hours={isOver15Hours} 
                          storeSettings={storeSettings}
                          staff={staff}
                        />
                      </div>
                    </ScrollArea>
                </TabsContent>
              </div>
            </Tabs>
          </div>

          {/* Custom Footer Container to override SheetFooter's weird stacking behavior */}
          <div className="px-6 py-5 border-t bg-white flex flex-row items-center justify-between shrink-0 z-10 relative shadow-[0_-4px_15px_-3px_rgba(0,0,0,0.05)] w-full">
            {isResigned ? (
               <div className="flex w-full justify-end">
                 <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-24">
                   닫기
                 </Button>
               </div>
            ) : isCreateMode ? (
               <div className="flex w-full justify-end gap-3">
                 <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="w-24 text-muted-foreground hover:text-foreground">
                   취소
                 </Button>
                 <Button type="submit" disabled={loading} className="w-32 shadow-sm font-bold tracking-wide">
                   {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                   등록 완료
                 </Button>
               </div>
            ) : (
              <>
                <div className="flex gap-2 items-center">
                  {canEdit && !isPending && !isOwner && (
                     <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={handleRemove}
                      disabled={loading}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700 border border-transparent hover:border-red-200"
                    >
                      <X className="w-4 h-4 mr-1.5" />
                      직원 퇴사 처리
                    </Button>
                  )}
                  {canEdit && isPending && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={() => setShowRejectConfirm(true)}
                      disabled={loading}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200"
                    >
                      <X className="w-4 h-4 mr-1.5" />
                      합류 거절
                    </Button>
                  )}
                </div>

                <div className="flex gap-2 items-center">
                  {canEdit && (
                    <Button type="submit" disabled={loading} className="w-32 shadow-sm font-bold tracking-wide">
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      저장하기
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </form>
      </SheetContent>

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

      <AlertDialog open={showApproveConfirm} onOpenChange={setShowApproveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              수면(종이) 근로계약 체결 확인
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2 text-foreground text-sm">
                <span className="block">전자 근로계약서를 발송/서명받지 않고 직원을 즉시 합류 처리합니다.</span>
                <span className="block font-semibold text-red-600">직원과 서면으로 근로계약을 이미 체결하셨나요?</span>
                <span className="block bg-muted p-3 rounded-md text-xs text-muted-foreground mt-2">
                  * 근로기준법에 따라 근로계약서 미작성 및 미교부 시 법적 불이익이 발생할 수 있습니다.<br />
                  * 가급적 앱 내의 <strong>[근로계약서 발송]</strong> 기능을 사용하시는 것을 권장합니다.
                </span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel>돌아가기</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault() // 다이얼로그 닫힘을 직접 제어하기 위해
                setShowApproveConfirm(false)
                handleApprove()
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              네, 이미 체결했습니다
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRejectConfirm} onOpenChange={setShowRejectConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              가입 요청 거절
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2 text-foreground text-sm">
                <span className="block">해당 직원의 매장 합류 요청을 거절하시겠습니까?</span>
                <span className="block bg-muted p-3 rounded-md text-sm text-muted-foreground mt-2">
                  거절 시 직원은 매장 대기 목록에서 즉시 삭제되며, 이 작업은 되돌릴 수 없습니다.
                </span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel>돌아가기</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault()
                setShowRejectConfirm(false)
                handleReject()
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              거절하기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}
