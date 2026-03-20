import { SignupForm } from '@/features/auth/components/signup-form'

export default async function SignupPage(props: { searchParams?: Promise<{ next?: string }> }) {
  const searchParams = await props.searchParams
  const nextUrl = searchParams?.next || '/home'
  
  return <SignupForm nextUrl={nextUrl} />
}
