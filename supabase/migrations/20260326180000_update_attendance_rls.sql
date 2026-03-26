-- Drop the old policies
DROP POLICY IF EXISTS "Managers can manage attendance" ON store_attendance;
DROP POLICY IF EXISTS "Managers can manage requests" ON store_attendance_requests;

-- Create new policies for store_attendance that check custom role permissions
CREATE POLICY "Managers can manage attendance" ON store_attendance
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM store_members sm
            LEFT JOIN store_role_permissions srp ON sm.role_id = srp.role_id AND srp.permission_code = 'manage_schedule'
            LEFT JOIN role_permissions rp ON sm.role = rp.role AND rp.permission_code = 'manage_schedule'
            WHERE sm.store_id = store_attendance.store_id
            AND sm.user_id = auth.uid()
            AND sm.status = 'active'
            AND (
               sm.role = 'owner' OR
               srp.permission_code IS NOT NULL OR
               rp.permission_code IS NOT NULL
            )
        )
    );

-- Create new policies for store_attendance_requests that check custom role permissions
CREATE POLICY "Managers can manage requests" ON store_attendance_requests
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM store_members sm
            LEFT JOIN store_role_permissions srp ON sm.role_id = srp.role_id AND srp.permission_code = 'manage_schedule'
            LEFT JOIN role_permissions rp ON sm.role = rp.role AND rp.permission_code = 'manage_schedule'
            WHERE sm.store_id = store_attendance_requests.store_id
            AND sm.user_id = auth.uid()
            AND sm.status = 'active'
            AND (
               sm.role = 'owner' OR
               srp.permission_code IS NOT NULL OR
               rp.permission_code IS NOT NULL
            )
        )
    );