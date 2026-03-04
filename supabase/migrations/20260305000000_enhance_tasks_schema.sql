-- Add new columns to tasks table
alter table public.tasks 
add column if not exists task_type text default 'time_specific' check (task_type in ('time_specific', 'recurring', 'always')),
add column if not exists start_time time without time zone,
add column if not exists end_time time without time zone,
add column if not exists repeat_pattern jsonb,
add column if not exists assigned_role_id uuid references public.store_roles(id) on delete set null;

-- Add index for performance
create index if not exists tasks_store_id_idx on public.tasks(store_id);
create index if not exists tasks_assigned_role_id_idx on public.tasks(assigned_role_id);
create index if not exists tasks_task_type_idx on public.tasks(task_type);

-- Update RLS policies if necessary (existing policies cover store_id check)
-- Ensure assigned_role_id is visible to users with that role or managers
-- The existing policy "Tasks are viewable by store members" already covers this as long as they are in the store.
-- We will handle role-based filtering in the application layer or via specific query functions.