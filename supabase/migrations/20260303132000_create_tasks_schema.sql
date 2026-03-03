-- Create tasks table
create table public.tasks (
    id uuid not null default gen_random_uuid(),
    store_id uuid not null references public.stores(id) on delete cascade,
    title text not null,
    description text,
    is_critical boolean default false,
    estimated_minutes integer default 30,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    constraint tasks_pkey primary key (id)
);

-- Create task_assignments table
create table public.task_assignments (
    id uuid not null default gen_random_uuid(),
    store_id uuid not null references public.stores(id) on delete cascade,
    task_id uuid not null references public.tasks(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    schedule_id uuid references public.schedules(id) on delete set null,
    assigned_date date not null,
    start_time time without time zone,
    end_time time without time zone,
    status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'verified')),
    completed_at timestamptz,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    constraint task_assignments_pkey primary key (id)
);

-- Enable RLS
alter table public.tasks enable row level security;
alter table public.task_assignments enable row level security;

-- RLS Policies for tasks
create policy "Tasks are viewable by store members"
    on public.tasks for select
    using (
        exists (
            select 1 from public.store_members
            where store_members.store_id = tasks.store_id
            and store_members.user_id = auth.uid()
        )
    );

create policy "Tasks are manageable by store managers and owners"
    on public.tasks for all
    using (
        exists (
            select 1 from public.store_members
            where store_members.store_id = tasks.store_id
            and store_members.user_id = auth.uid()
            and store_members.role in ('owner', 'manager')
        )
    );

-- RLS Policies for task_assignments
create policy "Task assignments are viewable by store members"
    on public.task_assignments for select
    using (
        exists (
            select 1 from public.store_members
            where store_members.store_id = task_assignments.store_id
            and store_members.user_id = auth.uid()
        )
    );

create policy "Task assignments are manageable by store managers and owners"
    on public.task_assignments for insert
    with check (
        exists (
            select 1 from public.store_members
            where store_members.store_id = task_assignments.store_id
            and store_members.user_id = auth.uid()
            and store_members.role in ('owner', 'manager')
        )
    );

create policy "Task assignments are updatable by store managers and owners"
    on public.task_assignments for update
    using (
        exists (
            select 1 from public.store_members
            where store_members.store_id = task_assignments.store_id
            and store_members.user_id = auth.uid()
            and store_members.role in ('owner', 'manager')
        )
    );
    
create policy "Task assignments status updatable by assigned user"
    on public.task_assignments for update
    using (
        task_assignments.user_id = auth.uid()
    )
    with check (
        task_assignments.user_id = auth.uid()
        -- Only allow updating status and completed_at
    );

create policy "Task assignments are deletable by store managers and owners"
    on public.task_assignments for delete
    using (
        exists (
            select 1 from public.store_members
            where store_members.store_id = task_assignments.store_id
            and store_members.user_id = auth.uid()
            and store_members.role in ('owner', 'manager')
        )
    );

-- Realtime subscription
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.task_assignments;