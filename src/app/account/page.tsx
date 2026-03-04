import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AccountSettingsForm } from '@/features/auth/components/account-settings-form'
import { Package2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

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

  return (
    <div className="min-h-screen bg-gray-50/50">
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
    </div>
  )
}