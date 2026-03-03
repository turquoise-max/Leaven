import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Store, Users } from 'lucide-react'

export function RoleSelection() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Welcome to Leaven</h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          서비스 이용을 위해 역할을 선택해주세요.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/onboarding/owner" className="block h-full">
          <Card className="h-full cursor-pointer transition-all hover:border-primary hover:shadow-md">
            <CardHeader>
              <Store className="mb-2 h-8 w-8 text-primary" />
              <CardTitle>점주 (Owner)</CardTitle>
              <CardDescription>
                매장을 등록하고 직원을 관리합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-4 text-sm text-gray-500 space-y-1">
                <li>매장 정보 관리</li>
                <li>직원 스케줄링</li>
                <li>매출 및 재고 관리</li>
              </ul>
            </CardContent>
          </Card>
        </Link>

        <Link href="/onboarding/staff" className="block h-full">
          <Card className="h-full cursor-pointer transition-all hover:border-primary hover:shadow-md">
            <CardHeader>
              <Users className="mb-2 h-8 w-8 text-primary" />
              <CardTitle>직원 (Staff)</CardTitle>
              <CardDescription>
                근무 스케줄을 확인하고 업무를 관리합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-4 text-sm text-gray-500 space-y-1">
                <li>근무 일정 확인</li>
                <li>급여 명세서 조회</li>
                <li>업무 체크리스트</li>
              </ul>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}