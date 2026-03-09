import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getTasks, getTaskTemplates } from '@/features/tasks/actions'
import { getStoreRoles } from '@/features/store/actions'
import { TaskList } from '@/features/tasks/components/task-list'
import { TaskCalendar } from '@/features/tasks/components/task-calendar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { hasPermission, getStoreMemberRole } from '@/features/auth/permissions'
import { CalendarDays, List } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export const metadata: Metadata = {
  title: '업무표 | Leaven',
  description: '매장의 업무를 관리합니다.',
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

  // 업무 목록 및 역할 조회
  const [tasks, taskTemplates, roles, canManage, memberRole] = await Promise.all([
    getTasks(store.id),
    getTaskTemplates(store.id),
    getStoreRoles(store.id),
    hasPermission(user.id, store.id, 'manage_tasks'),
    getStoreMemberRole(user.id, store.id)
  ])

  const userRoleId = memberRole?.role_id || null

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">업무표</h1>
          <p className="text-muted-foreground">
            시간대별 업무 흐름을 관리하고 할당합니다.
          </p>
        </div>
      </div>

      <Tabs defaultValue="calendar" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className={`grid shrink-0 ${canManage ? 'w-[320px] grid-cols-2' : 'w-[160px] grid-cols-1'}`}>
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4" />
            업무표 캘린더
          </TabsTrigger>
          {canManage && (
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <List className="w-4 h-4" />
              업무 템플릿 관리
            </TabsTrigger>
          )}
        </TabsList>
        
        <TabsContent value="calendar" className="flex-1 overflow-hidden mt-4">
          <Card className="h-full border-0 shadow-none sm:border sm:shadow-sm">
            <CardContent className="p-0 h-full">
              <TaskCalendar 
                tasks={tasks} 
                roles={roles} 
                openingHours={store.opening_hours} 
                storeId={store.id}
                canManage={canManage}
                userRoleId={userRoleId}
              />
            </CardContent>
          </Card>
        </TabsContent>
        
        {canManage && (
          <TabsContent value="templates" className="flex-1 overflow-auto mt-4">
            <TaskList tasks={taskTemplates} roles={roles} storeId={store.id} canManage={canManage} isTemplateMode={true} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
