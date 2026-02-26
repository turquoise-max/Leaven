-- ==========================================
-- RPC to create store and assign owner in one transaction
-- ==========================================
create or replace function public.create_store_with_owner(
  name_param text,
  description_param text,
  address_param text,
  business_number_param text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_store_id uuid;
begin
  -- 1. Create Store
  insert into public.stores (name, description, address, business_number)
  values (name_param, description_param, address_param, business_number_param)
  returning id into new_store_id;

  -- 2. Add current user as owner
  insert into public.store_members (store_id, user_id, role, status)
  values (new_store_id, auth.uid(), 'owner', 'active');

  return new_store_id;
end;
$$;