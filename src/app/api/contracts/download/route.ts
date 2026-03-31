import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')

    if (!storeId) {
      return new NextResponse('Store ID is required', { status: 400 })
    }

    // 현재 선택된 매장에서 해당 사용자의 멤버 정보를 가져와서 문서 ID 확인
    const { data: member, error: memberError } = await supabase
      .from('store_members')
      .select('modusign_document_id, contract_status')
      .eq('store_id', storeId)
      .eq('user_id', user.id)
      .single()

    if (memberError || !member) {
      return new NextResponse('Member not found', { status: 404 })
    }

    if (!member.modusign_document_id) {
      return new NextResponse('Contract document not found for this member', { status: 404 })
    }

    // 문서가 서명 완료되었는지 여부는 상관없이 보여줄 수도 있지만, 여기서는 다운로드 링크만 제공합니다.
    const apiKey = process.env.MODUSIGN_API_KEY
    const email = process.env.MODUSIGN_EMAIL

    if (!apiKey || !email) {
      return new NextResponse('Server configuration error (Modusign)', { status: 500 })
    }

    const credentials = Buffer.from(`${email}:${apiKey}`).toString('base64')
    
    // 문서 다운로드 API 호출 (PDF 파일 다운로드)
    const docRes = await fetch(`https://api.modusign.co.kr/documents/${member.modusign_document_id}/files`, {
      headers: { 
        'Authorization': `Basic ${credentials}`,
        'Accept': 'application/pdf'
      }
    })

    if (!docRes.ok) {
      console.error('Failed to download Modusign document', await docRes.text())
      return new NextResponse('Failed to fetch document from Modusign', { status: 502 })
    }

    // PDF 바이너리 데이터를 응답으로 반환
    const pdfBuffer = await docRes.arrayBuffer()
    
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="contract_${user.id}.pdf"`
      }
    })

  } catch (error) {
    console.error('Error downloading contract:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}