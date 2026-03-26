-- Allow staff to create their own personal tasks
create policy "Users can create their own tasks"
    on public.tasks for insert
    with check (
        exists (
            select 1 from public.store_members
            where store_members.store_id = tasks.store_id
            and store_members.user_id = auth.uid()
            and store_members.status = 'active'
        )
        and (assigned_role_ids is null or array_length(assigned_role_ids, 1) is null)
        and is_template = false
    );

-- Allow staff to create their own task assignments
create policy "Users can create their own task assignments"
    on public.task_assignments for insert
    with check (
        task_assignments.user_id = auth.uid()
        and exists (
            select 1 from public.store_members
            where store_members.store_id = task_assignments.store_id
            and store_members.user_id = auth.uid()
            and store_members.status = 'active'
        )
    );

-- Allow staff to delete their own tasks (only if it's a personal task)
create policy "Users can delete their own tasks"
    on public.tasks for delete
    using (
        exists (
            select 1 from public.task_assignments
            where task_assignments.task_id = tasks.id
            and task_assignments.user_id = auth.uid()
        )
        and (assigned_role_ids is null or array_length(assigned_role_ids, 1) is null)
        and is_template = false
    );

-- Allow staff to delete their own task assignments
create policy "Users can delete their own task assignments"
    on public.task_assignments for delete
    using (
        task_assignments.user_id = auth.uid()
    );
