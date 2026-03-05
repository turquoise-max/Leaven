-- 불필요한 권한 삭제 (재고, 메뉴, 매출 관련)
-- ON DELETE CASCADE가 설정되어 있다면 role_permissions 등에서도 자동 삭제됨
-- 설정되어 있지 않다면 에러가 날 수 있으므로 참조 테이블 먼저 삭제 시도

-- 1. store_role_permissions에서 삭제
DELETE FROM public.store_role_permissions
WHERE permission_code IN (
  'manage_inventory', 
  'manage_menu',
  'view_sales',
  'manage_sales'
);

-- 2. role_permissions에서 삭제
DELETE FROM public.role_permissions
WHERE permission_code IN (
  'manage_inventory', 
  'manage_menu',
  'view_sales',
  'manage_sales'
);

-- 3. permissions 테이블에서 삭제
DELETE FROM public.permissions
WHERE code IN (
  'manage_inventory', 
  'manage_menu',
  'view_sales',
  'manage_sales'
);