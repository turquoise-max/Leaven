import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requirePermission } from '@/features/auth/permissions'
import { cookies } from 'next/headers'
import { getStoreRoles } from '@/features/store/actions'
import { LeaveClientPage } from './leave-client'

export default async function LeavePage() {
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

  // For now, let's assume basic staff view is allowed, and manager view is fully featured.
  let isManager = false
  try {
    await requirePermission(user.id, member.store_id, 'manage_schedule')
    isManager = true
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
      role_info:store_roles(id, name, color, priority)
    `)
    .eq('store_id', member.store_id)
    .neq('status', 'invited')

  const staffList = rawStaffList?.map((staff: any) => ({
    ...staff,
    role_info: Array.isArray(staff.role_info) ? staff.role_info[0] : staff.role_info,
  })) || []

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col space-y-4">
      {/* Header Area */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">휴가 및 연차</h1>
          <p className="text-muted-foreground">
            직원 휴가 신청을 관리하고 스케줄 누수를 방지합니다.
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <LeaveClientPage 
          storeId={member.store_id} 
          roles={roles || []} 
          staffList={staffList} 
          isManager={isManager}
          currentUserId={user.id}
        />
      </div>
    </div>
  )
}