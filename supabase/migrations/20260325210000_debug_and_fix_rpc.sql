-- 0개 생성 문제 해결을 위한 디버깅 및 로직 정교화 버전
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
  v_schedule_type schedule_type;
  v_memo TEXT;
  v_overlap_exists BOOLEAN;
  v_leave_exists_on_date BOOLEAN;
BEGIN
  -- 1. 대상 직원 루프 (user_id 기준)
  FOR v_staff IN 
    SELECT sm.id as member_id, sm.user_id, sm.work_schedules, r.color as role_color, sm.name as staff_name
    FROM store_members sm
    LEFT JOIN store_roles r ON sm.role_id = r.id
    WHERE sm.store_id = p_store_id 
    AND sm.user_id = ANY(p_target_staff_ids)
    AND sm.work_schedules IS NOT NULL
  LOOP
    RAISE NOTICE 'Processing staff: %, member_id: %', v_staff.staff_name, v_staff.member_id;

    v_date := p_start_date;
    WHILE v_date <= p_end_date LOOP
      -- 요일 판정 (PostgreSQL DATE 타입은 기본적으로 정확한 DOW 반환)
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
            -- KST 기준 시간을 UTC 타임스탬프로 변환
            v_start_ts := timezone('Asia/Seoul', (v_date || ' ' || v_start_str || ':00')::timestamp);
            v_end_ts := timezone('Asia/Seoul', (v_date || ' ' || v_end_str || ':00')::timestamp);
            
            IF v_end_ts <= v_start_ts THEN
               v_end_ts := v_end_ts + interval '1 day';
            END IF;

            -- 시나리오 판정용 데이터 수집
            -- A. 해당 날짜 승인된 휴가 여부
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

            -- B. 시간대 중복 여부 (부등호를 사용해 경계값 겹침 허용)
            SELECT EXISTS (
                SELECT 1 
                FROM schedules s
                JOIN schedule_members sm ON s.id = sm.schedule_id
                WHERE sm.user_id = v_staff.user_id
                AND s.store_id = p_store_id
                AND s.end_time > v_start_ts 
                AND s.start_time < v_end_ts
            ) INTO v_overlap_exists;

            -- C. 해당 날짜에 이미 휴가 타입 스케줄이 있는지 여부
            SELECT EXISTS (
                SELECT 1 
                FROM schedules s
                JOIN schedule_members sm ON s.id = sm.schedule_id
                WHERE sm.user_id = v_staff.user_id
                AND s.store_id = p_store_id
                AND s.schedule_type = 'leave'
                AND (timezone('Asia/Seoul', s.start_time)::date = v_date)
            ) INTO v_leave_exists_on_date;

            -- [시나리오 판정]
            IF v_leave_exists_on_date THEN
                RAISE NOTICE 'Date: % - Scenario 4: Already has leave schedule. Skipping.', v_date;
                v_date := v_date + 1;
                CONTINUE;
            END IF;

            IF v_overlap_exists THEN
                RAISE NOTICE 'Date: % - Scenario 3: Overlap detected. Skipping.', v_date;
                v_date := v_date + 1;
                CONTINUE;
            END IF;

            -- 생성 로직
            IF v_is_on_leave THEN
                v_schedule_type := 'leave';
                v_memo := '자동 생성 (휴가 연동): ' || COALESCE(v_leave_reason, '사유 없음');
                RAISE NOTICE 'Date: % - Scenario 2: Creating LEAVE schedule.', v_date;
            ELSE
                v_schedule_type := 'regular';
                v_memo := '자동 생성됨';
                RAISE NOTICE 'Date: % - Scenario 1: Creating REGULAR schedule.', v_date;
            END IF;

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
      v_date := v_date + 1;
    END LOOP;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;