'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath, unstable_noStore as noStore } from 'next/cache'

export type Role = {
  id: string
  store_id: string
  name: string
  color: string
  is_system: boolean
  priority: number
  parent_id: string | null
  created_at: string
}

export type Permission = {
  code: string
  name: string
  description: string
  category: string
}

export async function getStoreRoles(storeId: string) {
  const supabase = await createClient()
  
  try {
    const { data: roles, error } = await supabase
      .from('store_roles')
      .select('*')
      .eq('store_id', storeId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('getStoreRoles error:', error)
      return []
    }
    return roles as Role[]
  } catch (err) {
    console.error('getStoreRoles exception:', err)
    return []
  }
}

export async function getStorePermissions() {
  noStore() // 권한 목록은 자주 바뀌지 않지만, 업데이트 직후 반영을 위해 캐시 무효화
  const supabase = await createClient()
  
  try {
    const { data: permissions, error } = await supabase
      .from('permissions')
      .select('*')
      .order('code')

    if (error) {
      console.error('getStorePermissions error:', error)
      return []
    }
    return permissions as Permission[]
  } catch (err) {
    console.error('getStorePermissions exception:', err)
    return []
  }
}

export async function getRolePermissions(roleId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('store_role_permissions')
    .select('permission_code')
    .eq('role_id', roleId)

  if (error) throw error
  return data.map(p => p.permission_code) as string[]
}

export async function createRole(storeId: string, name: string, color: string, parentId?: string | null) {
  const supabase = await createClient()
  
  // Get max priority to add to the bottom (but above staff)
  // Or just add with 0 priority? Let's add with 10 (above staff 0, below manager 50)
  
  const { data, error } = await supabase
    .from('store_roles')
    .insert({
      store_id: storeId,
      name,
      color,
      is_system: false,
      priority: 10,
      parent_id: parentId || null
    })
    .select()
    .single()

  if (error) return { error: error.message }
  
  revalidatePath(`/dashboard/settings`)
  return { data }
}

export async function updateRole(storeId: string, roleId: string, data: { name?: string, color?: string, parent_id?: string | null }) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('store_roles')
    .update(data)
    .eq('id', roleId)
    .eq('store_id', storeId) // Security check

  if (error) return { error: error.message }
  
  revalidatePath(`/dashboard/settings`)
  return { success: true }
}

// 역할 삭제 전, 해당 역할을 사용 중인 직원 목록을 확인하는 함수
export async function checkRoleUsage(storeId: string, roleId: string) {
  const supabase = await createClient()
  
  const { data: usingMembers, error } = await supabase
    .from('store_members')
    .select('id, name, status, profile:profiles(full_name)')
    .eq('role_id', roleId)
    .eq('store_id', storeId)

  if (error) {
    return { error: error.message }
  }

  const affectedMembers = (usingMembers || []).map(m => {
    const profileInfo = Array.isArray(m.profile) ? m.profile[0] : m.profile
    const prof = profileInfo as any
    return {
      id: m.id,
      name: m.name || prof?.full_name || '이름 없음',
      status: m.status
    }
  })
  
  return { affectedMembers }
}

export async function deleteRole(storeId: string, roleId: string) {
  const supabase = await createClient()
  
  // Check if it's the owner role (priority >= 100)
  const { data: role } = await supabase.from('store_roles').select('priority').eq('id', roleId).single()
  if (role && role.priority >= 100) {
    return { error: '최고 관리자(점주) 역할은 삭제할 수 없습니다.' }
  }

  // ON DELETE SET NULL 제약조건이 있으므로 store_roles 에서 삭제하면
  // 해당 역할을 가지고 있던 store_members 의 role_id 는 자동으로 null(역할 미설정)이 됩니다.
  
  const { error } = await supabase
    .from('store_roles')
    .delete()
    .eq('id', roleId)
    .eq('store_id', storeId)

  if (error) return { error: error.message }
  
  revalidatePath(`/dashboard/settings`)
  return { success: true }
}

export async function updateRolePermissions(storeId: string, roleId: string, permissionCodes: string[]) {
  const supabase = await createClient()
  
  // Security check: ensure role belongs to store
  const { data: role } = await supabase
    .from('store_roles')
    .select('id')
    .eq('id', roleId)
    .eq('store_id', storeId)
    .single()
    
  if (!role) return { error: 'Role not found' }

  // 1. Delete existing permissions
  const { error: deleteError } = await supabase
    .from('store_role_permissions')
    .delete()
    .eq('role_id', roleId)
  
  if (deleteError) return { error: deleteError.message }
  
  // 2. Insert new permissions
  if (permissionCodes.length > 0) {
    const { error: insertError } = await supabase
      .from('store_role_permissions')
      .insert(
        permissionCodes.map(code => ({
          role_id: roleId,
          permission_code: code
        }))
      )
    
    if (insertError) return { error: insertError.message }
  }
  
  revalidatePath(`/dashboard/settings`)
  return { success: true }
}

export async function ensureDefaultRoles(storeId: string) {
  const supabase = await createClient()

  // 1. Check if roles exist
  const { data: existingRoles } = await supabase
    .from('store_roles')
    .select('id, name')
    .eq('store_id', storeId)
  
  if (existingRoles && existingRoles.length > 0) {
    return { 
      ownerRoleId: existingRoles.find(r => r.name === '점주')?.id 
    }
  }

  // 2. Create default roles
  const defaultRoles = [
    {
      store_id: storeId,
      name: '점주',
      color: '#7c3aed', // Violet
      is_system: true,
      priority: 100
    },
    {
      store_id: storeId,
      name: '매니저',
      color: '#4f46e5', // Indigo
      is_system: false,
      priority: 50
    },
    {
      store_id: storeId,
      name: '직원',
      color: '#808080', // Gray
      is_system: false,
      priority: 0
    }
  ]
  
  const { data: createdRoles, error } = await supabase
    .from('store_roles')
    .insert(defaultRoles)
    .select()

  if (error) {
    console.error('Failed to create default roles:', error)
    return {}
  }
  
  return {
    ownerRoleId: createdRoles?.find(r => r.name === '점주')?.id
  }
}
