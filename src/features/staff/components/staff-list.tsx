'use client'

import { useState, useEffect } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Shield, ShieldAlert, ShieldCheck, User, Check, X, UserPlus, Phone, Info } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EditStaffDialog } from './edit-staff-dialog'
import { approveRequest, rejectRequest, removeStaff } from '../actions'
import { toast } from 'sonner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface RoleInfo {
  id: string
  name: string
  color: string
  priority: number
  is_system: boolean
}

interface StaffMember {
  id: string
  user_id: string | null
  role: string // Legacy role string
  status: 'active' | 'invited' | 'pending_approval'
  wage_type?: 'hourly' | 'monthly'
  base_wage?: number
  work_hours?: string
  work_schedules?: any[] // Added
  hired_at?: string
  joined_at: string
  name: string | null // 수기 등록 이름
  email: string | null // 수기 등록 이메일
  phone: string | null // 수기 등록 전화번호
  profile: {
    full_name: string | null
    email: string | null
    phone: string | null
    avatar_url: string | null
  } | null
  role_info?: RoleInfo
}

interface StaffListProps {
  initialData: any[]
  storeId: string
  canManage: boolean
}

const DAYS = ['일', '월', '화', '수', '목', '금', '토']

export function StaffList({ initialData, storeId, canManage }: StaffListProps) {
  const [staffList, setStaffList] = useState<StaffMember[]>(initialData)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    setStaffList(initialData)
  }, [initialData])

  const pendingStaff = staffList.filter(s => s.status === 'pending_approval')
  
  const activeStaff = staffList
    .filter(s => s.status !== 'pending_approval')
    .sort((a, b) => {
      // 1순위: 우선순위 (priority 높은 순)
      const priorityA = a.role_info?.priority ?? (a.role === 'owner' ? 100 : (a.role === 'manager' ? 50 : 0))
      const priorityB = b.role_info?.priority ?? (b.role === 'owner' ? 100 : (b.role === 'manager' ? 50 : 0))
      if (priorityA !== priorityB) return priorityB - priorityA
      
      // 2순위: 이름 (가나다순)
      const nameA = a.name || a.profile?.full_name || ''
      const nameB = b.name || b.profile?.full_name || ''
      return nameA.localeCompare(nameB)
    })

  const handleApprove = async (memberId: string) => {
    setProcessingId(memberId)
    const result = await approveRequest(storeId, memberId)
    setProcessingId(null)

    if (result.error) {
      toast.error('승인 실패', { description: result.error })
    } else {
      toast.success('승인 완료', { description: '직원의 가입 요청을 승인했습니다.' })
      // Optimistic update
      setStaffList(prev => prev.map(s => s.id === memberId ? { ...s, status: 'active' } : s))
    }
  }

  const handleReject = async (memberId: string) => {
    if (!confirm('정말 거절하시겠습니까? 해당 요청은 삭제됩니다.')) return

    setProcessingId(memberId)
    const result = await rejectRequest(storeId, memberId)
    setProcessingId(null)

    if (result.error) {
      toast.error('거절 실패', { description: result.error })
    } else {
      toast.success('거절 완료', { description: '가입 요청을 거절했습니다.' })
      // Optimistic update
      setStaffList(prev => prev.filter(s => s.id !== memberId))
    }
  }

  const handleRemove = async (memberId: string, staffName: string) => {
    if (!confirm(`'${staffName}' 직원을 퇴사 처리하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return

    const result = await removeStaff(storeId, memberId)

    if (result.error) {
      toast.error('퇴사 처리 실패', { description: result.error })
    } else {
      toast.success('퇴사 처리 완료', { description: '직원이 퇴사 처리되었습니다.' })
      // Optimistic update
      setStaffList(prev => prev.filter(s => s.id !== memberId))
    }
  }

  const getDisplayName = (staff: StaffMember) => {
    return staff.name || staff.profile?.full_name || '이름 없음'
  }

  const getDisplayEmail = (staff: StaffMember) => {
    return staff.profile?.email || staff.email || '-'
  }

  const getDisplayPhone = (staff: StaffMember) => {
    return staff.profile?.phone || staff.phone || ''
  }

  const getRoleBadge = (staff: StaffMember) => {
    const roleName = staff.role_info?.name || (staff.role === 'owner' ? '점주' : (staff.role === 'manager' ? '매니저' : '직원'))
    const roleColor = staff.role_info?.color || (staff.role === 'owner' ? '#7c3aed' : (staff.role === 'manager' ? '#4f46e5' : '#808080'))

    return (
      <Badge 
        variant="outline"
        style={{ 
          backgroundColor: roleColor, 
          color: '#ffffff',
          borderColor: roleColor 
        }}
        className="hover:opacity-90 transition-opacity border-0"
      >
        {roleName}
      </Badge>
    )
  }

  const getStatusBadge = (status: string, userId: string | null) => {
    if (!userId && status === 'active') {
       return <Badge variant="outline" className="text-gray-600 border-gray-600">수기등록</Badge>
    }

    switch (status) {
      case 'active':
        return <Badge variant="outline" className="text-green-600 border-green-600">재직중</Badge>
      case 'invited':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600">초대됨</Badge>
      case 'pending_approval':
        return <Badge variant="outline" className="text-orange-600 border-orange-600">승인 대기</Badge>
      default:
        return <Badge variant="outline">알 수 없음</Badge>
    }
  }

  const getRoleIcon = (staff: StaffMember) => {
    const isSystem = staff.role_info?.is_system
    const roleName = staff.role_info?.name || staff.role
    const roleColor = staff.role_info?.color || '#808080'

     if (roleName === '점주' || roleName === 'owner' || (isSystem && roleName === 'Owner')) {
        return <ShieldAlert className="h-4 w-4" style={{ color: roleColor }} />
     }
     if (roleName === '매니저' || roleName === 'manager' || (isSystem && roleName === 'Manager')) {
        return <ShieldCheck className="h-4 w-4" style={{ color: roleColor }} />
     }
     return <User className="h-4 w-4" style={{ color: roleColor }} />
  }

  // Helper Functions
  const calculateWorkStats = (schedules: any[]) => {
    if (!schedules || !Array.isArray(schedules) || schedules.length === 0) return null

    let days = 0
    let totalMinutes = 0

    schedules.forEach(sch => {
      if (!sch.is_holiday && sch.start_time && sch.end_time) {
        days++
        const [startH, startM] = sch.start_time.split(':').map(Number)
        const [endH, endM] = sch.end_time.split(':').map(Number)
        let diff = (endH * 60 + endM) - (startH * 60 + startM)
        if (diff < 0) diff += 24 * 60
        
        // Subtract break time
        diff -= (sch.break_minutes || 0)
        if (diff < 0) diff = 0
        
        totalMinutes += diff
      }
    })

    if (days === 0) return null

    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    
    return { days, hours, minutes, totalMinutes }
  }

  const getScheduleSummary = (staff: StaffMember) => {
    const stats = calculateWorkStats(staff.work_schedules || [])
    
    if (!stats) return staff.work_hours || '-' // Fallback to legacy string

    const timeString = stats.minutes > 0 
      ? `${stats.hours}시간 ${stats.minutes}분` 
      : `${stats.hours}시간`
      
    return `주 ${stats.days}일 (${timeString})`
  }

  const getExpectedMonthlyPay = (staff: StaffMember) => {
    if (staff.wage_type === 'monthly') return staff.base_wage
    
    const stats = calculateWorkStats(staff.work_schedules || [])
    if (!stats || !staff.base_wage) return null

    // Weekly Pay * 4.345 weeks
    // Weekly Pay = (Total Minutes / 60) * Hourly Wage
    const weeklyPay = (stats.totalMinutes / 60) * staff.base_wage
    const monthlyPay = Math.round(weeklyPay * 4.345) // Average weeks per month

    return monthlyPay
  }

  return (
    <div className="space-y-8">
      {/* 승인 대기 목록 */}
      {pendingStaff.length > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-orange-700 dark:text-orange-400 flex items-center gap-2 text-lg">
              <UserPlus className="h-5 w-5" /> 가입 승인 대기 ({pendingStaff.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>이름</TableHead>
                  <TableHead>연락처</TableHead>
                  <TableHead>신청일</TableHead>
                  <TableHead className="text-right">승인 / 거절</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingStaff.map((staff) => (
                  <TableRow 
                    key={staff.id} 
                    className="hover:bg-orange-100/50 dark:hover:bg-orange-900/20 cursor-pointer"
                    onClick={() => {
                      setEditingStaff(staff)
                      setDialogOpen(true)
                    }}
                  >
                    <TableCell className="font-medium">
                      {getDisplayName(staff)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {getDisplayPhone(staff) || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(staff.joined_at).toLocaleDateString('ko-KR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 w-8 p-0 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                          onClick={() => handleReject(staff.id)}
                          disabled={!canManage || processingId === staff.id}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          className="h-8 w-8 p-0 bg-green-600 hover:bg-green-700"
                          onClick={() => handleApprove(staff.id)}
                          disabled={!canManage || processingId === staff.id}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 전체 직원 목록 */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">프로필</TableHead>
              <TableHead>역할</TableHead>
              <TableHead>이름 / 이메일</TableHead>
              <TableHead>전화번호</TableHead>
              <TableHead>근무 스케줄</TableHead>
              <TableHead>급여 정보</TableHead>
              <TableHead>입사일</TableHead>
              <TableHead>상태</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeStaff.map((staff) => (
              <TableRow 
                key={staff.id} 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => {
                  setEditingStaff(staff)
                  setDialogOpen(true)
                }}
              >
                <TableCell>
                  <Avatar>
                    <AvatarImage src={staff.profile?.avatar_url || ''} />
                    <AvatarFallback>
                      {getDisplayName(staff).substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getRoleIcon(staff)}
                    {getRoleBadge(staff)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{getDisplayName(staff)}</span>
                    <span className="text-xs text-muted-foreground">{getDisplayEmail(staff)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {getDisplayPhone(staff) ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {getDisplayPhone(staff)}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {/* Work Schedule Summary with Tooltip */}
                  {staff.work_schedules && Array.isArray(staff.work_schedules) && staff.work_schedules.length > 0 ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1 cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-4">
                            <span className="text-sm">{getScheduleSummary(staff)}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="p-0 overflow-hidden border-border">
                          <div className="bg-muted px-3 py-2 text-xs font-medium border-b">상세 근무 스케줄</div>
                          <div className="p-2 space-y-1">
                            {staff.work_schedules.map((sch: any, i: number) => (
                              !sch.is_holiday ? (
                                <div key={i} className="text-xs flex gap-2">
                                  <span className="font-medium w-3">{DAYS[sch.day]}</span>
                                  <span>{sch.start_time} - {sch.end_time}</span>
                                  {sch.break_minutes > 0 && <span className="text-muted-foreground">(휴게 {sch.break_minutes}분)</span>}
                                </div>
                              ) : null
                            ))}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <span className="text-sm text-muted-foreground">{staff.work_hours || '-'}</span>
                  )}
                </TableCell>
                <TableCell>
                    <div className="flex flex-col text-sm">
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground text-xs w-8">
                              {staff.wage_type === 'monthly' ? '월급' : '시급'}
                          </span>
                          <span className="font-medium">
                              {staff.base_wage ? staff.base_wage.toLocaleString() : '-'}원
                          </span>
                        </div>
                        {staff.wage_type === 'hourly' && staff.base_wage && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            월 예상: 약 {getExpectedMonthlyPay(staff)?.toLocaleString()}원
                          </div>
                        )}
                    </div>
                </TableCell>
                <TableCell>
                  {staff.hired_at ? (
                    <span>{new Date(staff.hired_at).toLocaleDateString('ko-KR')}</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>{getStatusBadge(staff.status, staff.user_id)}</TableCell>
              </TableRow>
            ))}
            {activeStaff.length === 0 && (
               <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  등록된 직원이 없습니다.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <EditStaffDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          staff={editingStaff}
          storeId={storeId}
          canManage={canManage}
        />
      </div>
    </div>
  )
}