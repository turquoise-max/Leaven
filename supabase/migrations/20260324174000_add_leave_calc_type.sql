-- 매장 설정에 연차 계산 기준 필드 추가
ALTER TABLE stores ADD COLUMN IF NOT EXISTS leave_calc_type text NOT NULL DEFAULT 'hire_date' CHECK (leave_calc_type IN ('hire_date', 'fiscal_year'));

COMMENT ON COLUMN stores.leave_calc_type IS '연차 발생 기준 (hire_date: 입사일, fiscal_year: 회계연도)';