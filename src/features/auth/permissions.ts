import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'

export type PermissionCode =
  // 📦 매장 및 시스템
  | 'manage_store'
  | 'manage_roles'
  | 'view_dashboard'
  // 👥 인사 및 근로
  | 'view_staff'
  | 'manage_staff'
  | 'view_salary'
  | 'manage_payroll'
  // ⏰ 일정 및 근태
  | 'view_schedule'
  | 'manage_schedule'
  | 'view_attendance'
  | 'manage_attendance'
  | 'view_leave'
  | 'manage_leave'
  // 📊 운영 및 업무
  | 'view_tasks'
  | 'manage_tasks'
  | 'view_sales'
  | 'manage_inventory'
  | 'manage_menu'

// 캐싱을 통해 동일한 요청 내에서 중복 DB 조회를 방지
export const getStoreMemberRole = cache(async (userId: string, storeId: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('store_members')
    .select('role, role_id, status')
    .eq('user_id', userId)
    .eq('store_id', storeId)
    .single()
  
  if (error || !data) return null
  return data // Returns { role: string, role_id: string | null, status: string }
})

export async function hasPermission(
  userId: string,
  storeId: string,
  permission: PermissionCode
): Promise<boolean> {
  const member = await getStoreMemberRole(userId, storeId)
  
  if (!member) return false

  // 비활성(inactive)이거나 승인 대기(pending_approval) 상태인 경우 권한 제한
  if (member.status !== 'active') {
    // 관리 권한(manage_*)이나 민감한 조회 권한(view_salary 등)은 모두 차단
    if (permission.startsWith('manage_') || permission === 'view_salary') {
      return false
    }
  }
  
  // 1. Owner always has full permissions (활성 상태일 때만 위에서 통과됨. owner가 active가 아닌 경우는 드물지만 방어적 프로그래밍)
  if (member.role === 'owner') return true 

  const supabase = await createClient()
  
  // 2. Check permission via new store_role_permissions table (if role_id exists)
  if (member.role_id) {
    const { data } = await supabase
      .from('store_role_permissions')
      .select('permission_code')
      .eq('role_id', member.role_id)
      .eq('permission_code', permission)
      .single()

    if (data) return true
    
    // role_id가 있다면 커스텀 직급 및 권한 설정이 적용된 것이므로, 
    // 레거시 role_permissions로 폴백하지 않고 해당 권한이 없음을 반환 (토글 끔 동작을 위해)
    return false
  }

  // 3. Fallback: Check legacy role_permissions table
  // This ensures backward compatibility if migration hasn't run fully or for system roles
  if (member.role) {
    const { data } = await supabase
      .from('role_permissions')
      .select('permission_code')
      .eq('role', member.role)
      .eq('permission_code', permission)
      .single()

    if (data) return true
  }

  return false
}

export async function requirePermission(
  userId: string,
  storeId: string,
  permission: PermissionCode
) {
  const allowed = await hasPermission(userId, storeId, permission)
  if (!allowed) {
    throw new Error(`Permission denied: ${permission}`)
  }
}