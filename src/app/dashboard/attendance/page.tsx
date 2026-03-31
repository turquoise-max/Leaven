import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requirePermission } from '@/features/auth/permissions'
import { getStoreRoles } from '@/features/store/actions'
import { cookies } from 'next/headers'
import { AttendanceClientPage } from '@/features/attendance/components/attendance-client'
import { getTodayDateString } from '@/shared/lib/date-utils'

export default async function AttendancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Get user's store
  const { data: members } = await supabase
    .from('store_members')
    .select('store_id, role, status')
    .eq('user_id', user.id)

  const cookieStore = await cookies()
  const selectedStoreId = cookieStore.get('leaven_current_store_id')?.value

  let member = members?.find(m => m.store_id === selectedStoreId)

  if (!member) {
    member = members?.find(m => m.status === 'active') || members?.[0]
  }

  if (!member) redirect('/onboarding')

  // Check permissions (using view_schedule as proxy for attendance view, manage_schedule for full manage)
  let isManager = false
  try {
    await requirePermission(user.id, member.store_id, 'manage_schedule')
    isManager = true
  } catch (error) {
    try {
      await requirePermission(user.id, member.store_id, 'view_schedule')
    } catch (e) {
      return <div>접근 권한이 없습니다.</div>
    }
  }

  const roles = await getStoreRoles(member.store_id)
  
  // 직원 목록 조회
  const { data: rawStaffList } = await supabase
    .from('store_members')
    .select(`
      id,
      user_id,
      role,
      name,
      role_info:store_roles(id, name, color, priority)
    `)
    .eq('store_id', member.store_id)
    .neq('status', 'invited')

  const staffList = rawStaffList?.map((staff: any) => ({
    ...staff,
    role_info: Array.isArray(staff.role_info) ? staff.role_info[0] : staff.role_info,
  })) || []

  // 오늘 날짜 출퇴근 기록 조회
  const today = getTodayDateString()

  return (
    <div className="h-[calc(100vh-140px)] md:h-[calc(100vh-100px)] flex flex-col space-y-2 md:space-y-4 overflow-x-hidden">
      {/* Header Area */}
      <div className="pt-8 pb-4 px-4 border-b flex flex-col justify-center items-center bg-white md:bg-transparent md:items-start md:flex-row md:justify-between -mx-4 -mt-4 mb-0 md:m-0 md:p-0 md:border-none md:mb-6">
        <div className="text-center md:text-left w-full">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">출퇴근 관리</h1>
          <p className="text-sm text-muted-foreground hidden md:block mt-1">
            실시간 직원 근무 현황과 출퇴근 기록을 확인합니다.
          </p>
        </div>
      </div>

      {/* Main Layout Component */}
      <div className="flex-1 min-h-0">
        <AttendanceClientPage 
          storeId={member.store_id} 
          roles={roles || []} 
          staffList={staffList} 
          isManager={isManager}
          currentUserId={user.id}
          initialDate={today}
        />
      </div>
    </div>
  )
}