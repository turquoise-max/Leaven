import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardClientLayout } from '@/components/dashboard/dashboard-layout'
import { cookies } from 'next/headers'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 사용자의 모든 매장 멤버 정보 조회 (매장 리스트용)
  const { data: members } = await supabase
    .from('store_members')
    .select('role, store_id, stores(id, name)')
    .eq('user_id', user.id)

  if (!members || members.length === 0) {
    redirect('/onboarding')
  }

  // 현재 활성화된 매장 (일단 첫 번째 매장 사용, 추후 선택 로직 개선 가능)
  // 실제로는 URL이나 쿠키에 선택된 매장 ID를 저장하고 불러와야 함
  const currentMember = members[0]
  const currentStore = currentMember.stores as any
  const storeName = currentStore?.name || 'Leaven'
  
  // 매장 리스트 데이터 가공
  const storeList = members.map(m => ({
    id: (m.stores as any).id,
    name: (m.stores as any).name,
    role: m.role
  }))

  // 현재 매장의 전체 직원 목록 조회 (우측 사이드바용)
  const { data: rawStaffList } = await supabase
    .from('store_members')
    .select(`
      id,
      role,
      status,
      profile:profiles(full_name, email, avatar_url)
    `)
    .eq('store_id', currentMember.store_id)
    .order('role', { ascending: true }) // owner -> manager -> staff 순

  // 데이터 가공 (타입 맞춤)
  const staffList = rawStaffList?.map((staff: any) => ({
    ...staff,
    profile: Array.isArray(staff.profile) ? staff.profile[0] : staff.profile
  }))

  // 쿠키에서 레이아웃 설정 읽기 (키 이름 변경으로 초기화 효과)
  const cookieStore = await cookies()
  const layout = cookieStore.get('react-resizable-panels:layout-v8')
  
  const defaultLayout = layout ? JSON.parse(layout.value) : undefined

  return (
    <DashboardClientLayout
      user={{
        email: user.email!,
        full_name: user.user_metadata.full_name,
        avatar_url: user.user_metadata.avatar_url,
      }}
      role={currentMember.role}
      storeName={storeName}
      storeList={storeList}
      staffList={staffList || []}
      defaultLayout={defaultLayout}
      navCollapsedSize={4}
    >
      {children}
    </DashboardClientLayout>
  )
}