-- Add parent_id to support tree hierarchy
ALTER TABLE store_roles
ADD COLUMN parent_id UUID REFERENCES store_roles(id) ON DELETE SET NULL;