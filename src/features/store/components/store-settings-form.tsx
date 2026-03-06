'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
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
import { AlertTriangle, Search, MapPin, Save, RotateCcw } from 'lucide-react'
import { ImageUpload } from './image-upload'
import { OpeningHours } from './opening-hours'
import { cn } from '@/lib/utils'
import { StoreCodeDisplay } from '@/components/dashboard/store-code-display'

interface StoreSettingsFormProps {
  initialData: {
    id: string
    name: string
    address?: string
    business_number?: string
    description?: string
    owner_name?: string
    store_phone?: string
    zip_code?: string
    address_detail?: string
    image_url?: string
    opening_hours?: any
    invite_code?: string
  }
}

export function StoreSettingsForm({ initialData }: StoreSettingsFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteStoreName, setDeleteStoreName] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // 초기 상태 정의 (Memoized)
  const initialFormState = useMemo(() => ({
    name: initialData.name,
    owner_name: initialData.owner_name || '',
    business_number: initialData.business_number || '',
    store_phone: initialData.store_phone || '',
    description: initialData.description || '',
    zip_code: initialData.zip_code || '',
    address: initialData.address || '',
    address_detail: initialData.address_detail || '',
    image_url: initialData.image_url || null,
    opening_hours: initialData.opening_hours || {},
  }), [initialData])

  const [formData, setFormData] = useState(initialFormState)
  const [isDirty, setIsDirty] = useState(false)

  // 초기 데이터 변경 시 폼 데이터 동기화 (저장 후 갱신 등)
  useEffect(() => {
    setFormData(initialFormState)
  }, [initialFormState])

  // 변경 감지
  useEffect(() => {
    const isChanged = JSON.stringify(formData) !== JSON.stringify(initialFormState)
    setIsDirty(isChanged)
  }, [formData, initialFormState])

  // Daum Postcode Script Load
  useEffect(() => {
    const script = document.createElement('script')
    script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    script.async = true
    document.body.appendChild(script)

    return () => {
      // Cleanup logic if needed
      try {
        document.body.removeChild(script)
      } catch (e) {
        // Ignore error if script is already removed
      }
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleAddressSearch = () => {
    if (window.daum && window.daum.Postcode) {
      new window.daum.Postcode({
        oncomplete: function(data: any) {
          setFormData(prev => ({
            ...prev,
            address: data.address,
            zip_code: data.zonecode
          }))
        }
      }).open()
    } else {
      toast.error('주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.')
    }
  }

  const handleReset = () => {
    setFormData(initialFormState)
    toast.info('변경사항이 초기화되었습니다.')
  }

  async function handleSubmit() {
    setIsSaving(true)
    const submitData = new FormData()
    submitData.append('name', formData.name)
    submitData.append('owner_name', formData.owner_name)
    submitData.append('business_number', formData.business_number)
    submitData.append('store_phone', formData.store_phone)
    submitData.append('description', formData.description)
    submitData.append('zip_code', formData.zip_code)
    submitData.append('address', formData.address)
    submitData.append('address_detail', formData.address_detail)
    if (formData.image_url) submitData.append('image_url', formData.image_url)
    submitData.append('opening_hours', JSON.stringify(formData.opening_hours))

    const result = await updateStore(submitData)
    
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
      // 저장 후 현재 상태를 초기 상태로 간주하기 위해 페이지 리로드가 필요할 수 있음
      // 하지만 updateStore에서 revalidatePath를 호출하므로, 
      // Next.js가 자동으로 페이지를 갱신하면 initialData가 업데이트될 것임.
      // 다만 클라이언트 상태 동기화가 즉시 안 될 수 있으므로 여기서 상태 갱신은 보류하거나
      // initialFormState를 업데이트 하는 로직이 필요함.
      // 가장 간단한 방법은 성공 후 isDirty를 false로 만드는 것인데,
      // initialFormState가 prop으로 오기 때문에 prop이 바뀌어야 함.
      // revalidatePath가 동작하면 컴포넌트가 다시 마운트되면서 해결될 것임.
      setIsDirty(false) 
    }
    setIsSaving(false)
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
          description: "매장이 삭제되었습니다. 홈으로 이동합니다.",
        })
        router.push('/home')
        // 페이지 이동이 완료될 때까지 로딩 상태 유지
      }
    } catch (e) {
      toast.error("오류 발생", { description: "알 수 없는 오류가 발생했습니다." })
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-8 pb-20">
      {/* 섹션 1: 매장 프로필 & 기본 정보 */}
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>매장 프로필 & 기본 정보</CardTitle>
              <CardDescription>
                매장의 대표 이미지와 기본 정보를 설정합니다.
              </CardDescription>
            </div>
            {initialData.invite_code && (
              <StoreCodeDisplay code={initialData.invite_code} />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>매장 이미지</Label>
            <ImageUpload 
              currentImageUrl={formData.image_url} 
              onImageChange={(url) => setFormData(prev => ({ ...prev, image_url: url }))} 
              storeName={formData.name} 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">상호명</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="예: 맛있는 베이커리"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner_name">대표자명</Label>
              <Input
                id="owner_name"
                name="owner_name"
                value={formData.owner_name}
                onChange={handleInputChange}
                placeholder="예: 홍길동"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business_number">사업자등록번호</Label>
              <Input
                id="business_number"
                name="business_number"
                value={formData.business_number}
                onChange={handleInputChange}
                placeholder="000-00-00000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="store_phone">매장 전화번호</Label>
              <Input
                id="store_phone"
                name="store_phone"
                value={formData.store_phone}
                onChange={handleInputChange}
                placeholder="02-1234-5678"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">매장 소개 (선택)</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="매장에 대한 간단한 소개를 입력해주세요."
              className="resize-none"
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* 섹션 2: 매장 위치 */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle>매장 위치</CardTitle>
          <CardDescription>
            매장의 주소를 입력해주세요. 지도에 표시될 위치입니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="space-y-2 flex-1">
              <Label htmlFor="zip_code">우편번호</Label>
              <div className="flex gap-2">
                <Input
                  id="zip_code"
                  value={formData.zip_code}
                  readOnly
                  placeholder="우편번호"
                  className="bg-muted"
                />
                <Button type="button" variant="outline" onClick={handleAddressSearch}>
                  <Search className="w-4 h-4 mr-2" />
                  주소 검색
                </Button>
              </div>
            </div>
            <div className="space-y-2 flex-[2]">
              <Label htmlFor="address">주소</Label>
              <Input
                id="address"
                value={formData.address}
                readOnly
                placeholder="기본 주소"
                className="bg-muted"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="address_detail">상세 주소</Label>
            <Input
              id="address_detail"
              name="address_detail"
              value={formData.address_detail}
              onChange={handleInputChange}
              placeholder="층, 호수 등 상세 주소를 입력해주세요."
            />
          </div>

          {formData.address && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-md flex items-start gap-3 text-blue-700 dark:text-blue-300">
              <MapPin className="w-5 h-5 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium">위치 확인</p>
                <p className="mt-1 opacity-90">
                  {formData.address} {formData.address_detail}
                </p>
                <a 
                  href={`https://map.kakao.com/link/search/${formData.address}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-block mt-2 text-xs underline hover:no-underline"
                >
                  카카오맵에서 보기 &rarr;
                </a>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 섹션 3: 영업 시간 */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle>영업 시간 설정</CardTitle>
          <CardDescription>
            요일별 영업 시간을 설정해주세요. 스케줄링의 기준이 됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OpeningHours 
            initialData={formData.opening_hours} 
            onChange={(newHours) => setFormData(prev => ({ ...prev, opening_hours: newHours }))} 
          />
        </CardContent>
      </Card>

      {error && <div className="text-sm text-red-500">{error}</div>}

      {/* Danger Zone */}
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

      {/* Floating Save Bar */}
      <div className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-3xl px-4 transition-all duration-300 ease-in-out transform z-50",
        isDirty ? "translate-y-0 opacity-100" : "translate-y-24 opacity-0 pointer-events-none"
      )}>
        <div className="bg-background text-foreground p-4 rounded-xl shadow-2xl flex items-center justify-between border border-border">
          <div className="flex items-center gap-2 px-2">
            <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
            <span className="text-sm font-medium">변경사항이 감지되었습니다.</span>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleReset}
              className="text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              재설정
            </Button>
            <Button 
              onClick={handleSubmit} 
              size="sm"
              disabled={isSaving}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSaving ? '저장 중...' : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  변경사항 저장
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Global declaration for Daum Postcode
declare global {
  interface Window {
    daum: any
  }
}