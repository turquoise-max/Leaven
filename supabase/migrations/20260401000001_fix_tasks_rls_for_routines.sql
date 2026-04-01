-- Drop the overly restrictive SELECT policy
DROP POLICY IF EXISTS "Tasks are viewable by assigned users or store managers" ON public.tasks;

-- Recreate a more inclusive policy for SELECT
-- Users can view a task if:
-- 1. It is assigned to them (user_id)
-- 2. They are a manager or owner
-- 3. It is a template or routine task
-- Or just allow all store members to view all tasks in the store (as was likely before)
CREATE POLICY "Tasks are viewable by store members"
    ON public.tasks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.store_members
            WHERE store_members.store_id = tasks.store_id
            AND store_members.user_id = auth.uid()
        )
    );
