import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Shield, ShieldAlert, ShieldCheck, User, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface StaffMember {
  id: string
  role: 'owner' | 'manager' | 'staff'
  status: string
  profile: {
    full_name: string | null
    email: string | null
    avatar_url: string | null
  }
}

interface StaffSidebarProps {
  staffList: StaffMember[]
  onClose?: () => void
}

export function StaffSidebar({ staffList, onClose }: StaffSidebarProps) {
  // 역할별로 그룹화
  const groupedStaff = {
    owner: staffList.filter((s) => s.role === 'owner'),
    manager: staffList.filter((s) => s.role === 'manager'),
    staff: staffList.filter((s) => s.role === 'staff'),
  }

  const renderGroup = (title: string, members: StaffMember[], icon: React.ReactNode) => {
    if (members.length === 0) return null
    return (
      <div className="mb-6">
        <h3 className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          {icon}
          {title} — {members.length}
        </h3>
        <div className="space-y-1">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50 transition-colors"
            >
              <div className="relative">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={member.profile?.avatar_url || ''} />
                  <AvatarFallback>{member.profile?.full_name?.substring(0, 2) || 'St'}</AvatarFallback>
                </Avatar>
                {/* Status Indicator (임시: 모두 초록색) */}
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-green-500" />
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-medium truncate">
                  {member.profile?.full_name || '이름 없음'}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  {member.status === 'invited' ? '초대됨' : '온라인'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col border-l bg-muted/10">
      <div className="flex h-12 items-center justify-between px-4 border-b">
        <h2 className="text-sm font-semibold">직원 목록</h2>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
            <span className="sr-only">Close sidebar</span>
          </Button>
        )}
      </div>
      <ScrollArea className="flex-1 p-3">
        {renderGroup('점주', groupedStaff.owner, <ShieldAlert className="h-3 w-3" />)}
        {renderGroup('매니저', groupedStaff.manager, <ShieldCheck className="h-3 w-3" />)}
        {renderGroup('직원', groupedStaff.staff, <User className="h-3 w-3" />)}
      </ScrollArea>
    </div>
  )
}