import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendContract } from '@/lib/modusign/client'

export async function POST(req: Request) {
  try {
    const { storeId, staffId } = await req.json()

    if (!storeId || !staffId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. 매장 및 직원 정보, 스케줄 등 일괄 조회
    const { data: staffData, error: staffError } = await supabase
      .from('store_members')
      .select(`
        *,
        store:stores(*),
        profile:profiles(*),
        role_info:store_roles(name),
        details:staff_details(*),
        schedules:staff_work_schedules(*)
      `)
      .eq('id', staffId)
      .eq('store_id', storeId)
      .single()

    if (staffError || !staffData) {
      console.error('Staff not found:', staffError)
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
    }

    const store = staffData.store as any
    const profile = staffData.profile as any
    const roleInfo = Array.isArray(staffData.role_info) ? staffData.role_info[0] : staffData.role_info
    const details = Array.isArray(staffData.details) ? staffData.details[0] : staffData.details
    const schedules = (staffData.schedules as any[]) || []

    const isFulltime = staffData.wage_type === 'monthly'
    const templateId = isFulltime 
      ? process.env.MODUSIGN_TEMPLATE_ID_FULLTIME 
      : process.env.MODUSIGN_TEMPLATE_ID_PARTTIME

    if (!templateId) {
      console.error('Missing Modusign Template ID for', isFulltime ? 'Fulltime' : 'Parttime')
      return NextResponse.json({ error: '템플릿 ID 설정이 누락되었습니다.' }, { status: 500 })
    }

    // 직원 이름 및 연락처
    const staffName = staffData.name || profile?.full_name
    const staffPhone = staffData.phone || profile?.phone
    const staffEmail = staffData.email || profile?.email

    if (!staffName || (!staffPhone && !staffEmail)) {
      return NextResponse.json({ error: '직원의 이름과 연락처(전화번호 또는 이메일)가 필요합니다.' }, { status: 400 })
    }

    const now = new Date()
    const hiredDateStr = details?.hired_at || staffData.joined_at
    const hiredDate = hiredDateStr ? new Date(hiredDateStr) : now

    // 스케줄 기반 계산 로직 (간소화)
    let workDaysStr = ''
    let totalWeeklyHours = 0
    let workTimeStart = ''
    let workTimeEnd = ''
    let breakTimeStart = ''
    let breakTimeEnd = ''
    
    const dayNames = ['일', '월', '화', '수', '목', '금', '토']
    const activeDays = schedules.filter(s => s.is_working_day).sort((a, b) => a.day_of_week - b.day_of_week)
    const holidays = dayNames.filter((_, idx) => !activeDays.find(d => d.day_of_week === idx))

    if (activeDays.length > 0) {
      // 요일 문자열 생성 (예: 월요일 ~ 금요일)
      const firstDay = dayNames[activeDays[0].day_of_week]
      const lastDay = dayNames[activeDays[activeDays.length - 1].day_of_week]
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
        
        // 휴게시간(기본 1시간) 차감 (임시 하드코딩)
        const breakHours = 1
        const actualDailyHours = Math.max(0, diffHours - breakHours)
        
        // 휴게시간 문자열 계산
        const breakStart = new Date(start.getTime() + (4 * 60 * 60 * 1000)) // 출근 후 4시간 뒤
        const breakEnd = new Date(breakStart.getTime() + (breakHours * 60 * 60 * 1000))
        breakTimeStart = `${String(breakStart.getHours()).padStart(2, '0')}:${String(breakStart.getMinutes()).padStart(2, '0')}`
        breakTimeEnd = `${String(breakEnd.getHours()).padStart(2, '0')}:${String(breakEnd.getMinutes()).padStart(2, '0')}`

        totalWeeklyHours = actualDailyHours * activeDays.length
      }
    }

    const wageStartDayStr = store.wage_start_day === 1 ? '1' : String(store.wage_start_day || 1)
    const wageEndDayStr = store.wage_end_day === 0 ? '말' : String(store.wage_end_day || '말')

    // 급여 분리 로직 (식대 20만원)
    const totalWage = staffData.base_wage || 0
    const mealAllowance = totalWage >= 200000 ? 200000 : 0
    const basicPay = Math.max(0, totalWage - mealAllowance)
    const formatter = new Intl.NumberFormat('ko-KR')

    // 3. 필드 매핑 데이터 준비 (정규직 템플릿 기준)
    let fields: Record<string, string | number> = {
      // 도입부
      'company_name': store.name || '',
      'employee_name': staffName,
      
      // 제 1 조 (근로 형태 및 근로 기간)
      'start_year': hiredDate.getFullYear(),
      'start_month': hiredDate.getMonth() + 1,
      'start_day': hiredDate.getDate(),
      
      // 제 2 조 (담당업무 및 업무장소)
      'job_role': roleInfo?.name || '직원',
      'work_place': store.address ? `${store.address} ${store.address_detail || ''}`.trim() : '',
      
      // 제 3 조 (근로시간 및 휴일)
      'daily_work_hours': totalWeeklyHours > 0 ? totalWeeklyHours / activeDays.length : 8,
      'weekly_work_hours': totalWeeklyHours || 40,
      'work_day_start': workDaysStr.split('~')[0]?.trim() || '월요일',
      'work_day_end': workDaysStr.split('~')[1]?.trim() || '금요일',
      'work_time_start_h': workTimeStart.split(':')[0] || '09',
      'work_time_start_m': workTimeStart.split(':')[1] || '00',
      'work_time_end_h': workTimeEnd.split(':')[0] || '18',
      'work_time_end_m': workTimeEnd.split(':')[1] || '00',
      'break_time_start_h': breakTimeStart.split(':')[0] || '12',
      'break_time_start_m': breakTimeStart.split(':')[1] || '00',
      'break_time_end_h': breakTimeEnd.split(':')[0] || '13',
      'break_time_end_m': breakTimeEnd.split(':')[1] || '00',
      'work_days_per_week': activeDays.length || 5,
      'weekly_holiday': holidays.length > 0 ? holidays.join(', ') : '일요일',
      
      // 제 5 조 (임금)
      'wage_start_month': '해당',
      'wage_start_day': wageStartDayStr,
      'wage_end_month': '해당',
      'wage_end_day': wageEndDayStr,
      'pay_day': store.pay_day || 10,
      
      // 임금구성항목
      'basic_pay': formatter.format(basicPay),
      'basic_weekly_hours': totalWeeklyHours || 40,
      'basic_monthly_hours': Math.round((totalWeeklyHours || 40) * 4.345),
      'meal_allowance': formatter.format(mealAllowance),
      'total_salary': formatter.format(totalWage),
      
      // 비어있는 추가 항목 줄
      'extra_item_1_name': '',
      'extra_item_1_amount': '',
      'extra_item_1_desc': '',
      'extra_item_2_name': '',
      'extra_item_2_amount': '',
      'extra_item_2_desc': '',
      'extra_item_3_name': '',
      'extra_item_3_amount': '',
      'extra_item_3_desc': '',
      
      // 계약 작성 일자
      'contract_year': now.getFullYear(),
      'contract_month': now.getMonth() + 1,
      'contract_day': now.getDate(),
      
      // 사용자 입력란
      'company_reg_number': store.business_number || '',
      'company_address': store.address ? `${store.address} ${store.address_detail || ''}`.trim() : '',
      'company_rep_name': store.owner_name || '',
      
      // 근로자 입력란 (직원이 서명 시 직접 입력하도록 비워둠)
      'employee_birth': '',
      'employee_address': ''
    }

    if (store.stamp_image_url) {
      fields['owner_stamp'] = store.stamp_image_url
    }

    // 4. 모두싸인 API 호출
    const title = `[${store.name || '매장'}] ${staffName} 근로계약서`
    const result = await sendContract({
      templateId,
      title,
      participants: [
        {
          name: staffName,
          email: staffEmail || undefined,
          phone: staffPhone || undefined,
          role: '근로자'
        }
      ],
      fields
    })

    return NextResponse.json({ success: true, data: result })

  } catch (error: any) {
    console.error('Error sending contract:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}