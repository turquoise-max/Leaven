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
import { Activity, Clock, FileClock, CheckSquare, Search, Download, PlayCircle, StopCircle, PenBox, Check, X } from 'lucide-react'
import { getDailyAttendanceOverview, clockIn, clockOut, startBreak, endBreak, getAttendanceRequests, resolveAttendanceRequest, createAttendanceRequest, AttendanceRecord } from '@/features/attendance/actions'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getDiffInMinutes, toKSTISOString, toUTCISOString } from '@/shared/lib/date-utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TimePicker } from '@/components/ui/time-picker'
import { Textarea } from '@/components/ui/textarea'

interface AttendanceClientPageProps {
  storeId: string
  roles: any[]
  staffList: any[]
  isManager: boolean
  currentUserId: string
  initialDate: string
}

export function AttendanceClientPage({
  storeId,
  roles,
  staffList,
  isManager,
  currentUserId,
  initialDate
}: AttendanceClientPageProps) {
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [activeTab, setActiveTab] = useState('live')
  const [attendanceData, setAttendanceData] = useState<any[]>([])
  const [schedulesData, setSchedulesData] = useState<any[]>([])
  const [requestsData, setRequestsData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Request Modal State
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false)
  const [requestDraft, setRequestDraft] = useState({ memberId: '', attendanceId: '', inTime: '', outTime: '', reason: '' })
  const [submitLoading, setSubmitLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await getDailyAttendanceOverview(storeId, selectedDate, Date.now())
      setAttendanceData(res.attendance || [])
      setSchedulesData(res.schedules || [])
      
      if (isManager) {
        const reqs = await getAttendanceRequests(storeId, Date.now())
        setRequestsData(reqs || [])
      }
    } catch (error) {
      console.error(error)
      toast.error('출퇴근 데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [storeId, selectedDate])

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
  const myAttendance = attendanceData.find(a => a.member_id === myStaff?.id)
  const myStatus = myAttendance?.status || 'none'
  
  const mySchedule = schedulesData.find(sch => 
    sch.schedule_members?.some((sm: any) => sm.member_id === myStaff?.id) &&
    toKSTISOString(sch.start_time).startsWith(selectedDate)
  )

  const formatTime = (isoString?: string | null) => {
    if (!isoString) return '-'
    return format(new Date(isoString), 'HH:mm')
  }

  const handleMyAction = async (action: 'in' | 'out') => {
    if (!myStaff) return
    setActionLoading(myStaff.id)
    
    try {
      // Get current location
      let locationData: { lat: number, lng: number } | undefined = undefined;
      
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
          });
        });
        locationData = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
      } catch (geoErr: any) {
        console.warn('Geolocation failed:', geoErr);
        if (geoErr.code === 1) { // PERMISSION_DENIED
          toast.error('위치 정보 접근 권한이 필요합니다. 브라우저 설정에서 위치 권한을 허용해주세요.');
          setActionLoading(null);
          return;
        }
        // For other errors, we still try to proceed but the server will check if location is mandatory
      }

      let res: any = { error: 'Unknown action' }
      if (action === 'in') {
        res = await clockIn(storeId, myStaff.id, selectedDate, undefined, locationData)
      } else if (action === 'out') {
        res = await clockOut(myAttendance.id, storeId, locationData)
      }
      
      if (res?.error) {
        toast.error(res.error)
      } else {
        toast.success('성공적으로 처리되었습니다.')
        fetchData()
      }
    } catch (err) {
      toast.error('오류가 발생했습니다.')
    } finally {
      setActionLoading(null)
    }
  }

  const staffView = (
    <div className={cn("flex flex-col h-full bg-white rounded-xl border shadow-sm p-6 overflow-auto", isManager ? "lg:hidden" : "")}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold">{format(new Date(selectedDate), 'M월 d일 (EEEE)', { locale: ko })}</h2>
          <p className="text-muted-foreground mt-1">오늘의 출퇴근을 기록해주세요.</p>
        </div>
        <Input 
          type="date" 
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-[140px]"
        />
      </div>

      <div className="flex flex-col items-center justify-center gap-8 py-10 bg-slate-50/50 rounded-2xl border border-dashed border-border/60 mb-8">
        <div className="flex flex-col items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">현재 상태</span>
          {myStatus === 'none' && <Badge variant="secondary" className="text-base px-4 py-1.5 bg-slate-100 text-slate-500">출근 전</Badge>}
          {myStatus === 'working' && <Badge className="text-base px-4 py-1.5 bg-primary/10 text-primary border border-primary/20 animate-pulse">근무 중</Badge>}
          {myStatus === 'completed' && <Badge variant="secondary" className="text-base px-4 py-1.5 bg-green-100 text-green-700 border-green-200">퇴근 완료</Badge>}
        </div>

        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center gap-3">
            <Button 
              size="lg" 
              className={cn("w-32 h-32 rounded-full text-lg shadow-lg flex flex-col gap-2 transition-all", myStatus === 'none' ? "bg-[#1D9E75] hover:bg-[#1D9E75]/90 hover:scale-105" : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed")}
              disabled={myStatus !== 'none' || actionLoading === myStaff?.id}
              onClick={() => handleMyAction('in')}
            >
              <PlayCircle className="w-10 h-10" />
              출근하기
            </Button>
            <div className="text-center">
              <p className="text-xs font-medium text-muted-foreground mb-1">출근 시간</p>
              <p className="text-lg font-bold">{formatTime(myAttendance?.clock_in_time)}</p>
            </div>
          </div>

          <div className="w-12 h-[2px] bg-border border-dashed" />

          <div className="flex flex-col items-center gap-3">
            <Button 
              size="lg" 
              variant="outline"
              className={cn("w-32 h-32 rounded-full text-lg shadow-lg flex flex-col gap-2 transition-all border-2", myStatus === 'working' ? "border-destructive text-destructive hover:bg-destructive/10 hover:scale-105" : "bg-muted border-transparent text-muted-foreground opacity-50 cursor-not-allowed")}
              disabled={myStatus !== 'working' || actionLoading === myStaff?.id}
              onClick={() => handleMyAction('out')}
            >
              <StopCircle className="w-10 h-10" />
              퇴근하기
            </Button>
            <div className="text-center">
              <p className="text-xs font-medium text-muted-foreground mb-1">퇴근 시간</p>
              <p className="text-lg font-bold">{formatTime(myAttendance?.clock_out_time)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              오늘의 스케줄
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mySchedule ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-lg">{formatTime(mySchedule.start_time)} ~ {formatTime(mySchedule.end_time)}</span>
                </div>
                <p className="text-sm text-muted-foreground">{mySchedule.title || '기본 스케줄'}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-2">배정된 스케줄이 없습니다.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm bg-slate-50 border-dashed">
          <CardContent className="flex flex-col items-center justify-center h-full p-6 text-center gap-2">
            <p className="text-sm font-medium">출퇴근 기록을 잊으셨나요?</p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                if(!myStaff) return;
                setRequestDraft({
                  memberId: myStaff.id,
                  attendanceId: myAttendance?.id || '',
                  inTime: formatTime(myAttendance?.clock_in_time) !== '-' ? formatTime(myAttendance?.clock_in_time) : '09:00',
                  outTime: formatTime(myAttendance?.clock_out_time) !== '-' ? formatTime(myAttendance?.clock_out_time) : '18:00',
                  reason: ''
                })
                setIsRequestModalOpen(true)
              }}
            >
              <PenBox className="w-4 h-4 mr-2" />
              기록 수정 요청하기
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Edit Request Modal for Staff */}
      <Dialog open={isRequestModalOpen} onOpenChange={setIsRequestModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>출퇴근 기록 수정 요청</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium text-foreground">수정 요청 시각 (출근)</Label>
                <TimePicker 
                  value={requestDraft.inTime} 
                  onChange={(val) => setRequestDraft(prev => ({...prev, inTime: val}))} 
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium text-foreground">수정 요청 시각 (퇴근)</Label>
                <TimePicker 
                  value={requestDraft.outTime} 
                  onChange={(val) => setRequestDraft(prev => ({...prev, outTime: val}))} 
                />
              </div>
            </div>
            
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium text-foreground">사유 작성 (필수)</Label>
              <Textarea 
                placeholder="예: 어제 마감 때 바빠서 퇴근 버튼 누르는 걸 깜빡했습니다."
                value={requestDraft.reason}
                onChange={(e) => setRequestDraft(prev => ({...prev, reason: e.target.value}))}
                className="h-24 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRequestModalOpen(false)}>취소</Button>
            <Button 
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={submitLoading || !requestDraft.reason.trim()}
              onClick={async () => {
                if (!requestDraft.reason.trim()) {
                  toast.error('수정 요청 사유를 작성해주세요.')
                  return
                }
                
                setSubmitLoading(true)
                try {
                  const reqIn = requestDraft.inTime ? toUTCISOString(selectedDate, requestDraft.inTime) : null
                  const reqOut = requestDraft.outTime ? toUTCISOString(selectedDate, requestDraft.outTime) : null
                  
                  const res = await createAttendanceRequest(
                    storeId, 
                    requestDraft.memberId, 
                    selectedDate, 
                    reqIn, 
                    reqOut, 
                    requestDraft.reason,
                    requestDraft.attendanceId
                  )
                  
                  if (res.error) {
                    toast.error(res.error)
                  } else {
                    toast.success('수정 요청이 제출되었습니다.')
                    setIsRequestModalOpen(false)
                    fetchData()
                  }
                } catch(e) {
                  toast.error('오류가 발생했습니다.')
                } finally {
                  setSubmitLoading(false)
                }
              }}
            >
              {submitLoading ? '제출 중...' : '요청 제출'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )

  const managerView = isManager ? (
    <div className="hidden lg:flex flex-col h-full bg-white rounded-xl border shadow-sm overflow-hidden">
      {/* Header / Controls */}
      <div className="flex items-center justify-between p-4 border-b bg-slate-50/50 shrink-0">
        <div className="flex items-center gap-4">
          <Input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-40"
          />
          <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Clock className="w-4 h-4" /> 
            {format(new Date(), 'a h:mm', { locale: ko })} 현재
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isManager && (
            <Button variant="outline" size="sm" className="gap-2 text-muted-foreground">
              <Download className="w-4 h-4" /> 엑셀 다운로드
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="px-6 pt-4 border-b">
          <TabsList className="bg-transparent h-10 p-0 gap-8 justify-start">
            <TabsTrigger 
              value="live" 
              className="relative rounded-none px-1 pb-3 pt-2 text-base font-semibold text-muted-foreground hover:text-foreground data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none outline-none focus-visible:outline-none !shadow-none bg-transparent group"
            >
              <Activity className="w-4 h-4 mr-2" />
              실시간 현황
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary scale-x-0 origin-left transition-transform duration-200 group-data-[state=active]:scale-x-100" />
            </TabsTrigger>
            <TabsTrigger 
              value="history" 
              className="relative rounded-none px-1 pb-3 pt-2 text-base font-semibold text-muted-foreground hover:text-foreground data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none outline-none focus-visible:outline-none !shadow-none bg-transparent group"
            >
              <FileClock className="w-4 h-4 mr-2" />
              출퇴근 기록부
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary scale-x-0 origin-left transition-transform duration-200 group-data-[state=active]:scale-x-100" />
            </TabsTrigger>
            <TabsTrigger 
              value="requests" 
              className="relative rounded-none px-1 pb-3 pt-2 text-base font-semibold text-muted-foreground hover:text-foreground data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none outline-none focus-visible:outline-none !shadow-none bg-transparent group"
            >
              <CheckSquare className="w-4 h-4 mr-2" />
              수정 내역 및 관리
              {requestsData.filter(r => r.status === 'pending').length > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-4 w-5 h-5 flex items-center justify-center p-0 text-[10px]">
                  {requestsData.filter(r => r.status === 'pending').length}
                </Badge>
              )}
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary scale-x-0 origin-left transition-transform duration-200 group-data-[state=active]:scale-x-100" />
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-auto bg-slate-50/30 p-6">
          
          <TabsContent value="live" className="m-0 mt-0 h-full flex flex-col gap-6 outline-none">
            {(() => {
              const now = new Date()
              const isToday = selectedDate === format(now, 'yyyy-MM-dd')
              
              let working = 0
              let lateOrAbsent = 0
              let completed = 0

              staffList.forEach(staff => {
                const attendance = attendanceData.find(a => a.member_id === staff.id)
                if (attendance?.status === 'working') working++
                if (attendance?.status === 'completed') completed++
                
                // Find today's schedule for this staff
                const staffSchedule = schedulesData.find(sch => 
                  sch.schedule_members?.some((sm: any) => sm.member_id === staff.id) &&
                  toKSTISOString(sch.start_time).startsWith(selectedDate)
                )

                if (staffSchedule && isToday && (!attendance || attendance.status === 'none')) {
                   const schTime = new Date(staffSchedule.start_time).getTime()
                   // If scheduled time has passed + 5 mins grace period, consider late
                   if (now.getTime() > schTime + (5 * 60 * 1000)) {
                      lateOrAbsent++
                   }
                }
              })

              return (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="border-primary/20 bg-primary/5 shadow-sm">
                      <CardHeader className="pb-2">
                        <CardDescription className="font-semibold text-primary">현재 근무 중</CardDescription>
                        <CardTitle className="text-3xl">{working}명</CardTitle>
                      </CardHeader>
                    </Card>
                    <Card className="border-border shadow-sm">
                      <CardHeader className="pb-2">
                        <CardDescription className="font-semibold text-muted-foreground">근무 완료</CardDescription>
                        <CardTitle className="text-3xl">{completed}명</CardTitle>
                      </CardHeader>
                    </Card>
                    <Card className="border-red-200 bg-red-50 shadow-sm">
                      <CardHeader className="pb-2">
                        <CardDescription className="font-semibold text-red-600">지각 / 미출근</CardDescription>
                        <CardTitle className="text-3xl">{lateOrAbsent}명</CardTitle>
                      </CardHeader>
                    </Card>
                  </div>

                  <div className="bg-white rounded-lg border shadow-sm overflow-hidden flex-1 flex flex-col">
                    <div className="p-4 border-b flex items-center justify-between">
                      <h3 className="font-semibold text-base">직원 출퇴근 상태</h3>
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input placeholder="이름 검색..." className="pl-9 h-8 w-[200px]" />
                      </div>
                    </div>
                    
                    <div className="flex-1 overflow-auto">
                      {loading ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
                        </div>
                      ) : staffList.length === 0 ? (
                        <div className="p-12 flex flex-col items-center justify-center text-muted-foreground h-full">
                          <Activity className="w-12 h-12 mb-4 opacity-20" />
                          <p>등록된 직원이 없습니다.</p>
                        </div>
                      ) : (
                        <div className="divide-y">
                          {staffList.map(staff => {
                            const roleInfo = getStaffRoleInfo(staff)
                            const attendance = attendanceData.find(a => a.member_id === staff.id)
                            const status = attendance?.status || 'none' // none, working, break, completed
                            
                            const staffSchedule = schedulesData.find(sch => 
                              sch.schedule_members?.some((sm: any) => sm.member_id === staff.id) &&
                              toKSTISOString(sch.start_time).startsWith(selectedDate)
                            )
                            
                            let isLate = false
                            if (staffSchedule && status === 'none' && isToday) {
                              const schTime = new Date(staffSchedule.start_time).getTime()
                              if (now.getTime() > schTime + (5 * 60 * 1000)) isLate = true
                            }

                            const isMe = staff.user_id === currentUserId
                            const canAction = isMe || isManager

                            const formatTime = (isoString?: string) => {
                              if (!isoString) return '-'
                              return format(new Date(isoString), 'HH:mm')
                            }

                            const handleAction = async (action: 'in' | 'out') => {
                              if (!canAction) return
                              setActionLoading(staff.id)
                              
                              try {
                                // Only get location if the user is performing their own action
                                let locationData: { lat: number, lng: number } | undefined = undefined;
                                if (staff.user_id === currentUserId) {
                                  try {
                                    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                                      navigator.geolocation.getCurrentPosition(resolve, reject, {
                                        enableHighAccuracy: true,
                                        timeout: 5000,
                                        maximumAge: 0
                                      });
                                    });
                                    locationData = {
                                      lat: position.coords.latitude,
                                      lng: position.coords.longitude
                                    };
                                  } catch (geoErr) {
                                    console.warn('Geolocation failed:', geoErr);
                                  }
                                }

                                let res: any = { error: 'Unknown action' }
                                if (action === 'in') {
                                  res = await clockIn(storeId, staff.id, selectedDate, undefined, locationData)
                                } else if (action === 'out') {
                                  res = await clockOut(attendance.id, storeId, locationData)
                                }
                                
                                if (res?.error) {
                                  toast.error(res.error)
                                } else {
                                  toast.success('성공적으로 처리되었습니다.')
                                  fetchData()
                                }
                              } catch (err) {
                                toast.error('오류가 발생했습니다.')
                              } finally {
                                setActionLoading(null)
                              }
                            }

                            return (
                              <div key={staff.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                                <div className="flex items-center gap-4">
                                  <Avatar className="h-10 w-10 border">
                                    <AvatarFallback>{staff.name.substring(0, 2)}</AvatarFallback>
                                  </Avatar>
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold">{staff.name || staff.profile?.full_name}</span>
                                      <Badge variant="outline" className="text-[10px] font-normal" style={{ color: roleInfo?.color, borderColor: roleInfo?.color }}>
                                        {roleInfo?.name || '직원'}
                                      </Badge>
                                      {isMe && <Badge variant="secondary" className="text-[10px] h-4">나</Badge>}
                                    </div>
                                    <div className="text-sm text-muted-foreground mt-0.5 flex gap-3">
                                      <span>출근: {formatTime(attendance?.clock_in_time)}</span>
                                      <span>퇴근: {formatTime(attendance?.clock_out_time)}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  {status === 'none' && (
                                    <>
                                      {isLate ? (
                                        <Badge variant="secondary" className="bg-red-100 text-red-600 font-bold px-2 py-1 border-red-200 animate-pulse">지각 / 미출근</Badge>
                                      ) : (
                                        <Badge variant="secondary" className="bg-slate-100 text-slate-500 font-medium px-2 py-1">출근 전</Badge>
                                      )}
                                      {canAction && (
                                        <Button size="sm" className="gap-1 bg-[#1D9E75] hover:bg-[#1D9E75]/90 shadow-sm" disabled={actionLoading === staff.id} onClick={() => handleAction('in')}>
                                          <PlayCircle className="w-4 h-4" /> 출근하기
                                        </Button>
                                      )}
                                    </>
                                  )}

                                  {status === 'working' && (
                                    <>
                                      <Badge className="bg-primary/10 text-primary hover:bg-primary/20 font-medium px-2 py-1 border border-primary/20 animate-pulse">근무 중</Badge>
                                      {canAction && (
                                        <Button variant="outline" size="sm" className="gap-1 border-destructive/30 text-destructive hover:bg-destructive/10" disabled={actionLoading === staff.id} onClick={() => handleAction('out')}>
                                          <StopCircle className="w-4 h-4" /> 퇴근하기
                                        </Button>
                                      )}
                                    </>
                                  )}

                                  {status === 'completed' && (
                                    <>
                                      <Badge variant="secondary" className="bg-slate-100 text-slate-500 font-medium px-2 py-1 border border-slate-200">퇴근 완료</Badge>
                                    </>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )
            })()}
          </TabsContent>

          <TabsContent value="history" className="m-0 mt-0 h-full flex flex-col outline-none">
            <div className="bg-white rounded-lg border shadow-sm overflow-hidden flex-1 flex flex-col">
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-semibold text-base">전체 출퇴근 기록부</h3>
              </div>
              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 font-semibold border-b">이름 (역할)</th>
                      <th className="px-4 py-3 font-semibold border-b">예정된 스케줄</th>
                      <th className="px-4 py-3 font-semibold border-b">실제 출근</th>
                      <th className="px-4 py-3 font-semibold border-b">실제 퇴근</th>
                      <th className="px-4 py-3 font-semibold border-b text-center">총 근무시간</th>
                      <th className="px-4 py-3 font-semibold border-b text-center">상태</th>
                      <th className="px-4 py-3 font-semibold border-b text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {staffList.map(staff => {
                      const roleInfo = getStaffRoleInfo(staff)
                      const attendance = attendanceData.find(a => a.member_id === staff.id)
                      const staffSchedule = schedulesData.find(sch => 
                        sch.schedule_members?.some((sm: any) => sm.member_id === staff.id) &&
                        toKSTISOString(sch.start_time).startsWith(selectedDate)
                      )

                      if (!attendance && !staffSchedule) return null; // No record and no schedule

                      const formatT = (iso?: string | null) => iso ? format(new Date(iso), 'HH:mm') : '-'

                      let scheduleText = '-'
                      if (staffSchedule) {
                        scheduleText = `${formatT(staffSchedule.start_time)} ~ ${formatT(staffSchedule.end_time)}`
                      }

                      let stateBadge = <Badge variant="secondary" className="bg-slate-100 text-slate-500">대기/정상</Badge>
                      
                      const schStartTime = staffSchedule ? new Date(staffSchedule.start_time).getTime() : null
                      const attStartTime = attendance?.clock_in_time ? new Date(attendance.clock_in_time).getTime() : null
                      
                      if (attendance) {
                         if (schStartTime && attStartTime && attStartTime > schStartTime + (5 * 60 * 1000)) {
                           stateBadge = <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200">지각</Badge>
                         } else if (attendance.status === 'completed') {
                           stateBadge = <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">퇴근 완료</Badge>
                         } else if (attendance.status === 'working') {
                           stateBadge = <Badge className="bg-primary/10 text-primary">근무 중</Badge>
                         }
                      } else if (staffSchedule) {
                         const now = new Date()
                         const isToday = selectedDate === format(now, 'yyyy-MM-dd')
                         if (isToday && schStartTime && now.getTime() > schStartTime + (5 * 60 * 1000)) {
                           stateBadge = <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200">결근 / 미출근</Badge>
                         }
                      }

                      let totalHours = '-'
                      if (attendance?.clock_in_time && attendance?.clock_out_time) {
                        const start = new Date(attendance.clock_in_time).getTime()
                        const end = new Date(attendance.clock_out_time).getTime()
                        // Removed manual break deductions here for simplicity
                        const diffMins = Math.max(0, Math.round((end - start) / 60000))
                        totalHours = (diffMins / 60).toFixed(1) + 'h'
                      }

                      return (
                        <tr key={staff.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{staff.name || staff.profile?.full_name}</span>
                              <Badge variant="outline" className="text-[10px] font-normal" style={{ color: roleInfo?.color, borderColor: roleInfo?.color }}>
                                {roleInfo?.name || '직원'}
                              </Badge>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground font-medium">{scheduleText}</td>
                          <td className="px-4 py-3 font-semibold">{formatT(attendance?.clock_in_time)}</td>
                          <td className="px-4 py-3 font-semibold">{formatT(attendance?.clock_out_time)}</td>
                          <td className="px-4 py-3 text-center font-bold">{totalHours}</td>
                          <td className="px-4 py-3 text-center">{stateBadge}</td>
                          <td className="px-4 py-3 text-right">
                            {staff.user_id === currentUserId && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 text-[11px] text-muted-foreground hover:text-primary"
                                onClick={() => {
                                  const formatT = (iso?: string | null) => iso ? format(new Date(iso), 'HH:mm') : ''
                                  setRequestDraft({
                                    memberId: staff.id,
                                    attendanceId: attendance?.id || '',
                                    inTime: formatT(attendance?.clock_in_time) || '09:00',
                                    outTime: formatT(attendance?.clock_out_time) || '18:00',
                                    reason: ''
                                  })
                                  setIsRequestModalOpen(true)
                                }}
                              >
                                <PenBox className="w-3 h-3 mr-1" />
                                수정 요청
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {staffList.filter(staff => {
                    const attendance = attendanceData.find(a => a.member_id === staff.id)
                    const staffSchedule = schedulesData.find(sch => sch.schedule_members?.some((sm: any) => sm.member_id === staff.id) && toKSTISOString(sch.start_time).startsWith(selectedDate))
                    return attendance || staffSchedule
                  }).length === 0 && (
                  <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                    <FileClock className="w-10 h-10 mb-2 opacity-20" />
                    <p>해당 날짜의 스케줄이나 출퇴근 기록이 없습니다.</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="requests" className="m-0 mt-0 h-full flex flex-col outline-none">
            <div className="bg-white rounded-lg border shadow-sm overflow-hidden flex-1 flex flex-col">
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-semibold text-base">출퇴근 시간 수정 요청 관리</h3>
              </div>
              <div className="flex-1 overflow-auto bg-slate-50/50 p-6">
                {!isManager ? (
                   <div className="flex flex-col items-center justify-center text-muted-foreground h-full">
                     <CheckSquare className="w-12 h-12 mb-4 opacity-20" />
                     <p>권한이 없습니다.</p>
                     <p className="text-sm mt-1">매니저 및 점주만 수정 요청을 관리할 수 있습니다.</p>
                   </div>
                ) : requestsData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-muted-foreground h-full bg-white rounded-xl border border-dashed border-border/50">
                    <CheckSquare className="w-12 h-12 mb-4 opacity-20" />
                    <p>수정 요청 내역이 없습니다.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 max-w-4xl mx-auto">
                    {requestsData.map(req => {
                      const formatT = (iso?: string | null) => iso ? format(new Date(iso), 'HH:mm') : '--:--'
                      
                      const handleResolve = async (isApproved: boolean) => {
                        const confirmMsg = isApproved ? '이 요청을 승인하시겠습니까?' : '이 요청을 반려하시겠습니까?'
                        if (!window.confirm(confirmMsg)) return
                        
                        setActionLoading(req.id)
                        try {
                          const res = await resolveAttendanceRequest(req.id, storeId, isApproved)
                          if (res.error) toast.error(res.error)
                          else {
                            toast.success(isApproved ? '승인되었습니다.' : '반려되었습니다.')
                            // Optimistic update status
                            setRequestsData(prev => prev.map(r => 
                              r.id === req.id ? { ...r, status: isApproved ? 'approved' : 'rejected', reviewed_by: currentUserId } : r
                            ))
                            fetchData()
                          }
                        } catch (e) {
                          toast.error('오류가 발생했습니다.')
                        } finally {
                          setActionLoading(null)
                        }
                      }

                      // Find reviewer name
                      const reviewer = staffList.find(s => s.user_id === req.reviewed_by)
                      const reviewerName = reviewer ? (reviewer.name || reviewer.profile?.full_name) : '관리자'

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
                                  <Badge variant="outline" className="text-[10px]" style={{ color: req.member?.role_info?.color, borderColor: req.member?.role_info?.color }}>
                                    {req.member?.role_info?.name || '직원'}
                                  </Badge>
                                </div>
                                <div className="text-sm text-muted-foreground mt-0.5">
                                  대상 일자: <span className="font-semibold text-foreground">{req.target_date}</span>
                                </div>
                              </div>
                            </div>
                            {req.status === 'pending' ? (
                              <Badge variant="secondary" className="bg-orange-100 text-orange-700">대기 중</Badge>
                            ) : req.status === 'approved' ? (
                              <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">승인 완료</Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-red-100 text-red-700 border-red-200">반려됨</Badge>
                            )}
                          </div>
                          
                          <div className="bg-slate-50 rounded-lg p-4 border grid grid-cols-2 gap-4 relative">
                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white border shadow-sm flex items-center justify-center text-muted-foreground">
                              ➔
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <span className="text-xs font-semibold text-muted-foreground">기존 기록</span>
                              <div className="text-sm line-through opacity-70">
                                {formatT(req.attendance?.clock_in_time)} ~ {formatT(req.attendance?.clock_out_time)}
                              </div>
                            </div>
                            <div className="flex flex-col gap-1.5 pl-4">
                              <span className="text-xs font-semibold text-primary">수정 요청 시간</span>
                              <div className="text-sm font-bold text-primary">
                                {formatT(req.requested_clock_in)} ~ {formatT(req.requested_clock_out)}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            <span className="text-xs font-semibold text-muted-foreground">요청 사유</span>
                            <div className="text-sm bg-muted/30 p-3 rounded-md border border-dashed border-black/10">
                              {req.reason}
                            </div>
                          </div>

                          {req.status === 'pending' ? (
                            <div className="flex gap-2 justify-end mt-2">
                              <Button variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20" disabled={actionLoading === req.id} onClick={() => handleResolve(false)}>
                                <X className="w-4 h-4 mr-1.5" /> 반려
                              </Button>
                              <Button className="bg-[#1D9E75] hover:bg-[#1D9E75]/90" disabled={actionLoading === req.id} onClick={() => handleResolve(true)}>
                                <Check className="w-4 h-4 mr-1.5" /> 승인
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-end mt-1">
                              <span className="text-xs text-muted-foreground bg-slate-100 px-3 py-1.5 rounded-full border">
                                처리자: <span className="font-semibold text-foreground">{reviewerName}</span>
                              </span>
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

        </div>
      </Tabs>

      {/* Edit Request Modal */}
      <Dialog open={isRequestModalOpen} onOpenChange={setIsRequestModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>출퇴근 기록 수정 요청</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium text-foreground">수정 요청 시각 (출근)</Label>
                <TimePicker 
                  value={requestDraft.inTime} 
                  onChange={(val) => setRequestDraft(prev => ({...prev, inTime: val}))} 
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium text-foreground">수정 요청 시각 (퇴근)</Label>
                <TimePicker 
                  value={requestDraft.outTime} 
                  onChange={(val) => setRequestDraft(prev => ({...prev, outTime: val}))} 
                />
              </div>
            </div>
            
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium text-foreground">사유 작성 (필수)</Label>
              <Textarea 
                placeholder="예: 어제 마감 때 바빠서 퇴근 버튼 누르는 걸 깜빡했습니다."
                value={requestDraft.reason}
                onChange={(e) => setRequestDraft(prev => ({...prev, reason: e.target.value}))}
                className="h-24 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRequestModalOpen(false)}>취소</Button>
            <Button 
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={submitLoading || !requestDraft.reason.trim()}
              onClick={async () => {
                if (!requestDraft.reason.trim()) {
                  toast.error('수정 요청 사유를 작성해주세요.')
                  return
                }
                
                setSubmitLoading(true)
                try {
                  const reqIn = requestDraft.inTime ? toUTCISOString(selectedDate, requestDraft.inTime) : null
                  const reqOut = requestDraft.outTime ? toUTCISOString(selectedDate, requestDraft.outTime) : null
                  
                  const res = await createAttendanceRequest(
                    storeId, 
                    requestDraft.memberId, 
                    selectedDate, 
                    reqIn, 
                    reqOut, 
                    requestDraft.reason,
                    requestDraft.attendanceId
                  )
                  
                  if (res.error) {
                    toast.error(res.error)
                  } else {
                    toast.success('수정 요청이 제출되었습니다.')
                    setIsRequestModalOpen(false)
                    fetchData()
                  }
                } catch(e) {
                  toast.error('오류가 발생했습니다.')
                } finally {
                  setSubmitLoading(false)
                }
              }}
            >
              {submitLoading ? '제출 중...' : '요청 제출'}
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
