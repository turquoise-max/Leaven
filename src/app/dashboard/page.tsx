import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { Users, CreditCard, Bell, TrendingUp, CalendarDays } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getPendingRequestsCount } from '@/features/staff/actions'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { getCurrentSchedule } from '@/features/schedule/actions'
import { AnnouncementList } from '@/features/store/components/announcement-list'
import { getStoreAnnouncements } from '@/features/store/announcement-actions'
import { hasPermission } from '@/features/auth/permissions'
import { getTodayDashboardStats } from '@/features/schedule/dashboard-actions'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // 사용자의 매장 정보 조회 (Store Member 테이블 조인)
  const { data: members, error } = await supabase
    .from('store_members')
    .select('role, role_id, status, store:stores(*)')
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
    const storeData = m.store
    const store = Array.isArray(storeData) ? storeData[0] : storeData
    return store?.id === selectedStoreId
  })

  // 없으면 첫 번째 활성 매장, 그것도 없으면 그냥 첫 번째
  if (!activeMember) {
    activeMember = members.find(m => m.status === 'active') || members[0]
  }

  // 매장에 소속되어 있지 않다면 온보딩으로 이동
  if (!activeMember) {
    redirect('/onboarding')
  }

  const storeData = activeMember.store
  const store = Array.isArray(storeData) ? storeData[0] : storeData
  
  if (!store) {
     redirect('/onboarding')
  }

  // 대시보드 조회 권한 확인
  const canViewDashboard = await hasPermission(user.id, store.id, 'view_dashboard')

  if (!canViewDashboard) {
    redirect('/dashboard/my-tasks')
  }

  // 병렬로 데이터 조회
  const [pendingCount, _currentSchedule, announcements, dashboardStats] = await Promise.all([
    getPendingRequestsCount(store.id),
    getCurrentSchedule(store.id),
    getStoreAnnouncements(store.id),
    getTodayDashboardStats(store.id)
  ])

  return (
    <AdminDashboard 
      pendingCount={pendingCount} 
      store={store} 
      announcements={announcements} 
      stats={dashboardStats}
    />
  )
}

function AdminDashboard({ pendingCount, store, announcements, stats }: { pendingCount: number, store: { id: string, name: string, [key: string]: unknown }, announcements: any[], stats: { scheduledMembersCount: number, leaveMembersCount: number, clockedInMembersCount: number } }) {
  
  // 근무자 현황 표시 텍스트 로직
  let attendanceStatusText = '전원 출근'
  let attendanceStatusColor = 'text-blue-600 dark:text-blue-400'

  if (stats.scheduledMembersCount === 0) {
    attendanceStatusText = '금일 일정 없음'
    attendanceStatusColor = 'text-slate-500 dark:text-slate-400'
  } else if (stats.scheduledMembersCount > stats.clockedInMembersCount) {
    const unclockedCount = stats.scheduledMembersCount - stats.clockedInMembersCount
    attendanceStatusText = `${unclockedCount}명 미출근`
    attendanceStatusColor = 'text-orange-600 dark:text-orange-400'
  } else {
    attendanceStatusText = '전원 출근 완료'
    attendanceStatusColor = 'text-emerald-600 dark:text-emerald-400'
  }

  return (
    <div className="flex flex-col gap-4 md:gap-8 h-full p-4 md:p-0">
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

      <div className="p-4 border-b flex items-center justify-between bg-white md:bg-transparent -mx-4 -mt-4 md:m-0 md:p-0 md:border-none md:mb-6">
        <div className="w-full">
          <h1 className="text-base md:text-2xl font-semibold md:font-bold tracking-tight text-center md:text-left">대시보드</h1>
          <p className="hidden md:block text-sm text-muted-foreground mt-1">
            {store ? `${store.name}의 현황입니다.` : '매장이 없습니다.'}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        {/* Main Content (Left) */}
        <div className="md:col-span-8 lg:col-span-8">
          <Card className="border shadow-sm overflow-hidden bg-white dark:bg-slate-900">
            <div className="grid grid-cols-2 divide-x">
              {/* Sales Section */}
              <div className="p-3 md:p-5 space-y-3 md:space-y-5 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-1.5 md:gap-2 text-slate-500 dark:text-slate-400">
                  <CreditCard className="h-4 w-4 md:h-5 md:w-5" />
                  <span className="text-xs md:text-sm font-semibold tracking-wide uppercase">매출 정보</span>
                </div>
                
                <div className="space-y-3 md:space-y-4">
                  <div>
                    <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mb-0.5 md:mb-1">금일 매출</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl md:text-3xl font-extrabold tracking-tight">₩0</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 pt-2 md:pt-4">
                    <div>
                      <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 mb-0.5 md:mb-1">월 목표 매출</p>
                      <p className="text-sm md:text-lg font-bold text-slate-700 dark:text-slate-200">₩0</p>
                    </div>
                    <div>
                      <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 mb-0.5 md:mb-1">달성율</p>
                      <div className="flex items-center gap-1 md:gap-1.5">
                        <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-emerald-500" />
                        <p className="text-sm md:text-lg font-bold text-emerald-500">0%</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Workforce Status Section */}
              <div className="p-3 md:p-5 space-y-3 md:space-y-5">
                <div className="flex items-center gap-1.5 md:gap-2 text-slate-500 dark:text-slate-400">
                  <Users className="h-4 w-4 md:h-5 md:w-5" />
                  <span className="text-xs md:text-sm font-semibold tracking-wide uppercase">근무자 현황</span>
                </div>

                <div className="space-y-3 md:space-y-4">
                  <div>
                    <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mb-0.5 md:mb-1">전체 현황</p>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-lg md:text-3xl font-extrabold tracking-tight ${attendanceStatusColor}`}>
                        {attendanceStatusText}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 pt-2 md:pt-3">
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="p-1.5 md:p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <CalendarDays className="h-3 w-3 md:h-4 md:w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400">금일 근무자</p>
                        <p className="text-sm md:text-lg font-bold">{stats.scheduledMembersCount}명</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="p-1.5 md:p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                        <CalendarDays className="h-3 w-3 md:h-4 md:w-4 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div>
                        <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400">금일 휴가자</p>
                        <p className="text-sm md:text-lg font-bold text-orange-600">{stats.leaveMembersCount}명</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar: Announcements */}
        <div className="md:col-span-4 lg:col-span-4">
           <div className="sticky top-6 flex flex-col h-[300px] md:h-[calc(100vh-12rem)] min-h-[300px] md:min-h-[400px]">
              <AnnouncementList 
                storeId={store.id} 
                announcements={announcements} 
                isManager={true} 
              />
           </div>
        </div>
      </div>
    </div>
  )
}
