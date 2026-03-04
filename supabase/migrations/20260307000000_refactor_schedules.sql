-- 1. Create schedule_members table
create table public.schedule_members (
  id uuid default gen_random_uuid() primary key,
  schedule_id uuid references public.schedules(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Prevent duplicate members in same schedule
  unique(schedule_id, user_id)
);

-- 2. Migrate existing data (if user_id column exists)
do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'schedules' and column_name = 'user_id') then
    insert into public.schedule_members (schedule_id, user_id, created_at)
    select id, user_id, created_at
    from public.schedules;
  end if;
end $$;

-- 3. Remove user_id from schedules (if exists)
do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'schedules' and column_name = 'user_id') then
    alter table public.schedules drop column user_id;
  end if;
end $$;

-- 4. Enable RLS for schedule_members
alter table public.schedule_members enable row level security;

-- Policy for schedule_members
create policy "Members can view schedule members in their store."
  on public.schedule_members
  for select
  using (
    exists (
      select 1 from public.schedules s
      where s.id = schedule_members.schedule_id
      and public.get_my_store_role(s.store_id) is not null
    )
  );
  
create policy "Managers and Owners can manage schedule members."
  on public.schedule_members
  for all
  using (
    exists (
      select 1 from public.schedules s
      where s.id = schedule_members.schedule_id
      and public.get_my_store_role(s.store_id) in ('owner', 'manager')
    )
  );