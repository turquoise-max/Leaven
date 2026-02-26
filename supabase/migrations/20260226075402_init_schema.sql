-- Enable UUID extension (Not strictly needed if using gen_random_uuid() in PG13+)
create extension if not exists "uuid-ossp";

-- ==========================================
-- 1. Profiles Table (Extends auth.users)
-- ==========================================
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  avatar_url text,
  role text default 'user', -- 'user' or 'admin' (platform admin)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Profiles
alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- Trigger to create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ==========================================
-- 2. Stores Table (Schema only)
-- ==========================================
create table public.stores (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  address text,
  business_number text, -- optional for now
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.stores enable row level security;


-- ==========================================
-- 3. Store Members Table (Schema only)
-- ==========================================
create type public.member_role as enum ('owner', 'manager', 'staff');
create type public.member_status as enum ('active', 'invited', 'pending_approval');

create table public.store_members (
  id uuid default gen_random_uuid() primary key,
  store_id uuid references public.stores(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role public.member_role not null default 'staff',
  status public.member_status not null default 'pending_approval',
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(store_id, user_id)
);

alter table public.store_members enable row level security;


-- ==========================================
-- 4. Policies for Stores
-- ==========================================
create policy "Stores are viewable by members."
  on stores for select
  using ( 
    exists (
      select 1 from public.store_members
      where store_members.store_id = stores.id
      and store_members.user_id = auth.uid()
    )
  );
  
create policy "Anyone can create a store."
  on stores for insert
  with check ( true ); -- Creating a store is open, membership is handled separately

create policy "Store owners can update store details."
  on stores for update
  using (
    exists (
      select 1 from public.store_members
      where store_members.store_id = stores.id
      and store_members.user_id = auth.uid()
      and store_members.role = 'owner'
    )
  );


-- ==========================================
-- 5. Policies for Store Members
-- ==========================================
create policy "Members can view other members in the same store."
  on store_members for select
  using (
    exists (
      select 1 from public.store_members as my_membership
      where my_membership.store_id = store_members.store_id
      and my_membership.user_id = auth.uid()
    )
  );
  
create policy "Store owners can manage members."
  on store_members for all
  using (
    exists (
      select 1 from public.store_members as my_membership
      where my_membership.store_id = store_members.store_id
      and my_membership.user_id = auth.uid()
      and my_membership.role = 'owner'
    )
  );

create policy "Users can see their own memberships."
  on store_members for select
  using ( auth.uid() = user_id );