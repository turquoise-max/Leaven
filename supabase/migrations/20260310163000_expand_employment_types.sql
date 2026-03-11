-- employment_type의 제약 조건을 확장하여 'contract', 'probation', 'daily' 추가
DO $$
DECLARE
    const_name text;
BEGIN
    -- 기존 제약 조건 이름 찾기
    SELECT constraint_name INTO const_name
    FROM information_schema.constraint_column_usage
    WHERE table_name = 'store_members' AND column_name = 'employment_type';

    -- 제약 조건이 존재하면 삭제
    IF const_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE store_members DROP CONSTRAINT ' || const_name;
    END IF;
END $$;

-- 새로운 제약 조건 추가
ALTER TABLE store_members ADD CONSTRAINT store_members_employment_type_check 
CHECK (employment_type IN ('fulltime', 'parttime', 'contract', 'probation', 'daily'));