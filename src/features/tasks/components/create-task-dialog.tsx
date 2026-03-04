'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Plus, Loader2, AlertTriangle, Clock, Calendar, Briefcase } from 'lucide-react'
import { createTask } from '../actions'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { getStoreRoles } from '@/features/store/actions'

interface CreateTaskDialogProps {
  storeId: string
  trigger?: React.ReactNode
}

export function CreateTaskDialog({ storeId, trigger }: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [roles, setRoles] = useState<any[]>([])

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    is_critical: false,
    estimated_minutes: 30,
    task_type: 'time_specific' as 'time_specific' | 'recurring' | 'always',
    start_time: '',
    end_time: '',
    assigned_role_id: 'all',
    // Recurring options
    repeat_type: 'daily' as 'daily' | 'weekly' | 'monthly' | 'hourly',
    repeat_days: [] as number[], // 0=Sun
    repeat_date: 1, // 1-31
    repeat_interval: 1, // Every n hours/days/weeks
  })

  // Load roles
  useEffect(() => {
    if (open && storeId) {
      getStoreRoles(storeId).then(setRoles)
    }
  }, [open, storeId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title) return

    // 시간 유효성 검사
    if (formData.task_type === 'time_specific' && (!formData.start_time || !formData.end_time)) {
      toast.error('시작 시간과 종료 시간을 입력해주세요.')
      return
    }
    
    // 시간 간격 반복일 경우 시작/종료 시간 필요 (운영 시간 내 반복)
    if (formData.task_type === 'recurring' && formData.repeat_type === 'hourly' && (!formData.start_time || !formData.end_time)) {
       toast.error('운영 시작 시간과 종료 시간을 입력해주세요.')
       return
    }

    setLoading(true)
    try {
      // 반복 패턴 구성
      let repeat_pattern = null
      if (formData.task_type === 'recurring') {
        repeat_pattern = {
          type: formData.repeat_type,
          interval: formData.repeat_interval,
          days: formData.repeat_type === 'weekly' ? formData.repeat_days : undefined,
          date: formData.repeat_type === 'monthly' ? formData.repeat_date : undefined,
        }
      }

      const result = await createTask({
        store_id: storeId,
        title: formData.title,
        description: formData.description,
        is_critical: formData.is_critical,
        estimated_minutes: formData.estimated_minutes,
        task_type: formData.task_type,
        start_time: formData.start_time || null,
        end_time: formData.end_time || null,
        repeat_pattern: repeat_pattern,
        assigned_role_id: formData.assigned_role_id === 'all' ? null : formData.assigned_role_id
      })

      if (result?.error) {
        toast.error('업무 생성 실패', { description: result.error })
      } else {
        toast.success('업무가 생성되었습니다.')
        setOpen(false)
        setFormData({
          title: '',
          description: '',
          is_critical: false,
          estimated_minutes: 30,
          task_type: 'time_specific',
          start_time: '',
          end_time: '',
          assigned_role_id: 'all',
          repeat_type: 'daily',
          repeat_days: [],
          repeat_date: 1,
          repeat_interval: 1
        })
      }
    } catch (error) {
      toast.error('오류가 발생했습니다.')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const toggleDay = (day: number) => {
    setFormData(prev => {
      const days = prev.repeat_days.includes(day)
        ? prev.repeat_days.filter(d => d !== day)
        : [...prev.repeat_days, day]
      return { ...prev, repeat_days: days.sort() }
    })
  }

  const weekDays = [
    { label: '일', value: 0 },
    { label: '월', value: 1 },
    { label: '화', value: 2 },
    { label: '수', value: 3 },
    { label: '목', value: 4 },
    { label: '금', value: 5 },
    { label: '토', value: 6 },
  ]

  const monthDates = Array.from({ length: 31 }, (_, i) => i + 1)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            새 업무 등록
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>새 업무 등록</DialogTitle>
            <DialogDescription>
              매장에서 수행할 새로운 업무를 등록합니다.
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="basic" className="w-full mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">기본 정보</TabsTrigger>
              <TabsTrigger value="advanced">할당 및 옵션</TabsTrigger>
            </TabsList>
            
            <div className="py-4 h-[400px] overflow-y-auto px-1">
              <TabsContent value="basic" className="space-y-4 mt-0">
                <div className="grid gap-2">
                  <Label htmlFor="title">업무명 <span className="text-red-500">*</span></Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="예: 오픈 준비, 재고 확인"
                    required
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="description">상세 설명</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="업무 내용을 입력하세요."
                    className="resize-none"
                    rows={3}
                  />
                </div>

                <div className="grid gap-3">
                  <Label>업무 유형</Label>
                  <RadioGroup 
                    value={formData.task_type} 
                    onValueChange={(val: any) => setFormData(prev => ({ ...prev, task_type: val }))}
                    className="grid grid-cols-3 gap-2"
                  >
                    <div>
                      <RadioGroupItem value="time_specific" id="type-time" className="peer sr-only" />
                      <Label
                        htmlFor="type-time"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer text-center h-full"
                      >
                        <Clock className="mb-2 h-4 w-4" />
                        <span className="text-xs">특정 시간</span>
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem value="always" id="type-always" className="peer sr-only" />
                      <Label
                        htmlFor="type-always"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer text-center h-full"
                      >
                        <Briefcase className="mb-2 h-4 w-4" />
                        <span className="text-xs">상시 업무</span>
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem value="recurring" id="type-recurring" className="peer sr-only" />
                      <Label
                        htmlFor="type-recurring"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer text-center h-full"
                      >
                        <Calendar className="mb-2 h-4 w-4" />
                        <span className="text-xs">반복 업무</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* 반복 업무 상세 설정 */}
                {formData.task_type === 'recurring' && (
                  <div className="space-y-3 p-3 bg-muted/30 rounded-md border animate-in fade-in slide-in-from-top-2">
                    <div className="grid gap-2">
                        <Label>반복 주기</Label>
                        <Select 
                            value={formData.repeat_type} 
                            onValueChange={(val: any) => setFormData(prev => ({ ...prev, repeat_type: val }))}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="daily">매일</SelectItem>
                                <SelectItem value="weekly">매주</SelectItem>
                                <SelectItem value="monthly">매월</SelectItem>
                                <SelectItem value="hourly">시간 간격</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {formData.repeat_type === 'weekly' && (
                        <div className="grid gap-2">
                            <Label className="text-xs text-muted-foreground">요일 선택</Label>
                            <div className="flex justify-between gap-1">
                            {weekDays.map((day) => (
                                <div key={day.value} className="flex flex-col items-center gap-1">
                                <Checkbox
                                    id={`day-${day.value}`}
                                    checked={formData.repeat_days.includes(day.value)}
                                    onCheckedChange={() => toggleDay(day.value)}
                                />
                                <Label htmlFor={`day-${day.value}`} className="text-xs cursor-pointer font-normal">
                                    {day.label}
                                </Label>
                                </div>
                            ))}
                            </div>
                        </div>
                    )}

                    {formData.repeat_type === 'monthly' && (
                        <div className="grid gap-2">
                            <Label className="text-xs text-muted-foreground">날짜 선택</Label>
                            <Select 
                                value={formData.repeat_date.toString()} 
                                onValueChange={(val) => setFormData(prev => ({ ...prev, repeat_date: parseInt(val) }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {monthDates.map(date => (
                                        <SelectItem key={date} value={date.toString()}>
                                            매월 {date}일
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {formData.repeat_type === 'hourly' && (
                        <div className="grid gap-2">
                            <Label className="text-xs text-muted-foreground">간격 (시간)</Label>
                            <div className="flex items-center gap-2">
                                <Input 
                                    type="number" 
                                    min="1" 
                                    max="24"
                                    value={formData.repeat_interval}
                                    onChange={(e) => setFormData(prev => ({ ...prev, repeat_interval: parseInt(e.target.value) || 1 }))}
                                    className="w-20"
                                />
                                <span className="text-sm">시간 마다 반복</span>
                            </div>
                        </div>
                    )}
                  </div>
                )}

                {/* 시간 설정 */}
                {(formData.task_type === 'time_specific' || (formData.task_type === 'recurring')) && (
                  <div className="grid gap-2 animate-in fade-in slide-in-from-top-2">
                    <Label>
                        {formData.task_type === 'recurring' && formData.repeat_type === 'hourly' 
                            ? '운영 시간 (이 시간 내에서만 반복)' 
                            : '수행 시간'
                        } 
                        {formData.task_type === 'time_specific' && <span className="text-red-500">*</span>}
                    </Label>
                    <div className="flex items-center gap-2">
                      <div className="grid flex-1 gap-1">
                        <span className="text-xs text-muted-foreground">시작</span>
                        <Input
                          type="time"
                          value={formData.start_time}
                          onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                        />
                      </div>
                      <span className="mt-5">~</span>
                      <div className="grid flex-1 gap-1">
                        <span className="text-xs text-muted-foreground">종료(목표)</span>
                        <Input
                          type="time"
                          value={formData.end_time}
                          onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="advanced" className="space-y-4 mt-0">
                <div className="grid gap-2">
                  <Label>담당 역할 지정</Label>
                  <Select 
                    value={formData.assigned_role_id} 
                    onValueChange={(val) => setFormData(prev => ({ ...prev, assigned_role_id: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="담당 역할 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <span className="font-medium">모든 직원</span>
                      </SelectItem>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-2 h-2 rounded-full" 
                              style={{ backgroundColor: role.color }}
                            />
                            {role.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    지정된 역할을 가진 직원들에게만 이 업무가 표시됩니다.
                  </p>
                </div>

                <div className="flex items-center justify-between space-x-2 border p-3 rounded-md bg-muted/50">
                  <div className="space-y-0.5">
                    <Label htmlFor="is_critical" className="flex items-center gap-2">
                      중요 업무
                      {formData.is_critical && <AlertTriangle className="w-3 h-3 text-red-500" />}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      반드시 수행해야 하는 필수 업무로 강조됩니다.
                    </p>
                  </div>
                  <Switch
                    id="is_critical"
                    checked={formData.is_critical}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_critical: checked }))}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="estimated_minutes">예상 소요 시간 (분)</Label>
                  <div className="flex gap-2">
                    {[10, 30, 60].map((min) => (
                      <Button
                        key={min}
                        type="button"
                        variant={formData.estimated_minutes === min ? "default" : "outline"}
                        size="sm"
                        className="flex-1"
                        onClick={() => setFormData(prev => ({ ...prev, estimated_minutes: min }))}
                      >
                        {min}분
                      </Button>
                    ))}
                    <div className="flex-1">
                      <Input
                        type="number"
                        id="estimated_minutes"
                        value={formData.estimated_minutes}
                        onChange={(e) => setFormData(prev => ({ ...prev, estimated_minutes: parseInt(e.target.value) || 0 }))}
                        className="h-9"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              등록하기
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}