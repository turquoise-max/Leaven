'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LogIn, LogOut, CalendarPlus, Plane, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

export function DashboardRightPanel() {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="h-full w-[300px] flex flex-col gap-4">
      {/* 1. 출/퇴근 카드 */}
      <Card className="shadow-sm border-black/10 overflow-hidden">
        <CardHeader className="bg-[#fbfbfb] p-4 border-b border-black/5 pb-3">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span>근태 관리</span>
            <span className="text-xs font-medium text-muted-foreground">{format(currentTime, 'MM.dd (E)', { locale: ko })}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-5 flex flex-col items-center">
          <div className="text-3xl font-bold tracking-tight text-[#1a1a1a] tabular-nums mb-6">
            {format(currentTime, 'HH:mm:ss')}
          </div>
          
          <div className="grid grid-cols-2 gap-3 w-full">
            <Button className="bg-[#1a1a1a] hover:bg-black/80 text-white font-semibold h-11" variant="default" onClick={() => alert('출근 기능 준비 중')}>
              <LogIn className="w-4 h-4 mr-2" />
              출근하기
            </Button>
            <Button className="bg-white hover:bg-muted text-[#1a1a1a] border border-black/10 font-semibold h-11 shadow-sm" variant="outline" onClick={() => alert('퇴근 기능 준비 중')}>
              <LogOut className="w-4 h-4 mr-2" />
              퇴근하기
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 2. 휴가 및 연차 신청 */}
      <Card className="shadow-sm border-black/10">
        <CardContent className="p-4 flex flex-col gap-3">
          <h3 className="text-sm font-semibold mb-1">휴가 관리</h3>
          <Button variant="outline" className="w-full justify-start h-10 font-medium text-[#1a1a1a] border-black/10" onClick={() => alert('휴가 신청 모달 준비 중')}>
            <Plane className="w-4 h-4 mr-3 text-muted-foreground" />
            휴가 및 연차 신청
          </Button>
          <div className="text-xs text-muted-foreground px-1">
            잔여 연차: <span className="font-semibold text-[#1a1a1a]">12일</span>
          </div>
        </CardContent>
      </Card>

      {/* 3. 이번 주 근무 시간 */}
      <Card className="shadow-sm border-black/10">
        <CardHeader className="bg-[#fbfbfb] p-4 border-b border-black/5 pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4" />
            이번 주 근무 시간
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-end justify-between mb-2">
            <div className="text-2xl font-bold text-[#1a1a1a]">32h 30m</div>
            <div className="text-xs text-muted-foreground font-medium mb-1">/ 40h (주정소정)</div>
          </div>
          {/* Progress Bar (Mock) */}
          <div className="w-full h-2 bg-black/5 rounded-full overflow-hidden">
            <div className="h-full bg-primary w-[80%] rounded-full" />
          </div>
          <p className="text-xs text-muted-foreground mt-3 leading-snug">
            이번 주 예정된 스케줄을 포함한 총 근무 시간입니다.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}