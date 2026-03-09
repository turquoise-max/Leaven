-- Create RPC function to delete generated tasks in a specific period
CREATE OR REPLACE FUNCTION delete_tasks_by_period(
  p_store_id UUID,
  p_start_date DATE,
  p_end_date DATE
) RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
  v_start_ts TIMESTAMP WITH TIME ZONE;
  v_end_ts TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Convert input dates to KST timezone boundaries (00:00:00 to 23:59:59)
  -- The input dates are treated as KST dates.
  v_start_ts := timezone('Asia/Seoul', (p_start_date || ' 00:00:00')::timestamp);
  v_end_ts := timezone('Asia/Seoul', (p_end_date || ' 23:59:59')::timestamp);

  WITH deleted AS (
    DELETE FROM tasks
    WHERE store_id = p_store_id
    AND is_template = false
    AND start_time >= v_start_ts
    AND start_time <= v_end_ts
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM deleted;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;