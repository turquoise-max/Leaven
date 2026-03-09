-- 디버깅용으로 풀려있던 store_roles 및 store_role_permissions 테이블의 RLS(조회 권한)를 다시 제한합니다.

-- 1. store_roles 정책 제한
DROP POLICY IF EXISTS "Anyone can read store roles" ON public.store_roles;

CREATE POLICY "Members can view store roles"
ON public.store_roles
FOR SELECT
USING (
  public.get_my_store_role(store_id) IS NOT NULL
);

-- 2. store_role_permissions 정책 제한
-- store_role_permissions에는 store_id가 직접 없고 role_id가 있으므로 
-- JOIN이나 EXISTS를 통해 연결된 store_roles의 store_id를 검사해야 합니다.
DROP POLICY IF EXISTS "Anyone can read store_role_permissions" ON public.store_role_permissions;

CREATE POLICY "Members can view store role permissions"
ON public.store_role_permissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.store_roles sr
    WHERE sr.id = store_role_permissions.role_id
    AND public.get_my_store_role(sr.store_id) IS NOT NULL
  )
);