'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { 
  CalendarDays, 
  CalendarRange,
  LayoutDashboard, 
  Settings, 
  Users,
  LogOut,
  Package2,
  CheckSquare,
  Store,
  Umbrella,
  BarChart3,
  Archive
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { logout } from '@/features/auth/actions'
import { toast } from 'sonner'

interface SidebarProps {
  user: {
    email: string
    full_name: string | null
    avatar_url: string | null
  }
  memberId?: string
  role: string
  roleName?: string
  roleColor?: string
  isCollapsed?: boolean
  className?: string
  permissions?: Record<string, boolean>
}

export function Sidebar({
  user,
  memberId,
  role,
  roleName,
  roleColor,
  isCollapsed = false,
  className,
  permissions = {},
}: SidebarProps) {
  const pathname = usePathname()

  const isManager = role === 'owner' || role === 'manager'

  const navGroups = [
    {
      title: '메인',
      items: [
        ...(permissions.view_dashboard ? [{
          title: '대시보드',
          href: '/dashboard',
          icon: LayoutDashboard,
          isUpcoming: false
        }] : []),
        ...(permissions.view_tasks ? [{
          title: '할 일',
          href: permissions.view_dashboard ? '/dashboard/my-tasks' : '/dashboard',
          icon: CheckSquare,
          isUpcoming: false
        }] : [])
      ]
    },
    {
      title: '근무 및 일정 관리',
      items: [
        ...(permissions.view_schedule ? [{
          title: '스케줄 관리',
          href: '/dashboard/schedule',
          icon: CalendarRange,
          isUpcoming: false
        }] : []),
        ...(permissions.view_attendance ? [{
          title: '출퇴근 관리',
          href: '/dashboard/attendance',
          icon: CalendarDays,
          isUpcoming: false
        }] : []),
        ...(permissions.view_leave ? [{
          title: '휴가 및 연차',
          href: '/dashboard/leave',
          icon: Umbrella,
          isUpcoming: false
        }] : [])
      ]
    },
    {
      title: '인사 및 급여 관리',
      items: [
        ...(permissions.view_staff ? [{
          title: '직원 관리',
          href: '/dashboard/staff',
          icon: Users,
          isUpcoming: false
        }] : []),
        ...(permissions.manage_roles || role === 'owner' ? [{
          title: '직급 및 권한 설정',
          href: '/dashboard/roles',
          icon: Settings,
          isUpcoming: false
        }] : []),
      ]
    },

    ...(permissions.manage_store ? [{
      title: '시스템 설정',
      items: [
        {
          title: '매장 설정',
          href: '/dashboard/settings',
          icon: Store,
          isUpcoming: false
        }
      ]
    }] : [])
  ]

  const handleUpcomingClick = (e: React.MouseEvent, isUpcoming?: boolean) => {
    if (isUpcoming) {
      e.preventDefault()
      toast.info('현재 준비 중인 메뉴입니다.', {
        description: '다음 업데이트에 추가될 예정입니다.',
      })
    }
  }

  return (
    <div
      className={cn(
        "relative flex flex-col h-full w-full bg-background border-r",
        className
      )}
    >
      {/* Logo Area */}
      <div className={cn(
        "flex h-16 items-center border-b px-4 shrink-0",
        isCollapsed ? "justify-center" : "justify-start gap-2"
      )}>
        <Package2 className="h-6 w-6 text-primary" />
        {!isCollapsed && (
          <span className="text-lg font-bold truncate">Leaven</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-6 p-2 overflow-y-auto py-4">
        <TooltipProvider delayDuration={0}>
          {navGroups.map((group, index) => {
            if (group.items.length === 0) return null;
            return (
            <div key={index} className="space-y-1">
              {!isCollapsed && (
                <h4 className="px-2 text-xs font-semibold text-muted-foreground mb-2">
                  {group.title}
                </h4>
              )}
              {group.items.map((item) => {
                const isActive = pathname === item.href && !item.isUpcoming
                return isCollapsed ? (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        onClick={(e) => handleUpcomingClick(e, item.isUpcoming)}
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-muted hover:text-foreground mb-1 relative",
                          isActive ? "bg-muted text-primary" : "text-muted-foreground",
                          item.isUpcoming && "opacity-60 hover:opacity-100"
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                        {item.isUpcoming && (
                          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary/80"></span>
                          </span>
                        )}
                        <span className="sr-only">{item.title}</span>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="flex flex-col items-start gap-1">
                      <span>{item.title}</span>
                      {item.isUpcoming && (
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm">준비 중</span>
                      )}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={(e) => handleUpcomingClick(e, item.isUpcoming)}
                    className={cn(
                      "flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground overflow-hidden group",
                      isActive ? "bg-muted text-primary" : "text-muted-foreground",
                      item.isUpcoming && "opacity-70 hover:opacity-100"
                    )}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.title}</span>
                    </div>
                    {item.isUpcoming && (
                      <span className="shrink-0 ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary group-hover:bg-primary/20 transition-colors">
                        준비 중
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          )})}
        </TooltipProvider>
      </nav>

      {/* User Profile (Bottom) */}
      <div className="border-t p-4">
        <div className={cn(
          "flex items-center gap-3",
          isCollapsed ? "justify-center" : "mb-4"
        )}>
          <Avatar className="h-9 w-9 border shrink-0 shadow-sm transition-transform hover:scale-105">
            {/* 구글 아바타 대신 이름 이니셜과 역할 컬러를 조합한 아바타를 우선적으로 보여줌 */}
            <AvatarFallback 
              className="text-white font-bold text-xs"
              style={{ 
                backgroundColor: roleColor || (role === 'owner' ? '#3b82f6' : '#10b981'),
                textShadow: '0px 1px 2px rgba(0,0,0,0.1)'
              }}
            >
              {user.full_name?.substring(0, 2) || 'Me'}
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex flex-col overflow-hidden">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{user.full_name}</span>
                {memberId && (
                  <span className="text-[10px] text-muted-foreground/60 font-mono">
                    #{memberId.substring(0, 4)}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground capitalize truncate">
                {roleName || role}
              </span>
            </div>
          )}
        </div>
        
        {!isCollapsed ? (
           <div className="flex gap-2">
             <Link href="/account?next=/dashboard" className="flex-1">
               <Button variant="outline" size="sm" className="w-full h-8 text-xs font-normal">
                 <Settings className="mr-2 h-3.5 w-3.5" />
                 계정 설정
               </Button>
             </Link>
             <form action={async () => {
               await logout()
             }} className="flex-1">
               <Button variant="outline" size="sm" className="w-full h-8 text-xs font-normal text-destructive hover:text-destructive hover:bg-destructive/10">
                 <LogOut className="mr-2 h-3.5 w-3.5" />
                 로그아웃
               </Button>
             </form>
           </div>
        ) : (
           <div className="flex flex-col gap-2 mt-4 items-center border-t pt-4 w-full">
             <TooltipProvider delayDuration={0}>
               <Tooltip>
                 <TooltipTrigger asChild>
                   <Link href="/account?next=/dashboard">
                     <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                       <Settings className="h-4 w-4" />
                       <span className="sr-only">계정 설정</span>
                     </Button>
                   </Link>
                 </TooltipTrigger>
                 <TooltipContent side="right">계정 설정</TooltipContent>
               </Tooltip>
               
               <Tooltip>
                 <TooltipTrigger asChild>
                   <form action={async () => {
                     await logout()
                   }}>
                     <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                       <LogOut className="h-4 w-4" />
                       <span className="sr-only">로그아웃</span>
                     </Button>
                   </form>
                 </TooltipTrigger>
                 <TooltipContent side="right">로그아웃</TooltipContent>
               </Tooltip>
             </TooltipProvider>
           </div>
        )}
      </div>
    </div>
  )
}
