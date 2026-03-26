-- RPC function for leave request cancellation (v2 with 'cancelled' status)
CREATE OR REPLACE FUNCTION cancel_leave_request_v1(
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
  v_is_manager BOOLEAN;
BEGIN
  -- 1. Check permission: check if user is owner or manager
  SELECT EXISTS (
    SELECT 1 FROM store_members
    WHERE store_id = p_store_id
    AND user_id = p_user_id
    AND role IN ('owner', 'manager')
  ) INTO v_is_manager;

  -- 2. Fetch request data and owner info
  SELECT lr.*, sm.user_id as member_user_id
  INTO v_request
  FROM leave_requests lr
  JOIN store_members sm ON lr.member_id = sm.id
  WHERE lr.id = p_request_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Request not found.');
  END IF;

  -- 3. Validation
  -- Allowed if: is manager OR (is owner AND status is pending)
  IF NOT (v_is_manager OR (v_request.member_user_id = p_user_id AND v_request.status = 'pending')) THEN
    RETURN jsonb_build_object('error', 'Permission denied.');
  END IF;

  -- 4. Update status to rejected (by manager) or cancelled (by employee)
  UPDATE leave_requests
  SET 
    status = CASE WHEN v_is_manager THEN 'rejected' ELSE 'cancelled' END,
    reviewed_by = CASE WHEN v_is_manager THEN p_user_id ELSE reviewed_by END,
    reviewed_at = CASE WHEN v_is_manager THEN NOW() ELSE reviewed_at END
  WHERE id = p_request_id;

  -- 5. Rollback leave balance if it was approved
  IF v_request.status = 'approved' AND v_request.leave_type IN ('annual', 'half_am', 'half_pm') THEN
    UPDATE leave_balances
    SET used_days = GREATEST(0, used_days - v_request.requested_days),
        updated_at = NOW()
    WHERE member_id = v_request.member_id
    AND year = CAST(SUBSTRING(v_request.start_date FROM 1 FOR 4) AS INTEGER);
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;