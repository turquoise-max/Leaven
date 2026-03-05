import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { unstable_noStore as noStore } from 'next/cache'

export async function GET() {
  noStore()
  const supabase = await createClient()

  try {
    const { data: permissions, error } = await supabase
      .from('permissions')
      .select('*')
      .order('code')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      count: permissions.length, 
      permissions 
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}