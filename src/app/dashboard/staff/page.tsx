import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requirePermission } from '@/features/auth/permissions'
import { StaffList } from '@/features/staff/components/staff-list'
import { InviteStaffDialog } from '@/features/staff/components/invite-staff-dialog'
import { Button } from '@/components/ui/button'
import { UserPlus } from 'lucide-react'

export default async function StaffManagementPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 사용자의 매장 정보 조회
  const { data: member } = await supabase
    .from('store_members')
    .select('store_id')
    .eq('user_id', user.id)
    .single()

  if (!member) redirect('/onboarding')

  // 권한 체크
  try {
    await requirePermission(user.id, member.store_id, 'manage_staff')
  } catch (error) {
    return <div>접근 권한이 없습니다.</div>
  }

  // 직원 목록 조회 (Profile 정보 포함)
  const { data: staffList } = await supabase
    .from('store_members')
    .select(`
      id,
      role,
      status,
      joined_at,
      profile:profiles(full_name, email, avatar_url)
    `)
    .eq('store_id', member.store_id)
    .order('joined_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">직원 관리</h3>
          <p className="text-sm text-muted-foreground">
            매장의 직원을 초대하고 권한을 관리합니다.
          </p>
        </div>
        <InviteStaffDialog storeId={member.store_id}>
          <Button>
            <UserPlus className="mr-2 h-4 w-4" />
            직원 초대
          </Button>
        </InviteStaffDialog>
      </div>

      <StaffList initialData={staffList || []} storeId={member.store_id} />
    </div>
  )
}