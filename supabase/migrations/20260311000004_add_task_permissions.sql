-- 1. Add new permissions
INSERT INTO public.permissions (code, description) VALUES
  ('view_tasks', '전체 업무 목록 조회'),
  ('manage_tasks', '업무 생성, 수정, 삭제 및 할당'),
  ('view_staff', '직원 목록 및 기본 정보 조회'),
  ('view_salary', '직원 급여 정보 조회')
ON CONFLICT (code) DO NOTHING;

-- 2. Update default role permissions (for system roles)

-- Manager: Add task management & staff viewing
INSERT INTO public.role_permissions (role, permission_code) VALUES
  ('manager', 'view_tasks'),
  ('manager', 'manage_tasks'),
  ('manager', 'view_staff'),
  ('manager', 'view_salary') -- Managers usually handle payroll or at least see rates
ON CONFLICT (role, permission_code) DO NOTHING;

-- Staff: Add viewing capabilities
INSERT INTO public.role_permissions (role, permission_code) VALUES
  ('staff', 'view_tasks'),
  ('staff', 'view_staff')
ON CONFLICT (role, permission_code) DO NOTHING;

-- Owner: Ensure owner has all permissions (including new ones)
INSERT INTO public.role_permissions (role, permission_code)
SELECT 'owner', code FROM public.permissions
WHERE code IN ('view_tasks', 'manage_tasks', 'view_staff', 'view_salary')
ON CONFLICT (role, permission_code) DO NOTHING;


-- 3. Propagate to existing store roles (store_role_permissions)

-- Function to update existing store roles with new permissions
CREATE OR REPLACE FUNCTION update_store_role_permissions() RETURNS void AS $$
DECLARE
  role_rec RECORD;
BEGIN
  -- For each existing store role
  FOR role_rec IN SELECT id, name, is_system FROM public.store_roles LOOP
    
    -- If it's a system role, add corresponding permissions
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
END;
$$ LANGUAGE plpgsql;

-- Execute update
SELECT update_store_role_permissions();

-- Drop function
DROP FUNCTION update_store_role_permissions();