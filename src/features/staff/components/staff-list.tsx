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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, Shield, ShieldAlert, ShieldCheck, User, Check, X, UserPlus, Phone } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EditStaffDialog } from './edit-staff-dialog'
import { approveRequest, rejectRequest } from '../actions'
import { toast } from 'sonner'

interface StaffMember {
  id: string
  user_id: string | null
  role: 'owner' | 'manager' | 'staff'
  status: 'active' | 'invited' | 'pending_approval'
  wage_type?: 'hourly' | 'monthly'
  base_wage?: number
  joined_at: string
  name: string | null // 수기 등록 이름
  email: string | null // 수기 등록 이메일
  phone: string | null // 수기 등록 전화번호
  profile: {
    full_name: string | null
    email: string | null
    phone: string | null
    avatar_url: string | null
  } | null
}

interface StaffListProps {
  initialData: any[]
  storeId: string
  canManage: boolean
}

export function StaffList({ initialData, storeId, canManage }: StaffListProps) {
  const [staffList, setStaffList] = useState<StaffMember[]>(initialData)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    setStaffList(initialData)
  }, [initialData])

  const pendingStaff = staffList.filter(s => s.status === 'pending_approval')
  const activeStaff = staffList.filter(s => s.status !== 'pending_approval')

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

  const getDisplayName = (staff: StaffMember) => {
    return staff.profile?.full_name || staff.name || '이름 없음'
  }

  const getDisplayEmail = (staff: StaffMember) => {
    return staff.profile?.email || staff.email || '-'
  }

  const getDisplayPhone = (staff: StaffMember) => {
    return staff.profile?.phone || staff.phone || ''
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return <Badge className="bg-purple-500 hover:bg-purple-600">점주</Badge>
      case 'manager':
        return <Badge className="bg-blue-500 hover:bg-blue-600">매니저</Badge>
      default:
        return <Badge variant="secondary">직원</Badge>
    }
  }

  const getStatusBadge = (status: string, userId: string | null) => {
    if (!userId && status === 'active') {
       return <Badge variant="outline" className="text-gray-600 border-gray-600">수기등록</Badge>
    }

    switch (status) {
      case 'active':
        return <Badge variant="outline" className="text-green-600 border-green-600">재직중</Badge>
      case 'invited':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600">초대됨</Badge>
      case 'pending_approval':
        return <Badge variant="outline" className="text-orange-600 border-orange-600">승인 대기</Badge>
      default:
        return <Badge variant="outline">알 수 없음</Badge>
    }
  }

  const getRoleIcon = (role: string) => {
     switch (role) {
      case 'owner':
        return <ShieldAlert className="h-4 w-4 text-purple-500" />
      case 'manager':
        return <ShieldCheck className="h-4 w-4 text-blue-500" />
      default:
        return <User className="h-4 w-4 text-gray-500" />
    }
  }

  return (
    <div className="space-y-8">
      {/* 승인 대기 목록 */}
      {pendingStaff.length > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-orange-700 dark:text-orange-400 flex items-center gap-2 text-lg">
              <UserPlus className="h-5 w-5" /> 가입 승인 대기 ({pendingStaff.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>이름</TableHead>
                  <TableHead>연락처</TableHead>
                  <TableHead>신청일</TableHead>
                  <TableHead className="text-right">승인 / 거절</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingStaff.map((staff) => (
                  <TableRow key={staff.id} className="hover:bg-orange-100/50 dark:hover:bg-orange-900/20">
                    <TableCell className="font-medium">
                      {getDisplayName(staff)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {getDisplayPhone(staff) || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(staff.joined_at).toLocaleDateString('ko-KR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 w-8 p-0 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                          onClick={() => handleReject(staff.id)}
                          disabled={!canManage || processingId === staff.id}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          className="h-8 w-8 p-0 bg-green-600 hover:bg-green-700"
                          onClick={() => handleApprove(staff.id)}
                          disabled={!canManage || processingId === staff.id}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 전체 직원 목록 */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">프로필</TableHead>
              <TableHead>이름 / 이메일</TableHead>
              <TableHead>역할</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>합류일</TableHead>
              <TableHead className="text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeStaff.map((staff) => (
              <TableRow key={staff.id}>
                <TableCell>
                  <Avatar>
                    <AvatarImage src={staff.profile?.avatar_url || ''} />
                    <AvatarFallback>
                      {getDisplayName(staff).substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{getDisplayName(staff)}</span>
                    <span className="text-xs text-muted-foreground">{getDisplayEmail(staff)}</span>
                    {getDisplayPhone(staff) && (
                       <span className="text-xs text-muted-foreground mt-0.5">{getDisplayPhone(staff)}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getRoleIcon(staff.role)}
                    {getRoleBadge(staff.role)}
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(staff.status, staff.user_id)}</TableCell>
                <TableCell>
                  {new Date(staff.joined_at).toLocaleDateString('ko-KR')}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem 
                        onClick={() => {
                          setEditingStaff(staff)
                          setDialogOpen(true)
                        }}
                        disabled={!canManage}
                      >
                        정보 수정
                      </DropdownMenuItem>
                      <DropdownMenuItem>근무 일정 보기</DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600" disabled={!canManage}>
                        퇴사 처리
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {activeStaff.length === 0 && (
               <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  등록된 직원이 없습니다.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <EditStaffDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          staff={editingStaff}
          storeId={storeId}
          canManage={canManage}
        />
      </div>
    </div>
  )
}