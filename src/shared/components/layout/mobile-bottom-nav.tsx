'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { 
  CalendarDays, 
  CalendarRange,
  Settings, 
  CheckSquare,
  Umbrella
} from 'lucide-react'

interface MobileBottomNavProps {
  role: string
  permissions?: Record<string, boolean>
}

export function MobileBottomNav({ role, permissions = {} }: MobileBottomNavProps) {
  const pathname = usePathname()
  
  const isManager = role === 'owner' || role === 'manager'

  const navItems = [
    {
      title: '출결',
      href: '/dashboard/attendance',
      icon: CalendarDays,
    },
    {
      title: '주간 스케줄',
      href: '/dashboard/schedule',
      icon: CalendarRange,
    },
    {
      title: '할 일',
      href: isManager ? '/dashboard/my-tasks' : '/dashboard',
      icon: CheckSquare,
    },
    {
      title: '휴가 신청',
      href: '/dashboard/leave',
      icon: Umbrella,
    },
    {
      title: '설정',
      href: '/account?next=/dashboard',
      icon: Settings,
    }
  ]

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-background border-t flex items-center justify-around px-2 pb-safe z-40">
      {navItems.map((item) => {
        const isActive = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors relative",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className={cn(
              "flex items-center justify-center w-12 h-8 rounded-full transition-colors",
              isActive && "bg-primary/10"
            )}>
              <item.icon className={cn("h-5 w-5", isActive && "stroke-[2.5px]")} />
            </div>
            <span className={cn(
              "text-[10px] font-medium tracking-tight",
              isActive && "font-bold"
            )}>
              {item.title}
            </span>
          </Link>
        )
      })}
    </div>
  )
}