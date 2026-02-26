'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/features/auth/permissions'

export async function inviteStaff(storeId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  // 1. 권한 체크
  try {
    await requirePermission(user.id, storeId, 'manage_staff')
  } catch (error) {
    return { error: '권한이 없습니다.' }
  }

  const email = formData.get('email') as string
  if (!email) {
    return { error: '이메일을 입력해주세요.' }
  }

  // 2. 이메일로 사용자 조회 (profiles 테이블)
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (!profile) {
    return { error: '해당 이메일로 가입된 사용자를 찾을 수 없습니다.' }
  }

  // 3. 이미 멤버인지 확인
  const { data: existingMember } = await supabase
    .from('store_members')
    .select('id')
    .eq('store_id', storeId)
    .eq('user_id', profile.id)
    .single()

  if (existingMember) {
    return { error: '이미 매장에 등록된 직원입니다.' }
  }

  // 4. 멤버 추가 (초대 상태)
  const { error } = await supabase.from('store_members').insert({
    store_id: storeId,
    user_id: profile.id,
    role: 'staff',
    status: 'invited',
    joined_at: new Date().toISOString(),
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/staff')
  return { success: true }
}