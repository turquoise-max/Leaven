do $$ 
begin
    -- 주소지
    if not exists (select 1 from information_schema.columns where table_name = 'store_members' and column_name = 'address') then
        alter table public.store_members add column address text;
    end if;

    -- 생년월일 (6자리)
    if not exists (select 1 from information_schema.columns where table_name = 'store_members' and column_name = 'birth_date') then
        alter table public.store_members add column birth_date varchar(6);
    end if;

    -- 비상연락망
    if not exists (select 1 from information_schema.columns where table_name = 'store_members' and column_name = 'emergency_contact') then
        alter table public.store_members add column emergency_contact text;
    end if;

    -- 개별 임금 지급일 (1~31)
    if not exists (select 1 from information_schema.columns where table_name = 'store_members' and column_name = 'custom_pay_day') then
        alter table public.store_members add column custom_pay_day integer check (custom_pay_day between 1 and 31);
    end if;

    -- 주휴일 (0=일, 1=월, ..., 6=토)
    if not exists (select 1 from information_schema.columns where table_name = 'store_members' and column_name = 'weekly_holiday') then
        alter table public.store_members add column weekly_holiday integer check (weekly_holiday between 0 and 6);
    end if;

    -- 근로계약 종료일
    if not exists (select 1 from information_schema.columns where table_name = 'store_members' and column_name = 'contract_end_date') then
        alter table public.store_members add column contract_end_date timestamp with time zone;
    end if;

    -- 4대보험 적용 여부 (jsonb)
    if not exists (select 1 from information_schema.columns where table_name = 'store_members' and column_name = 'insurance_status') then
        alter table public.store_members add column insurance_status jsonb default '{"employment": false, "industrial": false, "national": false, "health": false}'::jsonb;
    end if;
end $$;