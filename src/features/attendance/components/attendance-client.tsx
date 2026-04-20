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
import { Activity, Clock, FileClock, CheckSquare, Search, Download, PlayCircle, StopCircle, PenBox, Check, X, ChevronLeft, ChevronRight } from 'lucide-react'
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
  const [activeTab, setActiveTab] = useState(isManager ? 'live' : 'history')
  const [attendanceData, setAttendanceData] = useState<any[]>([])

  useEffect(() => {
    if (isManager) {
      const checkMobile = () => {
        if (window.innerWidth < 768) {
          setActiveTab(prev => prev === 'live' ? 'history' : prev)
        }
      }
      checkMobile()
      window.addEventListener('resize', checkMobile)
      return () => window.removeEventListener('resize', checkMobile)
    }
  }, [isManager])
  const [searchTerm, setSearchTerm] = useState('')
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
      
      const reqs = await getAttendanceRequests(storeId, Date.now())
      setRequestsData(reqs || [])
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

  const getStaffName = (staff: any) => staff.name || staff.profile?.full_name || ''

  const sortedStaffList = [...staffList].sort((a, b) => {
    const roleA = getStaffRoleInfo(a)
    const roleB = getStaffRoleInfo(b)
    
    const priorityA = roleA?.priority ?? -1
    const priorityB = roleB?.priority ?? -1
    
    if (priorityB !== priorityA) {
      return priorityB - priorityA
    }
    
    return getStaffName(a).localeCompare(getStaffName(b), 'ko')
  })

  const myStaff = staffList.find(s => s.user_id === currentUserId)
  const myAttendance = attendanceData.find(a => a.member_id === myStaff?.id)
  const myStatus = myAttendance?.status || 'none'
  
  const mySchedule = schedulesData.find(sch => 
    sch.schedule_members?.some((sm: any) => sm.member_id === myStaff?.id) &&
    toKSTISOString(sch.start_time).startsWith(selectedDate)
  )

  const managerView = (
    <div className={cn(
      "flex flex-col bg-white md:rounded-xl md:border md:shadow-sm overflow-hidden",
      isManager ? "h-full" : "h-full"
    )}>
      {/* Header / Controls */}
      <div className="flex flex-col md:flex-row justify-between p-3 md:p-4 border-b bg-slate-50/50 shrink-0 gap-3 md:gap-4">
        {/* Desktop View & Mobile Download Button Layout */}
        <div className="flex items-center justify-between w-full md:w-auto md:flex-1 gap-2">
          {/* Mobile Date Navigation (Hidden on Desktop) */}
          <div className="flex items-center justify-between bg-white border rounded-lg px-2 py-1.5 shadow-sm md:hidden flex-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="w-7 h-7 rounded-md"
              onClick={() => {
                const date = new Date(selectedDate)
                date.setDate(date.getDate() - 1)
                setSelectedDate(format(date, 'yyyy-MM-dd'))
              }}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <div className="relative flex items-center justify-center gap-1.5 font-semibold text-sm">
              <CalendarDays className="w-4 h-4 text-primary" />
              <span>{format(new Date(selectedDate), 'yyyy. MM. dd')}</span>
              <Input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
              />
            </div>

            <Button 
              variant="ghost" 
              size="icon" 
              className="w-7 h-7 rounded-md"
              onClick={() => {
                const date = new Date(selectedDate)
                date.setDate(date.getDate() + 1)
                setSelectedDate(format(date, 'yyyy-MM-dd'))
              }}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Desktop Date Navigation (Hidden on Mobile) */}
          <div className="hidden md:flex items-center gap-3">
            <Input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-40 h-9 text-sm px-2"
            />
          </div>

          {/* Action Buttons removed */}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className={cn("flex flex-col min-h-0", "flex-1")}>
        <div className="px-4 md:px-6 pt-2 md:pt-4 border-b overflow-x-auto no-scrollbar">
          <TabsList className="bg-transparent h-9 md:h-10 p-0 gap-4 md:gap-8 justify-start flex-nowrap w-max min-w-full">
            {isManager && (
              <TabsTrigger 
                value="live" 
                className="relative rounded-none px-0.5 pb-2 md:pb-3 pt-2 text-sm md:text-base font-semibold text-muted-foreground hover:text-foreground data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none outline-none focus-visible:outline-none !shadow-none bg-transparent group whitespace-nowrap hidden md:inline-flex items-center"
              >
                <Activity className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2" />
                <span className="hidden md:inline">실시간 현황</span>
                <span className="md:hidden">현황</span>
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary scale-x-0 origin-left transition-transform duration-200 group-data-[state=active]:scale-x-100" />
              </TabsTrigger>
            )}
            <TabsTrigger 
              value="history" 
              className="relative rounded-none px-0.5 pb-2 md:pb-3 pt-2 text-sm md:text-base font-semibold text-muted-foreground hover:text-foreground data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none outline-none focus-visible:outline-none !shadow-none bg-transparent group whitespace-nowrap"
            >
              <FileClock className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2" />
              <span className="hidden md:inline">출퇴근 기록부</span>
              <span className="md:hidden">기록부</span>
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary scale-x-0 origin-left transition-transform duration-200 group-data-[state=active]:scale-x-100" />
            </TabsTrigger>
            <TabsTrigger 
              value="requests" 
              className="relative rounded-none px-0.5 pb-2 md:pb-3 pt-2 text-sm md:text-base font-semibold text-muted-foreground hover:text-foreground data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none outline-none focus-visible:outline-none !shadow-none bg-transparent group flex items-center whitespace-nowrap"
            >
              <CheckSquare className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2" />
              <span className="hidden md:inline">{isManager ? "수정 내역 및 관리" : "수정 요청 현황"}</span>
              <span className="md:hidden">{isManager ? "관리" : "수정요청"}</span>
              {requestsData.filter(r => r.status === 'pending' && (isManager || r.member_id === myStaff?.id)).length > 0 && (
                <Badge variant="destructive" className="ml-1.5 w-4 h-4 md:w-5 md:h-5 flex items-center justify-center p-0 text-[9px] md:text-[10px] rounded-full">
                  {requestsData.filter(r => r.status === 'pending' && (isManager || r.member_id === myStaff?.id)).length}
                </Badge>
              )}
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary scale-x-0 origin-left transition-transform duration-200 group-data-[state=active]:scale-x-100" />
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab Contents */}
        <div className={cn("overflow-auto bg-slate-50/30 p-6", "flex-1")}>
          
          {isManager && (
            <TabsContent value="live" className="m-0 mt-0 h-full flex flex-col gap-6 outline-none">
              {(() => {
                const now = new Date()
                const isToday = selectedDate === format(now, 'yyyy-MM-dd')
                
                let working = 0
                let lateOrAbsent = 0

          staffList.forEach(staff => {
            const attendance = attendanceData.find(a => a.member_id === staff.id)
            if (attendance?.status === 'working') working++
            
            const staffSchedule = schedulesData.find(sch => 
              sch.schedule_members?.some((sm: any) => sm.member_id === staff.id) &&
              toKSTISOString(sch.start_time).startsWith(selectedDate)
            )

            if (staffSchedule && isToday && (!attendance || attendance.status === 'none')) {
              const schTime = new Date(staffSchedule.start_time).getTime()
              if (now.getTime() > schTime + (5 * 60 * 1000)) {
                lateOrAbsent++
              }
            }
          })

                    return (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-2 gap-4 md:gap-6">
                          <Card className="border-primary/20 bg-primary/5 shadow-sm md:shadow-sm border md:border-primary/20">
                            <CardHeader className="p-4 md:p-6 pb-2 md:pb-2">
                              <CardDescription className="font-semibold text-primary text-xs md:text-sm">근무 중</CardDescription>
                              <CardTitle className="text-xl md:text-3xl">{working}명</CardTitle>
                            </CardHeader>
                          </Card>
                          <Card className="border-red-200 bg-red-50 shadow-sm md:shadow-sm border md:border-red-200">
                            <CardHeader className="p-4 md:p-6 pb-2 md:pb-2">
                              <CardDescription className="font-semibold text-red-600 text-xs md:text-sm">지각/미출근</CardDescription>
                              <CardTitle className="text-xl md:text-3xl">{lateOrAbsent}명</CardTitle>
                            </CardHeader>
                          </Card>
                        </div>

                        <div className="bg-white md:rounded-lg md:border-y border-t md:border shadow-none md:shadow-sm overflow-hidden flex-1 flex flex-col">
                      <div className="p-4 border-b flex items-center justify-between bg-white md:bg-transparent">
                        <h1 className="text-base md:text-2xl font-semibold md:font-bold tracking-tight text-center md:text-left">직원 출퇴근 상태</h1>
                        <div className="relative">
                          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <Input 
                            placeholder="이름 검색..." 
                            className="pl-9 h-8 w-[200px]" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                        </div>
                      </div>
                      
                      <div className="flex-1 overflow-auto">
                        {loading ? (
                          <div className="flex items-center justify-center h-full">
                            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
                          </div>
                        ) : sortedStaffList.length === 0 ? (
                          <div className="p-12 flex flex-col items-center justify-center text-muted-foreground h-full">
                            <Activity className="w-12 h-12 mb-4 opacity-20" />
                            <p>등록된 직원이 없습니다.</p>
                          </div>
                        ) : sortedStaffList.filter(staff => {
                            const name = getStaffName(staff)
                            return name.toLowerCase().includes(searchTerm.toLowerCase())
                          }).length === 0 ? (
                            <div className="p-12 flex flex-col items-center justify-center text-muted-foreground h-full">
                              <Search className="w-12 h-12 mb-4 opacity-20" />
                              <p>검색 결과가 없습니다.</p>
                            </div>
                        ) : (
                          <div className="divide-y">
                            {sortedStaffList
                              .filter(staff => {
                                const name = getStaffName(staff)
                                return name.toLowerCase().includes(searchTerm.toLowerCase())
                              })
                              .map(staff => {
                              const roleInfo = getStaffRoleInfo(staff)
                              const attendance = attendanceData.find(a => a.member_id === staff.id)
                              const status = attendance?.status || 'none'
                              
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
                                      <AvatarFallback>{getStaffName(staff).substring(0, 2) || '직원'}</AvatarFallback>
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
          )}

          <TabsContent value="history" className={cn("m-0 mt-0 flex flex-col outline-none", "h-full")}>
            <div className={cn("bg-white md:rounded-lg md:border-y border-t md:border shadow-none md:shadow-sm overflow-hidden flex flex-col", "flex-1")}>
              <div className="p-4 border-b hidden md:flex items-center justify-between bg-white md:bg-transparent">
                <h1 className="text-base md:text-2xl font-semibold md:font-bold tracking-tight text-center md:text-left w-full md:w-auto">{isManager ? "전체 출퇴근 기록부" : "출퇴근 관리"}</h1>
              </div>
              <div className={cn("overflow-auto", "flex-1")}>
                {/* Desktop View Table */}
                <table className="w-full text-sm hidden md:table">
                  <thead className="bg-muted/50 text-muted-foreground sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 font-semibold border-b text-center">이름 (역할)</th>
                      <th className="px-4 py-3 font-semibold border-b text-center">예정된 스케줄</th>
                      <th className="px-4 py-3 font-semibold border-b text-center">출근</th>
                      <th className="px-4 py-3 font-semibold border-b text-center">퇴근</th>
                      <th className="px-4 py-3 font-semibold border-b text-center">총 근무시간</th>
                      <th className="px-4 py-3 font-semibold border-b text-center">상태</th>
                      <th className="px-4 py-3 font-semibold border-b text-center">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sortedStaffList.filter(s => isManager || s.user_id === currentUserId).map(staff => {
                      const roleInfo = getStaffRoleInfo(staff)
                      const attendance = attendanceData.find(a => a.member_id === staff.id)
                      const staffSchedule = schedulesData.find(sch => 
                        sch.schedule_members?.some((sm: any) => sm.member_id === staff.id) &&
                        toKSTISOString(sch.start_time).startsWith(selectedDate)
                      )

                      if (!attendance && !staffSchedule) return null

                      const formatT = (iso?: string | null) => iso ? format(new Date(iso), 'HH:mm') : '-'

                      let scheduleText = '오늘 스케줄 없음'
                      if (staffSchedule) {
                        scheduleText = `${formatT(staffSchedule.start_time)} ~ ${formatT(staffSchedule.end_time)}`
                      }

                      const schStartTime = staffSchedule ? new Date(staffSchedule.start_time).getTime() : null
                      const attStartTime = attendance?.clock_in_time ? new Date(attendance.clock_in_time).getTime() : null
                      
                      const isLate = attendance && schStartTime && attStartTime && attStartTime > schStartTime + (5 * 60 * 1000)
                      
                      let statusBadge = <Badge variant="secondary" className="bg-slate-100 text-slate-500">대기/정상</Badge>
                      
                      if (attendance) {
                        if (attendance.status === 'completed') {
                          statusBadge = <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">퇴근 완료</Badge>
                        } else if (attendance.status === 'working') {
                          statusBadge = (
                            <div className="flex items-center justify-center gap-1.5 border border-emerald-200 bg-emerald-50 px-2 py-0.5 rounded-full">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </span>
                              <span className="font-bold text-xs text-emerald-600">근무 중</span>
                            </div>
                          )
                        }
                      } else if (staffSchedule) {
                        const now = new Date()
                        const isToday = selectedDate === format(now, 'yyyy-MM-dd')
                        if (isToday && schStartTime && now.getTime() > schStartTime + (5 * 60 * 1000)) {
                          statusBadge = <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200">결근 / 미출근</Badge>
                        }
                      }

                      const stateBadge = statusBadge

                      let totalHours = '-'
                      if (attendance?.clock_in_time && attendance?.clock_out_time) {
                        const start = new Date(attendance.clock_in_time).getTime()
                        const end = new Date(attendance.clock_out_time).getTime()
                        const diffMins = Math.max(0, Math.round((end - start) / 60000))
                        const hours = Math.floor(diffMins / 60)
                        const mins = diffMins % 60
                        totalHours = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
                      }

                      return (
                        <tr key={staff.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              <span className="font-medium">{staff.name || staff.profile?.full_name}</span>
                              <Badge variant="outline" className="text-[10px] font-normal" style={{ color: roleInfo?.color, borderColor: roleInfo?.color }}>
                                {roleInfo?.name || '직원'}
                              </Badge>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-muted-foreground font-medium">{scheduleText}</td>
                          <td className="px-4 py-3 text-center font-semibold">
                            {isLate ? (
                              <div className="text-red-600">
                                {formatT(attendance?.clock_in_time)}
                              </div>
                            ) : (
                              formatT(attendance?.clock_in_time)
                            )}
                          </td>
                          <td className="px-4 py-3 text-center font-semibold">{formatT(attendance?.clock_out_time)}</td>
                          <td className="px-4 py-3 text-center font-bold">{totalHours}</td>
                          <td className="px-4 py-3 text-center">{stateBadge}</td>
                          <td className="px-4 py-3 text-center">
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

                {/* Mobile View Card Layout */}
                <div className="md:hidden flex flex-col gap-4 p-4">
                  {sortedStaffList.filter(s => isManager || s.user_id === currentUserId).map(staff => {
                    const roleInfo = getStaffRoleInfo(staff)
                    const attendance = attendanceData.find(a => a.member_id === staff.id)
                    const staffSchedule = schedulesData.find(sch => 
                      sch.schedule_members?.some((sm: any) => sm.member_id === staff.id) &&
                      toKSTISOString(sch.start_time).startsWith(selectedDate)
                    )

                    if (!attendance && !staffSchedule) return null

                    const formatT = (iso?: string | null) => iso ? format(new Date(iso), 'HH:mm') : '-'

                    let scheduleText = '오늘 스케줄 없음'
                    if (staffSchedule) {
                      scheduleText = `${formatT(staffSchedule.start_time)} ~ ${formatT(staffSchedule.end_time)}`
                    }

                    const schStartTime = staffSchedule ? new Date(staffSchedule.start_time).getTime() : null
                    const attStartTime = attendance?.clock_in_time ? new Date(attendance.clock_in_time).getTime() : null
                    
                    const isLate = attendance && schStartTime && attStartTime && attStartTime > schStartTime + (5 * 60 * 1000)

                    let statusBadge = <Badge variant="secondary" className="bg-slate-100 text-slate-500 text-[9px] px-1.5 h-4 font-normal">대기/정상</Badge>
                    
                    if (attendance) {
                      if (attendance.status === 'completed') {
                        statusBadge = <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200 text-[9px] px-1.5 h-4 font-normal">퇴근 완료</Badge>
                      } else if (attendance.status === 'working') {
                        statusBadge = (
                          <div className="flex items-center gap-1 border border-emerald-200 bg-emerald-50 px-1.5 h-4 rounded-full">
                            <span className="relative flex h-1 w-1">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1 w-1 bg-emerald-500"></span>
                            </span>
                            <span className="font-normal text-[9px] text-emerald-600">근무 중</span>
                          </div>
                        )
                      }
                    } else if (staffSchedule) {
                      const now = new Date()
                      const isToday = selectedDate === format(now, 'yyyy-MM-dd')
                      if (isToday && schStartTime && now.getTime() > schStartTime + (5 * 60 * 1000)) {
                        statusBadge = <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200 text-[9px] px-1.5 h-4 font-normal">결근/미출근</Badge>
                      }
                    }

                    const stateBadge = statusBadge

                    let totalHours = '-'
                    if (attendance?.clock_in_time && attendance?.clock_out_time) {
                      const start = new Date(attendance.clock_in_time).getTime()
                      const end = new Date(attendance.clock_out_time).getTime()
                      const diffMins = Math.max(0, Math.round((end - start) / 60000))
                      const hours = Math.floor(diffMins / 60)
                      const mins = diffMins % 60
                      totalHours = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
                    }

                    return (
                      <div key={staff.id} className="bg-white border rounded-xl shadow-sm p-5 flex flex-col gap-5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-base leading-none">{staff.name || staff.profile?.full_name}</span>
                            <Badge variant="outline" className="text-[10px] font-normal px-1.5 h-5 flex items-center justify-center" style={{ color: roleInfo?.color, borderColor: roleInfo?.color }}>
                              {roleInfo?.name || '직원'}
                            </Badge>
                          </div>
                          <div className="shrink-0 flex items-center scale-110 origin-right">
                            {stateBadge}
                          </div>
                        </div>

                        <div className="bg-slate-50/80 rounded-xl py-4 grid grid-cols-3 border">
                          <div className="flex flex-col items-center justify-center gap-1.5 border-r border-slate-200/60 px-2">
                            <span className="text-xs font-semibold text-muted-foreground">출근</span>
                            {isLate ? (
                              <div className="flex items-center gap-1 text-red-600">
                                <span className="text-base font-bold">{formatT(attendance?.clock_in_time)}</span>
                              </div>
                            ) : (
                              <span className="text-base font-bold">{formatT(attendance?.clock_in_time)}</span>
                            )}
                          </div>
                          <div className="flex flex-col items-center justify-center gap-1.5 border-r border-slate-200/60 px-2">
                            <span className="text-xs font-semibold text-muted-foreground">퇴근</span>
                            <span className="text-base font-bold">{formatT(attendance?.clock_out_time)}</span>
                          </div>
                          <div className="flex flex-col items-center justify-center gap-1.5 px-2">
                            <span className="text-xs font-semibold text-muted-foreground">총 근무시간</span>
                            <span className="text-base font-black text-primary">{totalHours}</span>
                          </div>
                        </div>

                        {staff.user_id === currentUserId && (
                          <div className="pt-1">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="w-full h-9 text-xs font-semibold"
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
                              <PenBox className="w-3.5 h-3.5 mr-1.5" />
                              내 기록 수정 요청
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {sortedStaffList.filter(s => isManager || s.user_id === currentUserId).filter(staff => {
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

          <TabsContent value="requests" className={cn("m-0 mt-0 flex flex-col outline-none", "h-full")}>
            <div className={cn("bg-white md:rounded-lg md:border-y border-t md:border shadow-none md:shadow-sm overflow-hidden flex flex-col", "flex-1")}>
              <div className="p-4 border-b flex items-center justify-center md:justify-between">
                <h3 className="font-semibold text-base">{isManager ? "출퇴근 시간 수정 요청 관리" : "나의 수정 요청 내역"}</h3>
              </div>
              <div className={cn("bg-slate-50/50 p-4 md:p-6", "flex-1 overflow-auto")}>
                {requestsData.filter(r => isManager || r.member_id === myStaff?.id).length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-muted-foreground p-12 bg-white rounded-xl border border-dashed border-border/50">
                    <CheckSquare className="w-12 h-12 mb-4 opacity-20" />
                    <p>수정 요청 내역이 없습니다.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 max-w-4xl mx-auto">
                    {requestsData
                      .filter(r => isManager || r.member_id === myStaff?.id)
                      .map(req => {
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

                        const reviewer = staffList.find(s => s.user_id === req.reviewed_by)
                        const reviewerName = reviewer ? (reviewer.name || reviewer.profile?.full_name) : '관리자'

                        return (
                          <div key={req.id} className={cn("bg-white md:border md:shadow-sm border-b md:rounded-xl p-4 md:p-5 flex flex-col gap-3 md:gap-4 transition-colors last:border-b-0", req.status !== 'pending' && "opacity-80 bg-slate-50/50")}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-sm md:text-base truncate">{req.member?.name || req.member?.profile?.full_name}</span>
                                    <Badge variant="outline" className="text-[9px] md:text-[10px] px-1 h-4 md:h-5 shrink-0" style={{ color: req.member?.role_info?.color, borderColor: req.member?.role_info?.color }}>
                                      {req.member?.role_info?.name || '직원'}
                                    </Badge>
                                  </div>
                                  <div className="text-[11px] md:text-sm text-muted-foreground mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                                    대상 일자: <span className="font-semibold text-foreground">{req.target_date}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="shrink-0">
                                {req.status === 'pending' ? (
                                  <Badge variant="secondary" className="bg-orange-100 text-orange-700 text-[10px] md:text-xs">대기 중</Badge>
                                ) : req.status === 'approved' ? (
                                  <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200 text-[10px] md:text-xs">승인 완료</Badge>
                                ) : (
                                  <Badge variant="secondary" className="bg-red-100 text-red-700 border-red-200 text-[10px] md:text-xs">반려됨</Badge>
                                )}
                              </div>
                            </div>
                            
                            <div className="bg-slate-50 rounded-lg p-3 md:p-4 border grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 relative">
                              <div className="hidden sm:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white border shadow-sm items-center justify-center text-muted-foreground z-10">
                                ➔
                              </div>
                              <div className="flex flex-col gap-1 md:gap-1.5">
                                <span className="text-[10px] md:text-xs font-semibold text-muted-foreground">기존 기록</span>
                                <div className="text-xs md:text-sm line-through opacity-70 font-medium">
                                  {formatT(req.attendance?.clock_in_time)} ~ {formatT(req.attendance?.clock_out_time)}
                                </div>
                              </div>
                              <div className="flex flex-col gap-1 md:gap-1.5 sm:pl-4 border-t sm:border-t-0 pt-2 sm:pt-0">
                                <span className="text-[10px] md:text-xs font-semibold text-primary">수정 요청 시간</span>
                                <div className="text-xs md:text-sm font-bold text-primary">
                                  {formatT(req.requested_clock_in)} ~ {formatT(req.requested_clock_out)}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <span className="text-[10px] md:text-xs font-semibold text-muted-foreground">요청 사유</span>
                              <div className="text-xs md:text-sm bg-muted/30 p-2.5 md:p-3 rounded-md border border-dashed border-black/10 leading-relaxed">
                                {req.reason}
                              </div>
                            </div>

                            {req.status === 'pending' && isManager ? (
                              <div className="flex gap-2 justify-end mt-1">
                                <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20 h-8 md:h-9 text-xs" disabled={actionLoading === req.id} onClick={() => handleResolve(false)}>
                                  <X className="w-3.5 h-3.5 mr-1" /> 반려
                                </Button>
                                <Button size="sm" className="bg-[#1D9E75] hover:bg-[#1D9E75]/90 h-8 md:h-9 text-xs" disabled={actionLoading === req.id} onClick={() => handleResolve(true)}>
                                  <Check className="w-3.5 h-3.5 mr-1" /> 승인
                                </Button>
                              </div>
                            ) : req.status === 'pending' ? null : (
                              <div className="flex justify-end mt-1">
                                <span className="text-[10px] md:text-xs text-muted-foreground bg-slate-100 px-2.5 py-1 rounded-full border">
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
                  onChange={(val) => {
                    setRequestDraft(prev => {
                      const newOutTime = val > prev.outTime ? val : prev.outTime;
                      return { ...prev, inTime: val, outTime: newOutTime };
                    });
                  }} 
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium text-foreground">수정 요청 시각 (퇴근)</Label>
                <TimePicker 
                  value={requestDraft.outTime} 
                  onChange={(val) => {
                    setRequestDraft(prev => {
                      const newInTime = val < prev.inTime ? val : prev.inTime;
                      return { ...prev, outTime: val, inTime: newInTime };
                    });
                  }} 
                />
              </div>
            </div>
            
            <div className="flex flex-col gap-2 w-full">
              <Label className="text-sm font-medium text-foreground">사유 작성 (필수)</Label>
              <Textarea 
                placeholder="예: 어제 마감 때 바빠서 퇴근 버튼 누르는 걸 깜빡했습니다."
                value={requestDraft.reason}
                onChange={(e) => setRequestDraft(prev => ({...prev, reason: e.target.value}))}
                className="h-24 w-full resize-none ![field-sizing:fixed]"
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

  return (
    <>
      {managerView}
    </>
  )
}