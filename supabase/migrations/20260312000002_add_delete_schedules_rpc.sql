-- Create RPC function to delete staff schedules in bulk
CREATE OR REPLACE FUNCTION delete_staff_schedules(
  p_store_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_target_staff_ids UUID[]
) RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Delete schedules that match the criteria
  -- This assumes ON DELETE CASCADE is set on schedule_members for schedule_id
  -- If not, we might need to delete from schedule_members first or use a different approach.
  -- But usually, deleting the parent (schedule) is the goal.
  
  -- We select IDs to delete first to ensure we target correctly
  WITH schedules_to_delete AS (
    SELECT s.id
    FROM schedules s
    JOIN schedule_members sm ON s.id = sm.schedule_id
    WHERE s.store_id = p_store_id
    AND sm.user_id = ANY(p_target_staff_ids)
    -- Check date range in KST
    AND timezone('Asia/Seoul', s.start_time)::date >= p_start_date
    AND timezone('Asia/Seoul', s.start_time)::date <= p_end_date
  )
  DELETE FROM schedules
  WHERE id IN (SELECT id FROM schedules_to_delete)
  AND store_id = p_store_id; -- Extra safety check

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;