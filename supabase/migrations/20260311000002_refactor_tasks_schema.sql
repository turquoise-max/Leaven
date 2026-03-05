-- Refactor tasks schema to use timestamp with time zone

-- 1. Clear existing tasks data (Since structure changes significantly)
TRUNCATE TABLE public.tasks CASCADE;

-- 2. Modify columns
ALTER TABLE public.tasks
  DROP COLUMN IF EXISTS target_date,
  DROP COLUMN IF EXISTS repeat_pattern,
  ALTER COLUMN start_time TYPE timestamptz USING NULL, -- clear old data
  ALTER COLUMN end_time TYPE timestamptz USING NULL,
  ADD COLUMN IF NOT EXISTS original_repeat_id uuid; -- For tracking repeat groups

-- 3. Update task_type check constraint
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_task_type_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_task_type_check 
  CHECK (task_type IN ('scheduled', 'always'));

-- 4. Reload schema cache
NOTIFY pgrst, 'reload schema';