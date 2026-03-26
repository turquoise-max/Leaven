import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { DashboardTaskList } from '@/features/schedule/components/dashboard-task-list'
import { getStoreAnnouncements } from '@/features/store/announcement-actions'
import { StaffAnnouncementList } from '@/features/store/components/staff-announcement-list'
import { getTodayDateString } from '@/shared/lib/date-utils'
import { MyTasksClientWrapper } from '@/features/schedule/components/my-tasks-client-wrapper'

export const dynamic = 'force-dynamic'

export default async function MyTasksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: members, error } = await supabase
    .from('store_members')
    .select('id, role, role_id, status, store:stores(*)')
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
    <MyTasksClientWrapper 
      storeId={store.id} 
      roleId={activeMember.role_id}
      storeName={store?.name || ''}
      currentUserId={user.id}
      myStaffId={activeMember.id}
      announcements={announcements || []}
    />
  )
}
