-- ==========================================
-- Add 'inactive' value to member_status enum
-- ==========================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid 
    WHERE t.typname = 'member_status' 
    AND e.enumlabel = 'inactive'
  ) THEN
    ALTER TYPE member_status ADD VALUE 'inactive';
  END IF;
END $$;

-- PostgREST 스키마 캐시 새로고침
NOTIFY pgrst, 'reload schema';