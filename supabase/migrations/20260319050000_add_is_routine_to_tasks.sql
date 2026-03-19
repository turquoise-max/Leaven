-- Add is_routine column to tasks table to distinguish routine tasks generated from role templates
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS is_routine BOOLEAN DEFAULT FALSE NOT NULL;

COMMENT ON COLUMN public.tasks.is_routine IS 'If true, this task was generated from a role template (routine task) and may be displayed differently on the calendar.';

-- Update schema cache
NOTIFY pgrst, 'reload schema';