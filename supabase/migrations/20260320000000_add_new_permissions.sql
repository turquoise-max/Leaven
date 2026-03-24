-- First, add the missing columns to the permissions table
ALTER TABLE public.permissions ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.permissions ADD COLUMN IF NOT EXISTS category text;

-- Add new permissions to the permissions table
INSERT INTO public.permissions (code, name, description, category) VALUES
  ('manage_roles', '역할 및 직무 관리', '매장 내 직급 및 역할별 시스템 접근 권한을 편집합니다.', '매장 및 시스템 권한'),
  ('view_attendance', '출퇴근 현황 조회', '직원들의 실시간 출퇴근 상태 및 기록부를 열람합니다.', '일정 및 근태 관리'),
  ('manage_attendance', '출퇴근 기록 관리', '출퇴근 기록 수정 요청을 승인하거나 반려합니다.', '일정 및 근태 관리'),
  ('view_leave', '휴가 및 연차 조회', '직원별 연차 사용 현황 및 휴가 캘린더를 열람합니다.', '일정 및 근태 관리'),
  ('manage_leave', '휴가 신청 승인', '직원의 휴가 신청을 승인하고 잔여 연차를 관리합니다.', '일정 및 근태 관리'),
  ('manage_payroll', '급여 정산 및 지급', '직원의 급여를 정산하고 급여 명세서를 관리합니다.', '인사 및 근로 관리')
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name, 
  description = EXCLUDED.description, 
  category = EXCLUDED.category;

-- Update existing categories to match the new Discord-like UI structure
UPDATE public.permissions SET category = '매장 및 시스템 권한' WHERE code IN ('manage_store');
UPDATE public.permissions SET category = '인사 및 근로 관리' WHERE code IN ('view_staff', 'manage_staff', 'view_salary');
UPDATE public.permissions SET category = '일정 및 근태 관리' WHERE code IN ('view_schedule', 'manage_schedule');
UPDATE public.permissions SET category = '운영 및 업무 권한' WHERE code IN ('view_tasks', 'manage_tasks', 'view_sales', 'manage_inventory', 'manage_menu');
