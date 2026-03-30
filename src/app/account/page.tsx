import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AccountSettingsForm } from '@/features/auth/components/account-settings-form'
import { Package2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MobileBottomNav } from '@/shared/components/layout/mobile-bottom-nav'
import { cookies } from 'next/headers'
import { hasPermission } from '@/features/auth/permissions'

interface AccountPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const supabase = await createClient()
  const { next: nextParam } = await searchParams
  
  const next = typeof nextParam === 'string' ? nextParam : '/home'
  const backText = next.startsWith('/dashboard') ? '매장으로 돌아가기' : '메인으로 돌아가기'

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 모바일 네비게이션을 위한 권한 및 역할 정보 조회
  const cookieStore = await cookies()
  const selectedStoreId = cookieStore.get('leaven_current_store_id')?.value

  let role = 'staff'
  let permissions = {}

  if (selectedStoreId) {
    const { data: memberDetail } = await supabase
      .from('store_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('store_id', selectedStoreId)
      .single()

    if (memberDetail) {
      role = memberDetail.role
      permissions = {
        view_staff: await hasPermission(user.id, selectedStoreId, 'view_staff'),
        view_schedule: await hasPermission(user.id, selectedStoreId, 'view_schedule'),
        manage_store: await hasPermission(user.id, selectedStoreId, 'manage_store'),
        manage_roles: await hasPermission(user.id, selectedStoreId, 'manage_roles'),
        view_attendance: await hasPermission(user.id, selectedStoreId, 'view_attendance'),
        view_leave: await hasPermission(user.id, selectedStoreId, 'view_leave'),
        view_tasks: await hasPermission(user.id, selectedStoreId, 'view_tasks'),
        view_salary: await hasPermission(user.id, selectedStoreId, 'view_salary'),
        view_sales: await hasPermission(user.id, selectedStoreId, 'view_sales'),
        manage_inventory: await hasPermission(user.id, selectedStoreId, 'manage_inventory'),
        view_dashboard: await hasPermission(user.id, selectedStoreId, 'view_dashboard'),
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pb-16 lg:pb-0">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6 mx-auto max-w-5xl">
          <div className="flex items-center gap-2 font-bold text-xl">
            <Link href="/home" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <Package2 className="h-6 w-6 text-primary" />
              <span>Leaven</span>
            </Link>
          </div>
          <Button variant="ghost" asChild>
            <Link href={next}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {backText}
            </Link>
          </Button>
        </div>
      </header>

      <main className="container max-w-3xl mx-auto py-10 px-4 md:px-6">
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">내 계정 설정</h1>
            <p className="text-muted-foreground">
              개인 프로필과 보안 설정을 관리합니다.
            </p>
          </div>
          <AccountSettingsForm user={user} />
        </div>
      </main>

      <MobileBottomNav role={role} permissions={permissions} />
    </div>
  )
}
