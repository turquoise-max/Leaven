import { redirect } from 'next/navigation'
import { getInvitationStatus } from '@/features/onboarding/actions'
import { PendingApproval } from '@/features/onboarding/components/pending-approval'
import { RoleSelection } from '@/features/onboarding/components/role-selection'
import { InvitationOverlay } from '@/features/onboarding/components/invitation-overlay'

export default async function OnboardingPage() {
  const { status, store, role } = await getInvitationStatus()

  // 1. 이미 활성 멤버인 경우 대시보드로 이동
  if (status === 'active') {
    redirect('/dashboard')
  }

  // 2. 초대받은 상태인 경우 (오버레이 표시)
  if (status === 'invited' && store) {
    return (
      <>
        <RoleSelection />
        <InvitationOverlay 
          storeId={store.id} 
          storeName={store.name} 
          role={role || 'staff'}
        />
      </>
    )
  }

  // 3. 승인 대기 중인 경우
  if (status === 'pending_approval' && store) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <PendingApproval 
          storeId={store.id} 
          storeName={store.name} 
        />
      </div>
    )
  }

  // 4. 소속 없음 (기본 화면) -> 홈으로 이동하여 매장 생성/참여 유도
  redirect('/home')
}
