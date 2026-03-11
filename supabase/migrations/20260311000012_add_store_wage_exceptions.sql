-- 고용 형태별 급여 정산 예외 설정을 저장하기 위한 JSONB 컬럼 추가
ALTER TABLE stores ADD COLUMN IF NOT EXISTS wage_exceptions JSONB DEFAULT '{}'::jsonb;