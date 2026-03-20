import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { verifyInviteCode, joinStoreByCode } from '@/features/onboarding/actions'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Store, UserPlus, CheckCircle2, ArrowRight, X } from 'lucide-react'

export default async function JoinStorePage(props: { params: Promise<{ code: string }> }) {
  const { code } = await props.params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=/join/${code}`)
  }

  // 1. 매장 코드 유효성 검증
  const verifyResult = await verifyInviteCode(code)

  if (verifyResult.error || !verifyResult.store) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg border-red-100">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
              <X className="w-6 h-6" />
            </div>
            <CardTitle className="text-2xl font-bold">잘못된 초대 링크</CardTitle>
            <CardDescription className="text-base mt-2">
              유효하지 않거나 만료된 매직 링크입니다.
            </CardDescription>
          </CardHeader>
          <CardFooter className="pt-6">
            <Button asChild className="w-full" variant="outline">
              <a href="/home">홈으로 돌아가기</a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  const store = verifyResult.store

  // 2. 이미 가입/신청했는지 확인
  const { data: existingMember } = await supabase
    .from('store_members')
    .select('status')
    .eq('store_id', store.id)
    .eq('user_id', user.id)
    .single()

  if (existingMember) {
    if (existingMember.status === 'active') {
      redirect('/dashboard') // 이미 직원임
    } else {
      redirect('/home') // 대기 중
    }
  }

  // 3. 사용자 프로필 조회 (이름/전화번호 자동완성용)
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone, email')
    .eq('id', user.id)
    .single()

  const defaultName = profile?.full_name || user.email?.split('@')[0] || ''
  const defaultPhone = profile?.phone || ''

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary animate-in fade-in zoom-in duration-500">
        <CardHeader className="text-center pb-6">
          <div className="mx-auto w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4 shadow-inner border border-primary/20">
            <Store className="w-8 h-8" />
          </div>
          <CardTitle className="text-2xl font-extrabold tracking-tight text-gray-900">
            {store.name}
          </CardTitle>
          <CardDescription className="text-base mt-2 flex flex-col items-center">
            <span>초대장이 도착했습니다! 🎉</span>
            <span className="text-xs text-muted-foreground mt-1 bg-slate-100 px-2 py-1 rounded border">코드: {code}</span>
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form action={async (formData) => {
            'use server'
            const name = formData.get('name') as string
            const phone = formData.get('phone') as string
            await joinStoreByCode(code, name, phone)
            redirect('/home') // 합류 신청 완료 후 홈(대기 상태)으로 리다이렉트
          }} className="space-y-5">
            
            <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl space-y-4">
              <div className="flex items-center gap-2 text-blue-800 font-semibold text-sm mb-1">
                <UserPlus className="w-4 h-4" /> 내 프로필 확인
              </div>
              
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-bold text-slate-600">이름 (본명)</Label>
                  <Input 
                    id="name" 
                    name="name" 
                    placeholder="홍길동" 
                    required 
                    defaultValue={defaultName} 
                    className="bg-white border-blue-100 focus-visible:ring-blue-500" 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-bold text-slate-600">전화번호 (- 제외)</Label>
                  <Input 
                    id="phone" 
                    name="phone" 
                    placeholder="01012345678" 
                    required 
                    defaultValue={defaultPhone} 
                    className="bg-white border-blue-100 focus-visible:ring-blue-500 font-mono" 
                  />
                  <p className="text-[10px] text-muted-foreground mt-1 px-1">
                    * 점장님이 입력한 번호와 일치하면 즉시 합류 승인됩니다.
                  </p>
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full h-12 text-base font-bold bg-[#1D9E75] hover:bg-[#1D9E75]/90 shadow-md">
              <CheckCircle2 className="w-5 h-5 mr-2" /> 매장 합류하기
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}