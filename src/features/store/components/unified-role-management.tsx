'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Role, Permission, createRole, updateRole, deleteRole, checkRoleUsage, updateRolePermissions, getRolePermissions, ensureDefaultRoles } from '@/features/store/roles'
import { Task } from '@/features/schedule/task-actions'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CreateRoleTaskDialog } from '@/features/schedule/components/create-role-task-dialog'
import { EditRoleTaskDialog } from '@/features/schedule/components/edit-role-task-dialog'
import { toKSTISOString } from '@/shared/lib/date-utils'
import { CalendarDays, Clock, ListChecks, Edit2, Star, BookOpen, AlertCircle, Sun, Coffee, Moon, CheckSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus, Trash2, Save, Shield, Lock, RotateCcw, AlertTriangle, Users, ChevronDown, ChevronRight, Check, X } from 'lucide-react'
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

const permissionTitles: Record<string, string> = {
  'view_dashboard': '대시보드 메인 확인',
  
  'manage_store': '매장 정보 수정',
  'manage_roles': '직급 및 권한 설정',
  
  'view_staff': '직원 명부 확인',
  'manage_staff': '직원 등록 및 수정',
  'view_salary': '급여/시급 확인',
  'manage_payroll': '급여 정산 및 관리',
  
  'view_schedule': '스케줄표 확인',
  'manage_schedule': '스케줄표 생성 및 삭제',
  'view_attendance': '출퇴근 기록 조회',
  'manage_attendance': '출퇴근 대리 처리 및 수정 승인',
  'view_leave': '휴가 및 연차 조회',
  'manage_leave': '휴가 승인 및 관리',
  
  'view_tasks': '할 일 확인',
  'manage_tasks': '개인 할 일 추가/삭제',
  'view_sales': '매출 및 결제 확인',
  'manage_inventory': '재고 채우기 및 관리',
  'manage_menu': '메뉴/가격 관리'
}

const permissionDescriptions: Record<string, string> = {
  'view_dashboard': '대시보드 첫 화면의 요약 정보를 볼 수 있습니다.',
  
  'manage_store': '매장 이름, 전화번호 등 기본 정보를 바꿀 수 있습니다.',
  'manage_roles': '새로운 직급을 만들거나, 직급별로 앱에서 할 수 있는 일을 정합니다.',
  
  'view_staff': '우리 매장 직원들의 연락처와 들어온 날짜 등을 볼 수 있습니다.',
  'manage_staff': '새 직원을 초대하거나, 직원 정보를 수정하고 그만둔 직원을 처리합니다.',
  'view_salary': '다른 직원의 민감한 시급이나 급여 정보를 볼 수 있습니다.',
  'manage_payroll': '직원들의 월급을 계산하고 명세서를 관리합니다.',
  
  'view_schedule': '본인의 스케줄을 확인하거나, 권한에 따라 전체 스케줄을 조회합니다.',
  'manage_schedule': '전체 직원의 스케줄을 관리(생성/수정/삭제)할 수 있습니다.',
  'view_attendance': '본인의 출퇴근 기록을 확인하거나, 권한에 따라 전체 직원의 출퇴근 현황을 조회합니다.',
  'manage_attendance': '직원의 실시간 출퇴근 현황을 보고 대신 처리해주거나, 시간 수정 요청을 승인/반려합니다.',
  'view_leave': '본인의 남은 연차와 휴가 신청 내역을 확인하거나, 권한에 따라 캘린더에서 전체 현황을 조회합니다.',
  'manage_leave': '직원들의 휴가 신청을 승인/반려하고, 전체 직원의 잔여 연차를 관리할 수 있습니다.',
  
  'view_tasks': '나의 할 일 목록과 타임라인을 확인할 수 있습니다.',
  'manage_tasks': '내 타임라인에 오늘 해야 할 개인 업무를 직접 추가하거나 삭제할 수 있습니다.',
  'view_sales': '매장 매출 현황과 손님들이 결제한 내역을 확인합니다.',
  'manage_inventory': '물건 재고가 얼마나 남았는지 확인하고 채워넣습니다.',
  'manage_menu': '메뉴 이름을 바꾸거나 가격을 수정할 수 있습니다.'
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

  // 메뉴 리스트 사이드바 페이지별 권한 카테고리 정의
  const PERMISSION_CATEGORIES = [
    {
      id: 'dashboard',
      title: '대시보드',
      desc: '메인 대시보드 페이지 접근 권한입니다.',
      viewCode: 'view_dashboard',
      manageCodes: []
    },
    {
      id: 'tasks',
      title: '할 일',
      desc: '개인 할 일 체크리스트 및 타임라인 접근 권한입니다.',
      viewCode: 'view_tasks',
      manageCodes: ['manage_tasks']
    },
    {
      id: 'schedule',
      title: '스케줄 관리',
      desc: '직원들의 스케줄표 페이지 접근 및 스케줄 수정 권한입니다.',
      viewCode: 'view_schedule',
      manageCodes: ['manage_schedule']
    },
    {
      id: 'attendance',
      title: '출퇴근 관리',
      desc: '출퇴근 기록 현황 접근 및 승인/수정 권한입니다.',
      viewCode: 'view_attendance',
      manageCodes: ['manage_attendance']
    },
    {
      id: 'leave',
      title: '휴가 및 연차',
      desc: '개인 연차 확인 및 휴가 신청 내역 접근/관리 권한입니다.',
      viewCode: 'view_leave',
      manageCodes: ['manage_leave']
    },
    {
      id: 'staff',
      title: '직원 관리',
      desc: '직원 명부 접근 및 초대/정보 수정 권한입니다.',
      viewCode: 'view_staff',
      manageCodes: ['manage_staff']
    },
    {
      id: 'roles',
      title: '직급 및 권한 설정',
      desc: '직급 생성 및 직급별 업무/기능 권한 설정 페이지 접근 권한입니다.',
      viewCode: 'manage_roles',
      manageCodes: []
    },
    {
      id: 'payroll',
      title: '(준비 중) 급여 및 인건비',
      desc: '직원들의 급여 정보 확인 및 급여 정산 권한입니다.',
      viewCode: 'view_salary',
      manageCodes: ['manage_payroll']
    },
    {
      id: 'sales',
      title: '(준비 중) 매출 분석',
      desc: '매장 매출 현황 및 결제 내역 확인 권한입니다.',
      viewCode: 'view_sales',
      manageCodes: []
    },
    {
      id: 'inventory',
      title: '(준비 중) 재고 관리',
      desc: '매장 재고 관리 및 메뉴/가격 수정 권한입니다.',
      viewCode: 'manage_inventory',
      manageCodes: ['manage_menu']
    },
    {
      id: 'settings',
      title: '매장 설정',
      desc: '매장의 기본 정보와 시스템 설정을 변경할 수 있는 권한입니다.',
      viewCode: 'manage_store',
      manageCodes: []
    }
  ]

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

  const togglePermission = (code: string, categoryId?: string) => {
    if (selectedRole && selectedRole.priority >= 100) return // Owner permissions cannot be changed
    
    setRolePermissions(prev => {
      const isCurrentlyEnabled = prev.includes(code)
      let next = isCurrentlyEnabled ? prev.filter(c => c !== code) : [...prev, code]

      // 부모(viewCode)가 꺼지면 자식(manageCodes)도 모두 꺼지도록 처리
      if (isCurrentlyEnabled && categoryId) {
        const category = PERMISSION_CATEGORIES.find(c => c.id === categoryId)
        if (category && category.viewCode === code) {
          next = next.filter(c => !category.manageCodes.includes(c))
        }
      }

      // 자식(manageCode)이 켜질 때 부모(viewCode)가 꺼져있다면 자동으로 켜줌
      if (!isCurrentlyEnabled && categoryId) {
        const category = PERMISSION_CATEGORIES.find(c => c.id === categoryId)
        if (category && category.manageCodes.includes(code) && category.viewCode) {
          if (!next.includes(category.viewCode)) {
            next = [...next, category.viewCode]
          }
        }
      }

      return next
    })
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
            <h3 className="font-semibold text-lg">우리 매장 직급 목록</h3>
            <Button size="icon" variant="ghost" onClick={handleCreateRole} disabled={loading} className="h-8 w-8 text-primary hover:bg-primary/10">
              <Plus className="h-5 w-5" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">사장님, 매니저, 알바 등 직급을 만들어보세요.</p>
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
                  권한 및 루틴 업무 설정
                  {isOwner ? (
                    <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20">
                      {editName}
                    </Badge>
                  ) : (
                      <Badge variant="outline" className="border-primary/20 text-primary bg-primary/5">
                        {editName}
                      </Badge>
                    )}
                  </h3>
                  <p className="text-[13px] text-muted-foreground">
                    {isOwner 
                      ? "사장님은 매장의 모든 기능을 자유롭게 사용할 수 있습니다." 
                      : "이 직급의 직원이 시스템에서 어떤 기능을 사용할 수 있는지, 출퇴근 시 해야 할 루틴 업무가 무엇인지 설정합니다."}
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
                  직급 삭제
                </Button>
              )}
            </div>

            <div className="flex-1 overflow-hidden">
              <Tabs defaultValue="permissions" className="w-full h-full flex flex-col">
                <div className="px-6 pt-4 border-b">
                  <TabsList className="bg-transparent p-0 gap-6 h-auto justify-start rounded-none">
                    <TabsTrigger 
                      value="permissions" 
                      className="group relative px-1 pb-3 pt-0 font-medium text-[14px] text-muted-foreground data-[state=active]:text-foreground data-[state=active]:font-bold data-[state=active]:shadow-none rounded-none bg-transparent hover:bg-transparent data-[state=active]:bg-transparent outline-none ring-0 focus:ring-0 focus-visible:ring-0 !shadow-none border-0"
                    >
                      직급 및 권한 설정
                      <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-primary scale-x-0 origin-left transition-transform duration-200 group-data-[state=active]:scale-x-100 rounded-t-full" />
                    </TabsTrigger>
                    {!isOwner && (
                      <TabsTrigger 
                        value="tasks" 
                        className="group relative px-1 pb-3 pt-0 font-medium text-[14px] text-muted-foreground data-[state=active]:text-foreground data-[state=active]:font-bold data-[state=active]:shadow-none rounded-none bg-transparent hover:bg-transparent data-[state=active]:bg-transparent flex items-center gap-1.5 outline-none ring-0 focus:ring-0 focus-visible:ring-0 !shadow-none border-0"
                      >
                        <BookOpen className="w-4 h-4 opacity-70 group-data-[state=active]:opacity-100" />
                        루틴 업무 설정
                        <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-primary scale-x-0 origin-left transition-transform duration-200 group-data-[state=active]:scale-x-100 rounded-t-full" />
                      </TabsTrigger>
                    )}
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
                        disabled={loading}
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
                          disabled={loading}
                        />
                        <Input 
                          value={editColor} 
                          onChange={e => setEditColor(e.target.value)}
                          className="uppercase font-mono text-sm h-10 flex-1"
                          disabled={loading}
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
                        <Label className="text-lg font-semibold">메뉴 및 기능 권한</Label>
                        {isOwner && <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-1 rounded">수정 불가</span>}
                      </div>
                      <p className="text-[13px] text-muted-foreground">이 직급의 직원이 앱에서 어떤 메뉴를 보고 어떤 일을 할 수 있을지 정합니다.</p>
                    </div>
                    
                    <div className="flex-1 pb-24">
                      <div className="space-y-10 max-w-4xl">
                      {PERMISSION_CATEGORIES.map((category) => {
                        const viewPerm = permissions.find(p => p.code === category.viewCode)
                        const viewTitle = permissionTitles[category.viewCode] || viewPerm?.name || category.viewCode
                        const viewDesc = permissionDescriptions[category.viewCode] || viewPerm?.description || category.viewCode
                        
                        const isViewEnabled = isOwner || rolePermissions.includes(category.viewCode)

                        return (
                          <div key={category.id} className="bg-card border shadow-sm rounded-xl overflow-hidden">
                            {/* 마스터 (페이지) 토글 헤더 */}
                            <div className={cn(
                              "p-4 border-b flex items-start gap-4 transition-colors",
                              isViewEnabled ? "bg-primary/5" : "bg-muted/30"
                            )}>
                              <div className="relative flex items-center mt-0.5">
                                <div className={cn(
                                  "w-11 h-6 rounded-full transition-all duration-200 cursor-pointer shrink-0 border-2 border-transparent inline-flex items-center",
                                  isViewEnabled 
                                    ? "bg-primary" 
                                    : "bg-input hover:bg-input/80",
                                  (isOwner || loading) && "opacity-50 cursor-not-allowed"
                                )} onClick={() => { if(!isOwner && !loading) togglePermission(category.viewCode, category.id) }}>
                                  <div className={cn(
                                    "bg-background w-5 h-5 rounded-full transition-transform duration-200 shadow-sm block",
                                    isViewEnabled ? "translate-x-5" : "translate-x-0"
                                  )} />
                                </div>
                              </div>
                              <div className="flex flex-col gap-1 flex-1 cursor-pointer" onClick={() => { if(!isOwner && !loading) togglePermission(category.viewCode, category.id) }}>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-[15px] font-bold text-foreground tracking-tight leading-none">{category.title}</h4>
                                  {!isViewEnabled && <Badge variant="secondary" className="text-[10px] h-4 px-1.5 py-0 font-medium opacity-70">페이지 숨김</Badge>}
                                </div>
                                <p className="text-[12px] text-muted-foreground">{viewDesc}</p>
                              </div>
                            </div>
                            
                            {/* 하위 (기능) 권한 토글들 */}
                            {category.manageCodes.length > 0 && (
                              <div className={cn(
                                "p-5 pl-[4.5rem] transition-all duration-300",
                                !isViewEnabled && !isOwner ? "opacity-40 grayscale-[50%] pointer-events-none select-none bg-muted/10" : ""
                              )}>
                                <div className="grid grid-cols-1 gap-y-5">
                                  {category.manageCodes.map((code) => {
                                    const dbPerm = permissions.find(p => p.code === code)
                                    const title = permissionTitles[code] || dbPerm?.name || code
                                    const desc = permissionDescriptions[code] || dbPerm?.description || code
                                    const isDangerous = code.startsWith('manage_') || code === 'view_salary'
                                    const dangerousTooltip = isDangerous ? "이 권한은 민감한 정보를 열람하거나 시스템을 변경할 수 있어 주의가 필요합니다." : null;
                                    
                                    const isCodeEnabled = isOwner || rolePermissions.includes(code)

                                    return (
                                      <div key={code} className="flex items-start space-x-3 group relative">
                                        <div className="absolute -left-6 top-2.5 w-3 h-[1px] bg-border" />
                                        <div className="relative flex items-center mt-0.5">
                                          <div className={cn(
                                            "w-9 h-5 rounded-full transition-all duration-200 cursor-pointer shrink-0 border-2 border-transparent inline-flex items-center",
                                            isCodeEnabled 
                                              ? (isDangerous ? "bg-amber-500" : "bg-primary") 
                                              : "bg-input hover:bg-input/80",
                                            (isOwner || loading) && "opacity-50 cursor-not-allowed"
                                          )} onClick={() => { if(!isOwner && !loading) togglePermission(code, category.id) }}>
                                            <div className={cn(
                                              "bg-background w-4 h-4 rounded-full transition-transform duration-200 shadow-sm block",
                                              isCodeEnabled ? "translate-x-4" : "translate-x-0"
                                            )} />
                                          </div>
                                        </div>

                                        <div className="flex flex-col gap-1 flex-1 cursor-pointer" onClick={() => { if(!isOwner && !loading) togglePermission(code, category.id) }}>
                                          <Label className={cn(
                                            "text-[13px] font-bold leading-none flex items-center gap-1.5 pointer-events-none",
                                            isDangerous && isCodeEnabled ? "text-amber-600" : "text-foreground"
                                          )}>
                                            {title}
                                            {isDangerous && (
                                              <div className="relative group/tooltip inline-flex items-center">
                                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 cursor-help pointer-events-auto" />
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs px-2 py-1 bg-gray-800 text-white text-[11px] font-normal rounded opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50">
                                                  {dangerousTooltip}
                                                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
                                                </div>
                                              </div>
                                            )}
                                          </Label>
                                          <p className="text-[12px] text-muted-foreground/80 leading-snug">
                                            {desc}
                                          </p>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                      </div>
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
                            루틴 업무 설정
                          </h3>
                          <p className="text-[13px] text-muted-foreground mt-0.5">
                            <span className="font-semibold text-foreground/80">'{selectedRole.name}'</span> 직급이 출근해서 퇴근까지 매일 해야 하는 고정 업무를 설정합니다.
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
                            <Plus className="w-4 h-4" /> 루틴 업무 추가
                          </Button>
                        } 
                      />
                    </div>
                  </div>

                  <div className="flex-1 p-6 pb-40 flex justify-center">
                    {roleTasks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-border/60 rounded-2xl bg-background/50 h-[350px] w-full max-w-3xl">
                        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                          <CheckSquare className="w-8 h-8 text-muted-foreground/50" />
                        </div>
                        <p className="font-semibold text-foreground text-[16px]">등록된 루틴 업무가 없습니다</p>
                        <p className="text-[13px] mt-2 mb-6 text-center leading-relaxed text-muted-foreground">
                          오픈 준비, 매장 청소, 마감 정산 등 이 직급이 반복적으로<br/>수행해야 할 타임라인 형태의 루틴을 구성해 보세요.
                        </p>
                        <CreateRoleTaskDialog 
                          storeId={storeId} 
                          initialRoleIds={[selectedRole.id]} 
                          hideRoleSelection={true}
                          hideEndTime={true}
                          hideTaskType={true}
                          trigger={
                            <Button className="gap-2 px-6">
                              <Plus className="w-4 h-4" /> 첫 번째 루틴 추가하기
                            </Button>
                          }
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col gap-6 w-full max-w-3xl">
                        <div className="flex items-center justify-between border-b border-black/10 pb-3">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-primary" />
                            <h4 className="font-bold text-[15px] text-foreground tracking-tight">일일 루틴 타임라인</h4>
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
                                    <Plus className="w-3 h-3 mr-2" /> 새 루틴 추가하기
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
          "fixed bottom-8 left-1/2 md:left-[calc(50%+10rem)] -translate-x-1/2 w-[calc(100%-3rem)] max-w-xl transition-all duration-500 ease-in-out transform z-[100]",
          isDirty ? "translate-y-0 opacity-100 scale-100" : "translate-y-32 opacity-0 scale-95 pointer-events-none"
        )}>
          <div className="bg-white/95 text-foreground p-4 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.12)] flex items-center justify-between border border-border/60 backdrop-blur-md">
            <div className="flex items-center gap-3 px-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight">수정 중인 내용이 있습니다</span>
                <span className="text-[11px] text-muted-foreground/80 font-medium">변경사항을 저장하려면 오른쪽 버튼을 누르세요.</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleReset}
                className="text-muted-foreground hover:text-foreground hover:bg-muted font-medium"
                disabled={loading}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                취소
              </Button>
              <Button 
                onClick={handleSaveChanges} 
                size="sm"
                disabled={loading}
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold px-6 shadow-md shadow-primary/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
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