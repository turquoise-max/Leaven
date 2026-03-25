import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { hasPermission } from '@/features/auth/permissions'
import { StaffList } from '@/features/staff/components/staff-list'
import { cookies } from 'next/headers'
import { StoreCodeDisplay } from '@/features/store/components/store-code-display'
import { getStaffList } from '@/features/staff/actions'

export const dynamic = 'force-dynamic'

export default async function StaffManagementPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 사용자의 매장 정보 조회
  const { data: members } = await supabase
    .from('store_members')
    .select('store_id, role, status, store:stores(invite_code)')
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
  // 일반 직원도 목록은 볼 수 있게 허용하되, canManage 값으로 컴포넌트 내부 기능을 제한함
  const canManage = await hasPermission(user.id, member.store_id, 'manage_staff')
  const store = member.store as any

  // 직원 목록 조회
  const staffList = await getStaffList(member.store_id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold tracking-tight">직원 관리</h3>
          <p className="text-sm text-muted-foreground mt-1">
            매장의 직원을 초대하고 근로 조건을 관리합니다.
          </p>
        </div>
      </div>

      <StaffList 
        initialData={staffList || []} 
        storeId={member.store_id} 
        canManage={canManage}
        inviteCode={store?.invite_code}
      />
    </div>
  )
}
