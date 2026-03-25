import { createClient } from '@/lib/supabase/server'
import { StoreSettingsForm } from '@/features/store/components/store-settings-form'
import { cookies } from 'next/headers'
import { Card, CardContent } from '@/components/ui/card'
import { Lock, Settings, Users, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

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

  return (
    <div className="pb-10 pt-2 max-w-5xl mx-auto">
      <div className="mb-8 border-b pb-6">
        <h1 className="text-3xl font-bold tracking-tight">매장 설정</h1>
        <p className="text-muted-foreground mt-1">
          매장의 기본 정보와 운영 정책을 통합 관리합니다.
        </p>
      </div>

      <div className="min-w-0">
        <StoreSettingsForm initialData={store} />
      </div>
    </div>
  )
}
