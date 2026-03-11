export const MODUSIGN_API_URL = 'https://api.modusign.co.kr'

interface CreateDocumentFromTemplateParams {
  templateId: string
  title: string
  participants: {
    name: string
    email?: string
    phone?: string
    role: string // 서명자 역할 (일반적으로 'signer')
    signingMethod?: {
      type: 'EMAIL' | 'KAKAOTALK'
      value: string
    }
  }[]
  // 입력 필드 매핑 (템플릿에 지정된 필드 이름과 값을 매칭)
  fields?: Record<string, string | number>
}

/**
 * 모두싸인 템플릿 기반 문서 생성 및 서명 요청을 위한 클라이언트
 */
export async function sendContract(params: CreateDocumentFromTemplateParams) {
  const apiKey = process.env.MODUSIGN_API_KEY
  const email = process.env.MODUSIGN_EMAIL

  if (!apiKey || !email) {
    throw new Error('MODUSIGN_API_KEY or MODUSIGN_EMAIL is not defined in environment variables')
  }

  // 이메일:API키를 Base64로 인코딩 (모두싸인 Basic 인증 스펙)
  const credentials = Buffer.from(`${email}:${apiKey}`).toString('base64')

  const participantMappings = params.participants.map(p => ({
    role: p.role,
    name: p.name,
    email: p.email,
    phone: p.phone,
    signingMethod: p.signingMethod,
  }))

  const requesterInputMappings = params.fields ? Object.entries(params.fields).map(([dataLabel, value]) => ({
    dataLabel,
    value: String(value)
  })) : []

  // 매핑 데이터 로깅 (템플릿 불일치 에러 디버깅 용도)
  console.log('--- Modusign Payload ---')
  console.log('participantMappings:', JSON.stringify(participantMappings, null, 2))
  console.log('requesterInputMappings:', JSON.stringify(requesterInputMappings, null, 2))
  console.log('------------------------')

  // 1. 템플릿으로 서명 요청 직접 발송 (올바른 엔드포인트 적용)
  const response = await fetch(`${MODUSIGN_API_URL}/documents/request-with-template`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Basic ${credentials}`,
    },
    body: JSON.stringify({
      templateId: params.templateId,
      document: {
        title: params.title,
        // 모두싸인 공식 API 스펙에 맞춘 참여자 매핑
        participantMappings,
        // 모두싸인 공식 API 스펙에 맞춘 입력 필드 매핑
        requesterInputMappings
      }
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    console.error('Modusign API Error:', JSON.stringify(errorData, null, 2))
    throw new Error(`Modusign API failed with status ${response.status}`)
  }

  const data = await response.json()
  return data
}