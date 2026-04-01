import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendContract } from '@/features/contract/lib/client'
import { STANDARD_LABELS, FIXED_TERM_LABELS } from '@/features/contract/lib/labels'

export async function POST(req: Request) {
  try {
    const { storeId, staffId, channels } = await req.json()

    if (!storeId || !staffId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. 사업주 정보 조회 (현재 로그인한 사용자)
    const { data: employerProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    // 2. 매장 및 직원 정보, 스케줄 등 일괄 조회
    const { data: staffData, error: staffError } = await supabase
      .from('store_members')
      .select(`
        *,
        store:stores(*),
        profile:profiles(*),
        role_info:store_roles(name)
      `)
      .or(`id.eq.${staffId},user_id.eq.${staffId}`)
      .eq('store_id', storeId)
      .single()

    if (staffError || !staffData) {
      console.error('Staff not found:', staffError)
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
    }

    const store = staffData.store as any
    const profile = staffData.profile as any
    const roleInfo = Array.isArray(staffData.role_info) ? staffData.role_info[0] : staffData.role_info
    const schedules = (staffData.work_schedules as any[]) || []

    // 고용 형태(employment_type)를 기준으로 템플릿 매핑
    let templateId = ''
    let isStandardTemplate = false

    switch (staffData.employment_type) {
      case 'fulltime':
        templateId = process.env.MODUSIGN_TEMPLATE_ID_STANDARD || ''
        isStandardTemplate = true
        break
      case 'contract':
      case 'parttime':
        templateId = process.env.MODUSIGN_TEMPLATE_ID_FIXED_TERM || ''
        break
      case 'daily':
        // 일용직 임시 템플릿 (추후 전용 템플릿으로 교체)
        templateId = process.env.MODUSIGN_TEMPLATE_ID_DAILY || process.env.MODUSIGN_TEMPLATE_ID_FIXED_TERM || 'TEMP_DAILY_ID'
        break
      case 'probation':
        // 수습 임시 템플릿 (추후 전용 템플릿으로 교체)
        templateId = process.env.MODUSIGN_TEMPLATE_ID_PROBATION || process.env.MODUSIGN_TEMPLATE_ID_FIXED_TERM || 'TEMP_PROBATION_ID'
        break
      default:
        templateId = process.env.MODUSIGN_TEMPLATE_ID_FIXED_TERM || ''
        break
    }

    if (!templateId || templateId.startsWith('TEMP_')) {
      // NOTE: 개발 및 테스트를 위해 임시 템플릿 아이디가 들어간 경우 서버 에러를 낼지 결정해야 함
      // 여기서는 템플릿 ID가 아예 없으면 에러를 반환
      if (!templateId) {
        console.error(`Missing Modusign Template ID for employment_type: ${staffData.employment_type}`)
        return NextResponse.json({ error: '해당 고용 형태의 템플릿 ID 설정이 누락되었습니다.' }, { status: 500 })
      }
    }

    // 직원 이름 및 연락처
    const staffName = staffData.name || profile?.full_name
    const staffPhone = staffData.phone || profile?.phone
    const staffEmail = staffData.email || profile?.email

    if (!staffName || (!staffPhone && !staffEmail)) {
      return NextResponse.json({ error: '직원의 이름과 연락처(전화번호 또는 이메일)가 필요합니다.' }, { status: 400 })
    }

    // 입사일 검증 로직 추가 (사용자 피드백 반영)
    const hiredDateStr = staffData.hired_at
    if (!hiredDateStr) {
      return NextResponse.json({ 
        error: '입사일이 설정되지 않았습니다. 직원 정보 수정에서 입사일을 먼저 입력해주세요.' 
      }, { status: 400 })
    }
    
    const now = new Date()
    const hiredDate = new Date(hiredDateStr)

    // 스케줄 기반 계산 로직 (간소화)
    let workDaysStr = ''
    let totalWeeklyHours = 0
    let workTimeStart = ''
    let workTimeEnd = ''
    let breakTimeStart = ''
    let breakTimeEnd = ''
    
    const dayNames = ['일', '월', '화', '수', '목', '금', '토']
    const activeDays = schedules.filter(s => !s.is_holiday).sort((a, b) => a.day - b.day)
    const holidays = dayNames.filter((_, idx) => !activeDays.find(d => d.day === idx))

    if (activeDays.length > 0) {
      // 요일 문자열 생성 (예: 월요일 ~ 금요일)
      const firstDay = dayNames[activeDays[0].day]
      const lastDay = dayNames[activeDays[activeDays.length - 1].day]
      workDaysStr = activeDays.length > 1 ? `${firstDay}요일 ~ ${lastDay}요일` : `${firstDay}요일`
      
      // 첫 번째 스케줄을 기준으로 출퇴근 시간 추출
      const firstSchedule = activeDays[0]
      if (firstSchedule.start_time && firstSchedule.end_time) {
        workTimeStart = firstSchedule.start_time.substring(0, 5) // "09:00"
        workTimeEnd = firstSchedule.end_time.substring(0, 5)     // "18:00"
      }
      
      // 일 근무시간 및 주 근무시간 계산 (간소화: 첫째날 기준 * 근무일수)
      if (firstSchedule.start_time && firstSchedule.end_time) {
        const start = new Date(`1970-01-01T${firstSchedule.start_time}`)
        const end = new Date(`1970-01-01T${firstSchedule.end_time}`)
        let diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
        if (diffHours < 0) diffHours += 24
        
        // 휴게시간 차감 (DB의 break_minutes 활용, 없으면 0)
        const breakMinutes = firstSchedule.break_minutes || 0
        const breakHours = breakMinutes / 60
        const actualDailyHours = Math.max(0, diffHours - breakHours)
        
        // 휴게시간 문자열 계산
        if (breakMinutes > 0) {
            const breakStart = new Date(start.getTime() + (4 * 60 * 60 * 1000)) // 출근 후 4시간 뒤
            const breakEnd = new Date(breakStart.getTime() + (breakHours * 60 * 60 * 1000))
            breakTimeStart = `${String(breakStart.getHours()).padStart(2, '0')}:${String(breakStart.getMinutes()).padStart(2, '0')}`
            breakTimeEnd = `${String(breakEnd.getHours()).padStart(2, '0')}:${String(breakEnd.getMinutes()).padStart(2, '0')}`
        } else {
            breakTimeStart = ''
            breakTimeEnd = ''
        }

        totalWeeklyHours = actualDailyHours * activeDays.length
      }
    }

    const wageStartDayStr = store.wage_start_day === 1 ? '1' : String(store.wage_start_day || 1)
    const wageEndDayStr = store.wage_end_day === 0 ? '말' : String(store.wage_end_day || '말')

    const baseWage = staffData.base_wage || 0
    const formatter = new Intl.NumberFormat('ko-KR')

    // 3. 필드 매핑 데이터 준비 (정규직 및 아르바이트 템플릿 분기)
    let fields: Record<string, string | number> = {}

    if (isStandardTemplate) {
      // --- 표준근로계약서(정규직 등) 템플릿 필드 ---
      // 정규직: base_wage를 '월급'으로 간주
      const mealAllowance = baseWage >= 200000 ? 200000 : 0
      const basicPay = Math.max(0, baseWage - mealAllowance)
      
      const hiredDateFormatted = `${hiredDate.getFullYear()}년 ${hiredDate.getMonth() + 1}월 ${hiredDate.getDate()}일`
      
      const activeDaysNames = activeDays.map(d => dayNames[d.day]).join(', ')
      const workDaysString = activeDaysNames ? `${activeDaysNames} 주 ${activeDays.length}일` : ''
      
      const dailyWorkHours = totalWeeklyHours > 0 && activeDays.length > 0 ? (totalWeeklyHours / activeDays.length) : 0
      const workHoursString = (workTimeStart && workTimeEnd) ? `${workTimeStart} ~ ${workTimeEnd} - 총 ${dailyWorkHours}시간` : ''
      const breakTimeString = (breakTimeStart && breakTimeEnd) ? `${breakTimeStart} ~ ${breakTimeEnd}` : ''

      const baseWorkHours = Math.round((totalWeeklyHours || 40) * 4.345)
      const baseHourlyRate = baseWorkHours > 0 ? Math.round(basicPay / baseWorkHours) : 0
      
      const annualSalary = baseWage * 12

      fields = {
        [STANDARD_LABELS.COMPANY_NAME]: store.name || '',
        [STANDARD_LABELS.COMPANY_REP_NAME]: store.owner_name || '',
        [STANDARD_LABELS.COMPANY_ADDRESS]: store.address ? `${store.address} ${store.address_detail || ''}`.trim() : '',
        [STANDARD_LABELS.COMPANY_PHONE]: store.store_phone || '',
        [STANDARD_LABELS.EMPLOYEE_NAME]: staffName,
        [STANDARD_LABELS.EMPLOYEE_ID_NUMBER]: '', // DB에 없음
        [STANDARD_LABELS.EMPLOYEE_ADDRESS]: '', // 현재 상세 주소 DB 없음
        [STANDARD_LABELS.CONTRACT_PERIOD_START]: hiredDateFormatted,
        [STANDARD_LABELS.CONTRACT_PERIOD_END]: '', // 정규직의 경우 기한의 정함이 없는 경우가 많아 기본 빈칸
        [STANDARD_LABELS.INITIAL_HIRING_DATE]: hiredDateFormatted,
        [STANDARD_LABELS.SALARY_CONTRACT_PERIOD_START]: hiredDateFormatted,
        [STANDARD_LABELS.WORK_LOCATION]: store.address ? `${store.address} ${store.address_detail || ''}`.trim() : '',
        [STANDARD_LABELS.JOB_DESCRIPTION]: roleInfo?.name || '직원',
        [STANDARD_LABELS.WORK_DAYS]: workDaysString,
        [STANDARD_LABELS.WORK_HOURS]: workHoursString,
        [STANDARD_LABELS.BREAK_TIME]: breakTimeString,
        [STANDARD_LABELS.ANNUAL_SALARY]: formatter.format(annualSalary),
        [STANDARD_LABELS.BASE_PAY]: formatter.format(basicPay),
        [STANDARD_LABELS.BASE_WORK_HOURS]: baseWorkHours.toString(),
        [STANDARD_LABELS.BASE_HOURLY_RATE]: formatter.format(baseHourlyRate),
        [STANDARD_LABELS.OVERTIME_ALLOWANCE_AMOUNT]: '', // 포괄임금제 명세가 없다면 기본 빈칸
        [STANDARD_LABELS.OVERTIME_WORK_HOURS]: '',
        [STANDARD_LABELS.OVERTIME_BASIS_RATE]: '',
        [STANDARD_LABELS.MEAL_ALLOWANCE]: formatter.format(mealAllowance),
        [STANDARD_LABELS.CAR_ALLOWANCE]: '', // 기본 빈칸
        [STANDARD_LABELS.MONTHLY_TOTAL_PAY]: formatter.format(baseWage),
        [STANDARD_LABELS.INCLUDED_OVERTIME_HOURS_TOTAL]: ''
      }
    } else {
      // --- 단시간 및 기간제 근로계약서 템플릿 필드 ---
      // 기간제: base_wage를 '시급'으로 간주
      const hiredDateFormatted = `${hiredDate.getFullYear()}년 ${hiredDate.getMonth() + 1}월 ${hiredDate.getDate()}일`
      const contractDateFormatted = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`
      
      const empTypeMap: Record<string, string> = {
        'parttime': '파트타임',
        'daily': '일용직',
        'probation': '수습직',
        'contract': '계약직'
      }
      const employmentTypeStr = empTypeMap[staffData.employment_type] || '계약직'
      const dailyWorkHours = totalWeeklyHours > 0 && activeDays.length > 0 ? (totalWeeklyHours / activeDays.length) : 0
      const breakTimeString = (breakTimeStart && breakTimeEnd) ? `${breakTimeStart} ~ ${breakTimeEnd}` : ''

      fields = {
        [FIXED_TERM_LABELS.EMPLOYMENT_TYPE]: employmentTypeStr,
        [FIXED_TERM_LABELS.CONTRACT_PERIOD_START]: hiredDateFormatted,
        [FIXED_TERM_LABELS.CONTRACT_PERIOD_END]: '', // 설정된 종료일이 없다면 빈칸
        
        [FIXED_TERM_LABELS.JOB_DESCRIPTION]: roleInfo?.name || '직원',
        [FIXED_TERM_LABELS.WORK_LOCATION]: store.address ? `${store.address} ${store.address_detail || ''}`.trim() : '',
        
        [FIXED_TERM_LABELS.DAILY_WORK_HOURS]: dailyWorkHours.toString(),
        [FIXED_TERM_LABELS.WORK_START_TIME]: workTimeStart || '',
        [FIXED_TERM_LABELS.WORK_END_TIME]: workTimeEnd || '',
        [FIXED_TERM_LABELS.WEEKLY_WORK_DAYS]: activeDays.length.toString(),
        [FIXED_TERM_LABELS.BREAK_TIME_HOURS]: breakTimeString,
        
        [FIXED_TERM_LABELS.PAY_PERIOD_START]: `전월 ${store.wage_start_day || 1}일`, // 매장 급여일에 따라 다를 수 있으나 예시 양식 적용
        [FIXED_TERM_LABELS.PAY_PERIOD_END]: `당월 ${store.wage_end_day || '말'}일`, 
        [FIXED_TERM_LABELS.PAY_DAY]: `당월 ${store.pay_day || 10}일`,
        
        [FIXED_TERM_LABELS.HOURLY_WAGE]: formatter.format(baseWage),
        [FIXED_TERM_LABELS.WAGE_APPLY_START]: hiredDateFormatted,
        [FIXED_TERM_LABELS.WAGE_APPLY_END]: '', 
        [FIXED_TERM_LABELS.CONTRACT_DATE]: contractDateFormatted,
        
        // 사업자 정보
        [FIXED_TERM_LABELS.COMPANY_NAME]: store.name || '',
        [FIXED_TERM_LABELS.COMPANY_REP_NAME]: store.owner_name || '',
        [FIXED_TERM_LABELS.COMPANY_REP_PHONE]: store.store_phone || '',
        [FIXED_TERM_LABELS.COMPANY_ADDRESS]: store.address ? `${store.address} ${store.address_detail || ''}`.trim() : '',
        [FIXED_TERM_LABELS.COMPANY_SEAL]: '', // 하단 로직에서 stamp_image_url 처리 예정이나 라벨명 호환성을 위해 추가
        
        // 근로자 정보
        [FIXED_TERM_LABELS.EMPLOYEE_NAME_1]: staffName,
        [FIXED_TERM_LABELS.EMPLOYEE_NAME_2]: staffName,
        [FIXED_TERM_LABELS.EMPLOYEE_NAME_3]: staffName,
        [FIXED_TERM_LABELS.EMPLOYEE_ID_NUMBER]: '', // DB 없음
        [FIXED_TERM_LABELS.EMPLOYEE_PHONE]: staffPhone || '',
        [FIXED_TERM_LABELS.EMPLOYEE_BANK_ACCOUNT]: '', // DB 없음
        [FIXED_TERM_LABELS.EMPLOYEE_ADDRESS]: '' // 상세주소 없음
      }
    }

    if (store.stamp_image_url) {
      // 기존 owner_stamp 외에 기간제용 company_seal 라벨도 커버하도록 동일한 서명 이미지 세팅
      fields[STANDARD_LABELS.OWNER_STAMP] = store.stamp_image_url
      fields[FIXED_TERM_LABELS.COMPANY_SEAL] = store.stamp_image_url
    }

    // 4. 모두싸인 API 호출
    const title = `[${store.name || '매장'}] ${staffName} 근로계약서`
    
    // 채널 설정 적용 (근로자용)
    const sendEmail = channels?.email ?? !!staffEmail
    const sendKakao = channels?.kakao ?? false
    
    // 근로자 서명 방식
    const methodType = sendKakao && staffPhone ? 'KAKAOTALK' : 'EMAIL'
    const methodValue = methodType === 'KAKAOTALK' ? staffPhone.replace(/[^0-9]/g, '') : staffEmail

    // 사업주 정보 설정 (현재 사용자)
    const employerName = employerProfile?.full_name || store.owner_name || '대표자'
    const employerEmail = user.email || undefined
    const employerPhone = employerProfile?.phone || store.store_phone || undefined

    // 사업주 서명 방식 (이메일 우선)
    let employerMethodType: 'EMAIL' | 'KAKAOTALK' = 'EMAIL'
    let employerMethodValue = employerEmail

    if (!employerEmail && employerPhone) {
      employerMethodType = 'KAKAOTALK'
      employerMethodValue = employerPhone.replace(/[^0-9]/g, '')
    }

    if (!employerMethodValue) {
      return NextResponse.json({ error: '사업주(발송자)의 이메일 또는 전화번호 정보가 없습니다.' }, { status: 400 })
    }

    const result = await sendContract({
      templateId,
      title,
      participants: [
        {
          name: employerName,
          email: employerEmail,
          phone: employerPhone,
          role: '갑', // 템플릿의 사업주 역할 이름과 일치해야 함
          signingMethod: {
            type: employerMethodType,
            value: employerMethodValue
          }
        },
        {
          name: staffName,
          email: sendEmail && staffEmail ? staffEmail : undefined,
          phone: sendKakao && staffPhone ? staffPhone : undefined,
          role: '을', // 템플릿의 근로자 역할 이름과 일치해야 함
          signingMethod: {
            type: methodType,
            value: methodValue
          }
        }
      ],
      fields
    })

    console.log('Modusign sendContract result:', JSON.stringify(result, null, 2))

    // 5. 발송 성공 시 contract_status 업데이트
    const documentId = result?.id || result?.document?.id || result?.documentId;

    if (documentId) {
      await supabase
        .from('store_members')
        .update({
          contract_status: 'sent',
          modusign_document_id: documentId
        })
        .eq('id', staffData.id)
    } else {
      // documentId가 없는 경우 (모두싸인 API 응답 포맷에 따라 다를 수 있음)
      console.warn('Document ID not found in Modusign response:', result)
      await supabase
        .from('store_members')
        .update({ contract_status: 'sent' })
        .eq('id', staffData.id)
    }

    return NextResponse.json({ success: true, data: result })

  } catch (error: any) {
    console.error('Error sending contract:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}