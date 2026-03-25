/**
 * 날짜와 시간 처리를 위한 공통 유틸리티
 * 
 * 프로젝트의 모든 날짜/시간은 다음 원칙을 따릅니다:
 * 1. DB에는 항상 UTC 기준으로 저장 (ISO 8601 포맷: YYYY-MM-DDTHH:mm:ss.sssZ)
 * 2. 클라이언트 입력은 KST(한국 표준시, UTC+9) 기준으로 받음
 * 3. 서버 로직에서 KST 입력을 UTC로 변환하여 저장
 * 4. 클라이언트 조회 시에는 UTC 값을 받아 브라우저(또는 라이브러리)에서 로컬 시간대(KST)로 변환하여 표시
 */

// KST 오프셋 (시간 단위)
const KST_OFFSET_HOURS = 9

/**
 * KST(한국 시간) 기준의 날짜(YYYY-MM-DD)와 시간(HH:mm)을 입력받아
 * UTC 기준의 ISO 8601 문자열로 변환합니다.
 * 
 * 시스템(서버)의 로컬 시간대와 무관하게 수학적으로 계산하므로
 * 어떤 환경에서 실행하든 동일한 결과를 보장합니다.
 * 
 * 예: toUTCISOString('2024-03-07', '19:00') 
 * -> '2024-03-07T10:00:00.000Z' (19시 - 9시간 = 10시)
 */
export function toUTCISOString(dateStr: string, timeStr: string): string {
  if (!dateStr || !timeStr) {
    throw new Error(`Invalid date or time: ${dateStr}, ${timeStr}`)
  }
  
  const [year, month, day] = dateStr.split('-').map(Number)
  const [hour, minute] = timeStr.split(':').map(Number)
  
  // Date.UTC는 월이 0부터 시작 (0=1월, 11=12월)
  // KST는 UTC보다 9시간 빠르므로, UTC를 구하려면 9시간을 빼야 함
  const utcTimestamp = Date.UTC(year, month - 1, day, hour - KST_OFFSET_HOURS, minute)
  
  return new Date(utcTimestamp).toISOString()
}

/**
 * 현재 시간을 KST 기준으로 ISO 문자열로 반환합니다.
 * (DB 조회 시 현재 시간 비교 등에 사용)
 * 
 * 주의: 반환값은 UTC 포맷이지만, 내용은 '현재 시각'을 정확히 나타냄.
 * 예: 한국이 15시라면, 반환값은 '...T06:00:00Z' (UTC 기준)
 */
export function getCurrentISOString(): string {
  return new Date().toISOString()
}

/**
 * KST 기준의 날짜(YYYY-MM-DD)에 하루를 더한 날짜 문자열을 반환합니다.
 * (자정을 넘가는 스케줄 계산 등에 사용)
 */
export function getNextDateString(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  // Date 객체를 생성하여 하루 더함 (월/연도 변경 자동 처리)
  const date = new Date(year, month - 1, day + 1)
  
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  
  return `${y}-${m}-${d}`
}

/**
 * UTC 기준의 ISO 문자열을 KST 기준의 ISO 문자열로 변환합니다. (Z 제거)
 * 예: '...T09:00:00Z' -> '...T18:00:00'
 * 
 * FullCalendar 등 클라이언트 라이브러리가 UTC를 자동으로 변환하지 못할 때 사용합니다.
 */
export function toKSTISOString(utcIsoString: string): string {
  if (!utcIsoString) return ''
  
  const date = new Date(utcIsoString)
  // KST = UTC + 9
  const kstDate = new Date(date.getTime() + (KST_OFFSET_HOURS * 60 * 60 * 1000))
  
  // toISOString()은 UTC 기준으로 반환하므로, 이미 KST로 시간을 이동시킨 값을 UTC라고 속여서 포맷팅
  // 그리고 뒤의 'Z'를 제거하여 "로컬 시간(KST)"처럼 보이게 함
  return kstDate.toISOString().replace('Z', '')
}

/**
 * 캘린더 등에서 사용된 "가짜 KST 시간(UTC+9가 이미 더해진 상태)"을
 * 다시 원래의 UTC 시간으로 되돌립니다. (9시간 뺌)
 * 
 * 예: 캘린더 상의 13:00 (Date 객체값은 UTC 13:00인 상태) -> 04:00 (UTC)
 * toKSTISOString의 역연산입니다.
 */
export function revertKSTToUTC(date: Date): string {
  if (!date) return ''
  // 9시간 빼기
  const utcDate = new Date(date.getTime() - (KST_OFFSET_HOURS * 60 * 60 * 1000))
  return utcDate.toISOString()
}

/**
 * HH:mm 형식의 시간 문자열에 분(Minute)을 더한 시간을 반환합니다.
 * (Timezone 변환 없이 순수 시간 계산)
 */
export function addMinutesToTime(timeStr: string, minutesToAdd: number): string {
  if (!timeStr) return ''
  
  const [h, m] = timeStr.split(':').map(Number)
  const totalMinutes = h * 60 + m + minutesToAdd
  
  let newH = Math.floor(totalMinutes / 60) % 24
  if (newH < 0) newH += 24
  
  let newM = totalMinutes % 60
  if (newM < 0) newM += 60
  
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`
}

/**
 * 분(Minute) 단위의 시간을 더한 UTC ISO 문자열을 반환합니다.
 * (작업 소요 시간 계산 등에 사용)
 */
export function addMinutesToISOString(isoString: string, minutes: number): string {
  const date = new Date(isoString)
  date.setMinutes(date.getMinutes() + minutes)
  return date.toISOString()
}

/**
 * 두 ISO 문자열 사이의 분(Minute) 차이를 반환합니다.
 */
export function getDiffInMinutes(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  return Math.round((end - start) / (1000 * 60))
}

/**
 * KST 기준의 오늘 날짜(YYYY-MM-DD)를 반환합니다.
 */
export function getTodayDateString(): string {
  // 현재 UTC 시간
  const now = new Date()
  // KST로 변환 (UTC+9)
  const kst = new Date(now.getTime() + (KST_OFFSET_HOURS * 60 * 60 * 1000))
  
  const y = kst.getUTCFullYear()
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0')
  const d = String(kst.getUTCDate()).padStart(2, '0')
  
  return `${y}-${m}-${d}`
}