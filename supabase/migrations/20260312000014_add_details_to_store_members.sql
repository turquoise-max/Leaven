-- ==========================================
-- Add 'details' column to store_members if not exists
-- ==========================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'store_members' 
        AND column_name = 'details'
    ) THEN
        ALTER TABLE public.store_members
        ADD COLUMN details JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- PostgREST 스키마 캐시 새로고침
NOTIFY pgrst, 'reload schema';