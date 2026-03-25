-- 1. 트리거 함수 재정의 (더 강력한 휴가 체크)
CREATE OR REPLACE FUNCTION sync_schedule_type_on_member_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_is_on_leave BOOLEAN;
    v_leave_reason TEXT;
    v_schedule_start_date DATE;
    v_store_id UUID;
BEGIN
    -- 스케줄의 시작 날짜 및 매장 ID 확인
    SELECT (timezone('Asia/Seoul', start_time)::date), store_id INTO v_schedule_start_date, v_store_id
    FROM schedules
    WHERE id = NEW.schedule_id;

    -- 해당 직원의 승인된 휴가 확인
    SELECT EXISTS (
        SELECT 1 FROM leave_requests
        WHERE member_id = NEW.member_id
        AND status = 'approved'
        AND v_schedule_start_date >= start_date
        AND v_schedule_start_date <= end_date
    ), (
        SELECT reason FROM leave_requests
        WHERE member_id = NEW.member_id
        AND status = 'approved'
        AND v_schedule_start_date >= start_date
        AND v_schedule_start_date <= end_date
        LIMIT 1
    ) INTO v_is_on_leave, v_leave_reason;

    -- 휴가 중이면 스케줄 타입 변경 및 메모 추가
    IF v_is_on_leave THEN
        UPDATE schedules
        SET 
            schedule_type = 'leave',
            memo = COALESCE(memo, '') || ' [자동 연동: 휴가]' || CASE WHEN v_leave_reason IS NOT NULL THEN ' - ' || v_leave_reason ELSE '' END
        WHERE id = NEW.schedule_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. 기존 일괄 생성 RPC 강제 업데이트
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
  v_is_on_leave BOOLEAN;
  v_leave_reason TEXT;
  v_schedule_type schedule_type;
  v_memo TEXT;
  v_member_id UUID;
BEGIN
  -- Loop through target staffs
  FOR v_staff IN 
    SELECT sm.id as member_id, sm.user_id, sm.work_schedules, r.color as role_color
    FROM store_members sm
    LEFT JOIN store_roles r ON sm.role_id = r.id
    WHERE sm.store_id = p_store_id 
    AND sm.user_id = ANY(p_target_staff_ids)
    AND sm.work_schedules IS NOT NULL
  LOOP
    -- Loop through dates from start to end
    v_date := p_start_date;
    WHILE v_date <= p_end_date LOOP
      v_dow := EXTRACT(DOW FROM v_date);
      v_schedule := NULL;

      SELECT elem INTO v_schedule
      FROM jsonb_array_elements(v_staff.work_schedules) elem
      WHERE (elem->>'day')::int = v_dow
      LIMIT 1;

      IF v_schedule IS NOT NULL AND (v_schedule->>'is_holiday')::boolean = false THEN
        v_start_str := v_schedule->>'start_time';
        v_end_str := v_schedule->>'end_time';

        IF v_start_str IS NOT NULL AND v_end_str IS NOT NULL THEN
            v_start_ts := timezone('Asia/Seoul', (v_date || ' ' || v_start_str || ':00')::timestamp);
            v_end_ts := timezone('Asia/Seoul', (v_date || ' ' || v_end_str || ':00')::timestamp);
            
            IF v_end_ts < v_start_ts THEN
               v_end_ts := v_end_ts + interval '1 day';
            END IF;

            -- Check for approved leave
            SELECT EXISTS (
                SELECT 1 FROM leave_requests
                WHERE member_id = v_staff.member_id
                AND status = 'approved'
                AND v_date >= start_date
                AND v_date <= end_date
            ), (
                SELECT reason FROM leave_requests
                WHERE member_id = v_staff.member_id
                AND status = 'approved'
                AND v_date >= start_date
                AND v_date <= end_date
                LIMIT 1
            ) INTO v_is_on_leave, v_leave_reason;

            IF v_is_on_leave THEN
                v_schedule_type := 'leave';
                v_memo := '자동 생성 (휴가 연동): ' || COALESCE(v_leave_reason, '사유 없음');
            ELSE
                v_schedule_type := 'regular';
                v_memo := '자동 생성됨';
            END IF;

            IF NOT EXISTS (
                SELECT 1 
                FROM schedules s
                JOIN schedule_members sm ON s.id = sm.schedule_id
                WHERE sm.user_id = v_staff.user_id
                AND s.store_id = p_store_id
                AND (timezone('Asia/Seoul', s.start_time)::date = v_date)
            ) THEN
                INSERT INTO schedules (store_id, title, start_time, end_time, color, memo, schedule_type)
                VALUES (
                    p_store_id, 
                    '근무', 
                    v_start_ts, 
                    v_end_ts, 
                    COALESCE(v_staff.role_color, '#808080'),
                    v_memo,
                    v_schedule_type
                )
                RETURNING id INTO v_new_schedule_id;

                INSERT INTO schedule_members (schedule_id, user_id)
                VALUES (v_new_schedule_id, v_staff.user_id);
                
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