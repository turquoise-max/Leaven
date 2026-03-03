import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  CalendarDays, 
  Store, 
  Users, 
  BarChart3, 
  CheckCircle2,
  ArrowRight
} from "lucide-react"
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/home')
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="container flex h-14 items-center justify-between mx-auto">
          <div className="flex items-center gap-2 font-bold text-xl">
            <Store className="h-6 w-6 text-primary" />
            <span>Leaven</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/login">
              <Button size="sm">로그인</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-linear-to-b from-white to-gray-50 dark:from-gray-950 dark:to-gray-900">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none bg-clip-text text-transparent bg-linear-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400">
                  매장 관리의 모든 것, <br className="hidden sm:inline" />
                  Leaven으로 해결하세요
                </h1>
                <p className="mx-auto max-w-225 text-gray-500 md:text-xl dark:text-gray-400 md:whitespace-nowrap">
                  복잡한 스케줄 관리, 직원 급여 계산, 다지점 운영까지. 점주님은 오직 매장 성장에만 집중하세요.
                </p>
              </div>
              <div className="space-x-4">
                <Link href="/login">
                  <Button size="lg" className="h-11 px-8">
                    지금 무료로 시작하기 <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/coming-soon">
                  <Button variant="outline" size="lg" className="h-11 px-8">
                    대시보드 미리보기
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 bg-white dark:bg-gray-950">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-gray-100 px-3 py-1 text-sm dark:bg-gray-800">
                  Key Features
                </div>
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">
                  매장 운영에 필요한 핵심 기능
                </h2>
                <p className="max-w-225 text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
                  Leaven은 카페, 베이커리 등 소규모 매장부터 프랜차이즈까지 모두를 위한 통합 관리 솔루션입니다.
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 mt-12">
              <Card>
                <CardHeader>
                  <CalendarDays className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>스마트 스케줄링</CardTitle>
                  <CardDescription>
                    드래그 앤 드롭으로 간편하게 근무표를 작성하고, 직원들에게 실시간으로 공유하세요.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="grid gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" /> 주간/월간 캘린더 뷰
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" /> 근무 템플릿 저장
                    </li>
                  </ul>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <Users className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>직원 관리 & 급여</CardTitle>
                  <CardDescription>
                    직원 정보 관리부터 복잡한 급여 계산까지 자동으로 처리됩니다.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="grid gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" /> 시급/월급 자동 계산
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" /> 주휴수당 포함 옵션
                    </li>
                  </ul>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <BarChart3 className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>매출 분석 & 리포트</CardTitle>
                  <CardDescription>
                    매일의 매출 현황을 한눈에 파악하고, 데이터 기반의 의사결정을 내리세요.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="grid gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" /> 일별/월별 매출 추이
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" /> 인기 메뉴 분석
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 bg-gray-100 dark:bg-gray-800">
          <div className="container grid items-center justify-center gap-4 px-4 text-center md:px-6 mx-auto">
            <div className="space-y-3">
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl/tight">
                지금 바로 시작하세요
              </h2>
              <p className="mx-auto max-w-150 text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
                복잡한 설치 없이 웹에서 바로 사용할 수 있습니다.
              </p>
            </div>
            <div className="mx-auto w-full max-w-sm space-y-2">
              <Link href="/login">
                <Button size="lg" className="w-full">
                  무료로 시작하기
                </Button>
              </Link>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                신용카드 정보 입력 없이 14일간 무료 체험 가능합니다.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          © 2026 Leaven Inc. All rights reserved.
        </p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link className="text-xs hover:underline underline-offset-4" href="#">
            Terms of Service
          </Link>
          <Link className="text-xs hover:underline underline-offset-4" href="#">
            Privacy
          </Link>
        </nav>
      </footer>
    </div>
  )
}