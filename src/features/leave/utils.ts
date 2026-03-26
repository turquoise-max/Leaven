/**
 * 연차 발생 일수 계산 유틸리티
 */

/**
 * 입사일과 기준일을 받아, 근로기준법에 따른 발생 연차를 계산합니다.
 * 
 * @param joinDateStr 직원의 입사일 (YYYY-MM-DD 형식)
 * @param referenceDate 조회 기준일 (Date 객체)
 * @param calcType 연차 발생 기준 ('hire_date' | 'fiscal_year')
 * @returns 기준일 시점에 발생 완료된(보유 중인) 총 연차 일수 (number)
 */
export function calculateAnnualLeave(joinDateStr: string | null | undefined, referenceDate: Date, calcType: 'hire_date' | 'fiscal_year'): number {
  if (!joinDateStr) return 0

  const joinDate = new Date(joinDateStr)
  if (isNaN(joinDate.getTime())) return 0

  const joinYear = joinDate.getFullYear()
  const targetYear = referenceDate.getFullYear()
  
  // 조회 기준일이 입사일보다 과거라면 0일
  if (referenceDate < joinDate) return 0

  if (calcType === 'hire_date') {
    /**
     * [입사일 기준 근로기준법 원칙]
     * 1. 1년 미만: 1개월 개근 시 1일씩 발생 (최대 11일)
     * 2. 1년 만근 시(만 1년 경과): 15일 발생 (기존 월차 소멸 성격이나 시스템상 '해당 회차' 총량으로 관리)
     * 3. 만 2년 근속 후(3년차)부터: 2년마다 1일씩 가산 (최대 25일)
     */
    
    // 전체 근속 개월 수 계산
    const diffInMonths = (referenceDate.getFullYear() - joinDate.getFullYear()) * 12 + (referenceDate.getMonth() - joinDate.getMonth())
    const isDayPassed = referenceDate.getDate() >= joinDate.getDate()
    const fullMonths = isDayPassed ? diffInMonths : diffInMonths - 1
    const fullYears = Math.floor(fullMonths / 12)

    // 1. 1년 미만인 경우
    if (fullYears === 0) {
      // 현재까지 발생한 월차 개수 (최대 11개)
      return Math.min(Math.max(0, fullMonths), 11)
    }

    // 2. 1년 이상인 경우 (입사 기념일마다 갱신)
    // fullYears는 현재 시점의 만 근속년수
    // 연차는 만 1년, 2년... 시점에 새로 발생하므로 현재 fullYears에 해당하는 연차 개수를 리턴
    // 가산 연차: 15 + floor((fullYears - 1) / 2)
    const leaveCount = 15 + Math.floor((fullYears - 1) / 2)
    return Math.min(leaveCount, 25)

  } else {
    // 회계연도 기준 계산 (매년 1월 1일 일괄 부여)
    const joinMonth = joinDate.getMonth()

    if (targetYear === joinYear) {
      // 입사 당해 연도: 기준일 전까지 발생한 월차 개수
      const diffInMonths = (referenceDate.getFullYear() - joinDate.getFullYear()) * 12 + (referenceDate.getMonth() - joinDate.getMonth())
      const isDayPassed = referenceDate.getDate() >= joinDate.getDate()
      const fullMonths = isDayPassed ? diffInMonths : diffInMonths - 1
      return Math.min(Math.max(0, fullMonths), 11)
    } 
    
    if (targetYear === joinYear + 1) {
      /**
       * 입사 이듬해 1월 1일:
       * 1. 2년차 15일에 대한 비례 연차 발생 (15일 * 전년도 근속일수 / 365)
       * 2. + 1년차(당해) 월차 (입사월부터 12월까지 발생분 중 전년도에 미처 못 쓴 분량 혹은 남은 발생분)
       *    실무적으로는 전년도 미사용 월차는 소멸되거나 수동 정산하지만, 
       *    시스템상 '총 발생'은 전년도 11개 + 비례 15개를 합쳐서 관리하기도 함.
       *    여기서는 기존 로직의 의도(비례분 + 전년도 이월 월차 성격)를 유지하며 계산식을 정교화합니다.
       */
      
      // 전년도 근속일수 = 12/31 - 입사일
      const endOfJoinYear = new Date(joinYear, 11, 31)
      const diffTime = Math.abs(endOfJoinYear.getTime() - joinDate.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1 // 당일 포함
      
      // 비례 연차 (15일 * 근속일수 / 365)
      const proportionalLeaves = Math.ceil((15 * diffDays / 365))
      
      // 1년차 추가 월차 (전체 11개 중 당해연도에 속하는 부분)
      // 회계연도 기준 1/1에 부여할 때, 전년도에 이미 발생한 것들을 포함할지 여부
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