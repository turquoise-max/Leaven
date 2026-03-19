-- Create Leave Management Schema

CREATE TABLE IF NOT EXISTS leave_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES store_members(id) ON DELETE CASCADE,
    total_days NUMERIC(5,2) DEFAULT 0,
    used_days NUMERIC(5,2) DEFAULT 0,
    year INTEGER NOT NULL DEFAULT extract(year from current_date),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(member_id, year)
);

ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view leave balances in their stores" ON leave_balances
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM store_members
            WHERE store_members.store_id = leave_balances.store_id
            AND store_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Managers can manage leave balances" ON leave_balances
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM store_members
            WHERE store_members.store_id = leave_balances.store_id
            AND store_members.user_id = auth.uid()
            AND store_members.role IN ('owner', 'manager')
        )
    );

CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES store_members(id) ON DELETE CASCADE,
    leave_type VARCHAR(50) NOT NULL, -- annual, sick, unpaid, half_am, half_pm
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    requested_days NUMERIC(5,2) NOT NULL DEFAULT 1,
    reason TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, cancelled
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view leave requests in their stores" ON leave_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM store_members
            WHERE store_members.store_id = leave_requests.store_id
            AND store_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Managers can manage leave requests" ON leave_requests
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM store_members
            WHERE store_members.store_id = leave_requests.store_id
            AND store_members.user_id = auth.uid()
            AND store_members.role IN ('owner', 'manager')
        )
    );

CREATE POLICY "Staff can insert their own leave requests" ON leave_requests
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM store_members
            WHERE store_members.id = leave_requests.member_id
            AND store_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Staff can update their own pending leave requests" ON leave_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM store_members
            WHERE store_members.id = leave_requests.member_id
            AND store_members.user_id = auth.uid()
        )
        AND status = 'pending'
    );