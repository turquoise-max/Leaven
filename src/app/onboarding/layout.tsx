import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { logout } from "@/features/auth/actions"

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  async function handleLogout() {
    'use server'
    await logout()
  }

  return (
    <div className="relative flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="absolute right-4 top-4">
        <form action={handleLogout}>
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4" />
            로그아웃
          </Button>
        </form>
      </div>
      <div className="w-full max-w-lg p-6">
        {children}
      </div>
    </div>
  )
}