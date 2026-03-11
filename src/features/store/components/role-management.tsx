'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Role, Permission, createRole, updateRole, deleteRole, updateRolePermissions, getRolePermissions, ensureDefaultRoles } from '@/features/store/roles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus, Trash2, Save, Shield, Lock, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const permissionDescriptions: Record<string, string> = {
  'manage_inventory': '재고 수량을 수정하고 입출고 내역을 관리합니다.',
  'manage_menu': '메뉴 정보를 수정하고 카테고리를 관리합니다.',
  'manage_schedule': '직원 근무 일정을 생성, 수정, 삭제합니다.',
  'view_schedule': '전체 직원의 근무 일정을 조회합니다.',
  'manage_tasks': '업무를 생성, 수정, 삭제하고 직원에게 할당합니다.',
  'view_tasks': '매장의 모든 업무 목록을 조회합니다.',
  'manage_staff': '직원 정보를 수정하고 역할을 관리합니다.',
  'view_staff': '직원 목록과 연락처 등 기본 정보를 조회합니다.',
  'view_salary': '직원의 급여 정보를 조회합니다.',
  'manage_store': '매장 기본 정보를 수정합니다.',
}

interface RoleManagementProps {
  storeId: string
  roles: Role[]
  permissions: Permission[]
}

export function RoleManagement({ storeId, roles, permissions }: RoleManagementProps) {
  const router = useRouter()
  const [selectedRole, setSelectedRole] = useState<Role | null>(roles.length > 0 ? roles[0] : null)
  const [rolePermissions, setRolePermissions] = useState<string[]>([])
  const [initialRolePermissions, setInitialRolePermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  
  // Form State for Editing
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('#808080')

  // Calculate isDirty
  const isDirty = useMemo(() => {
    if (!selectedRole) return false
    
    const isNameChanged = selectedRole.name !== editName
    const isColorChanged = (selectedRole.color || '#808080') !== editColor
    
    const sortedInitial = [...initialRolePermissions].sort()
    const sortedCurrent = [...rolePermissions].sort()
    const isPermissionsChanged = JSON.stringify(sortedInitial) !== JSON.stringify(sortedCurrent)
    
    return isNameChanged || isColorChanged || isPermissionsChanged
  }, [selectedRole, editName, editColor, rolePermissions, initialRolePermissions])

  // Group permissions by category
  const permissionGroups = permissions.reduce((acc, perm) => {
    // Assuming category exists, or map code prefix to category
    const category = getCategoryName(perm.code)
    if (!acc[category]) acc[category] = []
    acc[category].push(perm)
    return acc
  }, {} as Record<string, Permission[]>)

  function getCategoryName(code: string) {
    if (code.startsWith('manage_store')) return '매장 관리'
    if (code.startsWith('manage_staff') || code === 'view_staff' || code === 'view_salary') return '직원 관리'
    if (code.includes('sales')) return '매출 관리'
    if (code.includes('menu') || code.includes('inventory')) return '상품/재고 관리'
    if (code.includes('schedule')) return '근무표 관리'
    if (code.includes('tasks')) return '업무 관리'
    return '기타'
  }

  // Fetch permissions when role is selected
  // Ensure default roles exist when component mounts
  useEffect(() => {
    ensureDefaultRoles(storeId).catch(console.error)
  }, [storeId])

  // Fetch permissions when role is selected
  useEffect(() => {
    if (selectedRole) {
      setEditName(selectedRole.name)
      setEditColor(selectedRole.color || '#808080')
      
      // Fetch permissions for this role
      setLoading(true)
      getRolePermissions(selectedRole.id)
        .then(perms => {
          setRolePermissions(perms)
          setInitialRolePermissions(perms)
        })
        .catch(err => {
          console.error(err)
          toast.error('권한 정보를 불러오는데 실패했습니다.')
        })
        .finally(() => setLoading(false))
    }
  }, [selectedRole])

  // Update selectedRole when roles list changes (e.g. after add/delete)
  useEffect(() => {
    if (selectedRole) {
      const updated = roles.find(r => r.id === selectedRole.id)
      if (updated) setSelectedRole(updated)
      else if (roles.length > 0) setSelectedRole(roles[0])
      else setSelectedRole(null)
    } else if (roles.length > 0) {
      setSelectedRole(roles[0])
    }
  }, [roles])

  const handleCreateRole = async () => {
    const name = prompt('새로운 역할의 이름을 입력하세요:')
    if (!name) return

    setLoading(true)
    const result = await createRole(storeId, name, '#808080')
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('역할이 생성되었습니다.')
      if (result.data) {
        setSelectedRole(result.data)
      }
    }
  }

  const handleDeleteRole = async () => {
    if (!selectedRole || selectedRole.priority >= 100) return
    if (!confirm(`'${selectedRole.name}' 역할을 삭제하시겠습니까?`)) return

    setLoading(true)
    const result = await deleteRole(storeId, selectedRole.id)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('역할이 삭제되었습니다.')
      setSelectedRole(null) // Will be handled by useEffect
    }
  }

  const handleSaveChanges = async () => {
    if (!selectedRole) return

    setLoading(true)
    let hasError = false
    
    // 1. Update basic info
    if (selectedRole.name !== editName || selectedRole.color !== editColor) {
      const result = await updateRole(storeId, selectedRole.id, { 
        name: editName, 
        color: editColor 
      })
      if (result.error) {
        toast.error('역할 정보 수정 실패: ' + result.error)
        hasError = true
      }
    }

    // 2. Update permissions
    if (!hasError) {
      const result = await updateRolePermissions(storeId, selectedRole.id, rolePermissions)
      
      if (result.error) {
        toast.error('권한 설정 저장 실패: ' + result.error)
        hasError = true
      }
    }

    setLoading(false)

    if (!hasError) {
      toast.success('변경사항이 저장되었습니다.')
      // Update initial state to reflect saved changes
      // In reality, the roles prop will update due to revalidatePath, causing useEffect to run
      // But we can optimistically update initialPermissions here if needed
      setInitialRolePermissions([...rolePermissions])
      // selectedRole will be updated via useEffect when parent re-renders with new data
    }
  }

  const handleReset = () => {
    if (selectedRole) {
      setEditName(selectedRole.name)
      setEditColor(selectedRole.color || '#808080')
      setRolePermissions([...initialRolePermissions])
      toast.info('변경사항이 초기화되었습니다.')
    }
  }

  const togglePermission = (code: string) => {
    if (selectedRole && selectedRole.priority >= 100) return // Owner permissions cannot be changed
    
    setRolePermissions(prev => 
      prev.includes(code) 
        ? prev.filter(c => c !== code) 
        : [...prev, code]
    )
  }

  const isOwner = selectedRole ? selectedRole.priority >= 100 : false

  return (
    <div className="flex flex-col md:flex-row gap-6 min-h-[600px]">
      {/* Left Column: Role List */}
      <div className="w-full md:w-64 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">역할 목록</h3>
          <Button size="sm" variant="outline" onClick={handleCreateRole} disabled={loading}>
            <Plus className="h-4 w-4 mr-1" /> 추가
          </Button>
        </div>
        <ScrollArea className="flex-1 border rounded-md p-2 bg-background">
          <div className="space-y-1">
            {roles.map(role => (
              <button
                key={role.id}
                onClick={() => setSelectedRole(role)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-between",
                  selectedRole?.id === role.id 
                    ? "bg-primary/10 text-primary" 
                    : "hover:bg-muted text-muted-foreground"
                )}
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full shrink-0" 
                    style={{ backgroundColor: role.color || '#808080' }}
                  />
                  <span className="truncate">{role.name}</span>
                </div>
                {role.priority >= 100 && <Lock className="h-3 w-3 opacity-50" />}
              </button>
            ))}
          </div>
        </ScrollArea>
        <div className="text-xs text-muted-foreground px-1">
          <p>드래그하여 우선순위를 변경할 수 있습니다. (추후 지원)</p>
        </div>
      </div>

      {/* Right Column: Role Details & Permissions */}
      <div className="flex-1 flex flex-col gap-4 border rounded-md p-6 bg-background">
        {selectedRole ? (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between pb-4 border-b">
              <div className="space-y-1">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  {isOwner ? (
                    <>
                      {editName} <Badge variant="secondary">시스템 관리자</Badge>
                    </>
                  ) : (
                    "역할 설정"
                  )}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {isOwner 
                    ? "점주는 모든 권한을 가지며 수정할 수 없습니다." 
                    : "역할의 이름과 권한을 설정합니다."}
                </p>
              </div>
              {!isOwner && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleDeleteRole}
                  disabled={loading}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  역할 삭제
                </Button>
              )}
            </div>

            <div className="flex flex-col gap-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="roleName">역할 이름</Label>
                  <Input 
                    id="roleName" 
                    value={editName} 
                    onChange={e => setEditName(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="roleColor">역할 색상</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="roleColor" 
                      type="color" 
                      value={editColor} 
                      onChange={e => setEditColor(e.target.value)}
                      className="w-12 p-1 cursor-pointer"
                      disabled={loading}
                    />
                    <Input 
                      value={editColor} 
                      onChange={e => setEditColor(e.target.value)}
                      className="uppercase"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Permissions */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label className="text-base">권한 설정</Label>
                  {isOwner && <span className="text-xs text-muted-foreground">모든 권한 허용됨</span>}
                </div>
                
                <div className="pr-4">
                  <div className="space-y-6">
                    {Object.entries(permissionGroups).map(([category, perms]) => (
                      <div key={category} className="space-y-3">
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                          {category}
                        </h4>
                        <div className="grid gap-2">
                          {perms.map(perm => (
                            <div 
                              key={perm.code} 
                              className={cn(
                                "flex items-start space-x-3 p-2 rounded-md transition-colors",
                                isOwner ? "opacity-70" : "hover:bg-muted/50"
                              )}
                            >
                              <Checkbox 
                                id={perm.code} 
                                checked={isOwner || rolePermissions.includes(perm.code)}
                                onCheckedChange={() => togglePermission(perm.code)}
                                disabled={isOwner || loading}
                              />
                              <div className="grid gap-1.5 leading-none">
                                <Label 
                                  htmlFor={perm.code}
                                  className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer")}
                                >
                                  {perm.description || perm.code}
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                  {permissionDescriptions[perm.code] || perm.code}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Shield className="h-12 w-12 mb-4 opacity-20" />
            <p>좌측 목록에서 역할을 선택하거나</p>
            <p>새로운 역할을 추가하세요.</p>
          </div>
        )}
      </div>

      {/* Floating Save Bar */}
      <div className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-3xl px-4 transition-all duration-300 ease-in-out transform z-50",
        isDirty ? "translate-y-0 opacity-100" : "translate-y-24 opacity-0 pointer-events-none"
      )}>
        <div className="bg-background text-foreground p-4 rounded-xl shadow-2xl flex items-center justify-between border border-border">
          <div className="flex items-center gap-2 px-2">
            <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
            <span className="text-sm font-medium">변경사항이 감지되었습니다.</span>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleReset}
              className="text-muted-foreground hover:text-foreground"
              disabled={loading}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              재설정
            </Button>
            <Button 
              onClick={handleSaveChanges} 
              size="sm"
              disabled={loading}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading ? '저장 중...' : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  변경사항 저장
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
