'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Shield, ShieldAlert, ShieldCheck, User, Check, X, UserPlus, Phone, Info, PencilLine, Mail, CalendarDays, Wallet, ChevronRight, FileText, Download, Search, Filter, AlertCircle, Users } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EditStaffDialog } from './edit-staff-dialog'
import { StaffTableRow } from './staff-table-row'
import { approveRequest, rejectRequest, removeStaff, deleteStaffRecord, restoreStaff } from '../actions'
import { toast } from 'sonner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
import { cn } from '@/lib/utils'

interface RoleInfo {
  id: string
  name: string
  color: string
  priority: number
  is_system: boolean
}

export interface StaffMember {
  id: string
  user_id: string | null
  role: string // Legacy role string
  status: 'active' | 'invited' | 'pending_approval' | 'inactive'
  contract_status?: 'none' | 'sent' | 'pending_staff' | 'signed' | 'rejected' | 'canceled'
  contract_file_url?: string | null
  employment_type?: 'fulltime' | 'parttime' | 'contract' | 'probation' | 'daily'
  wage_type?: 'hourly' | 'daily' | 'monthly' | 'yearly'
  base_wage?: number
  work_hours?: string
  work_schedules?: any[] // Added
  hired_at?: string
  contract_end_date?: string | null // 추가
  joined_at: string
  resigned_at?: string | null
  name: string | null // 수기 등록 이름
  email: string | null // 수기 등록 이메일
  phone: string | null // 수기 등록 전화번호
  
  // 개인/근로계약 정보 추가
  address?: string | null
  birth_date?: string | null
  emergency_contact?: string | null
  custom_pay_day?: number | null
  weekly_holiday?: number | null
  insurance_status?: {
    employment: boolean
    industrial: boolean
    national: boolean
    health: boolean
  } | null
  details?: any

  profile: {
    full_name: string | null
    email: string | null
    phone: string | null
    avatar_url: string | null
  } | null
  role_info?: RoleInfo
}

interface StaffListProps {
  initialData: any[]
  storeId: string
  canManage: boolean
}

const DAYS = ['일', '월', '화', '수', '목', '금', '토']

export function StaffList({ initialData, storeId, canManage }: StaffListProps) {
  const [staffList, setStaffList] = useState<StaffMember[]>(initialData)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  // Confirm Modal State
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    type: 'approve' | 'reject' | 'delete' | 'restore' | null
    staffId: string | null
    staffName: string | null
  }>({
    open: false,
    type: null,
    staffId: null,
    staffName: null
  })

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    setStaffList(initialData)
  }, [initialData])

  // 정렬 및 필터 함수
  const filteredStaffList = useMemo(() => {
    return staffList.filter(staff => {
      const name = (staff.name || staff.profile?.full_name || '').toLowerCase()
      const matchesSearch = name.includes(searchQuery.toLowerCase())
      
      const roleId = staff.role_info?.id || staff.role
      const matchesRole = roleFilter === 'all' || roleId === roleFilter

      return matchesSearch && matchesRole
    })
  }, [staffList, searchQuery, roleFilter])

  const sortStaff = (a: StaffMember, b: StaffMember) => {
    const priorityA = a.role_info?.priority ?? (a.role === 'owner' ? 100 : (a.role === 'manager' ? 50 : 0))
    const priorityB = b.role_info?.priority ?? (b.role === 'owner' ? 100 : (b.role === 'manager' ? 50 : 0))
    if (priorityA !== priorityB) return priorityB - priorityA
    
    const nameA = a.name || a.profile?.full_name || ''
    const nameB = b.name || b.profile?.full_name || ''
    return nameA.localeCompare(nameB)
  }

  const pendingStaff = filteredStaffList.filter(s => !s.resigned_at && (s.status === 'pending_approval' || s.status === 'invited')).sort(sortStaff)
  const activeStaff = filteredStaffList.filter(s => !s.resigned_at && s.status === 'active').sort(sortStaff)
  const resignedStaff = filteredStaffList.filter(s => s.resigned_at).sort((a, b) => new Date(b.resigned_at!).getTime() - new Date(a.resigned_at!).getTime())

  // Dashboard Stats
  const totalActive = staffList.filter(s => !s.resigned_at && s.status === 'active').length
  const totalPendingContracts = staffList.filter(s => !s.resigned_at && s.status === 'active' && s.contract_status !== 'signed').length
  const totalPendingApprovals = staffList.filter(s => !s.resigned_at && s.status === 'pending_approval').length

  // Unique Roles for Filter Dropdown
  const uniqueRoles = useMemo(() => {
    const rolesMap = new Map()
    staffList.forEach(s => {
      if (s.role_info) {
        rolesMap.set(s.role_info.id, s.role_info.name)
      } else if (s.role) {
        rolesMap.set(s.role, s.role === 'owner' ? '점주' : s.role === 'manager' ? '매니저' : '직원')
      }
    })
    return Array.from(rolesMap.entries()).map(([id, name]) => ({ id, name }))
  }, [staffList])

  const handleApproveClick = (memberId: string, staffName: string) => {
    setConfirmDialog({ open: true, type: 'approve', staffId: memberId, staffName })
  }

  const handleRejectClick = (memberId: string, staffName: string) => {
    setConfirmDialog({ open: true, type: 'reject', staffId: memberId, staffName })
  }

  const handleDeleteRecordClick = (memberId: string, staffName: string) => {
    setConfirmDialog({ open: true, type: 'delete', staffId: memberId, staffName })
  }

  const handleRestoreRecordClick = (memberId: string, staffName: string) => {
    setConfirmDialog({ open: true, type: 'restore', staffId: memberId, staffName })
  }

  const executeAction = async () => {
    const { type, staffId } = confirmDialog
    if (!staffId || !type) return

    setProcessingId(staffId)
    setConfirmDialog({ open: false, type: null, staffId: null, staffName: null })

    if (type === 'approve') {
      const result = await approveRequest(storeId, staffId)
      if (result.error) {
        toast.error('승인 실패', { description: result.error })
      } else {
        toast.success('승인 완료', { description: '직원의 가입 요청을 승인했습니다.' })
        setStaffList(prev => prev.map(s => s.id === staffId ? { ...s, status: 'active' } : s))
      }
    } else if (type === 'reject') {
      const result = await rejectRequest(storeId, staffId)
      if (result.error) {
        toast.error('거절 실패', { description: result.error })
      } else {
        toast.success('거절 완료', { description: '가입 요청을 거절했습니다.' })
        setStaffList(prev => prev.filter(s => s.id !== staffId))
      }
    } else if (type === 'delete') {
      const result = await deleteStaffRecord(storeId, staffId)
      if (result.error) {
        toast.error('삭제 실패', { description: result.error })
      } else {
        toast.success('삭제 완료', { description: '퇴사자 기록을 완전히 삭제했습니다.' })
        setStaffList(prev => prev.filter(s => s.id !== staffId))
      }
    } else if (type === 'restore') {
      const result = await restoreStaff(storeId, staffId)
      if (result.error) {
        toast.error('복원 실패', { description: result.error })
      } else {
        toast.success('복원 완료', { description: '직원을 재직 상태로 복원했습니다.' })
        setStaffList(prev => prev.map(s => s.id === staffId ? { ...s, status: 'active', resigned_at: null } : s))
      }
    }
    setProcessingId(null)
  }

  const handleRemove = async (memberId: string, staffName: string) => {
    if (!confirm(`'${staffName}' 직원을 퇴사 처리하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return

    const result = await removeStaff(storeId, memberId)

    if (result.error) {
      toast.error('퇴사 처리 실패', { description: result.error })
    } else {
      toast.success('퇴사 처리 완료', { description: '직원이 퇴사 처리되었습니다.' })
      // Optimistic update: 기존 정보들을 그대로 유지하고 상태와 퇴사일만 업데이트합니다.
      setStaffList(prev => prev.map(s => {
        if (s.id === memberId) {
          const lastRoleName = s.role_info?.name || (s.role === 'owner' ? '점주' : s.role === 'manager' ? '매니저' : '직원')
          return { 
            ...s, 
            status: 'inactive', 
            resigned_at: new Date().toISOString(),
            name: s.name || s.profile?.full_name || '이름 없음',
            email: s.email || s.profile?.email || '',
            phone: s.phone || s.profile?.phone || '',
            details: { ...s.details, last_role_name: lastRoleName }
          } as StaffMember
        }
        return s
      }))
    }
  }

  if (!isMounted) {
    return null // Hydration 불일치 방지
  }

  return (
    <div className="space-y-6">
      
      {/* 1. 상단 액션 대시보드 (Action-Driven Dashboard) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border shadow-sm bg-white hover:border-primary/30 transition-colors">
          <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
            <div className="flex flex-col">
              <CardDescription className="font-semibold text-muted-foreground">현재 총 재직자</CardDescription>
              <CardTitle className="text-2xl mt-1">{totalActive}명</CardTitle>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Users className="w-5 h-5" />
            </div>
          </CardHeader>
        </Card>

        <Card className={cn("border-border shadow-sm transition-colors", totalPendingContracts > 0 ? "bg-orange-50/50 hover:border-orange-300 border-orange-200" : "bg-white hover:border-primary/30")}>
          <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
            <div className="flex flex-col">
              <CardDescription className={cn("font-semibold", totalPendingContracts > 0 ? "text-orange-600" : "text-muted-foreground")}>미서명 근로계약서</CardDescription>
              <CardTitle className="text-2xl mt-1">{totalPendingContracts}건</CardTitle>
            </div>
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", totalPendingContracts > 0 ? "bg-orange-100 text-orange-600" : "bg-muted text-muted-foreground")}>
              <FileText className="w-5 h-5" />
            </div>
          </CardHeader>
        </Card>

        <Card className={cn("border-border shadow-sm transition-colors", totalPendingApprovals > 0 ? "bg-red-50/50 hover:border-red-300 border-red-200" : "bg-white hover:border-primary/30")}>
          <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
            <div className="flex flex-col">
              <CardDescription className={cn("font-semibold", totalPendingApprovals > 0 ? "text-red-600" : "text-muted-foreground")}>합류 승인 대기</CardDescription>
              <CardTitle className="text-2xl mt-1">{totalPendingApprovals}건</CardTitle>
            </div>
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", totalPendingApprovals > 0 ? "bg-red-100 text-red-600" : "bg-muted text-muted-foreground")}>
              <ShieldAlert className="w-5 h-5" />
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* 2. 스마트 필터 및 검색 바 */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-2 border border-border shadow-sm rounded-xl">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="이름으로 검색..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-slate-50/50 border-border/50 focus-visible:ring-primary/20 h-9" 
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[140px] bg-slate-50/50 border-border/50 h-9 text-sm">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                <SelectValue placeholder="직무 필터" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">모든 직무</SelectItem>
              {uniqueRoles.map(r => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {canManage && (
          <Button 
            className="w-full sm:w-auto bg-primary shadow-sm hover:shadow transition-all h-9"
            onClick={() => {
              setEditingStaff(null)
              setDialogOpen(true)
            }}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            새 직원 등록
          </Button>
        )}
      </div>

      {/* 3. 탭 및 리스트 뷰 */}
      <Tabs defaultValue="active" className="w-full">
        <div className="flex items-center justify-between mb-4 px-1">
          <TabsList className="bg-transparent p-0 gap-8 h-auto border-b border-border/50 w-full justify-start rounded-none">
            <TabsTrigger 
              value="active" 
              className="relative rounded-none px-1 pb-3 pt-2 text-sm font-semibold text-muted-foreground hover:text-foreground data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none outline-none focus-visible:outline-none !shadow-none bg-transparent group"
            >
              재직자 <Badge variant="secondary" className="ml-1.5 bg-slate-100 text-slate-600 font-mono group-data-[state=active]:bg-primary/10 group-data-[state=active]:text-primary transition-colors">{activeStaff.length}</Badge>
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary scale-x-0 origin-left transition-transform duration-200 group-data-[state=active]:scale-x-100" />
            </TabsTrigger>
            <TabsTrigger 
              value="pending" 
              className="relative rounded-none px-1 pb-3 pt-2 text-sm font-semibold text-muted-foreground hover:text-foreground data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none outline-none focus-visible:outline-none !shadow-none bg-transparent group"
            >
              합류 대기 
              {pendingStaff.length > 0 && (
                <Badge variant="destructive" className="ml-1.5 h-5 min-w-5 flex items-center justify-center p-0 px-1.5 font-mono font-bold animate-in fade-in zoom-in">{pendingStaff.length}</Badge>
              )}
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary scale-x-0 origin-left transition-transform duration-200 group-data-[state=active]:scale-x-100" />
            </TabsTrigger>
            <TabsTrigger 
              value="resigned" 
              className="relative rounded-none px-1 pb-3 pt-2 text-sm font-semibold text-muted-foreground hover:text-foreground data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none outline-none focus-visible:outline-none !shadow-none bg-transparent group"
            >
              퇴사자 <Badge variant="secondary" className="ml-1.5 bg-slate-100 text-slate-500 font-mono group-data-[state=active]:bg-primary/10 group-data-[state=active]:text-primary transition-colors">{resignedStaff.length}</Badge>
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary scale-x-0 origin-left transition-transform duration-200 group-data-[state=active]:scale-x-100" />
            </TabsTrigger>
          </TabsList>
        </div>

        {/* 공통 테이블 렌더러 */}
        {['active', 'pending', 'resigned'].map((tab) => {
          const list = tab === 'active' ? activeStaff : tab === 'pending' ? pendingStaff : resignedStaff
          const isResigned = tab === 'resigned'
          
          return (
            <TabsContent key={tab} value={tab} className="mt-0 focus-visible:outline-none focus-visible:ring-0">
              <div className="rounded-xl border bg-card/50 backdrop-blur-sm shadow-sm overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="hover:bg-transparent text-xs uppercase tracking-wider text-muted-foreground/70">
                      <TableHead className="w-[80px] px-2 text-center font-semibold h-10">상태</TableHead>
                      <TableHead className="w-[260px] font-semibold h-10 px-4">직원 정보</TableHead>
                      <TableHead className="px-4 font-semibold h-10">근로 조건 및 스케줄</TableHead>
                      <TableHead className="w-[120px] font-semibold h-10 px-4 text-center">근로계약서</TableHead>
                      <TableHead className="w-[100px] text-right h-10 pr-6"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map(staff => (
                      <StaffTableRow 
                        key={staff.id}
                        staff={staff}
                        isResigned={isResigned}
                        canManage={canManage}
                        processingId={processingId}
                        onApprove={handleApproveClick}
                        onReject={handleRejectClick}
                        onDeleteRecord={handleDeleteRecordClick}
                        onRestoreRecord={handleRestoreRecordClick}
                        onClick={() => {
                          if (!canManage) return
                          setEditingStaff(staff)
                          setDialogOpen(true)
                        }}
                      />
                    ))}
                    {list.length === 0 && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">
                          <div className="flex flex-col items-center justify-center gap-2">
                            {tab === 'active' ? (
                              <>
                                <User className="w-8 h-8 opacity-20" />
                                <p>현재 등록된 재직자가 없습니다.</p>
                              </>
                            ) : tab === 'pending' ? (
                              <>
                                <ShieldAlert className="w-8 h-8 opacity-20" />
                                <p>현재 합류 대기 중인 인원이 없습니다.</p>
                              </>
                            ) : (
                              <>
                                <Info className="w-8 h-8 opacity-20" />
                                <p>퇴사자 기록이 없습니다.</p>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          )
        })}
      </Tabs>

      <EditStaffDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        staff={editingStaff}
        storeId={storeId}
        canManage={canManage}
        onSuccess={(action: 'approve' | 'reject' | 'remove', staffId: string) => {
          if (action === 'approve') {
            setStaffList(prev => prev.map(s => s.id === staffId ? { ...s, status: 'active' } : s))
          } else if (action === 'reject') {
            setStaffList(prev => prev.filter(s => s.id !== staffId))
          } else if (action === 'remove') {
            // 퇴사 시 상태를 inactive로, resigned_at을 현재 시간으로 설정 (기존 정보 보존)
            setStaffList(prev => prev.map(s => {
              if (s.id === staffId) {
                const lastRoleName = s.role_info?.name || (s.role === 'owner' ? '점주' : s.role === 'manager' ? '매니저' : '직원')
                return { 
                  ...s, 
                  status: 'inactive', 
                  resigned_at: new Date().toISOString(),
                  name: s.name || s.profile?.full_name || '이름 없음',
                  email: s.email || s.profile?.email || '',
                  phone: s.phone || s.profile?.phone || '',
                  details: { ...s.details, last_role_name: lastRoleName }
                } as StaffMember
              }
              return s
            }))
          }
        }}
      />

      <AlertDialog 
        open={confirmDialog.open} 
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.type === 'approve' ? '가입 승인 및 근로계약 안내' : confirmDialog.type === 'delete' ? '퇴사자 기록 영구 삭제' : confirmDialog.type === 'restore' ? '직원 복원' : '가입 요청 거절'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="leading-relaxed text-sm text-muted-foreground">
                {confirmDialog.type === 'approve' ? (
                  <>
                    <span className="font-semibold text-foreground">{confirmDialog.staffName}</span> 직원의 가입을 승인하시겠습니까?<br /><br />
                    <span className="text-orange-600 font-medium">주의:</span> 아직 이 직원과 전자 근로계약서 작성이 완료되지 않았을 수 있습니다. 
                    승인 시 직원은 즉시 재직자 상태로 전환되며 매장의 데이터(스케줄 등)를 볼 수 있게 됩니다.
                  </>
                ) : confirmDialog.type === 'delete' ? (
                  <>
                    정말 <span className="font-semibold text-foreground">{confirmDialog.staffName}</span> 직원의 기록을 <span className="text-red-600 font-semibold">영구 삭제</span>하시겠습니까?<br />
                    이 작업은 되돌릴 수 없으며, 모든 관련된 과거 정보가 삭제됩니다.
                  </>
                ) : confirmDialog.type === 'restore' ? (
                  <>
                    <span className="font-semibold text-foreground">{confirmDialog.staffName}</span> 직원을 다시 재직 상태로 복원하시겠습니까?<br />
                    이전의 개인 정보와 역할이 그대로 유지된 채 재직자 목록으로 이동됩니다.
                  </>
                ) : (
                  <>
                    정말 <span className="font-semibold text-foreground">{confirmDialog.staffName}</span> 직원의 가입 요청을 거절하시겠습니까?<br />
                    거절된 직원은 매장에 합류할 수 없으며 요청 목록에서 삭제됩니다.
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>돌아가기</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeAction}
              className={confirmDialog.type === 'approve' || confirmDialog.type === 'restore' ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}
            >
              {confirmDialog.type === 'approve' ? '그냥 승인하기' : confirmDialog.type === 'delete' ? '영구 삭제' : confirmDialog.type === 'restore' ? '복원하기' : '거절하기'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}
