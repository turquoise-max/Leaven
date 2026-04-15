import { getUserStores } from '@/features/store/actions'
import { getUserInvitations, acceptInvitation, rejectInvitation, joinStoreByCode, cancelRequest } from '@/features/onboarding/actions'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { Store, Plus, Mail, Check, X, Building, Loader2, ArrowRight, LogOut, Package2, Settings, MapPin, User, ShieldCheck } from 'lucide-react'
import { CancelRequestButton } from '@/features/onboarding/components/cancel-request-button'
import { JoinStoreForm } from '@/features/onboarding/components/join-store-form'
import { InvitationButtons } from '@/features/onboarding/components/invitation-buttons'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { logout } from '@/features/auth/actions'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default async function HomePage(props: { searchParams?: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 데이터 병렬 조회
  const [stores, invitations] = await Promise.all([
    getUserStores(),
    getUserInvitations()
  ])

  const searchParams = await props.searchParams
  const isBypass = searchParams?.bypass === 'true'

  // Phase 3: 직행 버스 (Auto-Redirect)
  // 조건: 소속된 매장이 1개뿐이고, 받은 초대장이 없으며, 사용자가 의도적으로 홈으로 오지 않은 경우
  if (stores.length === 1 && invitations.length === 0 && !isBypass) {
    const member = stores[0]
    if (member.status === 'active') {
      // 대시보드 쪽에서 쿠키가 없을 경우 첫 번째 활성 매장을 자동으로 띄우도록 방어 로직이 있으므로,
      // 서버 컴포넌트 단에서 불가능한(에러 유발) cookieStore.set()을 생략하고 단순히 이동만 시킵니다.
      redirect('/dashboard')
    }
  }

  // 사용자 프로필 조회 (환영 메시지용)
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, email, phone')
    .eq('id', user.id)
    .single()

  const userName = profile?.full_name || user.email?.split('@')[0] || '사용자'
  const userPhone = profile?.phone || ''
  const userEmail = profile?.email || user.email || ''
  const userAvatar = profile?.avatar_url || ''

  // 컨텍스트 판별 (Phase 1, 2, 4)
  const phase = (stores.length === 0 && invitations.length === 0) ? 1 : 
                (stores.length === 0 && invitations.length > 0) ? 2 : 4;

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 flex flex-col">
      {/* Global Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 shrink-0">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6 mx-auto max-w-5xl">
          <div className="flex items-center gap-2 font-bold text-xl">
            <Package2 className="h-6 w-6 text-primary" />
            <span>Leaven</span>
          </div>
          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full border border-border shadow-sm">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={userAvatar} alt={userName} />
                    <AvatarFallback className="bg-primary/5 text-primary font-medium">{userName.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-bold leading-none">{userName}</p>
                    <p className="text-xs leading-none text-muted-foreground mt-1">
                      {userEmail}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/account?next=/home" className="cursor-pointer flex w-full items-center">
                    <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>내 계정 설정</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <form action={async () => {
                    'use server'
                    await logout()
                  }} className="w-full cursor-pointer">
                    <button type="submit" className="flex w-full items-center text-red-600">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>로그아웃</span>
                    </button>
                  </form>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto py-10 px-4 md:px-6 flex-1 flex flex-col">
        
        {/* ==========================================
            Phase 1. 백지 상태 (초기 진입자) 
            ========================================== */}
        {phase === 1 && (
          <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500 -mt-10">
            <div className="text-center space-y-4 mb-12">
              <div className="mx-auto w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-primary/20">
                <Package2 className="w-8 h-8" />
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">
                환영합니다, {userName}님! 🎉
              </h1>
              <p className="text-muted-foreground text-lg max-w-lg mx-auto leading-relaxed">
                Leaven에 처음 오셨군요.<br/>어떤 목적으로 찾아오셨는지 선택해주세요.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-3xl">
              {/* 점주용 큰 카드 */}
              <Link href="/onboarding/owner" className="group">
                <Card className="h-full flex flex-col items-center text-center p-8 hover:border-primary/50 hover:shadow-lg transition-all duration-300 border-2 cursor-pointer bg-white">
                  <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 border border-blue-100 text-blue-600 shadow-sm">
                    <Building className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-gray-900">사장님이신가요?</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                    새로운 매장을 등록하고<br/>직원들의 근태와 스케줄을 우아하게 관리하세요.
                  </p>
                  <Button className="w-full mt-auto font-bold tracking-wide" variant="default">
                    <Plus className="w-4 h-4 mr-2" /> 새 매장 개설하기
                  </Button>
                </Card>
              </Link>

              {/* 직원용 큰 카드 */}
              <Card className="h-full flex flex-col items-center text-center p-8 hover:border-primary/50 hover:shadow-lg transition-all duration-300 border-2 bg-white">
                <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mb-6 border border-emerald-100 text-emerald-600 shadow-sm">
                  <Store className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900">직원이신가요?</h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                  점장님에게 전달받은 6자리 합류 코드를 입력하고<br/>매장에 합류하세요.
                </p>
                <div className="w-full mt-auto">
                  <JoinStoreForm defaultName={userName !== '사용자' ? userName : ''} defaultPhone={userPhone} variant="large" />
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ==========================================
            Phase 2. 대기 상태 뷰 (가입/초대 대기중) 
            ========================================== */}
        {phase === 2 && (
          <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in duration-500 -mt-10">
            <div className="text-center space-y-4 mb-10">
              <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
                조금만 기다려주세요, {userName}님! ⏳
              </h1>
              <p className="text-muted-foreground text-lg max-w-lg mx-auto leading-relaxed">
                현재 매장 합류 대기 중이거나 초대장을 받으셨습니다.
              </p>
            </div>

            <div className="w-full max-w-2xl space-y-4">
              {/* 받은 초대장 목록 */}
              {invitations.map((invitation) => (
                <Card key={invitation.id} className="overflow-hidden border-2 border-primary/20 shadow-md">
                  <CardHeader className="bg-primary/5 pb-4">
                    <CardTitle className="text-xl flex items-center gap-2 text-primary">
                      <Mail className="w-5 h-5" /> 도착한 초대장
                    </CardTitle>
                    <CardDescription>
                      <strong className="text-foreground">{invitation.store.name}</strong>에서 회원님을 직원으로 초대했습니다.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        초대일시: {new Date(invitation.invited_at).toLocaleDateString()}
                      </div>
                      <InvitationButtons storeId={invitation.store.id} variant="large" />
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* 합류 대기 목록 (pending_approval 상태인 member를 stores 쿼리에서 가져와야 함) */}
              {stores.filter(s => s.status === 'pending_approval').map(member => (
                <Card key={member.store.id} className="overflow-hidden border-dashed border-2 shadow-sm bg-slate-50/50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg text-gray-700">{member.store.name}</CardTitle>
                      <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200 pointer-events-none">
                        <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> 승인 대기 중
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      현재 점장님의 가입 승인을 기다리고 있습니다.<br/>
                      전자 근로계약서 서명 안내를 이메일이나 카카오톡으로 받으시면 서명을 완료해주세요.
                    </p>
                  </CardContent>
                  <CardFooter className="pt-0 bg-white border-t p-4 mt-2">
                    <div className="w-full flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">잘못 신청하셨나요?</span>
                      <CancelRequestButton storeId={member.store.id} />
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
            
            {/* 로그아웃이나 계정 설정으로 빠져나갈 수 있게 */}
            <div className="mt-8">
              <Link href="/account?next=/home" className="text-sm text-muted-foreground hover:text-primary underline underline-offset-4">
                내 계정 설정 가기
              </Link>
            </div>
          </div>
        )}

        {/* ==========================================
            Phase 4. 통합 허브 뷰 (다점포 / 투잡 유저)
            ========================================== */}
        {phase === 4 && (
          <div className="animate-in fade-in duration-500">
            <div className="mb-8 flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                <Building className="w-6 h-6 text-primary" /> 내 매장 및 근무지
              </h2>
            </div>

            <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-12">
              {/* 내 매장 카드 */}
              {stores.map((member) => (
                <Card 
                  key={member.store.id} 
                  className={cn(
                    "flex flex-col overflow-hidden transition-all duration-300 border shadow-sm group/card",
                    member.status !== 'active' 
                      ? "opacity-75 bg-slate-50/50 border-dashed" 
                      : "hover:shadow-xl hover:border-primary/30 bg-white sm:hover:-translate-y-1"
                  )}
                >
                  <CardHeader className="p-4 sm:pb-4 relative overflow-hidden">
                    {/* Background decoration - subtle on mobile */}
                    <div className={cn(
                      "absolute top-0 right-0 p-6 sm:p-8 -mr-4 -mt-4 opacity-[0.02] sm:opacity-[0.03] transition-transform duration-500 group-hover/card:scale-110",
                      member.role === 'owner' ? "text-purple-600" : "text-emerald-600"
                    )}>
                      <Building className="w-16 h-16 sm:w-24 sm:h-24 rotate-12" />
                    </div>

                    <div className="flex justify-between items-start relative z-10">
                      <div className="space-y-1 sm:space-y-1.5 overflow-hidden pr-2">
                        <CardTitle className="text-lg sm:text-xl font-bold truncate tracking-tight text-slate-900 group-hover/card:text-primary transition-colors">
                          {member.store.name}
                        </CardTitle>
                        <div className="flex items-center text-slate-500 gap-1">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <p className="truncate text-[10px] sm:text-[11px] font-medium leading-none">
                            {member.store.address || '주소 정보 없음'}
                          </p>
                        </div>
                      </div>
                      
                      {member.role === 'owner' ? (
                        <Badge className="bg-purple-50 text-purple-700 border-purple-200/50 shadow-none hover:bg-purple-100 transition-colors shrink-0 px-1.5 sm:px-2 py-0.5 h-5 sm:h-6 flex gap-1 items-center">
                          <ShieldCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          <span className="text-[10px] sm:text-[11px] font-bold">점주</span>
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-50/50 text-emerald-700 border-emerald-200/50 shadow-none hover:bg-emerald-100/50 transition-colors shrink-0 px-1.5 sm:px-2 py-0.5 h-5 sm:h-6 flex gap-1 items-center">
                          <User className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          <span className="text-[10px] sm:text-[11px] font-bold">직원</span>
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 px-4 pt-0 pb-4 sm:pb-6">
                    <div className="flex items-center gap-2 text-sm relative z-10">
                      {member.status === 'active' ? (
                        <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50/80 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg font-bold border border-emerald-100/80 w-full justify-center shadow-sm group-hover/card:bg-emerald-50 transition-colors">
                          <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[11px] sm:text-xs">정상 운영 중</span>
                        </div>
                      ) : member.status === 'pending_approval' ? (
                        <div className="flex items-center gap-1.5 text-orange-600 bg-orange-50/80 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg font-bold border border-orange-100/80 w-full justify-center group-hover/card:bg-orange-50 transition-colors">
                          <Loader2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin" />
                          <span className="text-[11px] sm:text-xs">가입 승인 대기</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-slate-500 bg-slate-100/80 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg font-bold border border-slate-200/80 w-full justify-center">
                          <span className="text-[11px] sm:text-xs">{member.status}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="pt-0 pb-4 sm:pb-5 px-4 sm:px-5">
                    {member.status === 'active' ? (
                      <form action={async () => {
                        'use server'
                        const { cookies } = await import('next/headers')
                        const cookieStore = await cookies()
                        cookieStore.set('leaven_current_store_id', member.store.id, { path: '/' })
                        redirect('/dashboard')
                      }} className="w-full">
                        <Button type="submit" className="w-full group font-bold tracking-wide" variant="default" size="lg">
                          입장하기 
                          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Button>
                      </form>
                    ) : member.status === 'pending_approval' ? (
                      <div className="w-full text-center">
                        <span className="text-xs text-muted-foreground">승인 대기 중에는 입장 불가</span>
                      </div>
                    ) : (
                      <Button disabled variant="outline" className="w-full bg-muted/50">비활성 상태</Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>

            {/* 새로운 합류 및 생성 섹션 */}
            <div className="pt-8 border-t border-border/60">
              <h3 className="text-lg font-bold mb-6 text-gray-800">새로운 여정 시작하기</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
                
                {/* 직원: 초대 코드로 합류 */}
                <Card className="bg-slate-50/50 border-dashed border-2 hover:border-primary/40 transition-colors shadow-none">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Store className="w-5 h-5 text-emerald-600" /> 초대코드로 매장 가입하기
                    </CardTitle>
                    <CardDescription className="text-xs">
                      6자리 코드를 입력해 매장에 가입하세요.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <JoinStoreForm defaultName={userName !== '사용자' ? userName : ''} defaultPhone={userPhone} variant="compact" />
                  </CardContent>
                </Card>

                {/* 점주: 새 매장 개설 */}
                <Card className="bg-slate-50/50 border-dashed border-2 hover:border-primary/40 transition-colors shadow-none">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Plus className="w-5 h-5 text-blue-600" /> 새 매장 만들기
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center">
                    <Button asChild variant="outline" className="w-full bg-white border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800">
                      <Link href="/onboarding/owner">
                        새 매장 개설하기 <ArrowRight className="ml-2 w-4 h-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* 받은 초대장 영역 (Phase 4 내에 포함) */}
            {invitations.length > 0 && (
              <div className="mt-12 pt-8 border-t border-border/60">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-6">
                  <Mail className="h-5 w-5 text-primary" /> 받은 초대장
                  <Badge variant="destructive" className="rounded-full">{invitations.length}</Badge>
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 max-w-4xl">
                  {invitations.map((invitation) => (
                    <Card key={invitation.id} className="overflow-hidden border-l-4 border-l-primary shadow-sm bg-white">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">{invitation.store.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {new Date(invitation.invited_at).toLocaleDateString()} 초대됨
                        </CardDescription>
                      </CardHeader>
                      <CardFooter className="flex justify-end gap-2 bg-slate-50/50 p-3 border-t">
                        <InvitationButtons storeId={invitation.store.id} variant="compact" />
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
