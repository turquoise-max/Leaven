-- Drop the previously created policies to fix the issue
DROP POLICY IF EXISTS "Store members with manage_store permission can insert announcements" ON public.store_announcements;
DROP POLICY IF EXISTS "Store members with manage_store permission can update announcements" ON public.store_announcements;
DROP POLICY IF EXISTS "Store members with manage_store permission can delete announcements" ON public.store_announcements;

-- Create new robust policies for store_announcements that check custom role permissions
-- For INSERT, we must use the new record's store_id in the WITH CHECK expression.

-- INSERT policy
CREATE POLICY "Store members with manage_store permission can insert announcements" ON public.store_announcements
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.store_members sm
            LEFT JOIN public.store_role_permissions srp ON sm.role_id = srp.role_id AND srp.permission_code = 'manage_store'
            LEFT JOIN public.role_permissions rp ON sm.role = rp.role AND rp.permission_code = 'manage_store'
            WHERE sm.store_id = store_id  -- 'store_id' refers to the NEW record's column in this context
            AND sm.user_id = auth.uid()
            AND sm.status = 'active'
            AND (
               sm.role = 'owner' OR
               srp.permission_code IS NOT NULL OR
               rp.permission_code IS NOT NULL
            )
        )
    );

-- UPDATE policy
CREATE POLICY "Store members with manage_store permission can update announcements" ON public.store_announcements
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.store_members sm
            LEFT JOIN public.store_role_permissions srp ON sm.role_id = srp.role_id AND srp.permission_code = 'manage_store'
            LEFT JOIN public.role_permissions rp ON sm.role = rp.role AND rp.permission_code = 'manage_store'
            WHERE sm.store_id = store_announcements.store_id
            AND sm.user_id = auth.uid()
            AND sm.status = 'active'
            AND (
               sm.role = 'owner' OR
               srp.permission_code IS NOT NULL OR
               rp.permission_code IS NOT NULL
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.store_members sm
            LEFT JOIN public.store_role_permissions srp ON sm.role_id = srp.role_id AND srp.permission_code = 'manage_store'
            LEFT JOIN public.role_permissions rp ON sm.role = rp.role AND rp.permission_code = 'manage_store'
            WHERE sm.store_id = store_announcements.store_id
            AND sm.user_id = auth.uid()
            AND sm.status = 'active'
            AND (
               sm.role = 'owner' OR
               srp.permission_code IS NOT NULL OR
               rp.permission_code IS NOT NULL
            )
        )
    );

-- DELETE policy
CREATE POLICY "Store members with manage_store permission can delete announcements" ON public.store_announcements
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.store_members sm
            LEFT JOIN public.store_role_permissions srp ON sm.role_id = srp.role_id AND srp.permission_code = 'manage_store'
            LEFT JOIN public.role_permissions rp ON sm.role = rp.role AND rp.permission_code = 'manage_store'
            WHERE sm.store_id = store_announcements.store_id
            AND sm.user_id = auth.uid()
            AND sm.status = 'active'
            AND (
               sm.role = 'owner' OR
               srp.permission_code IS NOT NULL OR
               rp.permission_code IS NOT NULL
            )
        )
    );