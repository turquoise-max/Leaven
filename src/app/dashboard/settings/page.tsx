import { createClient } from '@/lib/supabase/server'
import { StoreSettingsForm } from '@/features/store/components/store-settings-form'
import { RoleManagement } from '@/features/store/components/role-management'
import { getStoreRoles, getStorePermissions } from '@/features/store/roles'
import { cookies } from 'next/headers'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Lock } from 'lucide-react'

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
    return (
      <div className="flex flex-col gap-6 h-[calc(100vh-4rem)]">
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">매장 설정</h1>
            <p className="text-muted-foreground">
              매장의 기본 정보와 운영 설정을 관리합니다.
            </p>
          </div>
        </div>

        <Card className="flex-1 flex flex-col items-center justify-center p-6 text-center shadow-none sm:shadow-sm">
          <CardContent className="flex flex-col items-center justify-center gap-4">
            <div className="rounded-full bg-muted p-4">
              <Lock className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">매장 설정 권한이 없습니다</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                매장의 기본 정보 및 설정 관리는 점주(Owner)만 접근할 수 있습니다. 
                설정 변경이 필요하시다면 점주에게 문의해 주세요.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
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