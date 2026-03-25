-- 1. 기존에 잘못 생성되었을 수 있는 함수 및 트리거 삭제
DROP TRIGGER IF EXISTS trigger_sync_schedule_type_on_member_insert ON schedule_members;
DROP FUNCTION IF EXISTS sync_schedule_type_on_member_insert();
DROP TRIGGER IF EXISTS trigger_sync_schedule_on_update ON schedules;
DROP FUNCTION IF EXISTS sync_schedule_with_leave();

-- 2. 멤버가 스케줄에 추가될 때 휴가 여부를 체크하여 스케줄 타입을 업데이트하는 함수
CREATE OR REPLACE FUNCTION sync_schedule_type_on_member_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_is_on_leave BOOLEAN;
    v_leave_reason TEXT;
    v_schedule_start_date DATE;
BEGIN
    -- 스케줄의 시작 날짜 확인 (KST 기준)
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

-- 3. 멤버 추가 트리거 생성
CREATE TRIGGER trigger_sync_schedule_type_on_member_insert
AFTER INSERT ON schedule_members
FOR EACH ROW
EXECUTE FUNCTION sync_schedule_type_on_member_insert();

-- 4. 스케줄 시간이 변경될 때 다시 휴가 여부를 체크하는 함수
CREATE OR REPLACE FUNCTION sync_schedule_with_leave_on_time_update()
RETURNS TRIGGER AS $$
DECLARE
    v_member_record RECORD;
    v_is_on_leave BOOLEAN;
    v_leave_reason TEXT;
    v_new_date DATE;
BEGIN
    -- 수정된 날짜 확인
    v_new_date := timezone('Asia/Seoul', NEW.start_time)::date;

    -- 해당 스케줄의 모든 멤버에 대해 휴가 여부 재체크
    FOR v_member_record IN (SELECT member_id FROM schedule_members WHERE schedule_id = NEW.id) LOOP
        SELECT EXISTS (
            SELECT 1 FROM leave_requests
            WHERE member_id = v_member_record.member_id
            AND status = 'approved'
            AND v_new_date >= start_date
            AND v_new_date <= end_date
        ), (
            SELECT reason FROM leave_requests
            WHERE member_id = v_member_record.member_id
            AND status = 'approved'
            AND v_new_date >= start_date
            AND v_new_date <= end_date
            LIMIT 1
        ) INTO v_is_on_leave, v_leave_reason;

        IF v_is_on_leave THEN
            NEW.schedule_type := 'leave';
            NEW.memo := COALESCE(NEW.memo, '') || ' [자동 연동: 휴가]';
            EXIT; -- 한 명이라도 휴가면 스케줄 자체를 휴가 타입으로 간주 (또는 비즈니스 로직에 따라 조정)
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. 스케줄 업데이트 트리거 생성
CREATE TRIGGER trigger_sync_schedule_on_update
BEFORE UPDATE OF start_time ON schedules
FOR EACH ROW
EXECUTE FUNCTION sync_schedule_with_leave_on_time_update();