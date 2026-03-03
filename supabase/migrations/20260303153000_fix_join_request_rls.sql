-- 1. 누구나 가입 신청(INSERT) 가능하도록 정책 추가
-- 조건: 본인의 user_id로, status='pending_approval', role='staff'인 경우만 허용
CREATE POLICY "Anyone can request to join a store."
  ON public.store_members
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending_approval'
    AND role = 'staff'
  );

-- 2. 수기 등록 직원이 자신의 계정을 연결(UPDATE) 할 수 있도록 정책 추가
-- 조건: user_id가 NULL이고, status='active'인 레코드를 자신의 user_id로 업데이트
-- 하지만 UPDATE 정책은 USING 절에서 기존 행을 필터링하고, WITH CHECK 절에서 변경될 행을 검사함.
-- user_id가 NULL인 행은 auth.uid() = user_id 조건으로 필터링 불가.
-- 따라서 user_id IS NULL 인 행에 대한 업데이트 권한을 열어주되, 
-- 변경하려는 user_id가 auth.uid()여야 함을 보장해야 함.

-- 하지만 보안상 user_id IS NULL 인 행을 아무나 수정하게 하면 안 됨.
-- 애플리케이션 로직(Supabase Service Role)에서 처리하거나,
-- RPC 함수를 통해 안전하게 처리하는 것이 좋음.

-- 여기서는 INSERT 정책만 추가하고,
-- 수기 등록 직원 매칭(UPDATE)은 Service Role(admin)을 사용하여 처리하도록 actions.ts를 수정하는 방향으로 진행.
-- (Supabase Client에서 Service Role 사용 불가하므로, createClient에 service role key 사용 필요)
-- 또는 RPC 함수를 만들어서 처리.

-- RPC 함수: 수기 등록 직원 매칭
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
  UPDATE public.store_members
  SET 
    user_id = auth.uid(),
    status = 'pending_approval', -- 점주가 최종 승인하도록
    email = (SELECT email FROM auth.users WHERE id = auth.uid()) -- 이메일도 업데이트
  WHERE id = target_member_id;

  RETURN true;
END;
$$;