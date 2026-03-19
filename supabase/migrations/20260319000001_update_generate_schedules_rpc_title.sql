-- Update generate_staff_schedules RPC to use '정규 근무' instead of '자동 생성 근무'
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
BEGIN
  -- Loop through target staffs
  FOR v_staff IN 
    SELECT sm.id as member_id, sm.work_schedules, r.color as role_color
    FROM store_members sm
    LEFT JOIN store_roles r ON sm.role_id = r.id
    WHERE sm.store_id = p_store_id 
    AND sm.id = ANY(p_target_staff_ids)
  LOOP
    -- Loop from start to end
    v_date := p_start_date;
    WHILE v_date <= p_end_date LOOP
      v_dow := EXTRACT(ISODOW FROM v_date);
      IF v_dow = 7 THEN v_dow := 0; END IF; -- convert Sunday 7 to 0
      
      v_schedule := NULL;
      
      -- Find matching schedule for the day
      SELECT elem INTO v_schedule
      FROM jsonb_array_elements(v_staff.work_schedules) as elem
      WHERE (elem->>'day')::integer = v_dow AND (elem->>'is_holiday')::boolean = false
      LIMIT 1;

      -- If schedule exists and is not holiday
      IF v_schedule IS NOT NULL THEN
        v_start_str := v_schedule->>'start_time';
        v_end_str := v_schedule->>'end_time';

        IF v_start_str IS NOT NULL AND v_end_str IS NOT NULL THEN
            -- Construct timestamps
            v_start_ts := timezone('Asia/Seoul', (v_date || ' ' || v_start_str || ':00')::timestamp);
            v_end_ts := timezone('Asia/Seoul', (v_date || ' ' || v_end_str || ':00')::timestamp);
            
            -- Handle overnight shifts
            IF v_end_ts < v_start_ts THEN
               v_end_ts := v_end_ts + interval '1 day';
            END IF;

            -- Check if already exists
            IF NOT EXISTS (
                SELECT 1 FROM schedules s
                JOIN schedule_members sm_rel ON s.id = sm_rel.schedule_id
                WHERE sm_rel.member_id = v_staff.member_id
                AND s.store_id = p_store_id
                AND (timezone('Asia/Seoul', s.start_time)::date = v_date)
            ) THEN
                -- Insert Schedule
                INSERT INTO schedules (store_id, title, start_time, end_time, color, memo)
                VALUES (p_store_id, '정규 근무', v_start_ts, v_end_ts, v_staff.role_color, '패턴 기반 자동 생성')
                RETURNING id INTO v_new_schedule_id;

                -- Insert Member
                INSERT INTO schedule_members (schedule_id, member_id)
                VALUES (v_new_schedule_id, v_staff.member_id);
                
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