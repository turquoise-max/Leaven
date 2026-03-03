import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { DailyTimeline } from '@/features/schedule/components/daily-timeline'
import { getSchedules } from '@/features/schedule/actions'
import { getTasks, getTaskAssignments } from '@/features/tasks/actions'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ date: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { date } = await params
  return {
    title: `${date} 업무 할당 | Leaven`,
    description: '일별 업무 할당 및 스케줄 관리',
  }
}

export default async function DailySchedulePage({ params }: PageProps) {
  const { date } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 매장 정보 조회
  const { data: members, error } = await supabase
    .from('store_members')
    .select('role, status, store:stores(*)')
    .eq('user_id', user.id)

  if (error || !members || members.length === 0) {
    redirect('/onboarding')
  }

  const cookieStore = await cookies()
  const selectedStoreId = cookieStore.get('leaven_current_store_id')?.value

  let activeMember = members.find(m => {
    const store = m.store as any
    return store?.id === selectedStoreId
  })

  if (!activeMember) {
    activeMember = members.find(m => m.status === 'active') || members[0]
  }

  if (!activeMember || activeMember.status !== 'active') {
    redirect('/onboarding')
  }

  const storeData = activeMember.store
  const store = Array.isArray(storeData) ? storeData[0] : storeData
  
  if (!store) {
     redirect('/onboarding')
  }

  // 해당 날짜의 스케줄 조회 (전체 직원)
  // getSchedules는 기간 조회를 하므로, 해당 날짜의 00:00 ~ 23:59로 조회
  const startDate = `${date}T00:00:00`
  const endDate = `${date}T23:59:59`
  const schedules = await getSchedules(store.id, startDate, endDate)

  // 업무 목록 (Task Pool)
  const tasks = await getTasks(store.id)

  // 이미 할당된 업무 조회
  const assignments = await getTaskAssignments(store.id, date)

  return (
    <div className="flex flex-col h-[calc(100vh-65px)] overflow-hidden">
      <div className="flex items-center gap-4 px-6 py-4 border-b shrink-0">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/schedule">
            <ChevronLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">{date} 업무 할당</h1>
          <p className="text-sm text-muted-foreground">
            직원들의 근무 시간에 맞춰 업무를 드래그하여 할당하세요.
          </p>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-hidden">
        <DailyTimeline 
          date={date}
          schedules={schedules}
          tasks={tasks}
          assignments={assignments}
          storeId={store.id}
        />
      </div>
    </div>
  )
}