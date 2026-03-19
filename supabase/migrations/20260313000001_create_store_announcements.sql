CREATE TABLE IF NOT EXISTS store_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT,
    is_important BOOLEAN DEFAULT false,
    author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add indexes
CREATE INDEX idx_store_announcements_store_id ON store_announcements(store_id);
CREATE INDEX idx_store_announcements_created_at ON store_announcements(created_at DESC);

-- Enable RLS
ALTER TABLE store_announcements ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Anyone in the store can view announcements
CREATE POLICY "Store members can view announcements"
    ON store_announcements FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM store_members
            WHERE store_members.store_id = store_announcements.store_id
            AND store_members.user_id = auth.uid()
        )
    );

-- Only owners and managers can insert announcements
CREATE POLICY "Owners and managers can insert announcements"
    ON store_announcements FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM store_members
            WHERE store_members.store_id = store_announcements.store_id
            AND store_members.user_id = auth.uid()
            AND store_members.role IN ('owner', 'manager')
        )
    );

-- Only owners and managers can update announcements
CREATE POLICY "Owners and managers can update announcements"
    ON store_announcements FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM store_members
            WHERE store_members.store_id = store_announcements.store_id
            AND store_members.user_id = auth.uid()
            AND store_members.role IN ('owner', 'manager')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM store_members
            WHERE store_members.store_id = store_announcements.store_id
            AND store_members.user_id = auth.uid()
            AND store_members.role IN ('owner', 'manager')
        )
    );

-- Only owners and managers can delete announcements
CREATE POLICY "Owners and managers can delete announcements"
    ON store_announcements FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM store_members
            WHERE store_members.store_id = store_announcements.store_id
            AND store_members.user_id = auth.uid()
            AND store_members.role IN ('owner', 'manager')
        )
    );

-- Create function if it doesn't exist
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at trigger
CREATE TRIGGER update_store_announcements_updated_at
    BEFORE UPDATE ON store_announcements
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
