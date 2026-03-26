import { createClient } from '@/lib/supabase/server'
import { getStoreRoles, getStorePermissions } from '@/features/store/roles'
import { getTaskTemplates } from '@/features/schedule/task-actions'
import { cookies } from 'next/headers'
import { Card, CardContent } from '@/components/ui/card'
import { Lock } from 'lucide-react'
import { UnifiedRoleManagement } from '@/features/store/components/unified-role-management'
import { hasPermission } from '@/features/auth/permissions'

export const dynamic = 'force-dynamic'

export default async function RolesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // 사용자의 매장 정보 조회 (Store Member 테이블 조인)
  const { data: members } = await supabase
    .from('store_members')
    .select('role, status, store:stores(*)')
    .eq('user_id', user.id)

  // 쿠키에서 선택된 매장 ID 가져오기
  const cookieStore = await cookies()
  const selectedStoreId = cookieStore.get('leaven_current_store_id')?.value

  // 선택된 매장 찾기
  let member = members?.find(m => {
    const store = m.store as any
    return store?.id === selectedStoreId
  })

  // 없으면 활성 상태인 첫 번째 매장 선택
  if (!member) {
    member = members?.find(m => m.status === 'active') || members?.[0]
  }

  const storeData = member?.store as any
  const store = Array.isArray(storeData) ? storeData[0] : storeData

  if (!store) {
    return <div>매장 정보를 찾을 수 없습니다.</div>
  }

  const hasManageRolesPermission = await hasPermission(user.id, store.id, 'manage_roles')

  if (!hasManageRolesPermission && member?.role !== 'owner') {
    return (
      <div className="flex flex-col gap-6 h-[calc(100vh-4rem)]">
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">직급 및 권한 설정</h1>
            <p className="text-muted-foreground">
              매장의 직급 체계와 직원들이 볼 수 있는 메뉴, 기본 업무를 설정합니다.
            </p>
          </div>
        </div>

        <Card className="flex-1 flex flex-col items-center justify-center p-6 text-center shadow-none sm:shadow-sm">
          <CardContent className="flex flex-col items-center justify-center gap-4">
            <div className="rounded-full bg-muted p-4">
              <Lock className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">접근할 수 없습니다</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                직급 및 권한 관리는 해당 권한을 가진 사용자만 접근할 수 있는 메뉴입니다.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Fetch Roles, Permissions, and Task Templates
  const roles = await getStoreRoles(store.id)
  const permissions = await getStorePermissions()
  const taskTemplates = await getTaskTemplates(store.id)
  
  const isMigrationNeeded = roles.length === 0 && permissions.length > 0 ? false : (roles.length === 0 || permissions.length === 0)

  return (
    <div className="pb-10 pt-2 flex flex-col h-full min-h-[calc(100vh-6rem)]">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">직급 및 권한 설정</h1>
        <p className="text-muted-foreground mt-1">
          매장의 직급(매니저, 스태프 등)을 만들고, 직원들이 시스템에서 볼 수 있는 권한과 출근 시 확인해야 할 기본 업무를 설정합니다.
        </p>
      </div>

      {isMigrationNeeded ? (
        <div className="p-6 border rounded-xl bg-yellow-50 text-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-200">
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            ⚠️ 데이터베이스 업데이트 필요
          </h4>
          <p className="text-sm mb-4">
            역할 및 권한 관리 기능을 사용하기 위해서는 데이터베이스 구조 업데이트가 필요합니다.
          </p>
        </div>
      ) : (
        <div className="flex-1 bg-white border rounded-xl overflow-hidden shadow-sm">
          <UnifiedRoleManagement 
            storeId={store.id} 
            roles={roles} 
            permissions={permissions} 
            taskTemplates={taskTemplates}
          />
        </div>
      )}
    </div>
  )
}