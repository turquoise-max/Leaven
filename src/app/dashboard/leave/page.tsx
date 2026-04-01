import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requirePermission } from '@/features/auth/permissions'
import { cookies } from 'next/headers'
import { getStoreRoles } from '@/features/store/actions'
import { getStaffList } from '@/features/staff/actions'
import { LeaveClientPage } from '@/features/leave/components/leave-client'

export default async function LeavePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Get user's store
  const { data: members } = await supabase
    .from('store_members')
    .select('store_id, role, status, store:stores(leave_calc_type)')
    .eq('user_id', user.id)

  const cookieStore = await cookies()
  const selectedStoreId = cookieStore.get('leaven_current_store_id')?.value

  let member = members?.find(m => m.store_id === selectedStoreId)

  if (!member) {
    member = members?.find(m => m.status === 'active') || members?.[0]
  }

  if (!member) redirect('/onboarding')

  // For now, let's assume basic staff view is allowed, and manager view is fully featured.
  let isManager = false
  try {
    await requirePermission(user.id, member.store_id, 'manage_schedule')
    isManager = true
  } catch (error) {}

  const roles = await getStoreRoles(member.store_id)
  
  // 직원 목록 조회 (getStaffList 액션을 사용하여 프로필 정보까지 한꺼번에 가져옴)
  const allStaff = await getStaffList(member.store_id)
  
  // 가입 대기, 재직, 퇴사자 모두 포함 (단, 초대 중인 경우 및 점주 제외)
  const staffList = allStaff.filter(s => s.status !== 'invited' && s.role !== 'owner')

  const storeObj = Array.isArray(member.store) ? member.store[0] : member.store
  const leaveCalcType = storeObj?.leave_calc_type || 'hire_date'

  return (
    <div className="flex flex-col h-full overflow-hidden w-full max-w-full">
      {/* Header Area */}
      <div className="pt-4 pb-4 px-4 border-b flex flex-col justify-center items-center bg-white shrink-0 z-10 md:bg-transparent md:items-start md:flex-row md:justify-between md:p-0 md:border-none md:mb-6">
        <div className="text-center md:text-left w-full">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">휴가 및 연차</h1>
          <p className="text-sm text-muted-foreground hidden md:block mt-1">
            직원 휴가 신청을 관리하고 스케줄 누수를 방지합니다.
          </p>
        </div>
        {/* The Plus button will be rendered by LeaveClientPage via absolute positioning to this relative container's level */}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden w-full max-w-full relative flex flex-col pt-0 md:pt-4">
        <LeaveClientPage 
          storeId={member.store_id} 
          roles={roles || []} 
          staffList={staffList} 
          isManager={isManager}
          currentUserId={user.id}
          leaveCalcType={leaveCalcType}
        />
      </div>
    </div>
  )
}