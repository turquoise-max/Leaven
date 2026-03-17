import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requirePermission } from '@/features/auth/permissions'
import { getStoreRoles } from '@/features/store/actions'
import { cookies } from 'next/headers'
import { UnifiedCalendar } from '@/features/unified-schedule/components/unified-calendar'

export default async function UnifiedSchedulePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Get user's store
  const { data: members } = await supabase
    .from('store_members')
    .select('store_id, role, status, store:stores(opening_hours)')
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

  const canManage = member.role === 'owner' || member.role === 'manager'
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
      schedule_members (
        member_id,
        member:store_members (name, user_id)
      ),
      task_assignments(
        id,
        start_time,
        end_time,
        task:tasks(id, title, description, status, checklist)
      )
    `)
    .eq('store_id', member.store_id)

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col space-y-4">
      {/* Header Area */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">스케줄 관리</h1>
          <p className="text-muted-foreground">
            근무와 업무를 통합하여 한눈에 관리합니다.
          </p>
        </div>
      </div>

      {/* Main 2-Column Layout Component */}
      <UnifiedCalendar storeId={member.store_id} roles={roles || []} staffList={staffList} schedules={schedules || []} />
    </div>
  )
}
