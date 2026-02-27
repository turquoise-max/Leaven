'use client'

import * as React from 'react'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { Sidebar } from '@/components/dashboard/sidebar'
import { StaffSidebar } from '@/components/dashboard/staff-sidebar'
import { Header } from '@/components/dashboard/header'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DashboardLayoutProps {
  children: React.ReactNode
  user: {
    email: string
    full_name: string | null
    avatar_url: string | null
  }
  role: string
  storeName: string
  storeList: {
    id: string
    name: string
    role: string
  }[]
  staffList: any[]
  defaultLayout?: number[] | undefined
  navCollapsedSize?: number
}

export function DashboardClientLayout({
  children,
  user,
  role,
  storeName,
  storeList,
  staffList,
  defaultLayout = [25, 75],
  navCollapsedSize = 4,
}: DashboardLayoutProps) {
  // 우측 사이드바 상태 (기본값: true)
  const [showRightSidebar, setShowRightSidebar] = React.useState(true)

  const toggleRightSidebar = () => {
    setShowRightSidebar(!showRightSidebar)
  }

  // defaultLayout이 3개 요소라면 2개로 줄임 (이전 버전 호환성)
  const safeDefaultLayout = defaultLayout && defaultLayout.length === 3 
    ? [defaultLayout[0], defaultLayout[1] + defaultLayout[2]] 
    : defaultLayout || [25, 75]

  return (
    <div className="h-screen w-full bg-background overflow-hidden flex">
      {/* Mobile Layout (Hidden on LG and above) */}
      <div className="flex flex-col h-full w-full lg:hidden">
        <Header storeName={storeName} />
        <main className="flex-1 overflow-auto p-4 bg-muted/5">
          {children}
        </main>
      </div>

      {/* Desktop Layout (Discord Style) */}
      <div className="hidden lg:flex h-full w-full">
        {/* 1. Store List Sidebar (Fixed Width) */}
        <div className="w-[72px] flex-none border-r bg-muted/10 flex flex-col items-center py-4 space-y-4 overflow-y-auto hide-scrollbar z-10">
          {storeList.map((store) => (
            <div key={store.id} className="group relative flex items-center justify-center">
              {/* Active Indicator (Optional - assuming first is active for now) */}
              {store.name === storeName && (
                <div className="absolute left-0 w-[4px] h-[36px] bg-primary rounded-r-full" />
              )}
              
              <button 
                className={cn(
                  "relative flex items-center justify-center w-12 h-12 rounded-[24px] group-hover:rounded-[16px] transition-all duration-300 overflow-hidden",
                  store.name === storeName ? "bg-primary rounded-[16px]" : "bg-background hover:bg-primary"
                )}
                title={store.name}
              >
                <Avatar className="w-full h-full bg-transparent">
                  {/* TODO: Add store logo url */}
                  <AvatarFallback className={cn(
                    "text-foreground font-semibold bg-transparent group-hover:text-primary-foreground",
                    store.name === storeName && "text-primary-foreground"
                  )}>
                    {store.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </button>
            </div>
          ))}
          
          <div className="w-8 h-[2px] bg-border rounded-full mx-auto" />
          
          <button 
            className="flex items-center justify-center w-12 h-12 rounded-[24px] bg-background hover:bg-green-500 hover:text-white transition-all duration-300 group hover:rounded-[16px]"
            title="Add Store"
          >
            <PlusIcon className="w-6 h-6 text-green-500 group-hover:text-white transition-colors" />
          </button>
        </div>

        {/* Resizable Area & Overlay Container */}
        <div className="flex-1 h-full min-w-0 relative">
          {/* @ts-ignore */}
          <ResizablePanelGroup
            direction="horizontal"
            autoSaveId="layout-v8"
            storage={{
              getItem: (name: string) => {
                // SSR에서 이미 defaultLayout을 처리하므로 클라이언트에서는 null을 반환하여
                // 컴포넌트의 defaultSize prop을 사용하도록 유도합니다.
                return null
              },
              setItem: (name: string, value: string) => {
                // 쿠키에 레이아웃 저장 (1년 유효기간)
                document.cookie = `${name}=${value}; path=/; max-age=31536000; SameSite=Lax`
              },
            }}
            className="h-full items-stretch"
          >
            {/* 2. Management Menu Sidebar (Resizable, Not Collapsible) */}
            <ResizablePanel
              defaultSize={safeDefaultLayout[0]}
              minSize={15}
              maxSize={90}
              collapsible={false}
              className="bg-background"
            >
              <Sidebar 
                user={user} 
                role={role} 
                isCollapsed={false}
              />
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* 3. Main Content */}
            <ResizablePanel defaultSize={safeDefaultLayout[1]} minSize={10}>
              <div className="flex flex-col h-full min-w-0">
                <Header 
                  storeName={storeName} 
                  showRightSidebar={showRightSidebar}
                  onToggleRightSidebar={toggleRightSidebar}
                />
                <main className="flex-1 overflow-auto p-6 bg-muted/5">
                  {children}
                </main>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>

          {/* 4. Right Sidebar (Overlay) */}
          {showRightSidebar && (
            <div className="absolute right-0 top-0 h-full w-[280px] bg-background border-l shadow-xl z-20">
              <StaffSidebar staffList={staffList} onClose={() => setShowRightSidebar(false)} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}