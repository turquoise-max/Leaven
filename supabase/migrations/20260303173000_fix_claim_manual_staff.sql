-- ==========================================
-- Fix claim_manual_staff Function
-- 수기 등록 직원 매칭 시, 사용자가 가입 신청 시 입력한 이름으로
-- store_members 테이블의 이름을 업데이트하도록 수정합니다.
-- ==========================================

CREATE OR REPLACE FUNCTION public.claim_manual_staff(
  store_id_param uuid,
  name_param text,
  phone_param text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_member_id uuid;
BEGIN
  -- 1. 매칭되는 수기 등록 직원 찾기 (user_id IS NULL)
  -- 이름과 전화번호가 일치하는 레코드를 찾습니다.
  SELECT id INTO target_member_id
  FROM public.store_members
  WHERE store_id = store_id_param
    AND user_id IS NULL
    AND name = name_param
    AND phone = phone_param
  LIMIT 1;

  IF target_member_id IS NULL THEN
    RETURN false;
  END IF;

  -- 2. user_id 업데이트 및 상태 변경 (승인 대기 상태로 변경하여 점주 확인 유도)
  -- 중요: name 컬럼도 입력받은 name_param으로 업데이트합니다.
  -- (매칭 조건이 name = name_param 이라 같을 것 같지만, 공백이나 대소문자 차이 등이 있을 수 있고,
  -- 무엇보다 사용자가 '입력한 이름'을 우선시한다는 명시적 동작입니다.)
  UPDATE public.store_members
  SET 
    user_id = auth.uid(),
    status = 'pending_approval', -- 점주가 최종 승인하도록
    email = (SELECT email FROM auth.users WHERE id = auth.uid()), -- 이메일도 업데이트
    name = name_param -- [New] 입력한 이름으로 업데이트
  WHERE id = target_member_id;

  RETURN true;
END;
$$;