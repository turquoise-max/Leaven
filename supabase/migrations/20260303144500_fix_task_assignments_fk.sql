-- Drop existing foreign key constraint if it exists (referencing auth.users)
alter table public.task_assignments
drop constraint if exists task_assignments_user_id_fkey;

-- Add new foreign key constraint referencing public.profiles
alter table public.task_assignments
add constraint task_assignments_user_id_fkey
foreign key (user_id)
references public.profiles(id)
on delete cascade;