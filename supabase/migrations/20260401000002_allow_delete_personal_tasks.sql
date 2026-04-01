-- Allow users to delete their own personal tasks
-- This fixes the issue where regular staff could create but not delete their personal tasks on the timeline

DROP POLICY IF EXISTS "Task deletable by assigned user" ON public.tasks;

CREATE POLICY "Task deletable by assigned user"
    ON public.tasks FOR DELETE
    USING (
        (auth.uid() = user_id) OR
        EXISTS (
            SELECT 1 FROM public.store_members
            WHERE store_members.store_id = tasks.store_id
            AND store_members.user_id = auth.uid()
            AND store_members.role IN ('owner', 'manager')
        )
    );