import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// 모두싸인에서 서명 완료 등의 이벤트가 발생했을 때 호출되는 Webhook 엔드포인트
export async function POST(req: Request) {
  try {
    const payload = await req.json()
    console.log('Webhook Payload Received:', JSON.stringify(payload, null, 2))
    
    const eventType = payload.event?.type
    const documentId = payload.document?.id || payload.document_id || payload.id

    if (!documentId) {
      return NextResponse.json({ error: 'Missing document ID' }, { status: 400 })
    }

    // 웹훅은 쿠키 세션이 없으므로 Service Role Key를 사용해 RLS 우회
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 해당 documentId를 가진 직원 찾기
    const { data: member, error: findError } = await supabase
      .from('store_members')
      .select('id, store_id, status, contract_status')
      .eq('modusign_document_id', documentId)
      .single()

    if (findError || !member) {
      console.error('Webhook: Staff not found for document', documentId)
      return NextResponse.json({ success: true, message: 'Ignored: Document not found in our system' })
    }

    // 웹훅 페이로드 형식에 의존하지 않고 항상 모두싸인 API를 호출하여 최신 상태를 가져옵니다.
    const credentials = Buffer.from(`${process.env.MODUSIGN_EMAIL}:${process.env.MODUSIGN_API_KEY}`).toString('base64')
    const docRes = await fetch(`https://api.modusign.co.kr/documents/${documentId}`, {
      headers: { 'Authorization': `Basic ${credentials}` }
    })
    
    if (!docRes.ok) {
      console.error(`Failed to fetch document status from Modusign. Status: ${docRes.status}`)
      return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 })
    }

    const docData = await docRes.json()
    const docStatus = docData.status

    if (docStatus === 'COMPLETED') {
      console.log(`Document ${documentId} is COMPLETED. Updating staff status...`)
      
      let fileUrl = null
      
      // 다운로드 로직: 문서 파일 다운로드 및 Supabase 스토리지 업로드
      try {
        const downloadUrl = docData.file?.downloadUrl
        if (downloadUrl) {
          const fileRes = await fetch(downloadUrl)
          if (fileRes.ok) {
            const arrayBuffer = await fileRes.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)
            const fileName = `contracts/${member.store_id}/${member.id}_${Date.now()}.pdf`
            
            const { error: uploadError } = await supabase.storage
              .from('store_documents')
              .upload(fileName, buffer, {
                contentType: 'application/pdf',
                upsert: true
              })
              
            if (!uploadError) {
              const { data: urlData } = supabase.storage.from('store_documents').getPublicUrl(fileName)
              fileUrl = urlData.publicUrl
            } else {
              console.error('Failed to upload contract to storage:', uploadError)
            }
          }
        }
      } catch (e) {
        console.error('Error downloading/uploading contract file:', e)
      }

      const updateData: any = {
        contract_status: 'signed',
        status: 'active' // 합류 대기 -> 재직중
      }
      
      if (fileUrl) {
        updateData.contract_file_url = fileUrl
      }

      const { error: updateError } = await supabase
        .from('store_members')
        .update(updateData)
        .eq('id', member.id)

      if (updateError) {
        console.error('Webhook: Failed to update staff status', updateError)
        return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
      }

    } else if (docStatus === 'PROGRESS') {
      // 진행 중인 경우, 점주('갑')가 서명했는지 확인
      const employerParticipant = docData.participants?.find((p: any) => p.role === '갑' || p.name === '갑')
      // role이 명확히 안넘어올 수 있으므로 name이나 role을 체크, 또는 서명 여부로 판단
      const isEmployerSigned = docData.participants?.some((p: any) => 
        (p.role === '갑' || p.name?.includes('대표') || docData.requester?.email === p.email) && p.status === 'SIGNED'
      )

      if (isEmployerSigned) {
        // 점주가 서명을 완료한 경우 직원 서명 대기 상태로 변경
        // 이미 pending_staff거나 signed인 경우는 제외하고 업데이트
        if (member.contract_status === 'sent') {
          await supabase
            .from('store_members')
            .update({ contract_status: 'pending_staff' })
            .eq('id', member.id)
        }
      }
    } else if (docStatus === 'CANCELED') {
      await supabase.from('store_members').update({ contract_status: 'canceled' }).eq('id', member.id)
    } else if (docStatus === 'REJECTED') {
      await supabase.from('store_members').update({ contract_status: 'rejected' }).eq('id', member.id)
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Modusign Webhook Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}