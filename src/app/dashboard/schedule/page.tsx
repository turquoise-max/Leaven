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

  let canManage = false
  try {
    await requirePermission(user.id, member.store_id, 'manage_schedule')
    canManage = true
  } catch (error) {}

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
      task_assignments(
        id,
        start_time,
        end_time,
        task:tasks(id, title, description, status, checklist)
      )
    `)
    .eq('store_id', member.store_id)

  const mySchedules = (schedules || []).filter((sch: any) => 
    sch.schedule_members?.some((sm: any) => sm.member_id === member.id)
  )

  // Sort by start_time
  mySchedules.sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

  const staffView = (
    <div className={`flex flex-col h-full bg-white rounded-xl border shadow-sm p-6 overflow-auto ${canManage ? 'lg:hidden' : ''}`}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">나의 스케줄</h1>
        <p className="text-muted-foreground mt-1">
          나와 관련된 근무 일정을 확인합니다.
        </p>
      </div>
      
      {mySchedules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-slate-50 rounded-xl border border-dashed">
          <p>배정된 스케줄이 없습니다.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {mySchedules.map((sch: any) => {
            const start = new Date(sch.start_time)
            const end = new Date(sch.end_time)
            const dateStr = `${start.getMonth() + 1}월 ${start.getDate()}일`
            const timeStr = `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')} ~ ${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`

            return (
              <div key={sch.id} className="flex flex-col p-4 rounded-xl border bg-card hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-2 h-10 rounded-full" style={{ backgroundColor: sch.color || '#1D9E75' }} />
                  <div>
                    <h3 className="font-bold text-lg">{dateStr}</h3>
                    <p className="font-semibold text-primary">{timeStr}</p>
                  </div>
                </div>
                <div className="pl-5 ml-1 border-l-2 border-border/50">
                  <p className="text-sm font-medium">{sch.title || '기본 스케줄'}</p>
                  {sch.memo && <p className="text-sm text-muted-foreground mt-1">{sch.memo}</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  const managerView = canManage ? (
    <div className="hidden lg:flex flex-col h-[calc(100vh-100px)] space-y-4">
      {/* Header Area */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">스케줄 관리</h1>
          <p className="text-muted-foreground">
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
      />
    </div>
  ) : null

  return (
    <>
      {staffView}
      {managerView}
    </>
  )
}
