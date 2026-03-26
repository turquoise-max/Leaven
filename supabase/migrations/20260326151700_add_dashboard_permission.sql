-- Add 'view_dashboard' permission to permissions table
INSERT INTO public.permissions (code, name, description, category) 
VALUES ('view_dashboard', '홈 대시보드 접근', '로그인 후 첫 화면인 홈 대시보드 페이지에 접근할 수 있습니다.', '매장 및 시스템 권한')
ON CONFLICT (code) DO NOTHING;

-- Grant 'view_dashboard' to all system default roles (owner, manager, staff)
INSERT INTO public.role_permissions (role, permission_code)
VALUES 
  ('owner', 'view_dashboard'),
  ('manager', 'view_dashboard'),
  ('staff', 'view_dashboard')
ON CONFLICT (role, permission_code) DO NOTHING;

-- Grant 'view_dashboard' to all existing roles in store_role_permissions
-- (Since dashboard is the main entry point, it makes sense for existing roles to have it by default)
INSERT INTO public.store_role_permissions (role_id, permission_code)
SELECT id, 'view_dashboard' FROM public.store_roles
ON CONFLICT (role_id, permission_code) DO NOTHING;