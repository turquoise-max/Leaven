import { LoginForm } from '@/features/auth/components/login-form'

export default async function LoginPage(props: { searchParams?: Promise<{ next?: string }> }) {
  const searchParams = await props.searchParams
  const nextUrl = searchParams?.next || '/home'
  
  return <LoginForm nextUrl={nextUrl} />
}
