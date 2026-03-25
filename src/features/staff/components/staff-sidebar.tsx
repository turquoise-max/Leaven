import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Shield, ShieldAlert, ShieldCheck, User, X, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMemo } from 'react'

interface RoleInfo {
  id: string
  name: string
  color: string
  priority: number
  is_system: boolean
}

interface StaffMember {
  id: string
  role: string
  status: string
  name?: string
  profile: {
    full_name: string | null
    email: string | null
    avatar_url: string | null
  }
  role_info?: RoleInfo
}

interface StaffSidebarProps {
  staffList: StaffMember[]
  onClose?: () => void
}

export function StaffSidebar({ staffList, onClose }: StaffSidebarProps) {
  // 역할별로 그룹화 및 정렬
  const groupedStaff = useMemo(() => {
    const groups: Record<string, { role: RoleInfo, members: StaffMember[] }> = {}
    
    staffList.forEach(member => {
      // role_info가 없는 경우 (예외 처리, legacy 데이터 등)
      // role 문자열을 기반으로 임시 roleInfo 생성
      const fallbackColor = member.role === 'owner' ? '#7c3aed' : (member.role === 'manager' ? '#4f46e5' : '#808080')
      const fallbackName = member.role === 'owner' ? '점주' : (member.role === 'manager' ? '매니저' : '직원')
      const fallbackPriority = member.role === 'owner' ? 100 : (member.role === 'manager' ? 50 : 0)

      const roleInfo = member.role_info || {
        id: member.role, // 임시 ID
        name: fallbackName,
        color: fallbackColor,
        priority: fallbackPriority,
        is_system: true
      }
      
      const roleId = roleInfo.id
      
      if (!groups[roleId]) {
        groups[roleId] = { role: roleInfo, members: [] }
      }
      groups[roleId].members.push(member)
    })
    
    // 우선순위 높은 순으로 정렬 (내림차순)
    return Object.values(groups).sort((a, b) => b.role.priority - a.role.priority)
  }, [staffList])

  const getRoleIcon = (roleName: string, isSystem: boolean) => {
    if (roleName === '점주' || roleName === 'Owner') return <ShieldAlert className="h-3 w-3" />
    if (roleName === '매니저' || roleName === 'Manager') return <ShieldCheck className="h-3 w-3" />
    return <User className="h-3 w-3" /> // 기본 아이콘
  }

  return (
    <div className="flex h-full w-full flex-col border-l bg-muted/10">
      <div className="flex h-12 items-center justify-between px-4 border-b">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Users className="h-4 w-4" />
          직원 목록
        </h2>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
            <span className="sr-only">Close sidebar</span>
          </Button>
        )}
      </div>
      <ScrollArea className="flex-1 p-3">
        {groupedStaff.map((group) => (
          <div key={group.role.id} className="mb-6">
            <h3 
              className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5"
              style={{ color: group.role.color }}
            >
              {getRoleIcon(group.role.name, group.role.is_system)}
              {group.role.name} — {group.members.length}
            </h3>
            <div className="space-y-1">
              {group.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50 transition-colors group"
                >
                  <div className="relative">
                    <Avatar className="h-8 w-8 border border-border">
                      <AvatarImage src={member.profile?.avatar_url || ''} />
                      <AvatarFallback className="text-xs">
                        {(member.profile?.full_name || member.name)?.substring(0, 2) || 'St'}
                      </AvatarFallback>
                    </Avatar>
                    {/* Status Indicator */}
                    <span 
                      className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background ${
                        member.status === 'invited' ? 'bg-yellow-400' : 
                        member.status === 'pending_approval' ? 'bg-orange-500' : 'bg-green-500'
                      }`} 
                    />
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-sm font-medium truncate group-hover:text-foreground transition-colors">
                      {member.profile?.full_name || member.name || '이름 없음'}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {member.status === 'invited' ? '초대됨' : 
                       member.status === 'pending_approval' ? '승인 대기' : '온라인'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        
        {groupedStaff.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <User className="h-8 w-8 mb-2 opacity-20" />
            <p className="text-xs">등록된 직원이 없습니다.</p>
          </div>
        )}
      </ScrollArea>
    </div>
  )
}