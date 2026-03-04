do $$ 
begin
    -- work_hours
    if not exists (select 1 from information_schema.columns where table_name = 'store_members' and column_name = 'work_hours') then
        alter table public.store_members add column work_hours text;
    end if;

    -- wage_type
    if not exists (select 1 from information_schema.columns where table_name = 'store_members' and column_name = 'wage_type') then
        alter table public.store_members add column wage_type text check (wage_type in ('hourly', 'monthly'));
    end if;

    -- base_wage
    if not exists (select 1 from information_schema.columns where table_name = 'store_members' and column_name = 'base_wage') then
        alter table public.store_members add column base_wage numeric;
    end if;

    -- hired_at
    if not exists (select 1 from information_schema.columns where table_name = 'store_members' and column_name = 'hired_at') then
        alter table public.store_members add column hired_at timestamp with time zone;
    end if;
end $$;