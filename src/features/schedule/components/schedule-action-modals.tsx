import React from 'react'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteStaffSchedules } from '@/features/schedule/actions'

interface SingleDayDeleteModalProps {
  isOpen: boolean
  staffId: string
  staffName: string
  date: Date
  storeId: string
  onClose: () => void
}

export function SingleDayDeleteModal({
  isOpen,
  staffId,
  staffName,
  date,
  storeId,
  onClose
}: SingleDayDeleteModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="w-[360px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-4 border-b border-black/10 bg-[#fff5f5]">
          <DialogTitle className="text-[15px] font-semibold flex items-center gap-2 text-destructive">
            <Trash2 className="w-4 h-4" /> 하루 일정 비우기
          </DialogTitle>
        </DialogHeader>
        <div className="p-5 flex flex-col gap-1.5">
          <div className="text-[14px] text-[#1a1a1a] font-medium">
            {format(date, 'M월 d일')} <span className="text-primary">{staffName}</span>님의
          </div>
          <div className="text-[13px] text-[#6b6b6b] leading-relaxed">
            해당 일자 스케줄을 모두 삭제하시겠습니까?<br/>
            이 작업은 되돌릴 수 없습니다.
          </div>
        </div>
        <div className="px-5 py-4 border-t border-black/10 bg-[#fbfbfb] flex justify-end gap-2">
          <button 
            className="text-[12px] h-9 px-4 rounded-md border text-[#1a1a1a] font-medium hover:bg-muted/50 transition-colors"
            onClick={onClose}
          >
            취소
          </button>
          <button 
            className="text-[12px] h-9 px-4 rounded-md bg-destructive text-destructive-foreground font-medium hover:bg-destructive/90 transition-colors shadow-sm"
            onClick={async () => {
              const dateStr = format(date, 'yyyy-MM-dd')
              const res = await deleteStaffSchedules(storeId, dateStr, dateStr, [staffId])
              if (res.error) toast.error('삭제 실패')
              else {
                toast.success('해당 일자 스케줄이 삭제되었습니다.')
                window.location.reload()
              }
            }}
          >
            삭제하기
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface ConfirmMoveModalProps {
  isOpen: boolean
  scheduleId: string
  newStartUTC: string
  newEndUTC: string
  deltaMinutes: number
  onClose: () => void
  onConfirm: (moveTasks: boolean) => void
}

export function ConfirmMoveModal({
  isOpen,
  onClose,
  onConfirm
}: ConfirmMoveModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="w-[360px] p-5 gap-0">
        <DialogHeader className="mb-4 text-left">
          <DialogTitle className="text-[15px] font-semibold flex items-center gap-2">
            <span className="text-[18px]">🔄</span> 스케줄과 함께 업무도 이동할까요?
          </DialogTitle>
        </DialogHeader>
        <div className="text-[13px] text-muted-foreground mb-6 leading-relaxed bg-muted/30 p-3 rounded-md">
          이 스케줄에는 개별 시간이 지정된 업무가 포함되어 있습니다.<br/>
          스케줄 변경 시간에 맞춰 <strong>개별 업무 시간도 함께 이동</strong>하시겠습니까?
        </div>
        <div className="flex gap-2 w-full justify-end">
          <button 
            className="text-[12px] h-9 px-4 rounded-md border text-[#1a1a1a] font-medium hover:bg-muted/50 transition-colors"
            onClick={() => {
              onConfirm(false)
              onClose()
            }}
          >
            아니오 (스케줄만 변경)
          </button>
          <button 
            className="text-[12px] h-9 px-4 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-sm"
            onClick={() => {
              onConfirm(true)
              onClose()
            }}
          >
            예 (함께 이동)
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}