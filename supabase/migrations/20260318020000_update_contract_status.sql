-- Add contract_file_url
ALTER TABLE store_members ADD COLUMN IF NOT EXISTS contract_file_url text;

-- Drop existing check constraint on contract_status
DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'store_members'::regclass
    AND pg_get_constraintdef(oid) LIKE '%contract_status%';

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE store_members DROP CONSTRAINT ' || constraint_name;
    END IF;
END $$;

-- Add new check constraint
ALTER TABLE store_members ADD CONSTRAINT store_members_contract_status_check CHECK (contract_status IN ('none', 'sent', 'pending_staff', 'signed', 'rejected', 'canceled'));
