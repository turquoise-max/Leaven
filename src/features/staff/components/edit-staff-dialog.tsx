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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { updateStaffInfo, approveRequest, rejectRequest, removeStaff } from '../actions'
import { getStoreRoles } from '@/features/store/actions'
import { toast } from 'sonner'
import { Loader2, User, Clock, CalendarDays, Wallet, FileSignature } from 'lucide-react'
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
        <SelectTrigger className="w-[70px] h-9 px-2 text-center focus:ring-0">
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
      <span className="text-muted-foreground font-bold">:</span>
      <Select value={minute} onValueChange={handleMinuteChange} disabled={disabled}>
        <SelectTrigger className="w-[70px] h-9 px-2 text-center focus:ring-0">
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
  
  // Form State
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [memo, setMemo] = useState('')
  
  const [roleId, setRoleId] = useState('')
  const [roles, setRoles] = useState<any[]>([])
  const [hiredAt, setHiredAt] = useState('')
  
  const [wageType, setWageType] = useState('hourly')
  const [baseWage, setBaseWage] = useState('0')
  
  // Work Schedules (0~6 index)
  const [workSchedules, setWorkSchedules] = useState<WorkSchedule[]>([])
  const [isDirty, setIsDirty] = useState(false)
  const [sendingContract, setSendingContract] = useState(false)

  // Load roles
  useEffect(() => {
    if (storeId && open) {
      getStoreRoles(storeId).then(setRoles)
    }
  }, [storeId, open])

  // Initialize form state
  useEffect(() => {
    if (staff) {
      setName(staff.name || staff.profile?.full_name || '')
      setEmail(staff.email || staff.profile?.email || '')
      setPhone(staff.phone || staff.profile?.phone || '')
      setMemo(staff.memo || '')
      
      setWageType(staff.wage_type || 'hourly')
      setBaseWage(staff.base_wage?.toString() || '0')
      
      const initialDate = staff.hired_at || staff.joined_at
      setHiredAt(initialDate ? new Date(initialDate).toISOString().split('T')[0] : '')
      
      // Initialize Work Schedules
      if (staff.work_schedules && Array.isArray(staff.work_schedules) && staff.work_schedules.length > 0) {
        setWorkSchedules(staff.work_schedules)
      } else {
        // Default: All days as holidays or empty
        const defaultSchedules = Array.from({ length: 7 }, (_, i) => ({
          day: i,
          start_time: '09:00',
          end_time: '18:00',
          break_minutes: 60,
          is_holiday: true // Default to holiday
        }))
        setWorkSchedules(defaultSchedules)
      }

      // Role Init
      if (staff.role_id) {
        setRoleId(staff.role_id)
      } else {
        setRoleId('')
      }
      
      setIsDirty(false)
    }
  }, [staff])

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
  }, [name, email, phone, memo, roleId, wageType, baseWage, hiredAt, workSchedules])

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
    if (!canManage || !staff) return

    setLoading(true)
    formData.append('workSchedules', JSON.stringify(workSchedules))
    
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

  const handleApprove = async () => {
    if (!canManage || !staff) return

    setLoading(true)
    const formData = new FormData()
    formData.append('name', name)
    formData.append('email', email)
    formData.append('phone', phone)
    formData.append('memo', memo)
    formData.append('roleId', roleId)
    formData.append('wageType', wageType)
    formData.append('baseWage', baseWage)
    formData.append('hiredAt', hiredAt)
    formData.append('workSchedules', JSON.stringify(workSchedules))
    
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

  if (!staff) return null

  const isPending = staff.status === 'pending_approval'
  const isOwner = staff.role === 'owner'
  const displayName = name || staff.profile?.full_name || '이름 없음'
  const displayEmail = email || staff.profile?.email || ''
  const avatarUrl = staff.profile?.avatar_url

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>{isPending ? '가입 승인 요청' : '직원 정보 수정'}</DialogTitle>
          <DialogDescription>
            {displayName}님의 상세 정보를 관리합니다.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSave} className="flex-1 overflow-hidden flex flex-col min-h-0">
          <ScrollArea className="flex-1">
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Left Column: Profile (lg:col-span-4) */}
                <div className="lg:col-span-4 space-y-6">
                  <div className="flex flex-col items-center justify-center p-6 bg-muted/30 rounded-lg border border-border/50">
                    <Avatar className="h-24 w-24 mb-4 border-2 border-background shadow-sm">
                      <AvatarImage src={avatarUrl} />
                      <AvatarFallback className="text-2xl bg-primary/10 text-primary font-medium">
                        {displayName.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <h3 className="text-xl font-semibold text-foreground">{displayName}</h3>
                    <p className="text-sm text-muted-foreground">{displayEmail}</p>
                    
                    <div className="mt-4 flex flex-wrap gap-2 justify-center">
                       {/* Role Badge Preview */}
                       {roleId && (
                         <div className="px-2.5 py-0.5 rounded-full text-xs font-medium border bg-background"
                              style={{ 
                                borderColor: roles.find(r => r.id === roleId)?.color || '#ccc',
                                color: roles.find(r => r.id === roleId)?.color || '#333'
                              }}>
                            {roles.find(r => r.id === roleId)?.name || '직원'}
                         </div>
                       )}
                       <div className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                         {isPending ? '승인 대기' : '재직중'}
                       </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80 pb-2 border-b">
                      <User className="w-4 h-4" />
                      기본 정보
                    </div>
                    
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="name">이름</Label>
                        <Input
                          id="name"
                          name="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          disabled={!canManage}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="phone">전화번호</Label>
                        <Input
                          id="phone"
                          name="phone"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          disabled={!canManage}
                          placeholder="010-0000-0000"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="email">이메일</Label>
                        <Input
                          id="email"
                          name="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          disabled={!canManage}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="memo">메모</Label>
                        <Textarea
                          id="memo"
                          name="memo"
                          value={memo}
                          onChange={(e) => setMemo(e.target.value)}
                          disabled={!canManage}
                          placeholder="직원에 대한 메모를 남겨주세요."
                          className="min-h-[100px] resize-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Work & Wage (lg:col-span-8) */}
                <div className="lg:col-span-8 space-y-8">
                  
                  {/* 근무 설정 */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80 pb-2 border-b">
                      <CalendarDays className="w-4 h-4" />
                      근무 설정
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>역할</Label>
                        {isOwner ? (
                          <div className="h-10 px-3 py-2 rounded-md border bg-muted text-muted-foreground text-sm flex items-center">점주 (변경 불가)</div>
                        ) : (
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
                        )}
                        <input type="hidden" name="roleId" value={roleId} />
                      </div>
                      
                      <div className="grid gap-2">
                        <Label htmlFor="hiredAt">입사일</Label>
                        <Input
                          id="hiredAt"
                          name="hiredAt"
                          type="date"
                          value={hiredAt}
                          onChange={(e) => setHiredAt(e.target.value)}
                          disabled={!canManage}
                        />
                      </div>
                    </div>

                    {/* 요일별 근무 시간 설정 */}
                    <div className="mt-4 border rounded-md overflow-hidden">
                      <div className="bg-muted/50 px-4 py-3 border-b flex items-center justify-between">
                        <span className="text-sm font-medium">기본 근무 스케줄</span>
                        <span className="text-xs text-muted-foreground">자동 스케줄 생성 시 사용됩니다.</span>
                      </div>
                      <div className="divide-y">
                        {workSchedules.map((schedule, index) => (
                          <div key={index} className={cn("flex items-center gap-4 px-4 py-3 transition-colors", schedule.is_holiday ? "bg-muted/20" : "bg-card")}>
                            <div className="flex items-center gap-3 w-20 shrink-0">
                              <Checkbox 
                                id={`day-${index}`}
                                checked={!schedule.is_holiday}
                                onCheckedChange={(checked) => handleScheduleChange(index, 'is_holiday', !checked)}
                                disabled={!canManage}
                              />
                              <Label htmlFor={`day-${index}`} className={cn("cursor-pointer font-medium", schedule.day === 0 ? "text-red-500" : schedule.day === 6 ? "text-blue-500" : "")}>
                                {DAYS[schedule.day]}요일
                              </Label>
                            </div>

                            {!schedule.is_holiday ? (
                              <div className="flex items-center gap-2 flex-1">
                                <TimePicker
                                  value={schedule.start_time}
                                  onChange={(val) => handleScheduleChange(index, 'start_time', val)}
                                  disabled={!canManage}
                                />
                                <span className="text-muted-foreground text-xs">~</span>
                                <TimePicker
                                  value={schedule.end_time}
                                  onChange={(val) => handleScheduleChange(index, 'end_time', val)}
                                  disabled={!canManage}
                                />
                                <div className="ml-auto flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground hidden sm:inline">휴게</span>
                                  <Input
                                    type="number"
                                    value={schedule.break_minutes}
                                    onChange={(e) => handleScheduleChange(index, 'break_minutes', parseInt(e.target.value) || 0)}
                                    className="w-16 h-8 text-sm text-right"
                                    min={0}
                                    step={10}
                                    disabled={!canManage}
                                  />
                                  <span className="text-xs text-muted-foreground">분</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground italic flex-1 pl-2">휴무</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 급여 정보 */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80 pb-2 border-b">
                      <Wallet className="w-4 h-4" />
                      급여 정보
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="wageType">지급 방식</Label>
                        <Select 
                          name="wageType" 
                          value={wageType} 
                          onValueChange={setWageType} 
                          disabled={!canManage}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="선택" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hourly">시급 (Hourly)</SelectItem>
                            <SelectItem value="monthly">월급 (Monthly)</SelectItem>
                          </SelectContent>
                        </Select>
                        <input type="hidden" name="wageType" value={wageType} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="baseWage">급여액 (원)</Label>
                        <Input
                          id="baseWage"
                          name="baseWage"
                          type="number"
                          value={baseWage}
                          onChange={(e) => setBaseWage(e.target.value)}
                          className="font-mono"
                          disabled={!canManage}
                          min={0}
                          step={100}
                        />
                        {wageType === 'hourly' && (
                          <div className="text-xs text-muted-foreground text-right">
                             월 예상 급여: 약 <span className="font-medium text-foreground">
                               {(() => {
                                  let totalMinutes = 0
                                  workSchedules.forEach(sch => {
                                    if (!sch.is_holiday && sch.start_time && sch.end_time) {
                                      const [startH, startM] = sch.start_time.split(':').map(Number)
                                      const [endH, endM] = sch.end_time.split(':').map(Number)
                                      let diff = (endH * 60 + endM) - (startH * 60 + startM)
                                      if (diff < 0) diff += 24 * 60
                                      diff -= (sch.break_minutes || 0)
                                      if (diff < 0) diff = 0
                                      totalMinutes += diff
                                    }
                                  })
                                  const weeklyPay = (totalMinutes / 60) * (parseInt(baseWage) || 0)
                                  const monthlyPay = Math.round(weeklyPay * 4.345)
                                  return monthlyPay.toLocaleString()
                               })()}
                             </span>원
                             (주휴수당 별도)
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="px-6 py-4 border-t bg-muted/10 flex items-center justify-between sm:justify-between shrink-0">
            <div className="flex gap-2">
              {canManage && !isPending && !isOwner && (
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

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading || sendingContract}>
                취소
              </Button>

              {canManage && !isPending && !isOwner && (
                <Button 
                  type="button" 
                  variant="secondary"
                  onClick={handleSendContract} 
                  disabled={loading || sendingContract}
                  className="bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                >
                  {sendingContract ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSignature className="mr-2 h-4 w-4" />}
                  계약서 발송
                </Button>
              )}
              
              {canManage && isPending ? (
                <Button 
                  type="button" 
                  onClick={handleApprove} 
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  승인 및 저장
                </Button>
              ) : (
                canManage && (
                  <Button type="submit" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    저장하기
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