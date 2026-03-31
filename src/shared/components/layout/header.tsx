'use client'

import { Button } from '@/components/ui/button'
import { Bug, Sparkles } from 'lucide-react'

interface HeaderProps {
  storeName: string
}

export function Header({ storeName }: HeaderProps) {
  return (
    <header className="relative flex h-14 items-center justify-between border-b bg-background px-4 lg:h-15">
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-max max-w-[calc(100%-8rem)] text-center">
        <h1 className="text-xl font-bold truncate">{storeName}</h1>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" className="hidden lg:flex">
          <Bug className="h-5 w-5 text-muted-foreground" />
          <span className="sr-only">Bug report</span>
        </Button>

        <Button variant="ghost" size="icon" className="hidden lg:flex">
          <Sparkles className="h-5 w-5 text-muted-foreground" />
          <span className="sr-only">AI Chat</span>
        </Button>
      </div>
    </header>
  )
}
