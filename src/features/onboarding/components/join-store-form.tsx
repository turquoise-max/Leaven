'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Check, Loader2 } from 'lucide-react'
import { joinStoreByCode } from '@/features/onboarding/actions'
import { toast } from 'sonner'

interface JoinStoreFormProps {
  defaultName: string
  defaultPhone: string
  variant?: 'large' | 'compact'
}

export function JoinStoreForm({ defaultName, defaultPhone, variant = 'large' }: JoinStoreFormProps) {
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const code = formData.get('code') as string
    const name = formData.get('name') as string
    const phone = formData.get('phone') as string

    setLoading(true)
    try {
      const result = await joinStoreByCode(code, name, phone)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('합류 신청이 완료되었습니다.')
      }
    } catch (error: any) {
      toast.error(error.message || '요청 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (variant === 'compact') {
    return (
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <Input id="code-phase4" name="code" placeholder="6자리 초대 코드" required className="uppercase tracking-widest font-mono flex-1 bg-white" />
          <Button type="submit" disabled={loading} className="bg-[#1D9E75] hover:bg-[#1D9E75]/90 px-6">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '신청'}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="name-phase4" className="text-xs text-muted-foreground">이름</Label>
            <Input id="name-phase4" name="name" defaultValue={defaultName} required className="h-8 text-xs bg-white" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="phone-phase4" className="text-xs text-muted-foreground">전화번호 (-제외)</Label>
            <Input id="phone-phase4" name="phone" defaultValue={defaultPhone} required className="h-8 text-xs bg-white" placeholder="01012345678" />
          </div>
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-3 text-left">
      <div className="space-y-1.5">
        <Label htmlFor="code-phase1" className="text-xs font-bold text-slate-600">초대 코드</Label>
        <Input id="code-phase1" name="code" placeholder="6자리 문자/숫자" required className="uppercase tracking-widest font-bold bg-slate-50" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="name-phase1" className="text-xs font-bold text-slate-600">이름 (본명)</Label>
          <Input id="name-phase1" name="name" defaultValue={defaultName} placeholder="홍길동" required className="bg-slate-50" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone-phase1" className="text-xs font-bold text-slate-600">전화번호</Label>
          <Input id="phone-phase1" name="phone" defaultValue={defaultPhone} placeholder="01012345678" required className="bg-slate-50" />
        </div>
      </div>
      
      <Button type="submit" disabled={loading} className="w-full bg-[#1D9E75] hover:bg-[#1D9E75]/90 font-bold tracking-wide mt-2">
        {loading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Check className="w-4 h-4 mr-2" />
        )}
        초대 코드로 합류하기
      </Button>
    </form>
  )
}