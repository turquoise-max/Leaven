/**
 * 연차 발생 일수 계산 유틸리티
 */

/**
 * 입사일과 기준 년도를 받아, 근로기준법에 따른 발생 연차를 계산합니다.
 * 
 * @param joinDateStr 직원의 입사일 (YYYY-MM-DD 형식)
 * @param targetYear 조회할 기준 회계연도 (예: 2024)
 * @param calcType 연차 발생 기준 ('hire_date' | 'fiscal_year')
 * @returns 해당 연도에 발생해야 하는 총 연차 일수 (number)
 */
export function calculateAnnualLeave(joinDateStr: string | null | undefined, targetYear: number, calcType: 'hire_date' | 'fiscal_year'): number {
  if (!joinDateStr) return 0 // 입사일이 없으면 0일

  const joinDate = new Date(joinDateStr)
  if (isNaN(joinDate.getTime())) return 0

  const joinYear = joinDate.getFullYear()
  const joinMonth = joinDate.getMonth() // 0 ~ 11
  const joinDay = joinDate.getDate()

  // 만약 조회 연도가 입사 연도보다 과거라면 0일
  if (targetYear < joinYear) return 0

  // 근속 연수 (단순 연도 차이가 아닌 만 년수)
  // 편의상 targetYear 기준 특정 시점을 볼 필요가 있는데, 
  // 발생 '총' 연차이므로 targetYear의 12월 31일 기준으로 그 해에 '얼마나 발생했나/할 것인가'를 봅니다.
  const endOfTargetYear = new Date(targetYear, 11, 31) 
  
  // 입사일 기준 계산
  if (calcType === 'hire_date') {
    if (targetYear === joinYear) {
      // 입사 1년차: 1개월 만근 시 1일 발생 (최대 11일)
      // 해당 연도(12/31)까지 몇 개월이 지났는지
      let monthsPassed = (11 - joinMonth)
      // 입사일이 1일이 아닐 경우 등 세부적인 월 계산이 필요하지만, 대략적인 만 월수로 계산
      if (joinDay > 1) {
        // 엄밀히는 다음 달 같은 일자에 발생하지만, 당해 연도 발생분만 본다면
        // 12월의 일자가 입사일보다 작으면 1달을 뺌 (12월 31일이므로 항상 크거나 같음)
      }
      return Math.min(monthsPassed, 11)
    } 
    
    if (targetYear === joinYear + 1) {
      // 입사 2년차: 전년도 잔여월수 + 입사 1년 도래 시 15일 발생
      // 전년도(1년차)에 발생한 연차(최대 11일) 중 1월~입사월 전까지 추가 발생분
      const extraFirstYearLeaves = joinMonth 
      // 1년 만근 시점(targetYear의 입사일)에 15일 발생
      return extraFirstYearLeaves + 15
    }

    // 3년차 이상: 15일 + (근속년수 - 1) / 2 가산 (최대 25일)
    // 1년 만근 시점(targetYear의 입사일)에 발생하는 연차 개수
    const yearsOfService = targetYear - joinYear
    const additionalDays = Math.floor((yearsOfService - 1) / 2)
    return Math.min(15 + additionalDays, 25)

  } else {
    // 회계연도 기준 계산 (매년 1월 1일 일괄 부여)
    if (targetYear === joinYear) {
      // 입사 당해 연도: 1개월 만근 시 1일 발생 (최대 11일) -> 입사일 기준과 동일
      let monthsPassed = (11 - joinMonth)
      return Math.min(monthsPassed, 11)
    } 
    
    if (targetYear === joinYear + 1) {
      // 입사 이듬해 1월 1일:
      // 1. 2년차 15일에 대한 비례 연차 발생 (15일 * 전년도 근속일수 / 365)
      // 2. + 1년차(당해) 1개월 만근 시 1일 발생하는 남은 월수 발생
      
      // 전년도 근속일수 = 12/31 - 입사일
      const endOfJoinYear = new Date(joinYear, 11, 31)
      const diffTime = Math.abs(endOfJoinYear.getTime() - joinDate.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1 // 당일 포함
      
      // 비례 연차 (보통 소수점 첫째자리까지 부여하나 여기선 반올림/올림 등 회사 내규 따름. 일단 소수점 첫째자리)
      const proportionalLeaves = Math.round((15 * diffDays / 365) * 10) / 10
      
      // 1년차 추가 월차 (2년차의 입사월 전까지)
      const extraFirstYearLeaves = joinMonth
      
      return proportionalLeaves + extraFirstYearLeaves
    }

    // 3년차 이상 (1월 1일 일괄 부여)
    // 15일 + (근속년수 - 2) / 2 가산 (비례를 받았으므로 1년 당김 효과)
    const yearsOfService = targetYear - joinYear
    const additionalDays = Math.floor((yearsOfService - 2) / 2)
    const total = 15 + additionalDays
    return Math.min(total, 25)
  }
}