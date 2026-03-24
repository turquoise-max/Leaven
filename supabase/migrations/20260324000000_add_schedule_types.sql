-- Enum for schedule types
CREATE TYPE schedule_type AS ENUM (
    'regular',     -- 정규 근무
    'substitute',  -- 대체 근무
    'overtime',    -- 연장 근무
    'off',         -- 휴무
    'leave',       -- 휴가
    'training',    -- 교육
    'etc'          -- 기타
);

-- Add column to schedules table
ALTER TABLE schedules ADD COLUMN schedule_type schedule_type DEFAULT 'regular' NOT NULL;
