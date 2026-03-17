'use client'

import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { createSchedule } from '@/features/schedule/actions'
import { useRouter } from 'next/navigation'

interface ScheduleCreateDialogProps {
  storeId: string
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  createForm: {
    title: string
    date: string
    startTime: string
    endTime: string
    staffId: string
  }
  setCreateForm: (form: any) => void
  staffList: any[]
  checkOverlap: (staffId: string, start: Date, end: Date) => boolean
  setLocalSchedules: React.Dispatch<React.SetStateAction<any[]>>
}

export function ScheduleCreateDialog({
  storeId,
  isOpen,
  setIsOpen,
  createForm,
  setCreateForm,
  staffList,
  checkOverlap,
  setLocalSchedules
}: ScheduleCreateDialogProps) {
  const router = useRouter()
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-[16px]">스케줄 추가</DialogTitle>
        </DialogHeader>
        <div className="py-3 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-[#1a1a1a]">직원</label>
            <Select value={createForm.staffId} onValueChange={(val) => setCreateForm({...createForm, staffId: val})}>
              <SelectTrigger className="text-[12px] h-9">
                <SelectValue placeholder="직원 선택" />
              </SelectTrigger>
              <SelectContent>
                {staffList.map(s => <SelectItem key={s.id} value={s.id} className="text-[12px]">{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-[#1a1a1a]">날짜</label>
            <Input 
              type="date" 
              className="text-[12px] h-9" 
              value={createForm.date} 
              onChange={(e) => setCreateForm({...createForm, date: e.target.value})} 
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-[#1a1a1a]">시작 시간</label>
              <Input 
                type="time" 
                className="text-[12px] h-9" 
                value={createForm.startTime} 
                onChange={(e) => setCreateForm({...createForm, startTime: e.target.value})} 
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-[#1a1a1a]">종료 시간</label>
              <Input 
                type="time" 
                className="text-[12px] h-9" 
                value={createForm.endTime} 
                onChange={(e) => setCreateForm({...createForm, endTime: e.target.value})} 
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-[#1a1a1a]">일정 제목 (선택)</label>
            <Input 
              placeholder="예: 오전 근무, 청소 담당 등" 
              className="text-[12px] h-9" 
              value={createForm.title} 
              onChange={(e) => setCreateForm({...createForm, title: e.target.value})} 
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-black/10 mt-2">
          <button 
            className="px-4 py-2 text-[12px] font-medium border border-black/10 rounded-md hover:bg-muted/50 transition-colors" 
            onClick={() => setIsOpen(false)}
          >
            취소
          </button>
          <button 
            className="px-4 py-2 text-[12px] font-medium bg-[#1a1a1a] text-white rounded-md hover:bg-black/80 transition-colors shadow-sm" 
            onClick={async () => {
              if (!createForm.staffId || !createForm.startTime || !createForm.endTime || !createForm.date) {
                toast.error('직원, 날짜, 시간을 모두 입력해주세요.')
                return
              }
              
              const startStr = `${createForm.date}T${createForm.startTime}:00`
              const endStr = `${createForm.date}T${createForm.endTime}:00`
              
              if (checkOverlap(createForm.staffId, new Date(startStr), new Date(endStr))) {
                toast.error('해당 시간대에 이미 스케줄이 존재합니다.')
                return
              }

              // API Call
              const formData = new FormData()
              formData.append('userIds', JSON.stringify([createForm.staffId]))
              formData.append('date', createForm.date)
              formData.append('startTime', createForm.startTime)
              formData.append('endTime', createForm.endTime)
              formData.append('title', createForm.title || '')

              const res = await createSchedule(storeId, formData)
              if (res.error) {
                toast.error(res.error)
                return
              }

              // Optimistic UI Update
              const newSchedule = {
                id: `temp-${Date.now()}`,
                start_time: startStr,
                end_time: endStr,
                title: createForm.title || '',
                schedule_members: [{ member_id: createForm.staffId }],
                task_assignments: []
              }
              
              setLocalSchedules(prev => [...prev, newSchedule])
              toast.success('스케줄이 추가되었습니다.')
              setIsOpen(false)
              router.refresh()
            }}
          >
            추가하기
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}