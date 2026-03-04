'use client'

import Link from 'next/link'
import { useState } from 'react'
import { login, signInWithGoogle } from '../actions'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Store } from 'lucide-react'

export function LoginForm() {
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(formData: FormData) {
    const result = await login(formData)
    if (result?.error) {
      setError(result.error)
    }
  }

  async function handleGoogleLogin() {
    const result = await signInWithGoogle()
    if (result?.error) {
      setError(result.error)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-125 flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Store className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold">환영합니다</h1>
        <p className="text-sm text-muted-foreground">
          Leaven 서비스 이용을 위해 로그인해주세요
        </p>
      </div>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-xl">로그인</CardTitle>
          <CardDescription>
            이메일 주소와 비밀번호를 입력해주세요
          </CardDescription>
        </CardHeader>
        <CardContent>
        <form action={handleLogin} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="m@example.com"
              required
            />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center">
              <Label htmlFor="password">비밀번호</Label>
              <Link href="/forgot-password" className="ml-auto inline-block text-sm underline">
                비밀번호를 잊으셨나요?
              </Link>
            </div>
            <Input id="password" name="password" type="password" required />
          </div>
          {error && <div className="text-sm text-red-500">{error}</div>}
          <Button type="submit" className="w-full">
            로그인
          </Button>
        </form>
        <form action={handleGoogleLogin} className="mt-4">
          <Button variant="outline" type="submit" className="w-full">
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26.81-.58z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Google로 시작하기
          </Button>
        </form>
        <div className="mt-4 text-center text-sm">
          계정이 없으신가요?{' '}
          <Link href="/signup" className="underline">
            회원가입
          </Link>
        </div>
        </CardContent>
      </Card>
    </div>
  )
}
