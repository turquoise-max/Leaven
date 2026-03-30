-- Drop old policies
DROP POLICY IF EXISTS "Managers can manage leave balances" ON public.leave_balances;
DROP POLICY IF EXISTS "Managers can manage leave requests" ON public.leave_requests;

-- Create new policies using permission system
CREATE POLICY "Managers can manage leave balances" ON public.leave_balances
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.store_members sm
            LEFT JOIN public.store_role_permissions srp ON sm.role_id = srp.role_id AND srp.permission_code = 'manage_schedule'
            LEFT JOIN public.role_permissions rp ON sm.role = rp.role AND rp.permission_code = 'manage_schedule'
            WHERE sm.store_id = leave_balances.store_id
            AND sm.user_id = auth.uid()
            AND (srp.permission_code IS NOT NULL OR rp.permission_code IS NOT NULL)
        )
    );

CREATE POLICY "Managers can manage leave requests" ON public.leave_requests
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.store_members sm
            LEFT JOIN public.store_role_permissions srp ON sm.role_id = srp.role_id AND srp.permission_code = 'manage_schedule'
            LEFT JOIN public.role_permissions rp ON sm.role = rp.role AND rp.permission_code = 'manage_schedule'
            WHERE sm.store_id = leave_requests.store_id
            AND sm.user_id = auth.uid()
            AND (srp.permission_code IS NOT NULL OR rp.permission_code IS NOT NULL)
        )
    );