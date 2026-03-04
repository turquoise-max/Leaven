import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getTasks } from '@/features/tasks/actions'
import { TaskList } from '@/features/tasks/components/task-list'
import { CreateTaskDialog } from '@/features/tasks/components/create-task-dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: '업무 관리 | Leaven',
  description: '매장의 업무 목록을 관리합니다.',
}

export default async function TasksPage() {
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

  // 업무 목록 조회
  const tasks = await getTasks(store.id)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">업무 관리</h1>
          <p className="text-muted-foreground">
            매장에서 수행해야 할 업무 목록을 정의하고 관리합니다.
          </p>
        </div>
        <CreateTaskDialog storeId={store.id} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>업무 목록</CardTitle>
          <CardDescription>
            총 {tasks.length}개의 업무가 등록되어 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TaskList tasks={tasks} />
        </CardContent>
      </Card>
    </div>
  )
}