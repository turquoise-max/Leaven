import { createClient } from '@/lib/supabase/server'
import { StoreSettingsForm } from '@/features/store/components/store-settings-form'

export default async function StoreSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // 사용자의 매장 정보 조회 (Store Member 테이블 조인)
  const { data: member } = await supabase
    .from('store_members')
    .select('role, store:stores(*)')
    .eq('user_id', user.id)
    .single()

  const store = member?.store as any

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