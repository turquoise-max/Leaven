'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PlayCircle, StopCircle, Clock, CheckCircle2, AlertCircle } from 'lucide-react'
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
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [attendance, setAttendance] = useState<any>(null)
  const [confirmCheckoutOpen, setConfirmCheckoutOpen] = useState(false)
  const [resultPopup, setResultPopup] = useState<{
    open: boolean;
    type: 'success' | 'error';
    title: string;
    message: string;
  }>({ open: false, type: 'success', title: '', message: '' })

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
        setResultPopup({
          open: true,
          type: 'error',
          title: '출근 실패',
          message: '직원 정보를 찾을 수 없습니다.'
        })
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
          setResultPopup({
            open: true,
            type: 'error',
            title: '위치 정보 접근 거부됨',
            message: '위치 정보 접근 권한이 필요합니다. 브라우저 설정에서 위치 권한을 허용해주세요.'
          });
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
        setResultPopup({
          open: true,
          type: 'error',
          title: action === 'in' ? '출근 실패' : '퇴근 실패',
          message: res.error
        })
      } else {
        setResultPopup({
          open: true,
          type: 'success',
          title: action === 'in' ? '출근 완료' : '퇴근 완료',
          message: action === 'in' ? '오늘 하루도 화이팅하세요!' : '오늘 하루도 수고하셨습니다!'
        })
        await fetchData()
        router.refresh()
      }
    } catch (err) {
      setResultPopup({
        open: true,
        type: 'error',
        title: '오류 발생',
        message: '요청을 처리하는 중 문제가 발생했습니다.'
      })
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

  const renderPopupContent = () => (
    <>
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

      <AlertDialog open={resultPopup.open} onOpenChange={(open) => setResultPopup(prev => ({ ...prev, open }))}>
        <AlertDialogContent className="w-[90vw] max-w-md rounded-2xl">
          <AlertDialogHeader className="flex flex-col items-center justify-center gap-2">
            {resultPopup.type === 'success' ? (
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-2" />
            ) : (
              <AlertCircle className="w-16 h-16 text-destructive mb-2" />
            )}
            <AlertDialogTitle className="text-xl">{resultPopup.title}</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-base whitespace-pre-wrap">
              {resultPopup.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center mt-4">
            <AlertDialogAction 
              onClick={() => setResultPopup(prev => ({ ...prev, open: false }))}
              className="w-full sm:w-32"
            >
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )

  if (myStatus === 'none') {
    return (
      <>
        <div className="flex flex-col items-center justify-center gap-4 md:gap-8 bg-white rounded-xl border shadow-sm py-8 md:py-20 w-full h-full min-h-0 flex-1">
          <Button 
            size="lg" 
            className="w-36 h-36 md:w-48 md:h-48 rounded-full text-xl md:text-2xl font-bold shadow-xl flex flex-col gap-2 md:gap-4 bg-[#1D9E75] hover:bg-[#1D9E75]/90 hover:scale-105 transition-all shrink-0"
            disabled={actionLoading || !myStaffId}
            onClick={() => handleAction('in')}
          >
            <PlayCircle className="w-12 h-12 md:w-16 md:h-16" />
            출근하기
          </Button>
          <p className="text-muted-foreground text-sm md:text-base shrink-0 text-center">
            출근 전입니다.<br />버튼을 눌러 업무를 시작하세요
          </p>
        </div>
        {renderPopupContent()}
      </>
    )
  }

  return (
    <>
      <div className="flex flex-col bg-white rounded-xl border shadow-sm p-3 md:p-4 w-full h-full md:h-auto justify-center">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <div>
              <div className="flex items-center gap-2">
                {myStatus === 'completed' ? (
                  <>
                    <span className="font-semibold text-sm text-slate-500">근무 종료</span>
                    <Badge variant="secondary" className="bg-slate-100 text-slate-500 border border-slate-200 text-[10px] px-1.5 py-0">OFF</Badge>
                  </>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    <span className="font-bold text-sm text-emerald-600">현재 근무 중</span>
                  </div>
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

      {renderPopupContent()}
    </>
  )
}
