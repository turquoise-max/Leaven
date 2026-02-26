'use client'

import Link from 'next/link'
import { useState } from 'react'
import { signup, signInWithGoogle } from '../actions'
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

export function SignupForm() {
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSignup(formData: FormData) {
    const result = await signup(formData)
    if (result?.error) {
      setError(result.error)
      setMessage(null)
    } else if (result?.message) {
      setMessage(result.message)
      setError(null)
    }
  }

  async function handleGoogleLogin() {
    const result = await signInWithGoogle()
    if (result?.error) {
      setError(result.error)
    }
  }

  return (
    <Card className="mx-auto max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Sign Up</CardTitle>
        <CardDescription>
          Enter your information to create an account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSignup} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="m@example.com"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          {error && <div className="text-sm text-red-500">{error}</div>}
          {message && <div className="text-sm text-green-500">{message}</div>}
          <Button type="submit" className="w-full">
            Create an account
          </Button>
        </form>
        <form action={handleGoogleLogin} className="mt-4">
          <Button variant="outline" type="submit" className="w-full">
            Sign up with Google
          </Button>
        </form>
        <div className="mt-4 text-center text-sm">
          Already have an account?{' '}
          <Link href="/login" className="underline">
            Sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}