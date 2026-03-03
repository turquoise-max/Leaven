-- ==========================================
-- Update Stores RLS to use SECURITY DEFINER function
-- This prevents infinite recursion when querying stores join store_members
-- ==========================================

-- 1. Ensure helper function exists and is SECURITY DEFINER
create or replace function public.get_my_store_role(store_id_param uuid)
returns public.member_role
language plpgsql
security definer
set search_path = public
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

-- 2. Update stores policy to use the helper function
drop policy if exists "Stores are viewable by members." on public.stores;

create policy "Stores are viewable by members."
  on public.stores
  for select
  using (
    public.get_my_store_role(id) is not null
  );