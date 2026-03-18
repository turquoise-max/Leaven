/**
 * 모두싸인 템플릿(정규직/계약직) 데이터 라벨 매핑 정보
 * 템플릿 양식의 라벨명(Data Label)이 변경될 경우 이곳의 값(문자열)을 수정하면 됩니다.
 */
export const STANDARD_LABELS = {
  COMPANY_NAME: 'company_name',
  COMPANY_REP_NAME: 'company_rep_name',
  COMPANY_ADDRESS: 'company_address',
  COMPANY_PHONE: 'company_phone',
  EMPLOYEE_NAME: 'employee_name',
  EMPLOYEE_ID_NUMBER: 'employee_id_number',
  EMPLOYEE_ADDRESS: 'employee_address',
  CONTRACT_PERIOD_START: 'contract_period_start',
  CONTRACT_PERIOD_END: 'contract_period_end',
  INITIAL_HIRING_DATE: 'initial_hiring_date',
  SALARY_CONTRACT_PERIOD_START: 'salary_contract_period_start',
  WORK_LOCATION: 'work_location',
  JOB_DESCRIPTION: 'job_description',
  WORK_DAYS: 'work_days',
  WORK_HOURS: 'work_hours',
  BREAK_TIME: 'break_time',
  ANNUAL_SALARY: 'annual_salary',
  BASE_PAY: 'base_pay_amt',
  BASE_WORK_HOURS: 'base_work_hours',
  BASE_HOURLY_RATE: 'base_hourly_rate',
  OVERTIME_ALLOWANCE_AMOUNT: 'ot_allowance_amt',
  OVERTIME_WORK_HOURS: 'ot_work_hours',
  OVERTIME_BASIS_RATE: 'ot_basis_rate',
  MEAL_ALLOWANCE: 'meal_allowance',
  CAR_ALLOWANCE: 'car_allowance',
  MONTHLY_TOTAL_PAY: 'monthly_total_pay',
  INCLUDED_OVERTIME_HOURS_TOTAL: 'included_overtime_hours_total',
  OWNER_STAMP: 'owner_stamp', // 하단 서명/직인 처리
} as const;

/**
 * 모두싸인 템플릿(파트타임/기간제) 데이터 라벨 매핑 정보
 * 템플릿 양식의 라벨명(Data Label)이 변경될 경우 이곳의 값(문자열)을 수정하면 됩니다.
 */
export const FIXED_TERM_LABELS = {
  EMPLOYMENT_TYPE: 'employment_type',
  CONTRACT_PERIOD_START: 'contract_period_start',
  CONTRACT_PERIOD_END: 'contract_period_end',
  JOB_DESCRIPTION: 'job_description',
  WORK_LOCATION: 'work_location',
  DAILY_WORK_HOURS: 'daily_work_hours',
  WORK_START_TIME: 'work_start_time',
  WORK_END_TIME: 'work_end_time',
  WEEKLY_WORK_DAYS: 'weekly_work_days',
  BREAK_TIME_HOURS: 'break_time_hours',
  PAY_PERIOD_START: 'pay_period_start',
  PAY_PERIOD_END: 'pay_period_end',
  PAY_DAY: 'pay_day',
  HOURLY_WAGE: 'hourly_wage',
  WAGE_APPLY_START: 'wage_apply_start',
  WAGE_APPLY_END: 'wage_apply_end',
  CONTRACT_DATE: 'contract_date',
  COMPANY_NAME: 'company_name',
  COMPANY_REP_NAME: 'company_rep_name',
  COMPANY_REP_PHONE: 'company_rep_phone',
  COMPANY_ADDRESS: 'company_address',
  COMPANY_SEAL: 'company_seal',
  EMPLOYEE_NAME_1: 'employee_name_1',
  EMPLOYEE_NAME_2: 'employee_name_2',
  EMPLOYEE_NAME_3: 'employee_name_3',
  EMPLOYEE_ID_NUMBER: 'employee_id_number',
  EMPLOYEE_PHONE: 'employee_phone',
  EMPLOYEE_BANK_ACCOUNT: 'employee_bank_account',
  EMPLOYEE_ADDRESS: 'employee_address',
  OWNER_STAMP: 'owner_stamp', // 하단 서명/직인 처리
} as const;