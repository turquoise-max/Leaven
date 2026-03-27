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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { toast } from 'sonner'
import { AlertTriangle, Search, MapPin, Save, RotateCcw, Plus, Trash2, Crosshair } from 'lucide-react'
import { ImageUpload } from './image-upload'
import { OpeningHours } from './opening-hours'
import { StoreLocationMap } from './store-location-map'
import { cn, formatPhoneNumber } from '@/lib/utils'

const formatBusinessNumber = (value: string) => {
  const v = value.replace(/\D/g, '')
  if (v.length <= 3) return v
  if (v.length <= 5) return `${v.slice(0, 3)}-${v.slice(3)}`
  return `${v.slice(0, 3)}-${v.slice(3, 5)}-${v.slice(5, 10)}`
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
    latitude?: number
    longitude?: number
    auth_radius?: number
    opening_hours?: any
    invite_code?: string
    wage_start_day?: number
    wage_end_day?: number
    pay_day?: number
    wage_exceptions?: any
    leave_calc_type?: string
  }
}

const EMPLOYMENT_TYPES = [
  { value: 'fulltime', label: '정규직' },
  { value: 'contract', label: '계약직' },
  { value: 'parttime', label: '파트타임/알바' },
  { value: 'probation', label: '수습/교육생' },
  { value: 'daily', label: '일용직/단기' },
]

export function StoreSettingsForm({ initialData }: StoreSettingsFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteStoreName, setDeleteStoreName] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const initialFormState = useMemo(() => {
    const wStart = initialData.wage_start_day != null ? initialData.wage_start_day : 1
    const wEnd = initialData.wage_end_day != null ? initialData.wage_end_day : 0
    const isDefaultPeriod = wStart === 1 && wEnd === 0
    const isPayDayLast = initialData.pay_day === 0

    return {
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
      latitude: initialData.latitude != null ? String(initialData.latitude) : '',
      longitude: initialData.longitude != null ? String(initialData.longitude) : '',
      auth_radius: initialData.auth_radius != null ? String(initialData.auth_radius) : '200',
      opening_hours: initialData.opening_hours || {},
      
      wage_start_day: String(wStart),
      wage_end_day: String(wEnd),
      pay_day: initialData.pay_day != null ? String(initialData.pay_day) : '10',
      wage_exceptions: initialData.wage_exceptions || {},
      
      wage_period_type: isDefaultPeriod ? 'default' : 'custom',
      pay_month: initialData.wage_exceptions?.pay_month || 'next',
      holiday_rule: initialData.wage_exceptions?.holiday_rule || 'prev',
      is_pay_day_last: isPayDayLast,
      leave_calc_type: initialData.leave_calc_type || 'hire_date',
    }
  }, [initialData])

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
          
          // Address to Coord (Optional: if we have Kakao Maps API Key, we can use it here)
          // For now, we'll encourage using the "Current Location" button at the shop.
        }
      }).open()
    } else {
      toast.error('주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.')
    }
  }

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('이 브라우저에서는 위치 정보를 지원하지 않습니다.')
      return
    }

    toast.promise(
      new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setFormData(prev => ({
              ...prev,
              latitude: String(position.coords.latitude),
              longitude: String(position.coords.longitude)
            }))
            resolve(position)
          },
          (error) => reject(error),
          { enableHighAccuracy: true, timeout: 5000 }
        )
      }),
      {
        loading: '현재 위치를 파악 중입니다...',
        success: '매장 좌표가 현재 위치로 설정되었습니다.',
        error: (err: any) => {
          if (err.code === 1) return '위치 정보 접근 권한이 거부되었습니다.'
          return '위치 정보를 가져오지 못했습니다.'
        }
      }
    )
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
    if (formData.latitude) submitData.append('latitude', formData.latitude)
    if (formData.longitude) submitData.append('longitude', formData.longitude)
    if (formData.auth_radius) submitData.append('auth_radius', formData.auth_radius)
    submitData.append('opening_hours', JSON.stringify(formData.opening_hours))

    const startDay = formData.wage_period_type === 'default' ? '1' : formData.wage_start_day
    const endDay = formData.wage_period_type === 'default' ? '0' : formData.wage_end_day
    const payDay = formData.is_pay_day_last ? '0' : formData.pay_day

    submitData.append('wage_start_day', startDay)
    submitData.append('wage_end_day', endDay)
    submitData.append('pay_day', payDay)

    const finalExceptions = {
      ...formData.wage_exceptions,
      pay_month: formData.pay_month,
      holiday_rule: formData.holiday_rule
    }
    submitData.append('wage_exceptions', JSON.stringify(finalExceptions))
    submitData.append('leave_calc_type', formData.leave_calc_type)

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
    <div className="max-w-4xl mx-auto space-y-12 pb-24">
      {/* SECTION: 매장 프로필 & 기본 정보 */}
      <section className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-muted/30">
          <h2 className="text-xl font-bold tracking-tight">매장 기본 정보</h2>
          <p className="text-sm text-muted-foreground mt-1">매장의 대표 이미지와 기본 정보를 설정합니다.</p>
        </div>
        
        <div className="p-6">
          <div className="flex flex-col">
            <div className="flex flex-col md:flex-row gap-6 pb-8 border-b border-border/50">
              <div className="w-full md:w-1/3 shrink-0 space-y-1">
                <Label className="text-base font-semibold">매장 이미지</Label>
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
        </div>
      </section>

      {/* SECTION: 매장 위치 */}
      <section className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-muted/30">
          <h2 className="text-xl font-bold tracking-tight">매장 위치</h2>
          <p className="text-sm text-muted-foreground mt-1">지도에 표시될 주소를 입력해주세요.</p>
        </div>

        <div className="p-6 flex flex-col">
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
                  className="bg-muted max-w-37.5"
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

          <div className="flex flex-col md:flex-row gap-6 py-6 border-b border-border/50">
            <div className="w-full md:w-1/3 shrink-0 space-y-1">
              <Label className="text-base font-semibold">출퇴근 인증 좌표</Label>
              <p className="text-sm text-muted-foreground">정확한 출퇴근 인증을 위해 매장의 위도와 경도를 등록해주세요.</p>
            </div>
            <div className="w-full md:w-2/3 max-w-xl space-y-4">
              <StoreLocationMap 
                latitude={formData.latitude ? parseFloat(formData.latitude) : null}
                longitude={formData.longitude ? parseFloat(formData.longitude) : null}
                radius={parseInt(formData.auth_radius)}
                onLocationChange={(lat, lng) => {
                  setFormData(prev => ({
                    ...prev,
                    latitude: String(lat),
                    longitude: String(lng)
                  }))
                }}
              />
              <div className="p-4 bg-slate-50 dark:bg-slate-900 border rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-2">
                    GPS 좌표 설정
                    {formData.latitude && <span className="text-xs text-muted-foreground font-normal bg-muted px-2 py-0.5 rounded">지도를 클릭하여 미세 조정 가능</span>}
                  </span>
                  <div className="flex gap-2 shrink-0">
                    <Button type="button" variant="outline" size="sm" onClick={handleGetCurrentLocation} className="h-8 gap-2">
                      <Crosshair className="w-3.5 h-3.5" />
                      현 위치로 설정
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">위도 (Latitude)</Label>
                    <Input 
                      value={formData.latitude} 
                      onChange={(e) => setFormData(prev => ({ ...prev, latitude: e.target.value }))}
                      placeholder="예: 37.123456"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">경도 (Longitude)</Label>
                    <Input 
                      value={formData.longitude} 
                      onChange={(e) => setFormData(prev => ({ ...prev, longitude: e.target.value }))}
                      placeholder="예: 127.123456"
                      className="h-9"
                    />
                  </div>
                </div>
                {!formData.latitude && (
                  <p className="text-[11px] text-destructive">
                    * 좌표가 등록되지 않으면 위치 기반 출퇴근 기능을 사용할 수 없습니다.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-6 py-6">
            <div className="w-full md:w-1/3 shrink-0 space-y-1">
              <Label className="text-base font-medium">출퇴근 허용 반경</Label>
              <p className="text-sm text-muted-foreground">매장 좌표를 기준으로 출퇴근이 가능한 거리를 설정합니다.</p>
            </div>
            <div className="w-full md:w-2/3 max-w-xl">
              <div className="flex items-center gap-4">
                <Select 
                  value={formData.auth_radius} 
                  onValueChange={(val) => setFormData(prev => ({ ...prev, auth_radius: val }))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="반경 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50m (매우 좁음)</SelectItem>
                    <SelectItem value="100">100m (보통)</SelectItem>
                    <SelectItem value="200">200m (추천)</SelectItem>
                    <SelectItem value="300">300m (넓음)</SelectItem>
                    <SelectItem value="500">500m (매우 넓음)</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">이내에서만 출퇴근 가능</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: 매장 기본 급여/정산 설정 */}
      <section className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-muted/30">
          <h2 className="text-xl font-bold tracking-tight">매장 기본 급여/정산 설정</h2>
          <p className="text-sm text-muted-foreground mt-1">우리 매장의 가장 기본적인 급여 산정 기간과 지급일을 설정해 주세요. <br className="hidden sm:block"/>(개인별/고용형태별 상세 설정은 직원 관리 메뉴에서 개별 변경할 수 있습니다.)</p>
        </div>

        <div className="p-6 flex flex-col">
          <div className="flex flex-col md:flex-row gap-6 py-6 border-b border-border/50">
            <div className="w-full md:w-1/3 shrink-0 space-y-1">
              <Label className="text-base font-medium">정산 기간 (급여 산정 기준일)</Label>
              <p className="text-sm text-muted-foreground">매월 며칠부터 며칠까지 일한 급여를 계산할지 설정합니다.</p>
            </div>
            <div className="w-full md:w-2/3 max-w-xl space-y-4">
              <RadioGroup 
                value={formData.wage_period_type} 
                onValueChange={(val) => setFormData(prev => ({ ...prev, wage_period_type: val }))}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="default" id="period-default" />
                  <Label htmlFor="period-default" className="font-normal cursor-pointer">매월 1일 ~ 말일 <span className="text-muted-foreground text-xs ml-1">(가장 많이 사용)</span></Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="custom" id="period-custom" />
                  <Label htmlFor="period-custom" className="font-normal cursor-pointer">직접 설정</Label>
                </div>
              </RadioGroup>

              {formData.wage_period_type === 'custom' && (
                <div className="flex items-center gap-3 p-4 bg-muted/20 rounded-lg border mt-2 flex-wrap">
                  <div className="flex items-center gap-2 bg-background p-1.5 rounded-md border shadow-sm">
                    <span className="px-2 py-1 bg-muted rounded text-sm font-medium text-muted-foreground">전월</span>
                      <Input
                        type="number" min="1" max="31"
                        value={formData.wage_start_day}
                        onChange={(e) => {
                          let val = parseInt(e.target.value)
                          if (isNaN(val)) val = 1
                          if (val > 31) val = 31
                          if (val < 1) val = 1
                          
                          setFormData(prev => ({
                            ...prev,
                            wage_start_day: String(val),
                            wage_end_day: String(val === 1 ? 0 : val - 1)
                          }))
                        }}
                        className="w-14 h-8 text-center border-none shadow-none focus-visible:ring-0 px-1 font-medium"
                      />
                    <span className="text-sm font-medium pr-2">일</span>
                  </div>
                  
                  <span className="text-muted-foreground font-medium">~</span>
                  
                  <div className="flex items-center gap-2 bg-background p-1.5 rounded-md border shadow-sm">
                    <span className="px-2 py-1 bg-primary/10 text-primary rounded text-sm font-medium">당월</span>
                      <Input
                        type="number" min="0" max="31"
                        value={formData.wage_end_day}
                        onChange={(e) => {
                          let val = parseInt(e.target.value)
                          if (isNaN(val)) val = 0
                          if (val > 31) val = 31
                          if (val < 0) val = 0
                          setFormData(prev => ({ ...prev, wage_end_day: String(val) }))
                        }}
                        className="w-14 h-8 text-center border-none shadow-none focus-visible:ring-0 px-1 font-medium"
                      />
                    <span className="text-sm font-medium pr-2">{formData.wage_end_day === '0' ? '말일' : '일'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-6 py-6 border-b border-border/50">
            <div className="w-full md:w-1/3 shrink-0 space-y-1">
              <Label className="text-base font-medium">급여 지급일</Label>
              <p className="text-sm text-muted-foreground">정산된 급여를 언제 줄 것인지 정합니다.</p>
            </div>
            <div className="w-full md:w-2/3 max-w-xl space-y-4">
               <div className="flex items-center gap-3">
                 <Select value={formData.pay_month} onValueChange={(v) => setFormData(prev => ({ ...prev, pay_month: v }))}>
                   <SelectTrigger className="w-25 h-9">
                     <SelectValue placeholder="지급 월" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="current">당월</SelectItem>
                     <SelectItem value="next">익월</SelectItem>
                   </SelectContent>
                 </Select>

                 <div className="flex items-center gap-2">
                   <Input
                     type="number" min="1" max="31"
                     value={formData.is_pay_day_last ? '' : formData.pay_day}
                     onChange={(e) => setFormData(prev => ({ ...prev, pay_day: e.target.value }))}
                     disabled={formData.is_pay_day_last}
                     className="w-15 h-9 text-center"
                   />
                   <span className="text-sm">일</span>
                 </div>

                 <div className="flex items-center space-x-2 ml-4">
                   <Checkbox 
                     id="pay-day-last" 
                     checked={formData.is_pay_day_last}
                     onCheckedChange={(c) => setFormData(prev => ({ ...prev, is_pay_day_last: !!c }))}
                   />
                   <Label htmlFor="pay-day-last" className="text-sm font-medium cursor-pointer">말일 지급</Label>
                 </div>
               </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-6 py-6 border-b border-border/50">
            <div className="w-full md:w-1/3 shrink-0 space-y-1">
              <Label className="text-base font-medium">휴일 지급 규칙</Label>
              <p className="text-sm text-muted-foreground">급여일이 주말이나 공휴일인 경우 매장의 규칙을 정합니다.</p>
            </div>
            <div className="w-full md:w-2/3 max-w-xl">
               <Select value={formData.holiday_rule} onValueChange={(v) => setFormData(prev => ({ ...prev, holiday_rule: v }))}>
                 <SelectTrigger className="w-50 h-9">
                   <SelectValue placeholder="지급 규칙 선택" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="prev">전 영업일에 지급</SelectItem>
                   <SelectItem value="next">다음 영업일에 지급</SelectItem>
                 </SelectContent>
               </Select>
               <p className="text-xs text-muted-foreground mt-2">
                 * 전 영업일 지급: 10일이 일요일이면 8일 금요일 지급<br/>
                 * 다음 영업일 지급: 10일이 일요일이면 11일 월요일 지급
               </p>
            </div>
          </div>

          {/* 고용 형태별 예외 설정 아코디언 */}
          <div className="py-2">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="exceptions" className="border-none">
                <AccordionTrigger className="hover:no-underline py-4 text-sm text-primary hover:text-primary/80 justify-start gap-2 [&[data-state=open]>svg:first-child]:rotate-45">
                  <Plus className="w-4 h-4 transition-transform duration-200" />
                  고용 형태별 예외 정책 추가하기
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-6">
                  <div className="bg-muted/30 border rounded-xl p-4 space-y-6">
                    <p className="text-sm text-muted-foreground">
                      매장 기본 설정과 다르게 적용되는 고용 형태가 있다면 아래에 추가해주세요.<br/>
                      미설정된 고용 형태는 '매장 기본 설정'을 따릅니다.
                    </p>
                    
                    {EMPLOYMENT_TYPES.map((type) => {
                      const wageExceptions = formData.wage_exceptions || {}
                      const hasException = !!wageExceptions[type.value]
                      const exceptionData = wageExceptions[type.value] || { 
                        wage_start_day: '1', 
                        wage_end_day: '0', 
                        pay_day: '10',
                        wage_period_type: 'default',
                        pay_month: 'next',
                        is_pay_day_last: false
                      }
                      
                      const isDefaultPeriod = exceptionData.wage_period_type === 'default'
                      const isPayDayLast = exceptionData.is_pay_day_last

                      return (
                        <div key={type.value} className="flex flex-col border rounded-lg bg-background overflow-hidden">
                          <div className="flex items-center justify-between p-3 bg-muted/20 border-b">
                            <span className="font-medium text-sm">{type.label}</span>
                            {!hasException ? (
                              <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                className="h-7 text-xs"
                                onClick={() => setFormData(prev => ({
                                  ...prev,
                                  wage_exceptions: {
                                    ...(prev.wage_exceptions || {}),
                                    [type.value]: { 
                                      wage_start_day: '1', 
                                      wage_end_day: '0', 
                                      pay_day: '10',
                                      wage_period_type: 'default',
                                      pay_month: 'next',
                                      is_pay_day_last: false
                                    }
                                  }
                                }))}
                              >
                                예외 추가
                              </Button>
                            ) : (
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => {
                                  const newExceptions = { ...(formData.wage_exceptions || {}) }
                                  delete newExceptions[type.value]
                                  setFormData(prev => ({ ...prev, wage_exceptions: newExceptions }))
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-1" />
                                삭제
                              </Button>
                            )}
                          </div>
                          
                          {hasException && (
                            <div className="p-5 flex flex-col gap-6">
                              <div className="space-y-3">
                                <Label className="text-sm font-semibold">정산 기간 (급여 산정 기준일)</Label>
                                <RadioGroup 
                                  value={exceptionData.wage_period_type} 
                                  onValueChange={(val) => setFormData(prev => ({
                                    ...prev,
                                    wage_exceptions: {
                                      ...prev.wage_exceptions,
                                      [type.value]: { ...exceptionData, wage_period_type: val, wage_start_day: val === 'default' ? '1' : exceptionData.wage_start_day, wage_end_day: val === 'default' ? '0' : exceptionData.wage_end_day }
                                    }
                                  }))}
                                  className="flex flex-col gap-3"
                                >
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="default" id={`period-default-${type.value}`} />
                                    <Label htmlFor={`period-default-${type.value}`} className="font-normal cursor-pointer text-sm">매월 1일 ~ 말일</Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="custom" id={`period-custom-${type.value}`} />
                                    <Label htmlFor={`period-custom-${type.value}`} className="font-normal cursor-pointer text-sm">직접 설정</Label>
                                  </div>
                                </RadioGroup>

                                {exceptionData.wage_period_type === 'custom' && (
                                  <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg border flex-wrap">
                                    <div className="flex items-center gap-2 bg-background p-1.5 rounded-md border shadow-sm">
                                      <span className="px-2 py-1 bg-muted rounded text-[13px] font-medium text-muted-foreground">전월</span>
                                      <Input
                                        type="number" min="1" max="31"
                                        value={exceptionData.wage_start_day}
                                        onChange={(e) => {
                                          let val = parseInt(e.target.value)
                                          if (isNaN(val)) val = 1
                                          if (val > 31) val = 31
                                          if (val < 1) val = 1
                                          
                                          setFormData(prev => ({
                                            ...prev,
                                            wage_exceptions: {
                                              ...prev.wage_exceptions,
                                              [type.value]: {
                                                ...exceptionData,
                                                wage_start_day: String(val),
                                                wage_end_day: String(val === 1 ? 0 : val - 1)
                                              }
                                            }
                                          }))
                                        }}
                                        className="w-12 h-7 text-center border-none shadow-none focus-visible:ring-0 px-1 font-medium text-[13px]"
                                      />
                                      <span className="text-[13px] font-medium pr-1">일</span>
                                    </div>
                                    <span className="text-muted-foreground font-medium text-sm">~</span>
                                    <div className="flex items-center gap-2 bg-background p-1.5 rounded-md border shadow-sm">
                                      <span className="px-2 py-1 bg-primary/10 text-primary rounded text-[13px] font-medium">당월</span>
                                      <Input
                                        type="number" min="0" max="31"
                                        value={exceptionData.wage_end_day}
                                        onChange={(e) => {
                                          let val = parseInt(e.target.value)
                                          if (isNaN(val)) val = 0
                                          if (val > 31) val = 31
                                          if (val < 0) val = 0
                                          
                                          setFormData(prev => ({
                                            ...prev,
                                            wage_exceptions: {
                                              ...prev.wage_exceptions,
                                              [type.value]: { ...exceptionData, wage_end_day: String(val) }
                                            }
                                          }))
                                        }}
                                        className="w-12 h-7 text-center border-none shadow-none focus-visible:ring-0 px-1 font-medium text-[13px]"
                                      />
                                      <span className="text-[13px] font-medium pr-1">{exceptionData.wage_end_day === '0' ? '말일' : '일'}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                              
                              <Separator />
                              
                              <div className="space-y-3">
                                <Label className="text-sm font-semibold">급여 지급일</Label>
                                <div className="flex flex-wrap items-center gap-3">
                                  <Select 
                                    value={exceptionData.pay_month} 
                                    onValueChange={(v) => setFormData(prev => ({
                                      ...prev,
                                      wage_exceptions: {
                                        ...prev.wage_exceptions,
                                        [type.value]: { ...exceptionData, pay_month: v }
                                      }
                                    }))}
                                  >
                                    <SelectTrigger className="w-22.5 h-8 text-[13px]">
                                      <SelectValue placeholder="지급 월" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="current" className="text-[13px]">당월</SelectItem>
                                      <SelectItem value="next" className="text-[13px]">익월</SelectItem>
                                    </SelectContent>
                                  </Select>

                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number" min="1" max="31"
                                      value={exceptionData.is_pay_day_last ? '' : exceptionData.pay_day}
                                      onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        wage_exceptions: {
                                          ...prev.wage_exceptions,
                                          [type.value]: { ...exceptionData, pay_day: e.target.value }
                                        }
                                      }))}
                                      disabled={exceptionData.is_pay_day_last}
                                      className="w-12.5 h-8 text-center text-[13px]"
                                    />
                                    <span className="text-[13px] font-medium">일</span>
                                  </div>

                                  <div className="flex items-center space-x-2 ml-2">
                                    <Checkbox 
                                      id={`pay-day-last-${type.value}`}
                                      checked={exceptionData.is_pay_day_last}
                                      onCheckedChange={(c) => setFormData(prev => ({
                                        ...prev,
                                        wage_exceptions: {
                                          ...prev.wage_exceptions,
                                          [type.value]: { ...exceptionData, is_pay_day_last: !!c, pay_day: !!c ? '0' : exceptionData.pay_day }
                                        }
                                      }))}
                                    />
                                    <Label htmlFor={`pay-day-last-${type.value}`} className="text-[13px] font-medium cursor-pointer">말일 지급</Label>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>

      {/* SECTION: 휴가 및 연차 설정 */}
      <section className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-muted/30">
          <h2 className="text-xl font-bold tracking-tight">휴가 및 연차 설정</h2>
          <p className="text-sm text-muted-foreground mt-1">우리 매장의 직원 연차 부여 기준을 설정합니다.</p>
        </div>

        <div className="p-6 flex flex-col">
          <div className="flex flex-col md:flex-row gap-6 py-6 border-b border-border/50">
            <div className="w-full md:w-1/3 shrink-0 space-y-1">
              <Label className="text-base font-medium">연차 발생 기준</Label>
              <p className="text-sm text-muted-foreground">근로기준법에 기반한 자동 연차 계산 시 활용됩니다.</p>
            </div>
            <div className="w-full md:w-2/3 max-w-xl space-y-4">
              <RadioGroup 
                value={formData.leave_calc_type} 
                onValueChange={(val) => setFormData(prev => ({ ...prev, leave_calc_type: val }))}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="hire_date" id="leave-hire" />
                  <Label htmlFor="leave-hire" className="font-normal cursor-pointer">입사일 기준 (추천)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="fiscal_year" id="leave-fiscal" />
                  <Label htmlFor="leave-fiscal" className="font-normal cursor-pointer">회계연도 기준 (매년 1월 1일 일괄 갱신)</Label>
                </div>
              </RadioGroup>
              <p className="text-xs text-muted-foreground mt-2">
                * 입사일 기준: 직원의 입사일을 기준으로 매월/매년 연차가 자동 발생합니다.<br/>
                * 회계연도 기준: 1월 1일에 일괄 부여되며, 1년 미만자는 입사일부터 연말까지 비례 계산됩니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: 영업 시간 */}
      <section className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-muted/30">
          <h2 className="text-xl font-bold tracking-tight">영업 시간</h2>
          <p className="text-sm text-muted-foreground mt-1">요일별 영업 시간을 설정해주세요. 스케줄링의 기준이 됩니다.</p>
        </div>

        <div className="p-6 max-w-3xl">
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