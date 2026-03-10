import { createClient } from '@/lib/supabase/server'
import { StoreSettingsForm } from '@/features/store/components/store-settings-form'
import { RoleManagement } from '@/features/store/components/role-management'
import { getStoreRoles, getStorePermissions } from '@/features/store/roles'
import { cookies } from 'next/headers'
import { Card, CardContent } from '@/components/ui/card'
import { Lock, Settings, Users } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

interface SettingsPageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function StoreSettingsPage({ searchParams }: SettingsPageProps) {
  const resolvedSearchParams = await searchParams
  const currentTab = resolvedSearchParams?.tab || 'general'

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

  const navItems = [
    {
      id: 'general',
      title: '기본 설정',
      description: '매장 정보 및 영업 시간',
      icon: Settings,
    },
    {
      id: 'roles',
      title: '역할 및 권한',
      description: '직원 그룹 및 접근 제어',
      icon: Users,
    },
  ]

  return (
    <div className="pb-10 pt-2">
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
        {/* Left Sidebar Navigation */}
        <aside className="lg:w-1/4 shrink-0">
          <nav className="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = currentTab === item.id
              
              return (
                <Link
                  key={item.id}
                  href={`?tab=${item.id}`}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap lg:whitespace-normal",
                    isActive
                      ? "bg-primary/10 text-primary dark:bg-primary/20 hover:bg-primary/10"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                  <span>{item.title}</span>
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Right Content Area */}
        <div className="flex-1 lg:max-w-4xl min-w-0">
          {currentTab === 'general' && (
            <StoreSettingsForm initialData={store} />
          )}

          {currentTab === 'roles' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-semibold tracking-tight">역할 및 권한</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  직원들의 역할을 분류하고 상세 권한을 제어합니다.
                </p>
              </div>
              
              <div className="w-full h-px bg-border/50 my-6" />

              {isMigrationNeeded ? (
                <div className="p-6 border rounded-xl bg-yellow-50 text-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-200">
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
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
