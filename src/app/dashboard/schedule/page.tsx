import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requirePermission } from '@/features/auth/permissions'
import { getStoreRoles } from '@/features/store/actions'
import { cookies } from 'next/headers'
import { UnifiedCalendar } from '@/features/schedule/components/unified-calendar'

export default async function UnifiedSchedulePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Get user's store
  const { data: members } = await supabase
    .from('store_members')
    .select('id, store_id, role, status, store:stores(opening_hours)')
    .eq('user_id', user.id)

  const cookieStore = await cookies()
  const selectedStoreId = cookieStore.get('leaven_current_store_id')?.value

  let member = members?.find(m => m.store_id === selectedStoreId)

  if (!member) {
    member = members?.find(m => m.status === 'active') || members?.[0]
  }

  if (!member) redirect('/onboarding')

  // Check permissions (reusing schedule viewing permission for now)
  try {
    await requirePermission(user.id, member.store_id, 'view_schedule')
  } catch (error) {
    return <div>접근 권한이 없습니다.</div>
  }

  // 관리자 권한 확인 (manage_schedule)
  let isManager = false
  try {
    await requirePermission(user.id, member.store_id, 'manage_schedule')
    isManager = true
  } catch (error) {
    isManager = false
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
      work_schedules,
      role_info:store_roles(id, name, color, priority)
    `)
    .eq('store_id', member.store_id)
    .neq('status', 'invited')

  const staffList = rawStaffList?.map((staff: any) => ({
    ...staff,
    role_info: Array.isArray(staff.role_info) ? staff.role_info[0] : staff.role_info,
  })) || []

  // 스케줄 데이터 및 연관 업무(체크리스트) 조회
  const { data: schedules } = await supabase
    .from('schedules')
    .select(`
      id,
      start_time,
      end_time,
      memo,
      title,
      color,
      schedule_type,
      schedule_members (
        member_id,
        member:store_members (name, user_id)
      ),
      tasks!schedule_id(
        id,
        title,
        description,
        status,
        checklist,
        start_time,
        end_time,
        task_type
      )
    `)
    .eq('store_id', member.store_id)

  // 승인된 휴가 데이터 조회
  const { data: approvedLeaves } = await supabase
    .from('leave_requests')
    .select('id, member_id, start_date, end_date, leave_type, reason')
    .eq('store_id', member.store_id)
    .eq('status', 'approved')

  return (
    <div className="flex flex-col h-full flex-1 overflow-hidden">
      {/* Header Area */}
      <div className="pt-4 pb-4 px-4 border-b flex flex-col justify-center items-center bg-white md:bg-transparent md:items-start md:flex-row md:justify-between md:p-0 md:border-none md:mb-6 shrink-0">
        <div className="text-center md:text-left w-full">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">스케줄 관리</h1>
          <p className="hidden md:block text-sm text-muted-foreground mt-1">
            근무와 업무를 통합하여 한눈에 관리합니다.
          </p>
        </div>
      </div>

      {/* Main 2-Column Layout Component */}
      <UnifiedCalendar
        storeId={member.store_id}
        roles={roles || []}
        staffList={staffList}
        schedules={schedules || []}
        storeOpeningHours={Array.isArray(member.store) ? member.store[0]?.opening_hours : (member.store as any)?.opening_hours}
        approvedLeaves={approvedLeaves || []}
        isManager={isManager}
        currentUserId={user.id}
      />
    </div>
  )
}