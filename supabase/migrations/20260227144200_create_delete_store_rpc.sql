-- Function to safely delete a store with owner verification
create or replace function public.delete_store(store_id_param uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  is_owner boolean;
begin
  -- Check if the requesting user is the owner of the store
  select exists(
    select 1
    from public.store_members
    where store_id = store_id_param
    and user_id = auth.uid()
    and role = 'owner'
  ) into is_owner;

  if not is_owner then
    raise exception 'Permission denied: Only store owners can delete the store.';
  end if;

  -- Delete the store
  -- Due to ON DELETE CASCADE constraints, this will also delete:
  -- 1. store_members
  -- 2. schedules
  -- 3. other related tables referencing store_id with cascade
  delete from public.stores
  where id = store_id_param;
end;
$$;

-- Grant execute permission to authenticated users and service role
grant execute on function public.delete_store(uuid) to authenticated;
grant execute on function public.delete_store(uuid) to service_role;

-- Reload schema cache (Supabase specific)
NOTIFY pgrst, 'reload schema';