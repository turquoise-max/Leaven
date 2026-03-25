-- 1. 트리거 함수 최적화 (순수하게 INSERT 시점에만 동작하도록 고정)
CREATE OR REPLACE FUNCTION sync_schedule_type_on_member_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_is_on_leave BOOLEAN;
    v_leave_reason TEXT;
    v_schedule_start_date DATE;
BEGIN
    -- 스케줄 시작 시간을 KST 날짜로 변환하여 휴가 여부 판단
    SELECT (timezone('Asia/Seoul', start_time)::date) INTO v_schedule_start_date
    FROM schedules WHERE id = NEW.schedule_id;

    -- 휴가 승인 내역 확인
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
            memo = COALESCE(memo, '') || ' [자동 연동: 휴가]' || CASE WHEN v_leave_reason IS NOT NULL THEN ' - ' || v_leave_reason ELSE '' END
        WHERE id = NEW.schedule_id AND schedule_type != 'leave';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. 일괄 생성 RPC 최종 복구 및 안정화 (0개 생성 문제 해결)
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
  -- 대상 직원 루프 (p_target_staff_ids는 프론트엔드에서 member_id를 넘겨줄 수도, user_id를 넘겨줄 수도 있으므로 양방향 체크)
  FOR v_staff IN 
    SELECT sm.id as member_id, sm.user_id, sm.work_schedules, r.color as role_color
    FROM store_members sm
    LEFT JOIN store_roles r ON sm.role_id = r.id
    WHERE sm.store_id = p_store_id 
    AND (sm.user_id = ANY(p_target_staff_ids) OR sm.id = ANY(p_target_staff_ids))
    AND sm.work_schedules IS NOT NULL
  LOOP
    -- RAISE NOTICE 'Processing Member: %', v_staff.member_id;

    v_date := p_start_date;
    WHILE v_date <= p_end_date LOOP
      -- 요일 추출 (0: 일, 1: 월...)
      v_dow := EXTRACT(DOW FROM v_date);
      
      -- 해당 요일 근무 패턴 검색
      v_schedule := NULL;
      FOR v_schedule IN SELECT elem FROM jsonb_array_elements(v_staff.work_schedules) elem LOOP
          IF (v_schedule->>'day')::int = v_dow AND (v_schedule->>'is_holiday')::boolean = false THEN
              v_start_str := v_schedule->>'start_time';
              v_end_str := v_schedule->>'end_time';

              IF v_start_str IS NOT NULL AND v_end_str IS NOT NULL THEN
                  -- 시간대 변환 (Asia/Seoul 입력 -> UTC 저장)
                  v_start_ts := timezone('Asia/Seoul', (v_date || ' ' || v_start_str || ':00')::timestamp);
                  v_end_ts := timezone('Asia/Seoul', (v_date || ' ' || v_end_str || ':00')::timestamp);
                  IF v_end_ts <= v_start_ts THEN v_end_ts := v_end_ts + interval '1 day'; END IF;

                  -- 1. 중복 체크: 이미 동일한 시간대에 스케줄이 있는지 (부등호 방식)
                  IF NOT EXISTS (
                      SELECT 1 FROM schedules s
                      JOIN schedule_members sm ON s.id = sm.schedule_id
                      WHERE sm.member_id = v_staff.member_id
                      AND s.store_id = p_store_id
                      AND s.end_time > v_start_ts AND s.start_time < v_end_ts
                  ) THEN
                      -- 2. 휴가 확인
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

                      -- 3. 스케줄 생성
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