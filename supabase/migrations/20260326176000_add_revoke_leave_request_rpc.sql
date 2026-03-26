-- RPC function for revoking an approved leave request
CREATE OR REPLACE FUNCTION revoke_leave_request_v1(
  p_request_id UUID,
  p_user_id UUID,
  p_store_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request RECORD;
  v_year INTEGER;
BEGIN
  -- We assume the application layer (actions.ts) has already checked `requirePermission(user.id, storeId, 'manage_schedule')`
  -- This RPC is just the database execution part for safety.

  -- 1. Fetch request data
  SELECT lr.*
  INTO v_request
  FROM leave_requests lr
  WHERE lr.id = p_request_id AND lr.store_id = p_store_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Request not found.');
  END IF;

  -- 2. Validate state
  IF v_request.status != 'approved' THEN
    RETURN jsonb_build_object('error', 'Only approved requests can be revoked.');
  END IF;

  -- 3. Update status to cancelled
  UPDATE leave_requests
  SET 
    status = 'cancelled',
    reviewed_by = p_user_id,
    reviewed_at = NOW()
  WHERE id = p_request_id;

  -- 4. Restore leave balance if it was annual leave
  IF v_request.leave_type IN ('annual', 'half_am', 'half_pm') THEN
    v_year := CAST(SUBSTRING(CAST(v_request.start_date AS VARCHAR) FROM 1 FOR 4) AS INTEGER);
    
    -- Try to update existing balance (restore used days, but don't go below 0)
    UPDATE leave_balances
    SET used_days = GREATEST(0, used_days - v_request.requested_days),
        updated_at = NOW()
    WHERE member_id = v_request.member_id AND year = v_year;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;