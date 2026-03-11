import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 모두싸인에서 서명 완료 등의 이벤트가 발생했을 때 호출되는 Webhook 엔드포인트
export async function POST(req: Request) {
  try {
    const payload = await req.json()
    
    // 모두싸인 웹훅 페이로드 확인 (예시 구조)
    // { event: 'document_completed', document: { id: '...', ... } }
    
    // 문서 서명 완료 이벤트인지 확인 (이벤트 이름은 모두싸인 공식 문서 참조 필요, 임시로 처리)
    const isCompleted = payload.event === 'DOCUMENT_COMPLETED' || 
                        payload.event === 'document_completed' || 
                        payload.document_status === 'COMPLETED' ||
                        payload.status === 'COMPLETED'

    const documentId = payload.document?.id || payload.document_id || payload.id

    if (!documentId) {
      return NextResponse.json({ error: 'Missing document ID' }, { status: 400 })
    }

    if (isCompleted) {
      const supabase = await createClient()

      // 1. 해당 documentId를 가진 직원 찾기
      const { data: member, error: findError } = await supabase
        .from('store_members')
        .select('id, status, contract_status')
        .eq('modusign_document_id', documentId)
        .single()

      if (findError || !member) {
        console.error('Webhook: Staff not found for document', documentId)
        // 모두싸인 웹훅 시스템이 계속 재시도하지 않도록 200 반환 (우리 시스템에 없는 문서인 경우)
        return NextResponse.json({ success: true, message: 'Ignored: Document not found in our system' })
      }

      // 2. 상태 업데이트 (서명 완료 및 재직자 이관)
      const { error: updateError } = await supabase
        .from('store_members')
        .update({
          contract_status: 'signed',
          status: 'active' // 합류 대기(pending_approval) -> 재직중(active) 자동 이관
        })
        .eq('id', member.id)

      if (updateError) {
        console.error('Webhook: Failed to update staff status', updateError)
        return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
      }

      console.log(`Webhook: Successfully activated staff ${member.id} via Modusign document ${documentId}`)
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Modusign Webhook Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}