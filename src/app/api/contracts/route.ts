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

    // 급여 분리 로직 (식대 20만원)
    const totalWage = staffData.base_wage || 0
    const mealAllowance = totalWage >= 200000 ? 200000 : 0
    const basicPay = Math.max(0, totalWage - mealAllowance)
    const formatter = new Intl.NumberFormat('ko-KR')

    // 3. 필드 매핑 데이터 준비 (정규직 및 아르바이트 템플릿 분기)
    let fields: Record<string, string | number> = {}

    if (isFulltime) {
      // --- 정규직용 템플릿 필드 ---
      fields = {
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
    } else {
      // --- 아르바이트용 템플릿 필드 ---
      fields = {
        // 도입부
        'employer_name_1': store.owner_name || '',
        'employee_name_1': staffName,
        
        // 제 1 조 (근로 형태 및 근로 기간)
        'start_year': hiredDate.getFullYear(),
        'start_month': hiredDate.getMonth() + 1,
        'start_day': hiredDate.getDate(),
        
        // 업무장소 및 내용
        'work_place': store.address ? `${store.address} ${store.address_detail || ''}`.trim() : '',
        'job_role': roleInfo?.name || '직원',
        
        // 주휴일
        'weekly_holiday': holidays.length > 0 ? holidays.join(', ') : '일요일',
        
        // 제 5~7조 임금 및 사회보험
        'wage_amount': formatter.format(totalWage),
        'chk_bonus_no': 'O', // 상여금 없음 기본
        'chk_bonus_yes': '',
        'bonus_amount': '',
        'chk_extra_no': 'O', // 기타급여 없음 기본
        'chk_extra_yes': '',
        'extra_wage_amount': '',
        'overtime_rate': '50', // 가산임금률 기본 50%
        
        'pay_day': store.pay_day || 10,
        'chk_pay_bank': 'O', // 통장입금 기본
        'chk_pay_direct': '',
        
        // 사회보험 (주 15시간 이상일 경우 4대보험, 아닐 경우 고용/산재만)
        'chk_insure_emp': 'O',
        'chk_insure_ind': 'O',
        'chk_insure_nat': totalWeeklyHours >= 15 ? 'O' : '',
        'chk_insure_health': totalWeeklyHours >= 15 ? 'O' : '',
        
        // 서명란 (2페이지)
        'contract_year': now.getFullYear(),
        'contract_month': now.getMonth() + 1,
        'contract_day': now.getDate(),
        
        // (사업주) 영역
        'employer_company_name': store.name || '',
        'employer_phone': store.store_phone || '',
        'employer_address': store.address ? `${store.address} ${store.address_detail || ''}`.trim() : '',
        'employer_name_2': store.owner_name || '',
        
        // (근로자) 영역
        'employee_address': '',
        'employee_phone': '',
        'employee_name_2': ''
      }

      // 제 4조 근로일 및 근로일별 근로시간 표 처리 (day1 ~ day6)
      activeDays.slice(0, 6).forEach((schedule, idx) => {
        const index = idx + 1;
        fields[`day${index}_name`] = dayNames[schedule.day] + '요일';
        
        if (schedule.start_time && schedule.end_time) {
          const start = new Date(`1970-01-01T${schedule.start_time}`);
          const end = new Date(`1970-01-01T${schedule.end_time}`);
          let diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          if (diffHours < 0) diffHours += 24;
          
          const breakMinutes = schedule.break_minutes || 0;
          const breakHours = breakMinutes / 60;
          const actualHours = Math.max(0, diffHours - breakHours);
          
          fields[`day${index}_hours`] = actualHours;
          fields[`day${index}_start_h`] = schedule.start_time.split(':')[0];
          fields[`day${index}_start_m`] = schedule.start_time.split(':')[1];
          fields[`day${index}_end_h`] = schedule.end_time.split(':')[0];
          fields[`day${index}_end_m`] = schedule.end_time.split(':')[1];
          
          if (breakMinutes > 0) {
            const breakStart = new Date(start.getTime() + (4 * 60 * 60 * 1000));
            const breakEnd = new Date(breakStart.getTime() + (breakHours * 60 * 60 * 1000));
            fields[`day${index}_break_start_h`] = String(breakStart.getHours()).padStart(2, '0');
            fields[`day${index}_break_start_m`] = String(breakStart.getMinutes()).padStart(2, '0');
            fields[`day${index}_break_end_h`] = String(breakEnd.getHours()).padStart(2, '0');
            fields[`day${index}_break_end_m`] = String(breakEnd.getMinutes()).padStart(2, '0');
          } else {
            fields[`day${index}_break_start_h`] = '';
            fields[`day${index}_break_start_m`] = '';
            fields[`day${index}_break_end_h`] = '';
            fields[`day${index}_break_end_m`] = '';
          }
        }
      });

      // 남은 빈칸 지우기 (최대 6칸까지)
      for (let i = activeDays.length + 1; i <= 6; i++) {
        fields[`day${i}_name`] = '';
        fields[`day${i}_hours`] = '';
        fields[`day${i}_start_h`] = '';
        fields[`day${i}_start_m`] = '';
        fields[`day${i}_end_h`] = '';
        fields[`day${i}_end_m`] = '';
        fields[`day${i}_break_start_h`] = '';
        fields[`day${i}_break_start_m`] = '';
        fields[`day${i}_break_end_h`] = '';
        fields[`day${i}_break_end_m`] = '';
      }
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