export const MODUSIGN_API_URL = 'https://api.modusign.co.kr'

interface CreateDocumentFromTemplateParams {
  templateId: string
  title: string
  participants: {
    name: string
    email?: string
    phone?: string
    role: string // 서명자 역할 (일반적으로 'signer')
  }[]
  // 입력 필드 매핑 (템플릿에 지정된 필드 이름과 값을 매칭)
  fields?: Record<string, string | number>
}

/**
 * 모두싸인 템플릿 기반 문서 생성 및 서명 요청을 위한 클라이언트
 */
export async function sendContract(params: CreateDocumentFromTemplateParams) {
  const apiKey = process.env.MODUSIGN_API_KEY

  if (!apiKey) {
    throw new Error('MODUSIGN_API_KEY is not defined in environment variables')
  }

  // 1. 템플릿으로 문서 생성 요청 (이 부분은 실제 모두싸인 API 버전에 따라 다를 수 있음)
  // 여기서는 가장 일반적인 플로우를 추상화하여 제공합니다.
  const response = await fetch(`${MODUSIGN_API_URL}/v2/template-documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      templateId: params.templateId,
      documentName: params.title,
      // participant 정보와 매핑할 필드들
      participantMappings: params.participants.map(p => ({
        role: p.role,
        name: p.name,
        email: p.email,
        phone: p.phone,
      })),
      fieldMappings: params.fields ? Object.entries(params.fields).map(([name, value]) => ({
        name,
        value: String(value)
      })) : []
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    console.error('Modusign API Error:', errorData)
    throw new Error(`Modusign API failed with status ${response.status}`)
  }

  const data = await response.json()
  return data
}