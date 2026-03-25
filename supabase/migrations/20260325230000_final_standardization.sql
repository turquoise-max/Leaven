-- 1. 트리거 함수: 생성/수정 시 title을 유형 명칭과 강제 동기화
CREATE OR REPLACE FUNCTION sync_schedule_type_on_member_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_is_on_leave BOOLEAN;
    v_leave_reason TEXT;
    v_schedule_start_date DATE;
    v_target_title TEXT;
BEGIN
    SELECT (timezone('Asia/Seoul', start_time)::date) INTO v_schedule_start_date
    FROM schedules WHERE id = NEW.schedule_id;

    SELECT EXISTS (
        SELECT 1 FROM leave_requests
        WHERE member_id = NEW.member_id
        AND status = 'approved'
        AND v_schedule_start_date BETWEEN start_date AND end_date
    ), (
        SELECT reason FROM leave_requests
        WHERE member_id = NEW.member_id
        AND status = 'approved'
        AND v_schedule_start_date BETWEEN start_date AND end_date
        LIMIT 1
    ) INTO v_is_on_leave, v_leave_reason;

    IF v_is_on_leave THEN
        UPDATE schedules
        SET 
            schedule_type = 'leave',
            title = '휴가',
            memo = COALESCE(memo, '') || ' [자동 연동: 휴가]' || CASE WHEN v_leave_reason IS NOT NULL THEN ' - ' || v_leave_reason ELSE '' END
        WHERE id = NEW.schedule_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. RPC 최종 수정: 4대 유형 명칭 고정 (근무, 휴가, 교육, 기타)
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
  v_is_on_leave BOOLEAN;
  v_leave_reason TEXT;
BEGIN
  FOR v_staff IN 
    SELECT sm.id as member_id, sm.user_id, sm.work_schedules, r.color as role_color
    FROM store_members sm
    LEFT JOIN store_roles r ON sm.role_id = r.id
    WHERE sm.store_id = p_store_id 
    AND (sm.user_id = ANY(p_target_staff_ids) OR sm.id = ANY(p_target_staff_ids))
    AND sm.work_schedules IS NOT NULL
  LOOP
    v_date := p_start_date;
    WHILE v_date <= p_end_date LOOP
      v_dow := EXTRACT(DOW FROM v_date);
      
      FOR v_schedule IN SELECT elem FROM jsonb_array_elements(v_staff.work_schedules) elem LOOP
          IF (v_schedule->>'day')::int = v_dow AND (v_schedule->>'is_holiday')::boolean = false THEN
              v_start_str := v_schedule->>'start_time';
              v_end_str := v_schedule->>'end_time';

              IF v_start_str IS NOT NULL AND v_end_str IS NOT NULL THEN
                  v_start_ts := timezone('Asia/Seoul', (v_date || ' ' || v_start_str || ':00')::timestamp);
                  v_end_ts := timezone('Asia/Seoul', (v_date || ' ' || v_end_str || ':00')::timestamp);
                  IF v_end_ts <= v_start_ts THEN v_end_ts := v_end_ts + interval '1 day'; END IF;

                  IF NOT EXISTS (
                      SELECT 1 FROM schedules s
                      JOIN schedule_members sm ON s.id = sm.schedule_id
                      WHERE sm.member_id = v_staff.member_id
                      AND s.store_id = p_store_id
                      AND s.end_time > v_start_ts AND s.start_time < v_end_ts
                  ) THEN
                      SELECT EXISTS (
                          SELECT 1 FROM leave_requests
                          WHERE member_id = v_staff.member_id
                          AND status = 'approved'
                          AND v_date BETWEEN start_date AND end_date
                      ), (
                          SELECT reason FROM leave_requests
                          WHERE member_id = v_staff.member_id
                          AND status = 'approved'
                          AND v_date BETWEEN start_date AND end_date
                          LIMIT 1
                      ) INTO v_is_on_leave, v_leave_reason;

                      INSERT INTO schedules (
                          store_id, title, start_time, end_time, color, 
                          schedule_type, memo
                      ) VALUES (
                          p_store_id, 
                          CASE WHEN v_is_on_leave THEN '휴가' ELSE '근무' END, 
                          v_start_ts, v_end_ts, 
                          COALESCE(v_staff.role_color, '#808080'),
                          CASE WHEN v_is_on_leave THEN 'leave'::schedule_type ELSE 'regular'::schedule_type END,
                          CASE WHEN v_is_on_leave THEN '자동 생성 (휴가 연동): ' || COALESCE(v_leave_reason, '') ELSE '자동 생성됨' END
                      ) RETURNING id INTO v_new_schedule_id;

                      INSERT INTO schedule_members (schedule_id, member_id)
                      VALUES (v_new_schedule_id, v_staff.member_id);
                      
                      v_count := v_count + 1;
                  END IF;
              END IF;
          END IF;
      END LOOP;
      v_date := v_date + 1;
    END LOOP;
  END LOOP;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;