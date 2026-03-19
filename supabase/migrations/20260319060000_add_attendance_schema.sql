-- Create attendance schema
CREATE TABLE IF NOT EXISTS store_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES store_members(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
    target_date DATE NOT NULL,
    clock_in_time TIMESTAMPTZ,
    clock_out_time TIMESTAMPTZ,
    break_start_time TIMESTAMPTZ,
    break_end_time TIMESTAMPTZ,
    total_break_minutes INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'working', -- working, completed, absent
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for store_attendance
ALTER TABLE store_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attendance in their stores" ON store_attendance
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM store_members
            WHERE store_members.store_id = store_attendance.store_id
            AND store_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Managers can manage attendance" ON store_attendance
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM store_members
            WHERE store_members.store_id = store_attendance.store_id
            AND store_members.user_id = auth.uid()
            AND store_members.role IN ('owner', 'manager')
        )
    );

CREATE POLICY "Staff can insert their own attendance" ON store_attendance
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM store_members
            WHERE store_members.id = store_attendance.member_id
            AND store_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Staff can update their own attendance" ON store_attendance
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM store_members
            WHERE store_members.id = store_attendance.member_id
            AND store_members.user_id = auth.uid()
        )
    );


-- Attendance modification requests
CREATE TABLE IF NOT EXISTS store_attendance_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    attendance_id UUID REFERENCES store_attendance(id) ON DELETE CASCADE, -- can be null if requesting a missing punch for a day
    member_id UUID NOT NULL REFERENCES store_members(id) ON DELETE CASCADE,
    target_date DATE NOT NULL,
    requested_clock_in TIMESTAMPTZ,
    requested_clock_out TIMESTAMPTZ,
    reason TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE store_attendance_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view requests in their stores" ON store_attendance_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM store_members
            WHERE store_members.store_id = store_attendance_requests.store_id
            AND store_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Managers can manage requests" ON store_attendance_requests
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM store_members
            WHERE store_members.store_id = store_attendance_requests.store_id
            AND store_members.user_id = auth.uid()
            AND store_members.role IN ('owner', 'manager')
        )
    );

CREATE POLICY "Staff can insert their own requests" ON store_attendance_requests
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM store_members
            WHERE store_members.id = store_attendance_requests.member_id
            AND store_members.user_id = auth.uid()
        )
    );