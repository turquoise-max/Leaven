-- 1. 트리거 함수 최종 개선 (시간대 로직 통일 및 무한 루프 방지)
CREATE OR REPLACE FUNCTION sync_schedule_type_on_member_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_is_on_leave BOOLEAN;
    v_leave_reason TEXT;
    v_schedule_start_date DATE;
BEGIN
    -- 스케줄의 시작 날짜 확인 (KST 기준 날짜만 추출)
    SELECT (timezone('Asia/Seoul', start_time)::date) INTO v_schedule_start_date
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
    -- 주의: UPDATE 시 다시 트리거가 발생하지 않도록 조건을 잘 설정하거나 별도 처리 필요
    -- 여기서는 schedule_members에 대한 AFTER INSERT 트리거이므로 schedules 테이블 UPDATE는 안전함
    IF v_is_on_leave THEN
        UPDATE schedules
        SET 
            schedule_type = 'leave',
            memo = COALESCE(memo, '') || ' [자동 연동: 휴가]' || CASE WHEN v_leave_reason IS NOT NULL THEN ' - ' || v_leave_reason ELSE '' END
        WHERE id = NEW.schedule_id 
        AND schedule_type != 'leave'; -- 이미 휴가면 중복 업데이트 방지
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. 일괄 생성 RPC 최종 개선 (휴가 우선순위 로직 및 중복 처리)
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
  v_existing_schedule_id UUID;
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
    v_date := p_start_date;
    WHILE v_date <= p_end_date LOOP
      v_dow := EXTRACT(DOW FROM v_date);
      v_schedule := NULL;

      -- 해당 요일의 근무 패턴 찾기
      SELECT elem INTO v_schedule
      FROM jsonb_array_elements(v_staff.work_schedules) elem
      WHERE (elem->>'day')::int = v_dow
      LIMIT 1;

      -- 패턴이 있고 휴일이 아닌 경우에만 진행
      IF v_schedule IS NOT NULL AND (v_schedule->>'is_holiday')::boolean = false THEN
        v_start_str := v_schedule->>'start_time';
        v_end_str := v_schedule->>'end_time';

        IF v_start_str IS NOT NULL AND v_end_str IS NOT NULL THEN
            -- KST 기준 시간을 UTC 타임스탬프로 변환 (date-utils.ts 원칙 준수)
            v_start_ts := timezone('Asia/Seoul', (v_date || ' ' || v_start_str || ':00')::timestamp);
            v_end_ts := timezone('Asia/Seoul', (v_date || ' ' || v_end_str || ':00')::timestamp);
            
            IF v_end_ts < v_start_ts THEN
               v_end_ts := v_end_ts + interval '1 day';
            END IF;

            -- 해당 날짜에 승인된 휴가가 있는지 확인
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

            -- 타입 및 메모 설정
            IF v_is_on_leave THEN
                v_schedule_type := 'leave';
                v_memo := '자동 생성 (휴가 연동): ' || COALESCE(v_leave_reason, '사유 없음');
            ELSE
                v_schedule_type := 'regular';
                v_memo := '자동 생성됨';
            END IF;

            -- 중복 체크: 해당 날짜에 이미 해당 직원의 스케줄이 있는지 확인 (KST 기준 날짜)
            SELECT s.id INTO v_existing_schedule_id
            FROM schedules s
            JOIN schedule_members sm ON s.id = sm.schedule_id
            WHERE sm.user_id = v_staff.user_id
            AND s.store_id = p_store_id
            AND (timezone('Asia/Seoul', s.start_time)::date = v_date)
            LIMIT 1;

            IF v_existing_schedule_id IS NULL THEN
                -- 신규 생성
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
            ELSE
                -- 이미 존재하지만 '휴가'로 업데이트가 필요한 경우 (덮어쓰기 로직)
                IF v_is_on_leave THEN
                    UPDATE schedules
                    SET 
                        schedule_type = 'leave',
                        memo = v_memo,
                        updated_at = now()
                    WHERE id = v_existing_schedule_id
                    AND schedule_type != 'leave';
                END IF;
            END IF;
        END IF;
      END IF;
      v_date := v_date + 1;
    END LOOP;
  END LOOP;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;