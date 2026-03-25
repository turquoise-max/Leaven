-- 기존 일괄 생성 RPC 최종 복구 및 개선 (KST 시간대 로직 및 중복 처리)
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
    -- 시작 날짜부터 종료 날짜까지 루프
    v_date := p_start_date;
    WHILE v_date <= p_end_date LOOP
      -- 중요: 요일 판정 시 KST(Asia/Seoul) 시간대를 명시적으로 적용
      v_dow := EXTRACT(DOW FROM (v_date AT TIME ZONE 'Asia/Seoul'));
      
      v_schedule := NULL;
      -- 해당 요일의 근무 패턴 찾기
      SELECT elem INTO v_schedule
      FROM jsonb_array_elements(v_staff.work_schedules) elem
      WHERE (elem->>'day')::int = v_dow
      LIMIT 1;

      -- 패턴이 존재하고 휴무가 아닐 때만 생성 시도
      IF v_schedule IS NOT NULL AND (v_schedule->>'is_holiday')::boolean = false THEN
        v_start_str := v_schedule->>'start_time';
        v_end_str := v_schedule->>'end_time';

        IF v_start_str IS NOT NULL AND v_end_str IS NOT NULL THEN
            -- KST 날짜/시간을 UTC 타임스탬프로 정확히 변환하여 저장
            v_start_ts := timezone('Asia/Seoul', (v_date || ' ' || v_start_str || ':00')::timestamp);
            v_end_ts := timezone('Asia/Seoul', (v_date || ' ' || v_end_str || ':00')::timestamp);
            
            -- 자정을 넘기는 근무 처리
            IF v_end_ts < v_start_ts THEN
               v_end_ts := v_end_ts + interval '1 day';
            END IF;

            -- 해당 날짜(KST 기준)에 승인된 휴가가 있는지 확인
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

            -- 스케줄 타입 및 메모 결정
            IF v_is_on_leave THEN
                v_schedule_type := 'leave';
                v_memo := '자동 생성 (휴가 연동): ' || COALESCE(v_leave_reason, '사유 없음');
            ELSE
                v_schedule_type := 'regular';
                v_memo := '자동 생성됨';
            END IF;

            -- 중복 체크 로직: 날짜 비교 시 일관성 유지 (KST 기준)
            SELECT s.id INTO v_existing_schedule_id
            FROM schedules s
            JOIN schedule_members sm ON s.id = sm.schedule_id
            WHERE sm.user_id = v_staff.user_id
            AND s.store_id = p_store_id
            AND (timezone('Asia/Seoul', s.start_time)::date = v_date)
            LIMIT 1;

            IF v_existing_schedule_id IS NULL THEN
                -- 1. 기존 스케줄이 없으면 새로 생성
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
                -- 2. 이미 존재하지만 휴가 연동이 필요한 경우 업데이트
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