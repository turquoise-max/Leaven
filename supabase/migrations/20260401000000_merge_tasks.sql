-- 1. Merge tasks and task_assignments logic into tasks table

-- Drop dependent constraints/views/policies if necessary before modifying columns
-- In this case, we add new columns and drop task_assignments

-- Add missing columns to tasks table
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES store_roles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES public.schedules(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS assigned_date DATE,
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'todo';

-- Migrate existing data from task_assignments to tasks if needed
-- To keep it simple, we can copy tasks for each assignment if they are considered individual tasks
-- For now, let's just create new rows in tasks for each assignment
INSERT INTO public.tasks (
    store_id, title, description, checklist, estimated_minutes,
    user_id, schedule_id, assigned_date, start_time, end_time, status, task_type, is_template
)
SELECT 
    t.store_id, t.title, t.description, t.checklist, t.estimated_minutes,
    ta.user_id, ta.schedule_id, ta.assigned_date, 
    -- Convert time to timestamptz using assigned_date if available
    CASE 
        WHEN ta.start_time IS NOT NULL AND ta.assigned_date IS NOT NULL THEN
            (ta.assigned_date || ' ' || ta.start_time || '+09')::timestamptz
        ELSE t.start_time
    END as start_time,
    CASE 
        WHEN ta.end_time IS NOT NULL AND ta.assigned_date IS NOT NULL THEN
            (ta.assigned_date || ' ' || ta.end_time || '+09')::timestamptz
        ELSE t.end_time
    END as end_time,
    CASE 
        WHEN ta.status = 'pending' THEN 'todo'
        WHEN ta.status = 'completed' THEN 'done'
        ELSE ta.status 
    END,
    t.task_type,
    false
FROM public.task_assignments ta
JOIN public.tasks t ON ta.task_id = t.id;

-- Ensure tasks that act as templates remain as templates
UPDATE public.tasks
SET is_template = true
WHERE id IN (
    SELECT DISTINCT task_id FROM public.task_assignments
) OR is_template = true; -- Keep existing ones as templates

-- Drop task_assignments table as it is no longer needed
DROP TABLE IF EXISTS public.task_assignments CASCADE;

-- Update RLS policies for tasks
DROP POLICY IF EXISTS "Tasks are viewable by store members" ON public.tasks;
CREATE POLICY "Tasks are viewable by assigned users or store managers"
    ON public.tasks FOR SELECT
    USING (
        (auth.uid() = user_id) OR
        EXISTS (
            SELECT 1 FROM public.store_members
            WHERE store_members.store_id = tasks.store_id
            AND store_members.user_id = auth.uid()
            AND store_members.role IN ('owner', 'manager')
        )
    );

DROP POLICY IF EXISTS "Task status updatable by assigned user" ON public.tasks;
CREATE POLICY "Task status updatable by assigned user"
    ON public.tasks FOR UPDATE
    USING (
        (auth.uid() = user_id) OR
        EXISTS (
            SELECT 1 FROM public.store_members
            WHERE store_members.store_id = tasks.store_id
            AND store_members.user_id = auth.uid()
            AND store_members.role IN ('owner', 'manager')
        )
    );