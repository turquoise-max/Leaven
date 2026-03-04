'use client'

import { useState } from 'react'
import { resetPassword } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Store } from 'lucide-react'

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    setMessage(null)

    const result = await resetPassword(formData)
    
    if (result?.error) {
      setError(result.error)
    } else {
      setMessage('비밀번호 재설정 링크가 이메일로 발송되었습니다.')
    }
    setLoading(false)
  }

  return (
    <div className="mx-auto flex w-full max-w-125 flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Store className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold">비밀번호 찾기</h1>
        <p className="text-sm text-muted-foreground">
          가입하신 이메일 주소를 입력해주세요
        </p>
      </div>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-xl">비밀번호 재설정</CardTitle>
          <CardDescription>
            입력하신 이메일로 비밀번호 재설정 링크를 보내드립니다.
            <br />
            <span className="text-xs text-muted-foreground mt-2 block">
              * 구글 등 소셜 계정으로 가입하신 경우에도, 여기서 비밀번호를 설정하면 이메일 로그인이 가능해집니다.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="grid gap-4">
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
            {error && <div className="text-sm text-red-500">{error}</div>}
            {message && <div className="text-sm text-green-500">{message}</div>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '발송 중...' : '재설정 링크 보내기'}
            </Button>
            <div className="text-center text-sm">
              <Link href="/login" className="underline">
                로그인으로 돌아가기
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}