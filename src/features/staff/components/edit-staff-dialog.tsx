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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { updateStaffInfo, approveRequest, rejectRequest, removeStaff } from '../actions'
import { getStoreRoles } from '@/features/store/actions'
import { toast } from 'sonner'
import { Loader2, User, Clock, CalendarDays, Wallet, FileSignature, Check, X, ShieldCheck, Mail, Phone } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface EditStaffDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  staff: any
  storeId: string
  canManage: boolean
}

interface WorkSchedule {
  day: number // 0: 일, 1: 월, ... 6: 토
  start_time: string
  end_time: string
  break_minutes: number
  is_holiday: boolean
}

const DAYS = ['일', '월', '화', '수', '목', '금', '토']
const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))
const MINUTES = ['00', '10', '20', '30', '40', '50']

function TimePicker({ value, onChange, disabled }: { value: string, onChange: (value: string) => void, disabled?: boolean }) {
  const [hour, minute] = value ? value.split(':') : ['09', '00']

  const handleHourChange = (newHour: string) => {
    onChange(`${newHour}:${minute}`)
  }

  const handleMinuteChange = (newMinute: string) => {
    onChange(`${hour}:${newMinute}`)
  }

  return (
    <div className="flex items-center gap-1">
      <Select value={hour} onValueChange={handleHourChange} disabled={disabled}>
        <SelectTrigger className="w-[64px] h-9 px-2 text-center focus:ring-0 bg-background">
          <SelectValue placeholder="HH" />
        </SelectTrigger>
        <SelectContent position="popper" className="h-[200px]" side="bottom" align="start">
          {HOURS.map((h) => (
            <SelectItem key={h} value={h} className="text-center justify-center pl-2">
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-muted-foreground font-medium">:</span>
      <Select value={minute} onValueChange={handleMinuteChange} disabled={disabled}>
        <SelectTrigger className="w-[64px] h-9 px-2 text-center focus:ring-0 bg-background">
          <SelectValue placeholder="MM" />
        </SelectTrigger>
        <SelectContent position="popper" side="bottom" align="start">
          {MINUTES.map((m) => (
            <SelectItem key={m} value={m} className="text-center justify-center pl-2">
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
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
  
  // Form State
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [memo, setMemo] = useState('')
  
  const [roleId, setRoleId] = useState('')
  const [roles, setRoles] = useState<any[]>([])
  const [hiredAt, setHiredAt] = useState('')
  const [employmentType, setEmploymentType] = useState('parttime')
  
  const [wageType, setWageType] = useState('hourly')
  const [baseWage, setBaseWage] = useState('0')

  // New Contract Fields
  const [address, setAddress] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [emergencyContact, setEmergencyContact] = useState('')
  const [customPayDay, setCustomPayDay] = useState('')
  const [weeklyHoliday, setWeeklyHoliday] = useState('')
  const [contractEndDate, setContractEndDate] = useState('')
  const [insuranceStatus, setInsuranceStatus] = useState({
    employment: false,
    industrial: false,
    national: false,
    health: false
  })
  
  // Work Schedules (0~6 index)
  const [workSchedules, setWorkSchedules] = useState<WorkSchedule[]>([])
  const [isDirty, setIsDirty] = useState(false)
  const [sendingContract, setSendingContract] = useState(false)

  // Calculate Weekly Total Minutes
  const weeklyTotalMinutes = useMemo(() => {
    return workSchedules.reduce((acc, sch) => {
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
  }, [workSchedules])

  const isOver15Hours = weeklyTotalMinutes >= 15 * 60

  // Load roles
  useEffect(() => {
    if (storeId && open) {
      getStoreRoles(storeId).then(setRoles)
    }
  }, [storeId, open])

  // Initialize form state
  useEffect(() => {
    if (open) {
      if (staff) {
        setName(staff.name || staff.profile?.full_name || '')
        setEmail(staff.email || staff.profile?.email || '')
        setPhone(staff.phone || staff.profile?.phone || '')
        setMemo(staff.memo || '')
        
        setEmploymentType(staff.employment_type || 'parttime')
        setWageType(staff.wage_type || 'hourly')
        setBaseWage(staff.base_wage?.toString() || '0')
        
        const initialDate = staff.hired_at || staff.joined_at
        setHiredAt(initialDate ? new Date(initialDate).toISOString().split('T')[0] : '')
        
        setAddress(staff.address || '')
        setBirthDate(staff.birth_date || '')
        setEmergencyContact(staff.emergency_contact || '')
        setCustomPayDay(staff.custom_pay_day?.toString() || '')
        setWeeklyHoliday(staff.weekly_holiday?.toString() || '')
        setContractEndDate(staff.contract_end_date ? new Date(staff.contract_end_date).toISOString().split('T')[0] : '')
        
        if (staff.insurance_status) {
           setInsuranceStatus({
             employment: staff.insurance_status.employment || false,
             industrial: staff.insurance_status.industrial || false,
             national: staff.insurance_status.national || false,
             health: staff.insurance_status.health || false
           })
        } else {
           setInsuranceStatus({ employment: false, industrial: false, national: false, health: false })
        }
        
        if (staff.work_schedules && Array.isArray(staff.work_schedules) && staff.work_schedules.length > 0) {
          setWorkSchedules(staff.work_schedules)
        } else {
          setWorkSchedules(Array.from({ length: 7 }, (_, i) => ({
            day: i, start_time: '09:00', end_time: '18:00', break_minutes: 60, is_holiday: true
          })))
        }

        if (staff.role_id) setRoleId(staff.role_id)
        else setRoleId('')
        
        setIsDirty(false)
      } else {
        // Create Mode Init
        setName('')
        setEmail('')
        setPhone('')
        setMemo('')
        setEmploymentType('parttime')
        setWageType('hourly')
        setBaseWage('0')
        setHiredAt(new Date().toISOString().split('T')[0])
        setAddress('')
        setBirthDate('')
        setEmergencyContact('')
        setCustomPayDay('')
        setWeeklyHoliday('')
        setContractEndDate('')
        setInsuranceStatus({ employment: false, industrial: false, national: false, health: false })
        setWorkSchedules(Array.from({ length: 7 }, (_, i) => ({
          day: i, start_time: '09:00', end_time: '18:00', break_minutes: 60, is_holiday: true
        })))
        setRoleId('')
        setIsDirty(false)
      }
    }
  }, [staff, open])

  // Legacy role matching logic
  useEffect(() => {
    if (staff && roles.length > 0 && !staff.role_id && !roleId) {
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
          const defaultRole = [...roles].sort((a, b) => a.priority - b.priority)[0]
          if (defaultRole) setRoleId(defaultRole.id)
       }
    }
  }, [staff, roles, roleId])

  // Dirty check logic (Simplified)
  useEffect(() => {
    if (!staff) return
    setIsDirty(true) 
  }, [name, email, phone, memo, roleId, wageType, baseWage, hiredAt, workSchedules, address, birthDate, emergencyContact, customPayDay, weeklyHoliday, contractEndDate, insuranceStatus])

  const calculateBreakTime = (start: string, end: string): number => {
    if (!start || !end) return 0
    
    const [startH, startM] = start.split(':').map(Number)
    const [endH, endM] = end.split(':').map(Number)
    
    let diffMinutes = (endH * 60 + endM) - (startH * 60 + startM)
    if (diffMinutes < 0) diffMinutes += 24 * 60 // Handle overnight
    
    // 근로기준법: 4시간 이상 30분, 8시간 이상 1시간
    if (diffMinutes >= 8 * 60) return 60
    if (diffMinutes >= 4 * 60) return 30
    return 0
  }

  const handleScheduleChange = (index: number, field: keyof WorkSchedule, value: any) => {
    setWorkSchedules(prev => {
      const next = [...prev]
      const current = { ...next[index], [field]: value }
      
      // Auto calculate break time if times changed
      if ((field === 'start_time' || field === 'end_time') && !current.is_holiday) {
        const breakTime = calculateBreakTime(current.start_time, current.end_time)
        current.break_minutes = breakTime
      }
      
      next[index] = current
      return next
    })
  }

  const handleSave = async (formData: FormData) => {
    if (!canManage || isResigned) return

    setLoading(true)
    formData.append('workSchedules', JSON.stringify(workSchedules))

    const finalInsuranceStatus = {
      employment: isOver15Hours ? true : insuranceStatus.employment,
      industrial: true,
      national: isOver15Hours ? true : insuranceStatus.national,
      health: isOver15Hours ? true : insuranceStatus.health,
    }
    formData.append('insuranceStatus', JSON.stringify(finalInsuranceStatus))

    if (isCreateMode) {
      const { createManualStaff } = await import('../actions')
      if (!name) {
        toast.error('이름을 입력해주세요.')
        setLoading(false)
        return
      }
      const result = await createManualStaff(storeId, formData)
      setLoading(false)
      if (result.error) {
        toast.error('등록 실패', { description: result.error })
      } else {
        toast.success('수기 등록 완료')
        router.refresh()
        onOpenChange(false)
      }
    } else {
      const result = await updateStaffInfo(storeId, staff.id, formData)
      setLoading(false)
      if (result.error) {
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
    const formData = new FormData()
    formData.append('name', name)
    formData.append('email', email)
    formData.append('phone', phone)
    formData.append('memo', memo)
    formData.append('roleId', roleId)
    formData.append('employmentType', employmentType)
    formData.append('wageType', wageType)
    formData.append('baseWage', baseWage)
    formData.append('hiredAt', hiredAt)
    if (contractEndDate) formData.append('contractEndDate', contractEndDate)
    if (address) formData.append('address', address)
    if (birthDate) formData.append('birthDate', birthDate)
    if (emergencyContact) formData.append('emergencyContact', emergencyContact)
    if (customPayDay) formData.append('customPayDay', customPayDay)
    if (weeklyHoliday) formData.append('weeklyHoliday', weeklyHoliday)

    formData.append('workSchedules', JSON.stringify(workSchedules))

    const finalInsuranceStatus = {
      employment: isOver15Hours ? true : insuranceStatus.employment,
      industrial: true,
      national: isOver15Hours ? true : insuranceStatus.national,
      health: isOver15Hours ? true : insuranceStatus.health,
    }
    formData.append('insuranceStatus', JSON.stringify(finalInsuranceStatus))
    
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
      toast.success('승인 완료')
      router.refresh()
      onOpenChange(false)
    }
  }

  const handleReject = async () => {
    if (!canManage || !staff) return
    if (!confirm('정말 거절하시겠습니까?')) return

    setLoading(true)
    const result = await rejectRequest(storeId, staff.id)
    setLoading(false)

    if (result.error) {
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

  const handleSendContract = async () => {
    if (!canManage || !staff) return
    if (!confirm(`${name || staff.name} 직원에게 전자 근로계약서 서명 요청을 발송하시겠습니까?`)) return

    setSendingContract(true)
    try {
      const response = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId,
          staffId: staff.id
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '계약서 발송에 실패했습니다.')
      }

      toast.success('근로계약서 발송 완료', { description: '카카오톡 또는 이메일로 서명 요청이 발송되었습니다.' })
    } catch (error: any) {
      toast.error('근로계약서 발송 실패', { description: error.message })
    } finally {
      setSendingContract(false)
    }
  }

  const isPending = staff?.status === 'pending_approval' || staff?.status === 'invited'
  const isOwner = staff?.role === 'owner'
  const isResigned = !!staff?.resigned_at
  const canEdit = canManage && !isResigned
  const displayName = name || staff?.profile?.full_name || (isCreateMode ? '신규 등록' : '이름 없음')
  const displayEmail = email || staff?.profile?.email || ''
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

        <form action={handleSave} className={cn("flex-1 overflow-hidden flex flex-col min-h-0", isResigned && "opacity-90 pointer-events-none")}>
          <ScrollArea className="flex-1">
            <div className="p-6 h-full flex flex-col gap-6">
              
              {/* Profile Header */}
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
                      {roleId && (
                         <div className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide border bg-background/50 shadow-sm"
                              style={{ 
                                borderColor: `${roles.find(r => r.id === roleId)?.color || '#ccc'}40`,
                                color: roles.find(r => r.id === roleId)?.color || '#333'
                              }}>
                            {roles.find(r => r.id === roleId)?.name || '직원'}
                         </div>
                       )}
                       <div className={cn(
                         "px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide shadow-sm",
                         isResigned ? "bg-red-50 text-red-700 border border-red-200" : "bg-muted text-muted-foreground border"
                       )}>
                         {isCreateMode ? '가입 대기 예정' : isResigned ? '퇴사자' : (isPending ? '승인 대기' : '재직중')}
                       </div>
                   </div>
                   <div className="text-sm text-muted-foreground flex gap-3 flex-wrap">
                      {displayEmail && <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{displayEmail}</span>}
                      {phone && <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{phone}</span>}
                   </div>
                 </div>
              </div>

              <Tabs defaultValue="personal" className="flex-1 flex flex-col min-h-0 w-full">
                 <TabsList className="grid w-full grid-cols-3 mb-4 h-11 p-1 bg-muted/50 rounded-lg shrink-0">
                    <TabsTrigger value="personal" className="text-sm font-medium h-9 data-[state=active]:shadow-sm">개인 정보</TabsTrigger>
                    <TabsTrigger value="work" className="text-sm font-medium h-9 data-[state=active]:shadow-sm">근무 설정</TabsTrigger>
                    <TabsTrigger value="contract" className="text-sm font-medium h-9 data-[state=active]:shadow-sm">급여 및 계약서 정보</TabsTrigger>
                 </TabsList>

                 {/* TAB 1: 개인 정보 */}
                 <TabsContent value="personal" className="mt-0 focus-visible:outline-none flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
                       <div className="space-y-5">
                          <div className="grid gap-2">
                            <Label htmlFor="name">이름 (필수)</Label>
                            <Input id="name" name="name" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="birthDate">생년월일 (6자리)</Label>
                            <Input id="birthDate" name="birthDate" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} placeholder="예: 950101" disabled={!canEdit} maxLength={6} />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="phone">전화번호</Label>
                            <Input id="phone" name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" disabled={!canEdit} />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="email">이메일</Label>
                            <Input id="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!canEdit} />
                          </div>
                       </div>
                       
                       <div className="space-y-5 flex flex-col">
                          <div className="grid gap-2">
                            <Label htmlFor="address">주소지</Label>
                            <Input id="address" name="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="시/도 구/군 동 상세주소" disabled={!canEdit} />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="emergencyContact">비상연락망</Label>
                            <Input id="emergencyContact" name="emergencyContact" value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} placeholder="관계 및 연락처 (예: 어머니 010-1234-5678)" disabled={!canEdit} />
                          </div>
                          <div className="grid gap-2 flex-1">
                            <Label htmlFor="memo">직원 메모</Label>
                            <Textarea id="memo" name="memo" value={memo} onChange={(e) => setMemo(e.target.value)} disabled={!canEdit} placeholder="직원에 대한 특이사항이나 메모를 남겨주세요." className="h-full min-h-[120px] max-h-[200px] resize-none" />
                          </div>
                       </div>
                    </div>
                 </TabsContent>

                 {/* TAB 2: 근무 설정 */}
                 <TabsContent value="work" className="mt-0 focus-visible:outline-none flex-1">
                    <div className="flex flex-col md:flex-row gap-8 h-full">
                      {/* Left Sidebar: Basic Work Settings */}
                      <div className="w-full md:w-[280px] shrink-0 space-y-6">
                        <div className="grid gap-2">
                          <Label>역할 (직무)</Label>
                          {isOwner ? (
                            <div className="h-10 px-3 py-2 rounded-md border bg-muted text-muted-foreground text-sm flex items-center">점주 (변경 불가)</div>
                          ) : (
                            <Select name="roleId" value={roleId} onValueChange={setRoleId} disabled={!canEdit}>
                              <SelectTrigger>
                                <SelectValue placeholder="역할 선택" />
                              </SelectTrigger>
                              <SelectContent>
                                {roles.map((role) => (
                                    <SelectItem key={role.id} value={role.id}>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: role.color }} />
                                            {role.name}
                                        </div>
                                    </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          <input type="hidden" name="roleId" value={roleId} />
                        </div>
                        
                        <div className="grid gap-2">
                          <Label>고용 형태</Label>
                          <Select name="employmentType" value={employmentType} onValueChange={setEmploymentType} disabled={!canEdit}>
                            <SelectTrigger>
                              <SelectValue placeholder="선택" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fulltime">정규직</SelectItem>
                              <SelectItem value="contract">계약직</SelectItem>
                              <SelectItem value="parttime">파트타임/알바</SelectItem>
                              <SelectItem value="probation">수습/교육생</SelectItem>
                              <SelectItem value="daily">일용직/단기</SelectItem>
                            </SelectContent>
                          </Select>
                          <input type="hidden" name="employmentType" value={employmentType} />
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="hiredAt">입사일 (근로개시일)</Label>
                          <Input id="hiredAt" name="hiredAt" type="date" value={hiredAt} onChange={(e) => setHiredAt(e.target.value)} disabled={!canEdit} />
                        </div>
                        
                        <div className="grid gap-2">
                          <Label htmlFor="contractEndDate">계약 종료일 (선택)</Label>
                          <Input id="contractEndDate" name="contractEndDate" type="date" value={contractEndDate} onChange={(e) => setContractEndDate(e.target.value)} disabled={!canEdit} />
                        </div>
                        
                        <div className="grid gap-2">
                          <Label>주휴일</Label>
                          <Select name="weeklyHoliday" value={weeklyHoliday} onValueChange={setWeeklyHoliday} disabled={!canEdit}>
                            <SelectTrigger>
                              <SelectValue placeholder="미지정 (선택안함)" />
                            </SelectTrigger>
                            <SelectContent>
                               <SelectItem value="null">미지정</SelectItem>
                               <SelectItem value="0">일요일</SelectItem>
                               <SelectItem value="1">월요일</SelectItem>
                               <SelectItem value="2">화요일</SelectItem>
                               <SelectItem value="3">수요일</SelectItem>
                               <SelectItem value="4">목요일</SelectItem>
                               <SelectItem value="5">금요일</SelectItem>
                               <SelectItem value="6">토요일</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Right Panel: Work Schedules Table */}
                      <div className="flex-1 flex flex-col min-h-0 border rounded-md overflow-hidden bg-card">
                        <div className="bg-muted/30 px-4 py-3 border-b flex items-center justify-between shrink-0">
                          <span className="text-sm font-semibold flex items-center gap-2"><CalendarDays className="w-4 h-4"/> 기본 스케줄 설정</span>
                          <div className="flex items-center gap-2">
                             <span className="text-xs text-muted-foreground hidden sm:inline-block">주 소정근로:</span>
                             <Badge variant="outline" className="font-mono bg-background">
                                {Math.floor(weeklyTotalMinutes / 60)}h {weeklyTotalMinutes % 60}m
                             </Badge>
                          </div>
                        </div>
                        <div className="flex-1 overflow-y-auto min-h-0">
                          <div className="divide-y divide-border/50">
                            {workSchedules.map((schedule, index) => (
                              <div key={index} className={cn("flex items-center gap-2 px-3 h-[52px] transition-colors", schedule.is_holiday ? "bg-muted/10" : "bg-background hover:bg-muted/5")}>
                                <div className="flex items-center gap-2 w-[72px] shrink-0">
                                  <Checkbox 
                                    id={`day-${index}`}
                                    checked={!schedule.is_holiday}
                                    onCheckedChange={(checked) => handleScheduleChange(index, 'is_holiday', !checked)}
                                    disabled={!canEdit}
                                    className="h-4 w-4"
                                  />
                                  <Label htmlFor={`day-${index}`} className={cn("cursor-pointer font-medium text-sm", schedule.day === 0 ? "text-red-500" : schedule.day === 6 ? "text-blue-500" : "")}>
                                    {DAYS[schedule.day]}요일
                                  </Label>
                                </div>

                                {!schedule.is_holiday ? (
                                  <div className="flex items-center flex-1 justify-between ml-1">
                                    <div className="flex items-center gap-1.5 sm:gap-3">
                                      <TimePicker value={schedule.start_time} onChange={(val) => handleScheduleChange(index, 'start_time', val)} disabled={!canEdit} />
                                      <span className="text-muted-foreground/50">~</span>
                                      <TimePicker value={schedule.end_time} onChange={(val) => handleScheduleChange(index, 'end_time', val)} disabled={!canEdit} />
                                    </div>
                                    <div className="flex items-center gap-1.5 bg-muted/40 px-2 py-1 rounded-md border border-border/50 shrink-0">
                                      <span className="text-xs font-medium text-muted-foreground">휴게</span>
                                      <Input
                                        type="number"
                                        value={schedule.break_minutes}
                                        onChange={(e) => handleScheduleChange(index, 'break_minutes', parseInt(e.target.value) || 0)}
                                        className="w-[46px] h-6 text-xs text-center px-1 bg-background"
                                        min={0} step={10} disabled={!canEdit}
                                      />
                                      <span className="text-[11px] text-muted-foreground">분</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex-1 ml-1 flex items-center">
                                    <span className="text-xs text-muted-foreground/50 italic bg-muted/50 px-2.5 py-1 rounded-md">휴무일</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                 </TabsContent>

                 {/* TAB 3: 급여 및 계약서 정보 */}
                 <TabsContent value="contract" className="mt-0 focus-visible:outline-none flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                      {/* 임금 정보 */}
                      <div className="space-y-5">
                        <h4 className="font-semibold text-sm flex items-center gap-2 pb-2 border-b"><Wallet className="w-4 h-4"/> 임금 및 지급 설정</h4>
                        
                        <div className="grid gap-5">
                           <div className="grid grid-cols-2 gap-5">
                             <div className="grid gap-2">
                               <Label htmlFor="wageType">지급 기준</Label>
                               <Select name="wageType" value={wageType} onValueChange={setWageType} disabled={!canEdit}>
                                 <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                                 <SelectContent>
                                   <SelectItem value="hourly">시급</SelectItem>
                                   <SelectItem value="daily">일급</SelectItem>
                                   <SelectItem value="monthly">월급</SelectItem>
                                   <SelectItem value="yearly">연봉</SelectItem>
                                 </SelectContent>
                               </Select>
                               <input type="hidden" name="wageType" value={wageType} />
                             </div>
                             <div className="grid gap-2">
                               <Label htmlFor="baseWage">금액 (원)</Label>
                               <Input id="baseWage" name="baseWage" type="number" value={baseWage} onChange={(e) => setBaseWage(e.target.value)} className="font-mono" disabled={!canEdit} min={0} step={100} />
                             </div>
                           </div>
                           
                           {(wageType === 'hourly' || wageType === 'daily') && (
                             <div className="bg-primary/5 p-3 rounded-md border border-primary/10 text-sm">
                               <div className="flex justify-between items-center text-primary/80 mb-1">
                                  <span>기본 스케줄 기준 월 예상 급여</span>
                                  <span className="font-bold text-primary">
                                    {(() => {
                                       let workDays = 0
                                       workSchedules.forEach(sch => {
                                         if (!sch.is_holiday && sch.start_time && sch.end_time) {
                                           workDays++
                                         }
                                       })
                                       
                                       const base = parseInt(baseWage) || 0
                                       if (wageType === 'daily') {
                                         return Math.round(base * workDays * 4.345).toLocaleString()
                                       } else {
                                         const weeklyPay = (weeklyTotalMinutes / 60) * base
                                         return Math.round(weeklyPay * 4.345).toLocaleString()
                                       }
                                    })()} 원
                                  </span>
                               </div>
                               <p className="text-[11px] text-muted-foreground/80 text-right">* 주휴수당, 초과수당 미포함 산정액</p>
                             </div>
                           )}

                           <div className="grid gap-2 mt-2">
                             <Label htmlFor="customPayDay">임금 지급일</Label>
                             <div className="flex items-center gap-2">
                               <span className="text-sm whitespace-nowrap">매월</span>
                               <Input id="customPayDay" name="customPayDay" type="number" min={1} max={31} value={customPayDay} onChange={(e) => setCustomPayDay(e.target.value)} placeholder="미지정시 매장 설정 따름" className="w-full" disabled={!canEdit} />
                               <span className="text-sm whitespace-nowrap">일</span>
                             </div>
                           </div>
                        </div>
                      </div>

                      {/* 4대보험 정보 */}
                      <div className="space-y-5">
                        <div className="flex items-center justify-between pb-2 border-b">
                           <h4 className="font-semibold text-sm flex items-center gap-2"><ShieldCheck className="w-4 h-4"/> 4대 사회보험 적용</h4>
                           <div className={cn(
                             "px-2 py-0.5 rounded text-[11px] font-semibold", 
                             isOver15Hours ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-muted text-muted-foreground"
                           )}>
                             주 소정근로 {Math.floor(weeklyTotalMinutes / 60)}h {weeklyTotalMinutes % 60}m
                           </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-y-4 gap-x-6 p-4 bg-muted/20 border rounded-lg">
                           <div className="flex items-center space-x-3">
                              <Checkbox id="ins_emp" checked={isOver15Hours ? true : insuranceStatus.employment} onCheckedChange={(checked) => setInsuranceStatus(prev => ({...prev, employment: !!checked}))} disabled={!canEdit || isOver15Hours} />
                              <Label htmlFor="ins_emp" className="cursor-pointer font-medium text-sm">고용보험</Label>
                           </div>
                           <div className="flex items-center space-x-3">
                              <Checkbox id="ins_ind" checked={true} disabled={true} />
                              <Label htmlFor="ins_ind" className="cursor-pointer font-medium text-sm">산재보험</Label>
                           </div>
                           <div className="flex items-center space-x-3">
                              <Checkbox id="ins_nat" checked={isOver15Hours ? true : insuranceStatus.national} onCheckedChange={(checked) => setInsuranceStatus(prev => ({...prev, national: !!checked}))} disabled={!canEdit || isOver15Hours} />
                              <Label htmlFor="ins_nat" className="cursor-pointer font-medium text-sm">국민연금</Label>
                           </div>
                           <div className="flex items-center space-x-3">
                              <Checkbox id="ins_health" checked={isOver15Hours ? true : insuranceStatus.health} onCheckedChange={(checked) => setInsuranceStatus(prev => ({...prev, health: !!checked}))} disabled={!canEdit || isOver15Hours} />
                              <Label htmlFor="ins_health" className="cursor-pointer font-medium text-sm">건강보험</Label>
                           </div>
                        </div>
                        <p className="text-xs text-muted-foreground px-1 leading-relaxed">
                          {isOver15Hours ? (
                            <span className="text-blue-600 dark:text-blue-400 font-medium">* 주 15시간 이상 근무자는 4대보험 필수 가입 대상입니다.</span>
                          ) : (
                            <span>* 주 15시간 미만 초단시간 근로자는 산재보험만 필수입니다.<br/>* 계약서 생성 시 위 선택된 보험 항목에 체크 표시가 들어갑니다.</span>
                          )}
                        </p>
                      </div>

                    </div>
                 </TabsContent>
              </Tabs>

            </div>
          </ScrollArea>

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
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading || sendingContract}>
                    취소
                  </Button>

                  {canEdit && (isPending || !isOwner) && (
                    <Button 
                      type="button" 
                      variant="secondary"
                      onClick={handleSendContract} 
                      disabled={loading || sendingContract}
                      className="bg-purple-100 text-purple-700 hover:bg-purple-200 hover:text-purple-800"
                    >
                      {sendingContract ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSignature className="mr-2 h-4 w-4" />}
                      {isPending ? '계약서 발송' : '계약서 재발송'}
                    </Button>
                  )}
                  
                  {canEdit && isPending ? (
                    <Button 
                      type="button" 
                      onClick={handleApprove} 
                      disabled={loading}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white w-32 shadow-sm"
                    >
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                      승인 완료
                    </Button>
                  ) : (
                    canEdit && (
                      <Button type="submit" disabled={loading} className="w-32 shadow-sm">
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        정보 저장
                      </Button>
                    )
                  )}
                </div>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}