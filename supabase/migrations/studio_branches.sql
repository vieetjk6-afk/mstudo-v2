-- ============================================================================
-- CHI NHÁNH STUDIO — nhiều cơ sở trong CÙNG một tài khoản
--
-- Studio lớn có 2–5 cơ sở: mỗi nơi một ê-kíp, một phòng chụp, một sổ thu chi,
-- nhưng CHUNG một tài khoản, chung bảng giá, chung thư viện album. Vì vậy chi
-- nhánh là một CHIỀU PHÂN LOẠI thêm vào dữ liệu sẵn có, KHÔNG phải một tài
-- khoản studio thứ hai: không nhân bản bảng nào, chỉ thêm cột `branch_id`.
--
-- Hệ quả quan trọng: `branch_id` LUÔN cho phép NULL, nghĩa là "chưa gán chi
-- nhánh". Studio một cơ sở (đa số) không khai chi nhánh nào thì mọi dòng đều
-- NULL và mọi màn hoạt động y như trước — tính năng này không được phép làm
-- studio đang chạy phải đi gán lại dữ liệu cũ.
--
-- Chạy 1 lần trong Supabase SQL Editor (idempotent, chạy lại vẫn an toàn).
-- ============================================================================

create table if not exists public.studio_branches (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  name        text not null default '',
  -- Mã ngắn studio tự đặt (Q1, GV, HN…) — hiện trên chip chi nhánh ở chỗ chật
  -- và dùng làm tiền tố mã hợp đồng nếu studio muốn.
  code        text,
  address     text,
  phone       text,
  -- Người quản lý cơ sở: một tài khoản nhân viên của chính studio này. Xoá tài
  -- khoản đó thì chi nhánh vẫn còn, chỉ trống ô quản lý.
  manager_id  uuid references public.profiles (id) on delete set null,
  note        text,
  active      boolean not null default true,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists studio_branches_owner_idx on public.studio_branches (owner_id, position);

alter table public.studio_branches enable row level security;
drop policy if exists studio_branches_owner_all on public.studio_branches;
create policy studio_branches_owner_all on public.studio_branches
  for all using (public.is_studio_member(owner_id))
  with check (public.is_studio_member(owner_id));

-- ============================================================================
-- Cột branch_id trên những bảng THẬT SỰ thuộc về một cơ sở.
--
-- `on delete set null` ở mọi nơi: xoá một chi nhánh KHÔNG được xoá theo hợp
-- đồng, lịch hay khoản thu chi của nó — dữ liệu chỉ quay về trạng thái "chưa
-- gán". Đây là ràng buộc quan trọng nhất của cả migration này.
--
-- Cố ý KHÔNG thêm branch_id vào: albums/photos (thư viện dùng chung),
-- studio_pricelist / studio_packages / studio_services (bảng giá và điều khoản
-- chung toàn studio), contract_* (đã thuộc hợp đồng, hợp đồng đã có chi nhánh),
-- studio_notifications (thông báo của chủ tài khoản).
-- ============================================================================

alter table public.studio_contracts    add column if not exists branch_id uuid references public.studio_branches (id) on delete set null;
alter table public.studio_bookings     add column if not exists branch_id uuid references public.studio_branches (id) on delete set null;
alter table public.studio_expenses     add column if not exists branch_id uuid references public.studio_branches (id) on delete set null;
alter table public.studio_equipment    add column if not exists branch_id uuid references public.studio_branches (id) on delete set null;
alter table public.studio_crew         add column if not exists branch_id uuid references public.studio_branches (id) on delete set null;
-- Hai bảng dưới đến từ migration studio_appointments.sql — bọc trong khối điều
-- kiện để chạy được cả khi migration đó CHƯA chạy (thứ tự hai file không quan
-- trọng, và studio nào chưa dùng Lịch studio vẫn cài được chi nhánh).
do $$
begin
  if to_regclass('public.studio_appointments') is not null then
    alter table public.studio_appointments add column if not exists branch_id uuid references public.studio_branches (id) on delete set null;
    create index if not exists studio_appointments_branch_idx on public.studio_appointments (branch_id, appt_date);
  end if;
  if to_regclass('public.studio_rooms') is not null then
    alter table public.studio_rooms add column if not exists branch_id uuid references public.studio_branches (id) on delete set null;
    create index if not exists studio_rooms_branch_idx on public.studio_rooms (branch_id, position);
  end if;
  if to_regclass('public.rental_items') is not null then
    alter table public.rental_items add column if not exists branch_id uuid references public.studio_branches (id) on delete set null;
    create index if not exists rental_items_branch_idx on public.rental_items (branch_id, category);
  end if;
end $$;

-- Chỉ số theo (chi nhánh, ngày): mọi màn lọc theo chi nhánh đều kèm khoảng ngày.
create index if not exists studio_contracts_branch_idx on public.studio_contracts (branch_id, event_date);
create index if not exists studio_bookings_branch_idx  on public.studio_bookings (branch_id, created_at);
create index if not exists studio_expenses_branch_idx  on public.studio_expenses (branch_id, spent_at);

-- ============================================================================
-- Nhân viên thuộc chi nhánh nào.
--
-- Đặt trên `profiles` chứ không phải bảng nối riêng: một nhân viên làm ở MỘT cơ
-- sở (đó là ý nghĩa của "chi nhánh"); ai chạy nhiều nơi thì để trống và họ thấy
-- toàn studio.
--
-- CHÚ Ý BẢO MẬT: vá C1 (c1_profiles_column_grants.sql) đã thu hồi quyền UPDATE
-- toàn bảng profiles của `authenticated` và chỉ cấp lại một danh sách cột an
-- toàn. Cột này CỐ Ý không nằm trong danh sách đó — nếu cấp, một nhân viên có
-- thể tự đổi chi nhánh của mình. Việc gán chi nhánh đi qua service-role ở
-- /api/studio/staff, giống như gán vai trò.
-- ============================================================================
alter table public.profiles add column if not exists studio_branch_id uuid references public.studio_branches (id) on delete set null;
create index if not exists profiles_studio_branch_idx on public.profiles (studio_branch_id);

-- ── Kiểm tra sau khi chạy ────────────────────────────────────────────────────
-- select table_name from information_schema.columns
-- where table_schema='public' and column_name in ('branch_id','studio_branch_id')
-- order by table_name;
