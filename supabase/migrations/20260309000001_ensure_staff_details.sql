-- work_hours, hired_at 컬럼을 확실하게 추가
alter table public.store_members
add column if not exists work_hours text,
add column if not exists hired_at timestamp with time zone;

-- wage_type, base_wage는 이미 존재한다고 가정하고, 체크 제약조건 등은 건드리지 않음
-- (필요하다면 별도 마이그레이션으로 처리)