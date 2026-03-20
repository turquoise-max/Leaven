import { getUserStores } from '@/features/store/actions'
import { getUserInvitations, acceptInvitation, rejectInvitation, joinStoreByCode, cancelRequest } from '@/features/onboarding/actions'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { Store, Plus, Mail, Check, X, Building, Loader2, ArrowRight, LogOut, Package2, Settings } from 'lucide-react'
import { CancelRequestButton } from '@/features/onboarding/components/cancel-request-button'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
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

export default async function HomePage() {
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

  // 사용자 프로필 조회 (환영 메시지용)
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, email')
    .eq('id', user.id)
    .single()

  const userName = profile?.full_name || user.email?.split('@')[0] || '사용자'
  const userEmail = profile?.email || user.email || ''
  const userAvatar = profile?.avatar_url || ''

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950">
      {/* Global Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6 mx-auto max-w-5xl">
          <div className="flex items-center gap-2 font-bold text-xl">
            <Package2 className="h-6 w-6 text-primary" />
            <span>Leaven</span>
          </div>
          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9 border">
                    <AvatarImage src={userAvatar} alt={userName} />
                    <AvatarFallback>{userName.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{userName}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {userEmail}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/account?next=/home" className="cursor-pointer flex w-full items-center">
                    <Settings className="mr-2 h-4 w-4" />
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

      <main className="container max-w-5xl mx-auto py-10 px-4 md:px-6">
        {/* Welcome Section */}
        <div className="mb-10 flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
            반가워요, {userName}님! 👋
          </h1>
          <p className="text-muted-foreground text-lg">
            관리할 매장을 선택하거나 새로운 초대를 확인해보세요.
          </p>
        </div>

        <Tabs defaultValue="my-stores" className="space-y-8">
          <TabsList className="grid w-full max-w-100 grid-cols-2 p-1">
            <TabsTrigger value="my-stores" className="flex items-center gap-2 text-sm">
              <Building className="h-4 w-4" />
              내 매장
              {stores.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 justify-center px-1">
                  {stores.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="invitations" className="flex items-center gap-2 text-sm relative">
              <Mail className="h-4 w-4" />
              받은 초대
              {invitations.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 min-w-5 justify-center px-1">
                  {invitations.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* 탭 1: 내 매장 목록 */}
          <TabsContent value="my-stores" className="space-y-6 animate-in fade-in-50 duration-500">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* 매장 카드 리스트 */}
              {stores.map((member) => (
                <Card 
                  key={member.store.id} 
                  className={`flex flex-col overflow-hidden transition-all duration-200 ${
                    member.status !== 'active' 
                      ? 'opacity-80 bg-gray-50 dark:bg-gray-900/50 border-dashed' 
                      : 'hover:shadow-md hover:border-primary/50 bg-white dark:bg-gray-900'
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-1 overflow-hidden">
                        <CardTitle className="text-lg truncate leading-tight">
                          {member.store.name}
                        </CardTitle>
                        <CardDescription className="truncate text-xs">
                          {member.store.address || '주소 미입력'}
                        </CardDescription>
                      </div>
                      {member.role === 'owner' ? (
                         <Badge variant="outline" className="border-purple-200 text-purple-700 bg-purple-50 shrink-0">점주</Badge>
                      ) : (
                         <Badge variant="outline" className="shrink-0">직원</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 pb-4">
                    <div className="flex items-center gap-2 text-sm mt-2">
                      {member.status === 'active' ? (
                        <div className="flex items-center gap-1.5 text-green-600 bg-green-50 px-2.5 py-1 rounded-full text-xs font-medium border border-green-100">
                          <Check className="h-3 w-3" /> 
                          <span>운영/근무 중</span>
                        </div>
                      ) : member.status === 'pending_approval' ? (
                        <div className="flex items-center gap-1.5 text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full text-xs font-medium border border-orange-100">
                          <Loader2 className="h-3 w-3 animate-spin" /> 
                          <span>합류 진행 중</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">{member.status}</span>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="pt-0">
                    {member.status === 'active' ? (
                      <form action={async () => {
                        'use server'
                        const { cookies } = await import('next/headers')
                        const cookieStore = await cookies()
                        cookieStore.set('leaven_current_store_id', member.store.id, { path: '/' })
                        redirect('/dashboard')
                      }} className="w-full">
                        <Button type="submit" className="w-full group" variant="default">
                          매장으로 이동 
                          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Button>
                      </form>
                    ) : member.status === 'pending_approval' ? (
                      <div className="flex w-full gap-2">
                        <form action={async () => {
                          'use server'
                          const { cookies } = await import('next/headers')
                          const cookieStore = await cookies()
                          cookieStore.set('leaven_current_store_id', member.store.id, { path: '/' })
                          redirect('/dashboard')
                        }} className="flex-1">
                          <Button type="submit" variant="outline" className="w-full text-orange-700 border-orange-200 bg-orange-50 hover:bg-orange-100">
                            합류 진행 중 (매장 입장)
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </form>
                        <CancelRequestButton storeId={member.store.id} />
                      </div>
                    ) : (
                      <Button disabled variant="outline" className="w-full bg-muted/50">
                        비활성 상태
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}

              {/* 새 매장 만들기 카드 */}
              <Link href="/onboarding/owner" className="group block h-full">
                <Card className="flex h-full flex-col items-center justify-center border-dashed border-2 bg-gray-50/50 hover:bg-white hover:border-primary/50 transition-all duration-200 min-h-50 cursor-pointer dark:bg-gray-900/20 dark:hover:bg-gray-900/50">
                  <div className="flex flex-col items-center justify-center p-6 text-center space-y-4">
                    <div className="h-12 w-12 rounded-full bg-white shadow-sm border flex items-center justify-center group-hover:scale-110 group-hover:border-primary/20 transition-all duration-200 dark:bg-gray-800">
                      <Plus className="h-6 w-6 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-50">새 매장 만들기</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        점주로서 새로운 매장을 등록하고<br/>관리를 시작하세요.
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            </div>
          </TabsContent>

          {/* 탭 2: 받은 초대 및 코드 입력 */}
          <TabsContent value="invitations" className="space-y-8 animate-in fade-in-50 duration-500">
            <div className="grid gap-8 lg:grid-cols-[1fr_350px]">
              
              {/* 받은 초대 목록 */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-1">
                    <Mail className="h-5 w-5 text-primary" /> 
                    받은 초대장
                    <Badge variant="secondary" className="ml-1 rounded-full px-2">
                      {invitations.length}
                    </Badge>
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    매니저나 점주로부터 도착한 초대장 목록입니다.
                  </p>
                </div>
                
                {invitations.length === 0 ? (
                  <div className="text-center py-16 bg-white border border-dashed rounded-xl dark:bg-gray-900/50">
                    <div className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3">
                      <Mail className="h-full w-full" />
                    </div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">도착한 초대장이 없습니다</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      새로운 초대가 도착하면 여기에 표시됩니다.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {invitations.map((invitation) => (
                      <Card key={invitation.id} className="overflow-hidden border-l-4 border-l-primary shadow-sm hover:shadow-md transition-all">
                        <CardHeader className="pb-3 bg-gray-50/50 dark:bg-gray-900/50">
                          <CardTitle className="text-lg">{invitation.store.name}</CardTitle>
                          <CardDescription>
                            {new Date(invitation.invited_at).toLocaleDateString()}에 초대받음
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4 pb-2">
                          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                            <span className="font-medium text-gray-900 dark:text-gray-100">{invitation.store.name}</span>의 
                            직원으로 초대되었습니다. 수락 시 즉시 매장에 합류하게 됩니다.
                          </p>
                        </CardContent>
                        <CardFooter className="flex justify-end gap-2 pt-2 bg-gray-50/30 dark:bg-gray-900/30">
                          <form action={async () => {
                            'use server'
                            await rejectInvitation(invitation.store.id)
                          }}>
                            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                              거절하기
                            </Button>
                          </form>
                          <form action={async () => {
                            'use server'
                            await acceptInvitation(invitation.store.id)
                          }}>
                            <Button size="sm" className="bg-primary hover:bg-primary/90">
                              수락하기
                            </Button>
                          </form>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* 초대 코드 입력 섹션 (사이드바 형태) */}
              <div className="space-y-6">
                <Card className="bg-primary/5 border-primary/20 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base">초대 코드로 매장 찾기</CardTitle>
                    <CardDescription className="text-xs">
                      매니저나 점주에게 받은 6자리 초대 코드를 입력하여 가입을 신청하세요.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form action={async (formData) => {
                      'use server'
                      const code = formData.get('code') as string
                      const name = formData.get('name') as string
                      const phone = formData.get('phone') as string
                      // TODO: 폼 유효성 검사 및 에러 처리
                      await joinStoreByCode(code, name, phone)
                    }} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="code" className="text-xs font-medium">초대 코드</Label>
                        <Input id="code" name="code" placeholder="예: A1B2C3" required className="uppercase tracking-widest bg-white" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-xs font-medium">이름 (본명)</Label>
                        <Input id="name" name="name" placeholder="홍길동" required defaultValue={userName !== '사용자' ? userName : ''} className="bg-white" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-xs font-medium">전화번호</Label>
                        <Input id="phone" name="phone" placeholder="010-1234-5678" required className="bg-white" />
                      </div>
                      <Button type="submit" className="w-full" size="sm">가입 신청하기</Button>
                    </form>
                  </CardContent>
                </Card>
              </div>

            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}