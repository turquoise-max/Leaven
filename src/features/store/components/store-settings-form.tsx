'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { updateStore, deleteStore } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
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

const formatBusinessNumber = (value: string) => {
  const v = value.replace(/\D/g, '')
  if (v.length <= 3) return v
  if (v.length <= 5) return `${v.slice(0, 3)}-${v.slice(3)}`
  return `${v.slice(0, 3)}-${v.slice(3, 5)}-${v.slice(5, 10)}`
}

const formatPhoneNumber = (value: string) => {
  const v = value.replace(/\D/g, '')
  if (v.startsWith('02')) {
    if (v.length <= 2) return v
    if (v.length <= 5) return `${v.slice(0, 2)}-${v.slice(2)}`
    if (v.length <= 9) return `${v.slice(0, 2)}-${v.slice(2, 5)}-${v.slice(5)}`
    return `${v.slice(0, 2)}-${v.slice(2, 6)}-${v.slice(6, 10)}`
  } else {
    if (v.length <= 3) return v
    if (v.length <= 6) return `${v.slice(0, 3)}-${v.slice(3)}`
    if (v.length <= 10) return `${v.slice(0, 3)}-${v.slice(3, 6)}-${v.slice(6)}`
    return `${v.slice(0, 3)}-${v.slice(3, 7)}-${v.slice(7, 11)}`
  }
}

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
    stamp_image_url?: string
    opening_hours?: any
    invite_code?: string
    wage_start_day?: number
    wage_end_day?: number
    pay_day?: number
  }
}

export function StoreSettingsForm({ initialData }: StoreSettingsFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteStoreName, setDeleteStoreName] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const initialFormState = useMemo(() => ({
    name: initialData.name || '',
    owner_name: initialData.owner_name || '',
    business_number: initialData.business_number || '',
    store_phone: initialData.store_phone || '',
    description: initialData.description || '',
    zip_code: initialData.zip_code || '',
    address: initialData.address || '',
    address_detail: initialData.address_detail || '',
    image_url: initialData.image_url || null,
    stamp_image_url: initialData.stamp_image_url || null,
    opening_hours: initialData.opening_hours || {},
    wage_start_day: initialData.wage_start_day != null ? String(initialData.wage_start_day) : '1',
    wage_end_day: initialData.wage_end_day != null ? String(initialData.wage_end_day) : '0',
    pay_day: initialData.pay_day != null ? String(initialData.pay_day) : '10',
  }), [initialData])

  const [formData, setFormData] = useState(initialFormState)
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    setFormData(initialFormState)
  }, [initialFormState])

  useEffect(() => {
    const isChanged = JSON.stringify(formData) !== JSON.stringify(initialFormState)
    setIsDirty(isChanged)
  }, [formData, initialFormState])

  useEffect(() => {
    const script = document.createElement('script')
    script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    script.async = true
    document.body.appendChild(script)

    return () => {
      try {
        document.body.removeChild(script)
      } catch (e) {
      }
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
    let formattedValue = value
    if (name === 'business_number') {
      formattedValue = formatBusinessNumber(value)
    } else if (name === 'store_phone') {
      formattedValue = formatPhoneNumber(value)
    }

    setFormData(prev => ({ ...prev, [name]: formattedValue }))
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
    if (formData.stamp_image_url) submitData.append('stamp_image_url', formData.stamp_image_url)
    submitData.append('opening_hours', JSON.stringify(formData.opening_hours))
    submitData.append('wage_start_day', formData.wage_start_day)
    submitData.append('wage_end_day', formData.wage_end_day)
    submitData.append('pay_day', formData.pay_day)

    const result = await updateStore(submitData)
    
    if (result?.error) {
      setError(result.error)
      toast.error("저장 실패", { description: result.error })
    } else {
      setError(null)
      toast.success("저장 완료", { description: "매장 정보가 성공적으로 수정되었습니다." })
      setIsDirty(false) 
    }
    setIsSaving(false)
  }

  async function handleDeleteStore() {
    setIsDeleting(true)
    try {
      const result = await deleteStore(initialData.id)
      if (result?.error) {
        toast.error("매장 삭제 실패", { description: result.error })
        setIsDeleting(false)
      } else {
        toast.success("매장 삭제 완료", { description: "매장이 삭제되었습니다. 홈으로 이동합니다." })
        router.push('/home')
      }
    } catch (e) {
      toast.error("오류 발생", { description: "알 수 없는 오류가 발생했습니다." })
      setIsDeleting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-16 pb-24">
      {/* SECTION: 매장 프로필 & 기본 정보 */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">매장 기본 정보</h2>
            <p className="text-sm text-muted-foreground mt-1">매장의 대표 이미지와 기본 정보를 설정합니다.</p>
          </div>
          {initialData.invite_code && (
            <StoreCodeDisplay code={initialData.invite_code} />
          )}
        </div>
        
        <Separator className="mb-2" />

        <div className="flex flex-col">
          <div className="flex flex-col md:flex-row gap-6 py-6 border-b border-border/50">
            <div className="w-full md:w-1/3 shrink-0 space-y-1">
              <Label className="text-base font-medium">매장 이미지</Label>
              <p className="text-sm text-muted-foreground">매장을 대표하는 사진을 업로드하세요.</p>
            </div>
            <div className="w-full md:w-2/3 max-w-xl">
              <ImageUpload 
                currentImageUrl={formData.image_url} 
                onImageChange={(url) => setFormData(prev => ({ ...prev, image_url: url }))} 
                storeName={formData.name} 
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-6 py-6 border-b border-border/50">
            <div className="w-full md:w-1/3 shrink-0 space-y-1">
              <Label className="text-base font-medium">사업장 직인(도장)</Label>
              <p className="text-sm text-muted-foreground">근로계약서 발송 시 사업주 서명란에 자동 날인됩니다. (투명 배경 권장)</p>
            </div>
            <div className="w-full md:w-2/3 max-w-xl">
              <ImageUpload 
                currentImageUrl={formData.stamp_image_url} 
                onImageChange={(url) => setFormData(prev => ({ ...prev, stamp_image_url: url }))} 
                storeName={`${formData.name} 직인`} 
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-6 py-6 border-b border-border/50">
            <div className="w-full md:w-1/3 shrink-0 space-y-1">
              <Label htmlFor="name" className="text-base font-medium">상호명</Label>
            </div>
            <div className="w-full md:w-2/3 max-w-xl">
              <Input
                id="name"
                name="name"
                value={formData.name || ''}
                onChange={handleInputChange}
                placeholder="예: 맛있는 베이커리"
                required
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-6 py-6 border-b border-border/50">
            <div className="w-full md:w-1/3 shrink-0 space-y-1">
              <Label htmlFor="owner_name" className="text-base font-medium">대표자명</Label>
            </div>
            <div className="w-full md:w-2/3 max-w-xl">
              <Input
                id="owner_name"
                name="owner_name"
                value={formData.owner_name}
                onChange={handleInputChange}
                placeholder="예: 홍길동"
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-6 py-6 border-b border-border/50">
            <div className="w-full md:w-1/3 shrink-0 space-y-1">
              <Label htmlFor="business_number" className="text-base font-medium">사업자등록번호</Label>
            </div>
            <div className="w-full md:w-2/3 max-w-xl">
              <Input
                id="business_number"
                name="business_number"
                value={formData.business_number}
                onChange={handleInputChange}
                placeholder="예) 123-45-12345"
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-6 py-6 border-b border-border/50">
            <div className="w-full md:w-1/3 shrink-0 space-y-1">
              <Label htmlFor="store_phone" className="text-base font-medium">매장 전화번호</Label>
            </div>
            <div className="w-full md:w-2/3 max-w-xl">
              <Input
                id="store_phone"
                name="store_phone"
                value={formData.store_phone}
                onChange={handleInputChange}
                placeholder="예) 02-1234-5678"
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-6 py-6">
            <div className="w-full md:w-1/3 shrink-0 space-y-1">
              <Label htmlFor="description" className="text-base font-medium">매장 소개</Label>
              <p className="text-sm text-muted-foreground">고객이나 직원에게 보여질 매장에 대한 간단한 소개입니다.</p>
            </div>
            <div className="w-full md:w-2/3 max-w-xl">
              <div className="relative">
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="매장에 대한 간단한 소개를 입력해주세요. (최대 200자)"
                  className="resize-none pb-8"
                  rows={6}
                  maxLength={200}
                />
                <div className="absolute bottom-2 right-3 text-xs text-muted-foreground">
                  {formData.description.length}/200자
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: 매장 위치 */}
      <section>
        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-tight">매장 위치</h2>
          <p className="text-sm text-muted-foreground mt-1">지도에 표시될 주소를 입력해주세요.</p>
        </div>
        
        <Separator className="mb-2" />

        <div className="flex flex-col">
          <div className="flex flex-col md:flex-row gap-6 py-6 border-b border-border/50">
            <div className="w-full md:w-1/3 shrink-0 space-y-1">
              <Label htmlFor="zip_code" className="text-base font-medium">주소 검색</Label>
            </div>
            <div className="w-full md:w-2/3 max-w-xl space-y-4">
              <div className="flex gap-2">
                <Input
                  id="zip_code"
                  value={formData.zip_code}
                  readOnly
                  placeholder="우편번호"
                  className="bg-muted max-w-[150px]"
                />
                <Button type="button" variant="outline" onClick={handleAddressSearch}>
                  <Search className="w-4 h-4 mr-2" />
                  주소 검색
                </Button>
              </div>
              <Input
                id="address"
                value={formData.address}
                readOnly
                placeholder="기본 주소"
                className="bg-muted"
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-6 py-6 border-b border-border/50">
            <div className="w-full md:w-1/3 shrink-0 space-y-1">
              <Label htmlFor="address_detail" className="text-base font-medium">상세 주소</Label>
            </div>
            <div className="w-full md:w-2/3 max-w-xl space-y-4">
              <Input
                id="address_detail"
                name="address_detail"
                value={formData.address_detail}
                onChange={handleInputChange}
                placeholder="층, 호수 등 상세 주소를 입력해주세요."
              />
              {formData.address && (
                <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-md flex items-start gap-3 text-blue-700 dark:text-blue-300">
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
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: 급여 및 정산 설정 */}
      <section>
        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-tight">급여 및 정산 설정</h2>
          <p className="text-sm text-muted-foreground mt-1">전자 근로계약서에 들어갈 급여 정산 기간 및 지급일을 설정합니다.</p>
        </div>
        
        <Separator className="mb-2" />

        <div className="flex flex-col">
          <div className="flex flex-col md:flex-row gap-6 py-6 border-b border-border/50">
            <div className="w-full md:w-1/3 shrink-0 space-y-1">
              <Label className="text-base font-medium">급여 산정 기간</Label>
              <p className="text-sm text-muted-foreground">매월 며칠부터 며칠까지 일한 급여를 계산할지 설정합니다. (0 입력 시 말일)</p>
            </div>
            <div className="w-full md:w-2/3 max-w-xl flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Input
                  id="wage_start_day"
                  name="wage_start_day"
                  type="number"
                  min="1"
                  max="31"
                  value={formData.wage_start_day || ''}
                  onChange={handleInputChange}
                  className="w-20"
                />
                <span>일 ~</span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="wage_end_day"
                  name="wage_end_day"
                  type="number"
                  min="0"
                  max="31"
                  value={formData.wage_end_day || ''}
                  onChange={handleInputChange}
                  className="w-20"
                />
                <span>일</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-6 py-6 border-b border-border/50">
            <div className="w-full md:w-1/3 shrink-0 space-y-1">
              <Label className="text-base font-medium">급여 지급일</Label>
              <p className="text-sm text-muted-foreground">매월 급여를 지급하는 날짜를 설정합니다.</p>
            </div>
            <div className="w-full md:w-2/3 max-w-xl flex items-center gap-2">
              <span>매월</span>
              <Input
                id="pay_day"
                name="pay_day"
                type="number"
                min="1"
                max="31"
                value={formData.pay_day || ''}
                onChange={handleInputChange}
                className="w-20"
              />
              <span>일</span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: 영업 시간 */}
      <section>
        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-tight">영업 시간</h2>
          <p className="text-sm text-muted-foreground mt-1">요일별 영업 시간을 설정해주세요. 스케줄링의 기준이 됩니다.</p>
        </div>
        
        <Separator className="mb-6" />

        <div className="max-w-3xl">
          <OpeningHours 
            initialData={formData.opening_hours} 
            onChange={(newHours) => setFormData(prev => ({ ...prev, opening_hours: newHours }))} 
          />
        </div>
      </section>

      {error && <div className="text-sm text-red-500 font-medium p-4 bg-red-50 rounded-md">{error}</div>}

      {/* SECTION: Danger Zone */}
      <section className="mt-12">
        <div className="border border-red-200 dark:border-red-900/50 rounded-xl overflow-hidden">
          <div className="bg-red-50/50 dark:bg-red-950/10 px-6 py-4 border-b border-red-200 dark:border-red-900/50 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-500" />
            <h3 className="text-lg font-semibold text-red-600 dark:text-red-500">위험 구역</h3>
          </div>
          <div className="p-6 bg-background flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <h4 className="font-medium">매장 영구 삭제</h4>
              <p className="text-sm text-muted-foreground max-w-lg">
                이 작업은 되돌릴 수 없습니다. 매장을 삭제하면 소속된 모든 직원, 스케줄 내역, 그리고 설정 데이터가 영구적으로 삭제됩니다.
              </p>
            </div>
            <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" className="shrink-0 w-full md:w-auto">매장 삭제하기</Button>
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
          </div>
        </div>
      </section>

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