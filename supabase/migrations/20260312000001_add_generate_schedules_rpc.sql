-- Create RPC function to generate staff schedules
CREATE OR REPLACE FUNCTION generate_staff_schedules(
  p_store_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_target_staff_ids UUID[]
) RETURNS INTEGER AS $$
DECLARE
  v_staff RECORD;
  v_date DATE;
  v_dow INTEGER;
  v_schedule JSONB;
  v_start_str TEXT;
  v_end_str TEXT;
  v_start_ts TIMESTAMP WITH TIME ZONE;
  v_end_ts TIMESTAMP WITH TIME ZONE;
  v_new_schedule_id UUID;
  v_count INTEGER := 0;
  v_role_color TEXT;
BEGIN
  -- Loop through target staffs
  FOR v_staff IN 
    SELECT sm.user_id, sm.work_schedules, r.color as role_color
    FROM store_members sm
    LEFT JOIN store_roles r ON sm.role_id = r.id
    WHERE sm.store_id = p_store_id 
    AND sm.user_id = ANY(p_target_staff_ids)
    AND sm.work_schedules IS NOT NULL
  LOOP
    -- Loop through dates from start to end
    v_date := p_start_date;
    WHILE v_date <= p_end_date LOOP
      v_dow := EXTRACT(DOW FROM v_date); -- 0 (Sun) to 6 (Sat)
      
      -- Reset v_schedule for each day
      v_schedule := NULL;

      -- Find schedule for this day of week
      -- jsonb_array_elements expands the array, we filter by day
      SELECT elem INTO v_schedule
      FROM jsonb_array_elements(v_staff.work_schedules) elem
      WHERE (elem->>'day')::int = v_dow
      LIMIT 1;

      -- If schedule exists and is not holiday
      IF v_schedule IS NOT NULL AND (v_schedule->>'is_holiday')::boolean = false THEN
        v_start_str := v_schedule->>'start_time';
        v_end_str := v_schedule->>'end_time';

        IF v_start_str IS NOT NULL AND v_end_str IS NOT NULL THEN
            -- Construct Timestamps
            -- We assume the input time is in 'Asia/Seoul' (KST)
            -- So we convert KST time to UTC timestamp for storage
            v_start_ts := timezone('Asia/Seoul', (v_date || ' ' || v_start_str || ':00')::timestamp);
            v_end_ts := timezone('Asia/Seoul', (v_date || ' ' || v_end_str || ':00')::timestamp);
            
            -- Handle overnight shifts (end time < start time)
            IF v_end_ts < v_start_ts THEN
               v_end_ts := v_end_ts + interval '1 day';
            END IF;

            -- Check overlap: Does this staff have ANY schedule on this day?
            -- We check if any schedule starts on the same day for this user
            IF NOT EXISTS (
                SELECT 1 
                FROM schedules s
                JOIN schedule_members sm ON s.id = sm.schedule_id
                WHERE sm.user_id = v_staff.user_id
                AND s.store_id = p_store_id
                -- Check date overlap in KST
                AND (timezone('Asia/Seoul', s.start_time)::date = v_date)
            ) THEN
                -- Insert Schedule
                INSERT INTO schedules (store_id, title, start_time, end_time, color, memo)
                VALUES (
                    p_store_id, 
                    '근무', 
                    v_start_ts, 
                    v_end_ts, 
                    COALESCE(v_staff.role_color, '#808080'),
                    '자동 생성됨'
                )
                RETURNING id INTO v_new_schedule_id;

                -- Insert Member
                INSERT INTO schedule_members (schedule_id, user_id, store_id)
                VALUES (v_new_schedule_id, v_staff.user_id, p_store_id);
                
                v_count := v_count + 1;
            END IF;
        END IF;
      END IF;

      v_date := v_date + 1;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;