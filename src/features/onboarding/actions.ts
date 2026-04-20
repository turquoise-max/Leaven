'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ensureDefaultRoles } from '@/features/store/roles'

export async function createStore(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  const name = formData.get('name') as string
  const address = formData.get('address') as string
  const businessNumber = formData.get('business_number') as string
  const description = formData.get('description') as string

  // Call RPC function to create store and assign owner in a single transaction
  // This RPC creates the store and adds the current user as an 'owner' member.
  const { data: storeId, error } = await supabase.rpc('create_store_with_owner', {
    name_param: name,
    description_param: description,
    address_param: address,
    business_number_param: businessNumber,
  })

  if (error || !storeId) {
    console.error('Store creation error:', error)
    return { error: error?.message || '매장 생성에 실패했습니다.' }
  }

  // 1.5 점주의 이름 가져오기 및 업데이트
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const ownerName = profile?.full_name || user.user_metadata?.full_name || '점주'

  await supabase
    .from('store_members')
    .update({ name: ownerName })
    .eq('store_id', storeId)
    .eq('user_id', user.id)

  // 2. 기본 직급 생성 및 점주 권한 연결 보정
  const { ownerRoleId } = await ensureDefaultRoles(storeId)
  
  if (ownerRoleId) {
    await supabase
      .from('store_members')
      .update({ role_id: ownerRoleId })
      .eq('store_id', storeId)
      .eq('user_id', user.id)
  }

  revalidatePath('/', 'layout')
  redirect('/home') // 변경: dashboard -> home
}

// 1. 초대/소속 상태 조회 (단일 매장 호환용 - deprecated 예정)
export async function getInvitationStatus() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { status: 'none' as const }

  const { data: member } = await supabase
    .from('store_members')
    .select(`
      id,
      role,
      status,
      store:stores (
        id,
        name,
        description
      )
    `)
    .eq('user_id', user.id)
    .single()

  if (!member) return { status: 'none' as const }

  const store = Array.isArray(member.store) ? member.store[0] : member.store

  return {
    status: member.status,
    store: store as { id: string; name: string; description: string },
    role: member.role,
  }
}

// 1.1 사용자 초대 목록 조회 (New)
export async function getUserInvitations() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  const { data: invitations } = await supabase
    .from('store_members')
    .select(`
      id,
      role,
      status,
      invited_at:joined_at,
      store:stores (
        id,
        name,
        description
      )
    `)
    .eq('user_id', user.id)
    .eq('status', 'invited')
    .order('joined_at', { ascending: false })

  if (!invitations) return []

  return invitations.map(invitation => ({
    ...invitation,
    store: Array.isArray(invitation.store) ? invitation.store[0] : invitation.store
  }))
}

// 2. 초대 수락
export async function acceptInvitation(storeId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  // 직원이 초대를 수락하더라도 점주의 최종 확인 전까지는 'pending_approval'(합류 대기) 상태로 둡니다.
  const { error } = await supabase
    .from('store_members')
    .update({ status: 'pending_approval', joined_at: new Date().toISOString() })
    .eq('store_id', storeId)
    .eq('user_id', user.id)
    .eq('status', 'invited')

  if (error) {
    return { error: '초대 수락 중 오류가 발생했습니다: ' + error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/home')
}

// 2.1 초대 거절 (New)
export async function rejectInvitation(storeId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('store_members')
    .delete()
    .eq('store_id', storeId)
    .eq('user_id', user.id)
    .eq('status', 'invited')

  if (error) return { error: error.message }

  revalidatePath('/home')
  return { success: true }
}

// 3. 가입 요청 취소
export async function cancelRequest(storeId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('store_members')
    .delete()
    .eq('store_id', storeId)
    .eq('user_id', user.id)
    .eq('status', 'pending_approval')

  if (error) return { error: error.message }

  revalidatePath('/home')
}

// 4. 매장 코드로 매장 찾기 (RPC 사용)
export async function verifyInviteCode(code: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase.rpc('verify_invite_code', { code })

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: '유효하지 않은 매장 코드입니다.' }

  return { store: data[0] }
}

// 5. 매장 코드로 가입 요청
export async function joinStoreByCode(code: string, name: string, phone: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  // 1. 매장 찾기
  const verifyResult = await verifyInviteCode(code)
  if (verifyResult.error || !verifyResult.store) {
    return { error: verifyResult.error || '매장을 찾을 수 없습니다.' }
  }

  const storeId = verifyResult.store.id

  // 2. 중복 신청 확인
  const { data: existing } = await supabase
    .from('store_members')
    .select('id')
    .eq('store_id', storeId)
    .eq('user_id', user.id)
    .single()

  if (existing) {
    return { error: '이미 해당 매장의 멤버이거나 신청 중입니다.' }
  }

  // 3. 프로필 정보 업데이트 (비어있는 경우에만)
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone')
    .eq('id', user.id)
    .single()

  if (profile) {
    const updates: { full_name?: string; phone?: string } = {}
    if (!profile.full_name) updates.full_name = name
    if (!profile.phone) updates.phone = phone

    if (Object.keys(updates).length > 0) {
      await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
    }
  }

  // 4. 수기 등록 직원 매칭 시도
  // 이름과 전화번호가 일치하는 수기 등록 직원(user_id is null)이 있으면 해당 레코드를 승계합니다.
  let claimed = false
  try {
    const { data: claimResult, error: claimError } = await supabase.rpc('claim_manual_staff', {
      store_id_param: storeId,
      name_param: name,
      phone_param: phone,
    })

    if (claimError) {
      console.error('Claim manual staff error:', claimError)
    } else {
      claimed = !!claimResult
    }
  } catch (err) {
    console.error('Exception during claim_manual_staff:', err)
  }

  // 매칭 성공 시 종료
  if (claimed) {
    revalidatePath('/', 'layout')
    redirect('/home')
  }

  // 5. 가입 요청 (Pending Approval) - 매칭된 직원이 없을 경우
  const { error } = await supabase.from('store_members').insert({
    store_id: storeId,
    user_id: user.id,
    role: 'staff',
    status: 'pending_approval',
    name,
    phone,
    email: user.email,
    joined_at: new Date().toISOString(),
  })

  if (error) {
    return { error: '가입 요청 중 오류가 발생했습니다: ' + error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/home')
}
