-- 1. Fix existing data
UPDATE public.store_members m
SET role_id = r.id
FROM public.store_roles r
WHERE m.role_id IS NULL
  AND m.store_id = r.store_id
  AND (
    (m.role = 'owner' AND r.name = '점주' AND r.is_system = true) OR
    (m.role = 'manager' AND r.name = '매니저' AND r.is_system = true) OR
    (m.role = 'staff' AND r.name = '직원' AND r.is_system = true)
  );

-- 2. Update create_store_with_owner RPC to include role_id
CREATE OR REPLACE FUNCTION public.create_store_with_owner(
  name_param text,
  description_param text,
  address_param text,
  business_number_param text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_store_id uuid;
  new_invite_code text;
  owner_role_id uuid;
BEGIN
  -- Generate random invite code (6 chars, uppercase)
  -- Loop to ensure uniqueness
  LOOP
    -- Use md5 of random + timestamp to get more randomness
    new_invite_code := upper(substring(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 6));

    -- Check if code already exists
    IF NOT EXISTS (SELECT 1 FROM public.stores WHERE invite_code = new_invite_code) THEN
      EXIT;
    END IF;
  END LOOP;

  -- 1. Create Store with invite_code
  -- This will trigger handle_new_store_roles() and create default roles
  INSERT INTO public.stores (name, description, address, business_number, invite_code)
  VALUES (name_param, description_param, address_param, business_number_param, new_invite_code)
  RETURNING id INTO new_store_id;

  -- Get the owner role id created by the trigger
  SELECT id INTO owner_role_id
  FROM public.store_roles
  WHERE store_id = new_store_id AND name = '점주' AND is_system = true
  LIMIT 1;

  -- 2. Add current user as owner
  INSERT INTO public.store_members (store_id, user_id, role, role_id, status)
  VALUES (new_store_id, auth.uid(), 'owner', owner_role_id, 'active');

  RETURN new_store_id;
END;
$$;