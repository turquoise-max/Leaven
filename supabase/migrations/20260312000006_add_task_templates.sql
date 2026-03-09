-- Add columns for Task Templates functionality
ALTER TABLE public.tasks 
ADD COLUMN is_template BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN recurrence_rule JSONB;

-- Example of recurrence_rule format:
-- {
--   "days": [1, 2, 3, 4, 5] // 0=Sunday, 1=Monday, ..., 6=Saturday
-- }

-- Update comments for clarity
COMMENT ON COLUMN public.tasks.is_template IS 'If true, this task acts as a recurring template and is not shown on the calendar.';
COMMENT ON COLUMN public.tasks.recurrence_rule IS 'JSON object defining recurrence, e.g., {"days": [1,3,5]}';