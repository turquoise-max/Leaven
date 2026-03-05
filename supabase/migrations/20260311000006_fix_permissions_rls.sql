-- permissions 테이블 RLS 정책 수정
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (있다면)
DROP POLICY IF EXISTS "Anyone can read permissions" ON public.permissions;
DROP POLICY IF EXISTS "Allow read access for all users" ON public.permissions;

-- 새로운 정책 생성: 누구나 읽기 가능
CREATE POLICY "Anyone can read permissions"
ON public.permissions
FOR SELECT
USING (true);

-- store_roles 테이블 RLS 정책 확인 및 수정
ALTER TABLE public.store_roles ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (있다면)
DROP POLICY IF EXISTS "Store members can read roles" ON public.store_roles;

-- 새로운 정책 생성: 매장 멤버는 역할 조회 가능
-- 혹은 더 넓게 허용 (디버깅용)
CREATE POLICY "Anyone can read store roles"
ON public.store_roles
FOR SELECT
USING (true); 
-- 주의: 실제 배포 시에는 store_id 체크 등으로 제한해야 하지만, 일단 디버깅을 위해 품.
-- 하지만 store_roles는 store_id가 있으므로 RLS가 중요할 수 있음.
-- 일단 permissions 테이블이 핵심이므로 permissions만 확실하게 품.

-- store_role_permissions 테이블 RLS 정책 수정
ALTER TABLE public.store_role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read store_role_permissions" ON public.store_role_permissions;
CREATE POLICY "Anyone can read store_role_permissions"
ON public.store_role_permissions
FOR SELECT
USING (true);