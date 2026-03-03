import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Construction } from "lucide-react"

export default function ComingSoonPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <Construction className="h-10 w-10 text-muted-foreground" />
      </div>
      <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
        서비스 준비 중입니다
      </h1>
      <p className="mt-4 text-lg text-muted-foreground max-w-150 break-keep">
        대시보드 미리보기 기능은 현재 개발 중입니다.<br />
        더 나은 서비스를 제공하기 위해 열심히 준비하고 있으니 조금만 기다려주세요!
      </p>
      <div className="mt-8">
        <Link href="/">
          <Button size="lg">홈으로 돌아가기</Button>
        </Link>
      </div>
    </div>
  )
}