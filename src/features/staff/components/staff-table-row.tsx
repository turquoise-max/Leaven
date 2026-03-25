'use client'

'use client'

import { TableCell, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Check, X, CalendarDays, ChevronRight, FileText, Download, Link2, Link2Off } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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

const getRoleText = (staff: StaffMember) => {
  if (staff.role_info) return staff.role_info.name
  if ((staff.details as any)?.last_role_name) return (staff.details as any).last_role_name
  if (staff.role === 'owner') return '점주'
  if (staff.role === 'manager') return '매니저'
  return '직원'
}

const getEmploymentText = (staff: StaffMember) => {
  switch (staff.employment_type) {
    case 'fulltime': return '정규직'
    case 'contract': return '계약직'
    case 'parttime': return '파트타임'
    case 'probation': return '수습'
    case 'daily': return '일용직'
    default: return '미지정'
  }
}

const getStatusBadge = (staff: StaffMember) => {
  if (staff.resigned_at) {
    return <span className="flex items-center justify-center gap-1.5 text-[13px] text-muted-foreground font-medium"><span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>퇴사</span>
  }
  switch (staff.status) {
    case 'active':
      return <span className="flex items-center justify-center gap-1.5 text-[13px] text-slate-700 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>재직</span>
    case 'invited':
    case 'pending_approval':
      return <span className="flex items-center justify-center gap-1.5 text-[13px] text-amber-700 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>대기</span>
    default:
      return <span className="text-[13px] text-muted-foreground">-</span>
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
  showContract?: boolean
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
  showContract = true,
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
        canManage && !isResigned ? "cursor-pointer hover:bg-slate-50 hover:shadow-sm" : "",
        isResigned ? "bg-muted/10 opacity-70" : "bg-card"
      )}
      onClick={onClick}
    >
      {/* 1. 상태 */}
      <TableCell className="w-[90px] align-middle text-center px-2">
        <div className="flex items-center justify-center">
           {getStatusBadge(staff)}
        </div>
      </TableCell>

      {/* 2. 직원 정보 (프로필 + 연락처 다이어트) */}
      <TableCell className="w-[260px] align-middle py-3 px-4">
        <div className="flex gap-3 items-center">
          <Avatar className={cn("h-10 w-10 border shadow-sm shrink-0", isResigned && "grayscale opacity-50")}>
            <AvatarImage src={staff.profile?.avatar_url || ''} />
            <AvatarFallback className="bg-slate-100 text-slate-600 font-medium text-sm">
              {getDisplayName(staff).substring(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col justify-center min-w-0 gap-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-sm tracking-tight text-foreground truncate max-w-[100px]">
                {getDisplayName(staff)}
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                 · {getRoleText(staff)}
              </span>
              
              {/* 아주 작고 심플한 앱 연동 고리 */}
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={cn(
                      "flex items-center justify-center w-4 h-4 rounded-full ml-0.5",
                      staff.user_id ? "bg-slate-100 text-slate-500" : "bg-rose-50 text-rose-400"
                    )}>
                      {staff.user_id ? <Link2 className="w-2.5 h-2.5" /> : <Link2Off className="w-2.5 h-2.5" />}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-[10px]">
                    {staff.user_id ? '앱 연동 완료' : '수기 등록 (앱 미연동)'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5 truncate">
              {email && <span className="truncate" title={email}>{email}</span>}
              {email && phone && <span className="text-muted-foreground/30">|</span>}
              {phone && <span className="font-mono tracking-tight">{phone}</span>}
              {!email && !phone && <span>연락처 미등록</span>}
            </div>
          </div>
        </div>
      </TableCell>

      {/* 3. 근로 조건 및 스케줄 (텍스트 + 알약 디자인) */}
      <TableCell className="align-middle py-3 px-4">
        {staff.role === 'owner' ? (
          <div className="flex items-center justify-center text-muted-foreground/50 font-medium w-full">
            -
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 justify-center">
            
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-slate-600">{getEmploymentText(staff)}</span>
              <span className="text-muted-foreground/30 text-xs">|</span>
              {canManage && staff.base_wage ? (
                <span className="text-[13px] font-bold tracking-tight text-foreground/90">
                  {wageText} {staff.base_wage.toLocaleString()}원
                  {(staff.wage_type === 'hourly' || staff.wage_type === 'daily') && expectedPay && (
                    <span className="text-[11px] font-normal text-muted-foreground ml-1">
                      (약 {expectedPay.toLocaleString()}원)
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-[12px] text-muted-foreground">급여 미설정</span>
              )}
            </div>

            <div className="flex items-start gap-1.5">
              <CalendarDays className="w-3 h-3 text-muted-foreground/70 mt-0.5 shrink-0" />
              {staff.work_schedules && staff.work_schedules.length > 0 ? (
                <div className="flex flex-col gap-0.5 text-[11px] font-medium text-slate-500 leading-snug break-keep">
                  {getDetailedScheduleText(staff.work_schedules).map((line, i) => (
                    <span key={i}>{line}</span>
                  ))}
                </div>
              ) : (
                <span className="text-[11px] text-muted-foreground/50">{staff.work_hours || '스케줄 미등록'}</span>
              )}
            </div>
            
          </div>
        )}
      </TableCell>

      {/* 4. 근로계약서 상태 뱃지 (미니멀리즘) */}
      {showContract !== false && (
        <TableCell className="w-[120px] align-middle text-center py-3 px-4">
          {staff.role === 'owner' ? (
            <div className="flex items-center justify-center text-muted-foreground/50 font-medium">
              -
            </div>
          ) : (
            <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
              {staff.contract_status === 'signed' ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-6 text-[11px] bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border-slate-200 px-2 font-medium shadow-none"
                  onClick={() => {
                    if (staff.contract_file_url) {
                      window.open(staff.contract_file_url, '_blank')
                    } else {
                      toast.info('문서 열람 기능은 준비 중입니다.')
                    }
                  }}
                  title="문서 열람"
                >
                  <FileText className="w-3 h-3 mr-1" />
                  체결 완료
                </Button>
              ) : staff.contract_status === 'pending_staff' || staff.contract_status === 'sent' ? (
                <Badge variant="outline" className="bg-amber-50/50 text-amber-700 border-amber-200/50 font-medium px-2 py-0.5 shadow-none" title={staff.contract_status === 'pending_staff' ? '직원이 서명할 차례입니다.' : '점주님의 서명이 필요합니다.'}>
                  서명 대기
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200/50 font-medium px-2 py-0.5 shadow-none" title="근로계약서가 아직 전송되지 않았습니다.">
                  미작성
                </Badge>
              )}
            </div>
          )}
        </TableCell>
      )}

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