-- 1. Stores 테이블에 invite_code 추가
ALTER TABLE public.stores 
ADD COLUMN invite_code text;

-- 기존 매장에 랜덤 초대 코드 생성 (6자리)
UPDATE public.stores 
SET invite_code = upper(substring(md5(random()::text) from 1 for 6))
WHERE invite_code IS NULL;

-- invite_code 유니크 제약 및 NOT NULL 설정
ALTER TABLE public.stores 
ALTER COLUMN invite_code SET NOT NULL,
ADD CONSTRAINT stores_invite_code_key UNIQUE (invite_code);

-- 2. Store Members 테이블 구조 변경
ALTER TABLE public.store_members
ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.store_members
ADD COLUMN name text,
ADD COLUMN phone text,
ADD COLUMN email text;

-- 3. 매장 코드로 매장 정보 조회하는 RPC 함수 (RLS 우회)
CREATE OR REPLACE FUNCTION public.verify_invite_code(code text)
RETURNS TABLE (
  id uuid,
  name text,
  description text
) 
LANGUAGE plpgsql
SECURITY DEFINER -- RLS 우회를 위해 Security Definer 사용
AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.name, s.description
  FROM public.stores s
  WHERE s.invite_code = code;
END;
$$;