-- 1. 기존 Enum 타입(wage_type)에 새로운 옵션 추가 (트랜잭션 블록 밖에서 실행)
-- 이미 hourly, monthly가 있다고 가정하고 daily, yearly를 추가합니다.
ALTER TYPE wage_type ADD VALUE IF NOT EXISTS 'daily';
ALTER TYPE wage_type ADD VALUE IF NOT EXISTS 'yearly';

-- 2. employment_type 및 resigned_at 컬럼 추가
do $$ 
begin
    -- employment_type (정직원 fulltime, 아르바이트 parttime)
    if not exists (select 1 from information_schema.columns where table_name = 'store_members' and column_name = 'employment_type') then
        alter table public.store_members add column employment_type text check (employment_type in ('fulltime', 'parttime'));
        
        -- 기존 데이터를 마이그레이션 (월급이었으면 정직원, 아니면 아르바이트로 임시 설정)
        update public.store_members 
        set employment_type = case when wage_type::text = 'monthly' then 'fulltime' else 'parttime' end
        where employment_type is null;
    end if;

    -- resigned_at (퇴사 일시 - 기록 보존용)
    if not exists (select 1 from information_schema.columns where table_name = 'store_members' and column_name = 'resigned_at') then
        alter table public.store_members add column resigned_at timestamp with time zone;
    end if;
end $$;