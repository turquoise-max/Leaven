-- ==========================================
-- 1. Add wage info to store_members
-- ==========================================
create type public.wage_type as enum ('hourly', 'monthly');

alter table public.store_members
add column wage_type public.wage_type default 'hourly',
add column base_wage integer default 0;

-- ==========================================
-- 2. Schedules Table
-- ==========================================
create table public.schedules (
  id uuid default gen_random_uuid() primary key,
  store_id uuid references public.stores(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  memo text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Ensure end_time is after start_time
  constraint schedules_time_check check (end_time > start_time)
);

-- RLS for Schedules
alter table public.schedules enable row level security;

-- Policy: Members can view schedules in their store
create policy "Members can view schedules in their store."
  on public.schedules
  for select
  using (
    public.get_my_store_role(store_id) is not null
  );

-- Policy: Managers and Owners can manage schedules
create policy "Managers and Owners can manage schedules."
  on public.schedules
  for all
  using (
    public.get_my_store_role(store_id) in ('owner', 'manager')
  );