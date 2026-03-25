-- 4가지 시나리오를 반영한 스케줄 일괄 생성 RPC 최종 버전
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
  -- 1. 루프 시작: 대상 직원들
  FOR v_staff IN 
    SELECT sm.id as member_id, sm.user_id, sm.work_schedules, r.color as role_color
    FROM store_members sm
    LEFT JOIN store_roles r ON sm.role_id = r.id
    WHERE sm.store_id = p_store_id 
    AND sm.user_id = ANY(p_target_staff_ids)
    AND sm.work_schedules IS NOT NULL
  LOOP
    v_date := p_start_date;
    
    -- 2. 루프: 시작 날짜 ~ 종료 날짜
    WHILE v_date <= p_end_date LOOP
      -- KST 기준 요일 계산 (0: 일, 1: 월, ...)
      v_dow := EXTRACT(DOW FROM (v_date AT TIME ZONE 'Asia/Seoul'));
      
      v_schedule := NULL;
      -- 해당 요일의 근무 패턴 추출
      SELECT elem INTO v_schedule
      FROM jsonb_array_elements(v_staff.work_schedules) elem
      WHERE (elem->>'day')::int = v_dow
      LIMIT 1;

      -- 패턴이 있고 휴일이 아닐 때만 진행
      IF v_schedule IS NOT NULL AND (v_schedule->>'is_holiday')::boolean = false THEN
        v_start_str := v_schedule->>'start_time';
        v_end_str := v_schedule->>'end_time';

        IF v_start_str IS NOT NULL AND v_end_str IS NOT NULL THEN
            -- KST 날짜/시간 -> UTC 타임스탬프 변환 (date-utils.ts 표준 준수)
            v_start_ts := timezone('Asia/Seoul', (v_date || ' ' || v_start_str || ':00')::timestamp);
            v_end_ts := timezone('Asia/Seoul', (v_date || ' ' || v_end_str || ':00')::timestamp);
            
            -- 자정을 넘기는 근무 (익일 종료) 처리
            IF v_end_ts <= v_start_ts THEN
               v_end_ts := v_end_ts + interval '1 day';
            END IF;

            -- [기획 로직 시나리오 적용 준비]
            -- 해당 날짜에 승인된 휴가 기록이 있는지 확인
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

            -- 해당 날짜/시간대에 겹치는 기존 스케줄이 있는지 확인 (OVERLAPS 연산자 사용)
            SELECT EXISTS (
                SELECT 1 
                FROM schedules s
                JOIN schedule_members sm ON s.id = sm.schedule_id
                WHERE sm.user_id = v_staff.user_id
                AND s.store_id = p_store_id
                AND (s.start_time, s.end_time) OVERLAPS (v_start_ts, v_end_ts)
            ) INTO v_overlap_exists;

            -- 해당 날짜에 이미 '휴가' 타입의 스케줄이 존재하는지 확인 (시나리오 4번용)
            SELECT EXISTS (
                SELECT 1 
                FROM schedules s
                JOIN schedule_members sm ON s.id = sm.schedule_id
                WHERE sm.user_id = v_staff.user_id
                AND s.store_id = p_store_id
                AND s.schedule_type = 'leave'
                AND (timezone('Asia/Seoul', s.start_time)::date = v_date)
            ) INTO v_leave_exists_on_date;

            -- [기획 시나리오 판정 시작]
            
            -- 시나리오 4: 스케줄(휴가)이 이미 존재함 -> 패스
            IF v_leave_exists_on_date THEN
                -- RAISE NOTICE 'Scenario 4: Leave schedule already exists for % on %. Skipping.', v_staff.user_id, v_date;
                CONTINUE; 
            END IF;

            -- 시나리오 3: 스케줄이 있고 시간대가 겹침 -> 생성 스킵 (안 겹치면 아래로 진행)
            IF v_overlap_exists THEN
                -- RAISE NOTICE 'Scenario 3: Overlap detected for % on %. Skipping.', v_staff.user_id, v_date;
                CONTINUE;
            END IF;

            -- 시나리오 1 & 2: 스케줄이 없거나 안 겹치는 경우 생성
            IF v_is_on_leave THEN
                -- 시나리오 2: 휴가 기록이 있음 -> 휴가 타입으로 생성
                v_schedule_type := 'leave';
                v_memo := '자동 생성 (휴가 연동): ' || COALESCE(v_leave_reason, '사유 없음');
            ELSE
                -- 시나리오 1: 휴가 기록 없음 -> 일반 타입으로 생성
                v_schedule_type := 'regular';
                v_memo := '자동 생성됨';
            END IF;

            -- 최종 INSERT
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