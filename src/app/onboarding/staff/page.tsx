'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { joinStoreByCode, verifyInviteCode } from '@/features/onboarding/actions'
import { Loader2, Store } from 'lucide-react'

const formSchema = z.object({
  inviteCode: z.string().min(6, '매장 코드는 6자리입니다.').max(6),
  name: z.string().min(2, '이름을 입력해주세요.'),
  phone: z.string().min(10, '전화번호를 올바르게 입력해주세요.'),
})

export default function StaffOnboardingPage() {
  const [isVerifying, setIsVerifying] = useState(false)
  const [storeInfo, setStoreInfo] = useState<{ id: string; name: string } | null>(null)
  const router = useRouter()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      inviteCode: '',
      name: '',
      phone: '',
    },
  })

  // 매장 코드 검증 핸들러
  const handleVerifyCode = async () => {
    const code = form.getValues('inviteCode')
    if (code.length !== 6) {
      form.setError('inviteCode', { message: '매장 코드는 6자리여야 합니다.' })
      return
    }

    setIsVerifying(true)
    const result = await verifyInviteCode(code)
    setIsVerifying(false)

    if (result.error) {
      form.setError('inviteCode', { message: result.error })
      setStoreInfo(null)
    } else if (result.store) {
      setStoreInfo({ id: result.store.id, name: result.store.name })
      toast.success('매장을 찾았습니다!')
    }
  }

  // 가입 요청 핸들러
  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!storeInfo) {
      await handleVerifyCode()
      if (!storeInfo) return
    }

    try {
      const result = await joinStoreByCode(values.inviteCode, values.name, values.phone)
      
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('가입 요청을 보냈습니다.')
        // Redirect happens in server action
      }
    } catch (error) {
      toast.error('오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>직원 등록</CardTitle>
          <CardDescription>
            근무하실 매장의 초대 코드를 입력해주세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="inviteCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>매장 초대 코드 (6자리)</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input 
                          placeholder="CAFE-8821" 
                          {...field} 
                          onChange={(e) => {
                            field.onChange(e.target.value.toUpperCase())
                            if (storeInfo) setStoreInfo(null) // 코드가 바뀌면 매장 정보 초기화
                          }}
                          maxLength={6}
                        />
                      </FormControl>
                      <Button 
                        type="button" 
                        variant="secondary"
                        onClick={handleVerifyCode}
                        disabled={isVerifying || !field.value}
                      >
                        {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : '확인'}
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {storeInfo && (
                <div className="bg-primary/5 p-4 rounded-lg flex items-center gap-3 border border-primary/20">
                  <div className="bg-primary/10 p-2 rounded-full">
                    <Store className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">매장 확인됨</p>
                    <p className="font-semibold text-lg">{storeInfo.name}</p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>이름 (실명)</FormLabel>
                      <FormControl>
                        <Input placeholder="홍길동" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>전화번호</FormLabel>
                      <FormControl>
                        <Input placeholder="010-1234-5678" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full"
                  onClick={() => router.back()}
                >
                  취소
                </Button>
                <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      요청 중...
                    </>
                  ) : (
                    '가입 요청 보내기'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}