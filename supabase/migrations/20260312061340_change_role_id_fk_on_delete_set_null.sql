-- 기존 store_members_role_id_fkey 외래 키 제거 후 ON DELETE SET NULL 로 다시 생성
ALTER TABLE public.store_members
  DROP CONSTRAINT IF EXISTS store_members_role_id_fkey;

ALTER TABLE public.store_members
  ADD CONSTRAINT store_members_role_id_fkey
  FOREIGN KEY (role_id)
  REFERENCES public.store_roles(id)
  ON DELETE SET NULL;