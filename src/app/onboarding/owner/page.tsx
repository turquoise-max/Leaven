import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { StoreForm } from '@/features/onboarding/components/store-form'
import { Button } from '@/components/ui/button'

export default function OwnerOnboardingPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/home">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">매장 등록</h1>
      </div>
      <StoreForm />
    </div>
  )
}