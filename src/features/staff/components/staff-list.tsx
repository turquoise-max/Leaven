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
import { StoreCodeDisplay } from '@/features/store/components/store-code-display'
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
  inviteCode?: string
}

const DAYS = ['일', '월', '화', '수', '목', '금', '토']

export function StaffList({ initialData, storeId, canManage, inviteCode }: StaffListProps) {
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
      const phone = (staff.phone || staff.profile?.phone || '').replace(/-/g, '')
      const email = (staff.email || staff.profile?.email || '').toLowerCase()
      
      const query = searchQuery.toLowerCase().trim()
      
      // 검색 로직 (이름, 전화번호, 이메일)
      const matchesSearch = 
        name.includes(query) ||
        phone.includes(query.replace(/-/g, '')) ||
        email.includes(query)
      
      const roleId = staff.role_info?.id || staff.role
      const matchesRole = roleFilter === 'all' || roleId === roleFilter

      return matchesSearch && matchesRole
    })
  }, [staffList, searchQuery, roleFilter])

  const sortStaff = (a: StaffMember, b: StaffMember) => {
    // 1. Pending (요청) 상태인 직원을 최상단으로
    const isPendingA = a.status === 'pending_approval' || a.status === 'invited'
    const isPendingB = b.status === 'pending_approval' || b.status === 'invited'
    if (isPendingA && !isPendingB) return -1
    if (!isPendingA && isPendingB) return 1

    // 2. Priority (Descending)
    const priorityA = a.role_info?.priority ?? (a.role === 'owner' ? 100 : (a.role === 'manager' ? 50 : 0))
    const priorityB = b.role_info?.priority ?? (b.role === 'owner' ? 100 : (b.role === 'manager' ? 50 : 0))
    if (priorityA !== priorityB) return priorityB - priorityA
    
    // 3. Name (Ascending)
    const nameA = a.name || a.profile?.full_name || ''
    const nameB = b.name || b.profile?.full_name || ''
    return nameA.localeCompare(nameB)
  }

  const activeAndPendingStaff = filteredStaffList.filter(s => !s.resigned_at).sort(sortStaff)
  const resignedStaff = filteredStaffList.filter(s => s.resigned_at).sort((a, b) => new Date(b.resigned_at!).getTime() - new Date(a.resigned_at!).getTime())

  // Dashboard Stats
  const totalActive = staffList.filter(s => !s.resigned_at && s.status === 'active').length
  const totalPendingContracts = staffList.filter(s => !s.resigned_at && s.status === 'active' && s.role !== 'owner' && s.contract_status !== 'signed').length
  const totalPendingApprovals = staffList.filter(s => !s.resigned_at && (s.status === 'pending_approval' || s.status === 'invited')).length

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
    <div className="space-y-4">
      
      {/* 1. 상단 요약 바 (Summary Bar) & 메인 액션 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4">
        {/* 우아한 Muted 요약 바 */}
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="text-slate-700">재직 중 <strong className="text-emerald-600 font-bold ml-0.5">{totalActive}명</strong></span>
          </span>
          <span className="text-slate-300 mx-1">•</span>
          <span className={cn("flex items-center gap-1.5", totalPendingContracts > 0 ? "text-amber-700 font-semibold" : "")}>
            미체결 계약 {totalPendingContracts > 0 && <strong className="ml-0.5">{totalPendingContracts}건</strong>}
            {totalPendingContracts === 0 && '0건'}
          </span>
          <span className="text-slate-300 mx-1">•</span>
          <span className={cn("flex items-center gap-1.5", totalPendingApprovals > 0 ? "text-rose-600 font-bold" : "")}>
            가입 대기 {totalPendingApprovals > 0 && <strong className="ml-0.5">{totalPendingApprovals}건</strong>}
            {totalPendingApprovals === 0 && '0건'}
          </span>
        </div>

        {/* 핵심 액션 버튼 모음 (우측 상단) */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {canManage && inviteCode && (
            <StoreCodeDisplay code={inviteCode} />
          )}
          {canManage && (
            <Button 
              variant="outline" 
              className="bg-white border-dashed border-2 hover:border-primary/40 hover:bg-slate-50 text-slate-700 font-semibold shadow-none h-[34px] px-3 shrink-0 transition-all"
              onClick={() => {
                setEditingStaff(null)
                setDialogOpen(true)
              }}
            >
              <PencilLine className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
              수기 등록
            </Button>
          )}
        </div>
      </div>

      {/* 2. 탭 및 리스트 뷰 */}
      <Tabs defaultValue="active" className="w-full rounded-xl border bg-card shadow-sm overflow-hidden flex flex-col">
        {/* Table Toolbar (Tabs + Mac OS Style Filter) */}
        <div className="bg-slate-50/50 border-b flex flex-col md:flex-row md:items-center justify-between px-4 pt-3 gap-4">
          
          <TabsList className="bg-transparent p-0 gap-6 h-auto justify-start rounded-none">
            <TabsTrigger 
              value="active" 
              className="relative rounded-none px-1 pb-3 text-[13.5px] font-bold text-slate-500 hover:text-slate-800 data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none outline-none focus-visible:outline-none !shadow-none bg-transparent group"
            >
              직원 명부 
              <Badge variant="secondary" className="ml-1.5 bg-slate-100/80 text-slate-500 font-mono font-medium group-data-[state=active]:bg-primary/10 group-data-[state=active]:text-primary transition-colors">
                {activeAndPendingStaff.length}
              </Badge>
              {totalPendingApprovals > 0 && (
                <span className="absolute top-0 -right-2 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
              )}
              <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-primary scale-x-0 origin-left transition-transform duration-200 group-data-[state=active]:scale-x-100 rounded-t-full" />
            </TabsTrigger>
            <TabsTrigger 
              value="resigned" 
              className="relative rounded-none px-1 pb-3 text-[13.5px] font-bold text-slate-500 hover:text-slate-800 data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none outline-none focus-visible:outline-none !shadow-none bg-transparent group"
            >
              퇴사자 <Badge variant="secondary" className="ml-1.5 bg-slate-100/80 text-slate-400 font-mono font-medium group-data-[state=active]:bg-primary/10 group-data-[state=active]:text-primary transition-colors">{resignedStaff.length}</Badge>
              <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-primary scale-x-0 origin-left transition-transform duration-200 group-data-[state=active]:scale-x-100 rounded-t-full" />
            </TabsTrigger>
          </TabsList>

          {/* Mac OS Style Search Box tightly coupled with the Table */}
          <div className="flex items-center bg-white rounded-lg border shadow-sm p-0.5 w-full md:w-[260px] transition-all focus-within:ring-2 focus-within:ring-primary/20 mb-2 md:mb-2.5 self-center mr-1">
            <Search className="w-3.5 h-3.5 text-slate-400 ml-2 shrink-0" />
            <div className="relative flex-1 flex items-center">
              <input 
                placeholder="이름, 연락처, 이메일 검색..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none focus:outline-none focus:ring-0 text-[12.5px] font-medium w-full px-2 h-6.5 pr-6" 
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1 p-0.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 공통 테이블 렌더러 */}
        {['active', 'resigned'].map((tab) => {
          const list = tab === 'active' ? activeAndPendingStaff : resignedStaff
          const isResigned = tab === 'resigned'
          
          return (
            <TabsContent key={tab} value={tab} className="mt-0 focus-visible:outline-none focus-visible:ring-0">
              <div className="bg-card w-full">
                <Table>
                  <TableHeader className="bg-slate-50/80 border-b border-t border-border/50">
                    <TableRow className="hover:bg-transparent text-[11px] uppercase tracking-widest text-slate-500">
                      <TableHead className="w-[80px] px-2 text-center font-bold h-9">상태</TableHead>
                      <TableHead className="w-[260px] font-bold h-9 px-4 text-center">직원 정보</TableHead>
                      <TableHead className="w-[100px] font-bold h-9 px-4 text-center">역할</TableHead>
                      <TableHead className="w-[280px] font-bold h-9 text-center px-4">근로 조건 및 스케줄</TableHead>
                      <TableHead className="w-[120px] font-bold h-9 px-4 text-center">근로계약서</TableHead>
                      <TableHead className="w-[100px] text-center h-9">관리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map(staff => (
                      <StaffTableRow 
                        key={staff.id}
                        staff={staff}
                        isResigned={isResigned}
                        canManage={canManage}
                        showContract={true}
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
                        <TableCell colSpan={6} className="h-64 text-center text-muted-foreground">
                          <div className="flex flex-col items-center justify-center gap-4 py-8">
                            {searchQuery ? (
                              <>
                                <div className="relative">
                                  <Search className="w-12 h-12 opacity-10" />
                                  <X className="w-6 h-6 absolute -bottom-1 -right-1 text-rose-500 opacity-40" />
                                </div>
                                <div className="space-y-1">
                                  <p className="text-base font-semibold text-slate-600">검색 결과가 없습니다</p>
                                  <p className="text-sm text-slate-400">"{searchQuery}"에 매칭되는 직원이 없습니다.</p>
                                </div>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => setSearchQuery('')}
                                  className="mt-2 h-8 text-xs font-semibold"
                                >
                                  검색 초기화
                                </Button>
                              </>
                            ) : (
                              <>
                                {tab === 'active' ? (
                                  <>
                                    <div className="bg-slate-100 p-4 rounded-full">
                                      <Users className="w-8 h-8 text-slate-400" />
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-base font-semibold text-slate-600">등록된 직원이 없습니다</p>
                                      <p className="text-sm text-slate-400">새로운 직원을 초대하거나 직접 등록해보세요.</p>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="bg-slate-100 p-4 rounded-full">
                                      <Info className="w-8 h-8 text-slate-400" />
                                    </div>
                                    <p className="text-sm font-medium">퇴사자 기록이 없습니다.</p>
                                  </>
                                )}
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