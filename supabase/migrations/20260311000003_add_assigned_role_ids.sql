-- Add assigned_role_ids column to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_role_ids text[] DEFAULT '{}';

-- Migrate existing data from assigned_role_id to assigned_role_ids
UPDATE tasks 
SET assigned_role_ids = ARRAY[assigned_role_id] 
WHERE assigned_role_id IS NOT NULL AND assigned_role_ids = '{}';

-- Comment on column
COMMENT ON COLUMN tasks.assigned_role_ids IS 'List of role IDs assigned to this task. Can contain "all" for all roles.';

-- (Optional) If you want to drop the old column later, uncomment the following line:
-- ALTER TABLE tasks DROP COLUMN assigned_role_id;