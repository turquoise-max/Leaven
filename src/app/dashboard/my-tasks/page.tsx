import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { DashboardTaskList } from '@/features/tasks/components/dashboard-task-list'
import { getStoreAnnouncements } from '@/features/store/announcement-actions'
import { StaffAnnouncementList } from '@/features/store/components/staff-announcement-list'

export const dynamic = 'force-dynamic'

export default async function MyTasksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: members, error } = await supabase
    .from('store_members')
    .select('role, role_id, status, store:stores(*)')
    .eq('user_id', user.id)

  if (error || !members || members.length === 0) redirect('/home')

  const cookieStore = await cookies()
  const selectedStoreId = cookieStore.get('leaven_current_store_id')?.value

  let activeMember = members.find(m => (m.store as any)?.id === selectedStoreId)
  if (!activeMember) {
    activeMember = members.find(m => m.status === 'active') || members[0]
  }
  if (!activeMember) redirect('/onboarding')

  const storeData = activeMember.store
  const store = Array.isArray(storeData) ? storeData[0] : storeData
  
  if (!store) redirect('/onboarding')

  const announcements = await getStoreAnnouncements(store.id)

  return (
    <div className="flex flex-col gap-6 h-full max-w-3xl mx-auto w-full pt-4">
      <div className="px-2">
        <h1 className="text-2xl font-bold tracking-tight">오늘의 할 일</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {store?.name}에서 오늘 나에게 배정된 업무입니다.
        </p>
      </div>

      {announcements && announcements.length > 0 && (
        <div className="px-2">
          <StaffAnnouncementList announcements={announcements} />
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <DashboardTaskList storeId={store.id} />
      </div>
    </div>
  )
}
