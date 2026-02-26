'use client'

import { useState } from 'react'
import { updateStore } from '../actions'
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
import { toast } from 'sonner'

interface StoreSettingsFormProps {
  initialData: {
    name: string
    address?: string
    business_number?: string
    description?: string
  }
}

export function StoreSettingsForm({ initialData }: StoreSettingsFormProps) {
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    const result = await updateStore(formData)
    if (result?.error) {
      setError(result.error)
      toast.error("저장 실패", {
        description: result.error,
      })
    } else {
      setError(null)
      toast.success("저장 완료", {
        description: "매장 정보가 성공적으로 수정되었습니다.",
      })
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>매장 정보 수정</CardTitle>
        <CardDescription>
          매장의 기본 정보를 수정할 수 있습니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">상호명</Label>
            <Input
              id="name"
              name="name"
              defaultValue={initialData.name}
              placeholder="예: 맛있는 베이커리"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="business_number">사업자등록번호</Label>
            <Input
              id="business_number"
              name="business_number"
              defaultValue={initialData.business_number}
              placeholder="000-00-00000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">매장 주소</Label>
            <Input
              id="address"
              name="address"
              defaultValue={initialData.address}
              placeholder="서울시 강남구..."
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">매장 소개 (선택)</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={initialData.description}
              placeholder="매장에 대한 간단한 소개를 입력해주세요."
            />
          </div>

          {error && <div className="text-sm text-red-500">{error}</div>}

          <div className="flex justify-end">
            <Button type="submit">
              저장하기
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}