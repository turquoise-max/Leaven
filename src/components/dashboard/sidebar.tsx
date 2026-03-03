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
  LayoutDashboard, 
  Settings, 
  Users,
  LogOut,
  Package2,
  CheckSquare,
  Store
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { logout } from '@/features/auth/actions'

interface SidebarProps {
  user: {
    email: string
    full_name: string | null
    avatar_url: string | null
  }
  role: string
  isCollapsed?: boolean
  className?: string
}

export function Sidebar({ user, role, isCollapsed = false, className }: SidebarProps) {
  const pathname = usePathname()

  const navGroups = [
    {
      title: '메인',
      items: [
        {
          title: '대시보드',
          href: '/dashboard',
          icon: LayoutDashboard,
        }
      ]
    },
    {
      title: '근무 관리',
      items: [
        {
          title: '근무표',
          href: '/dashboard/schedule',
          icon: CalendarDays,
        },
        {
          title: '업무 관리',
          href: '/dashboard/tasks',
          icon: CheckSquare,
        }
      ]
    },
    {
      title: '매장 관리',
      items: [
        {
          title: '직원 관리',
          href: '/dashboard/staff',
          icon: Users,
        },
        {
          title: '매장 설정',
          href: '/dashboard/settings',
          icon: Store, // Settings 아이콘 대신 Store 사용 (매장 설정이므로)
        }
      ]
    }
  ]

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
          {navGroups.map((group, index) => (
            <div key={index} className="space-y-1">
              {!isCollapsed && (
                <h4 className="px-2 text-xs font-semibold text-muted-foreground mb-2">
                  {group.title}
                </h4>
              )}
              {group.items.map((item) => {
                const isActive = pathname === item.href
                return isCollapsed ? (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-muted hover:text-foreground mb-1",
                          isActive ? "bg-muted text-primary" : "text-muted-foreground"
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                        <span className="sr-only">{item.title}</span>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="flex items-center gap-4">
                      {item.title}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground overflow-hidden",
                      isActive ? "bg-muted text-primary" : "text-muted-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.title}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </TooltipProvider>
      </nav>

      {/* User Profile (Bottom) */}
      <div className="border-t p-4">
        <div className={cn(
          "flex items-center gap-3",
          isCollapsed ? "justify-center flex-col" : "justify-between"
        )}>
          <div className={cn(
            "flex items-center gap-3 overflow-hidden",
            isCollapsed && "justify-center"
          )}>
            <Avatar className="h-9 w-9 border">
              <AvatarImage src={user.avatar_url || ''} />
              <AvatarFallback>{user.full_name?.substring(0, 2) || 'Me'}</AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="flex flex-col truncate">
                <span className="text-sm font-medium truncate">{user.full_name}</span>
                <span className="text-xs text-muted-foreground capitalize truncate">{role}</span>
              </div>
            )}
          </div>
          
          {!isCollapsed ? (
             <form action={async () => {
               await logout()
             }}>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                <LogOut className="h-4 w-4" />
                <span className="sr-only">Log out</span>
              </Button>
            </form>
          ) : (
             <TooltipProvider delayDuration={0}>
               <Tooltip>
                 <TooltipTrigger asChild>
                   <form action={async () => {
                     await logout()
                   }} className="mt-2">
                     <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                       <LogOut className="h-4 w-4" />
                     </Button>
                   </form>
                 </TooltipTrigger>
                 <TooltipContent side="right">Log out</TooltipContent>
               </Tooltip>
             </TooltipProvider>
          )}
        </div>
      </div>
    </div>
  )
}