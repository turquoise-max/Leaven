import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requirePermission } from '@/features/auth/permissions'
import { ScheduleCalendar } from '@/features/schedule/components/schedule-calendar'
import { cookies } from 'next/headers'

export default async function SchedulePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 사용자의 매장 정보 조회
  const { data: members } = await supabase
    .from('store_members')
    .select('store_id, role, status, store:stores(opening_hours)')
    .eq('user_id', user.id)

  // 쿠키에서 선택된 매장 ID 가져오기
  const cookieStore = await cookies()
  const selectedStoreId = cookieStore.get('leaven_current_store_id')?.value

  // 선택된 매장 찾기
  let member = members?.find(m => m.store_id === selectedStoreId)

  // 없으면 활성 상태인 첫 번째 매장 선택
  if (!member) {
    member = members?.find(m => m.status === 'active') || members?.[0]
  }

  if (!member) redirect('/onboarding')

  // 권한 체크
  try {
    await requirePermission(user.id, member.store_id, 'view_schedule')
  } catch (error) {
    return <div>접근 권한이 없습니다.</div>
  }

  // 매장의 스케줄 데이터 조회 (초기 데이터)
  // TODO: 날짜 범위 필터링 필요 (현재는 전체 조회)
  const { data: schedules, error: schedulesError } = await supabase
    .from('schedules')
    .select(`
      id,
      start_time,
      end_time,
      memo,
      title,
      color,
      schedule_members (
        user_id,
        profile:profiles (full_name, email)
      ),
      task_assignments(
        id,
        task:tasks(title)
      )
    `)
    .eq('store_id', member.store_id)

  if (schedulesError) {
    console.error('[SchedulePage] Error fetching schedules:', schedulesError)
  } else {
    console.log(`[SchedulePage] Fetched ${schedules?.length || 0} schedules for store ${member.store_id}`)
    if (schedules && schedules.length > 0) {
      console.log('[SchedulePage] First schedule:', schedules[0])
    }
  }

  // 매장의 직원 목록 조회 (스케줄 할당용)
  const { data: rawStaffList } = await supabase
    .from('store_members')
    .select(`
      user_id,
      role,
      profile:profiles(id, full_name, email),
      role_info:store_roles(id, name, color, priority)
    `)
    .eq('store_id', member.store_id)
    .neq('status', 'invited') // 초대중인 멤버 제외

  const staffList = rawStaffList?.map((staff: any) => ({
    ...staff,
    role_info: Array.isArray(staff.role_info) ? staff.role_info[0] : staff.role_info
  }))

  // 권한 정보 (매니저 이상만 편집 가능)
  const canManage = member.role === 'owner' || member.role === 'manager'
  const store = member.store as any
  const openingHours = store?.opening_hours || {}

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">근무 일정</h3>
          <p className="text-sm text-muted-foreground">
            매장 직원들의 근무 스케줄을 관리합니다.
          </p>
        </div>
      </div>

      <div className="flex-1 border rounded-md p-4 bg-background">
        <ScheduleCalendar 
          initialEvents={schedules || []} 
          staffList={staffList || []}
          canManage={canManage}
          storeId={member.store_id}
          openingHours={openingHours}
        />
      </div>
    </div>
  )
}