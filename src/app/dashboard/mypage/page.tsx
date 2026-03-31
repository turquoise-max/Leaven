import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { User, ChevronRight, LogOut, ShieldCheck, UserCircle, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { logout } from '@/features/auth/actions'
import Link from 'next/link'

export default async function MyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const fullName = user.user_metadata?.full_name || '사용자'
  const email = user.email

  return (
    <div className="flex flex-col gap-6 p-4 pb-20 md:hidden bg-slate-50/50 min-h-[calc(100vh-4rem)]">
      <div className="flex flex-col gap-2 mt-4">
        <h1 className="text-2xl font-bold tracking-tight">마이페이지</h1>
        <p className="text-sm text-muted-foreground">계정 정보 및 설정을 관리합니다.</p>
      </div>

      {/* 내 정보 섹션 */}
      <Card className="border-none shadow-sm overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary/10">
              <AvatarImage src={user.user_metadata?.avatar_url} />
              <AvatarFallback className="bg-primary/5 text-primary text-xl font-bold">
                {fullName.substring(0, 1)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-0.5">
              <span className="text-lg font-bold">{fullName}</span>
              <span className="text-sm text-muted-foreground">{email}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 메뉴 리스트 */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold text-muted-foreground px-1 uppercase tracking-wider">계정 관리</h2>
        <div className="flex flex-col bg-white rounded-xl shadow-sm border overflow-hidden">
          <Link 
            href="/account?next=/dashboard/mypage" 
            className="flex items-center justify-between p-4 active:bg-slate-50 transition-colors border-b"
          >
            <div className="flex items-center gap-3">
              <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                <UserCircle className="w-5 h-5" />
              </div>
              <span className="font-medium text-slate-700">프로필 수정</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </Link>
          
          <Link 
            href="/account?next=/dashboard/mypage" 
            className="flex items-center justify-between p-4 active:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="bg-purple-50 p-2 rounded-lg text-purple-600">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <span className="font-medium text-slate-700">보안 및 비밀번호</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold text-muted-foreground px-1 uppercase tracking-wider">기타</h2>
        <div className="flex flex-col bg-white rounded-xl shadow-sm border overflow-hidden">
          <button className="flex items-center justify-between p-4 active:bg-slate-50 transition-colors border-b w-full text-left">
            <div className="flex items-center gap-3">
              <div className="bg-orange-50 p-2 rounded-lg text-orange-600">
                <Bell className="w-5 h-5" />
              </div>
              <span className="font-medium text-slate-700">알림 설정</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* 로그아웃 버튼 */}
      <div className="mt-4">
        <form action={async () => {
          'use server'
          await logout()
        }}>
          <Button 
            variant="outline" 
            className="w-full h-12 rounded-xl border-red-100 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 flex items-center justify-center gap-2 font-semibold shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </Button>
        </form>
      </div>

      <div className="mt-auto py-6 text-center">
        <p className="text-[10px] text-muted-foreground opacity-50">Leaven v1.0.0</p>
      </div>
    </div>
  )
}