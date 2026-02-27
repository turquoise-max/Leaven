'use client'

import { Button } from '@/components/ui/button'
import { Menu, Package2, Users } from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface HeaderProps {
  storeName: string
  showRightSidebar?: boolean
  onToggleRightSidebar?: () => void
}

export function Header({ storeName, showRightSidebar, onToggleRightSidebar }: HeaderProps) {
  const pathname = usePathname()

  const navItems = [
    { title: '대시보드', href: '/dashboard' },
    { title: '근무 일정', href: '/dashboard/schedule' },
    { title: '직원 관리', href: '/dashboard/staff' },
    { title: '매장 설정', href: '/dashboard/settings' },
  ]

  return (
    <header className="flex h-14 items-center border-b bg-background px-4 lg:h-[60px]">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0 lg:hidden mr-4">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex flex-col">
          <nav className="grid gap-2 text-lg font-medium">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-lg font-semibold mb-4"
            >
              <Package2 className="h-6 w-6" />
              <span className="sr-only">Leaven</span>
              <span>{storeName}</span>
            </Link>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 hover:text-foreground",
                  pathname === item.href ? "bg-muted text-foreground" : "text-muted-foreground"
                )}
              >
                {item.title}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
      
      <div className="flex-1 flex justify-center items-center">
        <h1 className="text-xl font-bold">{storeName}</h1>
      </div>

      {onToggleRightSidebar && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleRightSidebar}
          className={cn(
            "hidden lg:flex ml-4",
            showRightSidebar && "bg-accent text-accent-foreground"
          )}
        >
          <Users className="h-5 w-5" />
          <span className="sr-only">Toggle staff list</span>
        </Button>
      )}

      {/* 우측 여백 (모바일 메뉴 버튼과 균형을 맞추기 위함, 필요시 다른 요소 추가) */}
      <div className="w-9 lg:hidden" />
    </header>
  )
}
