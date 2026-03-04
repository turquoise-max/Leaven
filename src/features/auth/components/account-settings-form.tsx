'use client'

import { useState } from 'react'
import { updateProfile, updatePasswordSettings, signInWithGoogle } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { User } from '@supabase/supabase-js'

interface AccountSettingsFormProps {
  user: User
}

export function AccountSettingsForm({ user }: AccountSettingsFormProps) {
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  async function handleUpdateProfile(formData: FormData) {
    const result = await updateProfile(formData)
    if (result?.message) {
      setProfileMessage(result.message)
      setTimeout(() => setProfileMessage(null), 3000)
    }
  }

  async function handleUpdatePassword(formData: FormData) {
    setPasswordError(null)
    setPasswordMessage(null)
    const result = await updatePasswordSettings(formData)
    if (result?.error) {
      setPasswordError(result.error)
    } else if (result?.message) {
      setPasswordMessage(result.message)
      setTimeout(() => setPasswordMessage(null), 3000)
    }
  }

  async function handleSignInWithGoogle() {
    await signInWithGoogle()
  }

  // 소셜 연동 상태 확인
  const googleIdentity = user.identities?.find(id => id.provider === 'google')

  return (
    <Tabs defaultValue="profile" className="w-full max-w-2xl">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="profile">프로필</TabsTrigger>
        <TabsTrigger value="security">보안 및 로그인</TabsTrigger>
      </TabsList>
      
      <TabsContent value="profile">
        <Card>
          <CardHeader>
            <CardTitle>프로필 정보</CardTitle>
            <CardDescription>
              기본적인 계정 정보를 관리합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={handleUpdateProfile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <Input id="email" value={user.email} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">이메일은 변경할 수 없습니다.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">이름</Label>
                <Input 
                  id="fullName" 
                  name="fullName" 
                  defaultValue={user.user_metadata.full_name || ''} 
                  placeholder="이름을 입력하세요"
                />
              </div>
              {profileMessage && <p className="text-sm text-green-600">{profileMessage}</p>}
              <Button type="submit">저장</Button>
            </form>
          </CardContent>
        </Card>
      </TabsContent>
      
      <TabsContent value="security">
        <Card>
          <CardHeader>
            <CardTitle>보안 및 로그인</CardTitle>
            <CardDescription>
              비밀번호 및 소셜 연동을 관리합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 비밀번호 변경 */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">비밀번호 변경</h3>
              <form action={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">새 비밀번호</Label>
                  <Input id="password" name="password" type="password" placeholder="새 비밀번호 입력" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passwordConfirm">비밀번호 확인</Label>
                  <Input id="passwordConfirm" name="passwordConfirm" type="password" placeholder="비밀번호 다시 입력" />
                </div>
                {passwordError && <p className="text-sm text-red-500">{passwordError}</p>}
                {passwordMessage && <p className="text-sm text-green-600">{passwordMessage}</p>}
                <Button type="submit">비밀번호 변경</Button>
              </form>
            </div>
            
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium mb-4">소셜 계정 연동</h3>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="bg-white p-2 rounded-full border flex items-center justify-center w-10 h-10">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26.81-.58z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium">Google</p>
                    <p className="text-sm text-muted-foreground">
                      {googleIdentity ? '연동됨' : '연동되지 않음'}
                    </p>
                  </div>
                </div>
                {!googleIdentity ? (
                  <form action={handleSignInWithGoogle}>
                    <Button variant="outline" type="submit">연동하기</Button>
                  </form>
                ) : (
                   <Button variant="outline" disabled title="현재 연동 해제는 지원하지 않습니다.">연동됨</Button> 
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}