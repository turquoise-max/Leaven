-- ==========================================
-- Update create_store_with_owner RPC
-- to generate invite_code automatically
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
  new_invite_code text;
begin
  -- Generate random invite code (6 chars, uppercase)
  -- Loop to ensure uniqueness
  loop
    -- Use md5 of random + timestamp to get more randomness
    new_invite_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
    
    -- Check if code already exists
    if not exists (select 1 from public.stores where invite_code = new_invite_code) then
      exit;
    end if;
  end loop;

  -- 1. Create Store with invite_code
  insert into public.stores (name, description, address, business_number, invite_code)
  values (name_param, description_param, address_param, business_number_param, new_invite_code)
  returning id into new_store_id;

  -- 2. Add current user as owner
  insert into public.store_members (store_id, user_id, role, status)
  values (new_store_id, auth.uid(), 'owner', 'active');

  return new_store_id;
end;
$$;