'use client'

import { useState } from 'react'
import { updateStore, deleteStore } from '../actions'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'

interface StoreSettingsFormProps {
  initialData: {
    id: string
    name: string
    address?: string
    business_number?: string
    description?: string
  }
}

export function StoreSettingsForm({ initialData }: StoreSettingsFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteStoreName, setDeleteStoreName] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

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

  async function handleDeleteStore() {
    setIsDeleting(true)
    try {
      const result = await deleteStore(initialData.id)
      if (result?.error) {
        toast.error("매장 삭제 실패", {
          description: result.error,
        })
        setIsDeleting(false)
      } else {
        toast.success("매장 삭제 완료", {
          description: "매장이 삭제되었습니다. 대시보드로 이동합니다.",
        })
        // 리다이렉트는 서버 액션에서 처리됨
      }
    } catch (e) {
      toast.error("오류 발생", { description: "알 수 없는 오류가 발생했습니다." })
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-8">
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

      <Card className="border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20">
        <CardHeader>
          <CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            위험 구역 (Danger Zone)
          </CardTitle>
          <CardDescription className="text-red-600/80 dark:text-red-400/80">
            이 작업은 되돌릴 수 없습니다. 매장을 삭제하면 모든 직원, 스케줄, 데이터가 영구적으로 삭제됩니다.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-end">
          <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive">매장 삭제하기</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>정말 매장을 삭제하시겠습니까?</DialogTitle>
                <DialogDescription>
                  이 작업은 되돌릴 수 없습니다. 삭제를 확인하려면 매장 이름 <strong>{initialData.name}</strong>을(를) 입력해주세요.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Input
                  value={deleteStoreName}
                  onChange={(e) => setDeleteStoreName(e.target.value)}
                  placeholder={initialData.name}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>취소</Button>
                <Button 
                  variant="destructive" 
                  onClick={handleDeleteStore}
                  disabled={deleteStoreName !== initialData.name || isDeleting}
                >
                  {isDeleting ? '삭제 중...' : '삭제 확인'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardFooter>
      </Card>
    </div>
  )
}
