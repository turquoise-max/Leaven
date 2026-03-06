-- Add memo and work_schedules columns to store_members table

do $$ 
begin
    -- memo column
    if not exists (select 1 from information_schema.columns where table_name = 'store_members' and column_name = 'memo') then
        alter table public.store_members add column memo text;
    end if;

    -- work_schedules column
    if not exists (select 1 from information_schema.columns where table_name = 'store_members' and column_name = 'work_schedules') then
        alter table public.store_members add column work_schedules jsonb default '[]'::jsonb;
    end if;
end $$;

comment on column public.store_members.memo is 'Staff memo or introduction';
comment on column public.store_members.work_schedules is 'Array of work schedules: [{ day: number (0-6), start_time: "HH:MM", end_time: "HH:MM", break_minutes: number, is_holiday: boolean }]';