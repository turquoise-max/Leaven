do $$ 
begin
    -- 직원 개별 급여/정산 설정 (jsonb)
    -- { is_custom: boolean, wage_start_day: number, wage_end_day: number, pay_day: number, pay_month: 'current' | 'next' }
    if not exists (select 1 from information_schema.columns where table_name = 'store_members' and column_name = 'custom_wage_settings') then
        alter table public.store_members add column custom_wage_settings jsonb default null;
    end if;
end $$;