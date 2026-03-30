'use client'

import { useState } from 'react'
import { DashboardTaskList } from '@/features/schedule/components/dashboard-task-list'
import { StaffAnnouncementList } from '@/features/store/components/staff-announcement-list'
import { TaskAttendanceWidget } from '@/features/attendance/components/task-attendance-widget'

type Announcement = any

interface MyTasksClientWrapperProps {
  storeId: string
  roleId: string | null
  storeName: string
  currentUserId: string
  myStaffId: string
  announcements: Announcement[]
}

export function MyTasksClientWrapper({
  storeId,
  roleId,
  storeName,
  currentUserId,
  myStaffId,
  announcements
}: MyTasksClientWrapperProps) {
  const [attendanceStatus, setAttendanceStatus] = useState<'none' | 'working' | 'completed'>('none')

  return (
    <div className="flex flex-col gap-3 md:gap-6 h-full max-w-3xl mx-auto w-full pt-4 pb-8 overflow-y-auto">
      <div className="px-2 text-center md:text-left">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">오늘의 할 일</h1>
        <p className="hidden md:block text-muted-foreground text-sm mt-1">
          {storeName}에서 오늘 나에게 배정된 업무입니다.
        </p>
      </div>

      <div className="px-2">
        <TaskAttendanceWidget 
          storeId={storeId} 
          currentUserId={currentUserId} 
          myStaffId={myStaffId}
          onStatusChange={(status) => setAttendanceStatus(status)}
        />
      </div>

      {attendanceStatus === 'none' ? (
        <div className="px-2 py-8 flex items-center justify-center text-muted-foreground bg-slate-50/50 rounded-xl border border-dashed text-sm">
          출근 전입니다. 위에서 출근하기 버튼을 눌러 업무를 시작해주세요.
        </div>
      ) : (
        <>
          {announcements && announcements.length > 0 && (
            <div className="px-2">
              <StaffAnnouncementList announcements={announcements} />
            </div>
          )}

          <div className="flex-1 min-h-0 flex flex-col w-full relative h-[600px] sm:h-[800px]">
            {/* 전체화면 하단: 오늘의 타임라인 (시간 지정/미지정 업무) */}
            <DashboardTaskList storeId={storeId} roleId={roleId} attendanceStatus={attendanceStatus} currentUserId={currentUserId} />
          </div>
        </>
      )}
    </div>
  )
}