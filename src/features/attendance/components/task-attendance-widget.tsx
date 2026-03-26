'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PlayCircle, StopCircle, Clock, CheckCircle2 } from 'lucide-react'
import { getDailyAttendanceOverview, clockIn, clockOut } from '@/features/attendance/actions'
import { toast } from 'sonner'
import { toKSTISOString } from '@/shared/lib/date-utils'
import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface TaskAttendanceWidgetProps {
  storeId: string
  currentUserId: string
  myStaffId: string
  onStatusChange?: (status: 'none' | 'working' | 'completed') => void
}

export function TaskAttendanceWidget({ storeId, currentUserId, myStaffId, onStatusChange }: TaskAttendanceWidgetProps) {
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [attendance, setAttendance] = useState<any>(null)
  const [confirmCheckoutOpen, setConfirmCheckoutOpen] = useState(false)

  const todayDate = format(new Date(), 'yyyy-MM-dd')

  const fetchData = async () => {
    try {
      const res = await getDailyAttendanceOverview(storeId, todayDate, Date.now())
      
      const myRecord = res.attendance?.find(a => a.member_id === myStaffId)
      
      if (myRecord) {
        setAttendance(myRecord)
        if (onStatusChange) onStatusChange(myRecord.status)
      } else {
        setAttendance(null)
        if (onStatusChange) onStatusChange('none')
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, currentUserId])

  const myStatus = attendance?.status || 'none'

  const formatTime = (isoString?: string | null) => {
    if (!isoString) return '-'
    return format(new Date(isoString), 'HH:mm')
  }

  const handleAction = async (action: 'in' | 'out') => {
    if (!myStaffId && action === 'in') {
        toast.error('직원 정보를 찾을 수 없습니다.')
        return
    }
    
    setActionLoading(true)
    
    try {
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
          setActionLoading(false);
          return;
        }
      }

      let res: any = { error: 'Unknown action' }
      if (action === 'in' && myStaffId) {
        res = await clockIn(storeId, myStaffId, todayDate, undefined, locationData)
      } else if (action === 'out' && attendance?.id) {
        res = await clockOut(attendance.id, storeId, locationData)
      }
      
      if (res?.error) {
        toast.error(res.error)
      } else {
        toast.success(action === 'in' ? '출근 처리되었습니다.' : '퇴근 처리되었습니다.')
        await fetchData()
      }
    } catch (err) {
      toast.error('오류가 발생했습니다.')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 bg-white rounded-xl border shadow-sm">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (myStatus === 'none') {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-12 bg-white rounded-xl border shadow-sm">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">오늘의 업무를 시작해볼까요?</h2>
          <p className="text-muted-foreground text-sm">출근 버튼을 누르면 업무가 시작됩니다.</p>
        </div>
        
        <Button 
          size="lg" 
          className="w-40 h-40 rounded-full text-xl shadow-lg flex flex-col gap-3 bg-[#1D9E75] hover:bg-[#1D9E75]/90 hover:scale-105 transition-all"
          disabled={actionLoading || !myStaffId}
          onClick={() => handleAction('in')}
        >
          <PlayCircle className="w-12 h-12" />
          출근하기
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col bg-white rounded-xl border shadow-sm p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 text-primary rounded-full">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                {myStatus === 'completed' ? (
                  <>
                    <span className="font-semibold text-sm">근무 종료</span>
                    <Badge variant="secondary" className="bg-slate-100 text-slate-500 border border-slate-200 text-[10px] px-1.5 py-0">OFF</Badge>
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-sm">현재 근무 중</span>
                    <Badge className="bg-primary/10 text-primary border border-primary/20 animate-pulse text-[10px] px-1.5 py-0">ON</Badge>
                  </>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 flex gap-2">
                <span>출근: <span className="font-medium text-foreground">{formatTime(attendance?.clock_in_time)}</span></span>
                {myStatus === 'completed' && (
                  <span>퇴근: <span className="font-medium text-foreground">{formatTime(attendance?.clock_out_time)}</span></span>
                )}
              </div>
            </div>
          </div>
          
          {myStatus === 'working' && (
            <Button 
              variant="outline" 
              size="sm"
              className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
              disabled={actionLoading}
              onClick={() => setConfirmCheckoutOpen(true)}
            >
              <StopCircle className="w-4 h-4" />
              퇴근하기
            </Button>
          )}

          {myStatus === 'completed' && (
             <div className="text-xs font-semibold flex items-center gap-1 text-slate-500 bg-slate-50 px-2 py-1 rounded-md border">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                수고하셨습니다
             </div>
          )}
        </div>
      </div>

      <AlertDialog open={confirmCheckoutOpen} onOpenChange={setConfirmCheckoutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>퇴근하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              오늘 예정된 업무를 모두 완료하셨는지 한 번 더 확인해주세요. <br/>
              퇴근 처리 후에는 오늘의 타임라인에 더 이상 접근할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                setConfirmCheckoutOpen(false)
                handleAction('out')
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              네, 퇴근합니다
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
