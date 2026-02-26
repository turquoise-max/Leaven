'use client'

import { useState } from 'react'
import { createStore } from '../actions'
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
import { Textarea } from '@/components/ui/textarea'

export function StoreForm() {
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    const result = await createStore(formData)
    if (result?.error) {
      setError(result.error)
    }
  }

  return (
    <Card className="mx-auto w-full">
      <CardHeader>
        <CardTitle className="text-xl">매장 등록</CardTitle>
        <CardDescription>
          새로운 매장을 등록하고 관리를 시작하세요.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">상호명</Label>
            <Input
              id="name"
              name="name"
              placeholder="예: 맛있는 베이커리"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="business_number">사업자등록번호</Label>
            <Input
              id="business_number"
              name="business_number"
              placeholder="000-00-00000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">매장 주소</Label>
            <Input
              id="address"
              name="address"
              placeholder="서울시 강남구..."
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">매장 소개 (선택)</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="매장에 대한 간단한 소개를 입력해주세요."
            />
          </div>

          {error && <div className="text-sm text-red-500">{error}</div>}

          <Button type="submit" className="w-full">
            매장 등록하기
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}