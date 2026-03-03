-- 사용자가 자신의 멤버십 정보를 수정할 수 있도록 허용 (초대 수락, 정보 수정 등)
CREATE POLICY "Users can update their own membership."
  ON public.store_members
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 사용자가 자신의 가입 요청을 취소하거나 탈퇴할 수 있도록 허용
CREATE POLICY "Users can delete their own membership."
  ON public.store_members
  FOR DELETE
  USING (auth.uid() = user_id);