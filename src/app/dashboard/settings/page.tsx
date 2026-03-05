import { createClient } from '@/lib/supabase/server'
import { StoreSettingsForm } from '@/features/store/components/store-settings-form'
import { RoleManagement } from '@/features/store/components/role-management'
import { getStoreRoles, getStorePermissions } from '@/features/store/roles'
import { cookies } from 'next/headers'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export const dynamic = 'force-dynamic'

export default async function StoreSettingsPage() {
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

  if (member?.role !== 'owner') {
    return <div>매장 설정 권한이 없습니다.</div>
  }

  // Fetch Roles and Permissions
  const roles = await getStoreRoles(store.id)
  const permissions = await getStorePermissions()
  
  // Check if migration is needed (if roles table exists but is empty, it might just be empty, 
  // but initial migration creates default roles, so empty means likely error or no migration)
  const isMigrationNeeded = roles.length === 0 && permissions.length > 0 ? false : (roles.length === 0 || permissions.length === 0)

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">매장 설정</h3>
        <p className="text-sm text-muted-foreground">
          매장의 기본 정보와 운영 설정을 관리합니다.
        </p>
      </div>
      
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">기본 설정</TabsTrigger>
          <TabsTrigger value="roles">역할 및 권한</TabsTrigger>
        </TabsList>
        
        <TabsContent value="general" className="max-w-2xl">
          <StoreSettingsForm initialData={store} />
        </TabsContent>
        
        <TabsContent value="roles">
          {isMigrationNeeded ? (
            <div className="p-6 border rounded-md bg-yellow-50 text-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-200">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                ⚠️ 데이터베이스 업데이트 필요
              </h4>
              <p className="text-sm mb-4">
                역할 및 권한 관리 기능을 사용하기 위해서는 데이터베이스 구조 업데이트가 필요합니다.
              </p>
              <div className="text-xs bg-black/5 dark:bg-white/10 p-3 rounded font-mono">
                supabase/migrations/20260304000000_add_role_permissions.sql
              </div>
              <p className="text-sm mt-4 text-muted-foreground">
                위 마이그레이션 파일을 실행하여 테이블을 생성해주세요.
              </p>
            </div>
          ) : (
            <RoleManagement 
              storeId={store.id} 
              roles={roles} 
              permissions={permissions} 
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}