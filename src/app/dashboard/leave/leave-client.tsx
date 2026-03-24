'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Umbrella, Calendar, FileText, Settings, Search, Download, Plus, Check, X } from 'lucide-react'
import { getLeaveBalances, getLeaveRequests, resolveLeaveRequest, createLeaveRequest, updateLeaveBalance, cancelLeaveRequest } from '@/features/leave/actions'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'

interface LeaveClientPageProps {
  storeId: string
  roles: any[]
  staffList: any[]
  isManager: boolean
  currentUserId: string
}

export function LeaveClientPage({
  storeId,
  roles,
  staffList,
  isManager,
  currentUserId
}: LeaveClientPageProps) {
  const [activeTab, setActiveTab] = useState('calendar')
  const [balances, setBalances] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false)
  const [requestDraft, setRequestDraft] = useState({ 
    memberId: currentUserId, // Not ideal for manager choosing others, but good for now
    leaveType: 'annual', 
    startDate: format(new Date(), 'yyyy-MM-dd'), 
    endDate: format(new Date(), 'yyyy-MM-dd'), 
    requestedDays: 1, 
    reason: '' 
  })
  const [submitLoading, setSubmitLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const year = new Date().getFullYear()
      const [balRes, reqRes] = await Promise.all([
        getLeaveBalances(storeId, year),
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
  }, [storeId])

  const pendingCount = requests.filter(r => r.status === 'pending').length

  const getStaffRoleInfo = (staff: any) => {
    if (staff?.role_info) return staff.role_info
    if (staff?.role) {
      const legacyRoleName = staff.role === 'owner' ? '점주' : staff.role === 'manager' ? '매니저' : '직원'
      const foundRole = roles?.find(r => r.name === legacyRoleName)
      if (foundRole) return foundRole
    }
    return null
  }

  const myStaff = staffList.find(s => s.user_id === currentUserId)

  const myRequests = requests.filter(r => r.member?.user_id === currentUserId)
  const myBalance = balances.find(b => b.member_id === myStaff?.id)
  const total = myBalance?.total_days || 0
  const used = myBalance?.used_days || 0
  const remain = total - used

  const staffView = (
    <div className={cn("flex flex-col h-full bg-white rounded-xl border shadow-sm overflow-hidden", isManager ? "lg:hidden" : "")}>
      <div className="p-6 border-b bg-slate-50 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">나의 휴가/연차 현황</h2>
          <p className="text-sm text-muted-foreground mt-1">올해 남은 연차와 신청 내역을 확인하세요.</p>
        </div>
        <Button className="gap-2 shadow-sm" onClick={() => setIsRequestModalOpen(true)}>
          <Plus className="w-4 h-4" /> 휴가 신청
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-0 border-b shrink-0">
        <div className="p-6 flex flex-col items-center justify-center border-r">
          <span className="text-sm font-medium text-muted-foreground mb-1">총 발생 연차</span>
          <span className="text-3xl font-bold">{total}<span className="text-lg font-medium text-muted-foreground ml-1">일</span></span>
        </div>
        <div className="p-6 flex flex-col items-center justify-center border-r">
          <span className="text-sm font-medium text-muted-foreground mb-1">사용 완료</span>
          <span className="text-3xl font-bold">{used}<span className="text-lg font-medium text-muted-foreground ml-1">일</span></span>
        </div>
        <div className="p-6 flex flex-col items-center justify-center">
          <span className="text-sm font-medium text-primary mb-1">잔여 연차</span>
          <span className="text-3xl font-bold text-primary">{remain}<span className="text-lg font-medium opacity-70 ml-1">일</span></span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 bg-slate-50/30">
        <h3 className="font-semibold text-base mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" /> 나의 신청 내역
        </h3>
        
        {myRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-muted-foreground py-16 bg-white rounded-xl border border-dashed border-border/50">
            <FileText className="w-12 h-12 mb-4 opacity-20" />
            <p>휴가 신청 내역이 없습니다.</p>
          </div>
        ) : (
          <div className="grid gap-4 max-w-4xl mx-auto">
            {myRequests.map(req => {
              const leaveTypeLabel = req.leave_type === 'annual' ? '연차' : req.leave_type === 'sick' ? '병가' : req.leave_type === 'unpaid' ? '무급휴가' : '반차'

              return (
                <div key={req.id} className={cn("bg-white border shadow-sm rounded-xl p-5 flex flex-col gap-4 transition-colors", req.status !== 'pending' && "opacity-80 bg-slate-50/50")}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">{leaveTypeLabel}</Badge>
                        <span className="font-bold text-base">{req.start_date} ~ {req.end_date}</span>
                        <span className="text-sm font-medium text-muted-foreground">({req.requested_days}일)</span>
                      </div>
                    </div>
                    <div>
                      {req.status === 'pending' ? (
                        <Badge variant="secondary" className="bg-orange-100 text-orange-700">심사 대기 중</Badge>
                      ) : req.status === 'approved' ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">승인됨</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-red-100 text-red-700 border-red-200">반려됨</Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">사유</span>
                    <div className="text-sm bg-muted/30 p-3 rounded-md border border-dashed border-black/10 whitespace-pre-wrap">
                      {req.reason}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )

  const managerView = isManager ? (
    <div className="hidden lg:flex flex-col h-full bg-white rounded-xl border shadow-sm overflow-hidden">
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="px-6 pt-4 border-b bg-slate-50/50 flex justify-between items-end">
          <TabsList className="bg-transparent h-10 p-0 gap-8 justify-start">
            <TabsTrigger 
              value="calendar" 
              className="relative rounded-none px-1 pb-3 pt-2 text-base font-semibold text-muted-foreground hover:text-foreground data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none outline-none focus-visible:outline-none !shadow-none bg-transparent group"
            >
              <Calendar className="w-4 h-4 mr-2" />
              휴가 현황 (캘린더)
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary scale-x-0 origin-left transition-transform duration-200 group-data-[state=active]:scale-x-100" />
            </TabsTrigger>
            <TabsTrigger 
              value="requests" 
              className="relative rounded-none px-1 pb-3 pt-2 text-base font-semibold text-muted-foreground hover:text-foreground data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none outline-none focus-visible:outline-none !shadow-none bg-transparent group"
            >
              <FileText className="w-4 h-4 mr-2" />
              휴가 신청함
              {pendingCount > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-4 w-5 h-5 flex items-center justify-center p-0 text-[10px]">
                  {pendingCount}
                </Badge>
              )}
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary scale-x-0 origin-left transition-transform duration-200 group-data-[state=active]:scale-x-100" />
            </TabsTrigger>
            <TabsTrigger 
              value="balances" 
              className="relative rounded-none px-1 pb-3 pt-2 text-base font-semibold text-muted-foreground hover:text-foreground data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none outline-none focus-visible:outline-none !shadow-none bg-transparent group"
            >
              <Settings className="w-4 h-4 mr-2" />
              잔여 연차 관리
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary scale-x-0 origin-left transition-transform duration-200 group-data-[state=active]:scale-x-100" />
            </TabsTrigger>
          </TabsList>
          
          <Button className="gap-2 shadow-sm mb-2" onClick={() => setIsRequestModalOpen(true)}>
            <Plus className="w-4 h-4" /> 휴가 신청
          </Button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-auto bg-slate-50/30 p-6">
          
          {/* Calendar View Placeholder */}
          <TabsContent value="calendar" className="m-0 mt-0 h-full flex flex-col gap-6 outline-none">
            <div className="bg-white rounded-lg border shadow-sm overflow-hidden flex-1 flex flex-col">
              <div className="p-4 border-b flex items-center justify-between shrink-0 bg-slate-50/50">
                <h3 className="font-semibold text-base">직원 휴가 캘린더</h3>
                <div className="flex gap-2 text-[11px] font-medium">
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
              <div className="flex-1 p-4 overflow-hidden relative leave-calendar-container">
                <style>{`
                  .leave-calendar-container .fc {
                    height: 100%;
                    font-size: 13px;
                  }
                  .leave-calendar-container .fc-theme-standard th {
                    border-color: rgba(0,0,0,0.05);
                    padding: 8px 0;
                    background: #f8fafc;
                    font-weight: 600;
                    color: #475569;
                  }
                  .leave-calendar-container .fc-theme-standard td {
                    border-color: rgba(0,0,0,0.05);
                  }
                  .leave-calendar-container .fc-daygrid-day-number {
                    padding: 4px 8px;
                    color: #334155;
                    font-weight: 500;
                  }
                  .leave-calendar-container .fc-event {
                    border: none;
                    border-radius: 4px;
                    padding: 2px 4px;
                    margin: 1px 4px;
                    font-size: 11px;
                    font-weight: 600;
                  }
                `}</style>
                <FullCalendar
                  plugins={[dayGridPlugin, interactionPlugin]}
                  initialView="dayGridMonth"
                  locale={ko}
                  headerToolbar={{
                    left: 'prev,next today',
                    center: 'title',
                    right: ''
                  }}
                  events={requests.filter(r => r.status === 'approved').map(r => {
                    let color = '#94a3b8' // slate
                    let textColor = '#fff'
                    if (r.leave_type === 'annual') { color = '#3b82f6'; } // blue
                    if (r.leave_type === 'sick') { color = '#ef4444'; } // red
                    if (r.leave_type === 'half_am' || r.leave_type === 'half_pm') { color = '#60a5fa'; } // light blue

                    const name = r.member?.name || r.member?.profile?.full_name || '직원'
                    const label = r.leave_type === 'annual' ? '연차' : r.leave_type === 'sick' ? '병가' : r.leave_type === 'unpaid' ? '무급' : '반차'

                    // FullCalendar end date is exclusive, so we add 1 day to end_date
                    const endDateObj = new Date(r.end_date)
                    endDateObj.setDate(endDateObj.getDate() + 1)
                    const endStr = endDateObj.toISOString().substring(0, 10)

                    return {
                      id: r.id,
                      title: `${name} (${label})`,
                      start: r.start_date,
                      end: endStr,
                      backgroundColor: color,
                      textColor: textColor,
                      allDay: true
                    }
                  })}
                  height="100%"
                />
              </div>
            </div>
          </TabsContent>

          {/* Requests View */}
          <TabsContent value="requests" className="m-0 mt-0 h-full flex flex-col outline-none">
            <div className="bg-white rounded-lg border shadow-sm overflow-hidden flex-1 flex flex-col">
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-semibold text-base">휴가 및 연차 신청함</h3>
              </div>
              <div className="flex-1 overflow-auto bg-slate-50/50 p-6">
                {requests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-muted-foreground h-full bg-white rounded-xl border border-dashed border-border/50">
                    <FileText className="w-12 h-12 mb-4 opacity-20" />
                    <p>등록된 휴가 신청이 없습니다.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 max-w-4xl mx-auto">
                    {requests.map(req => {
                      const handleResolve = async (status: 'approved' | 'rejected') => {
                        if (!isManager) return toast.error('매니저 권한이 필요합니다.')
                        
                        const confirmMsg = status === 'approved' ? '이 휴가를 승인하시겠습니까?' : '이 휴가를 반려하시겠습니까?'
                        if (!window.confirm(confirmMsg)) return
                        
                        setActionLoading(req.id)
                        try {
                          const res = await resolveLeaveRequest(req.id, storeId, status)
                          if (res.error) toast.error(res.error)
                          else {
                            toast.success(status === 'approved' ? '승인되었습니다.' : '반려되었습니다.')
                            setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status } : r))
                          }
                        } catch (e) {
                          toast.error('오류가 발생했습니다.')
                        } finally {
                          setActionLoading(null)
                        }
                      }

                      const leaveTypeLabel = req.leave_type === 'annual' ? '연차' : req.leave_type === 'sick' ? '병가' : req.leave_type === 'unpaid' ? '무급휴가' : '반차'

                      return (
                        <div key={req.id} className={cn("bg-white border shadow-sm rounded-xl p-5 flex flex-col gap-4 transition-colors", req.status !== 'pending' && "opacity-80 bg-slate-50/50")}>
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10 border">
                                <AvatarFallback>{req.member?.name?.substring(0,2)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-base">{req.member?.name || req.member?.profile?.full_name}</span>
                                  <Badge variant="outline" className="text-[10px]">{req.member?.role_info?.name || '직원'}</Badge>
                                </div>
                                <div className="text-sm text-muted-foreground mt-0.5 font-medium">
                                  {req.start_date} ~ {req.end_date} <span className="font-bold text-foreground">({req.requested_days}일)</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">{leaveTypeLabel}</Badge>
                              {req.status === 'pending' ? (
                                <Badge variant="secondary" className="bg-orange-100 text-orange-700">대기 중</Badge>
                              ) : req.status === 'approved' ? (
                                <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">승인 완료</Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-red-100 text-red-700 border-red-200">반려됨</Badge>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            <span className="text-xs font-semibold text-muted-foreground">사유</span>
                            <div className="text-sm bg-muted/30 p-3 rounded-md border border-dashed border-black/10 whitespace-pre-wrap">
                              {req.reason}
                            </div>
                          </div>

                          {req.status === 'pending' && isManager && (
                            <div className="flex gap-2 justify-end mt-2">
                              <Button variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20" disabled={actionLoading === req.id} onClick={() => handleResolve('rejected')}>
                                <X className="w-4 h-4 mr-1.5" /> 반려
                              </Button>
                              <Button className="bg-[#1D9E75] hover:bg-[#1D9E75]/90" disabled={actionLoading === req.id} onClick={() => handleResolve('approved')}>
                                <Check className="w-4 h-4 mr-1.5" /> 승인
                              </Button>
                            </div>
                          )}

                          {req.status === 'approved' && isManager && (
                            <div className="flex justify-end mt-2 pt-2 border-t border-black/5">
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="text-muted-foreground hover:bg-black/5 h-8 text-[12px]" 
                                disabled={actionLoading === req.id} 
                                onClick={async () => {
                                  if (!window.confirm('이 휴가 승인을 취소하시겠습니까? (차감된 연차가 복구됩니다)')) return
                                  
                                  setActionLoading(req.id)
                                  try {
                                    const res = await cancelLeaveRequest(req.id, storeId)
                                    if (res.error) toast.error(res.error)
                                    else {
                                      toast.success('휴가 승인이 취소되었습니다.')
                                      fetchData()
                                    }
                                  } catch (e) {
                                    toast.error('오류가 발생했습니다.')
                                  } finally {
                                    setActionLoading(null)
                                  }
                                }}
                              >
                                승인 취소 (원복)
                              </Button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Balances View */}
          <TabsContent value="balances" className="m-0 mt-0 h-full flex flex-col outline-none">
            <div className="bg-white rounded-lg border shadow-sm overflow-hidden flex-1 flex flex-col">
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-semibold text-base">직원별 잔여 연차 관리 ({new Date().getFullYear()}년)</h3>
              </div>
              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 font-semibold border-b">이름 (역할)</th>
                      <th className="px-4 py-3 font-semibold border-b text-center">총 발생 연차</th>
                      <th className="px-4 py-3 font-semibold border-b text-center">사용 연차</th>
                      <th className="px-4 py-3 font-semibold border-b text-center">잔여 연차</th>
                      <th className="px-4 py-3 font-semibold border-b text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {staffList.map(staff => {
                      const roleInfo = getStaffRoleInfo(staff)
                      const balance = balances.find(b => b.member_id === staff.id)
                      const total = balance?.total_days || 0
                      const used = balance?.used_days || 0
                      const remain = total - used

                      return (
                        <tr key={staff.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{staff.name || staff.profile?.full_name}</span>
                              <Badge variant="outline" className="text-[10px]">{roleInfo?.name || '직원'}</Badge>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center font-semibold">{total}일</td>
                          <td className="px-4 py-3 text-center text-muted-foreground">{used}일</td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant="secondary" className={cn(remain < 0 ? "bg-red-100 text-red-700" : "bg-primary/10 text-primary")}>
                              {remain}일
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isManager && (
                              <Button variant="ghost" size="sm" className="h-7 text-[11px] text-muted-foreground" onClick={async () => {
                                const newTotal = prompt(`${staff.name || staff.profile?.full_name}님의 올해 총 발생 연차 일수를 입력하세요:`, String(total))
                                if (newTotal !== null && !isNaN(Number(newTotal))) {
                                  const year = new Date().getFullYear()
                                  const res = await updateLeaveBalance(storeId, staff.id, year, Number(newTotal))
                                  if (res.error) toast.error(res.error)
                                  else {
                                    toast.success('잔여 연차가 수정되었습니다.')
                                    fetchData()
                                  }
                                }
                              }}>
                                수정
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

        </div>
      </Tabs>

      {/* Leave Request Modal */}
      <Dialog open={isRequestModalOpen} onOpenChange={setIsRequestModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>휴가 및 연차 신청</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            {!isManager && (
              <div className="flex items-center gap-2 mb-2 p-3 bg-muted/50 rounded-lg text-sm">
                <span>신청자:</span>
                <span className="font-bold">{staffList.find(s => s.user_id === currentUserId)?.name || '직원'}</span>
              </div>
            )}
            
            {isManager && (
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">대상 직원 (관리자 대리 신청)</Label>
                <Select value={requestDraft.memberId} onValueChange={(v) => setRequestDraft(prev => ({...prev, memberId: v}))}>
                  <SelectTrigger><SelectValue placeholder="직원 선택" /></SelectTrigger>
                  <SelectContent>
                    {staffList.map(s => <SelectItem key={s.id} value={s.id}>{s.name || s.profile?.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">휴가 종류</Label>
              <Select value={requestDraft.leaveType} onValueChange={(v) => setRequestDraft(prev => ({...prev, leaveType: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">연차 (1일)</SelectItem>
                  <SelectItem value="half_am">오전 반차 (0.5일)</SelectItem>
                  <SelectItem value="half_pm">오후 반차 (0.5일)</SelectItem>
                  <SelectItem value="sick">병가</SelectItem>
                  <SelectItem value="unpaid">무급휴가 (대타 필요)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">시작일</Label>
                <Input type="date" value={requestDraft.startDate} onChange={(e) => setRequestDraft(prev => ({...prev, startDate: e.target.value}))} />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">종료일</Label>
                <Input type="date" value={requestDraft.endDate} onChange={(e) => setRequestDraft(prev => ({...prev, endDate: e.target.value}))} />
              </div>
            </div>
            
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">사유 작성</Label>
              <Textarea 
                placeholder="휴가 사유를 작성해주세요."
                value={requestDraft.reason}
                onChange={(e) => setRequestDraft(prev => ({...prev, reason: e.target.value}))}
                className="h-24 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRequestModalOpen(false)}>취소</Button>
            <Button 
              className="bg-primary hover:bg-primary/90"
              disabled={submitLoading || !requestDraft.reason.trim() || !requestDraft.memberId}
              onClick={async () => {
                setSubmitLoading(true)
                try {
                  const days = requestDraft.leaveType.includes('half') ? 0.5 : 1 // Simplified calc
                  const res = await createLeaveRequest(storeId, requestDraft.memberId, requestDraft.leaveType, requestDraft.startDate, requestDraft.endDate, days, requestDraft.reason)
                  if (res.error) toast.error(res.error)
                  else {
                    toast.success('신청 완료되었습니다.')
                    setIsRequestModalOpen(false)
                    fetchData()
                  }
                } catch(e) {
                  toast.error('오류 발생')
                } finally {
                  setSubmitLoading(false)
                }
              }}
            >
              {submitLoading ? '처리 중...' : '신청하기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  ) : null

  return (
    <>
      {staffView}
      {managerView}
    </>
  )
}
