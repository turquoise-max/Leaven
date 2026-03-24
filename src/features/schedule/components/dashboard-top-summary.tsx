'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LogIn, LogOut, Plane, Clock, Check } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { getTodayDateString } from '@/lib/date-utils'
import { clockIn, clockOut } from '@/features/attendance/actions'
import { createLeaveRequest } from '@/features/leave/actions'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface DashboardTopSummaryProps {
  storeId: string
  memberId: string
  attendance: any
  leaveBalance: any
  weeklySchedules: any[]
}

export function DashboardTopSummary({
  storeId,
  memberId,
  attendance,
  leaveBalance,
  weeklySchedules
}: DashboardTopSummaryProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [actionLoading, setActionLoading] = useState(false)
  
  // 휴가 신청 모달 상태
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false)
  const [leaveDraft, setLeaveDraft] = useState({
    leaveType: 'annual',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    reason: ''
  })
  const [leaveLoading, setLeaveLoading] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const handleClockIn = async () => {
    setActionLoading(true)
    try {
      const res = await clockIn(storeId, memberId, getTodayDateString())
      if (res.error) toast.error(res.error)
      else toast.success('출근 처리가 완료되었습니다.')
    } catch (e) {
      toast.error('오류가 발생했습니다.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleClockOut = async () => {
    if (!attendance?.id) return
    setActionLoading(true)
    try {
      const res = await clockOut(attendance.id, storeId)
      if (res.error) toast.error(res.error)
      else toast.success('퇴근 처리가 완료되었습니다.')
    } catch (e) {
      toast.error('오류가 발생했습니다.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleLeaveSubmit = async () => {
    setLeaveLoading(true)
    try {
      const days = leaveDraft.leaveType.includes('half') ? 0.5 : 1 // 간단한 계산
      const res = await createLeaveRequest(
        storeId, 
        memberId, 
        leaveDraft.leaveType, 
        leaveDraft.startDate, 
        leaveDraft.endDate, 
        days, 
        leaveDraft.reason
      )
      if (res.error) toast.error(res.error)
      else {
        toast.success('휴가가 신청되었습니다.')
        setIsLeaveModalOpen(false)
        setLeaveDraft(prev => ({...prev, reason: ''}))
      }
    } catch (e) {
      toast.error('휴가 신청 중 오류가 발생했습니다.')
    } finally {
      setLeaveLoading(false)
    }
  }

  // 출근 상태 판단
  const isClockedIn = !!attendance?.clock_in_time
  const isClockedOut = !!attendance?.clock_out_time

  // 휴가 잔여일 계산
  const totalDays = leaveBalance?.total_days || 0
  const usedDays = leaveBalance?.used_days || 0
  const remainDays = totalDays - usedDays

  // 이번 주 근무 시간 계산
  let totalMinutes = 0
  weeklySchedules?.forEach(sch => {
    const start = new Date(sch.start_time).getTime()
    const end = new Date(sch.end_time).getTime()
    totalMinutes += (end - start) / 60000
  })
  
  const weeklyHours = Math.floor(totalMinutes / 60)
  const weeklyMins = Math.round(totalMinutes % 60)
  const percentage = Math.min((totalMinutes / (40 * 60)) * 100, 100)

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
        {/* 1. 출/퇴근 카드 */}
        <Card className="shadow-sm border-black/10 overflow-hidden flex flex-col h-full bg-white">
          <CardHeader className="bg-[#fbfbfb] p-3 border-b border-black/5 shrink-0">
            <CardTitle className="text-[13px] font-bold flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                근태 관리
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">
                {isMounted ? format(currentTime, 'MM.dd (E)', { locale: ko }) : '00.00 (월)'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex-1 flex flex-col justify-between">
            <div className="text-3xl font-bold tracking-tight text-[#1a1a1a] tabular-nums mb-4 text-center mt-2">
              {isMounted ? format(currentTime, 'HH:mm:ss') : '00:00:00'}
            </div>
            
            <div className="mt-auto">
              {!isClockedIn ? (
                <Button 
                  className="w-full bg-[#1a1a1a] hover:bg-black/80 text-white font-semibold h-10 text-[13px]" 
                  disabled={actionLoading}
                  onClick={handleClockIn}
                >
                  <LogIn className="w-3.5 h-3.5 mr-1.5" />
                  출근하기
                </Button>
              ) : !isClockedOut ? (
                <Button 
                  className="w-full bg-white hover:bg-muted text-destructive border border-destructive/20 font-semibold h-10 shadow-sm text-[13px]" 
                  variant="outline"
                  disabled={actionLoading}
                  onClick={handleClockOut}
                >
                  <LogOut className="w-3.5 h-3.5 mr-1.5" />
                  퇴근하기
                </Button>
              ) : (
                <div className="w-full flex items-center justify-center h-10 text-[13px] font-semibold text-emerald-600 bg-emerald-50 rounded-md border border-emerald-100">
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                  오늘 근무 종료
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 2. 휴가 및 연차 신청 */}
        <Card className="shadow-sm border-black/10 flex flex-col h-full bg-white">
          <CardHeader className="bg-[#fbfbfb] p-3 border-b border-black/5 shrink-0">
            <CardTitle className="text-[13px] font-bold flex items-center gap-1.5">
              <Plane className="w-3.5 h-3.5" />
              휴가 관리
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex-1 flex flex-col justify-center gap-4">
            <div className="flex items-center justify-between px-1">
              <span className="text-[12px] font-medium text-muted-foreground">잔여 연차</span>
              <span className="text-[18px] font-bold text-[#1a1a1a]">{remainDays}일</span>
            </div>
            <Button 
              variant="outline" 
              className="w-full justify-center h-10 font-medium text-[#1a1a1a] border-black/10 shadow-sm text-[13px] mt-auto" 
              onClick={() => setIsLeaveModalOpen(true)}
            >
              <Plane className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
              휴가 및 연차 신청
            </Button>
          </CardContent>
        </Card>

        {/* 3. 이번 주 근무 시간 */}
        <Card className="shadow-sm border-black/10 flex flex-col h-full bg-white">
          <CardHeader className="bg-[#fbfbfb] p-3 border-b border-black/5 shrink-0">
            <CardTitle className="text-[13px] font-bold flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              이번 주 근무 시간 요약
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex-1 flex flex-col justify-center">
            <div className="flex items-end justify-between mb-3">
              <div className="text-[24px] font-bold text-[#1a1a1a] leading-none">
                {weeklyHours}<span className="text-[14px] font-medium text-muted-foreground ml-0.5">h</span>{' '}
                {weeklyMins > 0 && <>{weeklyMins}<span className="text-[14px] font-medium text-muted-foreground ml-0.5">m</span></>}
              </div>
              <div className="text-[11px] text-muted-foreground font-medium mb-0.5">/ 40h (주정소정)</div>
            </div>
            
            <div className="w-full h-2.5 bg-black/5 rounded-full overflow-hidden mb-2">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-500 ease-out" 
                style={{ width: `${percentage}%` }}
              />
            </div>
            
            <p className="text-[11px] text-muted-foreground leading-snug mt-auto pt-2">
              이번 주 확정된 스케줄을 합산한 총 근무 시간입니다. 초과 근무 시 연장 수당이 발생할 수 있습니다.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 휴가 신청 모달 */}
      <Dialog open={isLeaveModalOpen} onOpenChange={setIsLeaveModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>휴가 및 연차 신청</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">휴가 종류</Label>
              <Select value={leaveDraft.leaveType} onValueChange={(v) => setLeaveDraft(prev => ({...prev, leaveType: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">연차 (1일)</SelectItem>
                  <SelectItem value="half_am">오전 반차 (0.5일)</SelectItem>
                  <SelectItem value="half_pm">오후 반차 (0.5일)</SelectItem>
                  <SelectItem value="sick">병가</SelectItem>
                  <SelectItem value="unpaid">무급휴가</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">시작일</Label>
                <Input type="date" value={leaveDraft.startDate} onChange={(e) => setLeaveDraft(prev => ({...prev, startDate: e.target.value}))} />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">종료일</Label>
                <Input type="date" value={leaveDraft.endDate} onChange={(e) => setLeaveDraft(prev => ({...prev, endDate: e.target.value}))} />
              </div>
            </div>
            
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">사유 작성</Label>
              <Textarea 
                placeholder="휴가 사유를 작성해주세요."
                value={leaveDraft.reason}
                onChange={(e) => setLeaveDraft(prev => ({...prev, reason: e.target.value}))}
                className="h-24 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLeaveModalOpen(false)}>취소</Button>
            <Button 
              className="bg-primary hover:bg-primary/90"
              disabled={leaveLoading || !leaveDraft.reason.trim()}
              onClick={handleLeaveSubmit}
            >
              {leaveLoading ? '처리 중...' : '신청하기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
