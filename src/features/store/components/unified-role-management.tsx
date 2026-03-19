'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Role, Permission, createRole, updateRole, deleteRole, checkRoleUsage, updateRolePermissions, getRolePermissions, ensureDefaultRoles } from '@/features/store/roles'
import { Task } from '@/features/schedule/task-actions'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CreateRoleTaskDialog } from '@/features/schedule/components/create-role-task-dialog'
import { EditRoleTaskDialog } from '@/features/schedule/components/edit-role-task-dialog'
import { toKSTISOString } from '@/lib/date-utils'
import { CalendarDays, Clock, ListChecks, Edit2, Star, BookOpen, AlertCircle, Sun, Coffee, Moon, CheckSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus, Trash2, Save, Shield, Lock, RotateCcw, AlertTriangle, Users, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

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

interface UnifiedRoleManagementProps {
  storeId: string
  roles: Role[]
  permissions: Permission[]
  taskTemplates: Task[]
}

function PlaybookItem({ task, storeId }: { task: Task, storeId: string }) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  
  const formatTime = (isoString?: string | null) => {
    if (!isoString) return ''
    return toKSTISOString(isoString).substring(11, 16)
  }

  return (
    <>
      <div className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:border-primary/40 hover:shadow-sm transition-all group relative">
        <div className="w-14 shrink-0 flex justify-center mt-0.5">
          {task.task_type === 'always' ? (
            <Badge variant="secondary" className="w-full justify-center text-[10px] font-medium bg-muted text-muted-foreground">상시</Badge>
          ) : (
            <Badge variant="outline" className="w-full justify-center text-[11px] font-medium bg-primary/5 text-primary border-primary/20 tracking-tighter px-0">
              {formatTime(task.start_time)}
            </Badge>
          )}
        </div>
        
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span className="font-medium text-[13px] text-foreground flex items-center gap-1.5">
              {task.title}
              {task.is_critical && <Star className="w-3 h-3 fill-destructive text-destructive" />}
            </span>
          </div>
          {task.description && (
            <p className="text-[11px] text-muted-foreground mt-1 whitespace-pre-wrap">{task.description}</p>
          )}
        </div>

        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2" 
          onClick={() => setIsEditDialogOpen(true)}
        >
          <Edit2 className="h-3 w-3 text-muted-foreground" />
        </Button>
      </div>
      
      <EditRoleTaskDialog 
        task={task} 
        open={isEditDialogOpen} 
        onOpenChange={setIsEditDialogOpen} 
        storeId={storeId} 
        hideRoleSelection={true}
        hideEndTime={true}
        hideTaskType={true}
      />
    </>
  )
}

export function UnifiedRoleManagement({ storeId, roles, permissions, taskTemplates }: UnifiedRoleManagementProps) {
  const router = useRouter()
  const [selectedRole, setSelectedRole] = useState<Role | null>(roles.length > 0 ? roles[0] : null)
  const [rolePermissions, setRolePermissions] = useState<string[]>([])
  const [initialRolePermissions, setInitialRolePermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  
  // Form State for Editing
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('#808080')
  const [editParentId, setEditParentId] = useState<string | null>(null)

  // Delete Confirmation State
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    open: boolean
    affectedMembers: { id: string, name: string, status: string }[]
  }>({
    open: false,
    affectedMembers: []
  })

  // Calculate isDirty
  const isDirty = useMemo(() => {
    if (!selectedRole) return false
    
    const isNameChanged = selectedRole.name !== editName
    const isColorChanged = (selectedRole.color || '#808080') !== editColor
    const isParentChanged = selectedRole.parent_id !== editParentId
    
    const sortedInitial = [...initialRolePermissions].sort()
    const sortedCurrent = [...rolePermissions].sort()
    const isPermissionsChanged = JSON.stringify(sortedInitial) !== JSON.stringify(sortedCurrent)
    
    return isNameChanged || isColorChanged || isParentChanged || isPermissionsChanged
  }, [selectedRole, editName, editColor, editParentId, rolePermissions, initialRolePermissions])

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
      setEditParentId(selectedRole.parent_id || null)
      
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
    const name = prompt('새로운 직급/역할의 이름을 입력하세요:')
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

  const handleDeleteClick = async () => {
    if (!selectedRole || selectedRole.priority >= 100) return
    
    setLoading(true)
    // 역할 삭제 전 해당 역할을 사용하는 직원이 있는지 확인
    const result = await checkRoleUsage(storeId, selectedRole.id)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    // 직원이 있든 없든 동일한 경고 모달을 띄움
    setDeleteConfirmDialog({
      open: true,
      affectedMembers: result.affectedMembers || []
    })
  }

  const handleConfirmDelete = async () => {
    if (!selectedRole || selectedRole.priority >= 100) return

    setLoading(true)
    // 모달에서 최종 확인을 눌렀으므로 삭제 진행
    const result = await deleteRole(storeId, selectedRole.id)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('역할이 삭제되었습니다.')
      setDeleteConfirmDialog({ open: false, affectedMembers: [] })
      setSelectedRole(null)
    }
  }

  const handleSaveChanges = async () => {
    if (!selectedRole) return

    setLoading(true)
    let hasError = false
    
    // 1. Update basic info
    if (selectedRole.name !== editName || selectedRole.color !== editColor || selectedRole.parent_id !== editParentId) {
      const result = await updateRole(storeId, selectedRole.id, { 
        name: editName, 
        color: editColor,
        parent_id: editParentId
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
      setEditParentId(selectedRole.parent_id || null)
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

  // Filter tasks for the selected role
  // 상시 업무(always)는 제외하고, 시간 지정 업무(scheduled)만 가져옴
  const roleTasks = useMemo(() => {
    if (!selectedRole) return []
    return taskTemplates.filter(t => 
      (t.assigned_role_ids?.includes(selectedRole.id) || t.assigned_role_ids?.includes('all')) && 
      t.task_type !== 'always' && t.start_time
    )
  }, [taskTemplates, selectedRole])

  // Sort role tasks
  const scheduledTasks = useMemo(() => {
    return roleTasks.sort((a, b) => {
      const timeA = toKSTISOString(a.start_time!).substring(11, 16)
      const timeB = toKSTISOString(b.start_time!).substring(11, 16)
      return timeA.localeCompare(timeB)
    })
  }, [roleTasks])

  // Task count map for tree view badges
  const taskCountMap = useMemo(() => {
    const counts: Record<string, number> = {}
    taskTemplates.forEach(t => {
      const assignedIds = t.assigned_role_ids || []
      assignedIds.forEach(rid => {
        counts[rid] = (counts[rid] || 0) + 1
      })
    })
    return counts
  }, [taskTemplates])

  // Tree representation
  type TreeNode = Role & { children: TreeNode[] }
  const roleTree = useMemo(() => {
    const rootNodes: TreeNode[] = []
    const map = new Map<string, TreeNode>()
    
    roles.forEach(r => {
      map.set(r.id, { ...r, children: [] })
    })

    roles.forEach(r => {
      const node = map.get(r.id)!
      if (r.parent_id && map.has(r.parent_id)) {
        map.get(r.parent_id)!.children.push(node)
      } else {
        rootNodes.push(node)
      }
    })

    return rootNodes
  }, [roles])

  const renderRoleTree = (nodes: TreeNode[], depth = 0) => {
    return nodes.map((role) => (
      <div key={role.id} className="flex flex-col">
        <button
          onClick={() => setSelectedRole(role)}
          className={cn(
            "w-full text-left p-3 mb-2 rounded-lg border transition-all flex items-center justify-between",
            selectedRole?.id === role.id 
              ? "border-primary bg-primary/5 ring-1 ring-primary/20" 
              : "border-border/50 bg-card hover:bg-muted/50 hover:border-border"
          )}
          style={{ marginLeft: `${depth * 1.5}rem`, width: `calc(100% - ${depth * 1.5}rem)` }}
        >
          <div className="flex items-center gap-3 relative">
            {depth > 0 && (
              <div className="absolute -left-6 top-1/2 -translate-y-1/2 text-muted-foreground/30 text-sm font-light">
                ↳
              </div>
            )}
            <div 
              className="w-8 h-8 rounded-md flex items-center justify-center shrink-0" 
              style={{ backgroundColor: `${role.color || '#808080'}15`, color: role.color || '#808080' }}
            >
              <Users className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm truncate">{role.name}</span>
              {role.priority >= 100 ? (
                <span className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> 시스템 관리자
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                  {role.children.length > 0 && <span>하위 {role.children.length}팀</span>}
                  <span className="flex items-center gap-0.5 bg-muted/50 px-1 py-0.5 rounded border border-border/50">
                    <BookOpen className="w-2.5 h-2.5" /> {taskCountMap[role.id] || 0}
                  </span>
                </span>
              )}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0" />
        </button>
        {role.children.length > 0 && (
          <div className="flex flex-col">
            {renderRoleTree(role.children, depth + 1)}
          </div>
        )}
      </div>
    ))
  }

  return (
    <div className="flex flex-col md:flex-row min-h-[600px] h-[calc(100vh-8rem)]">
      {/* Left Column: Role List */}
      <div className="w-full md:w-80 flex flex-col border-r bg-muted/10">
        <div className="p-4 flex flex-col gap-1 border-b bg-background">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">직급 / 역할 목록</h3>
            <Button size="icon" variant="ghost" onClick={handleCreateRole} disabled={loading} className="h-8 w-8 text-primary hover:bg-primary/10">
              <Plus className="h-5 w-5" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">매장의 직무와 위계를 설정하세요.</p>
        </div>
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-1 relative">
            {renderRoleTree(roleTree)}
          </div>
        </ScrollArea>
      </div>

      {/* Right Column: Role Details & Permissions */}
      <div className="flex-1 flex flex-col bg-background overflow-hidden relative">
        {selectedRole ? (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-6 py-5 border-b">
              <div className="space-y-1">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  {isOwner ? (
                    <>
                      {editName} <Badge variant="secondary">시스템 관리자</Badge>
                    </>
                  ) : (
                    "직무 역할 및 플레이북 설정"
                  )}
                </h3>
                <p className="text-[13px] text-muted-foreground">
                  {isOwner 
                    ? "점주는 매장의 모든 권한을 가지며 수정할 수 없습니다." 
                    : "선택한 역할의 접근 권한을 설정하고 일일 업무 시나리오를 디자인합니다."}
                </p>
              </div>
              {!isOwner && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleDeleteClick}
                  disabled={loading}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  역할 삭제
                </Button>
              )}
            </div>

            <div className="flex-1 overflow-hidden">
              <Tabs defaultValue="permissions" className="w-full h-full flex flex-col">
                <div className="px-6 pt-2 border-b">
                  <TabsList className="bg-transparent space-x-2 h-10 p-0">
                    <TabsTrigger 
                      value="permissions" 
                      className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 pb-2 pt-2 font-medium"
                    >
                      기본 정보 및 시스템 권한
                    </TabsTrigger>
                    <TabsTrigger 
                      value="tasks" 
                      className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 pb-2 pt-2 font-medium flex items-center gap-1.5"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      업무 플레이북 (SOP)
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Permissions Tab */}
                <TabsContent value="permissions" className="flex-1 overflow-y-auto p-6 m-0 focus-visible:outline-none data-[state=inactive]:hidden flex flex-col gap-8">
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl">
                    <div className="space-y-2 md:col-span-1">
                      <Label htmlFor="roleName">역할(직급) 이름</Label>
                      <Input 
                        id="roleName" 
                        value={editName} 
                        onChange={e => setEditName(e.target.value)}
                        disabled={loading || isOwner}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-1">
                      <Label htmlFor="roleColor">구분 색상</Label>
                      <div className="flex gap-2">
                        <Input 
                          id="roleColor" 
                          type="color" 
                          value={editColor} 
                          onChange={e => setEditColor(e.target.value)}
                          className="w-12 p-1 cursor-pointer h-10"
                          disabled={loading || isOwner}
                        />
                        <Input 
                          value={editColor} 
                          onChange={e => setEditColor(e.target.value)}
                          className="uppercase font-mono text-sm h-10 flex-1"
                          disabled={loading || isOwner}
                        />
                      </div>
                    </div>
                    <div className="space-y-2 md:col-span-1">
                      <Label htmlFor="roleParent">직속 상위 관리자 (결재권자)</Label>
                      <select
                        id="roleParent"
                        value={editParentId || ''}
                        onChange={e => setEditParentId(e.target.value === '' ? null : e.target.value)}
                        disabled={loading || isOwner}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">(없음 / 해당사항 없음)</option>
                        {roles
                          .filter(r => r.id !== selectedRole?.id) // 자기 자신 제외
                          .map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <Separator />

                  {/* Permissions */}
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-1 border-b pb-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-lg font-semibold">시스템 접근 권한</Label>
                        {isOwner && <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-1 rounded">최고 권한 (수정 불가)</span>}
                      </div>
                      <p className="text-[13px] text-muted-foreground">이 직무를 수행하는 직원이 매장 관리 시스템에서 조회하거나 수정할 수 있는 메뉴와 기능을 제어합니다.</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8 max-w-4xl pb-24">
                    {Object.entries(permissionGroups).map(([category, perms]) => {
                      const allChecked = perms.every(p => rolePermissions.includes(p.code))
                      const someChecked = perms.some(p => rolePermissions.includes(p.code)) && !allChecked
                      
                      const handleToggleCategory = () => {
                        if (isOwner) return
                        if (allChecked) {
                          setRolePermissions(prev => prev.filter(c => !perms.some(p => p.code === c)))
                        } else {
                          setRolePermissions(prev => {
                            const next = [...prev]
                            perms.forEach(p => { if (!next.includes(p.code)) next.push(p.code) })
                            return next
                          })
                        }
                      }

                      return (
                        <div key={category} className="flex flex-col gap-3 bg-muted/20 p-4 rounded-xl border border-border/50">
                          <div className="flex items-center justify-between border-b border-border/50 pb-3">
                            <h4 className="text-[13px] font-bold text-foreground">
                              {category}
                            </h4>
                            {!isOwner && (
                              <button 
                                type="button" 
                                onClick={handleToggleCategory}
                                className="text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 font-medium"
                              >
                                <CheckSquare className={cn("w-3.5 h-3.5", allChecked ? "text-primary" : "opacity-40")} />
                                {allChecked ? '전체 해제' : '전체 선택'}
                              </button>
                            )}
                          </div>
                          
                          <div className="grid gap-4 mt-1">
                            {perms.map(perm => {
                              const isDangerous = perm.code.includes('salary') || perm.code.includes('store') || perm.code === 'manage_staff'
                              return (
                                <div 
                                  key={perm.code} 
                                  className={cn(
                                    "flex items-start space-x-3 p-2.5 rounded-lg transition-all",
                                    isOwner ? "opacity-60 grayscale" : "hover:bg-background shadow-sm border border-transparent hover:border-border/50",
                                    isDangerous && !isOwner && rolePermissions.includes(perm.code) ? "bg-orange-50/50 hover:border-orange-200" : ""
                                  )}
                                >
                                  <Checkbox 
                                    id={perm.code} 
                                    checked={isOwner || rolePermissions.includes(perm.code)}
                                    onCheckedChange={() => togglePermission(perm.code)}
                                    disabled={isOwner || loading}
                                    className={cn("mt-0.5", isDangerous && !isOwner && rolePermissions.includes(perm.code) ? "data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500" : "")}
                                  />
                                  <div className="flex flex-col gap-1 leading-none flex-1">
                                    <Label 
                                      htmlFor={perm.code}
                                      className={cn(
                                        "text-[13px] font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-1.5",
                                        isDangerous && !isOwner && rolePermissions.includes(perm.code) ? "text-orange-700" : "text-foreground"
                                      )}
                                    >
                                      {perm.description || perm.code}
                                      {isDangerous && <AlertTriangle className="w-3 h-3 text-orange-500" />}
                                    </Label>
                                    <p className="text-[11.5px] text-muted-foreground/80 leading-relaxed">
                                      {permissionDescriptions[perm.code] || perm.code}
                                    </p>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                    </div>
                  </div>
                </TabsContent>

                {/* Tasks Tab */}
                <TabsContent value="tasks" className="flex-1 overflow-y-auto p-0 m-0 focus-visible:outline-none data-[state=inactive]:hidden flex flex-col bg-slate-50/50">
                  <div className="p-6 border-b bg-background sticky top-0 z-10 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 bg-primary/10 text-primary rounded-xl mt-0.5 border border-primary/20">
                          <BookOpen className="w-6 h-6" />
                        </div>
                        <div className="flex flex-col justify-center h-11">
                          <h3 className="text-lg font-bold text-foreground">
                            직무 플레이북 (Role Playbook)
                          </h3>
                          <p className="text-[13px] text-muted-foreground mt-0.5">
                            <span className="font-semibold text-foreground/80">'{selectedRole.name}'</span> 포지션이 하루 동안 수행해야 할 시간대별 필수 여정을 설계합니다.
                          </p>
                        </div>
                      </div>
                      <CreateRoleTaskDialog 
                        storeId={storeId} 
                        initialRoleIds={[selectedRole.id]} 
                        hideRoleSelection={true}
                        hideEndTime={true}
                        hideTaskType={true}
                        trigger={
                          <Button className="gap-2 shadow-sm">
                            <Plus className="w-4 h-4" /> 가이드라인 추가
                          </Button>
                        } 
                      />
                    </div>
                  </div>

                  <div className="flex-1 p-6 pb-40 flex justify-center">
                    {roleTasks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-border/60 rounded-2xl bg-background/50 h-[350px] w-full max-w-3xl">
                        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                          <BookOpen className="w-8 h-8 text-muted-foreground/50" />
                        </div>
                        <p className="font-semibold text-foreground text-[16px]">플레이북이 비어있습니다</p>
                        <p className="text-[13px] mt-2 mb-6 text-center leading-relaxed text-muted-foreground">
                          오픈 준비, 휴식 시간, 마감 정산 등 이 포지션이 완벽하게 하루를<br/>보낼 수 있도록 타임라인 형태의 시나리오를 구성해 보세요.
                        </p>
                        <CreateRoleTaskDialog 
                          storeId={storeId} 
                          initialRoleIds={[selectedRole.id]} 
                          hideRoleSelection={true}
                          hideEndTime={true}
                          hideTaskType={true}
                          trigger={
                            <Button className="gap-2 px-6">
                              <Plus className="w-4 h-4" /> 첫 번째 가이드라인 추가하기
                            </Button>
                          }
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col gap-6 w-full max-w-3xl">
                        <div className="flex items-center justify-between border-b border-black/10 pb-3">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-primary" />
                            <h4 className="font-bold text-[15px] text-foreground tracking-tight">전체 업무 타임라인</h4>
                          </div>
                          <Badge variant="secondary" className="font-mono text-[11px] bg-primary/10 text-primary px-2">{scheduledTasks.length}개</Badge>
                        </div>
                        
                        <div className="flex flex-col gap-6 relative before:absolute before:inset-0 before:ml-[26px] before:-translate-x-px before:h-full before:w-[2px] before:bg-gradient-to-b before:from-primary/20 before:via-border/80 before:to-transparent pt-4">
                          <div className="flex flex-col gap-3 pl-14 pb-8 group/phase">
                            {scheduledTasks.map(task => (
                              <div key={task.id} className="relative group/item">
                                <div className="absolute -left-[30px] top-4 w-2 h-2 rounded-full bg-background border-[1.5px] border-primary ring-2 ring-background z-10" />
                                <PlaybookItem task={task} storeId={storeId} />
                              </div>
                            ))}
                            
                            <div className="relative py-1 mt-2 flex items-center transition-opacity opacity-0 group-hover/phase:opacity-100">
                              <CreateRoleTaskDialog 
                                storeId={storeId} 
                                initialRoleIds={[selectedRole.id]} 
                                hideRoleSelection={true}
                                hideEndTime={true}
                                hideTaskType={true}
                                trigger={
                                  <Button variant="ghost" size="sm" className="h-8 px-4 text-[12px] text-muted-foreground hover:text-primary hover:bg-primary/5 border border-dashed border-transparent hover:border-primary/30 rounded-lg w-full justify-start">
                                    <Plus className="w-3 h-3 mr-2" /> 새 가이드 추가하기
                                  </Button>
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Shield className="h-12 w-12 mb-4 opacity-20" />
            <p>좌측 목록에서 직무/역할을 선택하거나</p>
            <p>새로운 역할을 추가하세요.</p>
          </div>
        )}

        {/* Floating Save Bar */}
        <div className={cn(
          "absolute bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-2xl transition-all duration-300 ease-in-out transform z-50",
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
                초기화
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

      <AlertDialog 
        open={deleteConfirmDialog.open} 
        onOpenChange={(open) => {
          if (!loading) setDeleteConfirmDialog(prev => ({ ...prev, open }))
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              직급 삭제 경고
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 pt-2 text-foreground text-sm">
                <div>
                  현재 <span className="font-semibold">'{selectedRole?.name}'</span> 직급을 부여받은 직원이 <span className="font-semibold text-destructive">{deleteConfirmDialog.affectedMembers.length}명</span> 있습니다. 
                  <br />
                  삭제를 진행하면 아래 직원들의 직급이 <span className="font-semibold text-destructive">직급 미설정</span> 상태로 변경됩니다.
                </div>
                
                <div className="bg-muted p-3 rounded-md max-h-40 overflow-y-auto">
                  {deleteConfirmDialog.affectedMembers.length > 0 ? (
                    <ul className="space-y-2 text-sm">
                      {deleteConfirmDialog.affectedMembers.map(member => (
                        <li key={member.id} className="flex justify-between items-center bg-background/50 px-2 py-1.5 rounded border border-border/50">
                          <span>{member.name}</span>
                          <Badge variant="secondary" className="text-[10px]">
                            {member.status === 'active' ? '재직자' : 
                             member.status === 'inactive' ? '퇴사자' : '합류 대기'}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                      현재 이 직무/역할을 사용 중인 직원이 없습니다.
                    </div>
                  )}
                </div>
                
                <div className="font-medium text-destructive">
                  정말로 삭제를 진행하시겠습니까?
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>취소</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault()
                handleConfirmDelete()
              }} 
              className="bg-destructive hover:bg-destructive/90 text-white"
              disabled={loading}
            >
              {loading ? '삭제 중...' : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}