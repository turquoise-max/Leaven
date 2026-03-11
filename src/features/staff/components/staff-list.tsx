'use client'

import { useState, useEffect } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Shield, ShieldAlert, ShieldCheck, User, Check, X, UserPlus, Phone, Info, PencilLine, Mail, CalendarDays, Wallet, ChevronRight, FileText, Download } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EditStaffDialog } from './edit-staff-dialog'
import { StaffTableRow } from './staff-table-row'
import { approveRequest, rejectRequest, removeStaff } from '../actions'
import { toast } from 'sonner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
  status: 'active' | 'invited' | 'pending_approval'
  contract_status?: 'none' | 'sent' | 'signed'
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

  useEffect(() => {
    setStaffList(initialData)
  }, [initialData])

  // 정렬 함수
  const sortStaff = (a: StaffMember, b: StaffMember) => {
    const priorityA = a.role_info?.priority ?? (a.role === 'owner' ? 100 : (a.role === 'manager' ? 50 : 0))
    const priorityB = b.role_info?.priority ?? (b.role === 'owner' ? 100 : (b.role === 'manager' ? 50 : 0))
    if (priorityA !== priorityB) return priorityB - priorityA
    
    const nameA = a.name || a.profile?.full_name || ''
    const nameB = b.name || b.profile?.full_name || ''
    return nameA.localeCompare(nameB)
  }

  const pendingStaff = staffList.filter(s => !s.resigned_at && (s.status === 'pending_approval' || s.status === 'invited')).sort(sortStaff)
  const activeStaff = staffList.filter(s => !s.resigned_at && s.status === 'active').sort(sortStaff)
  const resignedStaff = staffList.filter(s => s.resigned_at).sort((a, b) => new Date(b.resigned_at!).getTime() - new Date(a.resigned_at!).getTime())

  const handleApprove = async (memberId: string) => {
    setProcessingId(memberId)
    const result = await approveRequest(storeId, memberId)
    setProcessingId(null)

    if (result.error) {
      toast.error('승인 실패', { description: result.error })
    } else {
      toast.success('승인 완료', { description: '직원의 가입 요청을 승인했습니다.' })
      // Optimistic update
      setStaffList(prev => prev.map(s => s.id === memberId ? { ...s, status: 'active' } : s))
    }
  }

  const handleReject = async (memberId: string) => {
    if (!confirm('정말 거절하시겠습니까? 해당 요청은 삭제됩니다.')) return

    setProcessingId(memberId)
    const result = await rejectRequest(storeId, memberId)
    setProcessingId(null)

    if (result.error) {
      toast.error('거절 실패', { description: result.error })
    } else {
      toast.success('거절 완료', { description: '가입 요청을 거절했습니다.' })
      // Optimistic update
      setStaffList(prev => prev.filter(s => s.id !== memberId))
    }
  }

  const handleRemove = async (memberId: string, staffName: string) => {
    if (!confirm(`'${staffName}' 직원을 퇴사 처리하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return

    const result = await removeStaff(storeId, memberId)

    if (result.error) {
      toast.error('퇴사 처리 실패', { description: result.error })
    } else {
      toast.success('퇴사 처리 완료', { description: '직원이 퇴사 처리되었습니다.' })
      // Optimistic update
      setStaffList(prev => prev.filter(s => s.id !== memberId))
    }
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="active" className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="active" className="w-32 data-[state=active]:shadow-sm">
              재직자 <Badge variant="secondary" className="ml-2 bg-foreground/10 hover:bg-foreground/10 font-mono">{activeStaff.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="pending" className="w-32 data-[state=active]:shadow-sm">
              합류 대기 
              {pendingStaff.length > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 min-w-5 flex items-center justify-center p-0 px-1.5 font-mono font-bold animate-in fade-in zoom-in">{pendingStaff.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="resigned" className="w-32 data-[state=active]:shadow-sm">
              퇴사자 <Badge variant="secondary" className="ml-2 bg-foreground/10 hover:bg-foreground/10 font-mono text-muted-foreground">{resignedStaff.length}</Badge>
            </TabsTrigger>
          </TabsList>
          
          {canManage && (
            <Button 
              className="bg-primary shadow-sm hover:shadow transition-all"
              onClick={() => {
                setEditingStaff(null) // null이면 수기 등록 모드
                setDialogOpen(true)
              }}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              직원 수기 등록
            </Button>
          )}
        </div>

        {/* 탭 공통 테이블 렌더러 - 레이아웃 통일 */}
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
                        onApprove={handleApprove}
                        onReject={handleReject}
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
      />
    </div>
  )
}