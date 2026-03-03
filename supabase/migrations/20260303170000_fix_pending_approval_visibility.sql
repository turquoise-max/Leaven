-- ==========================================
-- Fix Pending Approval Visibility
-- 사용자가 가입 승인 대기(pending_approval) 상태일 때도 
-- 본인의 신청 내역을 확인할 수 있도록 RLS 정책을 명시적으로 추가합니다.
-- ==========================================

-- 1. store_members 테이블에 대한 본인 조회 정책 명시적 추가
-- 기존 정책이 있을 수 있으므로 drop 후 create
drop policy if exists "Users can see their own memberships." on public.store_members;

create policy "Users can see their own memberships."
  on public.store_members
  for select
  using ( auth.uid() = user_id );

-- 2. stores 테이블에 대한 정책은 기존 get_my_store_role 함수를 사용하므로
-- pending_approval 상태여도 role이 반환되어 조회가 가능해야 함.
-- 하지만 확실하게 하기 위해 정책을 다시 한번 정의함.

-- 2-1. get_my_store_role 함수가 status와 관계없이 role을 반환하는지 확인 (기존 함수 유지)
-- create or replace function public.get_my_store_role ... (이미 정의됨)

-- 2-2. stores 정책 재적용 (혹시 모를 누락 방지)
drop policy if exists "Stores are viewable by members." on public.stores;

create policy "Stores are viewable by members."
  on public.stores
  for select
  using (
    public.get_my_store_role(id) is not null
  );