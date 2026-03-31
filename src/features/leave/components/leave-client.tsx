'use client'

import { useState, useEffect, useRef } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Umbrella, Calendar, FileText, Settings, Search, Download, Plus, Check, X, RotateCcw } from 'lucide-react'
import { getLeaveBalances, getLeaveRequests, resolveLeaveRequest, createLeaveRequest, updateLeaveBalance, cancelLeaveRequest, resetAllLeaveBalances, revokeLeaveRequest } from '@/features/leave/actions'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { LeaveAttachmentUpload } from '@/features/leave/components/leave-attachment-upload'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'

import { calculateAnnualLeave } from '@/features/leave/utils'
import { differenceInMonths, differenceInYears, differenceInDays, parseISO } from 'date-fns'

interface LeaveClientPageProps {
  storeId: string
  roles: any[]
  staffList: any[]
  isManager: boolean
  currentUserId: string
  leaveCalcType: 'hire_date' | 'fiscal_year'
}

export function LeaveClientPage({
  storeId,
  roles,
  staffList,
  isManager,
  currentUserId,
  leaveCalcType
}: LeaveClientPageProps) {
  const [activeTab, setActiveTab] = useState('calendar')
  const referenceDate = new Date() // Always use today
  const selectedYear = referenceDate.getFullYear()
  const [balances, setBalances] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false)
  const [requestDraft, setRequestDraft] = useState({ 
    memberId: '', // Will be set in useEffect or when manager selects
    leaveType: 'annual', 
    startDate: format(new Date(), 'yyyy-MM-dd'), 
    endDate: format(new Date(), 'yyyy-MM-dd'), 
    requestedDays: 1, 
    reason: '',
    attachmentUrl: ''
  })
  const [submitLoading, setSubmitLoading] = useState(false)
  const calendarRef = useRef<any>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [balRes, reqRes] = await Promise.all([
        getLeaveBalances(storeId, selectedYear),
        getLeaveRequests(storeId)
      ])
      setBalances(balRes || [])
      setRequests(reqRes || [])
    } catch (error) {
      console.error(error)
      toast.error('휴가 데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [storeId, selectedYear])

  const myStaff = staffList.find(s => s.user_id === currentUserId)

  useEffect(() => {
    if (myStaff && !requestDraft.memberId) {
      setRequestDraft(prev => ({ ...prev, memberId: myStaff.id }))
    }
  }, [myStaff])

  const pendingCount = isManager 
    ? requests.filter(r => r.status === 'pending').length
    : requests.filter(r => r.status === 'pending' && r.member?.user_id === currentUserId).length

  const getStaffRoleInfo = (staff: any) => {
    if (staff?.role_info) return staff.role_info
    if (staff?.role) {
      const legacyRoleName = staff.role === 'owner' ? '점주' : staff.role === 'manager' ? '매니저' : '직원'
      const foundRole = roles?.find(r => r.name === legacyRoleName)
      if (foundRole) return foundRole
    }
    return null
  }

  const getServicePeriodLabel = (hiredAt: string | null) => {
    if (!hiredAt) return '-'
    const start = new Date(hiredAt)
    const today = new Date()
    
    const years = differenceInYears(today, start)
    const months = differenceInMonths(today, start) % 12
    
    if (years === 0) return `${months}개월`
    if (months === 0) return `${years}년`
    return `${years}년 ${months}개월`
  }

  const myRequests = requests.filter(r => r.member?.user_id === currentUserId)
  const myBalance = balances.find(b => b.member_id === myStaff?.id)
  
  const rawHireDate = myStaff?.hired_at || myStaff?.join_date
  const formattedHireDate = rawHireDate ? new Date(rawHireDate).toISOString().split('T')[0] : null
  
  const calcTotal = formattedHireDate ? calculateAnnualLeave(formattedHireDate, referenceDate, leaveCalcType) : 0
  const total = myBalance?.total_days !== undefined && myBalance?.total_days !== null ? myBalance.total_days : calcTotal
  const used = myBalance?.used_days || 0
  const remain = total - used

  const view = (
    <div className="flex flex-col h-full bg-white md:rounded-xl md:border md:shadow-sm relative">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="px-4 md:px-6 border-b bg-slate-50/50 flex justify-between items-center h-14 shrink-0">
          <TabsList className="bg-transparent h-full p-0 gap-4 md:gap-8 justify-start w-full md:w-auto overflow-x-auto no-scrollbar">
            <TabsTrigger 
              value="calendar" 
              className="relative rounded-none px-1 pb-3 pt-2 text-sm md:text-base font-semibold text-muted-foreground hover:text-foreground data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none outline-none focus-visible:outline-none !shadow-none bg-transparent group whitespace-nowrap"
            >
              <Calendar className="w-4 h-4 mr-1.5 md:mr-2" />
              <span className="hidden md:inline">휴가 현황 (캘린더)</span>
              <span className="md:hidden">휴가 현황</span>
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary scale-x-0 origin-left transition-transform duration-200 group-data-[state=active]:scale-x-100" />
            </TabsTrigger>
            <TabsTrigger 
              value="requests" 
              className="relative rounded-none px-1 pb-3 pt-2 text-sm md:text-base font-semibold text-muted-foreground hover:text-foreground data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none outline-none focus-visible:outline-none !shadow-none bg-transparent group whitespace-nowrap"
            >
              <FileText className="w-4 h-4 mr-1.5 md:mr-2" />
              휴가 신청함
              {pendingCount > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-2 md:-right-4 w-4 h-4 md:w-5 md:h-5 flex items-center justify-center p-0 text-[10px]">
                  {pendingCount}
                </Badge>
              )}
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary scale-x-0 origin-left transition-transform duration-200 group-data-[state=active]:scale-x-100" />
            </TabsTrigger>
            <TabsTrigger 
              value="balances" 
              className="relative rounded-none px-1 pb-3 pt-2 text-sm md:text-base font-semibold text-muted-foreground hover:text-foreground data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none outline-none focus-visible:outline-none !shadow-none bg-transparent group flex items-center gap-1.5 md:gap-2 whitespace-nowrap"
            >
              <div className="flex items-center">
                <Settings className="w-4 h-4 mr-1.5 md:mr-2" />
                <span className="hidden md:inline">잔여 연차 관리</span>
                <span className="md:hidden">연차 관리</span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary scale-x-0 origin-left transition-transform duration-200 group-data-[state=active]:scale-x-100" />
            </TabsTrigger>
          </TabsList>
          
          <Button className="shadow-sm px-3 h-9 md:h-10" onClick={() => setIsRequestModalOpen(true)}>
            <Plus className="w-4 h-4 md:mr-2" />
            <span className="hidden md:inline">휴가 신청</span>
          </Button>
        </div>

        <div className="flex-1 overflow-auto bg-slate-50/30 p-4 md:p-6">
          <TabsContent value="calendar" className="m-0 mt-0 h-full flex flex-col gap-2 md:gap-6 outline-none">
            <div className="bg-transparent md:bg-white md:rounded-lg md:border md:shadow-sm overflow-hidden flex-1 flex flex-col">
              <div className="p-4 border-b flex items-center justify-between shrink-0 bg-white md:bg-slate-50/50">
                <h1 className="text-base md:text-2xl font-semibold md:font-bold tracking-tight w-full text-center md:text-left">{isManager ? '직원 휴가 캘린더' : '전체 휴가 캘린더'}</h1>
                <div className="hidden md:flex gap-2 text-[11px] font-medium w-full md:w-auto justify-center md:justify-end">
                  <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-200">
                    <div className="w-2 h-2 rounded-full bg-blue-500" /> 연차
                  </div>
                  <div className="flex items-center gap-1.5 bg-red-50 text-red-700 px-2 py-1 rounded border border-red-200">
                    <div className="w-2 h-2 rounded-full bg-red-500" /> 병가
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-2 py-1 rounded border border-slate-200">
                    <div className="w-2 h-2 rounded-full bg-slate-400" /> 무급휴가
                  </div>
                </div>
              </div>
              <div className="flex-1 p-0 md:p-4 overflow-hidden relative leave-calendar-container">
                <style>{`
                  .leave-calendar-container .fc { height: 100%; font-size: 13px; }
                  .leave-calendar-container .fc-theme-standard th { border-color: rgba(0,0,0,0.05); padding: 8px 0; background: #f8fafc; font-weight: 600; color: #475569; }
                  .leave-calendar-container .fc-theme-standard td { border-color: rgba(0,0,0,0.05); }
                  .leave-calendar-container .fc-daygrid-day-number { padding: 4px 8px; color: #334155; font-weight: 500; }
                  .leave-calendar-container .fc-event { border: none; border-radius: 4px; padding: 2px 4px; margin: 1px 4px; font-size: 11px; font-weight: 600; }
                  .leave-calendar-container .fc .fc-today-button:disabled { opacity: 1 !important; pointer-events: auto !important; cursor: pointer !important; }
                  
                  /* Mobile specific header layout */
                  @media (max-width: 768px) {
                    .leave-calendar-container .fc-header-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5em !important; margin-top: 0.5em !important; }
                    .leave-calendar-container .fc-toolbar-chunk:nth-child(1) { order: 1; } /* prev */
                    .leave-calendar-container .fc-toolbar-chunk:nth-child(2) { order: 2; flex: 1; text-align: center; } /* title */
                    .leave-calendar-container .fc-toolbar-chunk:nth-child(3) { order: 3; } /* next */
                    .leave-calendar-container .fc-today-button { display: none !important; }
                    .leave-calendar-container .fc-toolbar-title { font-size: 1.1em !important; font-weight: 700; }
                  }

                  /* Desktop header: align title and prev/next close together */
                  @media (min-width: 769px) {
                    .leave-calendar-container .fc-header-toolbar { display: flex; justify-content: flex-start; gap: 1.5rem; align-items: center; }
                    .leave-calendar-container .fc-toolbar-chunk { display: flex; align-items: center; gap: 0.5rem; }
                    .leave-calendar-container .fc-toolbar-chunk:last-child { margin-left: auto; } /* today button to the right */
                    .leave-calendar-container .fc-toolbar-title { font-size: 1.25rem; font-weight: 700; margin: 0; min-width: 120px; text-align: center; }
                  }
                `}</style>
                <FullCalendar
                  ref={calendarRef}
                  plugins={[dayGridPlugin, interactionPlugin]}
                  initialView="dayGridMonth"
                  locale={ko}
                  customButtons={{
                    today: {
                      text: '오늘',
                      click: () => {
                        const calendarApi = calendarRef.current.getApi()
                        calendarApi.today()
                      }
                    }
                  }}
                  headerToolbar={{ 
                    left: 'prev', 
                    center: 'title', 
                    right: 'next today' 
                  }}
                  events={requests.filter(r => r.status === 'approved').map(r => {
                    let color = '#94a3b8'
                    if (r.leave_type === 'annual') color = '#3b82f6'
                    if (r.leave_type === 'sick') color = '#ef4444'
                    if (r.leave_type.startsWith('half')) color = '#60a5fa'
                    const name = r.member?.name || r.member?.profile?.full_name || '직원'
                    const label = r.leave_type === 'annual' ? '연차' : r.leave_type === 'sick' ? '병가' : r.leave_type === 'unpaid' ? '무급' : '반차'
                    const endDateObj = new Date(r.end_date)
                    endDateObj.setDate(endDateObj.getDate() + 1)
                    return { id: r.id, title: `${name} (${label})`, start: r.start_date, end: endDateObj.toISOString().substring(0, 10), backgroundColor: color, textColor: '#fff', allDay: true }
                  })}
                  height="100%"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="requests" className="m-0 mt-0 h-full flex flex-col outline-none">
            <div className="bg-white md:rounded-lg border shadow-sm overflow-hidden flex-1 flex flex-col">
              <div className="p-4 border-b flex items-center justify-between bg-white md:bg-transparent">
                <h1 className="text-base md:text-2xl font-semibold md:font-bold tracking-tight w-full text-center md:text-left">{isManager ? '휴가 및 연차 신청함' : '나의 휴가 신청 내역'}</h1>
              </div>
              <div className="flex-1 overflow-auto bg-slate-50/50 p-6">
                {(isManager ? requests : myRequests).length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-muted-foreground h-full bg-white rounded-xl border border-dashed border-border/50">
                    <FileText className="w-12 h-12 mb-4 opacity-20" />
                    <p>등록된 휴가 신청이 없습니다.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 max-w-4xl mx-auto">
                    {(isManager ? requests : myRequests).map(req => {
                      const handleResolve = async (status: 'approved' | 'rejected') => {
                        if (!isManager) return
                        if (!window.confirm(`이 휴가를 ${status === 'approved' ? '승인' : '반려'}하시겠습니까?`)) return
                        setActionLoading(req.id)
                        try {
                          const res = await resolveLeaveRequest(req.id, storeId, status)
                          if (res.error) toast.error(res.error)
                          else { toast.success('처리되었습니다.'); fetchData(); }
                        } catch (e) { toast.error('오류 발생'); } finally { setActionLoading(null); }
                      }
                      const leaveTypeLabel = req.leave_type === 'annual' ? '연차' : req.leave_type === 'sick' ? '병가' : req.leave_type === 'unpaid' ? '무급휴가' : '반차'
                      return (
                        <div key={req.id} className={cn("bg-white border shadow-sm rounded-xl p-4 md:p-5 flex flex-col gap-3 md:gap-4 transition-colors", req.status !== 'pending' && "opacity-80 bg-slate-50/50")}>
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-0">
                            <div className="flex items-center gap-2.5 md:gap-3">
                              <Avatar className="h-9 w-9 md:h-10 md:w-10 border shrink-0">
                                <AvatarFallback>{req.member?.name?.substring(0,2)}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-sm md:text-base truncate">{req.member?.name || req.member?.profile?.full_name}</span>
                                  <Badge variant="outline" className="text-[9px] md:text-[10px] px-1 h-4 md:h-5 shrink-0">{req.member?.role_info?.name || '직원'}</Badge>
                                </div>
                                <div className="text-xs md:text-sm text-muted-foreground mt-0.5 font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                                  {req.start_date} ~ {req.end_date} 
                                  <span className="font-bold text-foreground ml-1">({req.requested_days}일)</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                              <Badge variant="outline" className="text-[10px] md:text-xs bg-primary/5 text-primary border-primary/20 px-1.5 py-0 md:py-0.5">{leaveTypeLabel}</Badge>
                              <Badge variant="secondary" className={cn(
                                "text-[10px] md:text-xs px-1.5 py-0 md:py-0.5",
                                req.status === 'pending' ? "bg-orange-100 text-orange-700" : 
                                req.status === 'approved' ? "bg-green-100 text-green-700" : 
                                req.status === 'cancelled' ? "bg-slate-100 text-slate-600" :
                                "bg-red-100 text-red-700"
                              )}>
                                {req.status === 'pending' ? '대기 중' : 
                                 req.status === 'approved' ? '승인 완료' : 
                                 req.status === 'cancelled' ? '취소됨' :
                                 '반려됨'}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] md:text-xs font-semibold text-muted-foreground">사유 및 증빙 자료</span>
                            <div className="text-xs md:text-sm bg-muted/30 p-2.5 md:p-3 rounded-md border border-dashed border-black/10 whitespace-pre-wrap leading-relaxed">{req.reason}</div>
                            {req.attachment_url && (
                              <a href={req.attachment_url} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-2 p-2 md:p-3 rounded-lg border bg-white hover:bg-slate-50 transition-colors w-fit">
                                <FileText className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
                                <span className="text-[10px] md:text-xs font-bold text-slate-700">증빙 서류 확인</span>
                              </a>
                            )}
                          </div>
                          <div className="flex gap-2 justify-end mt-2">
                            {req.status === 'pending' && isManager && (
                              <>
                                <Button variant="outline" className="text-destructive border-destructive/20" disabled={!!actionLoading} onClick={() => handleResolve('rejected')}>반려</Button>
                                <Button className="bg-[#1D9E75]" disabled={!!actionLoading} onClick={() => handleResolve('approved')}>승인</Button>
                              </>
                            )}
                            {req.status === 'approved' && isManager && (
                              <Button 
                                variant="outline" 
                                className="text-muted-foreground border-slate-200 hover:bg-slate-50" 
                                disabled={!!actionLoading}
                                onClick={async () => {
                                  if (!window.confirm('승인된 휴가를 취소하시겠습니까? (차감된 연차가 복구됩니다)')) return
                                  setActionLoading(req.id)
                                  try {
                                    const res = await revokeLeaveRequest(req.id, storeId)
                                    if (res.error) toast.error(res.error)
                                    else { toast.success('승인이 취소되었습니다.'); fetchData(); }
                                  } catch (e) { toast.error('오류 발생'); } finally { setActionLoading(null); }
                                }}
                              >
                                <RotateCcw className="w-4 h-4 mr-1" />
                                승인 취소
                              </Button>
                            )}
                            {req.status === 'pending' && !isManager && req.member?.user_id === currentUserId && (
                              <Button 
                                variant="outline" 
                                className="text-muted-foreground border-slate-200 hover:bg-slate-50" 
                                disabled={!!actionLoading}
                                onClick={async () => {
                                  if (!window.confirm('신청하신 휴가를 취소하시겠습니까?')) return
                                  setActionLoading(req.id)
                                  try {
                                    const res = await cancelLeaveRequest(req.id, storeId)
                                    if (res.error) toast.error(res.error)
                                    else { toast.success('취소되었습니다.'); fetchData(); }
                                  } catch (e) { toast.error('오류 발생'); } finally { setActionLoading(null); }
                                }}
                              >
                                신청 취소
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="balances" className="m-0 mt-0 h-full flex flex-col outline-none">
            <div className={cn(
              "bg-white md:rounded-lg border shadow-sm overflow-hidden flex flex-col",
              isManager ? "flex-1" : "h-fit"
            )}>
              <div className="p-4 border-b flex items-center justify-between bg-white md:bg-transparent">
                <div className="flex flex-col w-full text-center md:text-left">
                  <h1 className="text-base md:text-2xl font-semibold md:font-bold tracking-tight">{isManager ? '직원별 잔여 연차 관리' : '나의 잔여 연차 정보'}</h1>
                  <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">산정 방식: <span className="font-semibold text-foreground">{leaveCalcType === 'hire_date' ? '입사일 기준' : '회계연도 기준'}</span> (오늘 시점 보유량)</p>
                </div>
              </div>
              <div className={cn("overflow-auto", isManager && "flex-1")}>
                {/* Desktop View Table */}
                <table className="w-full text-sm hidden md:table">
                  <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                    <tr>
                      <th className="px-4 py-3 border-b text-center">이름 (역할)</th>
                      <th className="px-4 py-3 border-b text-center">근속 기간</th>
                      <th className="px-4 py-3 border-b text-center">발생</th>
                      <th className="px-4 py-3 border-b text-center">사용</th>
                      <th className="px-4 py-3 border-b text-center">잔여</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {staffList.filter(s => isManager || s.user_id === currentUserId).map(staff => {
                      if (staff.role === 'owner') return null
                      const balance = balances.find(b => b.member_id === staff.id)
                      const hireDate = staff.hired_at || staff.join_date ? new Date(staff.hired_at || staff.join_date).toISOString().split('T')[0] : null
                      const calcTotal = hireDate ? calculateAnnualLeave(hireDate, referenceDate, leaveCalcType) : 0
                      const total = balance?.total_days ?? calcTotal
                      const used = balance?.used_days || 0
                      const remain = total - used
                      const roleInfo = getStaffRoleInfo(staff)
                      return (
                        <tr key={staff.id} className="hover:bg-muted/20">
                          <td className="px-4 py-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <div className="flex items-center gap-1.5 justify-center">
                                <span className="font-medium">{staff.name}</span>
                                {roleInfo && (
                                  <Badge variant="outline" className="text-[9px] px-1 h-4 bg-primary/5 text-primary border-primary/20">
                                    {roleInfo.name}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-medium">
                                {hireDate ? `입사일: ${hireDate}` : '입사일 미등록'}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">{getServicePeriodLabel(hireDate)}</td>
                          <td className="px-4 py-3 text-center font-semibold">{total}일</td>
                          <td className="px-4 py-3 text-center text-muted-foreground">{used}일</td>
                          <td className="px-4 py-3 text-center font-bold text-primary">{remain}일</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {/* Mobile View Card Layout */}
                <div className="md:hidden divide-y">
                  {staffList.filter(s => isManager || s.user_id === currentUserId).map(staff => {
                    if (staff.role === 'owner') return null
                    const balance = balances.find(b => b.member_id === staff.id)
                    const hireDate = staff.hired_at || staff.join_date ? new Date(staff.hired_at || staff.join_date).toISOString().split('T')[0] : null
                    const calcTotal = hireDate ? calculateAnnualLeave(hireDate, referenceDate, leaveCalcType) : 0
                    const total = balance?.total_days ?? calcTotal
                    const used = balance?.used_days || 0
                    const remain = total - used
                    const roleInfo = getStaffRoleInfo(staff)
                    
                    return (
                      <div key={staff.id} className="p-5 flex flex-col items-center">
                        {/* Name & Role (Centered) */}
                        <div className="flex flex-col items-center gap-1.5 mb-6">
                          <span className="text-base font-bold">{staff.name}</span>
                          {roleInfo && (
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-primary/5 text-primary border-primary/20">
                              {roleInfo.name}
                            </Badge>
                          )}
                          <div className="text-[11px] text-muted-foreground mt-1 font-medium bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                            {hireDate ? `입사일: ${hireDate}` : '입사일 미등록'}
                          </div>
                        </div>

                        {/* 2x2 Grid Info */}
                        <div className="grid grid-cols-2 w-full gap-px bg-slate-100 border rounded-xl overflow-hidden">
                          <div className="bg-white p-4 flex flex-col items-center gap-1">
                            <span className="text-[10px] font-semibold text-muted-foreground">근속 기간</span>
                            <span className="text-sm font-medium">{getServicePeriodLabel(hireDate)}</span>
                          </div>
                          <div className="bg-white p-4 flex flex-col items-center gap-1">
                            <span className="text-[10px] font-semibold text-muted-foreground">발생</span>
                            <span className="text-sm font-bold text-slate-700">{total}일</span>
                          </div>
                          <div className="bg-white p-4 flex flex-col items-center gap-1">
                            <span className="text-[10px] font-semibold text-muted-foreground">사용</span>
                            <span className="text-sm font-bold text-slate-500">{used}일</span>
                          </div>
                          <div className="bg-white p-4 flex flex-col items-center gap-1">
                            <span className="text-[10px] font-semibold text-primary/70">잔여</span>
                            <span className="text-base font-black text-primary">{remain}일</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>

      <Dialog open={isRequestModalOpen} onOpenChange={setIsRequestModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>휴가 및 연차 신청</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4 text-sm">
            {isManager ? (
              <div className="flex flex-col gap-1.5">
                <Label>대상 직원</Label>
                <Select value={requestDraft.memberId} onValueChange={(v) => setRequestDraft(prev => ({...prev, memberId: v}))}>
                  <SelectTrigger><SelectValue placeholder="직원 선택" /></SelectTrigger>
                  <SelectContent>{staffList.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : <div className="p-3 bg-muted/50 rounded-lg">신청자: <span className="font-bold">{myStaff?.name}</span></div>}
            <div className="flex flex-col gap-1.5">
              <Label>휴가 종류</Label>
              <Select value={requestDraft.leaveType} onValueChange={(v) => setRequestDraft(prev => ({...prev, leaveType: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">연차 (1일)</SelectItem>
                  <SelectItem value="sick">병가</SelectItem>
                  <SelectItem value="unpaid">무급휴가</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5"><Label>시작일</Label><Input type="date" value={requestDraft.startDate} onChange={(e) => setRequestDraft(prev => ({...prev, startDate: e.target.value}))} /></div>
              <div className="flex flex-col gap-1.5"><Label>종료일</Label><Input type="date" value={requestDraft.endDate} onChange={(e) => setRequestDraft(prev => ({...prev, endDate: e.target.value}))} /></div>
            </div>
            <div className="flex flex-col gap-1.5"><Label>사유</Label><Textarea placeholder="사유를 입력하세요" value={requestDraft.reason} onChange={(e) => setRequestDraft(prev => ({...prev, reason: e.target.value}))} className="h-20" /></div>
            <div className="flex flex-col gap-1.5"><Label>증빙 (선택)</Label><LeaveAttachmentUpload storeId={storeId} onUpload={(url) => setRequestDraft(prev => ({...prev, attachmentUrl: url || ''}))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRequestModalOpen(false)}>취소</Button>
            <Button disabled={submitLoading || !requestDraft.reason.trim()} onClick={async () => {
              setSubmitLoading(true);
              try {
                let days = differenceInDays(parseISO(requestDraft.endDate), parseISO(requestDraft.startDate)) + 1;
                const res = await createLeaveRequest(storeId, requestDraft.memberId, requestDraft.leaveType, requestDraft.startDate, requestDraft.endDate, days, requestDraft.reason, requestDraft.attachmentUrl);
                if (res.error) toast.error(res.error); else { toast.success('신청 완료'); setIsRequestModalOpen(false); fetchData(); }
              } catch(e) { toast.error('오류'); } finally { setSubmitLoading(false); }
            }}>신청하기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )

  return view
}