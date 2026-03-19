'use client'

import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { createSchedule } from '@/features/schedule/actions'
import { useRouter } from 'next/navigation'
import { CalendarPlus } from 'lucide-react'

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
      <DialogContent className="sm:max-w-[420px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-4 border-b border-black/10 bg-[#fbfbfb]">
          <DialogTitle className="text-[16px] flex items-center gap-2">
            <CalendarPlus className="w-4 h-4 text-[#1a1a1a]" />
            스케줄 직접 추가
          </DialogTitle>
          <div className="text-[12px] text-[#6b6b6b] mt-1.5 font-normal">
            원하는 날짜와 시간을 지정하여 새로운 단일 스케줄을 추가합니다.
          </div>
        </DialogHeader>
        
        <div className="p-5 flex flex-col gap-5">
          <div className="flex flex-col gap-2.5">
            <label className="text-[12px] font-semibold text-[#1a1a1a]">대상 직원</label>
            <Select value={createForm.staffId} onValueChange={(val) => setCreateForm({...createForm, staffId: val})}>
              <SelectTrigger className="text-[12px] h-9">
                <SelectValue placeholder="직원을 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {staffList.map(s => <SelectItem key={s.id} value={s.id} className="text-[12px]">{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex flex-col gap-2.5">
            <label className="text-[12px] font-semibold text-[#1a1a1a]">날짜</label>
            <Input 
              type="date" 
              className="text-[12px] h-9 bg-white" 
              value={createForm.date} 
              onChange={(e) => setCreateForm({...createForm, date: e.target.value})} 
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2.5">
              <label className="text-[12px] font-semibold text-[#1a1a1a]">시작 시간</label>
              <Input 
                type="time" 
                className="text-[12px] h-9 bg-white" 
                value={createForm.startTime} 
                onChange={(e) => setCreateForm({...createForm, startTime: e.target.value})} 
              />
            </div>
            <div className="flex flex-col gap-2.5">
              <label className="text-[12px] font-semibold text-[#1a1a1a]">종료 시간</label>
              <Input 
                type="time" 
                className="text-[12px] h-9 bg-white" 
                value={createForm.endTime} 
                onChange={(e) => setCreateForm({...createForm, endTime: e.target.value})} 
              />
            </div>
          </div>
          
          <div className="flex flex-col gap-2.5">
            <label className="text-[12px] font-semibold text-[#1a1a1a]">근무 유형</label>
            <div className="flex gap-2 flex-wrap">
              {['정규 근무', '대체 근무', '연장 근무', '교육/기타'].map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`px-3 py-1.5 text-[11px] font-medium rounded-md border transition-colors ${
                    createForm.title === type
                      ? 'bg-[#1a1a1a] text-white border-[#1a1a1a] shadow-sm'
                      : 'bg-white text-[#6b6b6b] border-black/10 hover:bg-[#f3f2ef]'
                  }`}
                  onClick={() => setCreateForm({...createForm, title: createForm.title === type ? '' : type})}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <div className="px-5 py-4 border-t border-black/10 bg-[#fbfbfb] flex justify-end gap-2">
          <button 
            className="px-4 py-2 text-[12px] font-medium border border-black/10 rounded-md hover:bg-black/5 transition-colors" 
            onClick={() => setIsOpen(false)}
          >
            취소
          </button>
          <button 
            className="px-5 py-2 text-[12px] font-medium bg-[#1a1a1a] text-white rounded-md hover:bg-black/80 transition-colors shadow-sm flex items-center gap-1.5" 
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