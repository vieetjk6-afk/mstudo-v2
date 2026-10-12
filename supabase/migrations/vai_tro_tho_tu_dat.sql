-- ============================================================================
-- VAI TRÒ THỢ STUDIO TỰ ĐẶT (tab "Đội ngũ thợ")
--
-- Vì sao: bảy vai trò có sẵn (Photographer, Cameraman, Trang điểm, Làm tóc,
-- Trợ lý, Sửa ảnh / Dựng phim, Khác) không đủ cho mọi studio — có nơi cần
-- "Flycam", "Stylist", "MC", "Thợ in album". Trước bản này họ chỉ còn cách chọn
-- "Khác", rồi bảng lương, cổng thợ, tin Zalo gửi thợ đều hiện "Khác".
--
-- Bảng studio_crew_roles giữ HAI loại dòng (xem src/lib/crew-roles.ts):
--   • key = khoá có sẵn (vd 'makeup') → ĐÈ vai trò có sẵn: đổi tên (label khác
--     rỗng), ẩn khỏi ô chọn (active = false), đổi thứ tự (position).
--   • key = 'c_xxxxxxxx'              → vai trò studio tự thêm; `kinds` = nhóm
--     hợp đồng (shoot / makeup / combo) mà nó hiện trong ô chọn.
-- Xoá vai trò tự thêm là xoá MỀM (active = false): hợp đồng cũ đã gán vẫn tra
-- ra đúng tên.
--
-- contract_crew.role trước đây có CHECK chỉ nhận bảy khoá có sẵn → BỎ ràng buộc
-- đó (không tạo lại). studio_crew.role vốn là chữ tự do, không cần sửa.
--
-- Quyền: thành viên studio ĐỌC được (ô chọn ở hợp đồng cần); chỉ chủ studio và
-- quản lý toàn studio được SỬA — cùng mức với "gán chi nhánh" (canAssignBranch).
--
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

do $$
declare missing text[] := '{}';
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'profiles')
  then missing := missing || 'profiles'; end if;
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'contract_crew')
  then missing := missing || 'contract_crew'; end if;

  if array_length(missing, 1) > 0 then
    raise exception
      'Thiếu bảng nền: %. Hãy chạy supabase/setup-all.sql trước (nó gồm cả schema nền lẫn migration này).',
      array_to_string(missing, ', ');
  end if;
end $$;

create table if not exists public.studio_crew_roles (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  key        text not null check (length(key) between 1 and 40),
  -- Rỗng trên dòng đè vai trò có sẵn = giữ tên mặc định của app.
  label      text not null default '' check (length(label) <= 60),
  kinds      text[] not null default '{shoot,makeup,combo}'
               check (kinds <@ array['shoot', 'makeup', 'combo']::text[]),
  active     boolean not null default true,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  unique (owner_id, key)
);
create index if not exists studio_crew_roles_owner_idx on public.studio_crew_roles (owner_id, position);

alter table public.studio_crew_roles enable row level security;

drop policy if exists studio_crew_roles_member_read on public.studio_crew_roles;
create policy studio_crew_roles_member_read on public.studio_crew_roles
  for select using (public.is_studio_member(owner_id));

drop policy if exists studio_crew_roles_manager_write on public.studio_crew_roles;
create policy studio_crew_roles_manager_write on public.studio_crew_roles
  for all
  using (
    owner_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.profiles p
               where p.id = auth.uid() and p.studio_owner_id = owner_id and p.studio_role = 'manager')
  )
  with check (
    owner_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.profiles p
               where p.id = auth.uid() and p.studio_owner_id = owner_id and p.studio_role = 'manager')
  );

-- Vai trò tự đặt phải ghi được vào hợp đồng → bỏ ràng buộc bảy khoá cũ.
-- (crew_role_makeup.sql cũng không tạo lại nó khi bảng trên đã có.)
alter table public.contract_crew drop constraint if exists contract_crew_role_check;
