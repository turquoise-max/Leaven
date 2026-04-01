'use client'

import { useState } from 'react'
import { DashboardTaskList } from '@/features/schedule/components/dashboard-task-list'
import { StaffAnnouncementList } from '@/features/store/components/staff-announcement-list'
import { TaskAttendanceWidget } from '@/features/attendance/components/task-attendance-widget'
import { cn } from '@/lib/utils'

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
    <div className={cn(
      "flex flex-col max-w-3xl mx-auto w-full pt-0 md:pt-4 overflow-x-hidden",
      attendanceStatus === 'none' 
        ? "h-full overflow-hidden" 
        : "gap-3 md:gap-6 h-full pb-8 overflow-y-auto"
    )}>
      <div className="pt-8 pb-4 px-4 border-b flex flex-col justify-center items-center bg-white md:bg-transparent md:items-start md:flex-row md:justify-between -mx-4 -mt-4 shrink-0 md:m-0 md:p-0 md:border-none md:mb-6">
        <div className="text-center md:text-left w-full">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">오늘의 할 일</h1>
          <p className="hidden md:block text-sm text-muted-foreground mt-1">
            {storeName}에서 오늘 나에게 배정된 업무입니다.
          </p>
        </div>
      </div>

      {attendanceStatus === 'none' ? (
        <div className="flex-1 flex flex-col px-4 pb-4 md:pb-6 min-h-0">
          <div className="w-full flex-1 min-h-0 flex flex-col">
            <TaskAttendanceWidget 
              storeId={storeId} 
              currentUserId={currentUserId} 
              myStaffId={myStaffId}
              onStatusChange={(status) => setAttendanceStatus(status)}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="px-2 flex flex-row items-center gap-2 mb-4 md:mb-6 h-[72px] md:h-auto md:block">
            <div className="flex-1 min-w-0 h-full md:h-auto md:mb-6">
              <TaskAttendanceWidget 
                storeId={storeId} 
                currentUserId={currentUserId} 
                myStaffId={myStaffId}
                onStatusChange={(status) => setAttendanceStatus(status)}
              />
            </div>
            
            {announcements && announcements.length > 0 && (
              <div className="shrink-0 h-full md:h-auto flex items-center md:block md:w-full">
                <StaffAnnouncementList announcements={announcements} />
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 flex flex-col w-full relative h-[600px] sm:h-[800px] px-2 md:px-0">
            {/* 전체화면 하단: 오늘의 타임라인 (시간 지정/미지정 업무) */}
            <DashboardTaskList storeId={storeId} roleId={roleId} attendanceStatus={attendanceStatus} currentUserId={currentUserId} />
          </div>
        </>
      )}
    </div>
  )
}
