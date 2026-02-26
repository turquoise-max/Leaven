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
    .select('role')
    .eq('user_id', userId)
    .eq('store_id', storeId)
    .single()
  
  if (error || !data) return null
  return data.role
})

export async function hasPermission(
  userId: string,
  storeId: string,
  permission: PermissionCode
): Promise<boolean> {
  const role = await getStoreMemberRole(userId, storeId)
  
  if (!role) return false
  if (role === 'owner') return true // Owner는 모든 권한을 가짐 (DB 조회 줄이기 위한 최적화)

  const supabase = await createClient()
  
  // role_permissions 테이블 조회
  const { data } = await supabase
    .from('role_permissions')
    .select('permission_code')
    .eq('role', role)
    .eq('permission_code', permission)
    .single()

  return !!data
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