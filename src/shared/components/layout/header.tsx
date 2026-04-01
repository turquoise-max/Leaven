'use client'

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
      </div>
    </header>
  )
}
