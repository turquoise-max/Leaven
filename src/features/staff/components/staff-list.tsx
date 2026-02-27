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
import { MoreHorizontal, Shield, ShieldAlert, ShieldCheck, User } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { EditStaffDialog } from './edit-staff-dialog'

interface StaffMember {
  id: string
  user_id: string
  role: 'owner' | 'manager' | 'staff'
  status: 'active' | 'invited' | 'pending_approval'
  wage_type?: 'hourly' | 'monthly'
  base_wage?: number
  joined_at: string
  profile: {
    full_name: string | null
    email: string | null
    avatar_url: string | null
  }
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

  useEffect(() => {
    setStaffList(initialData)
  }, [initialData])

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

  const getStatusBadge = (status: string) => {
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
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">프로필</TableHead>
            <TableHead>이름 / 이메일</TableHead>
            <TableHead>역할</TableHead>
            <TableHead>상태</TableHead>
            <TableHead>합류일</TableHead>
            <TableHead className="text-right">관리</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {staffList.map((staff) => (
            <TableRow key={staff.id}>
              <TableCell>
                <Avatar>
                  <AvatarImage src={staff.profile?.avatar_url || ''} />
                  <AvatarFallback>
                    {staff.profile?.full_name?.substring(0, 2) || 'St'}
                  </AvatarFallback>
                </Avatar>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{staff.profile?.full_name || '이름 없음'}</span>
                  <span className="text-xs text-muted-foreground">{staff.profile?.email}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {getRoleIcon(staff.role)}
                  {getRoleBadge(staff.role)}
                </div>
              </TableCell>
              <TableCell>{getStatusBadge(staff.status)}</TableCell>
              <TableCell>
                {new Date(staff.joined_at).toLocaleDateString()}
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
          {staffList.length === 0 && (
             <TableRow>
              <TableCell colSpan={6} className="h-24 text-center">
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
  )
}
