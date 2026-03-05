-- Add target_date column for one-off tasks
alter table public.tasks 
add column if not exists target_date date;

-- Update task_type constraint to replace 'time_specific' with 'one_time'
alter table public.tasks drop constraint if exists tasks_task_type_check;

-- Update existing data
update public.tasks set task_type = 'one_time' where task_type = 'time_specific';

-- Re-add constraint with new values
alter table public.tasks add constraint tasks_task_type_check 
  check (task_type in ('one_time', 'recurring', 'always'));

-- Set default value
alter table public.tasks alter column task_type set default 'one_time';