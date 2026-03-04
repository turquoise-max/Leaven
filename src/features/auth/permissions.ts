import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'

export type PermissionCode = 
  | 'manage_store'
  | 'manage_staff'
  | 'view_sales'
  | 'manage_menu'
  | 'manage_inventory'
  | 'view_schedule'
  | 'manage_schedule'

// 캐싱을 통해 동일한 요청 내에서 중복 DB 조회를 방지
export const getStoreMemberRole = cache(async (userId: string, storeId: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('store_members')
    .select('role, role_id')
    .eq('user_id', userId)
    .eq('store_id', storeId)
    .single()
  
  if (error || !data) return null
  return data // Returns { role: string, role_id: string | null }
})

export async function hasPermission(
  userId: string,
  storeId: string,
  permission: PermissionCode
): Promise<boolean> {
  const member = await getStoreMemberRole(userId, storeId)
  
  if (!member) return false
  
  // 1. Owner always has full permissions
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