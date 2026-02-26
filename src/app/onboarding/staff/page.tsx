import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function StaffOnboardingPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/onboarding">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">직원 시작하기</h1>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>매장 찾기</CardTitle>
          <CardDescription>
            근무할 매장의 코드를 입력하거나 초대 링크를 확인해주세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="store_code">매장 코드</Label>
            <Input id="store_code" placeholder="코드를 입력하세요" />
          </div>
          <Button className="w-full" disabled>매장 검색 (준비 중)</Button>
        </CardContent>
      </Card>

      <div className="text-center">
        <Button variant="link" asChild>
          <Link href="/dashboard">
            매장 없이 시작하기 (대시보드로 이동)
          </Link>
        </Button>
      </div>
    </div>
  )
}