-- ==========================================
-- Migration to fix store owner names
-- 1. Update existing empty names for owners
-- 2. Update create_store_with_owner RPC
-- ==========================================

-- 1. Fix existing owner names
UPDATE public.store_members sm
SET name = COALESCE(p.full_name, '점주')
FROM public.profiles p
WHERE sm.user_id = p.id
AND sm.role = 'owner'
AND (sm.name IS NULL OR sm.name = '');

-- 2. Update RPC to accept owner_name_param
CREATE OR REPLACE FUNCTION public.create_store_with_owner(
  name_param text,
  description_param text,
  address_param text,
  business_number_param text,
  owner_name_param text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_store_id uuid;
  new_invite_code text;
  final_owner_name text;
BEGIN
  -- Generate random invite code (6 chars, uppercase)
  LOOP
    new_invite_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
    
    IF NOT EXISTS (SELEC    IF NOT EXISTS (SELEC    IF NOT EXISTS (Sew_invite_code) THEN
      EXIT;
    END    END    END    END    END    END    END vi    END    END    END    END    END    me    END    END    END    END    END    , invite    END    END    END    EN, description_param, address_param,    END    END    END    END    END    EN  RETURNING id INTO new_s    END    END    ENDine    END    END    ENer_name_param IS NULL THEN
    SELECT full_name INTO final_owner_name FROM public.profiles WHERE id = auth.uid();
    IF final_owner_name IS NULL THEN
      final_owner_name := '점주';
    END IF;
  ELSE
    final_owner_name := owner_name_param;
  END IF;

  -- Add current user as owner
  INSERT INTO public.store_members (store_id, user_id, role, status, name)
  VALUES (new_store_id, auth.uid(), 'owner', 'active', final_owner_name);

  RETURN new_store_id;
END;
$$;
