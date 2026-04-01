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
      console.error('Download contract failed: storeId is missing')
      return new NextResponse('Store ID is required', { status: 400 })
    }

    // 현재 선택된 매장에서 해당 사용자의 멤버 정보를 가져와서 문서 ID 확인
    let { data: member, error: memberError } = await supabase
      .from('store_members')
      .select('modusign_document_id, contract_status, contract_file_url')
      .eq('store_id', storeId)
      .eq('user_id', user.id)
      .single()

    // 만약 현재 매장에 계약서가 없다면 (fallback) 전체 매장 중에 사용자의 계약서가 있는지 찾음
    if (memberError || !member || (!member.modusign_document_id && !member.contract_file_url)) {
      console.warn('Contract not found in current store. Searching other stores for user...', { storeId, userId: user.id })
      const { data: allMembers } = await supabase
        .from('store_members')
        .select('modusign_document_id, contract_status, contract_file_url')
        .eq('user_id', user.id)
        
      const validFallback = allMembers?.find(m => m.modusign_document_id || m.contract_file_url)
      
      if (validFallback) {
        member = validFallback
        memberError = null
      } else {
        console.error('Download contract failed: member not found', { storeId, userId: user.id, memberError })
        return new NextResponse('Member not found', { status: 404 })
      }
    }

    // 모두싸인 문서가 있는 경우
    if (member.modusign_document_id) {
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
        const errorText = await docRes.text()
        console.error('Failed to download Modusign document', {
          status: docRes.status,
          statusText: docRes.statusText,
          error: errorText,
          documentId: member.modusign_document_id
        })
        return new NextResponse(`Failed to fetch document from Modusign: ${docRes.statusText}`, { status: 502 })
      }

      // PDF 바이너리 데이터를 응답으로 반환
      const pdfBuffer = await docRes.arrayBuffer()
      
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="contract_${user.id}.pdf"`
        }
      })
    } 
    // 모두싸인 문서는 없으나 관리자가 직접 업로드한 파일이 있는 경우
    else if (member.contract_file_url) {
      return NextResponse.redirect(member.contract_file_url)
    } 
    // 둘 다 없는 경우
    else {
      console.warn('Download contract failed: no document found', { storeId, userId: user.id })
      return new NextResponse('Contract document not found for this member', { status: 404 })
    }

  } catch (error) {
    console.error('Error downloading contract:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}