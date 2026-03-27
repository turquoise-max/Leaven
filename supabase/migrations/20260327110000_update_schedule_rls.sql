-- Drop old policies for schedules
DROP POLICY IF EXISTS "Managers and Owners can manage schedules." ON public.schedules;

-- Create new policy for schedules that checks manage_schedule permission
CREATE POLICY "Schedules are manageable by authorized members" ON public.schedules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.store_members sm
            LEFT JOIN public.store_role_permissions srp ON sm.role_id = srp.role_id AND srp.permission_code = 'manage_schedule'
            LEFT JOIN public.role_permissions rp ON sm.role = rp.role AND rp.permission_code = 'manage_schedule'
            WHERE sm.store_id = schedules.store_id
            AND sm.user_id = auth.uid()
            AND sm.status = 'active'
            AND (
               sm.role = 'owner' OR
               srp.permission_code IS NOT NULL OR
               rp.permission_code IS NOT NULL
            )
        )
    );

-- Drop old policies for schedule_members
DROP POLICY IF EXISTS "Managers and Owners can manage schedule members." ON public.schedule_members;

-- Create new policy for schedule_members that checks manage_schedule permission
CREATE POLICY "Schedule members are manageable by authorized members" ON public.schedule_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.schedules s
            JOIN public.store_members sm ON s.store_id = sm.store_id
            LEFT JOIN public.store_role_permissions srp ON sm.role_id = srp.role_id AND srp.permission_code = 'manage_schedule'
            LEFT JOIN public.role_permissions rp ON sm.role = rp.role AND rp.permission_code = 'manage_schedule'
            WHERE s.id = schedule_members.schedule_id
            AND sm.user_id = auth.uid()
            AND sm.status = 'active'
            AND (
               sm.role = 'owner' OR
               srp.permission_code IS NOT NULL OR
               rp.permission_code IS NOT NULL
            )
        )
    );