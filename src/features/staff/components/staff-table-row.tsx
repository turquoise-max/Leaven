'use client'

import { TableCell, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ShieldAlert, ShieldCheck, User, Check, X, Phone, Mail, CalendarDays, ChevronRight, FileText, Download } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { StaffMember } from './staff-list'

const DAYS = ['일', '월', '화', '수', '목', '금', '토']

const getDisplayName = (staff: StaffMember) => {
  if (staff.name && staff.name.trim() !== '') return staff.name
  if (staff.profile?.full_name && staff.profile.full_name.trim() !== '') return staff.profile.full_name
  return '이름 없음'
}

const getDisplayEmail = (staff: StaffMember) => {
  if (staff.email && staff.email.trim() !== '') return staff.email
  if (staff.profile?.email && staff.profile.email.trim() !== '') return staff.profile.email
  return ''
}

const getDisplayPhone = (staff: StaffMember) => {
  if (staff.phone && staff.phone.trim() !== '') return staff.phone
  if (staff.profile?.phone && staff.profile.phone.trim() !== '') return staff.profile.phone
  return ''
}

const getRoleBadge = (staff: StaffMember) => {
  let roleName = '역할 미설정'
  let roleColor = '#808080'
  let Icon = User

  if (staff.role_info) {
    roleName = staff.role_info.name
    roleColor = staff.role_info.color || roleColor
  } else if ((staff.details as any)?.last_role_name) {
    roleName = (staff.details as any).last_role_name
  } else if (staff.role === 'owner') {
    roleName = '점주'
    roleColor = '#7c3aed'
  } else if (staff.role === 'manager') {
    roleName = '매니저'
    roleColor = '#4f46e5'
  }

  if (roleName === '점주' || roleName === 'Owner') {
     Icon = ShieldAlert
  } else if (roleName === '매니저' || roleName === 'Manager') {
     Icon = ShieldCheck
  }

  return (
    <Badge 
      variant="outline"
      style={{ 
        backgroundColor: `${roleColor}15`,
        color: roleColor,
        borderColor: `${roleColor}40`
      }}
      className="px-2 py-0 h-5 text-[10px] font-semibold tracking-wide border rounded flex items-center gap-1 shadow-sm"
    >
      <Icon className="w-3 h-3" />
      {roleName}
    </Badge>
  )
}

const getEmploymentBadge = (staff: StaffMember) => {
  switch (staff.employment_type) {
    case 'fulltime':
      return <Badge variant="secondary" className="bg-blue-100/80 text-blue-800 hover:bg-blue-100 rounded-sm px-2 py-0 text-[11px] font-medium border border-blue-200">정규직</Badge>
    case 'contract':
      return <Badge variant="secondary" className="bg-purple-100/80 text-purple-800 hover:bg-purple-100 rounded-sm px-2 py-0 text-[11px] font-medium border border-purple-200">계약직</Badge>
    case 'parttime':
      return <Badge variant="secondary" className="bg-green-100/80 text-green-800 hover:bg-green-100 rounded-sm px-2 py-0 text-[11px] font-medium border border-green-200">파트타임</Badge>
    case 'probation':
      return <Badge variant="secondary" className="bg-amber-100/80 text-amber-800 hover:bg-amber-100 rounded-sm px-2 py-0 text-[11px] font-medium border border-amber-200">수습</Badge>
    case 'daily':
      return <Badge variant="secondary" className="bg-orange-100/80 text-orange-800 hover:bg-orange-100 rounded-sm px-2 py-0 text-[11px] font-medium border border-orange-200">일용직</Badge>
    default:
      return <Badge variant="secondary" className="bg-gray-100 text-gray-600 rounded-sm px-2 py-0 text-[11px] font-medium border border-gray-200">미지정</Badge>
  }
}

const getStatusBadge = (staff: StaffMember) => {
  if (staff.resigned_at) {
    return (
      <Badge variant="outline" className="text-gray-500 border-gray-300 bg-gray-50 shadow-sm w-full justify-center py-0.5">퇴사자</Badge>
    )
  }

  switch (staff.status) {
    case 'active':
      return (
        <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50 shadow-sm w-full justify-center py-0.5 font-semibold">재직중</Badge>
      )
    case 'invited':
      return (
        <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 shadow-sm w-full justify-center py-0.5">가입 대기</Badge>
      )
    case 'pending_approval':
      return (
        <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50 shadow-sm w-full justify-center py-0.5 font-semibold">승인 대기</Badge>
      )
    default:
      return <Badge variant="outline">알 수 없음</Badge>
  }
}

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
      
      diff -= (sch.break_minutes || 0)
      if (diff < 0) diff = 0
      
      totalMinutes += diff
    }
  })

  if (days === 0) return null
  return { days, totalMinutes }
}

const getDetailedScheduleText = (schedules: any[]): string[] => {
  if (!schedules || !Array.isArray(schedules) || schedules.length === 0) return ['스케줄 미등록']
  
  const activeDays = schedules.filter(sch => !sch.is_holiday).sort((a, b) => a.day - b.day)
  if (activeDays.length === 0) return ['스케줄 없음']

  const groups: { [time: string]: string[] } = {}
  activeDays.forEach(sch => {
      const timeKey = `${sch.start_time}-${sch.end_time}`
      if (!groups[timeKey]) groups[timeKey] = []
      groups[timeKey].push(DAYS[sch.day])
  })

  return Object.entries(groups).map(([time, days]) => {
      const [start, end] = time.split('-')
      const dayStr = days.join(',')
      return `${dayStr} (${start}~${end})`
  })
}

const getExpectedMonthlyPay = (staff: StaffMember) => {
  if (staff.wage_type === 'monthly' || staff.wage_type === 'yearly') return staff.base_wage
  
  const stats = calculateWorkStats(staff.work_schedules || [])
  if (!stats || !staff.base_wage) return null

  if (staff.wage_type === 'daily') {
    return (staff.base_wage * stats.days) * 4.345
  }

  const weeklyPay = (stats.totalMinutes / 60) * staff.base_wage
  return Math.round(weeklyPay * 4.345) 
}

interface StaffTableRowProps {
  staff: StaffMember
  isResigned?: boolean
  canManage: boolean
  processingId: string | null
  onApprove: (id: string, name: string) => void
  onReject: (id: string, name: string) => void
  onDeleteRecord?: (id: string, name: string) => void
  onRestoreRecord?: (id: string, name: string) => void
  onClick: () => void
}

export function StaffTableRow({ 
  staff, 
  isResigned = false, 
  canManage, 
  processingId, 
  onApprove, 
  onReject,
  onDeleteRecord,
  onRestoreRecord,
  onClick 
}: StaffTableRowProps) {
  const email = getDisplayEmail(staff)
  const phone = getDisplayPhone(staff)
  const expectedPay = getExpectedMonthlyPay(staff)
  const wageText = staff.wage_type === 'monthly' ? '월급' : staff.wage_type === 'yearly' ? '연봉' : staff.wage_type === 'daily' ? '일급' : '시급'
  
  return (
    <TableRow 
      className={cn(
        "group transition-all duration-200 border-b relative",
        canManage && !isResigned ? "cursor-pointer hover:bg-primary/5 hover:shadow-sm" : "",
        isResigned ? "bg-muted/30 opacity-80" : "bg-card"
      )}
      onClick={onClick}
    >
      {/* 1. 상태 */}
      <TableCell className="w-[80px] align-middle text-center px-2">
        <div className="flex items-center justify-center">
           {getStatusBadge(staff)}
        </div>
      </TableCell>

      {/* 2. 직원 정보 (프로필 + 연락처) */}
      <TableCell className="w-[260px] align-middle py-4 px-4">
        <div className="flex gap-4 items-center">
          <Avatar className={cn("h-11 w-11 border shadow-sm shrink-0", isResigned && "grayscale")}>
            <AvatarImage src={staff.profile?.avatar_url || ''} />
            <AvatarFallback className="bg-primary/5 text-primary font-medium text-base">
              {getDisplayName(staff).substring(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col justify-center min-w-0 gap-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-bold text-sm tracking-tight text-foreground truncate max-w-[120px]">
                {getDisplayName(staff)}
              </span>
              {getRoleBadge(staff)}
            </div>
            
            <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
              {/* 입/퇴사일 정보 */}
              <div className="flex items-center gap-1.5">
                <CalendarDays className="w-3 h-3 shrink-0" />
                <span>입사: {staff.hired_at ? new Date(staff.hired_at).toLocaleDateString('ko-KR') : '미지정'}</span>
                {isResigned && staff.resigned_at && (
                  <>
                    <span className="text-muted-foreground/30 mx-0.5">|</span>
                    <span className="text-red-500 font-medium">
                      퇴사: {new Date(staff.resigned_at).toLocaleDateString('ko-KR')}
                    </span>
                  </>
                )}
              </div>

              {/* 이메일 */}
              {email && (
                <div className="flex items-center gap-1.5 truncate" title={email}>
                  <Mail className="w-3 h-3 shrink-0" />
                  <span className="truncate">{email}</span>
                </div>
              )}
              
              {/* 전화번호 */}
              {phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3 h-3 shrink-0" />
                  <span className="font-mono tracking-tight">{phone}</span>
                </div>
              )}
              
              {!email && !phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3 h-3 shrink-0 opacity-0" />
                  <span>연락처 미등록</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </TableCell>

      {/* 3. 근로 조건 및 스케줄 (가장 많은 여백 차지) */}
      <TableCell className="align-middle py-4 px-4">
        <div className="flex flex-col gap-2.5 justify-center">
          
          <div className="flex items-center gap-2 flex-wrap">
            {getEmploymentBadge(staff)}
            <div className="flex items-center gap-2">
              {canManage && staff.base_wage ? (
                <span className="text-[13px] font-semibold tracking-tight text-foreground/90">
                  {wageText} {staff.base_wage.toLocaleString()}원
                  {(staff.wage_type === 'hourly' || staff.wage_type === 'daily') && expectedPay && (
                    <span className="text-[11px] font-normal text-muted-foreground ml-1">
                      (약 {expectedPay.toLocaleString()}원/월)
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">급여 미설정</span>
              )}
            </div>
          </div>

          <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-md bg-muted/40 border border-muted/50 w-fit max-w-full">
            <CalendarDays className="w-3.5 h-3.5 text-muted-foreground mt-[2px] shrink-0" />
            {staff.work_schedules && staff.work_schedules.length > 0 ? (
              <div className="flex flex-col gap-0.5 text-xs font-medium text-foreground/80 leading-snug break-keep">
                {getDetailedScheduleText(staff.work_schedules).map((line, i) => (
                  <span key={i}>{line}</span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground/60">{staff.work_hours || '등록된 스케줄 없음'}</span>
            )}
          </div>
          
        </div>
      </TableCell>

      {/* 4. 근로계약서 문서 */}
      <TableCell className="w-[120px] align-middle text-center py-4 px-4">
        <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          {staff.contract_status === 'signed' ? (
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 text-xs bg-purple-50 text-purple-700 hover:bg-purple-100 hover:text-purple-800 border-purple-200"
              onClick={() => toast.info('문서 열람 기능은 준비 중입니다.')}
            >
              <FileText className="w-3.5 h-3.5 mr-1" />
              완료
              <Download className="w-3 h-3 ml-1.5 opacity-50" />
            </Button>
          ) : staff.contract_status === 'sent' ? (
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded-md border border-purple-100">
              <FileText className="w-3.5 h-3.5" />
              대기중
            </div>
          ) : (
            <span className="text-xs text-muted-foreground/50 px-1">미작성</span>
          )}
        </div>
      </TableCell>

      {/* 5. 승인/거절/삭제 액션 & 화살표 아이콘 */}
      <TableCell className="w-[100px] align-middle text-right pr-6">
        <div className="flex items-center justify-end gap-3 h-full">
          {staff.status === 'pending_approval' && !isResigned && canManage && (
            <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
              <Button 
                size="sm" 
                variant="outline" 
                className="h-8 px-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300 shadow-sm transition-colors text-xs"
                onClick={() => onReject(staff.id, getDisplayName(staff))}
                disabled={processingId === staff.id}
              >
                <X className="h-3 w-3 mr-1" />
                거절
              </Button>
              <Button 
                size="sm" 
                className="h-8 px-2 bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-colors text-xs"
                onClick={() => onApprove(staff.id, getDisplayName(staff))}
                disabled={processingId === staff.id}
              >
                <Check className="h-3 w-3 mr-1" />
                승인
              </Button>
            </div>
          )}

          {isResigned && canManage && (
            <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
              {onRestoreRecord && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 px-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 shadow-sm transition-colors text-[10px]"
                  onClick={() => onRestoreRecord(staff.id, getDisplayName(staff))}
                  disabled={processingId === staff.id}
                >
                  복원
                </Button>
              )}
              {onDeleteRecord && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 px-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300 shadow-sm transition-colors text-[10px]"
                  onClick={() => onDeleteRecord(staff.id, getDisplayName(staff))}
                  disabled={processingId === staff.id}
                >
                  영구 삭제
                </Button>
              )}
            </div>
          )}
          
          {canManage && !isResigned && staff.status !== 'pending_approval' && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center gap-1 text-muted-foreground w-full items-end">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}