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
import { cookies } from 'next/headers'
import { ActionButtons } from './components/action-buttons'

export default async function MyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const cookieStore = await cookies()
  const currentStoreId = cookieStore.get('leaven_current_store_id')?.value

  if (!user) {
    redirect('/login')
  }

  // 매장 멤버 정보에서 근로계약서 유무 조회
  let hasContract = false
  if (currentStoreId) {
    // single() 대신 조회를 사용하여 중복 데이터나 에러 대응
    const { data: members } = await supabase
      .from('store_members')
      .select('modusign_document_id, contract_status, contract_file_url')
      .eq('store_id', currentStoreId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }) // 최신 멤버십 정보 우선

    // 서명 완료 상태이거나 모두싸인/직접업로드 문서가 있는 데이터가 하나라도 있으면 true
    // note: 'completed' is also a valid status in modusign, though we use 'signed' generally, let's just make it robust.
    const validMember = members?.find(m =>
      m.contract_status === 'signed' ||
      m.contract_status === 'completed' ||
      m.modusign_document_id != null ||
      m.contract_file_url != null
    )

    if (validMember) {
      hasContract = true
    } else {
      // For debugging
      console.log('No valid contract found for user in store.', {
        currentStoreId,
        userId: user.id,
        members: members
      })
      
      // Fallback: Check if the user has ANY contract in ANY store, 
      // just in case the currentStoreId is wrong or not set properly
      const { data: allMembers } = await supabase
        .from('store_members')
        .select('store_id, modusign_document_id, contract_status, contract_file_url')
        .eq('user_id', user.id)
        
      const anyValidMember = allMembers?.find(m =>
        m.contract_status === 'signed' ||
        m.contract_status === 'completed' ||
        m.modusign_document_id != null ||
        m.contract_file_url != null
      )
      
      if (anyValidMember) {
        console.log('User has contract in ANOTHER store. Temporarily allowing access.', anyValidMember)
        hasContract = true
      }
    }
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

      <div className="flex flex-col gap-3 px-4 pb-20 flex-1 min-h-0">
        {/* 내 정보 섹션 (초슬림형) */}
        <Card className="border-none shadow-sm overflow-hidden mt-2">
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
            </div>
          </CardContent>
        </Card>

        {/* 퀵 액션 (2분할) */}
        <ActionButtons 
          currentStoreId={currentStoreId} 
          hasContract={hasContract} 
        />

        {/* 설정 및 지원 리스트 (압축형) */}
        <div className="flex flex-col bg-white rounded-xl shadow-sm border overflow-hidden">
          <Link 
            href="/account?next=/dashboard/mypage" 
            className="flex items-center justify-between p-3.5 active:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="bg-slate-100 p-1.5 rounded-md text-slate-600">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium text-slate-700">보안 및 비밀번호</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </Link>
        </div>

        {/* 로그아웃 및 버전 */}
        <div className="mt-6 flex flex-col items-center gap-3">
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