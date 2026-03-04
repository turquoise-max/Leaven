-- 1. Create store_roles table
CREATE TABLE public.store_roles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  color text DEFAULT '#808080',
  is_system boolean DEFAULT false,
  priority int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.store_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Roles are viewable by store members."
  ON public.store_roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.store_members
      WHERE store_members.store_id = store_roles.store_id
      AND store_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Roles are manageable by store managers/owners."
  ON public.store_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.store_members
      WHERE store_members.store_id = store_roles.store_id
      AND store_members.user_id = auth.uid()
      AND (store_members.role = 'owner' OR store_members.role = 'manager')
    )
  );

-- 2. Create store_role_permissions table
CREATE TABLE public.store_role_permissions (
  role_id uuid REFERENCES public.store_roles(id) ON DELETE CASCADE NOT NULL,
  permission_code text REFERENCES public.permissions(code) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (role_id, permission_code)
);

-- RLS
ALTER TABLE public.store_role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Role permissions are viewable by store members."
  ON public.store_role_permissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.store_roles
      JOIN public.store_members ON store_members.store_id = store_roles.store_id
      WHERE store_roles.id = store_role_permissions.role_id
      AND store_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Role permissions are manageable by store managers/owners."
  ON public.store_role_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.store_roles
      JOIN public.store_members ON store_members.store_id = store_roles.store_id
      WHERE store_roles.id = store_role_permissions.role_id
      AND store_members.user_id = auth.uid()
      AND (store_members.role = 'owner' OR store_members.role = 'manager')
    )
  );

-- 3. Add role_id to store_members
ALTER TABLE public.store_members ADD COLUMN role_id uuid REFERENCES public.store_roles(id);

-- 4. Migration Function
CREATE OR REPLACE FUNCTION migrate_roles_for_existing_stores() RETURNS void AS $$
DECLARE
  store_rec RECORD;
  owner_role_id uuid;
  manager_role_id uuid;
  staff_role_id uuid;
BEGIN
  FOR store_rec IN SELECT id FROM public.stores LOOP
    -- Check if roles already exist (to allow re-running safely)
    IF NOT EXISTS (SELECT 1 FROM public.store_roles WHERE store_id = store_rec.id AND name = '점주') THEN
      
      -- Create Owner Role
      INSERT INTO public.store_roles (store_id, name, color, is_system, priority)
      VALUES (store_rec.id, '점주', '#FFD700', true, 100)
      RETURNING id INTO owner_role_id;
      
      -- Grant All Permissions to Owner
      INSERT INTO public.store_role_permissions (role_id, permission_code)
      SELECT owner_role_id, code FROM public.permissions;
      
      -- Create Manager Role
      INSERT INTO public.store_roles (store_id, name, color, is_system, priority)
      VALUES (store_rec.id, '매니저', '#4169E1', true, 50)
      RETURNING id INTO manager_role_id;
      
      -- Grant Manager Permissions
      INSERT INTO public.store_role_permissions (role_id, permission_code)
      SELECT manager_role_id, permission_code FROM public.role_permissions WHERE role = 'manager';
      
      -- Create Staff Role
      INSERT INTO public.store_roles (store_id, name, color, is_system, priority)
      VALUES (store_rec.id, '직원', '#808080', true, 0)
      RETURNING id INTO staff_role_id;
      
      -- Grant Staff Permissions
      INSERT INTO public.store_role_permissions (role_id, permission_code)
      SELECT staff_role_id, permission_code FROM public.role_permissions WHERE role = 'staff';
      
      -- Update Members
      UPDATE public.store_members SET role_id = owner_role_id WHERE store_id = store_rec.id AND role = 'owner';
      UPDATE public.store_members SET role_id = manager_role_id WHERE store_id = store_rec.id AND role = 'manager';
      UPDATE public.store_members SET role_id = staff_role_id WHERE store_id = store_rec.id AND role = 'staff';
      
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute migration
SELECT migrate_roles_for_existing_stores();

-- Drop function
DROP FUNCTION migrate_roles_for_existing_stores();

-- 5. Trigger for New Stores (Automatically create default roles)
CREATE OR REPLACE FUNCTION handle_new_store_roles()
RETURNS TRIGGER AS $$
DECLARE
  owner_role_id uuid;
  manager_role_id uuid;
  staff_role_id uuid;
BEGIN
  -- Create Owner Role
  INSERT INTO public.store_roles (store_id, name, color, is_system, priority)
  VALUES (NEW.id, '점주', '#FFD700', true, 100)
  RETURNING id INTO owner_role_id;
  
  -- Create Manager Role
  INSERT INTO public.store_roles (store_id, name, color, is_system, priority)
  VALUES (NEW.id, '매니저', '#4169E1', true, 50)
  RETURNING id INTO manager_role_id;
  
  -- Create Staff Role
  INSERT INTO public.store_roles (store_id, name, color, is_system, priority)
  VALUES (NEW.id, '직원', '#808080', true, 0)
  RETURNING id INTO staff_role_id;
  
  -- Assign Permissions
  INSERT INTO public.store_role_permissions (role_id, permission_code)
  SELECT owner_role_id, code FROM public.permissions;

  INSERT INTO public.store_role_permissions (role_id, permission_code)
  SELECT manager_role_id, permission_code FROM public.role_permissions WHERE role = 'manager';

  INSERT INTO public.store_role_permissions (role_id, permission_code)
  SELECT staff_role_id, permission_code FROM public.role_permissions WHERE role = 'staff';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists (re-create)
DROP TRIGGER IF EXISTS on_store_created_roles ON public.stores;

CREATE TRIGGER on_store_created_roles
  AFTER INSERT ON public.stores
  FOR EACH ROW EXECUTE FUNCTION handle_new_store_roles();