-- 권한 데이터 재입력 (누락된 권한 추가)
INSERT INTO public.permissions (code, description) VALUES
  ('view_tasks', '업무 조회'),
  ('manage_tasks', '업무 관리'),
  ('view_staff', '직원 조회'),
  ('view_salary', '급여 조회')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

-- 기본 역할 권한 매핑 업데이트 (시스템 역할)

-- Manager: 업무/직원 관리 권한 추가
INSERT INTO public.role_permissions (role, permission_code) VALUES
  ('manager', 'view_tasks'),
  ('manager', 'manage_tasks'),
  ('manager', 'view_staff'),
  ('manager', 'view_salary')
ON CONFLICT (role, permission_code) DO NOTHING;

-- Staff: 조회 권한 추가
INSERT INTO public.role_permissions (role, permission_code) VALUES
  ('staff', 'view_tasks'),
  ('staff', 'view_staff')
ON CONFLICT (role, permission_code) DO NOTHING;

-- Owner: 모든 권한 보장
INSERT INTO public.role_permissions (role, permission_code)
SELECT 'owner', code FROM public.permissions
WHERE code IN ('view_tasks', 'manage_tasks', 'view_staff', 'view_salary')
ON CONFLICT (role, permission_code) DO NOTHING;

-- 기존 매장 역할에 권한 전파 (함수 재사용)
DO $$
DECLARE
  role_rec RECORD;
BEGIN
  -- For each existing store role
  FOR role_rec IN SELECT id, name, is_system FROM public.store_roles LOOP
    
    IF role_rec.is_system THEN
      IF role_rec.name = '점주' THEN
        INSERT INTO public.store_role_permissions (role_id, permission_code)
        SELECT role_rec.id, code FROM public.permissions
        WHERE code IN ('view_tasks', 'manage_tasks', 'view_staff', 'view_salary')
        ON CONFLICT DO NOTHING;
        
      ELSIF role_rec.name = '매니저' THEN
        INSERT INTO public.store_role_permissions (role_id, permission_code)
        VALUES 
          (role_rec.id, 'view_tasks'),
          (role_rec.id, 'manage_tasks'),
          (role_rec.id, 'view_staff'),
          (role_rec.id, 'view_salary')
        ON CONFLICT DO NOTHING;
        
      ELSIF role_rec.name = '직원' THEN
        INSERT INTO public.store_role_permissions (role_id, permission_code)
        VALUES 
          (role_rec.id, 'view_tasks'),
          (role_rec.id, 'view_staff')
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
    
  END LOOP;
END $$;