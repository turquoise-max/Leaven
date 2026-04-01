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
    <div className="flex flex-col bg-white md:rounded-xl md:border md:shadow-sm relative h-full w-full max-w-full overflow-hidden">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full min-h-0 w-full max-w-full">
        <div className="px-4 md:px-6 border-b bg-slate-50/50 flex justify-between items-center h-14 shrink-0 z-10">
          <TabsList className="bg-transparent h-full p-0 gap-4 md:gap-8 justify-start w-full md:w-auto overflow-x-auto overflow-y-hidden no-scrollbar">
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
              className="relative rounded-none px-1 pb-3 pt-2 text-sm md:text-base font-semibold text-muted-foreground hover:text-foreground data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none outline-none focus-visible:outline-none !shadow-none bg-transparent group flex items-center whitespace-nowrap"
            >
              <FileText className="w-4 h-4 mr-1.5 md:mr-2" />
              휴가 신청함
              {pendingCount > 0 && (
                <Badge variant="destructive" className="ml-1.5 w-4 h-4 md:w-5 md:h-5 flex items-center justify-center p-0 text-[10px] rounded-full">
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
        </div>

        <div className={cn("bg-slate-50/30 p-4 md:p-6 flex-1 min-h-0 overflow-y-auto no-scrollbar relative flex flex-col", activeTab === 'requests' ? 'pb-8 md:pb-6' : 'pb-4 md:pb-6')}>
          <TabsContent value="calendar" className="m-0 mt-0 flex flex-col gap-2 md:gap-6 outline-none h-full flex-1">
            <div className="bg-transparent md:bg-white md:rounded-lg md:border md:shadow-sm flex flex-col h-full">
              <div className="p-0 md:p-3 relative leave-calendar-container h-full">
                <style>{`
                  .leave-calendar-container .fc { height: 100%; font-size: 12px; }
                  .leave-calendar-container .fc-theme-standard th { border-color: rgba(0,0,0,0.05); padding: 4px 0; background: #f8fafc; font-weight: 600; color: #475569; font-size: 11px; }
                  .leave-calendar-container .fc-theme-standard td { border-color: rgba(0,0,0,0.05); }
                  .leave-calendar-container .fc-daygrid-day-top { display: flex; justify-content: center; width: 100%; padding-top: 2px; }
                  .leave-calendar-container .fc-daygrid-day-number { padding: 2px; color: #334155; font-weight: 500; text-align: center; font-size: 11px; }
                  .leave-calendar-container .fc-event { border: none; border-radius: 3px; padding: 1px 3px; margin: 1px 2px; font-size: 9.5px; font-weight: 600; line-height: 1.2; }
                  .leave-calendar-container .fc-daygrid-day-events { margin-bottom: 2px !important; }
                  .leave-calendar-container .fc .fc-today-button:disabled { opacity: 1 !important; pointer-events: auto !important; cursor: pointer !important; }
                  
                  /* Weekend Colors */
                  .leave-calendar-container .fc-day-sun .fc-daygrid-day-number,
                  .leave-calendar-container .fc-theme-standard th.fc-day-sun .fc-col-header-cell-cushion { color: #ef4444 !important; }
                  .leave-calendar-container .fc-day-sat .fc-daygrid-day-number,
                  .leave-calendar-container .fc-theme-standard th.fc-day-sat .fc-col-header-cell-cushion { color: #3b82f6 !important; }

                  /* Mobile specific header layout */
                  @media (max-width: 768px) {
                    .leave-calendar-container .fc-header-toolbar { 
                      display: flex !important; 
                      margin-bottom: 0.5rem !important; 
                      margin-top: 0 !important; 
                    }
                    /* 첫 번째 청크(prev, next, title 포함)가 전체 너비를 차지하고 요소들을 양끝/중앙 배치하도록 수정 */
                    .leave-calendar-container .fc-toolbar-chunk:nth-child(1) { 
                      display: flex !important; 
                      width: 100% !important; 
                      justify-content: space-between !important; 
                      align-items: center !important; 
                    }
                    .leave-calendar-container .fc-toolbar-chunk:nth-child(1) > .fc-button-group {
                      display: contents !important; /* 내부의 prev, next가 독립된 flex 아이템처럼 동작하도록 */
                    }
                    .leave-calendar-container .fc-prev-button { 
                      order: 1 !important; 
                      margin: 0 !important;
                      flex: 0 0 auto !important;
                      width: 28px !important;
                      min-width: 28px !important;
                      max-width: 28px !important;
                    }
                    .leave-calendar-container .fc-toolbar-title { 
                      order: 2 !important; 
                      text-align: center !important; 
                      font-size: 14px !important; 
                      font-weight: 600 !important; 
                      color: #1a1a1a !important; 
                      margin: 0 !important;
                      flex: 1 1 auto !important;
                    }
                    .leave-calendar-container .fc-next-button { 
                      order: 3 !important; 
                      margin: 0 !important;
                      flex: 0 0 auto !important;
                      width: 28px !important;
                      min-width: 28px !important;
                      max-width: 28px !important;
                    }
                    
                    .leave-calendar-container .fc-toolbar-chunk:nth-child(2),
                    .leave-calendar-container .fc-toolbar-chunk:nth-child(3) { display: none !important; }

                    /* 캘린더 날짜칸 높이 줄이기 (모바일) - 초소형 컴팩트 */
                    .leave-calendar-container .fc-daygrid-day-frame {
                      min-height: 40px !important; 
                    }
                    .leave-calendar-container .fc-scroller-liquid-absolute {
                      position: relative !important;
                      height: auto !important;
                      overflow: hidden !important;
                    }
                    .leave-calendar-container .fc-view-harness {
                      height: auto !important;
                    }
                  }

                  /* Button Customization for Schedule Calendar Match */
                  .leave-calendar-container .fc-button-primary {
                    background-color: #fff !important;
                    border: 1px solid rgba(0,0,0,0.15) !important;
                    color: #6b6b6b !important;
                    box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05) !important;
                    padding: 0;
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 6px !important;
                    transition: all 0.2s;
                  }
                  .leave-calendar-container .fc-button-primary:hover {
                    background-color: rgba(0,0,0,0.05) !important;
                    color: #1a1a1a !important;
                  }
                  .leave-calendar-container .fc-button-primary .fc-icon {
                    font-size: 1.2em;
                  }
                  .leave-calendar-container .fc-today-button {
                    width: auto !important;
                    padding: 0 12px !important;
                    font-size: 12px !important;
                    font-weight: 500 !important;
                  }

                  /* Desktop header: align title and prev/next close together */
                  @media (min-width: 769px) {
                    .leave-calendar-container .fc-header-toolbar { display: flex; justify-content: flex-start; gap: 0.75rem; align-items: center; }
                    .leave-calendar-container .fc-toolbar-chunk { display: flex; align-items: center; gap: 0.25rem; }
                    .leave-calendar-container .fc-toolbar-chunk:nth-child(2) { margin-right: auto; } /* Title */
                    .leave-calendar-container .fc-toolbar-title { font-size: 14px !important; font-weight: 600 !important; color: #1a1a1a !important; margin: 0; min-width: auto; text-align: left; }
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
                    left: 'prev,next title', 
                    center: '', 
                    right: 'today' 
                  }}
                  buttonText={{
                    today: '오늘'
                  }}
                  fixedWeekCount={false}
                  dayCellContent={(arg) => arg.date.getDate()}
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

          <TabsContent value="requests" className="m-0 mt-0 flex flex-col outline-none h-full min-h-0 flex-1">
            <div className="bg-white md:rounded-lg border shadow-sm flex flex-col h-full overflow-hidden min-h-[calc(100dvh-18rem)] md:min-h-0">
              <div className="p-4 border-b flex items-center justify-between bg-white md:bg-transparent shrink-0">
                <h1 className="text-base md:text-2xl font-semibold md:font-bold tracking-tight w-full text-center md:text-left">{isManager ? '휴가 및 연차 신청함' : '나의 휴가 신청 내역'}</h1>
              </div>
              <div className="bg-slate-50/50 p-4 md:p-6 overflow-y-auto no-scrollbar flex-1">
                {(isManager ? requests : myRequests).length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-muted-foreground min-h-[200px] h-full bg-white rounded-xl border border-dashed border-border/50">
                    <FileText className="w-12 h-12 mb-4 opacity-20" />
                    <p>등록된 휴가 신청이 없습니다.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 max-w-4xl mx-auto pb-6">
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
                      const memberStaff = staffList.find(s => s.id === req.member_id || s.id === req.member?.id) || req.member
                      const roleInfo = getStaffRoleInfo(memberStaff)
                      return (
                        <div key={req.id} className={cn("bg-white border shadow-sm rounded-xl p-4 md:p-5 flex flex-col gap-3 md:gap-4 transition-colors", req.status !== 'pending' && "opacity-80 bg-slate-50/50")}>
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-0">
                            <div className="flex items-center gap-2.5 md:gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-sm md:text-base truncate">{req.member?.name || req.member?.profile?.full_name}</span>
                                  <Badge variant="outline" className="text-[9px] md:text-[10px] px-1 h-4 md:h-5 shrink-0 font-normal" style={{ color: roleInfo?.color, borderColor: roleInfo?.color }}>{roleInfo?.name || '직원'}</Badge>
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

          <TabsContent value="balances" className="m-0 mt-0 flex flex-col outline-none h-full min-h-0 flex-1">
            <div className={cn(
              "bg-white md:rounded-lg border shadow-sm flex flex-col overflow-hidden h-full flex-1"
            )}>
              <div className="p-4 border-b flex items-center justify-between bg-white md:bg-transparent shrink-0">
                <div className="flex flex-col w-full text-center md:text-left">
                  <h1 className="text-base md:text-2xl font-semibold md:font-bold tracking-tight">{isManager ? '직원별 잔여 연차 관리' : '나의 잔여 연차 정보'}</h1>
                  <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">산정 방식: <span className="font-semibold text-foreground">{leaveCalcType === 'hire_date' ? '입사일 기준' : '회계연도 기준'}</span></p>
                </div>
              </div>
              <div className="overflow-y-auto no-scrollbar flex-1 bg-white">
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
                                  <Badge variant="outline" className="text-[9px] px-1 h-4 font-normal" style={{ color: roleInfo?.color, borderColor: roleInfo?.color }}>
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
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-normal" style={{ color: roleInfo?.color, borderColor: roleInfo?.color }}>
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

      {/* Floating Action Button (FAB) for Mobile/Desktop */}
      {activeTab === 'requests' && (
        <Button 
          className="fixed bottom-24 right-6 h-14 w-14 rounded-full shadow-lg z-50 md:bottom-10 md:right-10 md:h-16 md:w-16 transition-transform hover:scale-110 active:scale-95" 
          onClick={() => setIsRequestModalOpen(true)}
        >
          <Plus className="w-6 h-6 md:w-8 md:h-8" />
          <span className="sr-only">휴가 신청</span>
        </Button>
      )}

      <Dialog open={isRequestModalOpen} onOpenChange={setIsRequestModalOpen}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-none sm:border sm:rounded-2xl shadow-2xl">
          {/* Mobile Handle Bar */}
          <div className="h-1 w-10 bg-slate-200 rounded-full mx-auto mt-2.5 mb-0.5 sm:hidden" />
          
          <DialogHeader className="px-5 pt-3 pb-2 text-center sm:text-left border-b border-slate-50">
            <DialogTitle className="text-base sm:text-lg font-bold tracking-tight">휴가 신청</DialogTitle>
          </DialogHeader>

          <div className="px-5 py-3 flex flex-col gap-3 text-sm max-h-[70vh] overflow-y-auto no-scrollbar">
            {isManager ? (
              <div className="flex flex-col gap-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-0.5">대상 직원</Label>
                <Select value={requestDraft.memberId} onValueChange={(v) => setRequestDraft(prev => ({...prev, memberId: v}))}>
                  <SelectTrigger className="h-9 bg-slate-50/50 border-slate-100 text-xs"><SelectValue placeholder="직원 선택" /></SelectTrigger>
                  <SelectContent className="rounded-xl shadow-xl border-slate-100">{staffList.map(s => <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-0.5">신청자</Label>
                <div className="flex h-9 w-full items-center justify-between rounded-md border border-slate-100 bg-slate-50/50 px-3 py-2 text-xs opacity-70 cursor-not-allowed">
                  <span className="text-foreground">{myStaff?.name}</span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-0.5">휴가 종류</Label>
              <Select value={requestDraft.leaveType} onValueChange={(v) => setRequestDraft(prev => ({...prev, leaveType: v}))}>
                <SelectTrigger className="h-9 bg-slate-50/50 border-slate-100 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl shadow-xl border-slate-100">
                  <SelectItem value="annual" className="text-xs">연차 (1일)</SelectItem>
                  <SelectItem value="sick" className="text-xs">병가</SelectItem>
                  <SelectItem value="unpaid" className="text-xs">무급휴가</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-0.5">시작일</Label>
                <Input type="date" value={requestDraft.startDate} onChange={(e) => {
                  const newStartDate = e.target.value;
                  setRequestDraft(prev => {
                    const newEndDate = newStartDate > prev.endDate ? newStartDate : prev.endDate;
                    return { ...prev, startDate: newStartDate, endDate: newEndDate };
                  });
                }} className="h-9 bg-slate-50/50 border-slate-100 text-xs" />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-0.5">종료일</Label>
                <Input type="date" value={requestDraft.endDate} onChange={(e) => {
                  const newEndDate = e.target.value;
                  setRequestDraft(prev => {
                    const newStartDate = newEndDate < prev.startDate ? newEndDate : prev.startDate;
                    return { ...prev, endDate: newEndDate, startDate: newStartDate };
                  });
                }} className="h-9 bg-slate-50/50 border-slate-100 text-xs" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-0.5">사유 및 증빙</Label>
              <Textarea placeholder="사유를 입력하세요" value={requestDraft.reason} onChange={(e) => setRequestDraft(prev => ({...prev, reason: e.target.value}))} className="min-h-[60px] bg-slate-50/50 border-slate-100 focus:bg-white transition-colors resize-none rounded-lg py-[22px] px-2.5 text-xs text-center leading-[16px]" />
              <div className="mt-1 bg-slate-50/50 rounded-lg border border-dashed border-slate-200 p-0.5">
                <LeaveAttachmentUpload storeId={storeId} onUpload={(url) => setRequestDraft(prev => ({...prev, attachmentUrl: url || ''}))} />
              </div>
            </div>
          </div>

          <div className="px-5 pb-5 pt-1 flex gap-2">
            <Button variant="ghost" className="flex-1 h-12 rounded-xl text-slate-500 hover:bg-slate-100" onClick={() => setIsRequestModalOpen(false)}>취소</Button>
            <Button disabled={submitLoading || !requestDraft.reason.trim()} className="flex-[2] h-12 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98]" onClick={async () => {
              setSubmitLoading(true);
              try {
                let days = differenceInDays(parseISO(requestDraft.endDate), parseISO(requestDraft.startDate)) + 1;
                const res = await createLeaveRequest(storeId, requestDraft.memberId, requestDraft.leaveType, requestDraft.startDate, requestDraft.endDate, days, requestDraft.reason, requestDraft.attachmentUrl);
                if (res.error) toast.error(res.error); else { toast.success('신청이 완료되었습니다.'); setIsRequestModalOpen(false); fetchData(); }
              } catch(e) { toast.error('오류가 발생했습니다.'); } finally { setSubmitLoading(false); }
            }}>신청하기</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )

  return view
}