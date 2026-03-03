import { createClient } from '@/lib/supabase/server'
import { StoreSettingsForm } from '@/features/store/components/store-settings-form'
import { cookies } from 'next/headers'

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

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">매장 설정</h3>
        <p className="text-sm text-muted-foreground">
          매장의 기본 정보와 운영 설정을 관리합니다.
        </p>
      </div>
      <div className="max-w-2xl">
        <StoreSettingsForm initialData={store} />
      </div>
    </div>
  )
}