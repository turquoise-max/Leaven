-- [기획자 핵심 로직] SSOT 기반 프론트엔드 실시간 렌더링 오버라이드를 위해 
-- DB 단에서 하드코딩으로 'leave' 타입을 덮어씌우는 트리거 및 RPC 로직 제거

-- 1. 스케줄 멤버 추가 시 스케줄 타입을 강제로 'leave'로 변경하는 트리거 제거
DROP TRIGGER IF EXISTS trigger_sync_schedule_type_on_insert ON schedule_members;
DROP TRIGGER IF EXISTS trigger_sync_schedule_type_on_member_insert ON schedule_members;
DROP FUNCTION IF EXISTS sync_schedule_type_on_member_insert();

-- 2. 스케줄 일괄 생성 시 휴가 여부를 체크하여 'leave' 타입으로 생성하는 로직 원복
-- (generate_staff_schedules)

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
    SELECT sm.id as member_id, sm.user_id, sm.work_schedules, r.color as role_color
    FROM store_members sm
    LEFT JOIN store_roles r ON sm.role_id = r.id
    WHERE sm.store_id = p_store_id
    -- RPC 호출부 호환성을 위해 user_id 배열로 받았는지, member_id 배열로 받았는지 모두 대응
    AND (sm.user_id = ANY(p_target_staff_ids) OR sm.id = ANY(p_target_staff_ids))
    AND sm.work_schedules IS NOT NULL
  LOOP
    v_date := p_start_date;
    
    WHILE v_date <= p_end_date LOOP
      v_dow := EXTRACT(DOW FROM (v_date AT TIME ZONE 'Asia/Seoul'));
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
            -- KST 기준 시간을 UTC 타임스탬프로 변환
            v_start_ts := timezone('Asia/Seoul', (v_date || ' ' || v_start_str || ':00')::timestamp);
            v_end_ts := timezone('Asia/Seoul', (v_date || ' ' || v_end_str || ':00')::timestamp);

            IF v_end_ts <= v_start_ts THEN
               v_end_ts := v_end_ts + interval '1 day';
            END IF;

            -- 중복 체크 (OVERLAPS)
            IF NOT EXISTS (
                SELECT 1
                FROM schedules s
                JOIN schedule_members sm ON s.id = sm.schedule_id
                WHERE sm.member_id = v_staff.member_id
                AND s.store_id = p_store_id
                AND (s.start_time, s.end_time) OVERLAPS (v_start_ts, v_end_ts)
            ) THEN
                -- 신규 생성 (무조건 regular)
                INSERT INTO schedules (
                    store_id, title, start_time, end_time, color, memo, schedule_type
                )
                VALUES (
                    p_store_id,
                    '근무',
                    v_start_ts,
                    v_end_ts,
                    COALESCE(v_staff.role_color, '#808080'),
                    '자동 생성됨',
                    'regular'
                )
                RETURNING id INTO v_new_schedule_id;

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