import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { 
  ChevronRight, 
  LogOut, 
  ShieldCheck, 
  Bell, 
  FileText,
  Store,
  HeadphonesIcon,
  Settings
} from 'lucide-react'
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
    <div className="flex flex-col md:hidden bg-slate-50/50 min-h-[calc(100vh-4rem)] overflow-x-hidden space-y-4">
      {/* Header Area */}
      <div className="pt-8 pb-4 px-4 border-b flex flex-col justify-center items-center bg-white md:bg-transparent md:items-start md:flex-row md:justify-between -mx-4 -mt-4 mb-0 md:m-0 md:p-0 md:border-none md:mb-6">
        <div className="text-center md:text-left w-full">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">마이페이지</h1>
          <p className="text-sm text-muted-foreground hidden md:block mt-1">
            계정 정보 및 설정을 관리합니다.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-4 pb-20 flex-1 min-h-0">
        {/* 내 정보 섹션 (초슬림형) */}
        <Card className="border-none shadow-sm overflow-hidden">
          <CardContent className="p-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar className="h-10 w-10 border-2 border-primary/10">
                  <AvatarImage src={user.user_metadata?.avatar_url} />
                  <AvatarFallback className="bg-primary/5 text-primary text-sm font-bold">
                    {fullName.substring(0, 1)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-bold">{fullName}</span>
                  <span className="text-[10px] text-muted-foreground">{email}</span>
                </div>
              </div>
              <Link 
                href="/account?next=/dashboard/mypage"
                className="text-[10px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full hover:bg-blue-100 transition-colors"
              >
                수정
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* 퀵 액션 (2분할) */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/dashboard/mypage" className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-2 active:bg-slate-50 transition-colors">
            <div className="bg-indigo-50 p-2.5 rounded-full text-indigo-600">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-slate-700">내 근로계약서</span>
          </Link>
          <Link href="/dashboard/mypage" className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-2 active:bg-slate-50 transition-colors">
            <div className="bg-emerald-50 p-2.5 rounded-full text-emerald-600">
              <Store className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-slate-700">매장 전환/관리</span>
          </Link>
        </div>

        {/* 설정 및 지원 리스트 (압축형) */}
        <div className="flex flex-col bg-white rounded-xl shadow-sm border overflow-hidden mt-2">
          <Link 
            href="/account?next=/dashboard/mypage" 
            className="flex items-center justify-between p-3.5 active:bg-slate-50 transition-colors border-b border-slate-100"
          >
            <div className="flex items-center gap-3">
              <div className="bg-slate-100 p-1.5 rounded-md text-slate-600">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium text-slate-700">보안 및 비밀번호</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </Link>
          
          <button className="flex items-center justify-between p-3.5 active:bg-slate-50 transition-colors border-b border-slate-100 w-full text-left">
            <div className="flex items-center gap-3">
              <div className="bg-slate-100 p-1.5 rounded-md text-slate-600">
                <Bell className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium text-slate-700">알림 설정</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </button>

          <button className="flex items-center justify-between p-3.5 active:bg-slate-50 transition-colors w-full text-left">
            <div className="flex items-center gap-3">
              <div className="bg-slate-100 p-1.5 rounded-md text-slate-600">
                <HeadphonesIcon className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium text-slate-700">고객센터 및 도움말</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </button>
        </div>

        {/* 하단 여백 채우기 */}
        <div className="flex-1"></div>

        {/* 로그아웃 및 버전 */}
        <div className="mt-auto flex flex-col items-center gap-3">
          <form action={async () => {
            'use server'
            await logout()
          }} className="w-full">
            <Button 
              variant="outline" 
              className="w-full h-11 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2 text-sm shadow-sm"
            >
              <LogOut className="w-4 h-4" />
              로그아웃
            </Button>
          </form>
          <p className="text-[10px] text-muted-foreground opacity-50">Leaven v1.0.0</p>
        </div>
      </div>
    </div>
  )
}