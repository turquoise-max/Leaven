-- ==========================================
-- Fix Infinite Recursion in store_members RLS
-- ==========================================

-- 1. Create a SECURITY DEFINER function to check membership
-- This function runs with the privileges of the creator (postgres/admin), bypassing RLS on store_members.
create or replace function public.get_my_store_role(store_id_param uuid)
returns public.member_role
language plpgsql
security definer
set search_path = public -- Secure the search path
as $$
declare
  _role public.member_role;
begin
  select role into _role
  from public.store_members
  where store_id = store_id_param
  and user_id = auth.uid();
  
  return _role;
end;
$$;

-- 2. Drop existing problematic policies on store_members
drop policy if exists "Members can view other members in the same store." on public.store_members;
drop policy if exists "Store owners can manage members." on public.store_members;
-- Note: "Users can see their own memberships." policy is fine as it doesn't query store_members recursively (uses auth.uid() = user_id)

-- 3. Create new policies using the helper function
create policy "Members can view other members in the same store."
  on public.store_members
  for select
  using (
    public.get_my_store_role(store_id) is not null
  );

create policy "Store owners can manage members."
  on public.store_members
  for all
  using (
    public.get_my_store_role(store_id) = 'owner'
  );

-- Optional: Update stores policies as well for consistency (though not strictly recursive)
-- drop policy if exists "Stores are viewable by members." on public.stores;
-- create policy "Stores are viewable by members."
--   on public.stores for select
--   using ( public.get_my_store_role(id) is not null );