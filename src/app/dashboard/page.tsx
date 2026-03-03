import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Store, Users, CreditCard, Activity, Bell } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getPendingRequestsCount } from '@/features/staff/actions'
import Link from 'next/link'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // 사용자의 매장 정보 조회 (Store Member 테이블 조인)
  // .single()을 제거하여 여러 매장이 있는 경우에도 에러가 발생하지 않도록 수정
  const { data: members, error } = await supabase
    .from('store_members')
    .select('role, status, store:stores(*)')
    .eq('user_id', user.id)

  if (error) {
    console.error('Error fetching dashboard data:', error)
    redirect('/home')
  }

  if (!members || members.length === 0) {
    redirect('/onboarding')
  }

  // 쿠키에서 선택된 매장 ID 가져오기
  const cookieStore = await cookies()
  const selectedStoreId = cookieStore.get('leaven_current_store_id')?.value

  // 선택된 매장 찾기
  let activeMember = members.find(m => {
    const store = m.store as any
    return store?.id === selectedStoreId
  })

  // 없으면 첫 번째 활성 매장, 그것도 없으면 그냥 첫 번째
  if (!activeMember) {
    activeMember = members.find(m => m.status === 'active') || members[0]
  }

  // 매장에 소속되어 있지 않거나, 활성 상태가 아니라면 온보딩으로 이동
  if (!activeMember || activeMember.status !== 'active') {
    redirect('/onboarding')
  }

  const storeData = activeMember.store
  const store = Array.isArray(storeData) ? storeData[0] : storeData
  
  if (!store) {
     // store 정보가 없는 경우 (RLS 등으로 인해)
     redirect('/onboarding')
  }

  const pendingCount = await getPendingRequestsCount(store.id)

  return (
    <div className="flex flex-col gap-8">
      {pendingCount > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-950/30 border-l-4 border-yellow-400 p-4 rounded-r-md flex items-center justify-between shadow-sm">
          <div className="flex items-center">
            <Bell className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-3" />
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              <span className="font-bold">{pendingCount}명</span>의 직원이 가입 승인을 기다리고 있습니다.
            </p>
          </div>
          <Link 
            href="/dashboard/staff" 
            className="text-sm font-medium text-yellow-700 dark:text-yellow-300 hover:text-yellow-800 dark:hover:text-yellow-200 underline"
          >
            직원 관리 바로가기 &rarr;
          </Link>
        </div>
      )}

      <div>
        <h1 className="text-3xl font-bold tracking-tight">대시보드</h1>
        <p className="text-muted-foreground">
          {store ? `${store.name}의 현황입니다.` : '매장이 없습니다.'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 매출</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₩0</div>
            <p className="text-xs text-muted-foreground">
              지난 달 대비 +0%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">활성 직원</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0명</div>
            <p className="text-xs text-muted-foreground">
              현재 근무 중: 0명
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">오늘 주문</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0건</div>
            <p className="text-xs text-muted-foreground">
              지난 시간 대비 +0%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">매장 상태</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">영업 중</div>
            <p className="text-xs text-muted-foreground">
              마감 예정: 22:00
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}