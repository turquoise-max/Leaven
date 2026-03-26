-- Drop the old policies for tasks
DROP POLICY IF EXISTS "Tasks are manageable by store managers and owners" ON public.tasks;

-- Drop the old policies for task_assignments
DROP POLICY IF EXISTS "Task assignments are manageable by store managers and owners" ON public.task_assignments;
DROP POLICY IF EXISTS "Task assignments are updatable by store managers and owners" ON public.task_assignments;
DROP POLICY IF EXISTS "Task assignments are deletable by store managers and owners" ON public.task_assignments;

-- Create new policies for tasks that check custom role permissions
CREATE POLICY "Tasks are manageable by store managers and owners" ON public.tasks
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.store_members sm
            LEFT JOIN public.store_role_permissions srp ON sm.role_id = srp.role_id AND srp.permission_code = 'manage_tasks'
            LEFT JOIN public.role_permissions rp ON sm.role = rp.role AND rp.permission_code = 'manage_tasks'
            WHERE sm.store_id = tasks.store_id
            AND sm.user_id = auth.uid()
            AND sm.status = 'active'
            AND (
               sm.role = 'owner' OR
               srp.permission_code IS NOT NULL OR
               rp.permission_code IS NOT NULL
            )
        )
    );

-- Create new policies for task_assignments that check custom role permissions

CREATE POLICY "Task assignments are manageable by store managers and owners" ON public.task_assignments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.store_members sm
            LEFT JOIN public.store_role_permissions srp ON sm.role_id = srp.role_id AND srp.permission_code = 'manage_tasks'
            LEFT JOIN public.role_permissions rp ON sm.role = rp.role AND rp.permission_code = 'manage_tasks'
            WHERE sm.store_id = task_assignments.store_id
            AND sm.user_id = auth.uid()
            AND sm.status = 'active'
            AND (
               sm.role = 'owner' OR
               srp.permission_code IS NOT NULL OR
               rp.permission_code IS NOT NULL
            )
        )
    );

CREATE POLICY "Task assignments are updatable by store managers and owners" ON public.task_assignments
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.store_members sm
            LEFT JOIN public.store_role_permissions srp ON sm.role_id = srp.role_id AND srp.permission_code = 'manage_tasks'
            LEFT JOIN public.role_permissions rp ON sm.role = rp.role AND rp.permission_code = 'manage_tasks'
            WHERE sm.store_id = task_assignments.store_id
            AND sm.user_id = auth.uid()
            AND sm.status = 'active'
            AND (
               sm.role = 'owner' OR
               srp.permission_code IS NOT NULL OR
               rp.permission_code IS NOT NULL
            )
        )
    );

CREATE POLICY "Task assignments are deletable by store managers and owners" ON public.task_assignments
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.store_members sm
            LEFT JOIN public.store_role_permissions srp ON sm.role_id = srp.role_id AND srp.permission_code = 'manage_tasks'
            LEFT JOIN public.role_permissions rp ON sm.role = rp.role AND rp.permission_code = 'manage_tasks'
            WHERE sm.store_id = task_assignments.store_id
            AND sm.user_id = auth.uid()
            AND sm.status = 'active'
            AND (
               sm.role = 'owner' OR
               srp.permission_code IS NOT NULL OR
               rp.permission_code IS NOT NULL
            )
        )
    );