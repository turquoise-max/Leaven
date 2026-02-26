-- ==========================================
-- 1. Permissions Table
-- ==========================================
create table public.permissions (
  code text primary key,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.permissions enable row level security;

create policy "Permissions are viewable by everyone."
  on permissions for select
  using ( true );

-- ==========================================
-- 2. Role Permissions Table
-- ==========================================
create table public.role_permissions (
  role public.member_role not null,
  permission_code text references public.permissions(code) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (role, permission_code)
);

alter table public.role_permissions enable row level security;

create policy "Role permissions are viewable by everyone."
  on role_permissions for select
  using ( true );

-- ==========================================
-- 3. Seed Data (Permissions & Role Mappings)
-- ==========================================

-- 3-1. Define Permissions
insert into public.permissions (code, description) values
  ('manage_store', '매장 정보 수정 및 설정 관리'),
  ('manage_staff', '직원 초대, 승인 및 관리'),
  ('view_sales', '매출 데이터 조회'),
  ('manage_menu', '메뉴 및 상품 관리'),
  ('manage_inventory', '재고 관리'),
  ('view_schedule', '근무 일정 조회'),
  ('manage_schedule', '근무 일정 관리');

-- 3-2. Map Permissions to Roles

-- Owner: All permissions
insert into public.role_permissions (role, permission_code)
select 'owner', code from public.permissions;

-- Manager: Most operational permissions, except maybe full store ownership transfer (which is not a permission here but logic)
insert into public.role_permissions (role, permission_code) values
  ('manager', 'manage_staff'),
  ('manager', 'view_sales'),
  ('manager', 'manage_menu'),
  ('manager', 'manage_inventory'),
  ('manager', 'view_schedule'),
  ('manager', 'manage_schedule');

-- Staff: Limited permissions
insert into public.role_permissions (role, permission_code) values
  ('staff', 'view_schedule'),
  ('staff', 'manage_inventory'); -- Staff might need to update inventory counts