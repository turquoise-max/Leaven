-- Add new columns to tasks table
alter table public.tasks 
add column if not exists checklist jsonb default '[]'::jsonb,
add column if not exists status text default 'todo' check (status in ('todo', 'in_progress', 'done'));

-- Create task history table for recurring tasks
create table if not exists public.task_history (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references public.tasks(id) on delete cascade,
  completed_at timestamptz default now(),
  target_date date not null, -- The date this task instance refers to
  status text default 'done' check (status in ('todo', 'in_progress', 'done')),
  user_id uuid references auth.users(id) on delete set null,
  store_id uuid references public.stores(id) on delete cascade,
  checklist_progress jsonb default '[]'::jsonb, -- Store checklist state for this instance
  
  unique(task_id, target_date)
);

-- Add indexes
create index if not exists task_history_store_id_idx on public.task_history(store_id);
create index if not exists task_history_task_id_date_idx on public.task_history(task_id, target_date);

-- Enable RLS
alter table public.task_history enable row level security;

-- Policies for task_history
create policy "Task history viewable by store members"
  on public.task_history for select
  using (
    exists (
      select 1 from public.store_members
      where store_members.store_id = task_history.store_id
      and store_members.user_id = auth.uid()
    )
  );

create policy "Task history insertable by store members"
  on public.task_history for insert
  with check (
    exists (
      select 1 from public.store_members
      where store_members.store_id = task_history.store_id
      and store_members.user_id = auth.uid()
    )
  );

create policy "Task history updatable by store members"
  on public.task_history for update
  using (
    exists (
      select 1 from public.store_members
      where store_members.store_id = task_history.store_id
      and store_members.user_id = auth.uid()
    )
  );

create policy "Task history deletable by store members"
  on public.task_history for delete
  using (
    exists (
      select 1 from public.store_members
      where store_members.store_id = task_history.store_id
      and store_members.user_id = auth.uid()
    )
  );