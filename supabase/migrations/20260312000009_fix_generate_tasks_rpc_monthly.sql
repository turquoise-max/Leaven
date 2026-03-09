-- Update RPC function to support monthly recurrence rules
CREATE OR REPLACE FUNCTION generate_tasks_from_templates(
  p_store_id UUID,
  p_start_date DATE,
  p_end_date DATE
) RETURNS INTEGER AS $$
DECLARE
  v_template RECORD;
  v_date DATE;
  v_dow INTEGER;
  v_day_of_month INTEGER;
  v_is_last_day_of_month BOOLEAN;
  v_should_create BOOLEAN;
  v_start_time_str TEXT;
  v_end_time_str TEXT;
  v_new_start_ts TIMESTAMP WITH TIME ZONE;
  v_new_end_ts TIMESTAMP WITH TIME ZONE;
  v_count INTEGER := 0;
BEGIN
  -- Loop through all templates for the store
  FOR v_template IN 
    SELECT 
      id, title, description, task_type, is_critical, assigned_role_id, 
      start_time, end_time, recurrence_rule
    FROM tasks
    WHERE store_id = p_store_id 
    AND is_template = true
  LOOP
    -- Loop through dates from start to end
    v_date := p_start_date;
    WHILE v_date <= p_end_date LOOP
      v_dow := EXTRACT(DOW FROM v_date); -- 0 (Sun) to 6 (Sat)
      v_day_of_month := EXTRACT(DAY FROM v_date);
      v_is_last_day_of_month := (v_date = (date_trunc('month', v_date) + interval '1 month - 1 day')::date);
      
      v_should_create := false;

      IF v_template.recurrence_rule IS NOT NULL THEN
         -- Weekly rule (days array)
         IF v_template.recurrence_rule ? 'days' THEN
            IF (v_template.recurrence_rule->'days') @> to_jsonb(v_dow) THEN
               v_should_create := true;
            END IF;
         -- Monthly rule (date or is_last_day)
         ELSIF v_template.recurrence_rule ? 'date' OR v_template.recurrence_rule ? 'is_last_day' THEN
            IF v_template.recurrence_rule->>'is_last_day' = 'true' THEN
               IF v_is_last_day_of_month THEN
                  v_should_create := true;
               END IF;
            ELSIF v_template.recurrence_rule->>'date' IS NOT NULL AND v_template.recurrence_rule->>'date' != 'null' THEN
               IF (v_template.recurrence_rule->>'date')::integer = v_day_of_month THEN
                  v_should_create := true;
               END IF;
            END IF;
         END IF;
      END IF;

      IF v_should_create THEN
         -- Extract time strings from template (in KST)
         -- Handle cases where start_time might be null (e.g., 'always' tasks)
         IF v_template.start_time IS NOT NULL THEN
            v_start_time_str := to_char(timezone('Asia/Seoul', v_template.start_time), 'HH24:MI');
            v_new_start_ts := timezone('Asia/Seoul', (v_date || ' ' || v_start_time_str || ':00')::timestamp);
         ELSE
            v_new_start_ts := timezone('Asia/Seoul', (v_date || ' 00:00:00')::timestamp);
         END IF;

         IF v_template.end_time IS NOT NULL THEN
            v_end_time_str := to_char(timezone('Asia/Seoul', v_template.end_time), 'HH24:MI');
            v_new_end_ts := timezone('Asia/Seoul', (v_date || ' ' || v_end_time_str || ':00')::timestamp);
            
            -- Handle overnight tasks
            IF v_new_end_ts < v_new_start_ts THEN
               v_new_end_ts := v_new_end_ts + interval '1 day';
            END IF;
         ELSE
            v_new_end_ts := NULL;
         END IF;

         -- Check for duplicates: Does a non-template task with the same title, role, and date exist?
         IF NOT EXISTS (
            SELECT 1 
            FROM tasks t
            WHERE t.store_id = p_store_id
            AND t.is_template = false
            AND t.title = v_template.title
            AND (t.assigned_role_id = v_template.assigned_role_id OR (t.assigned_role_id IS NULL AND v_template.assigned_role_id IS NULL))
            AND (timezone('Asia/Seoul', t.start_time)::date = v_date)
         ) THEN
            -- Insert new task instance
            INSERT INTO tasks (
              store_id, 
              title, 
              description, 
              task_type, 
              is_critical, 
              assigned_role_id, 
              status, 
              start_time, 
              end_time, 
              is_template
            )
            VALUES (
              p_store_id,
              v_template.title,
              v_template.description,
              v_template.task_type,
              v_template.is_critical,
              v_template.assigned_role_id,
              'todo', -- Default status
              v_new_start_ts,
              v_new_end_ts,
              false
            );
            
            v_count := v_count + 1;
         END IF;
      END IF;

      v_date := v_date + 1;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;